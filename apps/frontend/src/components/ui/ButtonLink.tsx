import { Link, type LinkProps } from 'react-router';
import './Button.css';

export interface ButtonLinkProps extends LinkProps {
  variant?: 'primary' | 'secondary';
}

/** A navigation link that looks like Button (same variants), e.g. "Import studentów z CSV". */
export function ButtonLink({ variant = 'primary', className, ...rest }: ButtonLinkProps) {
  const classes = ['ui-button', `ui-button--${variant}`, 'ui-button--link', className]
    .filter(Boolean)
    .join(' ');
  return <Link {...rest} className={classes} />;
}
