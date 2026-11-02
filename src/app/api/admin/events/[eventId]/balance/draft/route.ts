import { NextResponse } from 'next/server';
import { eventForRequest } from '@/lib/eventScope';
import { requireClan } from '@/lib/clanContext';
import { db } from '@/db';
import { getSetting } from '@/lib/settings';
import { events, tiles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyTileEditorForEvent } from '@/lib/auth';
import { analyzeEffort } from '@/lib/balanceEffort';
import { isPointsMode } from '@/lib/utils';
import { BALANCE_RATES_SETTING_KEY } from '@/lib/balanceRates';
import { RAID_LUCK_SETTING_KEY } from '@/lib/raidLuck';
import type { Tile } from '@/lib/types';

// POST /api/admin/events/<id>/balance/draft { tileId?, tile } → what the effort model says about ONE
// tile the creator is about to add: its suggested points on this board and its expected hours.
//
// The draft is priced the way the board-balance auditor prices it — alongside every other tile on the
// board (suggestions split one budget) — with `tileId` replaced by the draft when it is the placeholder
// being filled. Unmodelled tiles come back with nulls: the creator then suggests nothing rather than
// inventing hours.
const JSON_COLUMNS = ['trackedItemIds', 'itemRequirements', 'sourceNpcs', 'targetNpcs'] as const;

function parse(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const clan = await requireClan();
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  if (!(await eventForRequest(request, eId))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!(await verifyTileEditorForEvent(eId))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { tileId?: unknown; tile?: Record<string, unknown> } | null;
  const draft = body?.tile;
  if (!draft || typeof draft !== 'object') return NextResponse.json({ error: 'tile is required' }, { status: 400 });

  const event = await db.query.events.findFirst({ where: eq(events.id, eId) });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  const eventTiles = await db.query.tiles.findMany({ where: eq(tiles.eventId, eId) });
  const [stored, storedRaid] = await Promise.all([
    getSetting(clan.id, BALANCE_RATES_SETTING_KEY),
    getSetting(clan.id, RAID_LUCK_SETTING_KEY),
  ]);

  const replaceId = Number.isInteger(body?.tileId) ? (body!.tileId as number) : null;
  const base = eventTiles.find((t) => t.id === replaceId) ?? eventTiles[0];
  const row: Record<string, unknown> = { ...(base ?? {}), id: -1, optional: false, mission: false, effortConfig: null };
  for (const [k, v] of Object.entries(draft)) {
    if ((JSON_COLUMNS as readonly string[]).includes(k)) row[k] = v == null ? null : JSON.stringify(v);
    else row[k] = v;
  }
  const board = [...eventTiles.filter((t) => t.id !== replaceId), row as unknown as Tile];

  const eventDays =
    event.startDate && event.endDate
      ? Math.max(1, Math.round((Date.parse(event.endDate) - Date.parse(event.startDate)) / 86_400_000))
      : null;
  const report = analyzeEffort(board as Tile[], {
    pointsMode: isPointsMode(event.scoringMode),
    ratesOverride: parse(stored),
    raidRatesOverride: parse(storedRaid),
    eventDays,
  });
  const mine = report.perTile.find((t) => t.tileId === -1);
  const avg = mine?.hours?.[1];
  return NextResponse.json({
    suggestedPoints: mine?.suggestedPoints ?? null,
    averageHours: avg != null && Number.isFinite(avg) ? Math.round(avg * 10) / 10 : null,
    pClass: mine?.pClass ?? null,
    note: mine?.note ?? null,
  });
}
