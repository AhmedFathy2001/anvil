// Webhooks in a clan's server that aren't Anvil's but that the clan wants to KEEP (another bot's
// release notes, a deploy feed…). Kept ones leave the "Remove old webhooks" list for good, and the
// list can bring them back. Stored as one clan setting: a JSON array of Discord webhook ids.

export const KEPT_WEBHOOKS_KEY = 'discord_foreign_webhooks_kept';
/** More than any server has webhooks; a bound so a stored value can't grow without limit. */
export const MAX_KEPT = 200;

const ID = /^\d{1,25}$/;

/** A stored value → the kept ids. Anything unreadable reads as none kept. */
export function parseKept(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && ID.test(x)))].slice(0, MAX_KEPT) : [];
  } catch {
    return [];
  }
}

/** Keep or un-keep one id; returns the new list (only ids still in the server are worth keeping). */
export function toggleKept(kept: string[], id: string, keep: boolean, inServer: Set<string>): string[] {
  const next = new Set(kept.filter((k) => inServer.has(k)));
  if (keep) next.add(id);
  else next.delete(id);
  return [...next].slice(0, MAX_KEPT);
}
