import { db } from '@/db';
import { tiles, teams, completions, submissions, eventParticipants, players } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import {
  computeIndividualStandings,
  type IndividualStanding,
  type StatGainMap,
} from '@/lib/memberBreakdown';
import { loadPlayerOwners } from '@/lib/draftProfiles';
import { getStatStandings } from '@/lib/statStandings';
import { parseContributionSnapshot } from '@/lib/statTracking';

// The current UTC calendar month as an [start, end) ISO window. Completions store completedAt as
// ISO UTC text, so a plain string comparison buckets them by month.
export function monthWindowUtc(now: Date = new Date()): { start: string; end: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

export interface LadderBoards {
  allTime: IndividualStanding[];
  monthly: IndividualStanding[];
  ownerByPlayerId: Map<number, number | null>;
  perPerson: boolean;
}

/**
 * The individual ladder standings for an event, computed both all-time and for the current UTC
 * calendar month. Ladder points are completion-gated (computeMemberBreakdown scores only over a
 * team's completed tiles), so the monthly board is just the same computation over completions whose
 * completedAt falls in this month — a stat tile scores at its completion time via its frozen split,
 * so no per-period baseline is needed. Loads every input once and windows in memory.
 *
 * Mirrors the inputs the web event page assembles for computeIndividualStandings
 * (src/app/events/[eventId]/page.tsx).
 */
export async function getLadderBoards(event: {
  id: number;
  scoringMode: string | null;
  accountSlotMode: string | null;
}): Promise<LadderBoards> {
  const eventTiles = await db.select().from(tiles).where(eq(tiles.eventId, event.id));
  const eventTeams = await db.select().from(teams).where(eq(teams.eventId, event.id));
  const eventPlayers = await db.select().from(eventParticipants).where(eq(eventParticipants.eventId, event.id));
  const ownerByPlayerId = await loadPlayerOwners(eventPlayers);
  const perPerson = event.accountSlotMode === 'per-person';
  const tileIds = eventTiles.map((t) => t.id);
  if (tileIds.length === 0 || eventTeams.length === 0) {
    return { allTime: [], monthly: [], ownerByPlayerId, perPerson };
  }

  const tileIdSet = new Set(tileIds);
  const allCompletions = (await db.select().from(completions))
    .filter((c) => tileIdSet.has(c.tileId))
    .map((c) => ({
      id: c.id,
      teamId: c.teamId,
      tileId: c.tileId,
      completedAt: c.completedAt,
      statContributions: parseContributionSnapshot(c.statContributions),
      awardedPoints: c.awardedPoints,
    }));

  const eventSubmissions = await db
    .select({
      tileId: submissions.tileId,
      teamId: submissions.teamId,
      creditPlayerId: submissions.creditPlayerId,
      amount: submissions.amount,
    })
    .from(submissions)
    .where(inArray(submissions.tileId, tileIds));

  const statStandings = await getStatStandings(event.id);
  const statGains: StatGainMap = {};
  for (const s of statStandings) {
    statGains[s.tileId] = s.players.map((pl) => ({ playerId: pl.playerId, gained: pl.gained }));
  }

  const baseInputs = {
    scoringMode: event.scoringMode,
    teams: eventTeams,
    players: eventPlayers,
    tiles: eventTiles,
    submissions: eventSubmissions,
    statGains,
    ownerByPlayerId,
    accountSlotMode: event.accountSlotMode,
  };

  const { start, end } = monthWindowUtc();
  return {
    ownerByPlayerId,
    perPerson,
    allTime: computeIndividualStandings({ ...baseInputs, completions: allCompletions }),
    monthly: computeIndividualStandings({
      ...baseInputs,
      completions: allCompletions.filter((c) => c.completedAt >= start && c.completedAt < end),
    }),
  };
}

// The plugin-facing standings block: the caller's rank + a capped leaderboard. Ranks are 1-based on
// the fully-sorted list.
export interface PluginStandings {
  yourRank: number; // 0 when the caller has no scoring row yet
  yourPoints: number;
  yourTasks: number;
  total: number;
  entries: { rank: number; rsn: string; points: number; tasks: number }[];
}

// Which standing row is the caller's: their own player row, or — on per-person events — any account
// owned by the same user (the row's playerId is the owner's top-scoring lead, which may be a
// different alt than the one currently logged in).
function callerRow(
  ownerByPlayerId: Map<number, number | null>,
  callerPlayerId: number,
  perPerson: boolean,
): Set<number> {
  const owned = new Set<number>([callerPlayerId]);
  const callerOwner = perPerson ? ownerByPlayerId.get(callerPlayerId) ?? null : null;
  if (callerOwner != null) {
    for (const [pid, owner] of ownerByPlayerId) if (owner === callerOwner) owned.add(pid);
  }
  return owned;
}

export function toPluginStandings(
  rows: IndividualStanding[],
  callerPlayerId: number,
  ownerByPlayerId: Map<number, number | null>,
  perPerson: boolean,
  cap = 50,
): PluginStandings {
  const owned = callerRow(ownerByPlayerId, callerPlayerId, perPerson);
  let yourRank = 0;
  let yourPoints = 0;
  let yourTasks = 0;
  const entries = rows.map((r, i) => {
    const rank = i + 1;
    if (owned.has(r.playerId)) {
      yourRank = rank;
      yourPoints = r.points;
      yourTasks = r.tasks;
    }
    return { rank, rsn: r.name, points: Math.round(r.points), tasks: r.tasks };
  });
  return {
    yourRank,
    yourPoints: Math.round(yourPoints),
    yourTasks,
    total: rows.length,
    entries: entries.slice(0, cap),
  };
}
