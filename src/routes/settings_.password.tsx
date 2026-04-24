import { createFileRoute } from '@tanstack/react-router';
import { useAction } from 'convex/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '../../convex/_generated/api';
import { AuthField } from '../auth/components/AuthField';
import { AuthPanel } from '../auth/components/AuthPanel';
import { AuthShell } from '../auth/components/AuthShell';
import { SignInButton } from '../components/SignInButton';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { getUserFacingAuthError } from '../lib/authErrorMessage';
import { useI18n } from '../lib/i18n';
import { useAuthStatus } from '../lib/useAuthStatus';

export const Route = createFileRoute('/settings/password' as never)({
  component: SettingsSecurityPasswordRoute,
});

function SettingsSecurityPasswordRoute() {
  const { me } = useAuthStatus();
  const { t } = useI18n();
  const changePassword = useAction(api.users.changePassword);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const current = currentPassword.trim();
    const next = newPassword.trim();
    if (!current) {
      toast.error(t('auth.currentPasswordRequired'));
      return;
    }
    if (!next) {
      toast.error(t('auth.newPasswordRequired'));
      return;
    }
    if (next.length < 8) {
      toast.error(t('auth.passwordTooShort'));
      return;
    }
    if (current === next) {
      toast.error(t('auth.passwordUnchanged'));
      return;
    }
    setIsSubmitting(true);
    try {
      await changePassword({ currentPassword: current, newPassword: next });
      toast.success(t('auth.passwordUpdated'));
      window.location.assign('/settings');
    } catch (error) {
      toast.error(getUserFacingAuthError(error, t('auth.resetFailed')));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (me === undefined) {
    return (
      <AuthShell visualWord="SECURITY">
        <AuthPanel>
          <div className="grid gap-4">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </AuthPanel>
      </AuthShell>
    );
  }

  if (me === null) {
    return (
      <AuthShell visualWord="SECURITY">
        <AuthPanel>
          <div className="auth-panel__intro">
            <h1 className="auth-panel__title">{t('auth.changePassword')}</h1>
            <p className="auth-panel__description">{t('settings.signInPrompt')}</p>
          </div>
          <SignInButton variant="primary" size="lg" className="auth-form__submit">
            {t('header.signIn')}
          </SignInButton>
        </AuthPanel>
      </AuthShell>
    );
  }

  const accountName = me.displayName ?? me.name ?? me.handle ?? me.email ?? t('settings.userFallback');
  const accountDetail = me.email ?? me.handle ?? me._id;

  return (
    <AuthShell visualWord="SECURITY">
      <AuthPanel>
        <div className="auth-panel__intro">
          <h1 className="auth-panel__title">{t('auth.changePassword')}</h1>
          <p className="auth-panel__description">{t('auth.changePasswordDescription')}</p>
        </div>

        <div className="mb-5 rounded-[1rem] border border-[rgba(71,124,213,0.18)] bg-[rgba(238,245,255,0.78)] px-4 py-3">
          <div className="text-sm font-bold text-[color:var(--ink)]">{accountName}</div>
          <div className="mt-1 truncate text-sm text-[color:var(--ink-soft)]">{accountDetail}</div>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          <div className="auth-form__inputs">
            <AuthField label={t('auth.currentPassword')} htmlFor="current-password">
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="auth-field__input"
                name="currentPassword"
              />
            </AuthField>

            <AuthField label={t('auth.newPassword')} htmlFor="new-password">
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="auth-field__input"
                name="newPassword"
              />
            </AuthField>
          </div>

          <div className="auth-form__actions">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={isSubmitting}
              disabled={!currentPassword || !newPassword}
              className="auth-form__submit"
            >
              {t('auth.updatePassword')}
            </Button>

            <Button asChild variant="outline" size="lg" className="auth-form__secondary">
              <a href="/settings">{t('settings.cancel')}</a>
            </Button>
          </div>
        </form>
      </AuthPanel>
    </AuthShell>
  );
}
