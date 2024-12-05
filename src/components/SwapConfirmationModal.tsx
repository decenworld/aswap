import React from 'react';
import { TokenInfo } from '../utils/tokenLists';
import { Route } from '../utils/dex';
import { formatTokenAmount } from '../utils/tokens';

interface SwapConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  fromToken: TokenInfo;
  toToken: TokenInfo;
  amount: string;
  route: Route;
  estimatedGas: string;
}

export const SwapConfirmationModal: React.FC<SwapConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  fromToken,
  toToken,
  amount,
  route,
  estimatedGas
}) => {
  if (!isOpen) return null;

  const parsedAmount = parseFloat(amount);
  const feeAmount = parsedAmount * 0.01; // 1% fee
  const swapAmount = parsedAmount - feeAmount;
  const outputAmount = formatTokenAmount(route.outputAmount.toString(), toToken.decimals);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-[var(--card-background)] rounded-2xl w-full max-w-md mx-4 p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-[var(--text-primary)]">Confirm Swap</h3>
          <button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-white p-1"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* You send (total) */}
          <div className="bg-[var(--button-background)] p-4 rounded-xl">
            <div className="text-sm text-[var(--text-secondary)] mb-2">You send (total)</div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <img src={fromToken.logoURI} alt={fromToken.symbol} className="w-8 h-8 rounded-full mr-2" />
                <span className="text-lg font-medium">{fromToken.symbol}</span>
              </div>
              <div className="text-right">
                <div className="text-lg font-medium">{amount}</div>
                <div className="text-sm text-[var(--text-secondary)]">≈ ${(parsedAmount * 35).toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* Fee breakdown */}
          <div className="bg-[var(--button-background)] p-4 rounded-xl">
            <div className="text-sm text-[var(--text-secondary)] mb-2">Fee Breakdown</div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Protocol Fee (1%)</span>
                <span>{feeAmount.toFixed(6)} {fromToken.symbol}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Amount for Swap</span>
                <span>{swapAmount.toFixed(6)} {fromToken.symbol}</span>
              </div>
            </div>
          </div>

          {/* You receive */}
          <div className="bg-[var(--button-background)] p-4 rounded-xl">
            <div className="text-sm text-[var(--text-secondary)] mb-2">You receive</div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <img src={toToken.logoURI} alt={toToken.symbol} className="w-8 h-8 rounded-full mr-2" />
                <span className="text-lg font-medium">{toToken.symbol}</span>
              </div>
              <div className="text-right">
                <div className="text-lg font-medium">{outputAmount}</div>
                <div className="text-sm text-[var(--text-secondary)]">≈ ${route.priceUSD}</div>
              </div>
            </div>
          </div>

          {/* Transaction details */}
          <div className="border-t border-[var(--border-color)] pt-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-[var(--text-secondary)]">Route</span>
              <span className="text-[var(--accent-color)]">{route.dex}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-secondary)]">Estimated Gas</span>
              <span>{estimatedGas} AVAX</span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-[var(--button-background)] text-[var(--text-primary)] hover:bg-opacity-80"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-3 rounded-xl bg-[var(--swap-button-color)] text-black font-medium hover:bg-opacity-90"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}; 