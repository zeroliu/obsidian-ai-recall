import type React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Reusable button component with variants and sizes.
 * Integrates with Obsidian theme through CSS variables.
 */
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  disabled,
  ...props
}) => {
  const baseClass = 'ignite-button';
  const variantClass = `ignite-button--${variant}`;
  const sizeClass = `ignite-button--${size}`;
  const disabledClass = disabled ? 'ignite-button--disabled' : '';

  const classes = [baseClass, variantClass, sizeClass, disabledClass, className]
    .filter(Boolean)
    .join(' ');

  return (
    <button type="button" className={classes} disabled={disabled} {...props}>
      {children}
    </button>
  );
};
