import { createFileRoute } from '@tanstack/react-router';
import { RegisterPage } from '../auth/RegisterPage';

export const Route = createFileRoute('/register' as never)({
  component: RegisterRoute,
});

function RegisterRoute() {
  const search = Route.useSearch() as { redirectTo?: string; email?: string; code?: string };
  return <RegisterPage search={search} />;
}
