// The parts of the apex home that are about YOU rather than about what needs clicking.
//
// The page used to be three lists — clans, sign-ups, characters — each the same size, which meant it
// answered "what should I do" and never "how am I doing". Between events that is an empty page, and
// between events is most weeks.
//
// Everything here comes from rows that already exist. Nothing new is tracked, and nothing is written.

import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import { standingFor, type PlayerStanding } from '@/lib/clanLeaderboard';
import {
  accounts,
  clanMemberships,
  clans,
  memberDailyStats,
  memberMilestones,
  playerEventFacts,
  weeklyCompetitions,
  weeklyParticipants,
} from '@/db/schema';

// ── The arena ────────────────────────────────────────────────────────────────────────────────────

/** One rung of the visible ladder. */
export interface ArenaLane {
  position: number;
  rsn: string;
  gained: number;
  /** True for the caller's own row — the one the page highlights. */
  you: boolean;
}

export interface Arena {
  competitionId: number;
  title: string;
  /** 'skill' | 'boss', and the metric it ranks on. */
  type: string;
  metric: string;
  clanName: string;
  clanSlug: string;
  endDate: string;
  rsn: string;
  gained: number;
  position: number;
  fieldSize: number;
  /** The top of the board plus the caller, in position order, deduplicated. */
  lanes: ArenaLane[];
  /** What the next place up costs, or null when there isn't one. */
  gapAhead: number | null;
  /** How far the person below is, or null at the bottom. */
  gapBehind: number | null;
}

/** Gain for a participant row: current minus the frozen baseline, floored at zero. */
const gainExpr = sql<number>`GREATEST(COALESCE(${weeklyParticipants.currentValue}, 0) - COALESCE(${weeklyParticipants.baselineValue}, 0), 0)`;

/**
 * The live competition this person is doing best in, as a race.
 *
 * ONE competition, not all of them. A person in two clans running weeklies has two standings, and a
 * page that shows both shows neither — the hero only works if there is a single thing to look at. So
 * the pick is the one they are ranked highest in, which is the one worth opening the page for.
 *
 * Returns null when nothing is live, which is a real and frequent state: the page above it must have
 * something else to lead with rather than a hole.
 */
export async function arenaFor(accountIds: number[]): Promise<Arena | null> {
  if (accountIds.length === 0) return null;

  // Every live participation this person holds, across every clan.
  const mine = await db
    .select({
      competitionId: weeklyParticipants.competitionId,
      rsn: weeklyParticipants.rsn,
      gained: gainExpr,
      title: weeklyCompetitions.title,
      type: weeklyCompetitions.type,
      metric: weeklyCompetitions.metric,
      endDate: weeklyCompetitions.endDate,
      clanName: clans.name,
      clanSlug: clans.slug,
    })
    .from(weeklyParticipants)
    .innerJoin(weeklyCompetitions, eq(weeklyCompetitions.id, weeklyParticipants.competitionId))
    .innerJoin(clans, eq(clans.id, weeklyCompetitions.clanId))
    // clan-scope: global -- a person's standings span every clan they hold a seat in; this is a
    // person-scoped read of their own participations, not a clan's leaderboard.
    .innerJoin(clanMemberships, eq(clanMemberships.id, weeklyParticipants.clanMemberId))
    .where(and(inArray(clanMemberships.accountId, accountIds), eq(weeklyCompetitions.status, 'active')));

  if (mine.length === 0) return null;

  // Rank each candidate, then keep the best. Cheap: a person is in one or two live weeklies, and the
  // count is an index scan on (competition_id).
  const ranked = await Promise.all(
    mine.map(async (m) => {
      const [row] = await db
        .select({
          ahead: sql<number>`count(*) FILTER (WHERE ${gainExpr} > ${Number(m.gained)})`,
          total: sql<number>`count(*)`,
        })
        .from(weeklyParticipants)
        .where(eq(weeklyParticipants.competitionId, m.competitionId));
      return {
        ...m,
        gained: Number(m.gained ?? 0),
        position: Number(row?.ahead ?? 0) + 1,
        fieldSize: Number(row?.total ?? 0),
      };
    }),
  );

  const best = ranked.sort((a, b) => a.position - b.position || b.gained - a.gained)[0];

  // The visible ladder: the top of the board, plus the caller when they are not already in it.
  const top = await db
    .select({ rsn: weeklyParticipants.rsn, gained: gainExpr })
    .from(weeklyParticipants)
    .where(eq(weeklyParticipants.competitionId, best.competitionId))
    .orderBy(desc(gainExpr))
    .limit(5);

  const lanes: ArenaLane[] = top.map((t, i) => ({
    position: i + 1,
    rsn: t.rsn,
    gained: Number(t.gained ?? 0),
    you: i + 1 === best.position && t.rsn === best.rsn,
  }));

  if (!lanes.some((l) => l.you)) {
    // Show the two rungs above them rather than the leaderboard's head, which is the part they can
    // act on — "who is directly in front" is the question, not "who is winning".
    const above = await db
      .select({ rsn: weeklyParticipants.rsn, gained: gainExpr })
      .from(weeklyParticipants)
      .where(and(eq(weeklyParticipants.competitionId, best.competitionId), sql`${gainExpr} > ${best.gained}`))
      .orderBy(gainExpr)
      .limit(2);

    lanes.length = 0;
    above
      .slice()
      .reverse()
      .forEach((a, i) => {
        lanes.push({
          position: best.position - above.length + i,
          rsn: a.rsn,
          gained: Number(a.gained ?? 0),
          you: false,
        });
      });
    lanes.push({ position: best.position, rsn: best.rsn, gained: best.gained, you: true });
  }

  // The person immediately behind — being chased motivates as much as chasing.
  const [behind] = await db
    .select({ rsn: weeklyParticipants.rsn, gained: gainExpr })
    .from(weeklyParticipants)
    .where(and(eq(weeklyParticipants.competitionId, best.competitionId), sql`${gainExpr} < ${best.gained}`))
    .orderBy(desc(gainExpr))
    .limit(1);

  // Only append the chaser when the visible ladder does not already reach them — the top-five view
  // usually does, and pushing anyway put the same person on two consecutive rungs.
  if (behind && !lanes.some((l) => l.position === best.position + 1)) {
    lanes.push({ position: best.position + 1, rsn: behind.rsn, gained: Number(behind.gained ?? 0), you: false });
  }

  const ahead = lanes.filter((l) => l.position < best.position).pop();

  return {
    competitionId: best.competitionId,
    title: best.title,
    type: best.type,
    metric: best.metric,
    clanName: best.clanName,
    clanSlug: best.clanSlug,
    endDate: best.endDate,
    rsn: best.rsn,
    gained: best.gained,
    position: best.position,
    fieldSize: best.fieldSize,
    lanes,
    gapAhead: ahead ? Math.max(0, ahead.gained - best.gained) : null,
    gapBehind: behind ? Math.max(0, best.gained - Number(behind.gained ?? 0)) : null,
  };
}

