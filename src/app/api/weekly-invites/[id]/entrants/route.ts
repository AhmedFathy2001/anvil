import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { parseEntrantsChoice, setPartnerEntrants } from '@/lib/competitionTeamsDb';

/**
 * A partner clan changes who races for it after accepting: all members, or a picked list of RSNs.
 * Owner/admin of the partner clan only (checked in lib/competitionTeamsDb).
 * Body: { entrants: 'all' | 'selected', rsns?: string[] }
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });
  const choice = parseEntrantsChoice(await request.json().catch(() => null));
  if (!choice) return NextResponse.json({ error: "entrants must be 'all' or 'selected'" }, { status: 400 });
  const r = await setPartnerEntrants(id, session.userId, choice);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 403 });
  return NextResponse.json({ ok: true, unknown: r.unknown });
}
