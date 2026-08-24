import { db } from '@/db';
import { getSetting, getSettingText, getSettingMap } from '@/lib/settings';
import { clans, events, tiles, weeklyCompetitions } from '@/db/schema';
import { and, count, eq, inArray } from 'drizzle-orm';
import { BOSSES, FUN_DEATH_MESSAGES, weeklyMetricLabel, COUNTER_TARGETS } from '@/lib/constants';
import { DEFAULT_TIER_BANDS, normalizeTierBands, type TierBand } from '@/lib/tileFilter';
import { getItemMapping } from '@/lib/osrsItems';

// Shared builders for the plugin's read-bootstrap. These back both the standalone
// /api/plugin/schedule and /api/plugin/active-weekly routes (kept for older jars) and
// the merged GET /api/plugin/config response, so every consumer gets an identical shape.

export interface ScheduleBingo {
  id: number;
  title: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'upcoming';
  boardSize: number | null;
  tileCount: number;
  // Lets the plugin pick the right in-game view without a second fetch:
  //   format='tilerace' → race track; format='bingo' + scoringMode='points' → accordion;
  //   format='bingo' + scoringMode='tiles' → square grid.
  format: string;
  scoringMode: string;
}

export interface ScheduleWeekly {
  id: number;
  title: string;
  type: string;
  metric: string;
  /** The metric as a person writes it ("Phosani's Nightmare") — see weeklyMetricLabel. */
  metricLabel: string;
  status: string;
  startDate: string;
  endDate: string;
}

export interface PluginSchedule {
  bingos: ScheduleBingo[];
  weeklies: ScheduleWeekly[];
}

const SCHEDULE_CAP = 10;

/**
 * Active + upcoming bingo events and weekly competitions for ONE clan, sorted by start, capped so
 * we don't ship the whole archive.
 *
 * `clanId` is required, and that is the whole point. Until the multi-clan port this function ran on
 * a deployment that WAS one clan, so `select().from(events)` meant "this clan's events" and read as
 * correct. Afterwards the same line meant every clan on the platform, and since /api/plugin/schedule
 * takes no token, one anonymous request to the apex listed everybody's events and weeklies — under a
 * SCHEDULE_CAP of 10 that another clan's events could push you out of. The lint rule flagged it from
 * the day it was written; it sat in the warning pile.
 *
 * `invited` events are excluded outright: those are addressed to specific people, and a schedule is
 * an advertisement. `clan` events ARE listed, because naming the clan is what this endpoint has
 * always treated as standing to ask, every event in the wild carries the default `clan`, and jars in
 * the field cannot be updated — filtering them out would empty the panel on every installed plugin
 * rather than close a hole. The authenticated caller in /api/plugin/config gets the same list; what
 * a member sees beyond it comes from the event surfaces, which do consult lib/eventAccess.
 */
export async function buildSchedule(clanId: number): Promise<PluginSchedule> {
  const nowIso = new Date().toISOString();

  const [allEvents, allWeeklies] = await Promise.all([
    db.select().from(events).where(eq(events.clanId, clanId)),
    db.select().from(weeklyCompetitions).where(eq(weeklyCompetitions.clanId, clanId)),
  ]);

  const bingoCandidates = allEvents.filter(
    (e) =>
      e.startDate &&
      e.endDate &&
      e.endDate > nowIso &&
      !e.forceEndedAt &&
      e.visibility !== 'invited',
  );

  // Tile counts per event in one query — avoids N+1 against the tiles table.
  const tileCountMap = new Map<number, number>();
  if (bingoCandidates.length > 0) {
    const tileCounts = await db
      .select({ eventId: tiles.eventId, count: count() })
      .from(tiles)
      .where(inArray(tiles.eventId, bingoCandidates.map((e) => e.id)))
      .groupBy(tiles.eventId);
    for (const row of tileCounts) tileCountMap.set(row.eventId, row.count);
  }

  const bingos: ScheduleBingo[] = bingoCandidates.map((e) => ({
    id: e.id,
    title: e.name,
    startDate: e.startDate!,
    endDate: e.endDate!,
    status: e.startDate! > nowIso ? 'upcoming' : 'active',
    boardSize: e.boardSize,
    tileCount: tileCountMap.get(e.id) ?? 0,
    format: e.format,
    scoringMode: e.scoringMode,
  }));

  const weeklies: ScheduleWeekly[] = allWeeklies
    .filter((w) => w.endDate > nowIso && w.status !== 'completed')
    .map((w) => ({
      id: w.id,
      title: w.title,
      type: w.type,
      metric: w.metric,
      metricLabel: weeklyMetricLabel(w.type, w.metric),
      status: w.status,
      startDate: w.startDate,
      endDate: w.endDate,
    }));

  const sortByStart = (a: { startDate: string }, b: { startDate: string }) =>
    a.startDate.localeCompare(b.startDate);

  bingos.sort(sortByStart);
  weeklies.sort(sortByStart);

  return {
    bingos: bingos.slice(0, SCHEDULE_CAP),
    weeklies: weeklies.slice(0, SCHEDULE_CAP),
  };
}

