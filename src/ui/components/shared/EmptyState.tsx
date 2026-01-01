import type React from 'react';
import { Button } from './Button';

/**
 * EmptyState component props.
 */
export interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  children?: React.ReactNode;
}

/**
 * EmptyState component for displaying when lists or content are empty.
 * Provides a consistent empty state pattern across the application.
 */
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
  children,
}: EmptyStateProps) {
  return (
    <div className={`ignite-empty-state ${className}`.trim()}>
      {icon && <div className="ignite-empty-state-icon">{icon}</div>}
      <h3 className="ignite-empty-state-title">{title}</h3>
      {description && <p className="ignite-empty-state-description">{description}</p>}
      {actionLabel && onAction && (
        <Button variant="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
      {children}
    </div>
  );
}
