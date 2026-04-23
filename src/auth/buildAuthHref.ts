export function buildAuthHref(path: string, redirectTo?: string) {
  if (!redirectTo) return path;
  return `${path}?redirectTo=${encodeURIComponent(redirectTo)}`;
}
