import type { ReactNode } from 'react';
import { Separator } from '../../components/ui/separator';

export function AuthDivider({ children }: { children: ReactNode }) {
  return (
    <div className="auth-divider" aria-hidden="true">
      <Separator className="auth-divider__line" />
      <span className="auth-divider__label">{children}</span>
      <Separator className="auth-divider__line" />
    </div>
  );
}
