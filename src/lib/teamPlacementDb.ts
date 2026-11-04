// Applying the host's team placement (lib/teamPlacement) to a real sign-up, safely under load.
//
// A streamer posts a link and three hundred people press "Sign up" inside a minute. Auto-balance is
// "join the team with the fewest players", and read-then-write is exactly the shape that breaks
// under that: forty requests all read "Team 2 has 11", all join Team 2, and it ends on 51. Solo and
// on-demand team creation have the same race in another costume — two first sign-ups each see "no
// teams yet" and each make Team 1.
//
// So every placement for one event runs in a transaction that first takes a row lock on the event
// (SELECT … FOR UPDATE). Placements on the same board queue behind each other for the few
// milliseconds each takes; placements on different boards never touch. Inside the lock the counts
// are true, so the choice is too. The lock only covers PLACING — the rest of the sign-up (the sign-up
// row, the fee) stays outside it, so the critical section is two small reads and two inserts.

import { and, asc, count, eq, sql } from 'drizzle-orm';

import { db } from '@/db';
import { eventParticipants, teams } from '@/db/schema';
import {
  accountOfSeat,
  enrolParticipant,
  onAccountConflict,
  participantForSeat,
  type NewParticipant,
  type Participant,
} from '@/lib/participants';
import { captureStartingStatsSoon } from '@/lib/startingStats';
import {
  checkPick,
  chooseAutoTeam,
  nextTeamColour,
  placementOf,
  soloTeamName,
  type TeamLoad,
  type TeamPlacement,
} from '@/lib/teamPlacement';

