import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanRoster, events, eventSignups, eventParticipants, signupFees, teams, users } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { markFeeCollected } from '@/lib/feeConfirmations';
import { requireTeamManager } from '@/lib/teamStaff';
import { del } from '@/lib/storage';

/**
 * Sign-up fees for one team's own players, and marking them paid.
 *
 * Fees were treasurer/admin-only, which works for a clan running its own event and not at all for a
 * clan-v-clan: half the roster's money is collected by someone with no account here. A team's
 * manager can now settle their own side — and only their own side, since every read and write below
 * is filtered to the players actually on this team.
 *
 * Disputes, second signatures and the audit line are the shared behaviour in lib/feeConfirmations —
 * a fee marked paid from here is indistinguishable from one marked paid by a treasurer, which is
 * the point.
 */

/**
 * The signups behind this team's roster — the only fees this endpoint will ever touch.
 *
 * MATCHED BY SEAT AND BY PERSON. A sign-up is made on a seat and never moves; the roster row is what
 * the board follows, and an admin can re-point it at another of that person's characters. Keyed on
 * the seat alone, a swapped player's sign-up was not found — so their fee silently vanished from
 * the captain's collection list, which on a paid board is money nobody is asked for.
 *
 * THIS IS A SCOPE FUNCTION, so the widening is deliberately narrow: still this event only, and
 * still only people on THIS team. It finds the right sign-up for a member of the team; it never
 * reaches a sign-up belonging to anybody else.
 */
async function teamSignupIds(eventId: number, teamId: number): Promise<number[]> {
  const roster = await db
    .select({ clanMemberId: eventParticipants.clanMemberId, personId: clanRoster.playerId })
    .from(eventParticipants)
    // clan-scope: this clan -- the driving query is already narrowed to one team of one event.
    .leftJoin(clanRoster, eq(eventParticipants.clanMemberId, clanRoster.id))
    .where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.teamId, teamId)));

  const memberIds = new Set(roster.map((r) => r.clanMemberId).filter((id): id is number => id != null));
  const personIds = new Set(roster.map((r) => r.personId).filter((id): id is number => id != null));
  if (memberIds.size === 0 && personIds.size === 0) return [];

  // Every sign-up on THIS event, with the person behind the seat it was made on. Narrowed to the
  // team below; an event's sign-up list is small enough that this stays one round trip.
  const signups = await db
    .select({ id: eventSignups.id, clanMemberId: eventSignups.clanMemberId, personId: clanRoster.playerId })
    .from(eventSignups)
    // clan-scope: this clan -- the driving query is already narrowed to this event's sign-ups.
    .leftJoin(clanRoster, eq(eventSignups.clanMemberId, clanRoster.id))
    .where(eq(eventSignups.eventId, eventId));

  return signups
    .filter((s) => memberIds.has(s.clanMemberId) || (s.personId != null && personIds.has(s.personId)))
    .map((s) => s.id);
}

/**
 * Whether THIS team collects, and what it is collecting.
 *
 * `host-holds` means exactly that: one clan takes the money and settles up afterwards
 * (lib/coHostSettlement turns it into who-owes-whom). A visiting team offered a collection list
 * under that policy is being invited to do something the event has already decided it will not do.
 */
