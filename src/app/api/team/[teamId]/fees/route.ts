import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanRoster, events, eventSignups, eventParticipants, signupFees, teams, users } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { markFeeCollected } from '@/lib/feeConfirmations';
import { requireTeamManager } from '@/lib/teamStaff';

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

/** The signups behind this team's roster — the only fees this endpoint will ever touch. */
async function teamSignupIds(eventId: number, teamId: number): Promise<number[]> {
  const roster = await db
    .select({ clanMemberId: eventParticipants.clanMemberId })
    .from(eventParticipants)
    .where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.teamId, teamId)));
  const memberIds = roster.map((r) => r.clanMemberId).filter((id): id is number => id != null);
  if (memberIds.length === 0) return [];

  const signups = await db
    .select({ id: eventSignups.id })
    .from(eventSignups)
    .where(and(eq(eventSignups.eventId, eventId), inArray(eventSignups.clanMemberId, memberIds)));
  return signups.map((s) => s.id);
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
