import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { events, tiles } from '@/db/schema';
import { boardRevealImage, verifyBoardRevealImageQuery } from '@/lib/boardRevealImage';
import { parseEventRules, visibleTiles } from '@/lib/eventRules';

export const dynamic = 'force-dynamic';

/** Signed image consumed by Discord's anonymous image proxy; see lib/boardRevealImage. */
export async function GET(request: Request) {
  const verified = verifyBoardRevealImageQuery(new URL(request.url).searchParams);
  if (!verified) return new Response('Not found', { status: 404 });

  // clan-scope: global -- this anonymous image has no clan request context; the unforgeable HMAC
  // identifies the exact event and is the read grant Discord's image proxy presents.
  const event = await db.query.events.findFirst({ where: eq(events.id, verified.eventId) });
  // The HMAC is the read grant. Keeping this usable while the master gate is still closed is what
  // lets staff send a private test post before tomorrow's public reveal without mutating the board.
  if (!event) return new Response('Not found', { status: 404 });

  const allTiles = await db.select().from(tiles).where(eq(tiles.eventId, event.id));
  // Never let a signed master-board image bypass per-tile staged reveals or hidden missions.
  const shown = visibleTiles(parseEventRules(event.rules), allTiles);
  return boardRevealImage({
    eventName: event.name,
    format: event.format,
    scoringMode: event.scoringMode,
    boardSize: event.boardSize,
    tiles: shown,
  });
}
