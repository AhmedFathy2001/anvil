// Reads behind the public member directory and player profiles.
//
// Everything here is served from stats we ALREADY hold — the sweep's last snapshot, the daily rollup
// rows, the milestone log. Opening a profile never triggers a hiscores fetch, which is what keeps a
// page anyone can link to from becoming a way to hammer Jagex on our behalf.

import { db } from '@/db';
import {
  clanAuditLog,
  clanMembers,
  events,
  memberDailyStats,
  memberMilestones,
  playerEventFacts,
  playerSnapshots,
  weeklyCompetitions,
  weeklyParticipants,
} from '@/db/schema';
import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import type { HiscoresSnapshot } from '@/lib/hiscores';
import { computeEfficiency, type EfficiencyResult } from '@/lib/efficiency';
import { SKILLS, EFFICIENCY_SCALE } from '@/lib/constants';
import { isPlausibleRsn, normalizeRsn } from '@/lib/auth';

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

  return rows
    // Placeholder rows RuneLite handed us before the sync learned to reject them ("#Player1404"):
    // never on the hiscores, never a stat, pure noise in a roster view. Filtered on read rather than
    // deleted — removing member rows is the operator's call, not a side effect of listing them.
    .filter((r) => isPlausibleRsn(r.rsn))
    .map((r) => ({
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
  const rows = await listMembers();
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
export async function getRosterLog(limit = 25): Promise<RosterEvent[]> {
  const MAX_RANK_ROWS = 5;
  const rows = await db
    .select({
      eventType: clanAuditLog.eventType,
      occurredAt: clanAuditLog.occurredAt,
      oldValue: clanAuditLog.oldValue,
      newValue: clanAuditLog.newValue,
      rsn: clanMembers.rsn,
    })
    .from(clanAuditLog)
    .leftJoin(clanMembers, eq(clanAuditLog.clanMemberId, clanMembers.id))
    .where(inArray(clanAuditLog.eventType, ['joined', 'left', 'returned', 'rank_changed', 'renamed']))
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
  /** Clan-wide gains per day for the last 90 days — the activity pulse. */
  activity: { day: string; value: number }[];
  /** Who gained the most efficient hours over the last 7 days. */
  topWeek: { rsn: string; hours: number }[];
  activeThisWeek: number;
}

/**
 * The clan at a glance. Two grouped queries over the daily rows rather than per-member work, so this
 * costs the same for a 40-member clan and a 400-member one.
 */
export async function getClanAnalytics(members: MemberListRow[]): Promise<ClanAnalytics> {
  const since90 = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

  const activityRows = await db
    .select({
      day: memberDailyStats.day,
      ehp: sql<number>`SUM(${memberDailyStats.ehpMilliGained})`,
      ehb: sql<number>`SUM(${memberDailyStats.ehbMilliGained})`,
    })
    .from(memberDailyStats)
    .where(gte(memberDailyStats.day, since90))
    .groupBy(memberDailyStats.day)
    .orderBy(memberDailyStats.day);

  const weekRows = await db
    .select({
      clanMemberId: memberDailyStats.clanMemberId,
      hours: sql<number>`SUM(${memberDailyStats.ehpMilliGained} + ${memberDailyStats.ehbMilliGained})`,
    })
    .from(memberDailyStats)
    .where(gte(memberDailyStats.day, since7))
    .groupBy(memberDailyStats.clanMemberId);

  const nameById = new Map(members.map((m) => [m.id, m.rsn]));
  const topWeek = weekRows
    .filter((r) => nameById.has(r.clanMemberId) && r.hours > 0)
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 5)
    .map((r) => ({ rsn: nameById.get(r.clanMemberId) as string, hours: r.hours / EFFICIENCY_SCALE }));

  // Walk the calendar, not the rows: a day nobody played has no row, and a pulse chart that skipped
  // it would compress quiet weeks out of existence.
  const byDay = new Map(activityRows.map((r) => [r.day, (Number(r.ehp) + Number(r.ehb)) / EFFICIENCY_SCALE]));
  const activity: { day: string; value: number }[] = [];
  for (let i = 89; i >= 0; i--) {
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
  };
}

// ── Competition history ──────────────────────────────────────────────────────────────────────────

export interface EventResult {
  eventId: number;
  name: string;
  endedOn: string | null;
  points: number;
  tiles: number;
  teamRank: number | null;
  teamsTotal: number | null;
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
  const factRows = await db
    .select({
      eventId: playerEventFacts.eventId,
      points: playerEventFacts.points,
      tiles: playerEventFacts.tilesContributed,
      teamRank: playerEventFacts.teamRank,
      teamsTotal: playerEventFacts.teamsTotal,
      name: events.name,
      endDate: events.endDate,
    })
    .from(playerEventFacts)
    .innerJoin(events, eq(playerEventFacts.eventId, events.id))
    .where(eq(playerEventFacts.clanMemberId, clanMemberId))
    .orderBy(desc(events.endDate));

  const eventResults: EventResult[] = factRows.map((r) => ({
    eventId: r.eventId,
    name: r.name,
    endedOn: r.endDate,
    points: r.points,
    tiles: r.tiles,
    teamRank: r.teamRank,
    teamsTotal: r.teamsTotal,
  }));

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
    totalPoints: eventResults.reduce((sum, e) => sum + e.points, 0),
  };
}
