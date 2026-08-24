// Reads behind the public member directory and player profiles.
//
// Everything here is served from stats we ALREADY hold — the sweep's last snapshot, the daily rollup
// rows, the milestone log. Opening a profile never triggers a hiscores fetch, which is what keeps a
// page anyone can link to from becoming a way to hammer Jagex on our behalf.

import { db } from '@/db';
import { clanAuditLog, clanRoster, events, eventParticipants, users, memberDailyStats, memberMilestones, playerEventFacts, playerSnapshots, weeklyCompetitions, weeklyParticipants, accounts } from '@/db/schema';
import { findRosterSeat } from '@/lib/roster';
import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import type { HiscoresSnapshot } from '@/lib/hiscores';
import { computeEfficiency, type EfficiencyResult } from '@/lib/efficiency';
import {
  CLUE_TIER_KEYS,
  HISCORES_ACTIVITIES,
  activityFor,
  parseActivityBlob,
  readAllActivities,
  type ActivityGroup,
  type ActivityReading,
  type ActivityScale,
} from '@/lib/hiscoresActivities';
import { SKILLS, SKILL_LABELS, BOSSES, EFFICIENCY_SCALE } from '@/lib/constants';
import { progressToLevel } from '@/lib/xp';
import { isPlausibleRsn, normalizeRsn } from '@/lib/auth';

export interface MemberListRow {
  /** The SEAT — this member's place on this clan's roster. */
  id: number;
  /** The ACCOUNT — the character Jagex tracks, and what every stats table is keyed by. */
  accountId: number;
  rsn: string;
  rank: string | null;
  isGuest: boolean;
  status: string;
  /** Null until the member has been swept at least once since stat history landed. */
  overallXp: number | null;
  ehp: number | null;
  ehb: number | null;
  lastSeenAt: string | null;
}

/**
 * The whole roster in one query, with the efficiency numbers the sweep already computed into the
 * member's most recent daily row. No per-member work, no snapshot parsing — a 500-member clan is one
 * indexed scan.
 */
export async function listMembers(clanId: number): Promise<MemberListRow[]> {
  // The member's newest daily row carries their latest totals. A correlated subquery keeps this to a
  // single statement rather than a query per member.
  // KEYED BY ACCOUNT, AND JOINED TO THE ROSTER BY ACCOUNT. Both joins below read `account_id` and
  // both used to match it against `clanRoster.id`, which is the SEAT — two ids from two sequences
  // that are never equal (456 of 456 live seats on the preview differ). So every figure in this
  // list — total XP, EHP, EHB, and every ranking built on them — belonged to whichever unrelated
  // character happened to hold that number. It looked entirely normal, because another account's
  // XP is still a believable amount of XP.
  const latestDay = db
    .select({
      accountId: memberDailyStats.accountId,
      day: sql<string>`MAX(${memberDailyStats.day})`.as('latest_day'),
    })
    .from(memberDailyStats)
    .groupBy(memberDailyStats.accountId)
    .as('latest_day_per_member');

  const rows = await db
    .select({
      id: clanRoster.id,
      accountId: clanRoster.accountId,
      rsn: clanRoster.rsn,
      rank: clanRoster.rank,
      kind: clanRoster.kind,
      status: clanRoster.status,
      lastSeenAt: clanRoster.lastSeenInClan,
      overallXp: memberDailyStats.overallXp,
      ehpMilli: memberDailyStats.ehpMilli,
      ehbMilli: memberDailyStats.ehbMilli,
    })
    .from(clanRoster)
    .leftJoin(latestDay, eq(latestDay.accountId, clanRoster.accountId))
    .leftJoin(
      memberDailyStats,
      and(eq(memberDailyStats.accountId, clanRoster.accountId), eq(memberDailyStats.day, latestDay.day)),
    )
    // Members who left the clan drop off the directory; the profile page still resolves by name so
    // old links and event recaps don't 404.
    .where(and(eq(clanRoster.clanId, clanId), isNull(clanRoster.leftAt)))
    .orderBy(clanRoster.rsn);

  return rows
    // Placeholder rows RuneLite handed us before the sync learned to reject them ("#Player1404"):
    // never on the hiscores, never a stat, pure noise in a roster view. Filtered on read rather than
    // deleted — removing member rows is the operator's call, not a side effect of listing them.
    .filter((r) => isPlausibleRsn(r.rsn))
    .map((r) => ({
      id: r.id,
      accountId: r.accountId,
      rsn: r.rsn,
      rank: r.rank,
      isGuest: r.kind === 'guest',
      status: r.status,
      lastSeenAt: r.lastSeenAt,
      overallXp: r.overallXp ?? null,
      ehp: r.ehpMilli != null ? r.ehpMilli / EFFICIENCY_SCALE : null,
      ehb: r.ehbMilli != null ? r.ehbMilli / EFFICIENCY_SCALE : null,
    }));
}

export interface SkillRow {
  key: string;
  level: number;
  xp: number;
  rank: number;
  /** Hours this skill is worth — the per-skill EHP attribution. */
  ehp: number;
}

export interface BossRow {
  key: string;
  kc: number;
  rank: number;
  ehb: number;
}

export interface ActivityRow {
  key: string;
  label: string;
  shortLabel: string;
  group: ActivityGroup;
  scale: ActivityScale;
  unit: string | null;
  score: number;
  /** Hiscores position — 1 is the best in the game. Null when unranked. */
  rank: number | null;
}

/**
 * A CHARACTER, with no clan attached.
 *
 * Everything Jagex tracks about an account — skills, bosses, activities, efficiency — and nothing
 * about anybody's roster. `MemberProfile` is this plus the handful of facts that only exist relative
 * to a clan: the seat, the in-game rank, guest or member, when they joined.
 *
 * Split out because THE APEX HAS NO SEATS. /p/<rsn> is one character seen from the platform, and
 * without this it had to invent a clan to say anything at all — which is how it ended up a stub
 * listing four fields while the clan's own profile had four tabs and a collection log.
 */
export interface AccountProfile {
  /**
   * The ACCOUNT — the OSRS character itself, which is what Jagex tracks and what every stats table
   * is keyed by. Never a seat id: the two come from separate sequences and on the preview not one
   * of 456 live seats had them equal.
   */
  accountId: number;
  rsn: string;
  status: string;
  /** When the stats below were last observed. Null if we've never successfully fetched them. */
  statsAt: string | null;
  efficiency: EfficiencyResult | null;
  skills: SkillRow[];
  bosses: BossRow[];
  /** Clues, minigames and collection-log slots. Every activity the account has anything on. */
  activities: ActivityRow[];
  totalLevel: number;
  combatLevel: number | null;
}

