import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { clanMemberships, clans, eventParticipants, teams } from '@/db/schema';

/** A palette that keeps clan teams distinguishable without anybody choosing colours. */
const COLOURS = ['#d4a017', '#3ecf62', '#4a9fd4', '#cf4a3e', '#a06ad4', '#d47f2a', '#2ab5a0'];

/**
 * Put somebody on their own clan's team.
 *
 * THE WHOLE OF `per_clan` IN ONE FUNCTION. A drafted event gathers sign-ups and lets captains pick;
 * a per-clan event has no picking at all, because the answer is already known the moment somebody
 * enters — they play for the clan they came from. Their seat decides it, which is what a rivalry
 * between clans actually means.
 *
 * WHICH CLAN IS "THEIRS": the clan their account holds a MEMBER seat in, not the host of the event.
 * An account has at most one member seat (the partial unique index in 0017 enforces it), so this has
 * exactly one answer or none. None is the case worth thinking about — somebody with no clan at all
 * entering a clan-versus-clan board — and they are refused rather than parked on the host's team,
 * because silently playing for the host would distort the very thing the board is measuring.
 *
 * The team is created on first arrival rather than up front. A clan that was invited and never
 * turned up should not sit on the board as an empty row all event.
 */
export async function seatOnClanTeam(opts: {
  eventId: number;
  accountId: number;
  /** The participant row to attach, from the sign-up that just happened. */
  participantId: number;
}): Promise<{ ok: true; teamId: number } | { ok: false; reason: 'no-clan' }> {
  const [home] = await db
    .select({ clanId: clanMemberships.clanId, name: clans.name })
    .from(clanMemberships)
    .innerJoin(clans, eq(clans.id, clanMemberships.clanId))
    .where(
      and(
        eq(clanMemberships.accountId, opts.accountId),
        eq(clanMemberships.kind, 'member'),
        isNull(clanMemberships.leftAt),
      ),
    )
    .limit(1);

  if (!home) return { ok: false, reason: 'no-clan' };

  const existing = await db.query.teams.findFirst({
    where: and(eq(teams.eventId, opts.eventId), eq(teams.clanId, home.clanId)),
  });

  let teamId = existing?.id;
  if (teamId == null) {
    // How many teams the board already has, so the colour is stable rather than random — a clan
    // whose colour changed between two page loads would be very confusing on a board.
    const already = await db.select({ id: teams.id }).from(teams).where(eq(teams.eventId, opts.eventId));
    const [made] = await db
      .insert(teams)
      .values({
        eventId: opts.eventId,
        clanId: home.clanId,
        name: home.name,
        color: COLOURS[already.length % COLOURS.length],
      })
      .returning();
    teamId = made.id;
  }

  await db.update(eventParticipants).set({ teamId }).where(eq(eventParticipants.id, opts.participantId));
  return { ok: true, teamId };
}

/**
 * The clans currently fielding a team on this board, in join order.
 *
 * For the board's own header — "three clans, 41 players" is the fact that makes a multi-clan event
 * legible at a glance, and it cannot be derived from the team list alone once drafted teams are also
 * possible.
 */
export async function clansOnBoard(eventId: number): Promise<{ clanId: number; name: string; teamId: number }[]> {
  const rows = await db
    .select({ teamId: teams.id, clanId: teams.clanId, name: clans.name })
    .from(teams)
    .innerJoin(clans, eq(clans.id, teams.clanId))
    .where(eq(teams.eventId, eventId))
    .orderBy(teams.id);
  return rows.filter((r): r is { teamId: number; clanId: number; name: string } => r.clanId != null);
}

/** Accounts that entered but hold no member seat anywhere — the case per_clan cannot place. */
export async function unplaceable(eventId: number): Promise<number> {
  const rows = await db
    .select({ id: eventParticipants.id })
    .from(eventParticipants)
    .where(and(eq(eventParticipants.eventId, eventId), isNull(eventParticipants.teamId)));
  return rows.length;
}

export { COLOURS as CLAN_TEAM_COLOURS };
