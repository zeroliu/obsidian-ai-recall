import type React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * Card component for content containers.
 * Provides consistent styling for card-like UI elements.
 */
export const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => {
  const classes = ['ignite-card', className].filter(Boolean).join(' ');

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
};
