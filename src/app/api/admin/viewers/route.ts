import { NextResponse } from 'next/server';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { clanRoster, events } from '@/db/schema';
import { verifyAdminOrModerator } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { makeEventPlayer, makeGuest, pastViewers } from '@/lib/eventPlayers';

/**
 * "Past viewers" (lib/eventPlayers): everybody who joined one of this clan's streamed events as an
 * event player, by event, and the two host controls —
 *
 *   POST { action: 'make-guest',  seatId }           an event player becomes a guest of the clan
 *   POST { action: 'make-viewer', seatId, eventId }  a guest goes back to being one event's player
 *
 * Moderator tier, like the roster (a clan treasurer included; a board-only grant not). Bans stay on the roster.
 */
async function guard() {
  const user = await verifyAdminOrModerator();
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { user, clan: await requireClan() };
}

export async function GET() {
  const g = await guard();
  if ('error' in g) return g.error;
  const [byEvent, guests, clanEvents] = await Promise.all([
    pastViewers(g.clan.id),
    // clan-scope: this clan -- its live guests, the people "make viewer" can apply to.
    db
      .select({ seatId: clanRoster.id, rsn: clanRoster.rsn })
      .from(clanRoster)
      .where(and(eq(clanRoster.clanId, g.clan.id), eq(clanRoster.kind, 'guest'), isNull(clanRoster.leftAt)))
      .orderBy(asc(clanRoster.rsn)),
    // clan-scope: this clan -- its own events, to pick which one.
    db.select({ id: events.id, name: events.name }).from(events).where(eq(events.clanId, g.clan.id)).orderBy(desc(events.id)).limit(100),
  ]);
  return NextResponse.json({ events: byEvent, guests, clanEvents });
}

export async function POST(request: Request) {
  const g = await guard();
  if ('error' in g) return g.error;
  const body = (await request.json().catch(() => null)) as { action?: unknown; seatId?: unknown; eventId?: unknown } | null;
  const seatId = Number(body?.seatId);
  if (!Number.isInteger(seatId) || seatId <= 0) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  if (body?.action === 'make-guest') {
    const r = await makeGuest(g.clan.id, seatId, g.user.userId);
    return r.ok ? NextResponse.json({ ok: true, seatId: r.seatId }) : NextResponse.json({ error: r.error }, { status: 400 });
  }
  if (body?.action === 'make-viewer') {
    const eventId = Number(body.eventId);
    if (!Number.isInteger(eventId) || eventId <= 0) return NextResponse.json({ error: 'Pick an event' }, { status: 400 });
    const r = await makeEventPlayer(g.clan.id, seatId, eventId, g.user.userId);
    return r.ok ? NextResponse.json({ ok: true, seatId: r.seatId }) : NextResponse.json({ error: r.error }, { status: 400 });
  }
  return NextResponse.json({ error: 'Bad request' }, { status: 400 });
}
