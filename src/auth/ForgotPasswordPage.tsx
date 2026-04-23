import { Button } from '../components/ui/button';
import { useI18n } from '../lib/i18n';
import { buildAuthHref } from './buildAuthHref';
import { AuthPanel } from './components/AuthPanel';
import { AuthShell } from './components/AuthShell';

export function ForgotPasswordPage({ search }: { search: { redirectTo?: string } }) {
  const { t } = useI18n();

  return (
    <AuthShell visualWord="RESET">
      <AuthPanel>
        <div className="auth-panel__intro">
          <h1 className="auth-panel__title">{t('auth.forgotPassword')}</h1>
          <p className="auth-panel__description">{t('auth.passwordResetUnavailable')}</p>
        </div>

        <div className="auth-form__other">
          <div className="auth-form__footer">
            <Button asChild variant="outline" size="lg" className="auth-form__secondary">
              <a href={buildAuthHref('/login', search.redirectTo)}>{t('auth.backToLogin')}</a>
            </Button>
          </div>
        </div>
      </AuthPanel>
    </AuthShell>
  );
}
