import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tiles as tilesTable, events } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { verifyTileEditor } from '@/lib/auth';
import { getItemMapping } from '@/lib/osrsItems';
import { buildTileSpreadsheet } from '@/lib/tileSpreadsheet';
import type { Tile } from '@/lib/types';

// GET /api/events/{eventId}/tiles/spreadsheet
// Streams an .xlsx tile-authoring workbook for the event — current tiles baked in, plus dropdowns,
// the full item list, valid skill/boss keys, examples, and instructions. Draft in Excel or Google
// Sheets, then upload the workbook (or a CSV of its Tiles tab) back on the Tiles tab — the round
// trip is 1:1, so an unchanged re-upload is a no-op. Admin-only.
export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  if (!(await verifyTileEditor())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { eventId } = await params;
  const id = parseInt(eventId, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });
  }

  const event = (await db.select().from(events).where(eq(events.id, id)).limit(1))[0];
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const eventTiles = (await db
    .select()
    .from(tilesTable)
    .where(eq(tilesTable.eventId, id))
    .orderBy(asc(tilesTable.position))) as Tile[];

  // The item list is a nice-to-have reference; if the upstream sources are down, degrade to an
  // empty list rather than failing the whole download.
  let items: { id: number; name: string }[] = [];
  try {
    items = await getItemMapping();
  } catch {
    /* degrade gracefully — workbook still has tiles, keys, examples, instructions */
  }

  const buffer = await buildTileSpreadsheet({ event, tiles: eventTiles, items });
  const filename = `${(event.name || 'event').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-tiles.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