export interface MemberProfile extends AccountProfile {
  /** The SEAT — this person's place on THIS clan's roster. What clan_member_id columns point at. */
  id: number;
  /** In-game clan rank, as this clan's roster reported it. */
  rank: string | null;
  isGuest: boolean;
  joinedAt: string;
  leftAt: string | null;
}

/**
 * A member's last known snapshot. Prefers the member-level blob the sweep keeps, and falls back to a
 * competition snapshot for members last seen before that column existed — so profiles aren't blank
 * for everyone until the roster has cycled through a sweep.
 */
async function lastSnapshotFor(member: {
  id: number;
  accountId: number;
  statsLastSnapshot: string | null;
}): Promise<{
  snapshot: HiscoresSnapshot | null;
  at: string | null;
}> {
  if (member.statsLastSnapshot) {
    try {
      return { snapshot: JSON.parse(member.statsLastSnapshot) as HiscoresSnapshot, at: null };
    } catch {
      /* fall through to the older store */
    }
  }
  // The ACCOUNT again. `member.id` is the seat, and this is the fallback path for a member whose
  // inline snapshot is missing — so the older store quietly answered with another character's.
  const row = await db.query.playerSnapshots.findFirst({
    where: eq(playerSnapshots.accountId, member.accountId),
    orderBy: [desc(playerSnapshots.capturedAt)],
  });
  if (!row?.payload) return { snapshot: null, at: null };
  try {
    return { snapshot: JSON.parse(row.payload) as HiscoresSnapshot, at: row.capturedAt };
  } catch {
    return { snapshot: null, at: null };
  }
}

/** Combat level from the snapshot, or null when the skills needed aren't present. */
function combatLevelFrom(snapshot: HiscoresSnapshot): number | null {
  const lvl = (k: string) => snapshot.skills?.[k]?.level ?? 0;
  const [attack, strength, defence, hitpoints, ranged, prayer, magic] = [
    'attack', 'strength', 'defence', 'hitpoints', 'ranged', 'prayer', 'magic',
  ].map(lvl);
  if (!hitpoints) return null;
  const base = 0.25 * (defence + hitpoints + Math.floor(prayer / 2));
  const melee = 0.325 * (attack + strength);
  const range = 0.325 * (Math.floor(ranged / 2) + ranged);
  const mage = 0.325 * (Math.floor(magic / 2) + magic);
  return Math.floor(base + Math.max(melee, range, mage));
}

/**
 * One character's profile, straight from the account — no clan, no seat.
 *
 * The apex's version of `getMemberProfile`. Same pipeline, same snapshot, same numbers: it is the
 * account row that carries `statsLastSnapshot`, so a clan was never actually needed to produce any
 * of this. The clan was only ever needed to say which ROSTER the character sits on.
 */
export async function getAccountProfile(accountId: number): Promise<AccountProfile | null> {
  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, accountId) });
  if (!account) return null;
  return accountProfileFrom({
    accountId: account.id,
    rsn: account.rsn,
    status: account.status,
    liveStatsAt: account.liveStatsAt,
    statsLastSnapshot: account.statsLastSnapshot,
  });
}

/** The shared half: everything derivable from an account's last snapshot. */
async function accountProfileFrom(row: {
  accountId: number;
  rsn: string;
  status: string;
  liveStatsAt: string | null;
  statsLastSnapshot: string | null;
}): Promise<AccountProfile> {
  const { snapshot, at } = await lastSnapshotFor({
    id: row.accountId,
    accountId: row.accountId,
    statsLastSnapshot: row.statsLastSnapshot,
  });

  const base = {
    accountId: row.accountId,
    rsn: row.rsn,
    status: row.status,
  };

  if (!snapshot) {
    return {
      ...base,
      statsAt: null,
      efficiency: null,
      skills: [],
      bosses: [],
      activities: [],
      totalLevel: 0,
      combatLevel: null,
    };
  }

  const efficiency = computeEfficiency(snapshot);

  const skills: SkillRow[] = SKILLS.filter((k) => k !== 'overall').map((key) => ({
    key,
    level: snapshot.skills?.[key]?.level ?? 0,
    xp: Math.max(0, snapshot.skills?.[key]?.xp ?? 0),
    rank: snapshot.skills?.[key]?.rank ?? -1,
    ehp: efficiency.ehpBySkill[key] ?? 0,
  }));

  const bosses: BossRow[] = Object.entries(snapshot.bosses ?? {})
    .map(([key, entry]) => ({
      key,
      kc: Math.max(0, entry?.score ?? 0),
      rank: entry?.rank ?? -1,
      ehb: efficiency.ehbByBoss[key] ?? 0,
    }))
    .filter((b) => b.kc > 0)
    .sort((a, b) => b.ehb - a.ehb || b.kc - a.kc);

  // Declaration order, not score order: these are read as a fixed list of things ("how many elite
  // clues?"), so a member with no master clues should show a zero row where the reader expects it
  // rather than silently dropping the row and shifting everything up.
  const readings = readAllActivities(snapshot);
  const activities: ActivityRow[] = HISCORES_ACTIVITIES.map((a) => {
    const reading = readings[a.key];
    return {
      key: a.key,
      label: a.label,
      shortLabel: a.shortLabel ?? a.label,
      group: a.group,
      scale: a.scale,
      unit: a.unit ?? null,
      score: reading?.score ?? 0,
      rank: reading?.rank ?? null,
    };
  });

  return {
    ...base,
    statsAt: at ?? row.liveStatsAt ?? null,
    efficiency,
    skills,
    bosses,
    activities,
    totalLevel: snapshot.skills?.overall?.level ?? 0,
    combatLevel: combatLevelFrom(snapshot),
  };
}

/** Resolve a profile by RSN (case-insensitive), or null when no such member exists. */
export async function getMemberProfile(clanId: number, rsn: string): Promise<MemberProfile | null> {
  const normalized = normalizeRsn(rsn);
  if (!normalized) return null;

  // Scoped to the clan whose page this is. The same RSN is legitimately on other clans' rosters, and
  // an unscoped lookup would render another clan's member under this clan's banner.
  const member = await findRosterSeat(and(eq(clanRoster.clanId, clanId), eq(clanRoster.rsnNormalized, normalized)));
  if (!member) return null;

  // DELEGATES, so the two profiles cannot drift. Everything Jagex tracks comes off the account and is
  // built in one place; the clan adds only what a roster knows — the seat, the in-game rank, guest or
  // member, and the dates. Duplicating it would have left the apex and the clan as two
  // implementations of the same numbers, disagreeing eventually.
  const account = await accountProfileFrom({
    accountId: member.accountId,
    rsn: member.rsn,
    status: member.status,
    liveStatsAt: member.liveStatsAt,
    statsLastSnapshot: member.statsLastSnapshot,
  });

  return {
    ...account,
    id: member.id,
    rank: member.rank,
    isGuest: member.kind === 'guest',
    joinedAt: member.joinedAt,
    leftAt: member.leftAt,
  };
}


