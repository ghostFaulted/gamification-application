import type { HTMLAttributes } from 'react';
import { AlertCircleIcon, CheckCircleIcon, InfoIcon } from './icons';
import './Alert.css';

export type AlertType = 'error' | 'success' | 'info';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  type: AlertType;
}

const icons = {
  error: AlertCircleIcon,
  success: CheckCircleIcon,
  info: InfoIcon,
} satisfies Record<AlertType, unknown>;

export function Alert({ type, role, className, children, ...rest }: AlertProps) {
  const Icon = icons[type];

  return (
    <div
      {...rest}
      role={role ?? (type === 'error' ? 'alert' : 'status')}
      className={['ui-alert', `ui-alert--${type}`, className].filter(Boolean).join(' ')}
    >
      <Icon className="ui-alert__icon" />
      <div className="ui-alert__message">{children}</div>
    </div>
  );
}