/** The event columns placement reads. */
export interface PlacementEvent {
  id: number;
  teamPlacement: string;
  teamFormation: string;
  teamCount: number | null;
  teamCap: number | null;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Exec = typeof db | Tx;

/** Every team on the board with how many players it has, oldest first. */
export async function teamLoads(eventId: number, exec: Exec = db): Promise<TeamLoad[]> {
  const rows = await exec
    .select({ id: teams.id, name: teams.name, color: teams.color, size: count(eventParticipants.id) })
    .from(teams)
    .leftJoin(eventParticipants, eq(eventParticipants.teamId, teams.id))
    .where(eq(teams.eventId, eventId))
    .groupBy(teams.id)
    .orderBy(asc(teams.id));
  return rows.map((r) => ({ ...r, size: Number(r.size) }));
}

export type PlacementResult =
  | { ok: true; row: Participant; created: boolean; teamId: number | null }
  | { ok: false; reason: 'full' | 'no-such-team' };

/** Thrown inside the transaction to roll back a team made for a player who turned out to be here. */
class AlreadyOnBoard extends Error {}

/**
 * Put a new sign-up on the board where the event's placement says, once.
 *
 * `values.teamId` is ignored — the placement decides it. A caller with a team already in hand (an
 * invite link, a second account of somebody already placed) calls enrolParticipant directly instead;
 * an invite always wins over placement.
 *
 * Somebody already on the board is never moved off a team. Somebody waiting in the pool (signed up
 * while the event was still on draft, say) is placed now if the placement places people.
 *
 * `requestedTeamId` is the team they chose, on a 'pick' board. Without one they go to the pool.
 */
export async function enrolPlaced(
  event: PlacementEvent,
  values: NewParticipant,
  opts: { requestedTeamId?: number | null } = {},
): Promise<PlacementResult> {
  const placement = placementOf(event);
  const accountId = values.accountId ?? (await accountOfSeat(values.clanMemberId));

  let result: PlacementResult;
  try {
    result = await db.transaction(async (tx) => {
      // clan-scope: global -- a row lock on one event the caller already resolved by id; it reads nothing.
      await tx.execute(sql`select id from events where id = ${event.id} for update`);

      const existing =
        accountId == null
          ? undefined
          : (
              await tx
                .select()
                .from(eventParticipants)
                .where(and(eq(eventParticipants.eventId, event.id), eq(eventParticipants.accountId, accountId)))
                .limit(1)
            )[0];
      if (existing && existing.teamId != null) return { ok: true, row: existing, created: false, teamId: existing.teamId };

      const decided = await decideTeam(tx, event.id, placement, event, values.name, opts.requestedTeamId ?? null);
      if (!decided.ok) return decided;
      const teamId = decided.teamId;

      if (existing) {
        if (teamId == null) return { ok: true, row: existing, created: false, teamId: null };
        const [moved] = await tx
          .update(eventParticipants)
          .set({ teamId })
          .where(eq(eventParticipants.id, existing.id))
          .returning();
        return { ok: true, row: moved, created: false, teamId };
      }

      const insert = tx.insert(eventParticipants).values({ ...values, accountId: accountId ?? null, teamId });
      const [row] = accountId == null ? await insert.returning() : await insert.onConflictDoNothing(onAccountConflict).returning();
      // Another door (a captain's roster add, which does not take this lock) seated them meanwhile.
      // Roll back so a solo / on-demand team is not left behind for nobody.
      if (!row) throw new AlreadyOnBoard();
      return { ok: true, row, created: true, teamId };
    });
  } catch (err) {
    if (!(err instanceof AlreadyOnBoard) || accountId == null) throw err;
    const won = await db.query.eventParticipants.findFirst({
      where: and(eq(eventParticipants.eventId, event.id), eq(eventParticipants.accountId, accountId)),
    });
    if (!won) throw err;
    return { ok: true, row: won, created: false, teamId: won.teamId };
  }

  if (result.ok && result.teamId != null) captureStartingStatsSoon(event.id, [result.row.id]);
  return result;
}

async function decideTeam(
  tx: Tx,
  eventId: number,
  placement: TeamPlacement,
  event: PlacementEvent,
  playerName: string,
  requestedTeamId: number | null,
): Promise<{ ok: true; teamId: number | null } | { ok: false; reason: 'full' | 'no-such-team' }> {
  if (placement === 'draft') return { ok: true, teamId: null };

  const loads = await teamLoads(eventId, tx);

  if (placement === 'pick') {
    if (requestedTeamId == null) return { ok: true, teamId: null };
    const verdict = checkPick(loads.find((t) => t.id === requestedTeamId), event.teamCap);
    return verdict.ok ? { ok: true, teamId: requestedTeamId } : verdict;
  }

  if (placement === 'solo') {
    const [made] = await tx
      .insert(teams)
      .values({
        eventId,
        name: soloTeamName(playerName, loads.map((t) => t.name)),
        color: nextTeamColour(loads.map((t) => t.color ?? '')),
      })
      .returning({ id: teams.id });
    return { ok: true, teamId: made.id };
  }

  // auto
  const choice = chooseAutoTeam(loads, event.teamCount);
  if (choice.kind === 'existing') return { ok: true, teamId: choice.teamId };
  const [made] = await tx
    .insert(teams)
    .values({ eventId, name: choice.name, color: choice.color })
    .returning({ id: teams.id });
  return { ok: true, teamId: made.id };
}

/**
 * Players pick: move somebody who already chose to a different team, when they edit their sign-up
 * before the event starts. Same lock, same cap check — switching must not overfill a team either.
 */
export async function switchPickedTeam(
  event: PlacementEvent,
  participantId: number,
  toTeamId: number,
): Promise<{ ok: true } | { ok: false; reason: 'full' | 'no-such-team' }> {
  const out = await db.transaction(async (tx) => {
    // clan-scope: global -- a row lock on one event the caller already resolved by id; it reads nothing.
    await tx.execute(sql`select id from events where id = ${event.id} for update`);
    const loads = await teamLoads(event.id, tx);
    const verdict = checkPick(loads.find((t) => t.id === toTeamId), event.teamCap);
    if (!verdict.ok) return verdict;
    await tx
      .update(eventParticipants)
      .set({ teamId: toTeamId })
      .where(and(eq(eventParticipants.id, participantId), eq(eventParticipants.eventId, event.id)));
    return { ok: true as const };
  });
  if (out.ok) captureStartingStatsSoon(event.id, [participantId]);
  return out;
}

/** The event columns the sign-up seating reads. */
export interface SeatingEvent extends PlacementEvent {
  draftStatus: string;
  startDate: string | null;
}

/**
 * Seat the accounts one person just signed up with — the player-row half of POST
 * /api/events/[id]/signup, kept here so it can be tested against a real database.
 *
 * In order of precedence:
 *   1. an INVITE link's team. The link always wins over placement: it was a seat on one team.
 *   2. the board's Team placement (auto / pick / solo). The primary account is placed first, so it
 *      decides the team (a solo team is named after it); their other accounts join that same team,
 *      as "all on the same team" has always meant for multi-account entries.
 *   3. the draft pool, as every sign-up landed before placement existed.
 *
 * Nobody already on a team is moved, with one exception: on a players-pick board, before it starts,
 * editing the sign-up to a different team switches them (cap permitting).
 *
 * Returns the team the primary ended up on (null = the pool).
 */
export async function seatSignupAccounts(input: {
  event: SeatingEvent;
  accounts: { seatId: number; accountId: number | null; rsn: string }[];
  primarySeatId: number;
  inviteTeamId: number | null;
  /** The team they chose on a players-pick board (already validated against this event). */
  pickTeamId: number | null;
  timezone: string | null;
  now: string;
  newPlayerToken: () => string;
  /**
   * The sign-up still waits for the host's yes: it goes to the pool whatever the placement, and is
   * placed when approved (admin signups PATCH). A team before approval would let a pending player's
   * plugin track and credit on a board the host hasn't let them into.
   */
  poolOnly?: boolean;
}): Promise<{ ok: true; teamId: number | null } | { ok: false; reason: 'full' | 'no-such-team' }> {
  const { event, inviteTeamId, pickTeamId, now } = input;
  const placement = input.poolOnly && inviteTeamId == null ? 'draft' : placementOf(event);
  const accounts = [...input.accounts].sort((a, b) =>
    a.seatId === input.primarySeatId ? -1 : b.seatId === input.primarySeatId ? 1 : 0,
  );
  const existingBySeat = new Map<number, Participant | undefined>();
  for (const a of accounts) existingBySeat.set(a.seatId, await participantForSeat(event.id, a.seatId));

  const valuesFor = (a: (typeof accounts)[number]) => ({
    eventId: event.id,
    clanMemberId: a.seatId,
    accountId: a.accountId,
    name: a.rsn,
    timezone: input.timezone, // the person's tz applies to all their accounts
    playerToken: input.newPlayerToken(),
  });

  // 1 + 3: an invite, or a board that does not place people — exactly the behaviour before placement.
  if (inviteTeamId != null || placement === 'draft') {
    let primaryTeam: number | null = null;
    for (const a of accounts) {
      const existing = existingBySeat.get(a.seatId);
      if (!existing) {
        // An invite is a seat on ONE team, so the entry skips the pool entirely.
        const { row } = await enrolParticipant({ ...valuesFor(a), teamId: inviteTeamId });
        if (a.seatId === input.primarySeatId) primaryTeam = row.teamId;
      } else if (inviteTeamId != null && existing.teamId == null) {
        // Already in the pool (signed up first, invited after) — the link moves them onto the team.
        await db.update(eventParticipants).set({ teamId: inviteTeamId }).where(eq(eventParticipants.id, existing.id));
        captureStartingStatsSoon(event.id, [existing.id]);
        if (a.seatId === input.primarySeatId) primaryTeam = inviteTeamId;
      } else if (a.seatId === input.primarySeatId) {
        primaryTeam = existing.teamId;
      }
    }
    return { ok: true, teamId: primaryTeam };
  }

  // 2: placement.
  const beforeStart = event.draftStatus === 'none' && (!event.startDate || event.startDate > now);
  const switching = placement === 'pick' && pickTeamId != null && beforeStart;
  // A person already on a team keeps their other accounts with them.
  let personTeamId: number | null = switching
    ? pickTeamId
    : ([...existingBySeat.values()].find((p) => p?.teamId != null)?.teamId ?? null);
  let primaryTeam: number | null = null;

  for (const a of accounts) {
    const existing = existingBySeat.get(a.seatId);
    let teamId: number | null;
    if (existing?.teamId != null) {
      if (switching && existing.teamId !== pickTeamId) {
        const moved = await switchPickedTeam(event, existing.id, pickTeamId!);
        if (!moved.ok) return moved;
        teamId = pickTeamId;
      } else {
        teamId = existing.teamId;
      }
    } else if (personTeamId != null && placement !== 'pick') {
      // A second account of somebody already placed: same team, no fresh balancing.
      if (existing) {
        await db.update(eventParticipants).set({ teamId: personTeamId }).where(eq(eventParticipants.id, existing.id));
        captureStartingStatsSoon(event.id, [existing.id]);
      } else {
        await enrolParticipant({ ...valuesFor(a), teamId: personTeamId });
      }
      teamId = personTeamId;
    } else {
      const placed = await enrolPlaced(event, valuesFor(a), { requestedTeamId: pickTeamId });
      if (!placed.ok) return placed;
      teamId = placed.teamId;
      if (teamId != null) personTeamId = teamId;
    }
    if (a.seatId === input.primarySeatId) primaryTeam = teamId;
  }
  return { ok: true, teamId: primaryTeam };
}
