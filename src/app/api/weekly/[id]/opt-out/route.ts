import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { resolveClanFromRequest } from '@/lib/clanContext';
import { competitionForClan, entryStatus, setOptOut } from '@/lib/competitionTeamsDb';

/**
 * "You're in · Opt out" on the competition page and events list. The signed-in person opts every
 * character of theirs out of (or back into) this one competition. The competition must be visible
 * to the clan the request addresses (its own, or a clan-vs-clan one it accepted).
 *
 * GET → { entered, optedOut }   POST { optOut: boolean } → { entered, optedOut }
 */
async function scope(request: Request, params: Promise<{ id: string }>) {
  const session = await verifyUser();
  if (!session?.playerId) return { error: NextResponse.json({ error: 'Sign in first.' }, { status: 401 }) };
  const clan = await resolveClanFromRequest(request);
  const id = Number((await params).id);
  const scoped = clan && Number.isInteger(id) ? await competitionForClan(clan.id, id) : null;
  if (!scoped) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  return { id, playerId: session.playerId };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await scope(request, params);
  if ('error' in s) return s.error;
  return NextResponse.json(await entryStatus(s.id, { playerId: s.playerId }));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await scope(request, params);
  if ('error' in s) return s.error;
  const body = await request.json().catch(() => null);
  if (typeof body?.optOut !== 'boolean') return NextResponse.json({ error: 'optOut must be true or false' }, { status: 400 });
  const r = await setOptOut(s.id, { playerId: s.playerId }, body.optOut);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json(await entryStatus(s.id, { playerId: s.playerId }));
}
