import { useAuthActions } from "@convex-dev/auth/react";
import type { ComponentProps } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { getUserFacingAuthError } from "../lib/authErrorMessage";
import { useI18n } from "../lib/i18n";
import { clearAuthError, setAuthError } from "../lib/useAuthError";
import { Button } from "./ui/button";

type ButtonProps = ComponentProps<typeof Button>;

type SignInButtonProps = Omit<ButtonProps, "onClick" | "type"> & {
  provider?: "github" | "wecom";
  redirectTo?: string;
};

export function SignInButton({
  provider,
  redirectTo,
  children,
  ...props
}: SignInButtonProps) {
  const { signIn } = useAuthActions();
  const { t } = useI18n();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const fallbackMessage = "Sign in failed. Please try again.";

  return (
    <Button
      type="button"
      onClick={() => {
        const next = redirectTo ?? getCurrentRelativeUrl();
        if (!provider) {
          if (typeof window !== "undefined") {
            const loginUrl = new URL("/login", window.location.origin);
            if (next) {
              loginUrl.searchParams.set("redirectTo", next);
            }
            window.location.assign(loginUrl.toString());
          }
          return;
        }
        clearAuthError();
        setIsSigningIn(true);
        void signIn(provider, next ? { redirectTo: next } : undefined)
          .then((result) => {
            if (result.signingIn === false) {
              reportAuthError(fallbackMessage);
              setIsSigningIn(false);
            }
          })
          .catch((error) => {
            const message = getUserFacingAuthError(error, fallbackMessage);
            reportAuthError(message);
            setIsSigningIn(false);
          });
      }}
      {...props}
      loading={props.loading || isSigningIn}
    >
      {children ?? t("header.signIn")}
    </Button>
  );
}

function getCurrentRelativeUrl() {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function reportAuthError(message: string) {
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/cli/auth")) {
    setAuthError(message);
    return;
  }
  toast.error(message);
}
