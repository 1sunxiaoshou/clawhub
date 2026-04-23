import type { ReactNode } from 'react';
import '../auth.css';

export function AuthShell({
  children,
  visualWord = 'LOGIN',
}: {
  children: ReactNode;
  visualWord?: string;
}) {
  const lines = Array.from({ length: 7 }, () => `${visualWord} ${visualWord} ${visualWord}`);

  return (
    <main className="auth-shell">
      <div className="auth-shell__visual" aria-hidden="true">
        <div className="auth-shell__marquee">
          {lines.map((line, index) => (
            <span key={`${visualWord}-${index}`} className="auth-shell__line">
              {line}
            </span>
          ))}
        </div>
      </div>

      <div className="auth-shell__content">{children}</div>
    </main>
  );
}
