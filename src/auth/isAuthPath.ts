const AUTH_PATHS = new Set([
  '/login',
  '/login/password',
  '/register',
  '/forgot-password',
  '/reset-password',
]);

export function isAuthPath(pathname: string) {
  return AUTH_PATHS.has(pathname);
}
