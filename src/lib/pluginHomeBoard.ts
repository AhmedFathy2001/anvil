// The board a signed-in person is playing, whichever of their characters is logged in (or none).
// Shared by /api/plugin/config (the sidebar's home-board summary) and /api/plugin/board (which shows
// that same board read-only when the played character isn't the enrolled one).

import { db } from '@/db';
import { events, tiles, eventParticipants, completions, clanRoster } from '@/db/schema';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { seatsOwnedByAnywhere } from '@/lib/roster';
import { clansRunningEvents } from '@/lib/coHost';
import { boardPointsPool, scoreTeam } from '@/lib/boardScoring';
import { parseEventRules } from '@/lib/eventRules';

/**
 * Server-resolved home-board summary for the sidebar, keyed to the TOKEN's user alone (no in-game
 * login needed): linked members → a player row in a LIVE event → that team's completed/total scored
 * tiles (points-weighted for Leagues). This is what lets the plugin render the home clan's board at
 * the login screen — the same resolution the website's My Team page performs — while the live layers
 * (nearest tiles, active-now) still wait for a playing account. Null when the user isn't enrolled
 * anywhere live.
 */
export async function homeBoardForUser(clanId: number, userId: number): Promise<{
  /** WHICH board — a co-hosted one is reported by both hosts, and the id is what says they are one. */
  eventId: number;
  eventName: string;
  tilesComplete: number;
  tilesTotal: number;
  pointsScored: boolean;
} | null> {
  // EVERY seat this person holds, not only the ones on this clan's roster. A cross-clan event seats
  // its visitors on the HOST clan, so a board this clan CO-HOSTS is held on a guest seat over there
  // — scoped to this clan's seats, its own member's own board read as "no active event". The
  // enrollments are filtered back to what THIS clan is running, two steps down.
  // clan-scope: global -- the subject is a PERSON and their seats span clans by design; the answer is narrowed to this clan by `running` below.
  const myMembers = await db
    .select({ id: clanRoster.id, isPrimary: clanRoster.isPrimary })
    .from(clanRoster)
    .where(and(await seatsOwnedByAnywhere(userId), isNull(clanRoster.leftAt)));
  if (myMembers.length === 0) return null;
  const primaryIds = new Set(myMembers.filter((m) => m.isPrimary === 1).map((m) => m.id));

  // clan-scope: global -- takes an entity id whose caller has already settled the clan — the 'one hop, never a copy' rule in lib/eventScope. Every route and page that reaches this is verified scoped.
  const enrollments = await db
    .select({
      eventId: events.id,
      eventName: events.name,
      scoringMode: events.scoringMode,
      rules: events.rules,
      startDate: events.startDate,
      endDate: events.endDate,
      forceEndedAt: events.forceEndedAt,
      teamId: eventParticipants.teamId,
      clanMemberId: eventParticipants.clanMemberId,
    })
    .from(eventParticipants)
    .innerJoin(events, eq(eventParticipants.eventId, events.id))
    .where(inArray(eventParticipants.clanMemberId, myMembers.map((m) => m.id)));

  // Back to this clan: the boards it hosts or co-hosts. A person's enrollment somewhere else
  // entirely is not this clan's board and must not be reported as one.
  const running = await clansRunningEvents([...new Set(enrollments.map((e) => e.eventId))]);
  const here = enrollments.filter((e) => running.get(e.eventId)?.has(clanId) === true);

  const now = Date.now();
  const isLive = (e: (typeof enrollments)[number]) =>
    e.teamId != null &&
    !e.forceEndedAt &&
    e.startDate != null &&
    Date.parse(e.startDate) <= now &&
    // No end date = runs until someone ends it (forceEndedAt, checked above), not "never live".
    (e.endDate == null || now <= Date.parse(e.endDate));
  // The token is USER-scoped, so pre-login we can't know which linked account is about to play
  // (Jagex launchers know client-side; legacy logins don't). Deterministic guess: the PRIMARY
  // account's live enrollment first, else any live one; latest start wins within each tier —
  // mirroring verifyPluginToken's pick so pre- and post-login agree. The real account-scoped board
  // takes over the moment an account resolves in-game.
  here.sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''));
  const live =
    here.find((e) => isLive(e) && e.clanMemberId != null && primaryIds.has(e.clanMemberId)) ??
    here.find(isLive);
  if (!live) return null;
  // Started but not revealed: there is no board to be a fraction of yet, and its size stays hidden.
  // clan-scope: global -- the event this person is enrolled in, by its own id.
  const revealedRow = await db.query.events.findFirst({ where: eq(events.id, live.eventId), columns: { tilesRevealed: true } });
  if (!revealedRow?.tilesRevealed) return null;

  // Scored through lib/boardScoring, so this pre-login summary is the same fraction the board itself
  // shows once they log in — optional tiles out, missions a bonus, a drip board against its pool.
  const tileRows = await db.query.tiles.findMany({ where: eq(tiles.eventId, live.eventId) });
  const doneRows = await db
    .select({ teamId: completions.teamId, tileId: completions.tileId, awardedPoints: completions.awardedPoints })
    .from(completions)
    .where(eq(completions.teamId, live.teamId as number));
  const score = scoreTeam({
    scoringMode: live.scoringMode,
    rules: parseEventRules(live.rules),
    tiles: tileRows,
    completions: doneRows,
    teamId: live.teamId as number,
    boardPointsTotal: boardPointsPool(live.scoringMode, tileRows),
  });
  return {
    eventId: live.eventId,
    eventName: live.eventName,
    tilesComplete: score.boardScore,
    tilesTotal: score.total,
    pointsScored: score.unit === 'pts',
  };
}

