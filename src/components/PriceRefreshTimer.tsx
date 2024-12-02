import React, { useState, useEffect } from 'react';

interface PriceRefreshTimerProps {
  onRefresh: () => void;
  isEnabled: boolean;
}

export const PriceRefreshTimer: React.FC<PriceRefreshTimerProps> = ({
  onRefresh,
  isEnabled
}) => {
  const [timeLeft, setTimeLeft] = useState(30);

  // Reset timer when disabled
  useEffect(() => {
    if (!isEnabled) {
      setTimeLeft(30);
      return;
    }
  }, [isEnabled]);

  // Handle auto refresh
  useEffect(() => {
    if (!isEnabled) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          onRefresh();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isEnabled, onRefresh]);

  const handleClick = () => {
    if (!isEnabled) return;
    onRefresh();
    setTimeLeft(30);
  };

  return (
    <button
      onClick={handleClick}
      disabled={!isEnabled}
      className="settings-button p-2 flex items-center justify-center"
      title="Click to refresh price"
    >
      <div className="relative">
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{
            transform: `rotate(${(timeLeft / 30) * 360}deg)`,
            transition: 'transform 1s linear'
          }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        <span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xs font-mono">
          {timeLeft}
        </span>
      </div>
    </button>
  );
}; 