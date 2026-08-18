import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth';
import { revokeInvite } from '@/lib/teamInvitesStore';
import { isWellFormedToken } from '@/lib/teamInvites';

/**
 * Turn a link off.
 *
 * A revoke never deletes the row: it is the record of who was let in through it, and a host asking
 * "where did these six players come from" deserves an answer. Idempotent — revoking an already-off
 * link is a 200, because the caller's intent is already true.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ eventId: string; token: string }> },
) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { eventId, token } = await params;
  const id = parseInt(eventId, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });
  // Shape-checked before it becomes a query, the same guard the join path uses.
  if (!isWellFormedToken(token)) return NextResponse.json({ error: 'Invalid invite' }, { status: 400 });

  const revoked = await revokeInvite(id, token);
  return NextResponse.json({ ok: true, revoked });
}
