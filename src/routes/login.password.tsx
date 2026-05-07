import { createFileRoute } from '@tanstack/react-router';
import { PasswordLoginPage } from '../auth/PasswordLoginPage';

export const Route = createFileRoute('/login/password' as never)({
  component: LoginPasswordRoute,
});

function LoginPasswordRoute() {
  const search = Route.useSearch() as { redirectTo?: string };
  return <PasswordLoginPage search={search} />;
}