// ── History reads ────────────────────────────────────────────────────────────────────────────────

export interface DailyPoint {
  day: string;
  xpGained: number;
  ehpGained: number;
  ehbGained: number;
  overallXp: number;
}

/** The member's daily rows for the last N days, oldest first — the gained chart's series. */
/**
 * TAKES AN ACCOUNT ID. The parameter used to be called `clanMemberId`.
 *
 * That was not a naming nit, it was the bug. Every caller obediently passed a SEAT id, the query
 * below asks for `account_id`, and Postgres answered happily with somebody else's rows. On the
 * preview 456 of 456 live seats had an id that differed from their account's, so this was wrong for
 * every member on every profile: Drenvox mdps' page drew A Fish Taco's history, and Denoverse's drew
 * a blank, because the account whose id happened to match their seat had never been tracked.
 *
 * Nothing failed and nothing looked broken. Both ids are small positive integers from adjacent
 * sequences, so the wrong one is always a plausible answer — which is exactly why the name has to be
 * the true one.
 */
export async function getDailySeries(accountId: number, days = 90): Promise<DailyPoint[]> {
  const from = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const rows = await db
    .select()
    .from(memberDailyStats)
    .where(and(eq(memberDailyStats.accountId, accountId), gte(memberDailyStats.day, from)))
    .orderBy(memberDailyStats.day);

  // Densify: a day nobody played has no row, but it's a real zero, not a gap. Handing the sparse rows
  // straight to a chart would draw a fortnight of two good days as continuous activity, and would
  // slide a heatmap's calendar out of alignment.
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const start = rows.length > 0 && rows[0].day > from ? rows[0].day : from;
  const out: DailyPoint[] = [];
  for (let t = Date.parse(`${start}T00:00:00Z`); t <= Date.now(); t += 86_400_000) {
    const day = new Date(t).toISOString().slice(0, 10);
    const row = byDay.get(day);
    out.push({
      day,
      xpGained: row?.xpGained ?? 0,
      ehpGained: (row?.ehpMilliGained ?? 0) / EFFICIENCY_SCALE,
      ehbGained: (row?.ehbMilliGained ?? 0) / EFFICIENCY_SCALE,
      // Totals carry forward across idle days — a chart of absolute XP shouldn't drop to zero
      // because somebody took a Tuesday off.
      overallXp: row?.overallXp ?? out[out.length - 1]?.overallXp ?? 0,
    });
  }
  return out;
}

export interface MilestoneRow {
  kind: string;
  metric: string | null;
  threshold: number;
  noticedAt: string;
}

/**
 * TAKES AN ACCOUNT ID. The parameter used to be called `clanMemberId`.
 *
 * That was not a naming nit, it was the bug. Every caller obediently passed a SEAT id, the query
 * below asks for `account_id`, and Postgres answered happily with somebody else's rows. On the
 * preview 456 of 456 live seats had an id that differed from their account's, so this was wrong for
 * every member on every profile: Drenvox mdps' page drew A Fish Taco's history, and Denoverse's drew
 * a blank, because the account whose id happened to match their seat had never been tracked.
 *
 * Nothing failed and nothing looked broken. Both ids are small positive integers from adjacent
 * sequences, so the wrong one is always a plausible answer — which is exactly why the name has to be
 * the true one.
 */
export async function getMilestones(accountId: number, limit = 50): Promise<MilestoneRow[]> {
  const rows = await db
    .select()
    .from(memberMilestones)
    .where(eq(memberMilestones.accountId, accountId))
    .orderBy(desc(memberMilestones.noticedAt))
    .limit(limit);
  return rows.map((r) => ({ kind: r.kind, metric: r.metric, threshold: r.threshold, noticedAt: r.noticedAt }));
}

export interface PeriodRecord {
  period: 'day' | 'week' | 'month';
  metric: 'xp' | 'ehp' | 'ehb';
  value: number;
  /** The day the window ended — for a day record, the day itself. */
  endedOn: string;
}

/**
 * Best rolling day / week / month for each headline metric, computed from the daily rows rather than
 * maintained in a table. A year of history is ≤365 rows, so the windows are a scan over an array —
 * nothing to keep in sync, and no write cost on the hot path.
 */
/**
 * TAKES AN ACCOUNT ID. The parameter used to be called `clanMemberId`.
 *
 * That was not a naming nit, it was the bug. Every caller obediently passed a SEAT id, the query
 * below asks for `account_id`, and Postgres answered happily with somebody else's rows. On the
 * preview 456 of 456 live seats had an id that differed from their account's, so this was wrong for
 * every member on every profile: Drenvox mdps' page drew A Fish Taco's history, and Denoverse's drew
 * a blank, because the account whose id happened to match their seat had never been tracked.
 *
 * Nothing failed and nothing looked broken. Both ids are small positive integers from adjacent
 * sequences, so the wrong one is always a plausible answer — which is exactly why the name has to be
 * the true one.
 */
export async function getRecords(accountId: number): Promise<PeriodRecord[]> {
  const series = await getDailySeries(accountId, 3650);
  if (series.length === 0) return [];

  // Index by day so the windows can walk the calendar, not just the rows we happen to have — a gap
  // means zero gained, which matters when a 7-day window straddles days nobody played.
  const byDay = new Map(series.map((p) => [p.day, p]));
  const first = new Date(`${series[0].day}T00:00:00Z`).getTime();
  const last = new Date(`${series[series.length - 1].day}T00:00:00Z`).getTime();
  const dayKeys: string[] = [];
  for (let t = first; t <= last; t += 86_400_000) dayKeys.push(new Date(t).toISOString().slice(0, 10));

  const metrics: { metric: PeriodRecord['metric']; pick: (p: DailyPoint) => number }[] = [
    { metric: 'xp', pick: (p) => p.xpGained },
    { metric: 'ehp', pick: (p) => p.ehpGained },
    { metric: 'ehb', pick: (p) => p.ehbGained },
  ];
  const windows: { period: PeriodRecord['period']; size: number }[] = [
    { period: 'day', size: 1 },
    { period: 'week', size: 7 },
    { period: 'month', size: 30 },
  ];

  const out: PeriodRecord[] = [];
  for (const { metric, pick } of metrics) {
    const values = dayKeys.map((d) => {
      const point = byDay.get(d);
      return point ? pick(point) : 0;
    });
    for (const { period, size } of windows) {
      let best = 0;
      let bestEnd = dayKeys[0];
      let running = 0;
      for (let i = 0; i < values.length; i++) {
        running += values[i];
        if (i >= size) running -= values[i - size];
        if (running > best) {
          best = running;
          bestEnd = dayKeys[i];
        }
      }
      if (best > 0) out.push({ period, metric, value: best, endedOn: bestEnd });
    }
  }
  return out;
}

