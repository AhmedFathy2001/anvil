// Weekly activity streaks: the database half. Reads the active days out of member_daily_stats (the
// hiscores sweep's per-character daily gains) and hands them to lib/activityStreak. Nothing is
// stored: a streak is replayed from history every time, so it can never drift from the data.

import { and, eq, gte, inArray, or, sql } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, memberDailyStats } from '@/db/schema';
import { normalizeRsn } from '@/lib/auth';
import { listMembers } from '@/lib/memberProfile';
import { ttlMemo } from '@/lib/ttlMemo';
import { ACTIVE_XP_FLOOR, HISTORY_WEEKS, STREAK_MILESTONES, onStreak, streakFrom, type Streak } from '@/lib/activityStreak';

const todayUtc = () => new Date().toISOString().slice(0, 10);
/** The first day a replay can look at (a little before HISTORY_WEEKS, to start at a week boundary). */
const fromDay = () => new Date(Date.now() - (HISTORY_WEEKS + 1) * 7 * 86_400_000).toISOString().slice(0, 10);

/** Only the rows that count as played (lib/activityStreak isActiveDay), in SQL. */
const activeWhere = () => or(gte(memberDailyStats.xpGained, ACTIVE_XP_FLOOR), sql`${memberDailyStats.ehbMilliGained} > 0`);

async function activeDaysFor(accountIds: number[]): Promise<Map<number, string[]>> {
  const out = new Map<number, string[]>();
  const ids = [...new Set(accountIds)].filter((n) => Number.isInteger(n) && n > 0);
  for (let i = 0; i < ids.length; i += 1_000) {
    const rows = await db
      .select({ accountId: memberDailyStats.accountId, day: memberDailyStats.day })
      .from(memberDailyStats)
      .where(and(inArray(memberDailyStats.accountId, ids.slice(i, i + 1_000)), gte(memberDailyStats.day, fromDay()), activeWhere()));
    for (const r of rows) {
      const list = out.get(r.accountId);
      if (list) list.push(r.day);
      else out.set(r.accountId, [r.day]);
    }
  }
  return out;
}

/** One character's streak. */
export async function streakForAccount(accountId: number): Promise<Streak> {
  const days = await activeDaysFor([accountId]);
  return streakFrom(days.get(accountId) ?? [], todayUtc());
}

/** One character's streak by name (the plugin's Lookup), or null when Anvil doesn't know the name. */
export async function streakForRsn(rsn: string): Promise<Streak | null> {
  const key = normalizeRsn(rsn);
  if (!key) return null;
  const row = await db.query.accounts.findFirst({ where: eq(accounts.rsnNormalized, key), columns: { id: true } });
  return row ? streakForAccount(row.id) : null;
}

export interface ClanStreaks {
  /** Members on a streak, of the members counted (guests left out, like the clan's other counts). */
  on: number;
  total: number;
  /** 0–100. */
  heat: number;
  /** Longest streaks first. */
  top: { rsn: string; weeks: number }[];
  /** Milestones landed this week (the streak reached exactly a milestone and the week counts). */
  milestones: { rsn: string; weeks: number; name: string }[];
  /** Started a new streak this week (nothing last week, this week counts). */
  started: number;
  byRsn: Map<string, Streak>;
}

async function loadClanStreaks(clanId: number): Promise<ClanStreaks> {
  const members = (await listMembers(clanId)).filter((m) => !m.isGuest);
  const days = await activeDaysFor(members.map((m) => m.accountId));
  const today = todayUtc();
  const byRsn = new Map<string, Streak>();
  let on = 0;
  let started = 0;
  const milestones: ClanStreaks['milestones'] = [];
  for (const m of members) {
    const s = streakFrom(days.get(m.accountId) ?? [], today);
    byRsn.set(m.rsn, s);
    if (onStreak(s)) on++;
    if (s.safe && s.weeks === 1) started++;
    const hit = s.safe ? STREAK_MILESTONES.find((x) => x.weeks === s.weeks) : undefined;
    if (hit) milestones.push({ rsn: m.rsn, weeks: s.weeks, name: hit.name });
  }
  const top = [...byRsn]
    .filter(([, s]) => s.weeks > 0)
    .sort((a, b) => b[1].weeks - a[1].weeks || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([rsn, s]) => ({ rsn, weeks: s.weeks }));
  const total = members.length;
  return { on, total, heat: total ? Math.round((on / total) * 100) : 0, top, milestones, started, byRsn };
}

/** A clan's streaks, cached a few minutes: the sweep only moves the days a few times an hour. */
export function clanStreaks(clanId: number): Promise<ClanStreaks> {
  return ttlMemo(`clan-streaks:${clanId}`, () => loadClanStreaks(clanId), 10 * 60_000);
}
