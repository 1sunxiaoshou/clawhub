import { createFileRoute } from '@tanstack/react-router';
import { ResetPasswordPage } from '../auth/ResetPasswordPage';

export const Route = createFileRoute('/reset-password' as never)({
  component: ResetPasswordRoute,
});

function ResetPasswordRoute() {
  const search = Route.useSearch() as { redirectTo?: string; email?: string; code?: string };
  return <ResetPasswordPage search={search} />;
}
