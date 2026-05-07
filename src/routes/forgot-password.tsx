import { createFileRoute } from '@tanstack/react-router';
import { ForgotPasswordPage } from '../auth/ForgotPasswordPage';

export const Route = createFileRoute('/forgot-password' as never)({
  component: ForgotPasswordRoute,
});

function ForgotPasswordRoute() {
  const search = Route.useSearch() as { redirectTo?: string };
  return <ForgotPasswordPage search={search} />;
}
