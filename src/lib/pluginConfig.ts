import { db } from '@/db';
import { events, tiles, weeklyCompetitions, settings } from '@/db/schema';
import { count, eq, inArray } from 'drizzle-orm';
import { FUN_DEATH_MESSAGES } from '@/lib/constants';

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

export interface PluginWebhooks {
  // Discord webhook URLs the plugin posts to directly. Null when unset on the site.
  rareDrops: string | null;
  deaths: string | null;
}

export const WEBHOOK_SETTING_KEYS = ['webhook_rare_drops', 'webhook_deaths'] as const;

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
  };
}

// Server-managed fun-death pool. Sourced from constants for now; promote to settings/table
// later only if it needs to be admin-editable.
export function getFunDeathMessages(): string[] {
  return FUN_DEATH_MESSAGES;
}
