// Each member's share of one team's score — the same split as the MVP (lib/memberBreakdown): every
// finished tile's points divided among whoever did the work, by what they submitted or, for a KC/XP
// tile, by the split frozen at completion. For the plugin's Teams page, where a team's members are
// listed best first.

import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { completions, eventParticipants, events, submissions, tiles } from '@/db/schema';
import { eventActivityIsValid } from '@/lib/completionGate';
import { computeMemberBreakdown, type StatGainMap } from '@/lib/memberBreakdown';
import { getStatStandings } from '@/lib/statStandings';
import { parseContributionSnapshot } from '@/lib/statTracking';
import { ttlMemo } from '@/lib/ttlMemo';

/** participantId → points, for one team. Shared by every viewer of the team for a few seconds. */
export function teamMemberPoints(eventId: number, teamId: number): Promise<Map<number, number>> {
  return ttlMemo(`team-member-points:${eventId}:${teamId}`, () => compute(eventId, teamId), 15_000);
}

async function compute(eventId: number, teamId: number): Promise<Map<number, number>> {
  // clan-scope: global -- the route resolved and access-checked the event before asking.
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return new Map();
  const eventTiles = await db.select().from(tiles).where(eq(tiles.eventId, eventId));
  const tileIds = eventTiles.map((t) => t.id);
  if (tileIds.length === 0) return new Map();

  const [players, comps, subs] = await Promise.all([
    db
      .select({ id: eventParticipants.id, name: eventParticipants.name, teamId: eventParticipants.teamId, frozenAt: eventParticipants.frozenAt })
      .from(eventParticipants)
      .where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.teamId, teamId))),
    db
      .select()
      .from(completions)
      .where(and(eq(completions.teamId, teamId), inArray(completions.tileId, tileIds))),
    db
      .select({ tileId: submissions.tileId, teamId: submissions.teamId, creditPlayerId: submissions.creditPlayerId, amount: submissions.amount, createdAt: submissions.createdAt })
      .from(submissions)
      .where(and(eq(submissions.teamId, teamId), inArray(submissions.tileId, tileIds))),
  ]);

  const validComps = comps
    .filter((c) => eventActivityIsValid(event, c.completedAt))
    .map((c) => ({ ...c, statContributions: parseContributionSnapshot(c.statContributions) }));
  // Stat completions from before splits were frozen fall back to the live gain, as on the event page.
  const statTileIds = new Set(eventTiles.filter((t) => t.trackedStat).map((t) => t.id));
  const legacy = [...new Set(validComps.filter((c) => statTileIds.has(c.tileId) && !c.statContributions).map((c) => c.tileId))];
  const statGains: StatGainMap = {};
  if (legacy.length) {
    for (const s of await getStatStandings(eventId, legacy)) {
      statGains[s.tileId] = s.players.map((p) => ({ playerId: p.playerId, gained: p.gained }));
    }
  }

  const breakdown = computeMemberBreakdown({
    teamId,
    scoringMode: event.scoringMode,
    players,
    tiles: eventTiles,
    completions: validComps,
    submissions: subs.filter((s) => eventActivityIsValid(event, s.createdAt)),
    statGains,
  });
  return new Map(breakdown.map((m) => [m.playerId, m.points]));
}
