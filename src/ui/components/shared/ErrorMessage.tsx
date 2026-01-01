import type React from 'react';
import { Button } from './Button';

/**
 * Error type for categorizing different error scenarios.
 */
export type ErrorType = 'network' | 'api' | 'validation' | 'general';

/**
 * ErrorMessage component props.
 */
export interface ErrorMessageProps {
  title?: string;
  message: string;
  type?: ErrorType;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

/**
 * Get the icon for the error type.
 */
function getErrorIcon(type: ErrorType): string {
  switch (type) {
    case 'network':
      return '📡';
    case 'api':
      return '⚠️';
    case 'validation':
      return '❌';
    default:
      return '⚠️';
  }
}

/**
 * Get the default title for the error type.
 */
function getDefaultTitle(type: ErrorType): string {
  switch (type) {
    case 'network':
      return 'Connection Error';
    case 'api':
      return 'API Error';
    case 'validation':
      return 'Validation Error';
    default:
      return 'Something went wrong';
  }
}

/**
 * ErrorMessage component for displaying user-friendly error messages.
 * Supports retry and dismiss actions.
 */
export function ErrorMessage({
  title,
  message,
  type = 'general',
  onRetry,
  onDismiss,
  className = '',
}: ErrorMessageProps) {
  const icon = getErrorIcon(type);
  const displayTitle = title ?? getDefaultTitle(type);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && onDismiss) {
      onDismiss();
    }
  };

  return (
    <div
      className={`ignite-error-message ignite-error-message-${type} ${className}`.trim()}
      role="alert"
      onKeyDown={handleKeyDown}
    >
      <div className="ignite-error-message-icon">{icon}</div>
      <div className="ignite-error-message-content">
        <h4 className="ignite-error-message-title">{displayTitle}</h4>
        <p className="ignite-error-message-text">{message}</p>
        {(onRetry || onDismiss) && (
          <div className="ignite-error-message-actions">
            {onRetry && (
              <Button variant="primary" onClick={onRetry}>
                Try Again
              </Button>
            )}
            {onDismiss && (
              <Button variant="secondary" onClick={onDismiss}>
                Dismiss
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
