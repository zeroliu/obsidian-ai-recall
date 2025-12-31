import type React from 'react';

export interface ProgressBarProps {
  value: number; // 0-100
  max?: number;
  label?: string;
  showPercentage?: boolean;
}

/**
 * Visual progress indicator for milestone completion.
 * Displays progress as a percentage with optional label.
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  label,
  showPercentage = true,
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className="ignite-progress-container">
      {(label || showPercentage) && (
        <div className="ignite-progress-header">
          {label && <span className="ignite-progress-label">{label}</span>}
          {showPercentage && (
            <span className="ignite-progress-percentage">{Math.round(percentage)}%</span>
          )}
        </div>
      )}
      <div className="ignite-progress-bar">
        <div
          className="ignite-progress-bar-fill"
          style={{ width: `${percentage}%` }}
          role="progressbar"
          tabIndex={0}
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
    </div>
  );
};
