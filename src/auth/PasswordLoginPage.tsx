import { useAuthActions } from '@convex-dev/auth/react';
import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { getUserFacingAuthError } from '../lib/authErrorMessage';
import { useI18n } from '../lib/i18n';
import { buildAuthHref } from './buildAuthHref';
import { AuthDivider } from './components/AuthDivider';
import { AuthField } from './components/AuthField';
import { AuthPanel } from './components/AuthPanel';
import { AuthProviderButton } from './components/AuthProviderButton';
import { AuthShell } from './components/AuthShell';

export function PasswordLoginPage({ search }: { search: { redirectTo?: string } }) {
  const { signIn } = useAuthActions();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await signIn('password', {
        flow: 'signIn',
        email,
        password,
        redirectTo: search.redirectTo ?? '/',
      });
      window.location.assign(search.redirectTo ?? '/');
    } catch (error) {
      toast.error(getUserFacingAuthError(error, t('auth.signInFailed')));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <AuthPanel>
        <form className="auth-form" onSubmit={onSubmit}>
          <div className="auth-form__inputs">
            <AuthField label={t('auth.accountLabel')} htmlFor="login-email">
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder={t('auth.accountPlaceholder')}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="auth-field__input"
                name="email"
              />
            </AuthField>

            <AuthField
              label={t('auth.passwordLabel')}
              htmlFor="login-password"
            >
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                placeholder={t('auth.passwordPlaceholder')}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="auth-field__input"
                name="password"
              />
            </AuthField>
          </div>

          <div className="auth-form__actions">
            <Button type="submit" variant="primary" size="lg" loading={isSubmitting} className="auth-form__submit">
              {t('auth.signIn')}
            </Button>

            <Button asChild variant="outline" size="lg" className="auth-form__secondary">
              <a href={buildAuthHref('/register', search.redirectTo)}>{t('auth.registerAction')}</a>
            </Button>
          </div>

          <div className="auth-form__other">
            <AuthDivider>{t('auth.otherLoginMethods')}</AuthDivider>

            <div className="auth-providers">
              <SocialSignInButton provider="github" redirectTo={search.redirectTo}>
                <GitHubMark />
                <span>GitHub</span>
              </SocialSignInButton>
              <SocialSignInButton provider="wecom" redirectTo={search.redirectTo}>
                <WeComMark />
                <span>{t('auth.provider.wecom')}</span>
              </SocialSignInButton>
            </div>
          </div>
        </form>
      </AuthPanel>
    </AuthShell>
  );
}

function SocialSignInButton({
  provider,
  redirectTo,
  children,
}: {
  provider: 'github' | 'wecom';
  redirectTo?: string;
  children: ReactNode;
}) {
  const { signIn } = useAuthActions();
  const { t } = useI18n();
  const label = provider === 'github' ? t('auth.signInWithGitHub') : t('auth.signInWithWeCom');

  return (
    <AuthProviderButton
      aria-label={label}
      title={label}
      onClick={() => {
        void signIn(provider, redirectTo ? { redirectTo } : undefined).catch((error) => {
          toast.error(getUserFacingAuthError(error, t('auth.signInFailed')));
        });
      }}
    >
      {children}
    </AuthProviderButton>
  );
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.1.82-.26.82-.58v-2.03c-3.34.73-4.04-1.42-4.04-1.42-.55-1.38-1.33-1.75-1.33-1.75-1.08-.74.08-.73.08-.73 1.2.08 1.83 1.22 1.83 1.22 1.06 1.8 2.79 1.28 3.47.98.11-.77.42-1.28.75-1.58-2.66-.3-5.47-1.32-5.47-5.9 0-1.3.47-2.37 1.22-3.21-.12-.3-.53-1.5.12-3.13 0 0 1-.32 3.29 1.23a11.63 11.63 0 0 1 5.99 0c2.29-1.55 3.29-1.23 3.29-1.23.65 1.63.24 2.83.12 3.13.76.84 1.22 1.92 1.22 3.21 0 4.59-2.81 5.59-5.49 5.89.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.82.58A12 12 0 0 0 12 .5Z" />
    </svg>
  );
}

function WeComMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M14.2 4.1c4.6 0 8.3 2.8 8.3 6.3 0 2-1.2 3.8-3.1 5 .1.7.4 1.7.9 2.6-.9 0-2.2-.4-3.2-1.1-1.1.3-2.2.5-3.4.5-4.6 0-8.4-2.8-8.4-6.3s3.8-7 8.9-7Zm-6.6 9.7c-.7-.6-1.1-1.4-1.1-2.3 0-2.2 2.4-4 5.3-4.2C10.8 4.8 8 3 4.7 3 2.1 3 0 4.6 0 6.7c0 1.2.7 2.3 1.8 3-.1.4-.3 1.2-.6 1.8.7 0 1.5-.3 2.2-.7.5.1.9.2 1.4.2.9 1.2 1.7 2.1 2.8 2.8Z"
        fill="#2563eb"
      />
      <circle cx="10.3" cy="10.6" r="1.15" fill="#60a5fa" />
      <circle cx="14.8" cy="10.6" r="1.15" fill="#60a5fa" />
      <circle cx="17.8" cy="10.6" r="1.15" fill="#60a5fa" />
    </svg>
  );
}
