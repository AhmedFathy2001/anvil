import { NextResponse } from 'next/server';
import { verifyAdmin, verifyUser } from '@/lib/auth';
import { createInvite, listInvites } from '@/lib/teamInvitesStore';
import { describeInvite, invitePath } from '@/lib/teamInvites';

/**
 * The links a host hands to a visiting clan.
 *
 * Admin-only, deliberately — the same call made about `team_staff` seats. Minting a link is deciding
 * that people may join a team without further approval, which is a host decision; a manager who
 * could mint their own would be deciding the size of their own side. Once minted, sharing it is
 * entirely the other clan's business, which is the point.
 */

const MAX_LABEL = 60;
/** A year is longer than any event; past that the field is a typo, not an intention. */
const MAX_EXPIRY_MS = 365 * 24 * 60 * 60 * 1000;
const MAX_SEATS = 500;

export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { eventId } = await params;
  const id = parseInt(eventId, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });

  const now = Date.now();
  const invites = await listInvites(id);
  return NextResponse.json({
    invites: invites.map((i) => ({
      ...i,
      // Composed here so the panel and any other reader can't word it differently.
      summary: describeInvite(i, now),
      path: invitePath(i.eventId, i.token),
    })),
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const session = await verifyUser();
  if (!session || !(await verifyAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { eventId } = await params;
  const id = parseInt(eventId, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });

  let body: { teamId?: unknown; label?: unknown; maxUses?: unknown; expiresAt?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const teamId = typeof body?.teamId === 'number' ? body.teamId : NaN;
  if (!Number.isFinite(teamId)) return NextResponse.json({ error: 'Pick a team' }, { status: 400 });

  const label = typeof body?.label === 'string' && body.label.trim() ? body.label.trim().slice(0, MAX_LABEL) : null;

  // Absent or null means unlimited, which is a real choice — an open link for a clan whose numbers
  // aren't settled. Only a NUMBER is treated as a limit, so a malformed value can't silently uncap.
  let maxUses: number | null = null;
  if (body?.maxUses != null) {
    const n = typeof body.maxUses === 'number' ? Math.floor(body.maxUses) : NaN;
    if (!Number.isFinite(n) || n < 1 || n > MAX_SEATS) {
      return NextResponse.json({ error: `Seats must be between 1 and ${MAX_SEATS}, or left empty for no limit` }, { status: 400 });
    }
    maxUses = n;
  }

  let expiresAt: string | null = null;
  if (body?.expiresAt != null && body.expiresAt !== '') {
    const parsed = typeof body.expiresAt === 'string' ? Date.parse(body.expiresAt) : NaN;
    if (!Number.isFinite(parsed) || parsed <= Date.now()) {
      return NextResponse.json({ error: 'An expiry has to be in the future' }, { status: 400 });
    }
    if (parsed - Date.now() > MAX_EXPIRY_MS) {
      return NextResponse.json({ error: 'That expiry is more than a year out' }, { status: 400 });
    }
    expiresAt = new Date(parsed).toISOString();
  }

  const result = await createInvite({ eventId: id, teamId, label, maxUses, expiresAt, createdByUserId: session.userId });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({
    invite: result.invite,
    path: invitePath(id, result.invite.token),
  });
}
