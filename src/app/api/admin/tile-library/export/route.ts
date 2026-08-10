import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { events, tiles } from '@/db/schema';
import { verifyTileEditorAnywhere } from '@/lib/auth';
import { listLibrary } from '@/lib/tileLibrary';
import { tileToCsvCells, TILE_CSV_COLUMNS, type TileCsvRow } from '@/lib/csvTiles';

export const dynamic = 'force-dynamic';

// GET /api/admin/tile-library/export[?eventId=N] — a seed pack.
//
// The point of this route: the curated list shipped in the repo is a guess, and a list a clan
// actually played is worth more. Export a board you like as a pack, and it can replace
// src/data/tileLibrarySeed.json as the default every new tenant starts from — or be handed to
// another Anvil site, which imports it straight back through the library's `add` action.
//
// With ?eventId the pack is that board's tiles; without it, the whole library. Same shape either
// way, matching the seed file exactly so the output can be committed as-is.

/** A stable, readable key so re-exporting the same task twice doesn't duplicate it on import. */
function seedKeyFor(label: string, tileType: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  const prefix = tileType === 'standard' ? 'drop' : tileType;
  return `${prefix}-${slug}`;
}

/** Rebuild a TileCsvRow from a stored tile via the canonical CSV cells — one conversion, not two. */
function rowFromTile(tile: Parameters<typeof tileToCsvCells>[0]): TileCsvRow {
  const cells = tileToCsvCells(tile);
  const row: Record<string, unknown> = {};
  TILE_CSV_COLUMNS.forEach((col, i) => {
    const v = cells[i];
    if (v !== undefined && v !== null && v !== '') row[col] = v;
  });
  return row as TileCsvRow;
}

export async function GET(request: Request) {
  const editor = await verifyTileEditorAnywhere();
  if (!editor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const eventIdParam = url.searchParams.get('eventId');

  let tasks: { key: string; label: string; category?: string; points: number; config: TileCsvRow }[];
  let source: string;

  if (eventIdParam) {
    const eventId = Number(eventIdParam);
    if (!Number.isInteger(eventId)) {
      return NextResponse.json({ error: 'Invalid eventId' }, { status: 400 });
    }
    const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const rows = await db.select().from(tiles).where(eq(tiles.eventId, eventId)).orderBy(tiles.position);
    tasks = rows
      .filter((t) => t.label && !/^Tile \d+$/.test(t.label)) // skip untouched placeholders
      .map((t) => ({
        key: seedKeyFor(t.label, t.tileType),
        label: t.label,
        category: t.category ?? undefined,
        points: t.points ?? 0,
        config: rowFromTile(t as unknown as Parameters<typeof tileToCsvCells>[0]),
      }));
    source = event.name;
  } else {
    const library = await listLibrary();
    tasks = library.map((t) => ({
      key: t.seedKey ?? seedKeyFor(t.label, t.tileType),
      label: t.label,
      category: t.category ?? undefined,
      points: t.points,
      config: t.config,
    }));
    source = 'tile library';
  }

  // Later duplicates lose — a board can legitimately carry the same label twice (different tiers of
  // the same chase), but a seed pack keyed by label cannot.
  const seen = new Set<string>();
  tasks = tasks.filter((t) => (seen.has(t.key) ? false : (seen.add(t.key), true)));

  const pack = {
    version: 1,
    note: `Seed pack exported from ${source}. Drop this in as src/data/tileLibrarySeed.json to make it the default for new instances, or import it into another Anvil site's task library.`,
    tasks,
  };

  return new NextResponse(JSON.stringify(pack, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="tile-seed-pack.json"`,
    },
  });
}