// ── Clan context ─────────────────────────────────────────────────────────────────────────────────

export interface Standing {
  rank: number;
  outOf: number;
}

export interface MemberStandings {
  ehp: Standing | null;
  ehb: Standing | null;
  xp: Standing | null;
}

/**
 * Where this member sits in the clan on each headline metric. A number on its own ("366 EHB") says
 * nothing to someone who doesn't already know what good looks like; "#3 of 47" does.
 */
export async function getStandings(clanMemberId: number): Promise<MemberStandings> {
  // "#3 of 47" only means anything within one clan, and the seat already names which one — so the
  // clan is derived here rather than threaded through every caller.
  const seat = await findRosterSeat(eq(clanRoster.id, clanMemberId));
  if (!seat) return { ehp: null, ehb: null, xp: null };
  const rows = await listMembers(seat.clanId);
  const rankIn = (pick: (r: MemberListRow) => number | null): Standing | null => {
    const ranked = rows.filter((r) => pick(r) !== null).sort((a, b) => (pick(b) ?? 0) - (pick(a) ?? 0));
    const index = ranked.findIndex((r) => r.id === clanMemberId);
    return index === -1 ? null : { rank: index + 1, outOf: ranked.length };
  };
  return { ehp: rankIn((r) => r.ehp), ehb: rankIn((r) => r.ehb), xp: rankIn((r) => r.overallXp) };
}

export interface RosterEvent {
  type: string;
  rsn: string;
  at: string;
  detail: string | null;
}

/**
 * The roster feed: who came, who went, and a few of the rank moves.
 *
 * Rank changes are capped rather than shown in full. One roster sync after a reshuffle writes a dozen
 * of them at the same timestamp, which buries the joins and leaves nobody wants to miss under a wall
 * of "imp → helper". Comings and goings are the point; rank churn is texture.
 */
export async function getRosterLog(clanId: number, limit = 25): Promise<RosterEvent[]> {
  const MAX_RANK_ROWS = 5;
  const rows = await db
    .select({
      eventType: clanAuditLog.eventType,
      occurredAt: clanAuditLog.occurredAt,
      oldValue: clanAuditLog.oldValue,
      newValue: clanAuditLog.newValue,
      rsn: clanRoster.rsn,
    })
    .from(clanAuditLog)
    // INNER, not LEFT: an entry whose seat is gone belongs to no clan, so it cannot be shown on any
    // clan's feed — and a left join would have let every clan's entries through the clan filter.
    .innerJoin(clanRoster, eq(clanAuditLog.clanMemberId, clanRoster.id))
    .where(
      and(
        eq(clanRoster.clanId, clanId),
        inArray(clanAuditLog.eventType, ['joined', 'left', 'returned', 'rank_changed', 'renamed']),
      ),
    )
    .orderBy(desc(clanAuditLog.occurredAt))
    // Over-fetch so the cap below still leaves a full feed of comings and goings.
    .limit(limit * 4);

  const readRank = (raw: string | null): string | null => {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as { rank?: string; rsn?: string };
      return parsed.rank ?? parsed.rsn ?? null;
    } catch {
      return null;
    }
  };

  let rankRows = 0;
  return rows
    .filter((r) => r.rsn && isPlausibleRsn(r.rsn))
    .filter((r) => {
      if (r.eventType !== 'rank_changed') return true;
      rankRows += 1;
      return rankRows <= MAX_RANK_ROWS;
    })
    .slice(0, limit)
    .map((r) => ({
      type: r.eventType,
      rsn: r.rsn as string,
      at: r.occurredAt,
      detail:
        r.eventType === 'rank_changed' || r.eventType === 'renamed'
          ? [readRank(r.oldValue), readRank(r.newValue)].filter(Boolean).join(' → ') || null
          : null,
    }));
}

export interface ClanAnalytics {
  memberCount: number;
  guestCount: number;
  totalEhp: number;
  totalEhb: number;
  /** Clan-wide gains per day for the last year — the activity pulse. */
  activity: { day: string; value: number }[];
  /** Who gained the most efficient hours over the last 7 days. */
  topWeek: { rsn: string; hours: number }[];
  activeThisWeek: number;
  /** Members with any gain on today's row — "playing today", as far as the sweep can tell. */
  activeToday: number;
}

/**
 * The clan at a glance. Two grouped queries over the daily rows rather than per-member work, so this
 * costs the same for a 40-member clan and a 400-member one.
 */
export async function getClanAnalytics(members: MemberListRow[]): Promise<ClanAnalytics> {
  const sinceYear = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

  const activityRows = await db
    .select({
      day: memberDailyStats.day,
      ehp: sql<number>`SUM(${memberDailyStats.ehpMilliGained})`,
      ehb: sql<number>`SUM(${memberDailyStats.ehbMilliGained})`,
    })
    .from(memberDailyStats)
    .where(gte(memberDailyStats.day, sinceYear))
    .groupBy(memberDailyStats.day)
    .orderBy(memberDailyStats.day);

  const today = new Date().toISOString().slice(0, 10);
  const weekRows = await db
    .select({
      clanMemberId: memberDailyStats.accountId,
      hours: sql<number>`SUM(${memberDailyStats.ehpMilliGained} + ${memberDailyStats.ehbMilliGained})`,
      // Today's slice of the same scan — one aggregate instead of a second round trip.
      todayHours: sql<number>`SUM(CASE WHEN ${memberDailyStats.day} = ${today} THEN ${memberDailyStats.ehpMilliGained} + ${memberDailyStats.ehbMilliGained} ELSE 0 END)`,
    })
    .from(memberDailyStats)
    .where(gte(memberDailyStats.day, since7))
    .groupBy(memberDailyStats.accountId);

  const nameById = new Map(members.map((m) => [m.id, m.rsn]));
  // Eight, not five: three go on the podium and the rest are the chasing pack under it.
  const topWeek = weekRows
    .filter((r) => nameById.has(r.clanMemberId) && r.hours > 0)
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 8)
    .map((r) => ({ rsn: nameById.get(r.clanMemberId) as string, hours: r.hours / EFFICIENCY_SCALE }));

  // Walk the calendar, not the rows: a day nobody played has no row, and a pulse chart that skipped
  // it would compress quiet weeks out of existence.
  const byDay = new Map(activityRows.map((r) => [r.day, (Number(r.ehp) + Number(r.ehb)) / EFFICIENCY_SCALE]));
  const activity: { day: string; value: number }[] = [];
  for (let i = 364; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    activity.push({ day, value: byDay.get(day) ?? 0 });
  }

  return {
    memberCount: members.filter((m) => !m.isGuest).length,
    guestCount: members.filter((m) => m.isGuest).length,
    totalEhp: members.reduce((sum, m) => sum + (m.ehp ?? 0), 0),
    totalEhb: members.reduce((sum, m) => sum + (m.ehb ?? 0), 0),
    activity,
    topWeek,
    activeThisWeek: weekRows.filter((r) => r.hours > 0).length,
    // Today's row only exists once the sweep has seen a gain today, so this is "played today" as
    // well as we can know it without a live heartbeat — and it reads as zero early in the morning,
    // which is honest rather than wrong.
    activeToday: weekRows.filter((r) => nameById.has(r.clanMemberId) && Number(r.todayHours) > 0).length,
  };
}

