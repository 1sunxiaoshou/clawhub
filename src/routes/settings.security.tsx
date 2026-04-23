import { createFileRoute } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { Container } from "../components/layout/Container";
import { SignInButton } from "../components/SignInButton";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { getUserFacingAuthError } from "../lib/authErrorMessage";
import { useI18n } from "../lib/i18n";
import { useAuthStatus } from "../lib/useAuthStatus";

export const Route = createFileRoute("/settings/security" as never)({
  component: SettingsSecurityRoute,
});

function SettingsSecurityRoute() {
  const { signIn } = useAuthActions();
  const { me } = useAuthStatus();
  const { t, formatDateTime } = useI18n();
  const methods = useQuery(api.users.getLoginMethods, me ? {} : "skip");
  const unlinkLoginMethod = useMutation(api.users.unlinkLoginMethod);
  const changePassword = useAction(api.users.changePassword);
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [setupPassword, setSetupPassword] = useState("");

  if (!me) {
    return (
      <Container size="narrow" className="py-10">
        <Card>
          <CardContent className="flex flex-col items-start gap-3">
            <span>{t("settings.signInPrompt")}</span>
            <SignInButton variant="outline">{t("header.signIn")}</SignInButton>
          </CardContent>
        </Card>
      </Container>
    );
  }
  const currentUser = me;

  async function onEnablePassword(event: React.FormEvent) {
    event.preventDefault();
    if (!currentUser.email) {
      toast.error(t("auth.emailRequired"));
      return;
    }
    try {
      await signIn("password", {
        flow: "signUp",
        email: currentUser.email,
        password: setupPassword,
        redirectTo: "/settings/security",
      });
      toast.success(t("auth.passwordLinked"));
      setSetupPassword("");
    } catch (error) {
      toast.error(getUserFacingAuthError(error, t("auth.signUpFailed")));
    }
  }

  async function onChangePassword(event: React.FormEvent) {
    event.preventDefault();
    try {
      await changePassword({ currentPassword, newPassword });
      toast.success(t("auth.passwordUpdated"));
      setCurrentPassword("");
      setNewPassword("");
    } catch (error) {
      toast.error(getUserFacingAuthError(error, t("auth.resetFailed")));
    }
  }

  async function onUnlink(provider: "password" | "github" | "wecom") {
    try {
      await unlinkLoginMethod({ provider });
      toast.success(t("auth.unlinked"));
    } catch (error) {
      toast.error(getUserFacingAuthError(error, t("auth.unlinkFailed")));
    }
  }

  return (
    <Container size="narrow" className="py-10">
      <Card>
        <CardHeader>
          <CardTitle>{t("auth.securityTitle")}</CardTitle>
          <CardDescription>{t("auth.securityDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {methods ? (
            <div className="grid gap-3">
              {methods.methods.map((method) => (
                <div
                  key={method.provider}
                  className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[color:var(--line)] px-4 py-3"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{t(`auth.provider.${method.provider}`)}</span>
                    <span className="text-sm text-[color:var(--ink-soft)]">
                      {method.linked ? t("auth.linked") : t("auth.notLinked")}
                    </span>
                  </div>
                  {method.linked ? (
                    method.provider === "password" ? null : (
                      <Button
                        variant="outline"
                        disabled={!method.canUnlink}
                        onClick={() => void onUnlink(method.provider)}
                      >
                        {t("auth.unlink")}
                      </Button>
                    )
                  ) : method.provider === "password" ? null : (
                    <SignInButton provider={method.provider} redirectTo="/settings/security" variant="outline">
                      {t("auth.link")}
                    </SignInButton>
                  )}
                </div>
              ))}
            </div>
          ) : null}

          {methods?.lastLoginAt ? (
            <div className="text-sm text-[color:var(--ink-soft)]">
              {t("auth.lastLogin")} {formatDateTime(methods.lastLoginAt)}
            </div>
          ) : null}

          {methods?.methods.find((entry) => entry.provider === "password")?.linked ? (
            <form className="flex flex-col gap-4" onSubmit={onChangePassword}>
              <div className="flex flex-col gap-2">
                <Label htmlFor="current-password">{t("auth.currentPassword")}</Label>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-password">{t("auth.newPassword")}</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </div>
              <Button type="submit">{t("auth.updatePassword")}</Button>
            </form>
          ) : (
            <form className="flex flex-col gap-4" onSubmit={onEnablePassword}>
              <div className="flex flex-col gap-2">
                <Label htmlFor="setup-password">{t("auth.newPassword")}</Label>
                <Input
                  id="setup-password"
                  type="password"
                  autoComplete="new-password"
                  value={setupPassword}
                  onChange={(event) => setSetupPassword(event.target.value)}
                />
              </div>
              <Button type="submit">{t("auth.enablePassword")}</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </Container>
  );
}
