// The URL a Discord embed hangs a clan's mark (logo, else crest) on.
//
// Versioned by the logo itself. /api/og/crest/<slug> always served the uploaded logo, but its URL
// never changed when the logo did — so Discord's media proxy kept whatever it cached first, which
// for every clan that branded after its first post was the generated crest. The `v` changes exactly
// when the logo changes; the routes ignore it. Pure, so the embed builders and tests can share it.

/** A short stable hash (FNV-1a, base36) — a cache key, not a secret. */
function shortHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** `<origin>/api/og/crest[/<slug>]?v=<logo version>`; `base` may carry a path (only its origin is used). */
export function clanMarkUrl(base: string, slug: string | null | undefined, logoUrl: string | null | undefined): string {
  const origin = new URL(base).origin;
  const path = slug ? `/${encodeURIComponent(slug)}` : '';
  return `${origin}/api/og/crest${path}?v=${shortHash(logoUrl?.trim() || 'crest')}`;
}
