import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { users } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { inboxFor, markRead } from '@/lib/notices';
import { rateLimitByKey } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// The signed-in person's notices from Anvil (lib/notices) — PLATFORM, not clan: the same inbox on
// every host. GET ?count=1 is the bell's cheap poll; GET is the list; POST marks read or sets the
// two notification preferences (sound on the site, DMs from the bot).

export async function GET(request: Request) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const me = await db.query.users.findFirst({ where: eq(users.id, session.userId), columns: { noticeSound: true, anvilDms: true } });
  const { notices, unread } = await inboxFor(session.userId);
  const prefs = { sound: !!me?.noticeSound, dms: me?.anvilDms === 'yes' };
  if (new URL(request.url).searchParams.get('count') === '1') {
    return NextResponse.json({ unread, newest: notices.find((n) => !n.read)?.id ?? null, ...prefs });
  }
  return NextResponse.json({ notices, unread, ...prefs });
}

export async function POST(request: Request) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const rl = await rateLimitByKey('notices', String(session.userId), { limit: 60, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many' }, { status: 429 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Bad body' }, { status: 400 });

  if (body.action === 'read') {
    const ids = body.all === true ? 'all' : Array.isArray(body.ids) ? body.ids.map(Number).filter((n: number) => Number.isInteger(n) && n > 0) : [];
    await markRead(session.userId, ids);
    return NextResponse.json({ ok: true });
  }
  if (body.action === 'prefs') {
    const set: { noticeSound?: boolean; anvilDms?: 'yes' | 'no' } = {};
    if (typeof body.sound === 'boolean') set.noticeSound = body.sound;
    if (typeof body.dms === 'boolean') set.anvilDms = body.dms ? 'yes' : 'no';
    if (Object.keys(set).length) await db.update(users).set(set).where(eq(users.id, session.userId));
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
