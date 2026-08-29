import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { acceptCoHostInvite, declineCoHostInvite } from '@/lib/coHost';

/**
 * The invited clan answers a co-host invite. Addressed by co-host id (not clan-scoped to the host —
 * the person answering is in the OTHER clan). Authority is checked in lib/coHost: only an admin of the
 * invited clan may accept or decline. Accepting provisions their team + staff.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (action !== 'accept' && action !== 'decline') {
    return NextResponse.json({ error: 'action must be accept or decline' }, { status: 400 });
  }

  if (action === 'accept') {
    const r = await acceptCoHostInvite(id, session.userId);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 403 });
    return NextResponse.json({ ok: true, teamId: r.teamId });
  }

  const r = await declineCoHostInvite(id, session.userId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 403 });
  return NextResponse.json({ ok: true });
}
