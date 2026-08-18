import { db } from '@/db';
import { clanMembers, eventSignups, events, players, signupFees, teamInvites, teams } from '@/db/schema';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { generatePlayerToken } from '@/lib/auth';
import { signupWindowState } from '@/lib/signup';
import {
  checkInvite,
  generateInviteToken,
  planJoin,
  type InviteCheck,
  type InviteRecord,
} from '@/lib/teamInvites';

/**
 * Storage for team invites — the database half of lib/teamInvites.
 *
 * Split for the same reason lib/moments is: every rule about whether a link still works lives in a
 * module with no imports, so it can be tested directly and so the join page, the join route and the
 * admin panel can't drift into disagreeing about it.
 */

/** How many links one event may have open at once. A host handing out more than this has a process
 *  problem, not a tooling one — and it keeps the panel readable. */
const MAX_INVITES_PER_EVENT = 40;

export interface InviteWithTeam extends InviteRecord {
  id: number;
  label: string | null;
  teamName: string;
  teamColor: string;
  createdAt: string;
}

function toRecord(row: typeof teamInvites.$inferSelect): InviteRecord {
  return {
    token: row.token,
    teamId: row.teamId,
    eventId: row.eventId,
    maxUses: row.maxUses,
    uses: row.uses,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
  };
}

/** Mint a link for one team. Host-only by policy — see the invites route for why. */
export async function createInvite(input: {
  eventId: number;
  teamId: number;
  label: string | null;
  maxUses: number | null;
  expiresAt: string | null;
  createdByUserId: number;
}): Promise<{ ok: true; invite: typeof teamInvites.$inferSelect } | { ok: false; error: string }> {
  const team = await db.query.teams.findFirst({ where: eq(teams.id, input.teamId) });
  // The team must belong to the event in the URL, or a link minted on one board would seat people
  // on another — the exact confusion `wrong-event` exists to catch, but on the writing side.
  if (!team || team.eventId !== input.eventId) {
    return { ok: false, error: 'That team is not on this event' };
  }

  const [{ open }] = await db
    .select({ open: sql<number>`count(*)` })
    .from(teamInvites)
    .where(and(eq(teamInvites.eventId, input.eventId), isNull(teamInvites.revokedAt)));
  if (Number(open) >= MAX_INVITES_PER_EVENT) {
    return { ok: false, error: `This event already has ${MAX_INVITES_PER_EVENT} live invites — turn some off first` };
  }

  const { randomBytes } = await import('node:crypto');
  const token = generateInviteToken((n) => new Uint8Array(randomBytes(n)));
  const [invite] = await db
    .insert(teamInvites)
    .values({
      token,
      eventId: input.eventId,
      teamId: input.teamId,
      label: input.label,
      maxUses: input.maxUses,
      expiresAt: input.expiresAt,
      createdByUserId: input.createdByUserId,
    })
    .returning();
  return { ok: true, invite };
}

/** Every link on an event, newest first, with the team it seats people onto. */
export async function listInvites(eventId: number): Promise<InviteWithTeam[]> {
  const rows = await db
    .select({
      id: teamInvites.id,
      token: teamInvites.token,
      eventId: teamInvites.eventId,
      teamId: teamInvites.teamId,
      label: teamInvites.label,
      maxUses: teamInvites.maxUses,
      uses: teamInvites.uses,
      expiresAt: teamInvites.expiresAt,
      revokedAt: teamInvites.revokedAt,
      createdAt: teamInvites.createdAt,
      teamName: teams.name,
      teamColor: teams.color,
    })
    .from(teamInvites)
    .innerJoin(teams, eq(teamInvites.teamId, teams.id))
    .where(eq(teamInvites.eventId, eventId))
    .orderBy(desc(teamInvites.createdAt));
  return rows;
}

/** Turn a link off. Never deletes: the row is the record of who was let in through it. */
export async function revokeInvite(eventId: number, token: string): Promise<boolean> {
  const result = await db
    .update(teamInvites)
    .set({ revokedAt: new Date().toISOString() })
    .where(and(eq(teamInvites.eventId, eventId), eq(teamInvites.token, token), isNull(teamInvites.revokedAt)))
    .returning({ id: teamInvites.id });
  return result.length > 0;
}

export interface ResolvedInvite {
  check: InviteCheck;
  invite: (InviteRecord & { label: string | null }) | null;
  teamName: string | null;
  teamColor: string | null;
  eventName: string | null;
}

/**
 * What the person who opened a link should be told, before they are asked to do anything.
 *
 * The event's own sign-up window decides `signupsOpen` — an invite is a way ONTO a team, never a way
 * around the calendar, so a link handed out early still refuses until sign-ups open, and says so.
 */
export async function resolveInvite(eventId: number, token: string, now = Date.now()): Promise<ResolvedInvite> {
  const row = await db.query.teamInvites.findFirst({ where: eq(teamInvites.token, token) });
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  const signupsOpen = event
    ? signupWindowState({
        signupOpensAt: event.signupOpensAt,
        signupDeadline: event.signupDeadline,
        startDate: event.startDate,
      }).open
    : false;

  const check = checkInvite(row ? toRecord(row) : null, { now, eventId, signupsOpen });
  if (!row) return { check, invite: null, teamName: null, teamColor: null, eventName: event?.name ?? null };

  const team = await db.query.teams.findFirst({ where: eq(teams.id, row.teamId) });
  return {
    check,
    invite: { ...toRecord(row), label: row.label },
    teamName: team?.name ?? null,
    teamColor: team?.color ?? null,
    eventName: event?.name ?? null,
  };
}

