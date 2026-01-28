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

  const { name, boardSize, tileLabels, tileIcons } = await request.json();

  if (!name || !boardSize || !Array.isArray(tileLabels)) {
    return NextResponse.json({ error: 'Name, boardSize, and tileLabels are required' }, { status: 400 });
  }

  const expectedTiles = boardSize * boardSize;
  if (tileLabels.length !== expectedTiles) {
    return NextResponse.json(
      { error: `Expected ${expectedTiles} tiles for a ${boardSize}x${boardSize} board` },
      { status: 400 }
    );
  }

  const icons: (string | null)[] = Array.isArray(tileIcons) ? tileIcons : [];

  const [event] = await db.insert(events).values({ name, boardSize }).returning();

  const tileValues = tileLabels.map((label: string, index: number) => ({
    eventId: event.id,
    position: index,
    label,
    icon: icons[index] || null,
  }));

  await db.insert(tiles).values(tileValues);

  return NextResponse.json(event, { status: 201 });
}