// ── The streak ───────────────────────────────────────────────────────────────────────────────────

export interface Streak {
  current: number;
  best: number;
  /** Oldest first, one per week, the last being the week in progress. */
  weeks: boolean[];
}

/** UTC week key, Monday-based, so a streak means the same thing in every timezone. */
function weekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // getUTCDay: 0 = Sunday. Shift so Monday starts the week.
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
  return t.toISOString().slice(0, 10);
}

/**
 * Consecutive weeks in which this person gained any XP on any character.
 *
 * The one genuinely new mechanic on the page, and deliberately the cheapest one available: it reads
 * the daily rollup that already exists and writes nothing. A streak beats a total because it is
 * losable — there is a reason to come back on Sunday that a cumulative number never provides.
 *
 * Any character counts. Someone whose main is resting while an alt grinds has not stopped playing,
 * and a streak that punished them for that would be measuring the wrong thing.
 */
export async function streakFor(accountIds: number[], now = new Date()): Promise<Streak> {
  const empty: Streak = { current: 0, best: 0, weeks: [] };
  if (accountIds.length === 0) return empty;

  // A year is enough to establish a personal best without scanning a lifetime of rows.
  const since = new Date(now.getTime() - 371 * 86_400_000).toISOString().slice(0, 10);

  const rows = await db
    .select({ day: memberDailyStats.day, gained: sql<number>`sum(${memberDailyStats.xpGained})` })
    .from(memberDailyStats)
    .where(and(inArray(memberDailyStats.accountId, accountIds), gte(memberDailyStats.day, since)))
    .groupBy(memberDailyStats.day);

  const active = new Set<string>();
  for (const r of rows) {
    if (Number(r.gained ?? 0) > 0) active.add(weekKey(new Date(r.day + 'T00:00:00Z')));
  }
  if (active.size === 0) return empty;

  // Walk backwards from this week. The week IN PROGRESS never breaks a streak — it has not finished
  // failing yet, and ending someone's run on a Monday morning would be both wrong and infuriating.
  const thisWeek = weekKey(now);
  const keysBack: string[] = [];
  for (let i = 0; i < 53; i++) {
    const d = new Date(now.getTime() - i * 7 * 86_400_000);
    keysBack.push(weekKey(d));
  }

  let current = 0;
  for (const k of keysBack) {
    if (active.has(k)) current++;
    else if (k === thisWeek) continue;
    else break;
  }

  let best = 0;
  let run = 0;
  for (const k of keysBack.slice().reverse()) {
    if (active.has(k)) {
      run++;
      best = Math.max(best, run);
    } else if (k !== thisWeek) {
      run = 0;
    }
  }

  return {
    current,
    best: Math.max(best, current),
    weeks: keysBack.slice(0, 7).reverse().map((k) => active.has(k)),
  };
}

