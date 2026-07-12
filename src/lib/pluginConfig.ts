import { db } from '@/db';
import { events, tiles, weeklyCompetitions, settings } from '@/db/schema';
import { count, eq, inArray } from 'drizzle-orm';
import { FUN_DEATH_MESSAGES } from '@/lib/constants';
import { DEFAULT_TIER_BANDS, normalizeTierBands, type TierBand } from '@/lib/tileFilter';

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
  status: string;
  startDate: string;
  endDate: string;
}

export interface PluginSchedule {
  bingos: ScheduleBingo[];
  weeklies: ScheduleWeekly[];
}

const SCHEDULE_CAP = 10;

// Active + upcoming bingo events and weekly competitions, sorted by start, capped so we
// don't ship the whole archive. Mirrors the original /api/plugin/schedule behavior.
export async function buildSchedule(): Promise<PluginSchedule> {
  const nowIso = new Date().toISOString();

  const [allEvents, allWeeklies] = await Promise.all([
    db.select().from(events),
    db.select().from(weeklyCompetitions),
  ]);

  const bingoCandidates = allEvents.filter(
    (e) => e.startDate && e.endDate && e.endDate > nowIso && !e.forceEndedAt,
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
  startDate: string;
  endDate: string;
}

// The single live weekly competition (status = 'active'), or null. Mirrors the original
// /api/plugin/active-weekly behavior. Used by the plugin to decide auto-enroll on login.
export async function getActiveWeekly(): Promise<ActiveWeekly | null> {
  const active = await db.query.weeklyCompetitions.findFirst({
    where: eq(weeklyCompetitions.status, 'active'),
  });
  if (!active) return null;
  return {
    id: active.id,
    title: active.title,
    type: active.type,
    metric: active.metric,
    startDate: active.startDate,
    endDate: active.endDate,
  };
}

export interface ActiveWeeklyMetric {
  id: number;
  type: 'skill' | 'boss';
  metric: string;
}

// EVERY live weekly competition's tracked metric — a SOTW and a BOTW can run at once, so this returns
// all `status='active'` comps (unlike getActiveWeekly's single). Used to (a) tell the plugin which
// skill/boss to push live via trackedKcNames/trackedSkillNames, and (b) credit live weekly gains in
// the plugin-stats ingest.
export async function getActiveWeeklyMetrics(): Promise<ActiveWeeklyMetric[]> {
  const rows = await db.query.weeklyCompetitions.findMany({
    where: eq(weeklyCompetitions.status, 'active'),
  });
  return rows.map((c) => ({ id: c.id, type: c.type as 'skill' | 'boss', metric: c.metric }));
}

export interface PluginWebhooks {
  // Discord webhook URLs the plugin posts to directly. Null when unset on the site.
  rareDrops: string | null;
  deaths: string | null;
  combatAchievements: string | null;
  pvpKills: string | null;
  clips: string | null;
}

export const WEBHOOK_SETTING_KEYS = [
  'webhook_rare_drops',
  'webhook_deaths',
  'webhook_combat_achievements',
  'webhook_pvp_kills',
  'webhook_clips',
] as const;

// Plugin-posted notification destinations, read from the settings key/value table.
export async function getNotificationWebhooks(): Promise<PluginWebhooks> {
  const rows = await db
    .select()
    .from(settings)
    .where(inArray(settings.key, [...WEBHOOK_SETTING_KEYS]));
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    rareDrops: map.get('webhook_rare_drops') || null,
    deaths: map.get('webhook_deaths') || null,
    combatAchievements: map.get('webhook_combat_achievements') || null,
    pvpKills: map.get('webhook_pvp_kills') || null,
    clips: map.get('webhook_clips') || null,
  };
}

// Newline-separated list settings the plugin reads. Edited on Admin → Integrations.
export const FUN_DEATHS_SETTING_KEY = 'fun_death_messages';
export const DEATH_TAUNTS_SETTING_KEY = 'death_taunts';
export const SPOON_TAUNTS_SETTING_KEY = 'spoon_taunts';
export const ALWAYS_NOTIFY_SETTING_KEY = 'always_notify_items';

// Reads a settings value stored as one entry per line, trimmed and blank-filtered.
async function getLineSetting(key: string): Promise<string[]> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, key) });
  if (!row?.value) return [];
  return row.value
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// Server-managed 1/100 fun-death pool. Admin-editable; falls back to the curated constant when
// the clan hasn't set its own.
export async function getFunDeathMessages(): Promise<string[]> {
  const custom = await getLineSetting(FUN_DEATHS_SETTING_KEY);
  return custom.length ? custom : FUN_DEATH_MESSAGES;
}

// Admin-set reaction lines appended to death / lucky-drop posts. Empty = use the plugin's baked-in
// defaults (the plugin substitutes its own list when these are empty).
export async function getDeathTaunts(): Promise<string[]> {
  return getLineSetting(DEATH_TAUNTS_SETTING_KEY);
}

export async function getSpoonTaunts(): Promise<string[]> {
  return getLineSetting(SPOON_TAUNTS_SETTING_KEY);
}

// Admin-managed list of item names that always post to the rare-drops channel (prestige drops
// the value/rarity thresholds miss). EXTENDS the plugin's baked-in defaults — the plugin unions
// both lists — so this only needs to hold extras (e.g. new ornament kits). One name per line.
export async function getAlwaysNotifyItems(): Promise<string[]> {
  return getLineSetting(ALWAYS_NOTIFY_SETTING_KEY);
}

// Whether rare-drop posts include the boss/raid kill count the drop landed on. Default on; the
// admin can switch it off from Admin → Integrations. Stored as the string 'off' when disabled.
export const SHOW_KILL_COUNT_SETTING_KEY = 'show_kill_count';

export async function getShowKillCount(): Promise<boolean> {
  const row = await db.query.settings.findFirst({
    where: eq(settings.key, SHOW_KILL_COUNT_SETTING_KEY),
  });
  return row?.value !== 'off';
}

// Difficulty-tier bands (points → tier), stored as a JSON array under this key. Admin-editable so
// the bands can be retuned/renamed/added without a web *or* plugin release; served to the plugin
// in /api/plugin/config + /api/plugin/board and used by the web filters. Falls back to the curated
// default when unset or malformed.
export const TIER_BANDS_SETTING_KEY = 'tier_bands';

export async function getTierBands(): Promise<TierBand[]> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, TIER_BANDS_SETTING_KEY) });
  if (!row?.value) return DEFAULT_TIER_BANDS;
  try {
    const bands = normalizeTierBands(JSON.parse(row.value));
    return bands.length ? bands : DEFAULT_TIER_BANDS;
  } catch {
    return DEFAULT_TIER_BANDS;
  }
}