export interface ActiveWeekly {
  id: number;
  title: string;
  type: string;
  metric: string;
  metricLabel: string;
  startDate: string;
  endDate: string;
}

// The single live weekly competition in THIS clan (status = 'active'), or null. Mirrors the
// original /api/plugin/active-weekly behavior.
//
// The clan filter matters more here than in the schedule, because this one is not just read: the
// plugin uses it to decide auto-enroll on login. Unfiltered, `findFirst` returned whichever active
// competition the planner happened to reach first ACROSS THE PLATFORM — so a member of a clan with
// no weekly running would be handed another clan's, and pointed at enrolling in it.
export async function getActiveWeekly(clanId: number): Promise<ActiveWeekly | null> {
  const active = await db.query.weeklyCompetitions.findFirst({
    where: and(eq(weeklyCompetitions.clanId, clanId), eq(weeklyCompetitions.status, 'active')),
  });
  if (!active) return null;
  return {
    id: active.id,
    title: active.title,
    type: active.type,
    metric: active.metric,
    metricLabel: weeklyMetricLabel(active.type, active.metric),
    startDate: active.startDate,
    endDate: active.endDate,
  };
}

export interface ActiveWeeklyMetric {
  id: number;
  type: 'skill' | 'boss' | 'efficiency';
  metric: string;
  startDate: string; // comp start — the elapsed-time anchor for the implausible-gain check
}

// EVERY live weekly competition's tracked metric IN THIS CLAN — a SOTW and a BOTW can run at once,
// so this returns all `status='active'` comps (unlike getActiveWeekly's single). Used to (a) tell
// the plugin which skill/boss to push live via trackedKcNames/trackedSkillNames, and (b) credit live
// weekly gains in the plugin-stats ingest.
//
// The ingest was never actually mis-crediting: it looks the participant up by
// (competitionId, clanMemberId), and a seat in one clan is not enrolled in another's competition, so
// a foreign comp fell out at that check. What the missing filter did do is tell every plugin to push
// metrics for whatever every other clan was competing on — which is both a leak of what those clans
// are running and a pile of work nobody asked for.
export async function getActiveWeeklyMetrics(clanId: number): Promise<ActiveWeeklyMetric[]> {
  const rows = await db.query.weeklyCompetitions.findMany({
    where: and(eq(weeklyCompetitions.clanId, clanId), eq(weeklyCompetitions.status, 'active')),
  });
  return rows.map((c) => ({
    id: c.id,
    type: c.type as 'skill' | 'boss' | 'efficiency',
    metric: c.metric,
    startDate: c.startDate,
  }));
}

export interface PluginWebhooks {
  // Discord webhook URLs the plugin posts to directly. Null when unset on the site.
  rareDrops: string | null;
  deaths: string | null;
  combatAchievements: string | null;
  pvpKills: string | null;
  clips: string | null;
  /** Seasonal (Leagues) worlds: every notification from one routes here instead of the above. */
  leagues: string | null;
}

export const WEBHOOK_SETTING_KEYS = [
  'webhook_rare_drops',
  'webhook_deaths',
  'webhook_combat_achievements',
  'webhook_pvp_kills',
  'webhook_clips',
  'webhook_leagues',
] as const;

// Plugin-posted notification destinations, read from the settings key/value table.
export async function getNotificationWebhooks(clanId: number): Promise<PluginWebhooks> {
  const map = await getSettingMap(clanId, [...WEBHOOK_SETTING_KEYS]);
  return {
    rareDrops: map.get('webhook_rare_drops') || null,
    deaths: map.get('webhook_deaths') || null,
    combatAchievements: map.get('webhook_combat_achievements') || null,
    pvpKills: map.get('webhook_pvp_kills') || null,
    clips: map.get('webhook_clips') || null,
    leagues: map.get('webhook_leagues') || null,
  };
}