export type JoinOutcome =
  | { ok: true; alreadyOn: boolean; teamName: string; signupId: number }
  | { ok: false; error: string; status: number };

/**
 * Take a seat: sign this account up, approved, already on the team.
 *
 * Two things make this different from an ordinary sign-up, and both come from the link itself —
 * status is `approved` (the host already decided by handing the link out) and the pool player row
 * carries a `teamId` instead of waiting for a draft.
 *
 * The fee is NOT waived. A visiting clan pays like anyone else; what changed is who collects it,
 * which their own manager can now do from the team page (lib/teamStaff).
 *
 * Re-opening the link after joining is a no-op that costs no seat — `uses` counts sign-ups created,
 * and the seat is claimed with a conditional UPDATE so two people opening the last seat at the same
 * moment can't both take it.
 */
export async function joinViaInvite(input: {
  eventId: number;
  token: string;
  userId: number;
  clanMemberId: number;
}): Promise<JoinOutcome> {
  const resolved = await resolveInvite(input.eventId, input.token);
  if (!resolved.check.ok || !resolved.invite) {
    return { ok: false, error: resolved.check.message, status: 403 };
  }
  const { teamId } = resolved.invite;

  const account = await db.query.clanMembers.findFirst({ where: eq(clanMembers.id, input.clanMemberId) });
  if (!account || account.userId !== input.userId || account.leftAt) {
    return { ok: false, error: 'Pick an account that belongs to you and is still in the clan', status: 403 };
  }
  if (!account.verifiedAt) {
    return { ok: false, error: `${account.rsn} has to be verified before joining`, status: 403 };
  }

  const event = await db.query.events.findFirst({ where: eq(events.id, input.eventId) });
  if (!event) return { ok: false, error: 'Event not found', status: 404 };

  const existing = await db.query.eventSignups.findFirst({
    where: and(eq(eventSignups.eventId, input.eventId), eq(eventSignups.clanMemberId, input.clanMemberId)),
  });

  // Their pool/roster row for this event, if any. Read BEFORE anything is written: a join that is
  // going to be refused must not have claimed a seat or approved a sign-up on its way to refusing.
  const player = await db.query.players.findFirst({
    where: and(eq(players.eventId, input.eventId), eq(players.clanMemberId, input.clanMemberId)),
  });
  // Every decision about what this join means is made in lib/teamInvites, before a single write —
  // so a refusal can't leave a claimed seat or an approved sign-up behind it.
  const plan = planJoin({
    inviteTeamId: teamId,
    playerTeamId: player?.teamId ?? null,
    signupStatus: existing?.status ?? null,
  });
  if (plan.action === 'refuse') {
    return {
      ok: false,
      error: 'You are already on another team in this event. Ask the host if you need to move.',
      status: 409,
    };
  }
  const alreadyActive = !plan.claimSeat;
  const now = new Date().toISOString();

  if (plan.claimSeat) {
    // Claim the seat conditionally: the WHERE re-checks the limit, so the update touches no
    // rows when the last seat went to someone else between the check above and here.
    const claimed = await db
      .update(teamInvites)
      .set({ uses: sql`${teamInvites.uses} + 1` })
      .where(
        and(
          eq(teamInvites.token, input.token),
          isNull(teamInvites.revokedAt),
          sql`(${teamInvites.maxUses} is null or ${teamInvites.uses} < ${teamInvites.maxUses})`,
        ),
      )
      .returning({ id: teamInvites.id });
    if (claimed.length === 0) {
      return { ok: false, error: 'This invite is full — every seat it allowed has been taken.', status: 409 };
    }
  }

  let signupId: number;
  if (existing) {
    await db
      .update(eventSignups)
      .set({ status: 'approved', updatedAt: now })
      .where(eq(eventSignups.id, existing.id));
    signupId = existing.id;
  } else {
    const [row] = await db
      .insert(eventSignups)
      .values({
        eventId: input.eventId,
        userId: input.userId,
        clanMemberId: input.clanMemberId,
        profileData: '{}',
        status: 'approved',
        signedUpAt: now,
        updatedAt: now,
      })
      .returning({ id: eventSignups.id });
    signupId = row.id;
  }

  // The player row is what actually puts them on the team. An existing pool row is moved rather than
  // duplicated — someone who signed up normally and was then sent a link ends up on the team, not
  // twice in the event.
  if (player) {
    if (plan.assignTeam) {
      await db.update(players).set({ teamId }).where(eq(players.id, player.id));
    }
  } else {
    await db.insert(players).values({
      eventId: input.eventId,
      clanMemberId: input.clanMemberId,
      teamId,
      name: account.rsn,
      playerToken: generatePlayerToken(),
    });
  }

  // Same fee any other entrant owes. Their own manager settles it from the team page.
  if (event.signupFee && event.signupFee > 0) {
    const fee = await db.query.signupFees.findFirst({ where: eq(signupFees.signupId, signupId) });
    if (!fee) {
      await db.insert(signupFees).values({ signupId, amount: event.signupFee, status: 'pending' });
    }
  }

  return { ok: true, alreadyOn: alreadyActive, teamName: resolved.teamName ?? 'the team', signupId };
}
