import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tiles, events, settings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyTileEditor } from '@/lib/auth';
import { analyzeEffort } from '@/lib/balanceEffort';
import { isPointsMode } from '@/lib/utils';

export const BALANCE_RATES_SETTING_KEY = 'balance_rates';

// Effort-model side of the board-balance auditor. Runs server-side because the wiki
// drop-rate dataset (~700KB) shouldn't ship to the client; the Tiles tab fetches this
// and merges the result with its live structural checks. Admin rate overrides (the
// balance_rates setting) merge over the curated defaults.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const editor = await verifyTileEditor();
  if (!editor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);

  const event = await db.query.events.findFirst({ where: eq(events.id, eId) });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  const eventTiles = await db.query.tiles.findMany({ where: eq(tiles.eventId, eId) });

  let ratesOverride: unknown = null;
  const row = await db.query.settings.findFirst({ where: eq(settings.key, BALANCE_RATES_SETTING_KEY) });
  if (row?.value) {
    try {
      ratesOverride = JSON.parse(row.value);
    } catch {
      /* malformed overrides are ignored — defaults still apply */
    }
  }

  const report = analyzeEffort(eventTiles, { pointsMode: isPointsMode(event.scoringMode), ratesOverride });
  // Infinity doesn't survive JSON — encode as null and let the client re-read hours[1] == null
  // alongside `blocked` to mean "average band can't do it".
  const perTile = report.perTile.map((t) => ({
    ...t,
    hours: t.hours ? t.hours.map((h) => (Number.isFinite(h) ? Math.round(h * 100) / 100 : null)) : null,
  }));
  return NextResponse.json({ ...report, perTile });
}