// Newline-separated list settings the plugin reads. Edited on Admin → Integrations.
export const FUN_DEATHS_SETTING_KEY = 'fun_death_messages';
export const DEATH_TAUNTS_SETTING_KEY = 'death_taunts';
export const SPOON_TAUNTS_SETTING_KEY = 'spoon_taunts';
export const ALWAYS_NOTIFY_SETTING_KEY = 'always_notify_items';

// Reads a settings value stored as one entry per line, trimmed and blank-filtered.
async function getLineSetting(clanId: number, key: string): Promise<string[]> {
  const value = await getSetting(clanId, key);
  if (!value) return [];
  return value
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// Server-managed 1/100 fun-death pool. Admin-editable; falls back to the curated constant when
// the clan hasn't set its own.
export async function getFunDeathMessages(clanId: number): Promise<string[]> {
  const custom = await getLineSetting(clanId, FUN_DEATHS_SETTING_KEY);
  return custom.length ? custom : FUN_DEATH_MESSAGES;
}

// Admin-set reaction lines appended to death / lucky-drop posts. Empty = use the plugin's baked-in
// defaults (the plugin substitutes its own list when these are empty).
export async function getDeathTaunts(clanId: number): Promise<string[]> {
  return getLineSetting(clanId, DEATH_TAUNTS_SETTING_KEY);
}

export async function getSpoonTaunts(clanId: number): Promise<string[]> {
  return getLineSetting(clanId, SPOON_TAUNTS_SETTING_KEY);
}

// Admin-managed list of item names that always post to the rare-drops channel (prestige drops
// the value/rarity thresholds miss). EXTENDS the plugin's baked-in defaults — the plugin unions
// both lists — so this only needs to hold extras (e.g. new ornament kits). One name per line.
export async function getAlwaysNotifyItems(clanId: number): Promise<string[]> {
  return getLineSetting(clanId, ALWAYS_NOTIFY_SETTING_KEY);
}

// Prestige/notable items that ALWAYS post to the rare-drop channel — resolved to item ids so the plugin
// matches by ID (reliable for untradeables like a ToA Cursed phalanx that have no GE value to gate on and
// only ever matched by a fragile name compare). MIRRORS the plugin's baked-in ALWAYS_NOTIFY_FALLBACK
// (AnvilPlugin.java) — keep the two in sync; admins extend it via the always_notify_items setting.
const NOTABLE_ITEM_PATTERNS = [
  'infernal cape', "dizana's quiver", 'purifying sigil',
  'ancient blood ornament kit', 'sanguine ornament kit', 'holy ornament kit', 'sanguine dust',
  'metamorphic dust', 'twisted ancestral colour kit',
  'menaphite ornament kit', 'cursed phalanx', 'masori crafting kit',
  'vestige', 'quartz', "executioner's axe head", 'eye of the duke', "leviathan's lure", "siren's staff",
  'jar of', 'champion scroll', "champion's cape", 'enhanced crystal', 'blood shard', 'fire cape',
];

let notableIdCache: { ids: number[]; at: number; key: string } | null = null;
const NOTABLE_ID_TTL_MS = 5 * 60_000;

// Substring-resolve the notable name patterns (baked-in + admin) to the set of matching item ids — the same
// `.contains()` semantics the plugin used on names. Cached briefly (the list is essentially static); on an
// item-data outage it degrades to the last good set (or empty), and the plugin's name allowlist still covers.
export async function getAlwaysNotifyItemIds(clanId: number): Promise<number[]> {
  const admin = await getLineSetting(clanId, ALWAYS_NOTIFY_SETTING_KEY);
  const patterns = [...NOTABLE_ITEM_PATTERNS, ...admin.map((s) => s.toLowerCase()).filter(Boolean)];
  const key = patterns.join('');
  if (notableIdCache && notableIdCache.key === key && Date.now() - notableIdCache.at < NOTABLE_ID_TTL_MS) {
    return notableIdCache.ids;
  }
  let items;
  try {
    items = await getItemMapping();
  } catch {
    return notableIdCache?.ids ?? [];
  }
  const ids = new Set<number>();
  for (const it of items) {
    const n = it.name.toLowerCase();
    for (const p of patterns) {
      if (p && n.includes(p)) {
        ids.add(it.id);
        break;
      }
    }
  }
  const out = [...ids];
  notableIdCache = { ids: out, at: Date.now(), key };
  return out;
}

// Whether rare-drop posts include the boss/raid kill count the drop landed on. Default on; the
// admin can switch it off from Admin → Integrations. Stored as the string 'off' when disabled.
export const SHOW_KILL_COUNT_SETTING_KEY = 'show_kill_count';

export async function getShowKillCount(clanId: number): Promise<boolean> {
  return (await getSetting(clanId, SHOW_KILL_COUNT_SETTING_KEY)) !== 'off';
}

// Clan-wide floor on rarity-triggered drop posts, as 1-in-N. Members set their own threshold in the
// plugin, but a single member on a loose setting is enough to fill the channel with herb rolls off
// an ordinary slayer task — so the clan's floor wins where it's stricter (the plugin takes the max).
// Unset means "no clan floor"; the plugin's own default (1/10,000) then applies.
export const DROP_RARITY_FLOOR_SETTING_KEY = 'drop_rarity_floor';
export const DEFAULT_DROP_RARITY_FLOOR = 10_000;

export async function getDropRarityFloor(clanId: number): Promise<number> {
  const parsed = Number(await getSetting(clanId, DROP_RARITY_FLOOR_SETTING_KEY));
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_DROP_RARITY_FLOOR;
  // Never below the plugin's own hard minimum — a "floor" that loosens the gate would be a trap.
  return Math.max(1000, Math.round(parsed));
}

// --- Clan naming ----------------------------------------------------------------------------
// Two independent names, because the two jobs are different:
//   clan_name        — the DISPLAY name. What the site, the plugin sidebar, Discord posts and the
//                      other clans call this clan. Free-form; rename at will.
//   clan_ingame_name — the EXACT in-game clan name, used only to gate the plugin's roster sync
//                      (/api/plugin/clan-sync). Blank = accept a sync from any clan.
// A clan whose OSRS clan is "Anvl CC" can therefore present itself as "The Anvil" everywhere.
export const CLAN_NAME_SETTING_KEY = 'clan_name';
export const CLAN_INGAME_NAME_SETTING_KEY = 'clan_ingame_name';

// The clan's display name — plugin sidebar (clan filter label + logged-out home card), the web
// home hero, guides, Discord posts.
//
// READS THE COLUMN FIRST, for the same reason getInGameClanName below does, and it was the same
// bug: `createClan` writes clans.name and no setting at all, so every clan made through /clans/new
// resolved to the `fallback` — its own home page said "Anvil" nine times, in its title, its hero and
// its nav. Nothing errored, because a fallback firing looks exactly like a fallback not firing.
//
// The setting is a MIRROR the admin UI keeps in step (see /api/admin/settings), not a second source
// of truth. It stays readable so a clan whose column somehow lags is still named, and migration 0072
// backfilled the column from it wherever the two had already drifted.
export async function getClanDisplayName(clanId: number, fallback = 'Anvil'): Promise<string> {
  const row = await db.query.clans.findFirst({ where: eq(clans.id, clanId), columns: { name: true } });
  if (row?.name?.trim()) return row.name.trim();
  const value = await getSettingText(clanId, CLAN_NAME_SETTING_KEY);
  return value || process.env.CLAN_NAME?.trim() || fallback;
}

// The exact in-game clan name the plugin's roster-sync payload must report.
//
// READS THE COLUMN, not the setting. It lived in both, and this read only the setting — so a clan
// created through the newer flow, which writes clans.in_game_name, had no gate at all and would
// accept any roster pushed at it. Migration 0018 folded the setting into the column and this
// follows; the setting is still written by the admin UI and is now a mirror, not the source.
//
// Deliberately does NOT fall back to the display name: once the two are free to drift, gating on
// the display name would reject every sync after a rename.
export async function getInGameClanName(clanId: number): Promise<string | null> {
  const row = await db.query.clans.findFirst({ where: eq(clans.id, clanId), columns: { inGameName: true } });
  if (row?.inGameName?.trim()) return row.inGameName.trim();
  // The settings row remains readable for a clan whose column has not been filled — belt and
  // braces while both exist.
  const value = await getSettingText(clanId, CLAN_INGAME_NAME_SETTING_KEY);
  return value || process.env.CLAN_INGAME_NAME?.trim() || null;
}

// The clan's Discord invite, shown in the nav, on the home page and in the setup guides. Same
// resolution shape as the two names above: settings row, then the provisioner-injected env, then
// nothing (the links hide themselves when unset).
//
// Lives here because three separate call sites had this exact `trim() || env || null` chain inlined.
export const DISCORD_INVITE_SETTING_KEY = 'discord_invite_url';

export async function getDiscordInviteUrl(clanId: number): Promise<string | null> {
  const value = await getSettingText(clanId, DISCORD_INVITE_SETTING_KEY);
  return value || process.env.DISCORD_INVITE_URL?.trim() || null;
}

// Difficulty-tier bands (points → tier), stored as a JSON array under this key. Admin-editable so
// the bands can be retuned/renamed/added without a web *or* plugin release; served to the plugin
// in /api/plugin/config + /api/plugin/board and used by the web filters. Falls back to the curated
// default when unset or malformed.
export const TIER_BANDS_SETTING_KEY = 'tier_bands';

export async function getTierBands(clanId: number): Promise<TierBand[]> {
  const value = await getSetting(clanId, TIER_BANDS_SETTING_KEY);
  if (!value) return DEFAULT_TIER_BANDS;
  try {
    const bands = normalizeTierBands(JSON.parse(value));
    return bands.length ? bands : DEFAULT_TIER_BANDS;
  } catch {
    return DEFAULT_TIER_BANDS;
  }
}

// --- Public showcase listing ------------------------------------------------------------------
// Opt-OUT flag for the "Clans on Anvil" page on the Anvil site (anvilosrs.com/clans): when on, the
// unauthenticated GET /api/public/showcase serves this clan's name + a handful of aggregate counts
// so the operator's page can show who actually runs Anvil. Never any member, RSN or Discord data —
// see the route for the exact payload.
//
// Default ON (absent row ⇒ listed), because the page only ever reaches instances the operator hosts.
// Stored as the explicit strings 'on'/'off': the settings PUT folds '' to NULL, which would read back
// as the default.
export const PUBLIC_SHOWCASE_KEY = 'public_showcase';

export async function getPublicShowcase(clanId: number): Promise<boolean> {
  // default (no row) = listed; explicit 'off' opts out
  return (await getSetting(clanId, PUBLIC_SHOWCASE_KEY)) !== 'off';
}

/**
 * Activity names to probe when importing a member's existing personal bests.
 *
 * RuneLite's chat-commands plugin stores each best under `personalbest.<rsprofile>.<activity>`, in
 * the RS-profile config scope. A plugin can read that scope by key but cannot enumerate it — the
 * only listing API reads the main profile — so the import has to know what to ask for. These are
 * the names the game itself uses (lowercased), which is what chat-commands keys on.
 *
 * Raid and party activities also exist as "<name> N players" variants; the plugin appends those
 * rather than us shipping every combination.
 */
export function personalBestActivities(): string[] {
  const names = new Set<string>();
  for (const boss of BOSSES) {
    const label = boss.label.toLowerCase();
    names.add(label);
    // RuneLite files the PB under the name the game prints, which drops the article:
    // "The Whisperer" on the hiscores is stored as "whisperer".
    if (label.startsWith('the ')) names.add(label.slice(4));
    for (const alias of boss.aliases ?? []) names.add(alias.toLowerCase());
  }
  // Awakened DT2 variants keep their own PB, but they aren't on the hiscores so BOSSES has no entry.
  for (const target of COUNTER_TARGETS) {
    if (target.name.toLowerCase().endsWith('(awakened)')) names.add(target.name.toLowerCase());
  }
  // Timed content that isn't a hiscores boss, so it has no BOSSES entry to come from.
  for (const extra of [
    'gauntlet', 'corrupted gauntlet', 'the gauntlet', 'the corrupted gauntlet',
    'fight caves', 'inferno', 'fortis colosseum', 'colosseum',
    'barbarian assault', 'fragment of seren', 'zalcano',
    'agility pyramid', 'ape atoll agility', 'hallowed sepulchre',
    'hallowed sepulchre floor 1', 'hallowed sepulchre floor 2', 'hallowed sepulchre floor 3',
    'hallowed sepulchre floor 4', 'hallowed sepulchre floor 5',
    'guardians of the rift', 'tempoross', 'wintertodt',
  ]) {
    names.add(extra);
  }
  return [...names].sort();
}
