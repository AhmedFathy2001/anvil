// Reads behind the public member directory and player profiles.
//
// Everything here is served from stats we ALREADY hold — the sweep's last snapshot, the daily rollup
// rows, the milestone log. Opening a profile never triggers a hiscores fetch, which is what keeps a
// page anyone can link to from becoming a way to hammer Jagex on our behalf.

import { db } from '@/db';
import { clanMembers, memberDailyStats, memberMilestones, playerSnapshots } from '@/db/schema';
import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import type { HiscoresSnapshot } from '@/lib/hiscores';
import { computeEfficiency, type EfficiencyResult } from '@/lib/efficiency';
import { SKILLS, EFFICIENCY_SCALE } from '@/lib/constants';
import { normalizeRsn } from '@/lib/auth';

export interface MemberListRow {
  id: number;
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
export async function listMembers(): Promise<MemberListRow[]> {
  // The member's newest daily row carries their latest totals. A correlated subquery keeps this to a
  // single statement rather than a query per member.
  const latestDay = db
    .select({
      clanMemberId: memberDailyStats.clanMemberId,
      day: sql<string>`MAX(${memberDailyStats.day})`.as('latest_day'),
    })
    .from(memberDailyStats)
    .groupBy(memberDailyStats.clanMemberId)
    .as('latest_day_per_member');

  const rows = await db
    .select({
      id: clanMembers.id,
      rsn: clanMembers.rsn,
      rank: clanMembers.rank,
      isGuest: clanMembers.isGuest,
      status: clanMembers.status,
      lastSeenAt: clanMembers.lastSeenInClan,
      overallXp: memberDailyStats.overallXp,
      ehpMilli: memberDailyStats.ehpMilli,
      ehbMilli: memberDailyStats.ehbMilli,
    })
    .from(clanMembers)
    .leftJoin(latestDay, eq(latestDay.clanMemberId, clanMembers.id))
    .leftJoin(
      memberDailyStats,
      and(eq(memberDailyStats.clanMemberId, clanMembers.id), eq(memberDailyStats.day, latestDay.day)),
    )
    // Members who left the clan drop off the directory; the profile page still resolves by name so
    // old links and event recaps don't 404.
    .where(isNull(clanMembers.leftAt))
    .orderBy(clanMembers.rsn);

  return rows.map((r) => ({
    id: r.id,
    rsn: r.rsn,
    rank: r.rank,
    isGuest: r.isGuest === 1,
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

export interface MemberProfile {
  id: number;
  rsn: string;
  rank: string | null;
  isGuest: boolean;
  status: string;
  joinedAt: string;
  leftAt: string | null;
  /** When the stats below were last observed. Null if we've never successfully fetched them. */
  statsAt: string | null;
  efficiency: EfficiencyResult | null;
  skills: SkillRow[];
  bosses: BossRow[];
  totalLevel: number;
  combatLevel: number | null;
}

/**
 * A member's last known snapshot. Prefers the member-level blob the sweep keeps, and falls back to a
 * competition snapshot for members last seen before that column existed — so profiles aren't blank
 * for everyone until the roster has cycled through a sweep.
 */
async function lastSnapshotFor(member: { id: number; statsLastSnapshot: string | null }): Promise<{
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
  const row = await db.query.playerSnapshots.findFirst({
    where: eq(playerSnapshots.clanMemberId, member.id),
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

/** Resolve a profile by RSN (case-insensitive), or null when no such member exists. */
export async function getMemberProfile(rsn: string): Promise<MemberProfile | null> {
  const normalized = normalizeRsn(rsn);
  if (!normalized) return null;

  const member = await db.query.clanMembers.findFirst({
    where: eq(clanMembers.rsnNormalized, normalized),
  });
  if (!member) return null;

  const { snapshot, at } = await lastSnapshotFor(member);
  if (!snapshot) {
    return {
      id: member.id,
      rsn: member.rsn,
      rank: member.rank,
      isGuest: member.isGuest === 1,
      status: member.status,
      joinedAt: member.joinedAt,
      leftAt: member.leftAt,
      statsAt: null,
      efficiency: null,
      skills: [],
      bosses: [],
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

  return {
    id: member.id,
    rsn: member.rsn,
    rank: member.rank,
    isGuest: member.isGuest === 1,
    status: member.status,
    joinedAt: member.joinedAt,
    leftAt: member.leftAt,
    statsAt: at ?? member.liveStatsAt ?? null,
    efficiency,
    skills,
    bosses,
    totalLevel: snapshot.skills?.overall?.level ?? 0,
    combatLevel: combatLevelFrom(snapshot),
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
export async function getDailySeries(clanMemberId: number, days = 90): Promise<DailyPoint[]> {
  const from = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const rows = await db
    .select()
    .from(memberDailyStats)
    .where(and(eq(memberDailyStats.clanMemberId, clanMemberId), gte(memberDailyStats.day, from)))
    .orderBy(memberDailyStats.day);

  return rows.map((r) => ({
    day: r.day,
    xpGained: r.xpGained,
    ehpGained: r.ehpMilliGained / EFFICIENCY_SCALE,
    ehbGained: r.ehbMilliGained / EFFICIENCY_SCALE,
    overallXp: r.overallXp,
  }));
}

export interface MilestoneRow {
  kind: string;
  metric: string | null;
  threshold: number;
  noticedAt: string;
}

export async function getMilestones(clanMemberId: number, limit = 50): Promise<MilestoneRow[]> {
  const rows = await db
    .select()
    .from(memberMilestones)
    .where(eq(memberMilestones.clanMemberId, clanMemberId))
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
export async function getRecords(clanMemberId: number): Promise<PeriodRecord[]> {
  const series = await getDailySeries(clanMemberId, 3650);
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
