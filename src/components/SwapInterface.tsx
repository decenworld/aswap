import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useAccount, useWalletClient, usePublicClient } from 'wagmi';
import { toast } from 'react-toastify';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import 'react-toastify/dist/ReactToastify.css';

// Import your components
import { TokenSearchModal } from './TokenSearchModal';
import { SlippageSettings } from './SlippageSettings';
import { RouteDisplay } from './RouteDisplay';
import { SwapConfirmationModal } from './SwapConfirmationModal';
import { PriceRefreshTimer } from './PriceRefreshTimer';
import { Route, executeSwap, getAllRoutes, WAVAX } from '../utils/dex';
import { TokenInfo, NATIVE_AVAX } from '../utils/tokenLists';
import { TokenBalance, getTokenBalances, formatTokenAmount, parseTokenAmount } from '../utils/tokens';

// Constants
const FEE_COLLECTOR_ADDRESS = "0x7c1Ea8f45B920BF992f03b00711571876925fEEe";
const FEE_PERCENTAGE = 1;

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)"
];

const FEE_COLLECTOR_ABI = [
  "function collectFee(address token, uint256 amount) external returns (uint256)",
  "function FEE_PERCENTAGE() view returns (uint256)",
  "function FEE_DENOMINATOR() view returns (uint256)",
  "function swapWithFee(address router, uint256 amountIn, uint256 amountOutMin, address[] calldata path, uint256 deadline) external payable returns (uint256[] memory amounts)"
];

