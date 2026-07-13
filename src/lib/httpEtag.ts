import crypto from 'crypto';

/**
 * Answer a plugin GET with a weak ETag so an unchanged poll/fetch costs no body. The plugin caches
 * the last ETag and sends it back as `If-None-Match`; a match returns **304 with no body**, otherwise
 * the full JSON plus a fresh `ETag`. Used by the high-traffic `/api/plugin/config` (30s poll) and
 * `/api/plugin/board` (clog tab) so egress stays flat as installs grow.
 *
 * The payload MUST be deterministic for the same underlying data — no per-request timestamps or
 * random key ordering — or the ETag churns and never matches. (The config codeword rotates daily,
 * which is fine: it changes the ETag once a day.)
 */
export function jsonWithEtag(request: Request, payload: unknown): Response {
  const body = JSON.stringify(payload);
  const etag = 'W/"' + crypto.createHash('sha1').update(body).digest('base64') + '"';
  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }
  return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json', ETag: etag } });
}
