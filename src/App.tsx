import React, { useState, useEffect } from 'react';
import { Web3ReactProvider, useWeb3React } from '@web3-react/core';
import { InjectedConnector } from '@web3-react/injected-connector';
import { ethers } from 'ethers';
import { TokenBalance, getTokenBalances, formatTokenAmount, parseTokenAmount, approveToken, checkTokenAllowance } from './utils/tokens';
import { getBestRoute, executeSwap } from './utils/dex';
import { TokenSearchModal } from './components/TokenSearchModal';
import { SlippageSettings } from './components/SlippageSettings';
import { TokenInfo, initializeTokenList } from './utils/tokenLists';

const injected = new InjectedConnector({
  supportedChainIds: [43114], // Avalanche C-Chain
});

function getLibrary(provider: any) {
  return new ethers.providers.Web3Provider(provider);
}

function SwapInterface() {
  const { active, account, activate, deactivate, library } = useWeb3React<ethers.providers.Web3Provider>();
  const [userTokens, setUserTokens] = useState<TokenBalance[]>([]);
  const [fromToken, setFromToken] = useState<TokenInfo | null>(null);
  const [toToken, setToToken] = useState<TokenInfo | null>(null);
  const [amount, setAmount] = useState('');
  const [returnAmount, setReturnAmount] = useState('0.00');
  const [isLoading, setIsLoading] = useState(false);
  const [isFromModalOpen, setIsFromModalOpen] = useState(false);
  const [isToModalOpen, setIsToModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [slippage, setSlippage] = useState(0.5);

  useEffect(() => {
    initializeTokenList();
  }, []);

  useEffect(() => {
    if (active && account && library) {
      fetchUserTokens();
    }
  }, [active, account, library]);

  useEffect(() => {
    const calculateReturnAmount = async () => {
      if (!library || !fromToken || !toToken || !amount || !active) {
        setReturnAmount('0.00');
        return;
      }

      try {
        const amountIn = parseTokenAmount(amount, fromToken.decimals);
        const route = await getBestRoute(
          library,
          fromToken.address,
          toToken.address,
          amountIn.toString()
        );
        setReturnAmount(formatTokenAmount(route.outputAmount, toToken.decimals));
      } catch (error) {
        console.error('Error calculating return amount:', error);
        setReturnAmount('0.00');
      }
    };

    calculateReturnAmount();
  }, [library, fromToken, toToken, amount, active]);

  useEffect(() => {
    const connectWalletOnPageLoad = async () => {
      if (localStorage?.getItem('isWalletConnected') === 'true') {
        try {
          await activate(injected);
          localStorage.setItem('isWalletConnected', 'true');
        } catch (error) {
          console.error('Error on auto-connect:', error);
        }
      }
    };
    connectWalletOnPageLoad();
  }, [activate]);

  const fetchUserTokens = async () => {
    if (!library || !account) return;
    const balances = await getTokenBalances(library, account);
    setUserTokens(balances);
  };

  const connectWallet = async () => {
    try {
      await activate(injected);
      localStorage.setItem('isWalletConnected', 'true');
    } catch (error) {
      console.error('Error connecting wallet:', error);
    }
  };

  const disconnectWallet = () => {
    try {
      deactivate();
      localStorage.removeItem('isWalletConnected');
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    }
  };

  const handleSwap = async () => {
    if (!library || !account || !fromToken || !toToken || !amount) return;
    
    setIsLoading(true);
    try {
      const amountIn = parseTokenAmount(amount, fromToken.decimals);
      
      // Get the best route
      const route = await getBestRoute(
        library,
        fromToken.address,
        toToken.address,
        amountIn.toString()
      );
      
      // Check and handle token approval if needed (skip for native AVAX)
      if (fromToken.address !== '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
        const allowance = await checkTokenAllowance(
          library,
          fromToken.address,
          account,
          route.routerAddress
        );

        if (allowance.lt(amountIn)) {
          console.log('Approving token...');
          const maxApproval = ethers.constants.MaxUint256;
          const approveTx = await approveToken(
            library,
            fromToken.address,
            route.routerAddress,
            maxApproval
          );
          console.log('Waiting for approval confirmation...');
          await approveTx.wait();
          console.log('Token approved');
        } else {
          console.log('Token already approved');
        }
      }
      
      // Execute the swap with current slippage setting
      console.log('Executing swap with route:', route);
      const swapTx = await executeSwap(
        library,
        route,
        fromToken.address,
        toToken.address,
        amountIn.toString(),
        slippage // Pass the current slippage setting
      );
      
      console.log('Waiting for swap confirmation...');
      await swapTx.wait();
      console.log('Swap completed!');
      
      // Refresh balances
      await fetchUserTokens();
      
      // Reset form
      setAmount('');
    } catch (error: any) {
      console.error('Swap error:', error);
      alert(error.message || 'Swap failed. Check console for details.');
    }
    setIsLoading(false);
  };

  const handleHalfAmount = () => {
    if (fromToken?.balance) {
      const halfAmount = fromToken.balance.div(2);
      setAmount(formatTokenAmount(halfAmount, fromToken.decimals).slice(0, 10));
    }
  };

  const handleMaxAmount = () => {
    if (fromToken?.balance) {
      setAmount(formatTokenAmount(fromToken.balance, fromToken.decimals).slice(0, 10));
    }
  };

  // Helper function to format display amounts
  const formatDisplayAmount = (amount: string): string => {
    const [whole, decimal] = amount.split('.');
    if (!decimal) return amount;
    return `${whole}.${decimal.slice(0, 10)}`;
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
        <div className="flex items-center space-x-8">
          <h1 className="text-2xl font-bold">ASWAP</h1>
          <nav className="flex space-x-6">
            
            {/* <button className="text-[var(--text-secondary)] hover:text-white">Swap</button>
            <button className="text-[var(--text-secondary)] hover:text-white">Limit</button>
            <button className="text-[var(--text-secondary)] hover:text-white">DCA</button> */}
            
          </nav>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={active ? disconnectWallet : connectWallet}
            className="px-4 py-2 rounded-lg bg-[var(--button-background)] text-[var(--text-primary)] border border-[var(--border-color)] hover:bg-[#242b3d]"
          >
            {active ? `${account?.slice(0, 6)}...${account?.slice(-4)}` : 'Connect Wallet'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="swap-card p-4">
            {/* Settings and Amount Controls */}
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleHalfAmount}
                  className="px-2 py-1 text-sm rounded-lg bg-[var(--button-background)] text-[var(--text-secondary)] hover:text-white"
                >
                  HALF
                </button>
                <button
                  onClick={handleMaxAmount}
                  className="px-2 py-1 text-sm rounded-lg bg-[var(--button-background)] text-[var(--text-secondary)] hover:text-white"
                >
                  MAX
                </button>
              </div>
              <button 
                className="settings-button p-2"
                onClick={() => setIsSettingsOpen(true)}
              >
                ⚙️
              </button>
            </div>

            {/* Token Selection and Amount Input */}
            <div className="space-y-4">
              {/* From Token */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm text-[var(--text-secondary)]">You're Selling</label>
                  {fromToken && fromToken.balance && active && (
                    <div className="text-sm text-[var(--text-secondary)]">
                      {formatDisplayAmount(formatTokenAmount(fromToken.balance, fromToken.decimals))} {fromToken.symbol}
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setIsFromModalOpen(true)}
                    className="token-button flex items-center px-3 py-2 min-w-fit"
                  >
                    {fromToken ? (
                      <>
                        <img
                          src={fromToken.logoURI}
                          alt={fromToken.symbol}
                          className="w-6 h-6 rounded-full mr-2"
                        />
                        <span className="whitespace-nowrap">{fromToken.symbol}</span>
                      </>
                    ) : (
                      <span>Select token</span>
                    )}
                  </button>
                  <input
                    type="text"
                    value={formatDisplayAmount(amount)}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="token-amount"
                  />
                </div>
              </div>

              {/* Swap Arrow */}
              <div className="flex justify-center">
                <button 
                  onClick={() => {
                    const temp = fromToken;
                    setFromToken(toToken);
                    setToToken(temp);
                  }}
                  className="swap-arrow-button"
                >
                  ⇅
                </button>
              </div>

              {/* To Token */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm text-[var(--text-secondary)]">You're Buying</label>
                  {/*
                  {toToken && toToken.balance && active && (
                    <div className="text-sm text-[var(--text-secondary)]">
                      {formatDisplayAmount(formatTokenAmount(toToken.balance, toToken.decimals))} {toToken.symbol}
                    </div>
                  )}
                    */}
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setIsToModalOpen(true)}
                    className="token-button flex items-center px-3 py-2 min-w-fit"
                  >
                    {toToken ? (
                      <>
                        <img
                          src={toToken.logoURI}
                          alt={toToken.symbol}
                          className="w-6 h-6 rounded-full mr-2"
                        />
                        <span className="whitespace-nowrap">{toToken.symbol}</span>
                      </>
                    ) : (
                      <span>Select token</span>
                    )}
                  </button>
                  <div className="token-amount text-[var(--text-secondary)]">
                    {formatDisplayAmount(returnAmount)}
                  </div>
                </div>
              </div>

              {/* Price Info */}
              
            
              {/* Swap Button */}
              <button
                onClick={handleSwap}
                disabled={!active || !fromToken || !toToken || !amount || isLoading}
                className="swap-button w-full py-3 mt-2"
              >
                {isLoading ? 'Swapping...' : !amount ? 'Enter an amount' : active ? 'Swap' : 'Connect Wallet'}
              </button>
            </div>
          </div>
          
          {/* Disclaimer */}
          <div className="mt-4 p-4 rounded-lg bg-yellow-500 bg-opacity-10 border border-yellow-500 text-yellow-500 text-sm">
            <p className="mb-2 font-semibold">⚠️ Beta Release - Use at Your Own Risk</p>
            <p>
              This decentralized exchange is currently in beta. While we strive for security and reliability:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>All transactions are executed at your own risk</li>
              <li>Funds may be lost due to smart contract vulnerabilities or user error</li>
              <li>Test with small amounts first</li>
              <li>We are not responsible for any losses incurred</li>
            </ul>
          </div>
        </div>
      </main>

      {/* Modals */}
      <TokenSearchModal
        isOpen={isFromModalOpen}
        onClose={() => setIsFromModalOpen(false)}
        onSelect={(token) => {
          setFromToken(token);
          setIsFromModalOpen(false);
        }}
        selectedTokenAddress={fromToken?.address}
      />

      <TokenSearchModal
        isOpen={isToModalOpen}
        onClose={() => setIsToModalOpen(false)}
        onSelect={(token) => {
          setToToken(token);
          setIsToModalOpen(false);
        }}
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

function App() {
  return (
    <Web3ReactProvider getLibrary={getLibrary}>
      <SwapInterface />
    </Web3ReactProvider>
  );
}

export default App;
