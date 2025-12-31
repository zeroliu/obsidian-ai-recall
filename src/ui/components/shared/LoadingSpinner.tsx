import type React from 'react';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

/**
 * Loading spinner component for async operations.
 * Shows animated spinner with optional label text.
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', label }) => {
  const sizeClass = `ignite-spinner--${size}`;

  return (
    <div className="ignite-spinner-container">
      <output className={`ignite-spinner ${sizeClass}`} aria-label="Loading">
        <div className="ignite-spinner-circle" />
      </output>
      {label && <span className="ignite-spinner-label">{label}</span>}
    </div>
  );
};
