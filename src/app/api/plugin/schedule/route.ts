import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events, tiles, weeklyCompetitions } from '@/db/schema';
import { count, inArray } from 'drizzle-orm';

// GET /api/plugin/schedule — unauthenticated list of active + upcoming events.
// Consumed by the RuneLite plugin's "Upcoming" side-panel section so players can
// see what's live and what's coming without leaving the client. Read-only, cheap.
//
// Returns only items whose endDate is in the future and that aren't force-ended
// (bingo) or completed (weekly). Sorted by startDate ascending, capped to a
// reasonable size so we don't ship the whole archive every minute.
export async function GET() {
  const nowIso = new Date().toISOString();
  const CAP = 10;

  const [allEvents, allWeeklies] = await Promise.all([
    db.select().from(events),
    db.select().from(weeklyCompetitions),
  ]);

  const bingoCandidates = allEvents.filter(
    (e) => e.startDate && e.endDate && e.endDate > nowIso && !e.forceEndedAt,
  );

  // Tile counts per event in one query — avoids N+1 against the tiles table.
  const tileCountMap = new Map<number, number>();
  if (bingoCandidates.length > 0) {
    const tileCounts = await db
      .select({ eventId: tiles.eventId, count: count() })
      .from(tiles)
      .where(inArray(tiles.eventId, bingoCandidates.map((e) => e.id)))
      .groupBy(tiles.eventId);
    for (const row of tileCounts) tileCountMap.set(row.eventId, row.count);
  }

  const bingos = bingoCandidates.map((e) => ({
    id: e.id,
    title: e.name,
    startDate: e.startDate!,
    endDate: e.endDate!,
    status: e.startDate! > nowIso ? ('upcoming' as const) : ('active' as const),
    boardSize: e.boardSize,
    tileCount: tileCountMap.get(e.id) ?? 0,
  }));

  const weeklies = allWeeklies
    .filter((w) => w.endDate > nowIso && w.status !== 'completed')
    .map((w) => ({
      id: w.id,
      title: w.title,
      type: w.type,
      metric: w.metric,
      status: w.status,
      startDate: w.startDate,
      endDate: w.endDate,
    }));

  const sortByStart = (a: { startDate: string }, b: { startDate: string }) =>
    a.startDate.localeCompare(b.startDate);

  bingos.sort(sortByStart);
  weeklies.sort(sortByStart);

  return NextResponse.json({
    bingos: bingos.slice(0, CAP),
    weeklies: weeklies.slice(0, CAP),
  });
}
