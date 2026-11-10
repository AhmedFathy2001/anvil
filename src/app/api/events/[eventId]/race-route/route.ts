import { STAFF_HIDE_ERROR, staffHideBlocksEventId } from '@/lib/raceHideAheadDb';
import { NextResponse } from 'next/server';
import { eventForRequest } from '@/lib/eventScope';
import { db } from '@/db';
import { tiles, events } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { verifyAdmin, verifyTileEditorForEvent } from '@/lib/auth';
import { applyLiveRouteEdit, previewRouteEdit } from '@/lib/raceRoutesDb';
import { logTileAudit } from '@/lib/tile-audit';
import { assertEventEditable } from '@/lib/eventLock';
import { isMissionTile } from '@/lib/eventRules';
import { routeOrder, validateRoute, type RouteEntry } from '@/lib/raceRoutes';

// Saves a tile race's route (lib/raceRoutes): every board tile's step and its links to the next step.
// Board order is rewritten to follow the steps, so every list reads in race order. Once the race has
// started only an admin may edit it; an edit that invalidates finishes already made needs a policy
// ('keep' or 'rollback', plus what to do in Discord) — see lib/raceRoutesDb applyLiveRouteEdit.
//
// Body: { route: { id, step, next: number[] }[] }  — every board tile exactly once, a valid route
//    or { straight: true }                          — back to the classic line (board order = steps)
//    + live only: preview: true (just the impact), policy: 'keep' | 'rollback', discord: 'keep' | 'edit' | 'delete' | 'correct'
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, eId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const editor = await verifyTileEditorForEvent(eId, 'edit');
  if (!editor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (await staffHideBlocksEventId(eId)) return NextResponse.json({ error: STAFF_HIDE_ERROR }, { status: 403 });
  const lockedResponse = await assertEventEditable(eId);
  if (lockedResponse) return lockedResponse;

  const event = await db.query.events.findFirst({ where: eq(events.id, eId) });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  if (event.format !== 'tilerace') {
    return NextResponse.json({ error: 'Routes are for tile races only.' }, { status: 400 });
  }
  // Mid-race edits are an admin's call, and recorded (lib/raceRoutesDb applyLiveRouteEdit).
  const live = !!event.startDate && new Date(event.startDate) <= new Date();
  if (live && !(await verifyAdmin())) {
    return NextResponse.json({ error: 'Only an admin can change the route once the race has started.' }, { status: 403 });
  }

  let body: { route?: unknown; straight?: unknown; preview?: unknown; policy?: unknown; discord?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const rows = await db.select().from(tiles).where(and(eq(tiles.eventId, eId), isNull(tiles.parentTileId)));
  const board = rows.filter((t) => !isMissionTile(t));

  if (body.straight === true && live) {
    // Mid-race, the straight line goes through the same decision as any other edit.
    const line = [...board].sort((a, b) => a.position - b.position);
    body.route = line.map((t, i) => ({ id: t.id, step: i, next: i + 1 < line.length ? [line[i + 1].id] : [] }));
  } else if (body.straight === true) {
    await db.update(tiles).set({ raceStep: null, raceNext: null }).where(eq(tiles.eventId, eId));
    logTileAudit({ eventId: eId, action: 'reordered', newValue: { raceRoute: 'straight' }, actorUserId: editor.userId });
    return NextResponse.json({ ok: true, straight: true });
  }

  if (!Array.isArray(body.route)) {
    return NextResponse.json({ error: 'route must be an array of { id, step, next }' }, { status: 400 });
  }
  const entries: RouteEntry[] = [];
  for (const raw of body.route as unknown[]) {
    const r = raw as { id?: unknown; step?: unknown; next?: unknown };
    if (!r || !Number.isInteger(r.id) || !Number.isInteger(r.step) || !Array.isArray(r.next) || !r.next.every((n) => Number.isInteger(n))) {
      return NextResponse.json({ error: 'Each route entry needs an id, a step and a next list of tile ids.' }, { status: 400 });
    }
    entries.push({ id: r.id as number, step: r.step as number, next: [...new Set(r.next as number[])] });
  }
  const ids = new Set(board.map((t) => t.id));
  const given = new Set(entries.map((e) => e.id));
  if (given.size !== entries.length || entries.length !== ids.size || ![...given].every((id) => ids.has(id))) {
    return NextResponse.json({ error: 'The route must place every tile on this board exactly once.' }, { status: 400 });
  }
  const labelOf = new Map(board.map((t) => [t.id, t.label]));
  const problems = validateRoute(entries, (id) => `“${labelOf.get(id) ?? `Tile ${id}`}”`);
  if (problems.length) {
    return NextResponse.json({ error: problems[0].message, problems }, { status: 400 });
  }

  const positionOf = new Map(board.map((t) => [t.id, t.position]));
  // Missions keep their places after the board (they're not on the route).
  const order = routeOrder(entries, (id) => positionOf.get(id) ?? 0);
  const missions = rows.filter((t) => isMissionTile(t)).sort((a, b) => a.position - b.position);
  const byId = new Map(entries.map((e) => [e.id, e]));

  if (live) {
    // What the edit does to progress already made, across the whole edit. A preview, or a save that
    // invalidates something without a decision, answers with the list instead of saving.
    const preview = await previewRouteEdit(eId, entries);
    const policy = body.policy === 'keep' || body.policy === 'rollback' ? body.policy : null;
    const discord = body.discord === 'edit' || body.discord === 'delete' || body.discord === 'correct' ? body.discord : 'keep';
    if (body.preview === true) return NextResponse.json({ ok: true, preview });
    if (preview.teams.length && !policy) {
      return NextResponse.json({ error: 'This edit changes progress teams already made — choose what happens to it.', needsDecision: true, preview }, { status: 409 });
    }
    await applyLiveRouteEdit({ event, entries, order, policy: policy ?? 'keep', discord, actorUserId: editor.userId });
    return NextResponse.json({ ok: true, order, preview, policy: policy ?? 'keep' });
  }

  await db.transaction(async (tx) => {
    for (let i = 0; i < order.length; i++) {
      const e = byId.get(order[i])!;
      await tx.update(tiles).set({ raceStep: e.step, raceNext: e.next, position: i }).where(eq(tiles.id, e.id));
      await tx.update(tiles).set({ position: i }).where(eq(tiles.parentTileId, e.id));
    }
    for (let j = 0; j < missions.length; j++) {
      await tx.update(tiles).set({ position: order.length + j }).where(eq(tiles.id, missions[j].id));
      await tx.update(tiles).set({ position: order.length + j }).where(eq(tiles.parentTileId, missions[j].id));
    }
  });

  logTileAudit({
    eventId: eId,
    action: 'reordered',
    newValue: { raceRoute: 'steps', tiles: entries.length, steps: Math.max(...entries.map((e) => e.step ?? 0)) + 1 },
    actorUserId: editor.userId,
  });
  return NextResponse.json({ ok: true, order });
}
