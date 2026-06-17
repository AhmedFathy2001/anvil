import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events, tiles } from '@/db/schema';
import { verifyAdmin } from '@/lib/auth';

export async function GET() {
  const allEvents = await db.query.events.findMany({
    orderBy: (events, { desc }) => [desc(events.createdAt)],
  });
  return NextResponse.json(allEvents);
}

export async function POST(request: Request) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name, boardSize, tileLabels, tileIcons, scoringMode, format } = await request.json();

  if (!name || !boardSize) {
    return NextResponse.json({ error: 'Name and boardSize are required' }, { status: 400 });
  }

  if (format !== undefined && format !== 'bingo' && format !== 'tilerace') {
    return NextResponse.json({ error: "format must be 'bingo' or 'tilerace'" }, { status: 400 });
  }
  const resolvedFormat = format === 'tilerace' ? 'tilerace' : 'bingo';

  if (scoringMode !== undefined && scoringMode !== 'tiles' && scoringMode !== 'points') {
    return NextResponse.json({ error: "scoringMode must be 'tiles' or 'points'" }, { status: 400 });
  }
  // A tile race is always scored by furthest tile reached; point-weighting only
  // applies to the bingo format, so force 'tiles' for a race.
  const resolvedScoringMode =
    resolvedFormat === 'tilerace' ? 'tiles' : scoringMode === 'points' ? 'points' : 'tiles';

  if (!Number.isInteger(boardSize) || boardSize < 1) {
    return NextResponse.json({ error: 'boardSize must be a positive integer' }, { status: 400 });
  }

  // Three event shapes, all keyed off (format, scoringMode):
  //   • Classic bingo  (bingo + tiles)  → a square N×N grid, so boardSize is N and tiles = N².
  //   • Leagues bingo  (bingo + points) → an arbitrary-length task list, boardSize IS the tile count.
  //   • Tile race      (tilerace)       → a linear track, boardSize IS the tile count.
  // Only classic squares boardSize; the other two use it directly as the number of tiles.
  const isClassicGrid = resolvedFormat === 'bingo' && resolvedScoringMode === 'tiles';
  if (isClassicGrid && boardSize > 12) {
    return NextResponse.json({ error: 'A classic grid is capped at 12×12.' }, { status: 400 });
  }
  if (!isClassicGrid && boardSize > 200) {
    return NextResponse.json({ error: 'Events are capped at 200 tiles.' }, { status: 400 });
  }
  const expectedTiles = isClassicGrid ? boardSize * boardSize : boardSize;
  // tileLabels is optional — when omitted (the "blank create" path) we generate
  // placeholder labels and the user fills tiles in via the per-tile editor / CSV import.
  let resolvedLabels: string[];
  if (Array.isArray(tileLabels) && tileLabels.length > 0) {
    if (tileLabels.length !== expectedTiles) {
      const shape = isClassicGrid
        ? `${boardSize}×${boardSize} grid`
        : resolvedFormat === 'tilerace'
          ? `${boardSize}-tile race`
          : `${boardSize}-tile Leagues board`;
      return NextResponse.json(
        { error: `Expected ${expectedTiles} tiles for a ${shape}, got ${tileLabels.length}` },
        { status: 400 },
      );
    }
    resolvedLabels = tileLabels;
  } else {
    resolvedLabels = Array.from({ length: expectedTiles }, (_, i) => `Tile ${i + 1}`);
  }

  const icons: (string | null)[] = Array.isArray(tileIcons) ? tileIcons : [];

  // Wrap the event + tiles inserts in a transaction so a partial failure can't
  // leave an event row with zero tiles (which then can't be edited from the
  // detail page because there's nothing to render). A previous schema drift on
  // the `tiles.accepted_sources` column produced exactly that orphan state for
  // event #8 — recoverable only via a manual backfill.
  const event = await db.transaction(async (tx) => {
    const [created] = await tx.insert(events).values({ name, boardSize, scoringMode: resolvedScoringMode, format: resolvedFormat }).returning();
    const tileValues = resolvedLabels.map((label: string, index: number) => ({
      eventId: created.id,
      position: index,
      label,
      icon: icons[index] || null,
    }));
    await tx.insert(tiles).values(tileValues);
    return created;
  });

  return NextResponse.json(event, { status: 201 });
}
