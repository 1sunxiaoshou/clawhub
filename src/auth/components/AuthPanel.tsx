import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export function AuthPanel({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn('auth-panel', className)} {...props} />;
}
