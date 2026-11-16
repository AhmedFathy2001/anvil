// What waits on a character being confirmed, and what happens to it when the answer arrives.
//
// Somebody who asked a clan's staff to vouch for a character (lib/characterState: the `manual` path)
// may sign up at once, but the entry is HELD: pending, in the pool, on no team. Two things end the
// wait, and both land here so they cannot disagree:
//
//   confirmed  staff vouch in Needs review, or the person's own plugin later reports the character.
//              Every held entry in that clan's events completes: approved and seated on the team
//              where a team's invite already carried the host's yes, otherwise an ordinary pending
//              entry the host answers like any other.
//   declined   staff say "not a member" (or a proven owner takes the character): the entries are
//              withdrawn and come off the board.

import { and, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanAuditLog, clanMemberships, clans, eventParticipants, eventSignups, events, signupFees, teamInvites, teams, userNotices, users } from '@/db/schema';
import { isEventOver } from '@/lib/eventLock';
import { captureStartingStatsSoon } from '@/lib/startingStats';
import { checkInvite } from '@/lib/teamInvites';

const HELD_INVITE = 'signup_held_invite';

/** A held sign-up arrived through a team's invite: remember which, so the yes survives the wait. */
export async function noteHeldInvite(opts: { clanId: number; seatId: number; signupId: number; eventId: number; inviteId: number }): Promise<void> {
  await db.insert(clanAuditLog).values({
    clanId: opts.clanId,
    clanMemberId: opts.seatId,
    eventType: HELD_INVITE,
    newValue: JSON.stringify({ signupId: opts.signupId, eventId: opts.eventId, inviteId: opts.inviteId }),
    notes: 'Signed up through a team invite while the character waits for staff; the invite is used when staff vouch.',
  });
}

export interface WithdrawnEntry {
  eventId: number;
  eventName: string;
}

/**
 * Withdraw every live sign-up made on this seat. An untouched fee goes with it, and so does a pool
 * place (no team): a withdrawn name left in the pool could still be drafted. Somebody already ON a
 * team is left on the board for the host to remove there, since a team place can carry progress.
 */
export async function withdrawSeatEntries(seatId: number): Promise<WithdrawnEntry[]> {
  const now = new Date().toISOString();
  const withdrawn = await db
    .update(eventSignups)
    .set({ status: 'withdrawn', updatedAt: now })
    .where(and(eq(eventSignups.clanMemberId, seatId), inArray(eventSignups.status, ['pending', 'approved'])))
    .returning({ id: eventSignups.id, eventId: eventSignups.eventId });
  if (withdrawn.length === 0) return [];
  await db.delete(signupFees).where(and(inArray(signupFees.signupId, withdrawn.map((w) => w.id)), eq(signupFees.status, 'pending')));
  await db
    .delete(eventParticipants)
    .where(and(inArray(eventParticipants.eventId, withdrawn.map((w) => w.eventId)), eq(eventParticipants.clanMemberId, seatId), isNull(eventParticipants.teamId)));
  // clan-scope: global -- the events of this seat's own sign-ups, by id.
  const named = await db.select({ id: events.id, name: events.name }).from(events).where(inArray(events.id, withdrawn.map((w) => w.eventId)));
  return named.map((e) => ({ eventId: e.id, eventName: e.name }));
}

export interface CompletedEntries {
  /** Approved and on a team: the invite they came through already carried the host's yes. */
  approved: { eventId: number; eventName: string; teamName: string }[];
  /** An ordinary pending entry now: the host answers it. */
  waiting: { eventId: number; eventName: string }[];
}

/**
 * The character behind this seat has just been confirmed: finish what was held for it in this clan.
 * Safe to call again (nothing pending is nothing to do). Only this clan's events: another clan's
 * staff vouching says nothing about entries elsewhere, and a plugin proof calls this per seat.
 */