export const SwapInterface: React.FC = () => {
  const [fromToken, setFromToken] = useState<TokenInfo | null>(null);
  const [toToken, setToToken] = useState<TokenInfo | null>(null);
  const [amount, setAmount] = useState('');
  const [returnAmount, setReturnAmount] = useState('0');
  const [slippage, setSlippage] = useState(0.5);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [estimatedGas, setEstimatedGas] = useState("0");
  const [routes, setRoutes] = useState<Route[]>([]);
  const [isSwapping, setIsSwapping] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFromModalOpen, setIsFromModalOpen] = useState(false);
  const [isToModalOpen, setIsToModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [userTokens, setUserTokens] = useState<TokenBalance[]>([]);

  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  // Convert walletClient to ethers signer
  const signer = walletClient ? new ethers.providers.Web3Provider(walletClient as any).getSigner() : null;

  const fetchUserTokens = useCallback(async () => {
    if (!address) return;
    try {
      const balances = await getTokenBalances(publicClient, address);
      setUserTokens(balances);
    } catch (error) {
      console.error('Error fetching token balances:', error);
    }
  }, [publicClient, address]);

  const refreshPrice = useCallback(async () => {
    if (!fromToken || !toToken || !amount || !isConnected) return;

    try {
      setIsLoading(true);
      const parsedAmount = parseTokenAmount(amount, fromToken.decimals);
      const allRoutes = await getAllRoutes(
        fromToken.address,
        toToken.address,
        parsedAmount
      );
      setRoutes(allRoutes);
      if (allRoutes.length > 0) {
        setReturnAmount(formatTokenAmount(allRoutes[0].outputAmount.toString(), toToken.decimals));
      }
    } catch (error) {
      console.error('Error refreshing price:', error);
    } finally {
      setIsLoading(false);
    }
  }, [fromToken, toToken, amount, isConnected]);

  const handleSwap = async () => {
    if (!routes[0] || !fromToken || !toToken || !amount || !signer || !address) return;
    
    try {
      setIsSwapping(true);

      // Parse input amount with proper decimals
      const parsedAmount = ethers.utils.parseUnits(amount, fromToken.decimals);
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from now

      // Create contract instances
      const feeCollector = new ethers.Contract(FEE_COLLECTOR_ADDRESS, FEE_COLLECTOR_ABI, signer);

      // Only handle approvals for non-native token
      if (fromToken.address !== NATIVE_AVAX.address) {
        const fromTokenContract = new ethers.Contract(fromToken.address, ERC20_ABI, signer);
        
        // Approve fee collector for the full amount
        console.log('Approving fee collector for:', ethers.utils.formatUnits(parsedAmount, fromToken.decimals));
        const approveTx = await fromTokenContract.approve(FEE_COLLECTOR_ADDRESS, parsedAmount);
        await approveTx.wait();
        console.log('Fee collector approved');
      }

      // Prepare path
      const path = routes[0].path.map(addr => 
        addr.toLowerCase() === WAVAX.toLowerCase() && 
        (fromToken.address === NATIVE_AVAX.address || toToken.address === NATIVE_AVAX.address) 
          ? NATIVE_AVAX.address 
          : addr
      );

      // Execute swap with fee collection
      console.log('Executing swap with amount:', amount);
      console.log('Path:', path);
      console.log('Router:', routes[0].routerAddress);
      
      const minAmountOut = routes[0].outputAmount.mul(100 - Math.floor(slippage * 100)).div(100);
      console.log('Min amount out:', minAmountOut.toString());

      let swapTx;
      if (fromToken.address === NATIVE_AVAX.address) {
        swapTx = await feeCollector.swapWithFee(
          routes[0].routerAddress,
          parsedAmount,
          minAmountOut,
          path,
          deadline,
          { 
            value: parsedAmount,
            gasLimit: 500000 // Add explicit gas limit
          }
        );
      } else {
        swapTx = await feeCollector.swapWithFee(
          routes[0].routerAddress,
          parsedAmount,
          minAmountOut,
          path,
          deadline,
          { 
            gasLimit: 500000 // Add explicit gas limit
          }
        );
      }

      await swapTx.wait();
      console.log('Swap completed');

      // Reset UI
      setAmount("");
      setReturnAmount("0");
      setIsConfirmationOpen(false);
      await fetchUserTokens();
      
      toast.success("Swap completed successfully!");
    } catch (error: any) {
      console.error("Swap failed:", error);
      toast.error(error.message || "Swap failed. Please try again.");
    } finally {
      setIsSwapping(false);
    }
  };

  const handleAmountChange = (value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
    }
  };

  const handleMaxAmount = async () => {
    if (!fromToken || !address) return;
    
    try {
      if (fromToken.address === NATIVE_AVAX.address) {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const balance = await provider.getBalance(address);
        // Leave some ETH for gas
        const maxAmount = ethers.BigNumber.from(balance).mul(95).div(100);
        setAmount(ethers.utils.formatUnits(maxAmount, fromToken.decimals));
      } else {
        setAmount(formatTokenAmount(fromToken.balance || '0', fromToken.decimals));
      }
    } catch (error) {
      console.error('Error setting max amount:', error);
    }
  };

  const handleHalfAmount = async () => {
    if (!fromToken || !address) return;
    
    try {
      if (fromToken.address === NATIVE_AVAX.address) {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const balance = await provider.getBalance(address);
        // Half of balance, leaving some for gas
        const halfAmount = ethers.BigNumber.from(balance).mul(45).div(100);
        setAmount(ethers.utils.formatUnits(halfAmount, fromToken.decimals));
      } else {
        const balance = ethers.BigNumber.from(fromToken.balance || '0');
        setAmount(ethers.utils.formatUnits(balance.div(2), fromToken.decimals));
      }
    } catch (error) {
      console.error('Error setting half amount:', error);
    }
  };

  const estimateGas = async () => {
    if (!routes[0] || !fromToken || !toToken || !amount || !signer) return;
    
    try {
      // Get current network gas price
      const gasPrice = await signer.getGasPrice();
      const gasLimit = await signer.estimateGas({
        to: routes[0].routerAddress,
        data: routes[0].data || "0x",
        value: routes[0].value || "0"
      });
      
      // Add a 10% buffer to ensure transaction goes through
      const adjustedGasPrice = gasPrice.mul(110).div(100);
      const totalGas = adjustedGasPrice.mul(gasLimit);
      setEstimatedGas(ethers.utils.formatEther(totalGas));
    } catch (error) {
      console.error("Error estimating gas:", error);
      setEstimatedGas("0.01"); // Fallback estimate
    }
  };

  useEffect(() => {
    if (address) {
      fetchUserTokens();
    }
  }, [address, fetchUserTokens]);

  useEffect(() => {
    refreshPrice();
  }, [refreshPrice]);

  useEffect(() => {
    if (routes[0]) {
      estimateGas();
    }
  }, [routes[0]]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">ASwap</h1>
        <ConnectButton />
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          {/* Disclaimer Box */}
          <div className="mb-4 p-4 bg-yellow-500 bg-opacity-10 rounded-xl border border-yellow-500 text-yellow-500 text-sm">
            ⚠️ Warning: This DEX is in beta. Use at your own risk.
          </div>

          <div className="swap-card p-4">
            {/* Settings and Refresh buttons */}
            <div className="flex justify-end mb-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="settings-button p-2"
                >
                  ⚙️
                </button>
                <PriceRefreshTimer 
                  onRefresh={refreshPrice} 
                  isEnabled={!!fromToken && !!toToken && !!amount} 
                />
              </div>
            </div>

            {/* From Token */}
            <div className="mb-4">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">From:</span>
                  <div className="flex gap-2">
                    <button
                      onClick={handleHalfAmount}
                      className="px-2 py-1 text-sm bg-[var(--button-background)] rounded-md hover:bg-opacity-80"
                    >
                      Half
                    </button>
                    <button
                      onClick={handleMaxAmount}
                      className="px-2 py-1 text-sm bg-[var(--button-background)] rounded-md hover:bg-opacity-80"
                    >
                      Max
                    </button>
                  </div>
                </div>
                <div className="flex items-center bg-[var(--button-background)] p-4 rounded-xl">
                  <button
                    onClick={() => setIsFromModalOpen(true)}
                    className="token-button px-4 py-2 flex items-center min-w-[140px]"
                  >
                    {fromToken ? (
                      <>
                        {fromToken.logoURI && (
                          <img src={fromToken.logoURI} alt={fromToken.symbol} className="w-8 h-8 rounded-full mr-2" />
                        )}
                        <span className="truncate">{fromToken.symbol}</span>
                      </>
                    ) : (
                      'Select Token'
                    )}
                  </button>
                  <input
                    type="text"
                    value={amount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    placeholder="0.00"
                    className="token-amount ml-2 bg-transparent"
                  />
                </div>
                <span className="text-[var(--text-secondary)]">
                  Balance: {fromToken ? parseFloat(formatTokenAmount(fromToken.balance || '0', fromToken.decimals)).toFixed(5) : '0.00'}
                </span>
              </div>
            </div>

            {/* Swap arrow */}
            <div className="flex justify-center my-4">
              <button
                onClick={() => {
                  const temp = fromToken;
                  setFromToken(toToken);
                  setToToken(temp);
                  refreshPrice();
                }}
                className="swap-arrow-button"
              >
                ↓
              </button>
            </div>

            {/* To Token */}
            <div className="mb-4">
              <div className="flex justify-between mb-2">
                <span className="text-[var(--text-secondary)]">To:</span>
                <span className="text-[var(--text-secondary)]">
                  Balance: {toToken ? parseFloat(formatTokenAmount(toToken.balance || '0', toToken.decimals)).toFixed(5) : '0.00'}
                </span>
              </div>
              <div className="flex items-center bg-[var(--button-background)] p-4 rounded-xl">
                <button
                  onClick={() => setIsToModalOpen(true)}
                  className="token-button px-4 py-2 flex items-center min-w-[140px]"
                >
                  {toToken ? (
                    <>
                      {toToken.logoURI && (
                        <img src={toToken.logoURI} alt={toToken.symbol} className="w-8 h-8 rounded-full mr-2" />
                      )}
                      <span className="truncate">{toToken.symbol}</span>
                    </>
                  ) : (
                    'Select Token'
                  )}
                </button>
                <input
                  type="text"
                  value={returnAmount}
                  readOnly
                  placeholder="0.00"
                  className="token-amount ml-2 bg-transparent"
                />
              </div>
            </div>

            {/* Route display */}
            {routes.length > 0 && (
              <RouteDisplay
                routes={routes}
                fromToken={fromToken!}
                toToken={toToken!}
                amount={amount}
              />
            )}

            {/* Swap button */}
            <button
              onClick={handleSwap}
              disabled={!isConnected || !fromToken || !toToken || !amount || isSwapping || routes.length === 0}
              className="swap-button w-full py-4 mt-4"
            >
              {isSwapping ? 'Swapping...' : 'Swap'}
            </button>
          </div>
        </div>
      </main>

      {/* Modals */}
      <TokenSearchModal
        isOpen={isFromModalOpen}
        onClose={() => setIsFromModalOpen(false)}
        onSelectToken={setFromToken}
        selectedTokenAddress={fromToken?.address}
      />
      <TokenSearchModal
        isOpen={isToModalOpen}
        onClose={() => setIsToModalOpen(false)}
        onSelectToken={setToToken}
        selectedTokenAddress={toToken?.address}
      />
      <SlippageSettings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentSlippage={slippage}
        onSlippageChange={setSlippage}
      />
    </div>
  );
}; 