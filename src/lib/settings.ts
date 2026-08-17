import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { settings } from '@/db/schema';

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

/**
 * Raw setting value. `null` when the key has no row or the row's value is NULL.
 *
 * An empty string is returned AS an empty string, because for several toggles '' is a meaningful
 * value ("explicitly off") distinct from absence ("use the default").
 */
export async function getSetting(key: string): Promise<string | null> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, key) });
  return row?.value ?? null;
}

/**
 * Trimmed setting value, with empty treated as absent. Use for anything where blank means unset —
 * clan names, invite URLs, Discord ids, tokens.
 */
export async function getSettingText(key: string): Promise<string | null> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, key) });
  return row?.value?.trim() || null;
}

/**
 * Read many keys in ONE query, raw semantics. Keys with no row are absent from the map.
 *
 * The plugin config endpoint used to make roughly fifteen separate round trips to build one
 * response; this exists so the callers that need a batch can take one.
 */
export async function getSettingMap(keys: string[]): Promise<Map<string, string | null>> {
  if (keys.length === 0) return new Map();
  const rows = await db
    .select({ key: settings.key, value: settings.value })
    .from(settings)
    .where(inArray(settings.key, keys));
  return new Map(rows.map((r) => [r.key, r.value ?? null]));
}

/** Upsert a setting. A null value stores NULL rather than deleting the row. */
export async function setSetting(key: string, value: string | null): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

/**
 * Remove a setting row entirely.
 *
 * Distinct from `setSetting(key, null)` on purpose: some callers need "no opinion recorded" (row
 * absent) rather than "recorded as null", because their default differs from their off state.
 */
export async function deleteSetting(key: string): Promise<void> {
  await db.delete(settings).where(eq(settings.key, key));
}
