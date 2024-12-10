import React, { useState, useEffect, useCallback } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, usePublicClient } from 'wagmi';
import { TokenBalance, getTokenBalances, formatTokenAmount, parseTokenAmount } from '../utils/tokens';
import { getAllRoutes, executeSwap, Route } from '../utils/dex';
import { TokenSearchModal } from './TokenSearchModal';
import { SlippageSettings } from './SlippageSettings';
import { TokenInfo, initializeTokenList, NATIVE_AVAX } from '../utils/tokenLists';
import { PriceRefreshTimer } from './PriceRefreshTimer';
import { RouteDisplay } from './RouteDisplay';
import { ethers } from 'ethers';

export function SwapInterface() {
  const [userTokens, setUserTokens] = useState<TokenBalance[]>([]);
  const [fromToken, setFromToken] = useState<TokenInfo | null>(null);
  const [toToken, setToToken] = useState<TokenInfo | null>(null);
  const [amount, setAmount] = useState('');
  const [returnAmount, setReturnAmount] = useState('0');
  const [isLoading, setIsLoading] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [isFromModalOpen, setIsFromModalOpen] = useState(false);
  const [isToModalOpen, setIsToModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [slippage, setSlippage] = useState(0.5);
  const [routes, setRoutes] = useState<Route[]>([]);

  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();

  const fetchUserTokens = useCallback(async () => {
    if (!address || !publicClient || !isConnected) return;
    
    try {
      const balances = await getTokenBalances(publicClient, address);
      setUserTokens(balances);
      
      // Update fromToken and toToken balances if they exist
      if (fromToken) {
        const fromTokenBalance = balances.find(b => b.token.address.toLowerCase() === fromToken.address.toLowerCase());
        if (fromTokenBalance) {
          setFromToken({ ...fromToken, balance: fromTokenBalance.token.balance });
        }
      }
      
      if (toToken) {
        const toTokenBalance = balances.find(b => b.token.address.toLowerCase() === toToken.address.toLowerCase());
        if (toTokenBalance) {
          setToToken({ ...toToken, balance: toTokenBalance.token.balance });
        }
      }
    } catch (error) {
      console.error('Error fetching token balances:', error);
    }
  }, [publicClient, address, isConnected, fromToken, toToken]);

  // Add effect to refresh balances on connection state change
  useEffect(() => {
    if (isConnected) {
      fetchUserTokens();
      // Initialize token list
      initializeTokenList();
    } else {
      setUserTokens([]);
      setFromToken(null);
      setToToken(null);
    }
  }, [isConnected, fetchUserTokens]);

  // Refresh balances periodically when connected
  useEffect(() => {
    if (!isConnected) return;
    
    const intervalId = setInterval(() => {
      fetchUserTokens();
    }, 10000); // Refresh every 10 seconds
    
    return () => clearInterval(intervalId);
  }, [isConnected, fetchUserTokens]);

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

  useEffect(() => {
    refreshPrice();
  }, [refreshPrice, fromToken, toToken, amount]);

  const handleSwap = async () => {
    if (!fromToken || !toToken || !amount || !isConnected || routes.length === 0) return;

    try {
      setIsSwapping(true);
      const parsedAmount = parseTokenAmount(amount, fromToken.decimals);
      const tx = await executeSwap(routes[0], fromToken.address, toToken.address, parsedAmount, slippage);
      
      // Wait for transaction confirmation
      await tx.wait();
      
      // Reset form and refresh balances
      setAmount('');
      setReturnAmount('0');
      await fetchUserTokens();
      
      // Show success message or notification here if needed
    } catch (error) {
      console.error('Error executing swap:', error);
      // Show error message to user here if needed
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
                </div>
                <div className="flex items-center gap-2">
                                    <span className="text-[var(--text-secondary)]">From:</span>

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

                  <span className="text-[var(--text-secondary)]">
                    Balance: {parseFloat(formatTokenAmount(fromToken?.balance || '0', fromToken?.decimals || 18)).toFixed(5)}
                  </span>

                </div>
              </div>

              <div className="flex items-center bg-[var(--button-background)] p-4 rounded-xl mt-2">
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
                <span className="text-[var(--text-secondary)]">To: </span>
                <span className="text-[var(--text-secondary)]">
                   Balance: {parseFloat(formatTokenAmount(toToken?.balance || '0', toToken?.decimals || 18)).toFixed(5)}

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
} 