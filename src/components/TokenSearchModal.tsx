import React, { useState, useEffect, useCallback } from 'react';
import { useWeb3React } from '@web3-react/core';
import { TokenInfo, searchTokens, getTokenList } from '../utils/tokenLists';
import { formatTokenAmount } from '../utils/tokens';

interface TokenSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: TokenInfo) => void;
  selectedTokenAddress?: string;
}

const DEFAULT_TOKEN_ICON = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjEwIj48L2NpcmNsZT48cGF0aCBkPSJNOS4wOSA5YTMgMyAwIDAgMSA1LjgzIDFjMCAyLTMgMy0zIDMiPjwvcGF0aD48bGluZSB4MT0iMTIiIHkxPSIxNyIgeDI9IjEyLjAxIiB5Mj0iMTciPjwvbGluZT48L3N2Zz4=';

export const TokenSearchModal: React.FC<TokenSearchModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  selectedTokenAddress
}) => {
  const { library, account } = useWeb3React();
  const [searchQuery, setSearchQuery] = useState('');
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTokens = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (searchQuery.trim()) {
        const results = await searchTokens(searchQuery, library, account);
        setTokens(results);
      } else {
        const allTokens = await getTokenList(library, account);
        setTokens(allTokens);
      }
    } catch (err) {
      setError('Error loading tokens');
      console.error(err);
    }
    setLoading(false);
  }, [searchQuery, library, account]);

  useEffect(() => {
    if (isOpen) {
      loadTokens();
    }
  }, [loadTokens, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-[var(--card-background)] rounded-2xl w-full max-w-md p-4 max-h-[90vh] flex flex-col border border-[var(--border-color)]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Select Token</h2>
          <button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-white p-1"
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by name, symbol, or paste address"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[var(--button-background)] text-[var(--text-primary)] rounded-xl p-3 border border-[var(--border-color)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center text-[var(--text-secondary)] py-4">Loading...</div>
          ) : error ? (
            <div className="text-center text-red-500 py-4">{error}</div>
          ) : (
            <div className="space-y-1">
              {tokens.map((token) => (
                <button
                  key={token.address}
                  onClick={() => onSelect(token)}
                  className={`w-full flex items-center p-3 rounded-xl hover:bg-[var(--button-background)] transition-colors ${
                    token.address.toLowerCase() === selectedTokenAddress?.toLowerCase()
                      ? 'bg-[var(--button-background)]'
                      : ''
                  }`}
                >
                  <img
                    src={token.logoURI || DEFAULT_TOKEN_ICON}
                    alt={token.symbol}
                    className="w-8 h-8 rounded-full mr-3"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = DEFAULT_TOKEN_ICON;
                    }}
                  />
                  <div className="flex-1 text-left">
                    <div className="text-[var(--text-primary)] font-medium">{token.symbol}</div>
                    <div className="text-[var(--text-secondary)] text-sm">{token.name}</div>
                  </div>
                  {token.balance && !token.balance.isZero() && (
                    <div className="text-right">
                      <div className="text-[var(--text-primary)]">
                        {formatTokenAmount(token.balance, token.decimals)}
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
