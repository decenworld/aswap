import React from 'react';
import { Route } from '../utils/dex';
import { formatTokenAmount } from '../utils/tokens';
import { TokenInfo } from '../utils/tokenLists';

interface RouteDisplayProps {
  routes: Route[];
  fromToken: TokenInfo;
  toToken: TokenInfo;
  amount: string;
}

export const RouteDisplay: React.FC<RouteDisplayProps> = ({
  routes,
  fromToken,
  toToken,
  amount,
}) => {
  if (!routes.length) return null;

  const getExchangeRate = (route: Route) => {
    const inputAmount = parseFloat(amount || '0');
    if (inputAmount === 0) return '0';
    
    const outputAmount = parseFloat(formatTokenAmount(route.outputAmount.toString(), toToken.decimals));
    return (outputAmount / inputAmount).toFixed(2);
  };

  return (
    <div className="mt-4 p-4 rounded-lg bg-[var(--card-background)] border border-[var(--border-color)]">
      <h3 className="text-[var(--text-primary)] font-semibold mb-4">Route Information</h3>
      
      {/* Best Route */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-[var(--text-secondary)]">Best Route:</span>
          <span className="text-[var(--accent-color)]">{routes[0].dex}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--text-secondary)]">Exchange Rate:</span>
          <span className="text-[var(--text-primary)]">
            1 {fromToken.symbol} = {getExchangeRate(routes[0])} {toToken.symbol}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--text-secondary)]">Expected Output:</span>
          <span className="text-[var(--text-primary)]">
            {parseFloat(formatTokenAmount(routes[0].outputAmount.toString(), toToken.decimals)).toFixed(2)} {toToken.symbol}
          </span>
        </div>
      </div>

      {/* Other Routes */}
      {routes.length > 1 && (
        <div>
          <div className="text-sm text-[var(--text-secondary)] mb-2">Other Routes:</div>
          {routes.slice(1).map((route, index) => (
            <div key={index} className="flex flex-col py-2 border-t border-[var(--border-color)]">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-secondary)]">{route.dex}</span>
                <span className="text-[var(--text-primary)]">
                  {parseFloat(formatTokenAmount(route.outputAmount.toString(), toToken.decimals)).toFixed(2)} {toToken.symbol}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-secondary)]">Exchange Rate:</span>
                <span className="text-[var(--text-primary)]">
                  1 {fromToken.symbol} = {getExchangeRate(route)} {toToken.symbol}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}; 