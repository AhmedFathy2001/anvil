// Sanitize a user-supplied post-login / post-logout "return" target so it can only ever be a
// same-origin, site-relative path — never an external URL.
//
// The naive guard `startsWith('/') && !startsWith('//')` is NOT enough: the WHATWG URL parser
// treats backslashes as slashes for http(s), so `new URL('/\\evil.com', origin)` resolves to
// `https://evil.com/`. `/\evil.com` passes the naive guard → open redirect. We therefore require
// a single leading slash followed by a non-slash, non-backslash character, and reject any string
// containing a backslash or control/whitespace char outright.
export function safeReturnPath(returnTo: string | null | undefined, fallback = '/'): string {
  if (typeof returnTo !== 'string' || returnTo.length === 0) return fallback;
  // Reject backslashes (slash-equivalent in URL parsing) and any control / whitespace chars.
  if (/[\\\x00-\x20\x7f]/.test(returnTo)) return fallback;
  // Must start with exactly one slash, then a normal path char (not another slash → protocol-relative).
  if (!/^\/[^/\\]/.test(returnTo)) return fallback;
  return returnTo;
}
