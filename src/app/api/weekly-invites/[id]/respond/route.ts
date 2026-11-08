import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { parseEntrantsChoice, respondToCompetitionInvite } from '@/lib/competitionTeamsDb';

/**
 * The invited clan answers a clan-vs-clan competition invite. Addressed by invite id, not scoped to
 * the host — the person answering is in the invited clan. Authority is checked in
 * lib/competitionTeamsDb: only an owner/admin (clan_staff) of the invited clan may answer.
 *
 * Body: { action: 'accept' | 'decline' | 'block', entrants?: 'all' | 'selected', rsns?: string[] }
 * 'block' = decline and block the host clan (lib/clanBlocks).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });
  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (action !== 'accept' && action !== 'decline' && action !== 'block') {
    return NextResponse.json({ error: 'action must be accept, decline or block' }, { status: 400 });
  }
  const choice = parseEntrantsChoice(body);
  if (!choice) return NextResponse.json({ error: "entrants must be 'all' or 'selected'" }, { status: 400 });
  const r = await respondToCompetitionInvite(id, session.userId, action, choice);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 403 });
  return NextResponse.json({ ok: true, competitionId: r.competitionId, unknown: r.unknown ?? [] });
}