export async function completeHeldEntries(opts: { clanId: number; seatId: number; actorUserId: number | null; by: 'staff' | 'plugin' }): Promise<CompletedEntries> {
  const out: CompletedEntries = { approved: [], waiting: [] };
  const held = await db
    .select({ signup: eventSignups, event: events })
    .from(eventSignups)
    .innerJoin(events, eq(events.id, eventSignups.eventId))
    .where(and(eq(eventSignups.clanMemberId, opts.seatId), eq(eventSignups.status, 'pending'), eq(events.clanId, opts.clanId)));
  if (held.length === 0) return out;

  const notes = await db
    .select({ newValue: clanAuditLog.newValue })
    .from(clanAuditLog)
    .where(and(eq(clanAuditLog.clanMemberId, opts.seatId), eq(clanAuditLog.eventType, HELD_INVITE)))
    .orderBy(desc(clanAuditLog.id));
  const inviteBySignup = new Map<number, number>();
  for (const n of notes) {
    try {
      const v = JSON.parse(n.newValue ?? '{}') as { signupId?: number; inviteId?: number };
      if (typeof v.signupId === 'number' && typeof v.inviteId === 'number' && !inviteBySignup.has(v.signupId)) inviteBySignup.set(v.signupId, v.inviteId);
    } catch {
      /* not ours */
    }
  }

  const now = new Date().toISOString();
  for (const { signup, event } of held) {
    if (isEventOver(event)) continue;
    const inviteId = inviteBySignup.get(signup.id);
    const invite = inviteId != null ? await db.query.teamInvites.findFirst({ where: eq(teamInvites.id, inviteId) }) : null;
    const team = invite ? await db.query.teams.findFirst({ where: eq(teams.id, invite.teamId) }) : null;
    // The invite is checked again now, exactly as the form checks it: it may have been turned off,
    // run out or expired while they waited, and then it is the host's call like any other entry.
    const good = !!invite && !!team && team.eventId === event.id && event.signupsEnabled !== false && checkInvite(invite, { now: Date.now(), eventId: event.id, signupsOpen: true }).ok;
    const took = good
      ? (
          await db
            .update(teamInvites)
            .set({ uses: sql`${teamInvites.uses} + 1` })
            .where(and(eq(teamInvites.id, invite!.id), or(isNull(teamInvites.maxUses), lt(teamInvites.uses, teamInvites.maxUses))))
            .returning({ id: teamInvites.id })
        )[0]
      : null;
    if (!took || !team) {
      out.waiting.push({ eventId: event.id, eventName: event.name });
      continue;
    }
    const [approved] = await db
      .update(eventSignups)
      .set({ status: 'approved', updatedAt: now })
      .where(and(eq(eventSignups.id, signup.id), eq(eventSignups.status, 'pending')))
      .returning({ id: eventSignups.id });
    if (!approved) {
      await db.update(teamInvites).set({ uses: sql`greatest(${teamInvites.uses} - 1, 0)` }).where(eq(teamInvites.id, invite!.id));
      continue;
    }
    // Their pool place moves onto the invite's team; somebody the host already placed is left there.
    const moved = await db
      .update(eventParticipants)
      .set({ teamId: team.id })
      .where(and(eq(eventParticipants.eventId, event.id), eq(eventParticipants.clanMemberId, opts.seatId), isNull(eventParticipants.teamId)))
      .returning({ id: eventParticipants.id });
    if (moved.length > 0) captureStartingStatsSoon(event.id, moved.map((m) => m.id));
    out.approved.push({ eventId: event.id, eventName: event.name, teamName: team.name });
  }

  if (out.approved.length + out.waiting.length > 0) {
    await db
      .insert(clanAuditLog)
      .values({
        clanId: opts.clanId,
        clanMemberId: opts.seatId,
        eventType: 'held_entries_completed',
        actorUserId: opts.actorUserId,
        newValue: JSON.stringify({ by: opts.by, approved: out.approved.map((e) => e.eventId), waiting: out.waiting.map((e) => e.eventId) }),
      })
      .catch(() => {});
  }
  return out;
}

/**
 * Tell the person what staff decided, on the site (user_notices: Settings > Characters, with its
 * unread badge). Never a Discord identity in the text; the in-game name and the clan's name only.
 */
export async function tellSeatOwner(opts: {
  clanId: number;
  seatId: number;
  outcome: 'vouched' | 'declined' | 'plugin';
  completed?: CompletedEntries;
  withdrawn?: WithdrawnEntry[];
}): Promise<void> {
  const [seat] = await db
    .select({ rsn: accounts.rsn, playerId: accounts.playerId, claimedAt: accounts.claimedAt, clanName: clans.name })
    .from(clanMemberships)
    .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
    .innerJoin(clans, eq(clans.id, clanMemberships.clanId))
    .where(and(eq(clanMemberships.id, opts.seatId), eq(clanMemberships.clanId, opts.clanId)));
  if (!seat?.claimedAt || seat.playerId == null) return;
  const logins = await db.select({ id: users.id }).from(users).where(eq(users.playerId, seat.playerId));
  if (logins.length === 0) return;
  const text = seatOutcomeText({ ...opts, rsn: seat.rsn, clanName: seat.clanName });
  const createdAt = new Date().toISOString();
  await db.insert(userNotices).values(logins.map((l) => ({ userId: l.id, kind: `seat-${opts.outcome}`, refId: opts.seatId, title: text.title, body: text.body, createdAt })));
}

/** The words of that notice. Pure, so the test reads them without a database. */
export function seatOutcomeText(opts: {
  outcome: 'vouched' | 'declined' | 'plugin';
  rsn: string;
  clanName: string;
  completed?: CompletedEntries;
  withdrawn?: WithdrawnEntry[];
}): { title: string; body: string } {
  if (opts.outcome === 'declined') {
    const gone = opts.withdrawn ?? [];
    return {
      title: `${opts.clanName}: staff did not confirm ${opts.rsn}`,
      body:
        `Your guest place in ${opts.clanName} was removed` +
        (gone.length > 0 ? ` and your sign-up for ${list(gone.map((e) => e.eventName))} was withdrawn. ` : '. ') +
        `${opts.rsn} is still linked to you. To ask again, sign in to the Anvil plugin on that character or pass the XP check first.`,
    };
  }
  const done = opts.completed ?? { approved: [], waiting: [] };
  const parts: string[] = [];
  for (const e of done.approved) parts.push(`You are on ${e.teamName} in ${e.eventName}.`);
  if (done.waiting.length > 0) parts.push(`Your sign-up for ${list(done.waiting.map((e) => e.eventName))} now waits for the host like any other.`);
  return {
    title: opts.outcome === 'plugin' ? `${opts.rsn} is confirmed by the plugin` : `${opts.clanName}: staff confirmed ${opts.rsn}`,
    body: [`${opts.rsn} is confirmed in ${opts.clanName}; nothing is held any more.`, ...parts].join(' '),
  };
}

function list(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
