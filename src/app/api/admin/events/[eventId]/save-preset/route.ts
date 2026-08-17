import { NextResponse } from 'next/server';
import { db } from '@/db';
import { requireClan } from '@/lib/clanContext';
import { eventPresets, events, tiles } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
import { TILE_CSV_COLUMNS, tileToCsvCells } from '@/lib/csvTiles';
import type { Tile } from '@/lib/types';

// Save an existing event as a reusable template. Captures the event's shape (format / scoring /
// size) plus its tiles serialized to the canonical tile CSV, so re-applying the preset runs the
// same tested bulk-import pipeline. Admin-only.
function csvEscape(cell: string): string {
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

function tilesToCsv(rows: Tile[]): string {
  const header = TILE_CSV_COLUMNS.join(',');
  const body = [...rows]
    .sort((a, b) => a.position - b.position)
    .map((t) => tileToCsvCells(t).map(csvEscape).join(','));
  return [header, ...body].join('\n');
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const session = await verifyUser();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 401 });
  }

  const { eventId } = await params;
  const id = parseInt(eventId, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });
  }

  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { name?: string } | null;
  const name = body?.name?.trim() || event.name;

  const eventTiles = await db
    .select()
    .from(tiles)
    .where(eq(tiles.eventId, id))
    .orderBy(asc(tiles.position));

  const clan = await requireClan();
  const [preset] = await db
    .insert(eventPresets)
    .values({
      clanId: clan.id,
      name,
      format: event.format,
      scoringMode: event.scoringMode,
      boardSize: event.boardSize,
      tiles: eventTiles.length ? tilesToCsv(eventTiles as Tile[]) : null,
      createdByUserId: session.userId > 0 ? session.userId : null,
    })
    .returning();

  return NextResponse.json({ preset: { id: preset.id, name: preset.name } });
}
