import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { canSeeClan } from '@/lib/clanAccess';
import { requireClan } from '@/lib/clanContext';
import { setGoing } from '@/lib/clanEvents';
import { rateLimitByKey } from '@/lib/rate-limit';

// "I'm going" on a clan event, for its occurrence on now or next. A member of the clan (a seat or
// a staff grant), signed in; the plugin's own path is the panel's `going` action (lib/pluginUi/views).

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyUser();
  if (!user) return NextResponse.json({ error: 'Sign in to say you’re going.' }, { status: 401 });
  const clan = await requireClan();
  if (!(await canSeeClan({ clanId: clan.id, visibility: 'private', playerId: user.playerId, userId: user.userId }))) {
    return NextResponse.json({ error: 'Only members of this clan can say they’re going.' }, { status: 403 });
  }
  const limit = await rateLimitByKey('clan-event-going', String(user.userId), { limit: 20, windowMs: 60_000 });
  if (!limit.ok) return NextResponse.json({ error: 'Slow down a moment.' }, { status: 429 });
  const body = (await request.json().catch(() => ({}))) as { going?: unknown };
  const view = await setGoing(clan.id, Number((await params).id), user.userId, body.going !== false);
  return view ? NextResponse.json({ event: view }) : NextResponse.json({ error: 'That event is over.' }, { status: 404 });
}