// ── Career ───────────────────────────────────────────────────────────────────────────────────────

export interface Career {
  events: number;
  tilesFinished: number;
  tilesContributed: number;
  podiums: number;
  activeDays: number;
  /** Clans they have actually played an event for, best-known name first. */
  clanNames: string[];
}

/**
 * What this person has done across every clan, ever.
 *
 * The one thing a single-clan site could never show, and the reason a cross-clan platform is worth
 * belonging to: nine events and thirty-four finished tiles is an identity, where "you are in two
 * clans" is only an arrangement.
 *
 * Reads player_event_facts, which is materialised once per person per finished event — so this is a
 * small aggregate over a table built for exactly this question, not a scan of submissions.
 */
export async function careerFor(userId: number | null | undefined): Promise<Career | null> {
  if (userId == null) return null;

  const [row] = await db
    .select({
      events: sql<number>`count(*)`,
      tilesFinished: sql<number>`coalesce(sum(${playerEventFacts.tilesFinished}), 0)`,
      tilesContributed: sql<number>`coalesce(sum(${playerEventFacts.tilesContributed}), 0)`,
      activeDays: sql<number>`coalesce(sum(${playerEventFacts.activeDays}), 0)`,
    })
    .from(playerEventFacts)
    // clan-scope: global -- a career spans clans by definition; person-scoped by userId.
    .where(eq(playerEventFacts.userId, userId));

  if (!row || Number(row.events ?? 0) === 0) return null;

  const clanRows = await db
    .selectDistinct({ name: clans.name })
    .from(playerEventFacts)
    .innerJoin(clanMemberships, eq(clanMemberships.id, playerEventFacts.clanMemberId))
    .innerJoin(clans, eq(clans.id, clanMemberships.clanId))
    .where(eq(playerEventFacts.userId, userId));

  return {
    events: Number(row.events ?? 0),
    tilesFinished: Number(row.tilesFinished ?? 0),
    tilesContributed: Number(row.tilesContributed ?? 0),
    // Podiums are not stored — a placing is a property of the finished event's standings, not of the
    // person's row. Left at zero rather than guessed; the tile in the UI hides when it is zero.
    podiums: 0,
    activeDays: Number(row.activeDays ?? 0),
    clanNames: clanRows.map((c) => c.name).filter(Boolean),
  };
}

// ── Recent milestones ────────────────────────────────────────────────────────────────────────────

export interface RecentMilestone {
  kind: string;
  metric: string | null;
  threshold: number;
  noticedAt: string;
  rsn: string;
}

/**
 * The last few thresholds this person crossed, on any character.
 *
 * Already detected and dated by the stats sweep — this only reads them. Kept short because a feed
 * that scrolls stops being a highlight.
 */
export async function recentMilestones(accountIds: number[], limit = 5): Promise<RecentMilestone[]> {
  if (accountIds.length === 0) return [];

  const rows = await db
    .select({
      kind: memberMilestones.kind,
      metric: memberMilestones.metric,
      threshold: memberMilestones.threshold,
      noticedAt: memberMilestones.noticedAt,
      rsn: accounts.rsn,
    })
    .from(memberMilestones)
    .innerJoin(accounts, eq(accounts.id, memberMilestones.accountId))
    .where(inArray(memberMilestones.accountId, accountIds))
    .orderBy(desc(memberMilestones.noticedAt))
    .limit(limit);

  return rows.map((r) => ({ ...r, threshold: Number(r.threshold ?? 0) }));
}

// ── Seats per character ──────────────────────────────────────────────────────────────────────────

export interface Seat {
  clanId: number;
  clanName: string;
  clanSlug: string;
  /** 'member' is a home; 'guest' is a visit. The page draws them differently. */
  kind: string;
}

/**
 * Every seat every character holds, keyed by account.
 *
 * The existing characterList deliberately reports only the single MEMBER seat, because that is the
 * one that answers "whose are you". This answers the other question the new page asks — where each
 * character plays at all — which is the shape the platform exists for and the thing a per-clan site
 * could not draw.
 */
