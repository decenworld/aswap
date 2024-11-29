import React, { useState } from 'react';

interface SlippageSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  currentSlippage: number;
  onSlippageChange: (slippage: number) => void;
}

const PRESET_SLIPPAGES = [0.1, 0.5, 1.0];

export const SlippageSettings: React.FC<SlippageSettingsProps> = ({
  isOpen,
  onClose,
  currentSlippage,
  onSlippageChange,
}) => {
  const [customSlippage, setCustomSlippage] = useState<string>('');

  if (!isOpen) return null;

  const handleCustomSlippageChange = (value: string) => {
    setCustomSlippage(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0 && numValue <= 100) {
      onSlippageChange(numValue);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-[var(--card-background)] rounded-2xl w-full max-w-md p-6 border border-[var(--border-color)]">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-[var(--text-primary)]">Settings</h3>
          <button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-white p-1"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[var(--text-secondary)] mb-2">
              Slippage Tolerance
            </label>
            <div className="flex items-center gap-2">
              {PRESET_SLIPPAGES.map((slippage) => (
                <button
                  key={slippage}
                  onClick={() => {
                    setCustomSlippage('');
                    onSlippageChange(slippage);
                  }}
                  className={`px-4 py-2 rounded-xl ${
                    currentSlippage === slippage && !customSlippage
                      ? 'bg-[var(--accent-color)] text-black font-medium'
                      : 'bg-[var(--button-background)] text-[var(--text-primary)] hover:bg-opacity-80'
                  }`}
                >
                  {slippage}%
                </button>
              ))}
              <div className="relative flex items-center flex-1">
                <input
                  type="text"
                  value={customSlippage}
                  onChange={(e) => handleCustomSlippageChange(e.target.value)}
                  placeholder="Custom"
                  className="w-full px-4 py-2 bg-[var(--button-background)] text-[var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] pr-8"
                />
                <span className="absolute right-3 text-[var(--text-secondary)]">%</span>
              </div>
            </div>
          </div>

          {/* Warning Messages */}
          {parseFloat(customSlippage) > 5 && (
            <div className="flex items-center text-yellow-500 text-sm bg-yellow-500 bg-opacity-10 p-3 rounded-xl">
              <span className="mr-2">⚠️</span>
              High slippage tolerance! Your transaction may be frontrun.
            </div>
          )}
          {parseFloat(customSlippage) <= 0.1 && customSlippage !== '' && (
            <div className="flex items-center text-yellow-500 text-sm bg-yellow-500 bg-opacity-10 p-3 rounded-xl">
              <span className="mr-2">⚠️</span>
              Your transaction may fail due to low slippage tolerance.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
