import type { InputHTMLAttributes, ReactNode } from 'react';
import './Input.css';

export interface InputToggle {
  /** Visible text, e.g. "Pokaż". */
  label: string;
  /** Accessible name, e.g. "Pokaż hasło". */
  ariaLabel?: string;
  onToggle: () => void;
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id: string;
  label: string;
  /** Helper text below the field, hidden while an error is shown. */
  hint?: ReactNode;
  /** Error message; marks the field as invalid. */
  error?: string;
  /** Red border without a message, e.g. a form-level login failure. */
  invalid?: boolean;
  /** Inline text button inside the field, e.g. show/hide password. */
  toggle?: InputToggle;
}

export function Input({
  id,
  label,
  hint,
  error,
  invalid = false,
  toggle,
  className,
  disabled,
  'aria-describedby': callerDescribedBy,
  ...rest
}: InputProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const ownDescribedBy = error ? errorId : hint ? hintId : undefined;
  const describedBy =
    [ownDescribedBy, callerDescribedBy?.trim()].filter(Boolean).join(' ') || undefined;

  return (
    <div className={['ui-input', className].filter(Boolean).join(' ')}>
      <label className="ui-input__label" htmlFor={id}>
        {label}
      </label>
      <div className={`ui-input__field${error || invalid ? ' ui-input__field--error' : ''}`}>
        <input
          {...rest}
          id={id}
          className="ui-input__control"
          disabled={disabled}
          aria-invalid={Boolean(error) || invalid}
          aria-describedby={describedBy}
        />
        {toggle && (
          <button
            type="button"
            className="ui-input__toggle"
            onClick={toggle.onToggle}
            aria-label={toggle.ariaLabel}
            disabled={disabled}
          >
            {toggle.label}
          </button>
        )}
      </div>
      {error ? (
        <span id={errorId} className="ui-input__message ui-input__message--error">
          {error}
        </span>
      ) : (
        hint && (
          <span id={hintId} className="ui-input__message">
            {hint}
          </span>
        )
      )}
    </div>
  );
}
