// What an in-game name may look like. Pure (no `@/` imports), so a page can check a typed name with
// exactly the rule the server applies. lib/auth re-exports these: there is one definition.

/**
 * Display-side cleanup for an RSN: collapses any Unicode whitespace (notably U+00A0
 * non-breaking space, which is how OSRS in-game names encode their spaces to avoid
 * line-wrap) to ASCII space and trims edges. Preserves casing.
 *
 * Why this matters: the OSRS Hiscores library validates with /^[a-zA-Z0-9 _-]+$/,
 * which only accepts 0x20 — an NBSP-bearing RSN throws "RSN contains invalid character"
 * before the HTTP request goes out. Use this at every site that writes an RSN into a
 * column we'll later feed to Hiscores, and at the read site as defense in depth.
 */
export function sanitizeRsn(rsn: string): string {
  return rsn.replace(/\s+/g, ' ').trim();
}

/**
 * Could this string be an actual OSRS account name? Jagex allows 1-12 characters of letters, digits,
 * space, underscore and hyphen — nothing else.
 *
 * This exists because RuneLite hands us placeholders for clan members it can't resolve a name for
 * ("#Player1404"), and sanitizeRsn only collapses whitespace, so they were being stored as real
 * members: guest, unranked, permanently statless, and cluttering every roster view. A name with a
 * `#` in it can never be looked up on the hiscores, so there is nothing to gain by keeping it.
 */
export function isPlausibleRsn(rsn: string): boolean {
  return /^[A-Za-z0-9 _-]{1,12}$/.test(rsn);
}

/** A typed name cleaned and checked: the name to use, or null when it cannot be an in-game name. */
export function validRsn(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const clean = sanitizeRsn(raw);
  return isPlausibleRsn(clean) ? clean : null;
}

/**
 * A page address carrying the name somebody typed before signing in (`?apply=<name>`), so it is
 * still in the box when they come back. Only ever a validated in-game name; anything else carries
 * nothing.
 */
export function withApplyName(path: string, rawName: string): string {
  const name = validRsn(rawName);
  if (!name) return path;
  return `${path}${path.includes('?') ? '&' : '?'}apply=${encodeURIComponent(name)}`;
}

/** Reads that name back off a query string. The same validation again: the address is user input. */
export function readApplyName(search: string | null | undefined): string | null {
  if (!search) return null;
  let raw: string | null = null;
  try {
    raw = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('apply');
  } catch {
    return null;
  }
  return validRsn(raw);
}
