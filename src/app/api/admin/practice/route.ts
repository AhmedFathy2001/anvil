import { NextResponse } from 'next/server';
import { and, asc, count, desc, eq, inArray, isNull, ne } from 'drizzle-orm';

import { db } from '@/db';
import { events, tiles } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { atLeast } from '@/lib/clanRoles';
import { resolveClanFromRequest } from '@/lib/clanContext';
import { activePracticeBoard, createPracticeBoard, PracticeError } from '@/lib/practice';
import { parsePracticeInput, practiceAllowedForPlan } from '@/lib/practiceRules';
import { postEventRules } from '@/lib/eventRulesPost';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { log } from '@/lib/logger';
import { listLibrary } from '@/lib/tileLibrary';

export const dynamic = 'force-dynamic';

// /api/admin/practice — a clan admin's practice board (lib/practice).
//   GET               the boards this clan could copy, and its running practice board if any
//   GET ?board=<id>   one of those boards' tiles, to pick from
//   GET ?library=1    the clan's tile library, to pick from
//   POST              start one (body: lib/practiceRules PracticeInput)
//
// Admins of THIS clan only — the same gate as creating an event. Every id is checked against it.

async function gate(request: Request) {
  const clan = await resolveClanFromRequest(request);
  if (!clan) return { response: NextResponse.json({ error: 'Not found' }, { status: 404 }) } as const;
  const session = await verifyUser();
  if (!session || !atLeast(session.role, 'admin')) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  if (!practiceAllowedForPlan(clan.plan)) return { response: NextResponse.json({ error: 'Practice boards are not on this clan’s plan.' }, { status: 403 }) } as const;
  return { clan, session } as const;
}

export async function GET(request: Request) {
  const g = await gate(request);
  if ('response' in g) return g.response;
  const { clan } = g;
  const params = new URL(request.url).searchParams;
  const boardParam = params.get('board');

  // The clan's tile library, for "Pick tiles" — an admin without the tile-author grant may still
  // put library tasks on a practice board, which is all this is used for.
  if (params.get('library') === '1') {
    const tasks = await listLibrary(clan.id);
    return NextResponse.json({ tasks: tasks.map((t) => ({ id: t.id, label: t.label, points: t.points, category: t.category, config: t.config })) });
  }

  if (boardParam != null) {
    const boardId = Number(boardParam);
    if (!Number.isInteger(boardId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    // clan-scope: this clan -- a real board of this clan only.
    const [board] = await db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.id, boardId), eq(events.clanId, clan.id), eq(events.practice, false)))
      .limit(1);
    if (!board) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const rows = await db
      .select({ id: tiles.id, label: tiles.label, tileType: tiles.tileType, mission: tiles.mission, revealAt: tiles.revealAt })
      .from(tiles)
      .where(and(eq(tiles.eventId, board.id), isNull(tiles.parentTileId)))
      .orderBy(asc(tiles.position), asc(tiles.id));
    return NextResponse.json({
      tiles: rows.map((t) => ({ id: t.id, label: t.label, kind: t.tileType, hidden: t.mission === 1 || t.revealAt != null })),
    });
  }

  // clan-scope: this clan -- its own real boards, newest first.
  const boards = await db
    .select({ id: events.id, name: events.name, startDate: events.startDate, endDate: events.endDate })
    .from(events)
    .where(and(eq(events.clanId, clan.id), eq(events.practice, false)))
    .orderBy(desc(events.createdAt))
    .limit(30);
  const counts = boards.length
    ? await db
        .select({ eventId: tiles.eventId, n: count() })
        .from(tiles)
        .where(and(inArray(tiles.eventId, boards.map((b) => b.id)), isNull(tiles.parentTileId), ne(tiles.label, '')))
        .groupBy(tiles.eventId)
    : [];
  const active = await activePracticeBoard(clan.id);
  return NextResponse.json({
    boards: boards.map((b) => ({ ...b, tiles: counts.find((c) => c.eventId === b.id)?.n ?? 0 })),
    active: active ? { id: active.id, name: active.name } : null,
  });
}

export async function POST(request: Request) {
  const g = await gate(request);
  if ('response' in g) return g.response;
  const { clan, session } = g;
  const limit = await rateLimit(request, `practice-create:${session.userId}`, { limit: 10, windowMs: 60 * 60_000 });
  if (!limit.ok) return NextResponse.json({ error: 'Too many practice boards — try again later.' }, { status: 429, headers: rateLimitHeaders(limit) });

  const parsed = parsePracticeInput(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const { id, rows } = await createPracticeBoard(session.userId, clan.id, parsed.value);
    // The board's rules card, to the test hook only (lib/eventRulesPost; nothing without a hook).
    // A copied board's tiles are already there; a picked board's arrive with the import, after.
    if (parsed.value.webhookUrl && parsed.value.tiles.mode === 'copy') {
      postEventRules(id, clan.id).catch((e) => log.warn('practice.rules-post-failed', { eventId: id }, e));
    }
    // A library board's rows, for the setup screen to fill the blank tiles with (the tile import).
    return NextResponse.json({ id, rows });
  } catch (e) {
    if (e instanceof PracticeError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
