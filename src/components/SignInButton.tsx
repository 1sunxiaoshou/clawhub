import { useAuthActions } from "@convex-dev/auth/react";
import type { ComponentProps } from "react";
import { toast } from "sonner";
import { getUserFacingAuthError } from "../lib/authErrorMessage";
import { useI18n } from "../lib/i18n";
import { clearAuthError, setAuthError } from "../lib/useAuthError";
import { Button } from "./ui/button";

type ButtonProps = ComponentProps<typeof Button>;

type SignInButtonProps = Omit<ButtonProps, "onClick" | "type"> & {
  redirectTo?: string;
};

export function SignInButton({
  redirectTo,
  children,
  ...props
}: SignInButtonProps) {
  const { signIn } = useAuthActions();
  const { t } = useI18n();
  const fallbackMessage = "Sign in failed. Please try again.";

  return (
    <Button
      type="button"
      onClick={() => {
        clearAuthError();
        const next = redirectTo ?? getCurrentRelativeUrl();
        void signIn("github", next ? { redirectTo: next } : undefined)
          .catch((error) => {
            const message = getUserFacingAuthError(error, fallbackMessage);
            reportAuthError(message);
          });
      }}
      {...props}
    >
      {children ?? t("header.signInWithGitHub")}
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
