import { NextResponse } from 'next/server';

import { type UserPayload, verifyUser } from '@/lib/auth';
import { canSeeClan } from '@/lib/clanAccess';
import { requireClan } from '@/lib/clanContext';
import { signUp, withdraw } from '@/lib/clanEventSignups';
import { refreshClanEventPost } from '@/lib/clanEvents';
import { rateLimitByKey } from '@/lib/rate-limit';

// Sign up for a clan event (or change your answers), and take your name off. Members of the clan
// only, signed in — the same door as "I'm going" (api/clan-events/[id]/going).

async function member(): Promise<{ user: UserPayload; clanId: number } | NextResponse> {
  const user = await verifyUser();
  if (!user) return NextResponse.json({ error: 'Sign in to sign up.' }, { status: 401 });
  const clan = await requireClan();
  if (!(await canSeeClan({ clanId: clan.id, visibility: 'private', playerId: user.playerId, userId: user.userId }))) {
    return NextResponse.json({ error: 'Only members of this clan can sign up.' }, { status: 403 });
  }
  if (!(await rateLimitByKey('clan-event-signup', String(user.userId), { limit: 20, windowMs: 60_000 })).ok) {
    return NextResponse.json({ error: 'Slow down a moment.' }, { status: 429 });
  }
  return { user, clanId: clan.id };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const m = await member();
  if (m instanceof NextResponse) return m;
  const body = (await request.json().catch(() => ({}))) as { clanMemberId?: unknown; answers?: unknown };
  const who = { userId: m.user.userId, playerId: m.user.playerId, displayName: m.user.username };
  const id = Number((await params).id);
  const r = await signUp(m.clanId, id, who, body);
  if (r.ok) await refreshClanEventPost(m.clanId, id);
  return r.ok ? NextResponse.json({ status: r.value.status, fee: r.value.feeStatus }) : NextResponse.json({ error: r.error }, { status: r.status });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const m = await member();
  if (m instanceof NextResponse) return m;
  const id = Number((await params).id);
  const r = await withdraw(m.clanId, id, m.user.userId);
  if (r.ok) await refreshClanEventPost(m.clanId, id);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.status });
}
