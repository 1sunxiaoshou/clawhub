import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';

export function AuthProviderButton({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
}) {
  return (
    <button type="button" className={cn('auth-provider', className)} {...props}>
      <span className="auth-provider__icon">{children}</span>
    </button>
  );
}
