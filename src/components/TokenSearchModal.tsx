import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { TokenInfo, searchTokens, getTokenList } from '../utils/tokenLists';
import { ethers } from 'ethers';

interface TokenSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectToken: (token: TokenInfo) => void;
  selectedTokenAddress?: string;
}

export const TokenSearchModal: React.FC<TokenSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectToken,
  selectedTokenAddress
}) => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTokens = useCallback(async () => {
    setLoading(true);
    try {
      let results;
      if (searchQuery.trim()) {
        results = await searchTokens(searchQuery, publicClient, address);
      } else {
        results = await getTokenList(publicClient, address);
      }
      setTokens(results);
    } catch (err) {
      console.error('Error fetching tokens:', err);
      setTokens([]);
    }
    setLoading(false);
  }, [searchQuery, publicClient, address]);

  useEffect(() => {
    if (isOpen) {
      fetchTokens();
    }
  }, [isOpen, fetchTokens]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (isOpen) {
        fetchTokens();
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, isOpen, fetchTokens]);

  const formatBalance = (token: TokenInfo) => {
    if (!token.balance) return '0';
    const balance = parseFloat(ethers.utils.formatUnits(token.balance || '0', token.decimals));
    if (balance === 0) return '0';
    if (balance < 0.00001) return '< 0.00001';
    return balance.toFixed(5);
  };

  if (!isOpen) return null;

  const handleTokenSelect = (token: TokenInfo) => {
    onSelectToken(token);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
      <div 
        className="bg-[var(--card-background)] rounded-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[var(--border-color)]">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Select Token</h2>
            <button
              onClick={onClose}
              className="text-[var(--text-secondary)] hover:text-white p-1"
            >
              ✕
            </button>
          </div>
          <input
            type="text"
            placeholder="Search name or paste address"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-[var(--button-background)] text-[var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
            autoFocus
          />
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-[var(--text-secondary)]">
              Loading...
            </div>
          ) : tokens.length === 0 ? (
            <div className="p-4 text-center text-[var(--text-secondary)]">
              No tokens found
            </div>
          ) : (
            <div className="p-2">
              {tokens.map((token) => (
                <button
                  key={token.address}
                  onClick={() => handleTokenSelect(token)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl hover:bg-[var(--button-background)] transition-colors ${
                    token.address.toLowerCase() === selectedTokenAddress?.toLowerCase()
                      ? 'bg-[var(--button-background)]'
                      : ''
                  }`}
                >
                  <div className="flex items-center min-w-0">
                    <div className="w-10 h-10 rounded-full mr-3 flex-shrink-0">
                      <img
                        src={token.logoURI}
                        alt={token.symbol}
                        className="w-full h-full rounded-full"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://raw.githubusercontent.com/traderjoe-xyz/joe-tokenlists/main/logos/0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7/logo.png';
                        }}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[var(--text-primary)] font-medium truncate">{token.symbol}</div>
                      <div className="text-[var(--text-secondary)] text-sm truncate">{token.name}</div>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-[var(--text-primary)]">
                      {formatBalance(token)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
