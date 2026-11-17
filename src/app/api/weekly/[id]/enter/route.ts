import { NextResponse } from 'next/server';

import { track } from '@/lib/analytics';
import { verifyUser } from '@/lib/auth';
import { resolveClanFromRequest } from '@/lib/clanContext';
import { competitionForClan } from '@/lib/competitionTeamsDb';
import { enterCompetition, leaveCompetition, myEntry } from '@/lib/weeklySignups';

/**
 * Signing yourself up for a competition that takes sign-ups (lib/weeklySignups).
 *
 * GET → { seats, entries }   POST { clanMemberId? } → enter   DELETE → take the sign-up back
 * The competition must be the addressed clan's own: a sign-up enters one of its seats.
 */
async function scope(request: Request, params: Promise<{ id: string }>) {
  const session = await verifyUser();
  if (!session?.playerId) return { error: NextResponse.json({ error: 'Sign in first.' }, { status: 401 }) };
  const clan = await resolveClanFromRequest(request);
  const id = Number((await params).id);
  const scoped = clan && Number.isInteger(id) ? await competitionForClan(clan.id, id) : null;
  // The clan's OWN competition: a partner clan's side is entered by that clan's staff.
  const comp = scoped?.owner ? scoped.comp : null;
  if (!comp) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  return { comp, session };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await scope(request, params);
  if ('error' in s) return s.error;
  return NextResponse.json(await myEntry(s.comp, s.session.playerId ?? null));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await scope(request, params);
  if ('error' in s) return s.error;
  const body = (await request.json().catch(() => ({}))) as { clanMemberId?: unknown };
  const r = await enterCompetition(s.comp, { userId: s.session.userId, playerId: s.session.playerId ?? null }, body);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  track('weekly.joined', { clanId: s.comp.clanId, userId: s.session.userId });
  return NextResponse.json({ entered: true, feeAmount: r.value.feeAmount, feeStatus: r.value.feeStatus });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await scope(request, params);
  if ('error' in s) return s.error;
  const r = await leaveCompetition(s.comp, { playerId: s.session.playerId ?? null });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ entered: false });
}
