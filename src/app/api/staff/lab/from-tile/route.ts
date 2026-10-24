import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { tiles } from '@/db/schema';
import { CAN_WRITE, requirePlatformApi } from '@/lib/platformAccess';
import { labSessionFromTile } from '@/lib/lab';

// POST /api/staff/lab/from-tile { tileId } — "Test in lab" in the tile editor: copy that tile onto a
// fresh one-tile lab board on the caller's main character (lib/lab labSessionFromTile).
//
// Platform staff may read any clan's tile for this — they already can, through /staff — and the copy
// lands only in the lab. Nothing is written to the source board.
export async function POST(request: Request) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  const body = (await request.json().catch(() => ({}))) as { tileId?: unknown };
  const tileId = Number(body.tileId);
  if (!Number.isInteger(tileId) || tileId <= 0) return NextResponse.json({ error: 'tileId is required' }, { status: 400 });
  // clan-scope: global -- platform staff, copying one tile into the lab; nothing is written back.
  const source = await db.query.tiles.findFirst({ where: eq(tiles.id, tileId) });
  if (!source) return NextResponse.json({ error: 'Tile not found' }, { status: 404 });
  const eventId = await labSessionFromTile(gate.actor.user.userId, source);
  if (eventId == null) {
    return NextResponse.json({ error: 'You have no character on Anvil yet — connect the plugin on one first.' }, { status: 400 });
  }
  return NextResponse.json({ eventId }, { status: 201 });
}