/**
 * Per-member movement for the roster: the last week as a sparkline, the streak, and how many places
 * they've climbed since last week.
 *
 * One grouped scan of the same daily rows the pulse chart already reads — no per-member query, so a
 * 400-member clan costs one statement. The position delta is DERIVED rather than stored: last week's
 * standing is this week's totals minus this week's gains, which the daily rows give us exactly. That
 * avoids a snapshot table whose only job would be remembering an ordering we can recompute.
 */
export interface RosterMovement {
  /** Efficient hours per day for the last 7 days, oldest first. */
  spark: number[];
  /** Hours gained across those 7 days. */
  week: number;
  /** Consecutive days with any gain, counting back from the last day that could have one. */
  streak: number;
  /** Places gained since last week on combined EHP + EHB. Positive = climbed, 0 = unchanged. */
  delta: number;
}

const SPARK_DAYS = 7;
const STREAK_LOOKBACK = 60;

export async function getRosterMovement(members: MemberListRow[]): Promise<Record<number, RosterMovement>> {
  const since = new Date(Date.now() - STREAK_LOOKBACK * 86_400_000).toISOString().slice(0, 10);

  const rows = await db
    .select({
      clanMemberId: memberDailyStats.accountId,
      day: memberDailyStats.day,
      gained: sql<number>`${memberDailyStats.ehpMilliGained} + ${memberDailyStats.ehbMilliGained}`,
    })
    .from(memberDailyStats)
    .where(gte(memberDailyStats.day, since));

  const byMember = new Map<number, Map<string, number>>();
  for (const r of rows) {
    const hours = Number(r.gained) / EFFICIENCY_SCALE;
    if (!(hours > 0)) continue;
    let days = byMember.get(r.clanMemberId);
    if (!days) byMember.set(r.clanMemberId, (days = new Map()));
    days.set(r.day, hours);
  }

  const dayAt = (back: number) => new Date(Date.now() - back * 86_400_000).toISOString().slice(0, 10);

  // Today's row is written by the sweep, so at 00:30 nobody has one yet. Anchoring the streak on
  // yesterday in that case stops every streak in the clan reading 0 for the first hours of the day.
  const anyToday = [...byMember.values()].some((days) => days.has(dayAt(0)));
  const anchor = anyToday ? 0 : 1;

  const out: Record<number, RosterMovement> = {};
  const weekByMember = new Map<number, number>();

  for (const m of members) {
    const days = byMember.get(m.id) ?? new Map<string, number>();

    const spark: number[] = [];
    for (let i = SPARK_DAYS - 1; i >= 0; i--) spark.push(days.get(dayAt(i)) ?? 0);
    const week = spark.reduce((sum, h) => sum + h, 0);
    weekByMember.set(m.id, week);

    let streak = 0;
    for (let i = anchor; i < STREAK_LOOKBACK; i++) {
      if (!days.has(dayAt(i))) break;
      streak++;
    }

    out[m.id] = { spark, week, streak, delta: 0 };
  }

  // Rank now and rank a week ago over the same set, then diff. Members we've never swept (no EHP)
  // sit out entirely — they have no position to move between.
  const ranked = members.filter((m) => m.ehp != null || m.ehb != null);
  const total = (m: MemberListRow) => (m.ehp ?? 0) + (m.ehb ?? 0);
  const positions = (score: (m: MemberListRow) => number) => {
    const order = [...ranked].sort((a, b) => score(b) - score(a) || a.rsn.localeCompare(b.rsn));
    return new Map(order.map((m, i) => [m.id, i + 1]));
  };
  const now = positions(total);
  const before = positions((m) => total(m) - (weekByMember.get(m.id) ?? 0));
  for (const m of ranked) {
    out[m.id].delta = (before.get(m.id) ?? 0) - (now.get(m.id) ?? 0);
  }

  return out;
}

// ── Activity analytics ───────────────────────────────────────────────────────────────────────────
//
// The clue, minigame and collection-log numbers, read clan-wide. Everything here comes off
// clan_members.stats_activities — the compact map the sweep derives — so this is one indexed scan
// and a few hundred bytes of JSON per member, never a full snapshot. Adding a leaderboard costs
// nothing extra; adding one that needed snapshots would cost megabytes a page load.

/** One member's entry on an activity board. */
export interface ActivityLeader {
  rsn: string;
  score: number;
  /** Hiscores position, for rank-scaled activities where the score isn't the interesting number. */
  rank: number | null;
}

export interface ActivityBoard {
  key: string;
  label: string;
  unit: string | null;
  scale: ActivityScale;
  rows: ActivityLeader[];
}

/** A fun title, awarded to whoever leads one activity. Cosmetic — nothing scores off these. */
export interface ActivityTitle {
  key: string;
  emoji: string;
  title: string;
  /** What earns it, in the third person: "Most caskets opened". */
  blurb: string;
  rsn: string;
  /** Already formatted for display, because a rank reads "#1,204" and a count reads "4,812". */
  value: string;
}

export interface ClanActivityAnalytics {
  /** How many members had any activity data at all — the denominator for "nobody has X yet". */
  tracked: number;
  totals: { caskets: number; clogSlots: number; rifts: number; zeal: number; glory: number };
  /** Clan-wide caskets per tier, hardest last. */
  clueMix: { key: string; label: string; count: number }[];
  titles: ActivityTitle[];
  boards: ActivityBoard[];
}

