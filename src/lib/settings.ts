import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { settings, teams } from '@/db/schema';

// The single way in and out of the `settings` key/value table.
//
// There used to be sixteen of these — copy-pasted private helpers in discord.ts, discord-roles.ts,
// discord-teams.ts, leagues.ts, member-cap.ts, pluginConfig.ts and several routes — plus about
// fifteen more fully inline `eq(settings.key, …)` reads. Consolidating them is a prerequisite for
// per-clan settings, not tidying: `settings` becomes keyed on (clan_id, key), and this is the one
// place that has to learn about it instead of thirty-one.
//
// The copies had DIVERGED, which is worth naming because it is exactly the kind of thing a careless
// consolidation would paper over:
//
//   discord.ts       value || null           empty string reads as absent, errors logged + swallowed
//   discord-roles.ts value ?? null           empty string preserved, errors thrown
//   leagues.ts       value?.trim() || null   trimmed, empty as absent, errors swallowed silently
//
// The distinction matters. The settings PUT folds '' to NULL, and several toggles treat an explicit
// '' as OFF while treating absence as the DEFAULT — `getAcceptFederatedWrites` read
// `v !== '' && v !== 'off'`, so collapsing '' into null would have silently flipped it on. So there
// are two readers here, and callers pick deliberately:
//
//   getSetting      raw. null when the row is absent (or stored NULL); '' comes back as ''.
//   getSettingText  trimmed, and empty-as-absent. The right one for names, URLs and ids.
//
// Neither swallows errors: a database failure is a real failure and hiding it cost us debugging time
// before. Callers that genuinely must not throw — a Discord notify, say — keep their own try/catch,
// where the decision is visible.
//
// clanId is EXPLICIT on every function rather than read from request context. Resolving it implicitly
// would work for requests and silently break the cron sweeps, which iterate clans and have no request
// to read from — and it would hide "which clan did this touch?" at the call site, which is the one
// question this table's bugs are always about.

/**
 * Raw setting value. `null` when the key has no row or the row's value is NULL.
 *
 * An empty string is returned AS an empty string, because for several toggles '' is a meaningful
 * value ("explicitly off") distinct from absence ("use the default").
 */
export async function getSetting(clanId: number, key: string): Promise<string | null> {
  if (CACHE_ON) return (await clanSettings(clanId)).get(key) ?? null;
  const row = await db.query.settings.findFirst({
    where: and(eq(settings.clanId, clanId), eq(settings.key, key)),
  });
  return row?.value ?? null;
}

/**
 * Trimmed setting value, with empty treated as absent. Use for anything where blank means unset —
 * clan names, invite URLs, Discord ids, tokens.
 */
export async function getSettingText(clanId: number, key: string): Promise<string | null> {
  if (CACHE_ON) return (await clanSettings(clanId)).get(key)?.trim() || null;
  const row = await db.query.settings.findFirst({
    where: and(eq(settings.clanId, clanId), eq(settings.key, key)),
  });
  return row?.value?.trim() || null;
}

/**
 * Read many keys in ONE query, raw semantics. Keys with no row are absent from the map.
 *
 * The plugin config endpoint used to make roughly fifteen separate round trips to build one
 * response; this exists so the callers that need a batch can take one.
 */
export async function getSettingMap(clanId: number, keys: string[]): Promise<Map<string, string | null>> {
  if (keys.length === 0) return new Map();
  if (CACHE_ON) {
    const all = await clanSettings(clanId);
    return new Map(keys.filter((k) => all.has(k)).map((k) => [k, all.get(k) ?? null]));
  }
  const rows = await db
    .select({ key: settings.key, value: settings.value })
    .from(settings)
    .where(and(eq(settings.clanId, clanId), inArray(settings.key, keys)));
  return new Map(rows.map((r) => [r.key, r.value ?? null]));
}

/** Upsert a setting. A null value stores NULL rather than deleting the row. */
export async function setSetting(clanId: number, key: string, value: string | null): Promise<void> {
  await db
    .insert(settings)
    .values({ clanId, key, value })
    .onConflictDoUpdate({ target: [settings.clanId, settings.key], set: { value } });
  invalidateSettings(clanId);
}

/**
 * Remove a setting row entirely.
 *
 * Distinct from `setSetting(key, null)` on purpose: some callers need "no opinion recorded" (row
 * absent) rather than "recorded as null", because their default differs from their off state.
 */
export async function deleteSetting(clanId: number, key: string): Promise<void> {
  await db.delete(settings).where(and(eq(settings.clanId, clanId), eq(settings.key, key)));
  invalidateSettings(clanId);
}

// ── A clan's settings, read once and kept a few seconds ──────────────────────────────────────────
//
// This table is about a hundred rows across every clan, and it was the most-read table on
// production — tens of millions of single-key lookups, because a page, a plugin poll or a Discord
// post each ask for a handful of keys one at a time. A clan's whole set is one small query, so read
// it once and answer every key from memory for SETTINGS_TTL_MS.
//
// Writes through this module drop the clan's copy at once, so the process that saved a setting reads
// it back immediately. Anything else (a second process mid blue-green switch, a raw write elsewhere)
// is seen within the TTL. Production only: tests and dev write rows directly and read them straight
// back, and should keep exercising the query.
const CACHE_ON = process.env.NODE_ENV === 'production' && process.env.ANVIL_SETTINGS_CACHE !== 'off';
const SETTINGS_TTL_MS = 10_000;
const cache = new Map<number, { at: number; rows: Promise<Map<string, string | null>> }>();

function clanSettings(clanId: number): Promise<Map<string, string | null>> {
  const hit = cache.get(clanId);
  if (hit && Date.now() - hit.at < SETTINGS_TTL_MS) return hit.rows;
  const rows = db
    .select({ key: settings.key, value: settings.value })
    .from(settings)
    .where(eq(settings.clanId, clanId))
    .then((r) => new Map(r.map((x) => [x.key, x.value ?? null] as [string, string | null])));
  // A failed read is not remembered: the next caller tries again.
  rows.catch(() => cache.delete(clanId));
  cache.set(clanId, { at: Date.now(), rows });
  return rows;
}

/** Forget a clan's cached settings — for a write that bypasses setSetting (e.g. inside a transaction). */
export function invalidateSettings(clanId: number): void {
  cache.delete(clanId);
}
