import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { canSeeClan } from '@/lib/clanAccess';
import { requireClan } from '@/lib/clanContext';
import { answerSurvey } from '@/lib/clanEventSurvey';
import { rateLimitByKey } from '@/lib/rate-limit';

// Answer a clan event's survey — once per person, about the occurrence that just ended (lib/clanEventSurvey).

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyUser();
  if (!user) return NextResponse.json({ error: 'Sign in to answer.' }, { status: 401 });
  const clan = await requireClan();
  if (!(await canSeeClan({ clanId: clan.id, visibility: 'private', playerId: user.playerId, userId: user.userId }))) {
    return NextResponse.json({ error: 'Only members of this clan can answer.' }, { status: 403 });
  }
  if (!(await rateLimitByKey('clan-event-survey', String(user.userId), { limit: 10, windowMs: 60_000 })).ok) {
    return NextResponse.json({ error: 'Slow down a moment.' }, { status: 429 });
  }
  const { answers } = (await request.json().catch(() => ({}))) as { answers?: unknown };
  const r = await answerSurvey(clan.id, Number((await params).id), user.userId, answers);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.status });
}
