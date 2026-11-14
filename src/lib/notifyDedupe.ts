// One collection-log slot is one post. The plugin dedupes its own two sightings of an unlock (the
// player's line and the clan's broadcast) by name, but a stray non-breaking space or colour tag in one
// of them reads as a different item, and an older client or an outbox retry can send twice: Titoo's
// Masori body went out as 242/1734 and again, seconds later, as 243/1734. The site drops the echo.

const SEEN_MS = 2 * 60_000;
const seen = new Map<string, number>();

/** An item name compared loosely: tags gone, any whitespace one space, case ignored. */
export function itemKey(name: string): string {
  return name
    .replace(/<[^>]*>/g, '')
    .replace(/[\s ]+/g, ' ')
    .trim()
    .toLowerCase();
}

/** True when this person already posted this slot in the last two minutes (and records it otherwise). */
export function duplicateClogSlot(userId: number, item: unknown, now = Date.now()): boolean {
  if (typeof item !== 'string' || !item.trim()) return false;
  const key = `${userId}:${itemKey(item)}`;
  const at = seen.get(key);
  if (at !== undefined && now - at < SEEN_MS) return true;
  if (seen.size > 5000) for (const [k, t] of seen) if (now - t >= SEEN_MS) seen.delete(k);
  seen.set(key, now);
  return false;
}

// The same for an always-post item (a "Notable drop"). The plugin sees it twice, as loot and as the
// collection log's unlock line, and holds the second back only when it lands within five seconds. A
// raid chest breaks that: the loot shows when the chest opens and the log fills when the item is
// taken out, so 1BM's Masori crafting kit posted once with its value and kill count, and again as
// an unlock. Whichever sighting arrives first is the post.
const notableSeen = new Map<string, number>();

/** True when this person already posted this notable item to this clan in the last two minutes (and records it otherwise). */
export function duplicateNotableDrop(clanId: number, userId: number, item: unknown, now = Date.now()): boolean {
  if (typeof item !== 'string' || !item.trim()) return false;
  const key = `${clanId}:${userId}:${itemKey(item)}`;
  const at = notableSeen.get(key);
  if (at !== undefined && now - at < SEEN_MS) return true;
  if (notableSeen.size > 5000) for (const [k, t] of notableSeen) if (now - t >= SEEN_MS) notableSeen.delete(k);
  notableSeen.set(key, now);
  return false;
}
