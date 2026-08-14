import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tiles, events, settings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyTileEditorForEvent } from '@/lib/auth';
import { analyzeEffort } from '@/lib/balanceEffort';
import { computePlayerProfiles } from '@/lib/playerProfile';
import { isPointsMode } from '@/lib/utils';
import { BALANCE_RATES_SETTING_KEY } from '@/lib/balanceRates';

// Effort-model side of the board-balance auditor. Runs server-side because the wiki
// drop-rate dataset (~700KB) shouldn't ship to the client; the Tiles tab fetches this
// and merges the result with its live structural checks. Admin rate overrides (the
// balance_rates setting) merge over the curated defaults.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  const editor = await verifyTileEditorForEvent(eId);
  if (!editor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  // Event window for the realizability (lottery) classification — falls back to the model's
  // default when dates aren't set yet at authoring time.
  const eventDays =
    event.startDate && event.endDate
      ? Math.max(1, Math.round((Date.parse(event.endDate) - Date.parse(event.startDate)) / 86_400_000))
      : null;

  const report = analyzeEffort(eventTiles, { pointsMode: isPointsMode(event.scoringMode), ratesOverride, eventDays });

  // Pool-aware pass (plan A3): the assignee-band pricing above assumes SOMEONE capable exists —
  // check that against the actual sign-up pool (or, before anyone signs up, the whole clan as the
  // prior). An elite-gated board over a pool with no endgame markers is a dead board, and the
  // best moment to hear that is while points are still editable. Best-effort: a profile hiccup
  // never blocks the audit itself.
  try {
    const enrolled = await computePlayerProfiles({ eventId: eId });
    const pool = enrolled.length > 0 ? enrolled : await computePlayerProfiles({});
    const poolLabel = enrolled.length > 0 ? 'sign-up pool' : 'clan (nobody signed up yet)';
    const gatedTiles = report.perTile.filter((t) => t.floor === 'elite' || t.floor === 'high');
    if (pool.length > 0 && gatedTiles.length > 0) {
      const capable = pool.filter((p) =>
        p.capabilityMarkers.some((m) => (m.domain === 'endgame-pvm' || m.domain === 'raids') && m.kc >= 1),
      );
      const gatedWeight = gatedTiles.reduce((s, t) => s + t.weight, 0);
      const totalWeight = report.perTile.reduce((s, t) => s + t.weight, 0) || 1;
      if (capable.length === 0) {
        report.checks.push({
          id: 'pool-capability',
          level: 'warn',
          title: `Nobody in the ${poolLabel} has endgame-PvM/raid experience`,
          detail:
            `${gatedTiles.length} high/elite tile${gatedTiles.length === 1 ? '' : 's'} ` +
            `(${Math.round((gatedWeight / totalWeight) * 100)}% of the board's weight) assume a capable assignee — ` +
            `for this pool they're effectively dead tiles. Reprice or swap before the draft.`,
          tileIds: gatedTiles.map((t) => t.tileId),
        });
      } else if (capable.length <= 2) {
        report.checks.push({
          id: 'pool-capability',
          level: 'info',
          title: `Only ${capable.length} in the ${poolLabel} carry the gated tiles`,
          detail:
            `${capable.map((p) => p.rsn).join(', ')} hold the endgame/raid markers behind ` +
            `${Math.round((gatedWeight / totalWeight) * 100)}% of the board's weight — make sure the draft ` +
            `spreads them across teams, or the balance math won't save it.`,
          tileIds: gatedTiles.map((t) => t.tileId),
        });
      }
    }
  } catch {
    /* pool read is advisory */
  }

  // Infinity doesn't survive JSON — encode as null and let the client re-read hours[1] == null
  // alongside `blocked` to mean "average band can't do it".
  const perTile = report.perTile.map((t) => ({
    ...t,
    hours: t.hours ? t.hours.map((h) => (Number.isFinite(h) ? Math.round(h * 100) / 100 : null)) : null,
  }));
  return NextResponse.json({ ...report, perTile });
}
