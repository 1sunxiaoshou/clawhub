import { createFileRoute } from '@tanstack/react-router';
import { PasswordLoginPage } from '../auth/PasswordLoginPage';

export const Route = createFileRoute('/login' as never)({
  component: LoginRoute,
});

function LoginRoute() {
  const search = Route.useSearch() as { redirectTo?: string };
  return <PasswordLoginPage search={search} />;
}
