// Taking yourself off a clan's roster.
//
// Every other way a seat ends belongs to somebody else: a roster sync drops you, an admin removes
// you, a ban bars you. Nothing let the person themselves say no — and seats arrive without being
// asked for. An admin adds a name by hand, a plugin session seats you as a guest of a clan you were
// only visiting, and from then on you are listed there, on their People page and in their event
// pools, with no control of your own.
//
// WHAT THIS CANNOT DO, and the reason is the model rather than caution: membership of a clan that
// syncs its in-game roster is the ROSTER's word, not the site's. Ending such a seat here would last
// until the next push and then silently come back, so it is refused with the one instruction that
// actually works — leave the clan chat in game, and the site follows within the sync.
//
// A seat ended this way is marked `source: 'manual'`, which is what stops the plugin's own
// seat-keeping from quietly re-adding it the next time they play (see auth.seatOwnedCharacterAsGuest).
// A sync that finds them back on the in-game roster still revives it, which is correct: that is the
// roster speaking, and by then they have rejoined in game.

import { and, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanAuditLog, clanMemberships } from '@/db/schema';

export type LeaveResult =
  | { ok: true; seats: number }
  | { ok: false; code: 'no_seat' | 'in_game_member'; error: string };

export async function leaveClanAsPerson(input: {
  clanId: number;
  /** The PERSON leaving — session.playerId, never session.userId. */
  playerId: number;
  actorUserId?: number | null;
  clanName?: string;
}): Promise<LeaveResult> {
  const seats = await db
    .select({
      id: clanMemberships.id,
      kind: clanMemberships.kind,
      source: clanMemberships.source,
      rsn: accounts.rsn,
    })
    .from(clanMemberships)
    .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
    .where(
      and(
        eq(clanMemberships.clanId, input.clanId),
        eq(accounts.playerId, input.playerId),
        isNull(clanMemberships.leftAt),
      ),
    );

  if (seats.length === 0) {
    return { ok: false, code: 'no_seat', error: 'You are not on this clan’s roster.' };
  }

  // The in-game roster put them here, so the in-game roster is what takes them away.
  const inGame = seats.filter((s) => s.kind === 'member' && s.source === 'roster');
  if (inGame.length > 0) {
    return {
      ok: false,
      code: 'in_game_member',
      error: `You are on ${input.clanName ?? 'this clan'}’s in-game roster, so the next roster sync would put you straight back. Leave the clan chat in game and this follows on its own.`,
    };
  }

  const now = new Date().toISOString();
  const ids = seats.map((s) => s.id);
  await db
    .update(clanMemberships)
    // `manual` is the load-bearing half: it records that a PERSON ended this, which is what keeps
    // the plugin's seat-keeping and the sync's revival from treating it as an accident.
    .set({ leftAt: now, source: 'manual' })
    .where(inArray(clanMemberships.id, ids));

  for (const seat of seats) {
    db.insert(clanAuditLog)
      .values({
        clanId: input.clanId,
        clanMemberId: seat.id,
        eventType: 'left',
        actorUserId: input.actorUserId ?? null,
        oldValue: JSON.stringify({ rsn: seat.rsn, kind: seat.kind }),
        notes: 'Left by their own choice, from their profile',
      })
      .catch(() => {});
  }

  return { ok: true, seats: seats.length };
}