/** The named titles, in the order they're shown. `key` picks the activity that decides the winner. */
const ACTIVITY_TITLES: { key: string; emoji: string; title: string; blurb: string }[] = [
  { key: 'cluesAll', emoji: '🗺️', title: 'Clue Hunter', blurb: 'Most caskets opened' },
  { key: 'cluesMaster', emoji: '👑', title: 'Trailblazer', blurb: 'Most master clues' },
  { key: 'collectionsLogged', emoji: '📕', title: 'Completionist', blurb: 'Most collection log slots' },
  { key: 'colosseumGlory', emoji: '⚔️', title: 'Gladiator', blurb: 'Highest Colosseum glory' },
  { key: 'riftsClosed', emoji: '🌀', title: 'Rift Closer', blurb: 'Most rifts closed' },
  { key: 'soulWarsZeal', emoji: '💀', title: 'Zealot', blurb: 'Most Soul Wars zeal' },
  { key: 'lastManStanding', emoji: '🎯', title: 'Last One Standing', blurb: 'Best LMS rank' },
  { key: 'bhHunter', emoji: '🩸', title: 'Bounty Hunter', blurb: 'Best Bounty Hunter rank' },
];

/**
 * Boards worth showing in full, as opposed to just naming a winner.
 *
 * `label` overrides the activity's own name where the picker-friendly one reads badly as a heading —
 * "Bounty Hunter (hunter)" is precise in a tile dropdown and clumsy as a leaderboard title.
 *
 * Boards with no qualifying member are dropped downstream, so listing both Bounty Hunter modes costs
 * a clan that only plays one of them exactly nothing.
 */
const ACTIVITY_BOARDS: { key: string; label?: string }[] = [
  { key: 'cluesAll' },
  { key: 'collectionsLogged' },
  { key: 'cluesMaster' },
  { key: 'riftsClosed' },
  { key: 'bhHunter', label: 'Bounty Hunter' },
  { key: 'bhRogue', label: 'Bounty Hunter — Rogue' },
];

const BOARD_SIZE = 8;

/** Every non-departed member's activity map, with their name. One query, small blobs. */
async function readClanActivities(clanId: number): Promise<{ rsn: string; activities: Record<string, ActivityReading> }[]> {
  const rows = await db
    .select({
      rsn: clanRoster.rsn,
      statsActivities: clanRoster.statsActivities,
    })
    .from(clanRoster)
    .where(and(eq(clanRoster.clanId, clanId), isNull(clanRoster.leftAt)));

  return rows
    .filter((r) => isPlausibleRsn(r.rsn) && r.statsActivities)
    .map((r) => ({ rsn: r.rsn, activities: parseActivityBlob(r.statsActivities) }));
}

/**
 * Order members for one activity, best first.
 *
 * A count sorts high-to-low. A RANK sorts low-to-high with unranked excluded entirely, because
 * hiscores rank 1 is the best in the game — sorting those like counts would put the clan's best
 * PKer last and someone who has never entered the arena first.
 */
function rankFor(
  rows: { rsn: string; activities: Record<string, ActivityReading> }[],
  key: string,
): ActivityLeader[] {
  const activity = activityFor(key);
  if (!activity) return [];
  const entries = rows
    .map((r) => ({ rsn: r.rsn, score: r.activities[key]?.score ?? 0, rank: r.activities[key]?.rank ?? null }))
    .filter((e) => (activity.scale === 'rank' ? e.rank != null : e.score > 0));

  entries.sort((a, b) =>
    activity.scale === 'rank' ? (a.rank as number) - (b.rank as number) : b.score - a.score || a.rsn.localeCompare(b.rsn),
  );
  return entries;
}

/** The clan's clues, minigames and collection logs, plus the fun titles that fall out of them. */
export async function getClanActivityAnalytics(clanId: number): Promise<ClanActivityAnalytics> {
  const rows = await readClanActivities(clanId);

  const sum = (key: string) => rows.reduce((total, r) => total + (r.activities[key]?.score ?? 0), 0);

  const clueMix = CLUE_TIER_KEYS.map((key) => ({
    key,
    label: activityFor(key)?.shortLabel ?? key,
    count: sum(key),
  }));

  const titles: ActivityTitle[] = [];
  for (const t of ACTIVITY_TITLES) {
    const leader = rankFor(rows, t.key)[0];
    if (!leader) continue; // nobody in the clan has touched it — no title rather than an empty one
    const scale = activityFor(t.key)?.scale ?? 'count';
    titles.push({
      key: t.key,
      emoji: t.emoji,
      title: t.title,
      blurb: t.blurb,
      rsn: leader.rsn,
      value: scale === 'rank' ? `#${(leader.rank ?? 0).toLocaleString()}` : leader.score.toLocaleString(),
    });
  }

  const boards: ActivityBoard[] = ACTIVITY_BOARDS.map(({ key, label }) => {
    const activity = activityFor(key);
    return {
      key,
      label: label ?? activity?.label ?? key,
      unit: activity?.unit ?? null,
      scale: activity?.scale ?? 'count',
      rows: rankFor(rows, key).slice(0, BOARD_SIZE),
    };
  }).filter((b) => b.rows.length > 0);

  return {
    tracked: rows.length,
    totals: {
      caskets: sum('cluesAll'),
      clogSlots: sum('collectionsLogged'),
      rifts: sum('riftsClosed'),
      zeal: sum('soulWarsZeal'),
      glory: sum('colosseumGlory'),
    },
    clueMix,
    titles,
    boards,
  };
}

/** Where one member sits in the clan for an activity, out of everyone who has any. */
export interface ActivityStanding {
  key: string;
  position: number;
  of: number;
}

/**
 * A member's clan placing for every activity they have something on.
 *
 * "#3 of 41" is the number that makes a raw casket count mean something, and it's the reason the
 * derived blob exists — the alternative was parsing the whole roster's snapshots to render one
 * profile. Activities nobody in the clan has are simply absent.
 */
export async function getActivityStandings(clanId: number, rsn: string): Promise<Record<string, ActivityStanding>> {
  const normalized = normalizeRsn(rsn);
  if (!normalized) return {};
  const rows = await readClanActivities(clanId);

  const out: Record<string, ActivityStanding> = {};
  for (const activity of HISCORES_ACTIVITIES) {
    const ordered = rankFor(rows, activity.key);
    if (ordered.length === 0) continue;
    const index = ordered.findIndex((e) => normalizeRsn(e.rsn) === normalized);
    if (index < 0) continue; // they have none of it — no placing to report
    out[activity.key] = { key: activity.key, position: index + 1, of: ordered.length };
  }
  return out;
}

// ── Competition history ──────────────────────────────────────────────────────────────────────────

export interface EventResult {
  eventId: number;
  name: string;
  endedOn: string | null;
  /** Null when the format doesn't score points (a tile race is about order, not totals). */
  points: number | null;
  tiles: number | null;
  teamRank: number | null;
  teamsTotal: number | null;
  format: string | null;
}

/** Formats where a points total is a meaningful thing to show. */
function scoresPoints(format: string | null): boolean {
  return format !== 'race';
}

