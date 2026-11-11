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
  /** Heat over the last HEAT_WEEKS weeks, oldest first, this week last (0–100, of today's roster). */
  weeks: number[];
  /** Members on a streak at the end of last week. */
  onLastWeek: number;
  byRsn: Map<string, Streak>;
}

/** How many weeks of clan heat the card shows. */
export const HEAT_WEEKS = 8;

async function loadClanStreaks(clanId: number): Promise<ClanStreaks> {
  const members = (await listMembers(clanId)).filter((m) => !m.isGuest);
  const days = await activeDaysFor(members.map((m) => m.accountId));
  const today = todayUtc();
  const byRsn = new Map<string, Streak>();
  let on = 0;
  let started = 0;
  const milestones: ClanStreaks['milestones'] = [];
  // Past weeks: on a streak at a week's end = that week counted (or was a rest week).
  const past = new Array<number>(HEAT_WEEKS - 1).fill(0);
  for (const m of members) {
    const s = streakFrom(days.get(m.accountId) ?? [], today);
    byRsn.set(m.rsn, s);
    const done = s.safe ? s.history.slice(0, -1) : s.history;
    for (let i = 0; i < past.length; i++) if ((done[done.length - past.length + i] ?? 'missed') !== 'missed') past[i]++;
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
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const weeks = [...past.map(pct), pct(on)];
  return { on, total, heat: pct(on), top, milestones, started, weeks, onLastWeek: past[past.length - 1] ?? 0, byRsn };
}

/** A clan's streaks, cached a few minutes: the sweep only moves the days a few times an hour. */
export function clanStreaks(clanId: number): Promise<ClanStreaks> {
  return ttlMemo(`clan-streaks:${clanId}`, () => loadClanStreaks(clanId), 10 * 60_000);
}

export interface YearStreak {
  /** The longest streak inside the year. */
  best: number;
  /** Weeks of the year that counted. */
  activeWeeks: number;
  /** The highest milestone that streak reached. */
  milestone: string | null;
}

/** A character's streaks within one calendar year, for its yearly recap (lib/yearlyWrapped). */
export async function yearStreak(accountId: number, year: string): Promise<YearStreak> {
  const rows = await db
    .select({ day: memberDailyStats.day })
    .from(memberDailyStats)
    .where(and(eq(memberDailyStats.accountId, accountId), gte(memberDailyStats.day, `${year}-01-01`), sql`${memberDailyStats.day} <= ${`${year}-12-31`}`, activeWhere()));
  const today = todayUtc();
  const end = today < `${year}-12-31` ? today : `${year}-12-31`;
  // Only this year's days, judged as at its last day: a streak from last December starts fresh.
  const s = streakFrom(
    rows.map((r) => r.day),
    end,
  );
  const activeWeeks = s.history.filter((m) => m === 'active').length;
  const milestone = [...STREAK_MILESTONES].reverse().find((m) => s.best >= m.weeks)?.name ?? null;
  return { best: s.best, activeWeeks, milestone };
}

/** Current streak weeks for many characters at once (a ranking's rows), keyed by account id; only those on one. */
export async function streakWeeksFor(accountIds: number[]): Promise<Map<number, number>> {
  const days = await activeDaysFor(accountIds);
  const today = todayUtc();
  const out = new Map<number, number>();
  for (const [id, list] of days) {
    const w = streakFrom(list, today).weeks;
    if (w > 0) out.set(id, w);
  }
  return out;
}

/** Clan heat for several clans (a ranking), keyed by clan id; cached per clan like clanStreaks. */
export async function clanHeats(clanIds: number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  for (const id of [...new Set(clanIds)]) {
    const h = await clanStreaks(id).catch(() => null);
    if (h && h.total > 0) out.set(id, h.heat);
  }
  return out;
}

/** Current streak weeks by character name (a roster the panel lists), keyed by normalizeRsn; only those on one. */
export async function streakWeeksForRsns(rsns: string[]): Promise<Map<string, number>> {
  const keys = [...new Set(rsns.map(normalizeRsn))].filter((k) => k.length > 0 && k.length <= 12).slice(0, 200);
  if (keys.length === 0) return new Map();
  const rows = await db.select({ id: accounts.id, key: accounts.rsnNormalized }).from(accounts).where(inArray(accounts.rsnNormalized, keys));
  const weeks = await streakWeeksFor(rows.map((r) => r.id));
  const out = new Map<string, number>();
  for (const r of rows) {
    const w = weeks.get(r.id);
    if (w) out.set(r.key, w);
  }
  return out;
}
