import type React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

/**
 * Input component with label and error states.
 * Provides accessible form input with validation feedback.
 */
export const Input: React.FC<InputProps> = ({ label, error, className = '', id, ...props }) => {
  const inputId = id || `input-${Math.random().toString(36).substring(2, 9)}`;
  const inputClasses = ['ignite-input', error ? 'ignite-input--error' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="ignite-input-container">
      {label && (
        <label htmlFor={inputId} className="ignite-input-label">
          {label}
        </label>
      )}
      <input id={inputId} className={inputClasses} {...props} />
      {error && <span className="ignite-input-error">{error}</span>}
    </div>
  );
};