export async function seatsByAccount(accountIds: number[]): Promise<Map<number, Seat[]>> {
  const out = new Map<number, Seat[]>();
  if (accountIds.length === 0) return out;

  const rows = await db
    .select({
      accountId: clanMemberships.accountId,
      clanId: clans.id,
      clanName: clans.name,
      clanSlug: clans.slug,
      kind: clanMemberships.kind,
    })
    .from(clanMemberships)
    .innerJoin(clans, eq(clans.id, clanMemberships.clanId))
    // clan-scope: global -- listing one person's own seats across clans is the point of the query.
    .where(and(inArray(clanMemberships.accountId, accountIds), isNull(clanMemberships.leftAt)));

  for (const r of rows) {
    const list = out.get(r.accountId) ?? [];
    // Homes before visits, so a card reads "where I belong" first.
    list.push({ clanId: r.clanId, clanName: r.clanName, clanSlug: r.clanSlug, kind: r.kind });
    out.set(r.accountId, list);
  }
  for (const list of out.values()) {
    list.sort((a, b) => (a.kind === b.kind ? a.clanName.localeCompare(b.clanName) : a.kind === 'member' ? -1 : 1));
  }
  return out;
}

/** Every account this person plays. The join key for everything above. */
export async function accountIdsOf(playerId: number | null | undefined): Promise<number[]> {
  if (playerId == null) return [];
  const rows = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.playerId, playerId));
  return rows.map((r) => r.id);
}

// ── Next milestone ───────────────────────────────────────────────────────────────────────────────

/**
 * Total-XP rungs, chosen to stay meaningful the whole way up.
 *
 * Not the per-skill ladder detectMilestones uses — that one tops out at 200M, which every maxed
 * account passed years ago. These are spaced so there is always a next one worth wanting, ending at
 * the real ceiling of 4.6B.
 */
const TOTAL_XP_RUNGS = [
  1_000_000, 5_000_000, 10_000_000, 25_000_000, 50_000_000, 100_000_000, 200_000_000,
  300_000_000, 500_000_000, 750_000_000, 1_000_000_000, 1_500_000_000, 2_000_000_000,
  3_000_000_000, 4_600_000_000,
];

export interface NextMilestone {
  label: string;
  /** How much further, in XP. */
  remaining: number;
  /** 0–1, how far through the current rung they are. */
  progress: number;
}

/**
 * The nearest total-XP rung each character has yet to cross.
 *
 * Anticipation, which pulls harder than achievement: a number you are approaching gives a card a
 * reason to be looked at again tomorrow, where a list of things already done does not.
 *
 * Reads `accounts.stats_overall_xp`, which the sweep maintains — no extra work and no new column.
 */
export async function nextMilestoneByAccount(accountIds: number[]): Promise<Map<number, NextMilestone>> {
  const out = new Map<number, NextMilestone>();
  if (accountIds.length === 0) return out;

  const rows = await db
    .select({ id: accounts.id, xp: accounts.statsOverallXp })
    .from(accounts)
    .where(inArray(accounts.id, accountIds));

  for (const r of rows) {
    const xp = Number(r.xp ?? 0);
    if (xp <= 0) continue; // never polled; a bar from nothing to nothing says nothing
    const idx = TOTAL_XP_RUNGS.findIndex((t) => t > xp);
    if (idx === -1) continue; // past the ceiling — nothing left to want
    const target = TOTAL_XP_RUNGS[idx];
    const floor = idx === 0 ? 0 : TOTAL_XP_RUNGS[idx - 1];
    out.set(r.id, {
      label: `${compactXp(target)} total`,
      remaining: target - xp,
      progress: Math.min(1, Math.max(0, (xp - floor) / (target - floor))),
    });
  }
  return out;
}

/** 4_600_000_000 → "4.6B". Shared with the UI so a rung reads the same in both places. */
export function compactXp(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(n % 1_000_000_000 === 0 ? 0 : 1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

// ── The whole set ────────────────────────────────────────────────────────────────────────────────

export interface ApexSignals {
  arena: Arena | null;
  /** Where their best character places on the platform table this week. Null when nothing ranks. */
  standing: PlayerStanding | null;
  streak: Streak;
  career: Career | null;
  milestones: RecentMilestone[];
  seats: Map<number, Seat[]>;
  next: Map<number, NextMilestone>;
}

/**
 * Everything the "how am I doing" half of the home needs, in one round of parallel queries.
 *
 * Sequential would be six round trips for a page that must feel instant. Every one of these is
 * independent — none of them needs another's answer — so the only reason to await them in order
 * would be that it was easier to write.
 */
export async function apexSignals(
  playerId: number | null | undefined,
  userId: number | null | undefined,
): Promise<ApexSignals> {
  const accountIds = await accountIdsOf(playerId);

  const [arena, standing, streak, career, milestones, seats, next] = await Promise.all([
    arenaFor(accountIds),
    standingFor(accountIds),
    streakFor(accountIds),
    careerFor(userId),
    recentMilestones(accountIds),
    seatsByAccount(accountIds),
    nextMilestoneByAccount(accountIds),
  ]);

  return { arena, standing, streak, career, milestones, seats, next };
}
