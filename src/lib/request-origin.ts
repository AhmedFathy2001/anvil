// Behind a reverse proxy (Caddy) the Next standalone server sees its own bind address in
// `request.url` (e.g. http://0.0.0.0:3000), so absolute redirects built from it point at the
// container instead of the public host. Build them from the proxy's forwarded headers instead.
// Caddy's reverse_proxy sets X-Forwarded-Proto / X-Forwarded-Host by default; we fall back to the
// Host header, then to request.url for local/non-proxied runs. Works for subdomains and custom
// domains alike without any per-instance config.
export function publicOrigin(request: Request): string {
  const h = request.headers;
  const proto = h.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const fwdHost = h.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = fwdHost || h.get('host');
  if (host) return `${proto || 'https'}://${host}`;
  return new URL(request.url).origin;
}
