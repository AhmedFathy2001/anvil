import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { events, tiles } from '@/db/schema';
import { verifyAdminOrModerator } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { isAcceptedCohost } from '@/lib/coHost';
import { notifyBoardRevealed } from '@/lib/discord';
import { eventInClan } from '@/lib/eventScope';
import { parseEventRules, visibleTiles } from '@/lib/eventRules';

/**
 * Send the exact reveal embed to THIS clan's bingo channel only. It never flips tilesRevealed and
 * never fans out, so a host can test tomorrow's image without announcing it to co-host servers.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const eventId = Number((await params).eventId);
  if (!Number.isInteger(eventId) || eventId <= 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!(await verifyAdminOrModerator())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const clan = await requireClan();

  const own = await eventInClan(clan.id, eventId);
  if (!own && !(await isAcceptedCohost(eventId, clan.id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const event = own ?? (await db.query.events.findFirst({ where: eq(events.id, eventId) }));
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const allTiles = await db.select().from(tiles).where(eq(tiles.eventId, event.id));
  const tileCount = visibleTiles(parseEventRules(event.rules), allTiles).length;
  const sent = await notifyBoardRevealed({
    clanId: clan.id,
    eventId: event.id,
    eventName: event.name,
    startDate: event.startDate,
    revealedAt: `test-${Date.now()}`,
    tileCount,
    test: true,
  });
  return sent
    ? NextResponse.json({ sent: true })
    : NextResponse.json({ error: 'No bingo webhook is configured, or Discord refused the post.' }, { status: 409 });
}
