// What the plugin says about a character beyond its items, for the pre-trip check (lib/tripCheck):
// the spellbook, the rune pouch and the unlocked prayers. It rides on POST /api/plugin/items as
// `state` and is stored with the item snapshot (lib/playerItems), so it is owner-only and goes with
// the items when sharing is turned off or the person is deleted. PURE.
//
//   "state": { "book": 0|1|2|3, "pouch": [[runeItemId, qty], ...], "pray": ["rigour", "augury"],
//              "quiver": [ammoItemId, qty] }
//
// `quiver` is Dizana's quiver's ammo (its varps), sent always. An id of 0 or -1 is an empty quiver.
// The varps read empty while the quiver sits in the bank, though its arrows stay in it: an empty read
// with no quiver worn or carried keeps the last ammo read (keepBankedQuiver), so a banked quiver's
// arrows still count as the player's.
//
// `book` uses the Inventory Setups numbering (0 standard, 1 ancient, 2 lunar, 3 arceuus), the same as
// GearSetup.spellbook. `pray` lists only the prayers the plugin read as unlocked. The plugin can't read
// Piety reliably and never sends it, so Piety is UNKNOWN, never locked. The pouch's varbits keep their
// runes when the pouch is banked: the check only trusts `pouch` when a rune pouch is in the inventory.

export interface TripState {
  /** 0 standard, 1 ancient, 2 lunar, 3 arceuus; null when not sent. */
  book: number | null;
  /** Rune id → count, as the pouch's varbits read. */
  pouch: { id: number; q: number }[] | null;
  /** Unlocked prayers the plugin can read ('rigour', 'augury'); null when not sent. */
  pray: string[] | null;
  /** Dizana's quiver's ammo; null when empty, undefined when not sent (an older plugin). */
  quiver?: { id: number; q: number } | null;
  /** ISO time it was read. */
  readAt: string;
}

/** The prayers the plugin can report as unlocked. Piety is never sent: unknown, not locked. */
export const READ_PRAYERS = ['rigour', 'augury'] as const;
/** Prayers a setup may rely on that need an unlock beyond the level. */
export const UNLOCK_PRAYERS = ['rigour', 'augury', 'piety'] as const;

const MAX_ID = 100_000;
const MAX_Q = 2_147_483_647;

/**
 * The `state` object from a request, strictly. Null when there is nothing usable in it; each part
 * that is absent or malformed is null on its own, so a plugin that sends only the spellbook is fine.
 */
export function cleanTripState(v: unknown, now = Date.now()): TripState | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as { book?: unknown; pouch?: unknown; pray?: unknown; quiver?: unknown; readAt?: unknown };
  const book = typeof o.book === 'number' && Number.isInteger(o.book) && o.book >= 0 && o.book <= 3 ? o.book : null;
  let pouch: TripState['pouch'] = null;
  if (Array.isArray(o.pouch) && o.pouch.length <= 6) {
    pouch = [];
    for (const p of o.pouch) {
      const [id, q] = Array.isArray(p) ? p : [];
      if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0 || id > MAX_ID) continue;
      if (typeof q !== 'number' || !Number.isInteger(q) || q <= 0 || q > MAX_Q) continue;
      pouch.push({ id, q });
    }
  }
  let pray: TripState['pray'] = null;
  if (Array.isArray(o.pray) && o.pray.length <= 10) {
    pray = [...new Set(o.pray.filter((x): x is string => typeof x === 'string').map((x) => x.toLowerCase()).filter((x) => (READ_PRAYERS as readonly string[]).includes(x)))];
  }
  // [id, qty] from the plugin, {id, q} as stored, null as stored empty.
  let quiver: TripState['quiver'];
  if (o.quiver === null) quiver = null;
  else if (o.quiver && typeof o.quiver === 'object') {
    const [id, q] = Array.isArray(o.quiver) ? o.quiver : [(o.quiver as { id?: unknown }).id, (o.quiver as { q?: unknown }).q];
    if (typeof id === 'number' && typeof q === 'number' && Number.isInteger(id) && Number.isInteger(q)) quiver = id > 0 && id <= MAX_ID && q > 0 && q <= MAX_Q ? { id, q } : null;
  }
  if (book == null && pouch == null && pray == null) return null;
  const t = typeof o.readAt === 'string' ? Date.parse(o.readAt) : NaN;
  const readAt = Number.isFinite(t) && t <= now + 60_000 ? new Date(t).toISOString() : new Date(now).toISOString();
  return { book, pouch, pray, ...(quiver !== undefined ? { quiver } : {}), readAt };
}

/** A stored state read back (jsonb, pouch as {id, q}), or null when it isn't one. */
export function storedTripState(v: unknown): TripState | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as { pouch?: unknown; readAt?: unknown };
  const pouch = Array.isArray(o.pouch) ? o.pouch.map((p) => (p && typeof p === 'object' && !Array.isArray(p) ? [(p as { id?: unknown }).id, (p as { q?: unknown }).q] : p)) : o.pouch;
  const s = cleanTripState({ ...o, pouch }, Date.now() + 365 * 86_400_000);
  if (!s) return null;
  return { ...s, readAt: typeof o.readAt === 'string' ? o.readAt : s.readAt };
}

/**
 * The state to store: a quiver read empty while no quiver is worn or carried is a banked quiver (the
 * game's varps read empty then; its arrows stay in it), so the last ammo read stands. Worn or carried
 * and empty, it is empty.
 */
export function keepBankedQuiver(next: TripState, prev: TripState | null, quiverAlong: boolean): TripState {
  if (next.quiver !== null || quiverAlong || !prev?.quiver) return next;
  return { ...next, quiver: prev.quiver };
}