export interface WeeklyResult {
  competitionId: number;
  title: string;
  metric: string;
  type: string;
  endedOn: string;
  gained: number;
  rank: number;
  entrants: number;
}

export interface CompetitionHistory {
  events: EventResult[];
  weeklies: WeeklyResult[];
  eventWins: number;
  eventPodiums: number;
  weeklyWins: number;
  weeklyPodiums: number;
  totalPoints: number;
}

/**
 * Everything this member has actually competed in, and how it went.
 *
 * Bingo results come from player_event_facts, which is written once per person per finished event —
 * so this is a read, not a re-derivation of scoring. Weekly placings are computed from the standings
 * of the comps they entered, since a weekly's result isn't materialised anywhere: one grouped query
 * over the participants of those comps, not a query per competition.
 */
export async function getCompetitionHistory(clanMemberId: number, rsn: string): Promise<CompetitionHistory> {
  // Events come from ENROLLMENT, not from player_event_facts.
  //
  // Facts are computed when an event ends, so a bingo that finished before that machinery existed
  // (or was never backfilled) has none — which reads as "0 events played" for someone with years of
  // history. Enrollment always exists; facts then enrich the row with points and the team's finish
  // where they're available.
  //
  // Matched by clan_member_id OR any name this member has been known by, because a rename mid-history
  // leaves old `players` rows carrying the old RSN.
  const member = await findRosterSeat(eq(clanRoster.id, clanMemberId));
  const aliases = new Set<string>([normalizeRsn(rsn)]);
  if (member?.rsn) aliases.add(normalizeRsn(member.rsn));
  try {
    const prev = JSON.parse(member?.previousRsns ?? '[]');
    if (Array.isArray(prev)) for (const p of prev) aliases.add(normalizeRsn(String(p)));
  } catch {
    /* a malformed alias list shouldn't cost someone their history */
  }

  const enrolled = await db
    .select({
      eventId: eventParticipants.eventId,
      playerName: eventParticipants.name,
      playerClanMemberId: eventParticipants.clanMemberId,
      name: events.name,
      endDate: events.endDate,
      format: events.format,
    })
    .from(eventParticipants)
    .innerJoin(events, eq(eventParticipants.eventId, events.id))
    .orderBy(desc(events.endDate));

  const mineEvents = enrolled.filter(
    (e) => e.playerClanMemberId === clanMemberId || aliases.has(normalizeRsn(e.playerName)),
  );

  // Facts for this member across ALL events, not just the enrolled ones: a player row can be dropped
  // from an event afterwards (the admin "remove from event" path) while the fact of having played it
  // survives. Enrollment ∪ facts is the set that can't lose an event either way.
  const factRows = await db
    .select({
      eventId: playerEventFacts.eventId,
      rsn: playerEventFacts.rsn,
      clanMemberId: playerEventFacts.clanMemberId,
      points: playerEventFacts.points,
      tilesContributed: playerEventFacts.tilesContributed,
      teamRank: playerEventFacts.teamRank,
      teamsTotal: playerEventFacts.teamsTotal,
      name: events.name,
      endDate: events.endDate,
      format: events.format,
    })
    .from(playerEventFacts)
    .innerJoin(events, eq(playerEventFacts.eventId, events.id));
  const factFor = new Map(
    factRows
      .filter((f) => f.clanMemberId === clanMemberId || aliases.has(normalizeRsn(f.rsn)))
      .map((f) => [f.eventId, f]),
  );

  const seen = new Set<number>();
  const eventResults: EventResult[] = [];
  for (const e of mineEvents) {
    if (seen.has(e.eventId)) continue; // an alt row for the same event mustn't double-count
    seen.add(e.eventId);
    const fact = factFor.get(e.eventId);
    eventResults.push({
      eventId: e.eventId,
      name: e.name,
      endedOn: e.endDate,
      // Race and other non-scoring formats have no points — null renders as "—" rather than a zero
      // that reads like they turned up and did nothing.
      points: scoresPoints(e.format) ? (fact?.points ?? null) : null,
      tiles: fact?.tilesContributed ?? null,
      teamRank: fact?.teamRank ?? null,
      teamsTotal: fact?.teamsTotal ?? null,
      format: e.format,
    });
  }

  for (const fact of factFor.values()) {
    if (seen.has(fact.eventId)) continue;
    seen.add(fact.eventId);
    eventResults.push({
      eventId: fact.eventId,
      name: fact.name,
      endedOn: fact.endDate,
      points: scoresPoints(fact.format) ? fact.points : null,
      tiles: fact.tilesContributed,
      teamRank: fact.teamRank,
      teamsTotal: fact.teamsTotal,
      format: fact.format,
    });
  }
  eventResults.sort((a, b) => (b.endedOn ?? '').localeCompare(a.endedOn ?? ''));



  // Weeklies: find the finished comps this member took part in, then rank them within each.
  const mine = await db
    .select({
      competitionId: weeklyParticipants.competitionId,
      baselineValue: weeklyParticipants.baselineValue,
      currentValue: weeklyParticipants.currentValue,
      title: weeklyCompetitions.title,
      metric: weeklyCompetitions.metric,
      type: weeklyCompetitions.type,
      endDate: weeklyCompetitions.endDate,
      status: weeklyCompetitions.status,
    })
    .from(weeklyParticipants)
    .innerJoin(weeklyCompetitions, eq(weeklyParticipants.competitionId, weeklyCompetitions.id))
    .where(eq(weeklyParticipants.clanMemberId, clanMemberId));

  const finished = mine.filter((m) => m.status === 'completed');
  const weeklies: WeeklyResult[] = [];
  if (finished.length > 0) {
    const compIds = finished.map((m) => m.competitionId);
    const allParticipants = await db
      .select({
        competitionId: weeklyParticipants.competitionId,
        clanMemberId: weeklyParticipants.clanMemberId,
        rsn: weeklyParticipants.rsn,
        baselineValue: weeklyParticipants.baselineValue,
        currentValue: weeklyParticipants.currentValue,
      })
      .from(weeklyParticipants)
      .where(inArray(weeklyParticipants.competitionId, compIds));

    const byComp = new Map<number, typeof allParticipants>();
    for (const p of allParticipants) {
      const list = byComp.get(p.competitionId) ?? [];
      list.push(p);
      byComp.set(p.competitionId, list);
    }

    for (const comp of finished) {
      const field = (byComp.get(comp.competitionId) ?? [])
        .map((p) => ({
          ...p,
          gained: (p.currentValue ?? 0) - (p.baselineValue ?? 0),
        }))
        // Only entrants who actually moved are ranked — a comp of 80 enrolled and 6 active shouldn't
        // report "8th of 80" as if 74 people were beaten.
        .filter((p) => p.gained > 0)
        .sort((a, b) => b.gained - a.gained);
      const index = field.findIndex((p) => p.clanMemberId === clanMemberId || normalizeRsn(p.rsn) === normalizeRsn(rsn));
      if (index === -1) continue; // entered but never scored
      weeklies.push({
        competitionId: comp.competitionId,
        title: comp.title,
        metric: comp.metric,
        type: comp.type,
        endedOn: comp.endDate,
        gained: field[index].gained,
        rank: index + 1,
        entrants: field.length,
      });
    }
    weeklies.sort((a, b) => b.endedOn.localeCompare(a.endedOn));
  }

  return {
    events: eventResults,
    weeklies,
    eventWins: eventResults.filter((e) => e.teamRank === 1).length,
    eventPodiums: eventResults.filter((e) => e.teamRank !== null && e.teamRank <= 3).length,
    weeklyWins: weeklies.filter((w) => w.rank === 1).length,
    weeklyPodiums: weeklies.filter((w) => w.rank <= 3).length,
    totalPoints: eventResults.reduce((sum, e) => sum + (e.points ?? 0), 0),
  };
}

