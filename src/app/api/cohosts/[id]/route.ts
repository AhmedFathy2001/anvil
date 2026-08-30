import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { endCoHosting } from '@/lib/coHost';

/**
 * Calling a co-host arrangement off — the host withdrawing, or the co-host leaving.
 *
 * Addressed by co-host id rather than under the event, because either clan may be the one acting and
 * only one of them is on the host's site. Authority is checked in lib/coHost: an admin of either
 * clan, and never once the event has started.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  const r = await endCoHosting(id, session.userId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 403 });
  return NextResponse.json({ ok: true, removedTeam: r.removedTeam });
}
