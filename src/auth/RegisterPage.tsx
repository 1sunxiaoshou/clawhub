import { useAuthActions } from '@convex-dev/auth/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { getUserFacingAuthError } from '../lib/authErrorMessage';
import { useI18n } from '../lib/i18n';
import { buildAuthHref } from './buildAuthHref';
import { AuthField } from './components/AuthField';
import { AuthPanel } from './components/AuthPanel';
import { AuthShell } from './components/AuthShell';

export function RegisterPage({
  search,
}: {
  search: { redirectTo?: string; email?: string };
}) {
  const { signIn } = useAuthActions();
  const { t } = useI18n();
  const [email, setEmail] = useState(search.email ?? '');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await signIn('password', {
        flow: 'signUp',
        email,
        password,
        redirectTo: search.redirectTo ?? '/',
      });
      window.location.assign(search.redirectTo ?? '/');
    } catch (error) {
      toast.error(getUserFacingAuthError(error, t('auth.signUpFailed')));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell visualWord="REGISTER">
      <AuthPanel>
        <div className="auth-panel__intro">
          <h1 className="auth-panel__title">{t('auth.registerTitle')}</h1>
          <p className="auth-panel__description">{t('auth.registerDescription')}</p>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          <div className="auth-form__inputs">
            <AuthField label={t('auth.email')} htmlFor="register-email">
              <Input
                id="register-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="auth-field__input"
              />
            </AuthField>

            <AuthField label={t('auth.password')} htmlFor="register-password">
              <Input
                id="register-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="auth-field__input"
              />
            </AuthField>
          </div>

          <div className="auth-form__actions">
            <Button type="submit" variant="primary" size="lg" loading={isSubmitting} className="auth-form__submit">
              {t('auth.createAccount')}
            </Button>
          </div>

          <div className="auth-form__other">
            <div className="auth-form__footer">
              <Button asChild variant="outline" size="lg" className="auth-form__secondary">
                <a href={buildAuthHref('/login', search.redirectTo)}>{t('auth.backToLogin')}</a>
              </Button>
            </div>
          </div>
        </form>
      </AuthPanel>
    </AuthShell>
  );
}