// ── Personas (one human, several accounts) ───────────────────────────────────────────────────────

export interface PersonaAccount {
  id: number;
  rsn: string;
  isPrimary: boolean;
  ehp: number | null;
  ehb: number | null;
  overallXp: number | null;
}

export interface Persona {
  userId: number;
  discordId: string | null;
  discordUsername: string | null;
  discordAvatar: string | null;
  accounts: PersonaAccount[];
  totalEhp: number;
  totalEhb: number;
  totalXp: number;
}

/**
 * The person behind an account, and every other account they've linked.
 *
 * Grouping is by users.id — i.e. by LINKED DISCORD — and nothing else. Guessing at alts from name
 * similarity or shared play patterns would eventually merge two different people, which is the one
 * mistake this feature can't make. Accounts that never linked stay separate, correctly.
 *
 * Returns null when the member has no linked account or is the only one on it: a "persona" of one is
 * just the profile you're already looking at.
 */
export async function getPersona(clanMemberId: number): Promise<Persona | null> {
  const member = await findRosterSeat(eq(clanRoster.id, clanMemberId));
  if (!member?.playerId) return null;

  // THE SAME MISTAKE IN THE OTHER PAIR OF ID SPACES. `member.playerId` names a PERSON; `users.id`
  // names a LOGIN. Matching one against the other returns whichever unrelated account happens to
  // share the number — so a member's persona could carry a stranger's display name. The login that
  // belongs to a person is the one whose `playerId` points back at them.
  const user = await db.query.users.findFirst({ where: eq(users.playerId, member.playerId) });
  const rows = await listMembers(member.clanId);
  const siblings = await db
    .select({ id: clanRoster.id, rsn: clanRoster.rsn, isPrimary: clanRoster.isPrimary })
    .from(clanRoster)
    // This clan's seats only. Someone's alts in another clan are that clan's business, and naming
    // them here would out a person's other accounts to a clan they never joined.
    .where(
      and(
        eq(clanRoster.clanId, member.clanId),
        eq(clanRoster.playerId, member.playerId),
        isNull(clanRoster.leftAt),
      ),
    );
  if (siblings.length <= 1) return null;

  const statsById = new Map(rows.map((r) => [r.id, r]));
  const accounts: PersonaAccount[] = siblings
    .map((sib) => {
      const stats = statsById.get(sib.id);
      return {
        id: sib.id,
        rsn: sib.rsn,
        isPrimary: sib.isPrimary === 1,
        ehp: stats?.ehp ?? null,
        ehb: stats?.ehb ?? null,
        overallXp: stats?.overallXp ?? null,
      };
    })
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || (b.ehp ?? 0) - (a.ehp ?? 0));

  return {
    userId: member.playerId,
    discordId: user?.discordId ?? null,
    discordUsername: user?.discordUsername ?? null,
    discordAvatar: user?.discordAvatar ?? null,
    accounts,
    // Summed, not averaged: hours spent on an alt are still hours this person played.
    totalEhp: accounts.reduce((sum, a) => sum + (a.ehp ?? 0), 0),
    totalEhb: accounts.reduce((sum, a) => sum + (a.ehb ?? 0), 0),
    totalXp: accounts.reduce((sum, a) => sum + (a.overallXp ?? 0), 0),
  };
}

// ── Milestones in reach ──────────────────────────────────────────────────────────────────────────

export interface UpcomingMilestone {
  label: string;
  remaining: string;
  progress: number;
}

/**
 * What this member is closest to earning. The milestone log only ever looks backwards; the question
 * a player actually asks is "what am I near?".
 */
export function getUpcomingMilestones(profile: AccountProfile, limit = 6): UpcomingMilestone[] {
  const out: UpcomingMilestone[] = [];
  const XP_STEPS = [10_000_000, 25_000_000, 50_000_000, 100_000_000, 200_000_000];
  const KC_STEPS = [100, 500, 1_000, 2_500, 5_000, 10_000, 25_000];

  for (const skill of profile.skills) {
    if (skill.xp <= 0) continue;
    if (skill.level < 99) {
      const p = progressToLevel(skill.xp, 99);
      out.push({
        label: `99 ${SKILL_LABELS[skill.key] ?? skill.key}`,
        remaining: `${fmtCompact(p.xpToNext)} XP`,
        progress: p.progress,
      });
    }
    const nextXp = XP_STEPS.find((t) => skill.xp < t);
    if (nextXp) {
      out.push({
        label: `${fmtCompact(nextXp)} ${SKILL_LABELS[skill.key] ?? skill.key} XP`,
        remaining: `${fmtCompact(nextXp - skill.xp)} XP`,
        progress: skill.xp / nextXp,
      });
    }
  }

  // Boss keys are hiscores identifiers, not names: without this the card read
  // "100 daggannothSupreme" instead of "100 Dagannoth Supreme kills".
  const bossLabel = new Map(BOSSES.map((b) => [b.key, b.label]));
  for (const boss of profile.bosses) {
    const nextKc = KC_STEPS.find((t) => boss.kc < t);
    if (!nextKc) continue;
    out.push({
      label: `${nextKc.toLocaleString()} ${bossLabel.get(boss.key) ?? boss.key} kills`,
      remaining: `${(nextKc - boss.kc).toLocaleString()} kills`,
      progress: boss.kc / nextKc,
    });
  }

  return out.sort((a, b) => b.progress - a.progress).slice(0, limit);
}

/** Short number for a milestone label — 13.0M rather than 13,034,431. */
function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}
