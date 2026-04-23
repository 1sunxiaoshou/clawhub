import type { ReactNode } from 'react';

export function AuthField({
  label,
  htmlFor,
  hint,
  postInputHint,
  children,
}: {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  postInputHint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="auth-field">
      <div className="auth-field__row">
        <label className="auth-field__label" htmlFor={htmlFor}>
          {label}
        </label>
        {hint ? <div className="auth-field__hint">{hint}</div> : null}
      </div>
      {children}
      {postInputHint ? <div className="auth-field__post-hint">{postInputHint}</div> : null}
    </div>
  );
}