async function feeContext(eventId: number, teamId: number) {
  // clan-scope: global -- the event is reached by id, through a team the caller already manages.
  const [event, team] = await Promise.all([
    db.query.events.findFirst({ where: eq(events.id, eventId) }),
    db.query.teams.findFirst({ where: eq(teams.id, teamId) }),
  ]);
  const signupFee = event?.signupFee ?? 0;
  const cashPolicy = event?.cashPolicy ?? 'host-holds';
  // A team with no clan tag is the host's own — lib/coHostSettlement reads it the same way.
  const isHostTeam = team?.clanId == null || team.clanId === event?.clanId;
  return {
    signupFee,
    cashPolicy,
    isHostTeam,
    collects: signupFee > 0 && (isHostTeam || cashPolicy !== 'host-holds'),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await params;
  const tId = parseInt(teamId, 10);
  if (!Number.isFinite(tId)) return NextResponse.json({ error: 'Invalid team id' }, { status: 400 });

  const guard = await requireTeamManager(tId);
  if ('response' in guard) return guard.response;
  const { management } = guard;

  // WHAT THE CLIENT CANNOT INFER. An empty list has three completely different meanings — the event
  // charges nothing, somebody else collects, or these players never had a sign-up to collect against
  // — and the panel read all three as the first, announcing "this event has no sign-up fee" on a
  // ten-million-gp event whose fees the host was holding. So the answer says which it is.
  const context = await feeContext(management.eventId, tId);

  const signupIds = await teamSignupIds(management.eventId, tId);
  if (signupIds.length === 0) return NextResponse.json({ fees: [], context });

  // clan-scope: global -- reached through team membership or a token, not through a clan — that is what lets a visiting clan's people use it.
  const rows = await db
    .select({
      id: signupFees.id,
      amount: signupFees.amount,
      status: signupFees.status,
      collectedByUserId: signupFees.collectedByUserId,
      collectedAt: signupFees.collectedAt,
      reportedAt: signupFees.reportedAt,
      rsn: clanRoster.rsn,
      displayName: users.displayName,
    })
    .from(signupFees)
    .innerJoin(eventSignups, eq(signupFees.signupId, eventSignups.id))
    .innerJoin(clanRoster, eq(eventSignups.clanMemberId, clanRoster.id))
    .leftJoin(users, eq(eventSignups.userId, users.id))
    .where(inArray(signupFees.signupId, signupIds));

  // Who took the money, by name. Without it the row said "collected" and nothing else, so a captain
  // who had just pressed the button couldn't tell their own click apart from a treasurer's — or from
  // nothing having happened at all.
  const collectorIds = [...new Set(rows.map((r) => r.collectedByUserId).filter((id): id is number => id != null))];
  const collectors = collectorIds.length
    ? await db.select({ id: users.id, displayName: users.displayName }).from(users).where(inArray(users.id, collectorIds))
    : [];
  const collectorName = new Map(collectors.map((c) => [c.id, c.displayName]));

  // Owed first — that's the list a manager is actually working through.
  const order: Record<string, number> = { pending: 0, disputed: 1, reported: 2, collected: 3, confirmed: 4 };
  rows.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || a.rsn.localeCompare(b.rsn));

  return NextResponse.json({
    context,
    fees: rows.map((r) => ({
      ...r,
      collectedByName: r.collectedByUserId != null ? collectorName.get(r.collectedByUserId) ?? null : null,
      // "was it me?" is the question the row has to answer, and the client doesn't know its own id.
      collectedByViewer: r.collectedByUserId != null && r.collectedByUserId === management.userId,
      // Whether the undo below would actually be allowed, decided HERE rather than re-derived in the
      // client — the rule has four parts and a button that appears and then 403s is worse than no
      // button. Mirrors the DELETE exactly.
      canUndo:
        management.delegated &&
        r.status !== 'confirmed' &&
        r.collectedByUserId != null &&
        r.collectedByUserId === management.userId,
    })),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await params;
  const tId = parseInt(teamId, 10);
  if (!Number.isFinite(tId)) return NextResponse.json({ error: 'Invalid team id' }, { status: 400 });

  const guard = await requireTeamManager(tId);
  if ('response' in guard) return guard.response;
  const { management } = guard;

  const body = (await request.json().catch(() => null)) as { feeId?: unknown; notes?: unknown } | null;
  const feeId = Number(body?.feeId);
  if (!Number.isFinite(feeId)) return NextResponse.json({ error: 'feeId is required' }, { status: 400 });

  const fee = await db.query.signupFees.findFirst({ where: eq(signupFees.id, feeId) });
  if (!fee) return NextResponse.json({ error: 'Fee not found' }, { status: 404 });

  // The gate: this fee must belong to someone on the team they manage.
  const signupIds = await teamSignupIds(management.eventId, tId);
  if (!signupIds.includes(fee.signupId)) {
    return NextResponse.json({ error: 'That fee is not on your team' }, { status: 403 });
  }
  if (fee.status === 'confirmed') {
    return NextResponse.json({ error: 'That fee is already settled' }, { status: 409 });
  }

  const notes = typeof body?.notes === 'string' && body.notes.trim() ? body.notes.trim().slice(0, 300) : null;
  const { fee: updated, settled } = await markFeeCollected(fee, management.userId, { notes });

  return NextResponse.json({ fee: updated, settled });
}

/**
 * Undo a collection this team recorded.
 *
 * WHY IT EXISTS. Marking paid was a one-way door for a manager: the wrong row gets ticked, or a
 * player turns out not to have sent it, and the only way back was to find a host admin. On a
 * clan-vs-clan board that is somebody in the other clan — which makes a clan's own staff ask their
 * opponent to fix their bookkeeping.
 *
 * DELEGATED TEAMS ONLY. A team on a clan-vs-clan board IS a clan (teams.clanId), and the people
 * running it are that clan's own staff undoing their own record. A drafted team's captain is a
 * player who was picked to pick, running a side drawn from several clans on somebody else's board;
 * money there stays with the host. See lib/teamStaff.
 *
 * NARROWER THAN THE ADMIN RESET, on purpose:
 *   - only a fee on their own team, like every other action here
 *   - only one they are recorded as having collected. Undoing somebody else's claim to hold gp is
 *     a dispute, and disputes go to the host.
 *   - never a settled one. Once an admin has signed it off the money is counted, and un-counting it
 *     is the host's call — the POST above already refuses to touch a confirmed fee for that reason.
 *
 * It returns to `reported` when the player has a standing report of having paid, else `pending` —
 * the same recomputation the admin route does, so the two cannot leave a fee in different shapes.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await params;
  const tId = parseInt(teamId, 10);
  if (!Number.isFinite(tId)) return NextResponse.json({ error: 'Invalid team id' }, { status: 400 });

  const guard = await requireTeamManager(tId);
  if ('response' in guard) return guard.response;
  const { management } = guard;

  if (!management.delegated) {
    return NextResponse.json(
      { error: 'Only a clan running its own team can undo a collection. Ask the host to reset it.' },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as { feeId?: unknown } | null;
  const feeId = Number(body?.feeId);
  if (!Number.isFinite(feeId)) return NextResponse.json({ error: 'feeId is required' }, { status: 400 });

  const fee = await db.query.signupFees.findFirst({ where: eq(signupFees.id, feeId) });
  if (!fee) return NextResponse.json({ error: 'Fee not found' }, { status: 404 });

  // The same gate the POST uses: this fee must belong to someone on the team they manage.
  const signupIds = await teamSignupIds(management.eventId, tId);
  if (!signupIds.includes(fee.signupId)) {
    return NextResponse.json({ error: 'That fee is not on your team' }, { status: 403 });
  }
  if (fee.status === 'confirmed') {
    return NextResponse.json(
      { error: 'That fee is already settled — the host has to reset it.' },
      { status: 409 },
    );
  }
  if (fee.collectedByUserId == null) {
    return NextResponse.json({ error: 'Nothing to undo — that fee is not marked paid.' }, { status: 409 });
  }
  if (fee.collectedByUserId !== management.userId) {
    return NextResponse.json(
      { error: 'Somebody else recorded that collection. The host settles who is holding it.' },
      { status: 403 },
    );
  }

  // Their own proof, of a collection they are withdrawing. Best-effort — a failed delete must not
  // block the record being corrected.
  if (fee.proofBlobUrl) del(fee.proofBlobUrl).catch(() => {});

  const nextStatus = fee.reportedCollectorUserId !== null ? 'reported' : 'pending';
  const [updated] = await db
    .update(signupFees)
    .set({
      status: nextStatus,
      collectedByUserId: null,
      collectedAt: null,
      proofBlobUrl: null,
      confirmedByUserId: null,
      confirmedAt: null,
      confirmations: null,
    })
    .where(eq(signupFees.id, fee.id))
    .returning();

  return NextResponse.json({ fee: updated });
}
