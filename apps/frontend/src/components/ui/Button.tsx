import type { ButtonHTMLAttributes } from 'react';
import { SpinnerIcon } from './icons';
import './Button.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'danger-secondary';
  /** Shows a spinner, disables the button and marks it as busy. */
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = ['ui-button', `ui-button--${variant}`, loading && 'ui-button--loading', className]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      {...rest}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading && <SpinnerIcon className="ui-button__spinner" />}
      {children}
    </button>
  );
}
