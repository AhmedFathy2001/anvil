// Query params that carry a secret. Gumroad can only authenticate its webhook with `?key=` in the
// URL, and Next hands this hook the path WITH its query, so a failed webhook would otherwise write
// the shared secret into the error log. OAuth `code`/`state` and link tokens are redacted alike.
const SECRET_QUERY_PARAMS = new Set(['key', 'token', 'secret', 'code', 'state', 'sig', 'signature']);

export function redactPathQuery(path: string): string {
  const q = path.indexOf('?');
  if (q < 0) return path;
  const params = new URLSearchParams(path.slice(q + 1));
  for (const name of [...params.keys()]) if (SECRET_QUERY_PARAMS.has(name.toLowerCase())) params.set(name, 'REDACTED');
  const rest = params.toString();
  return rest ? `${path.slice(0, q)}?${rest}` : path.slice(0, q);
}
