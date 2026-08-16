import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events, players, teams } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';
import { assertEventEditable } from '@/lib/eventLock';
import { buildDraftControl, rotateOrderSoNextIs } from '@/lib/draftControl';
import { parseEventRules, validateEventRules } from '@/lib/eventRules';

/**
 * Admin steering for a draft that's already running.
 *
 * The pre-draft panel could only act while `draftStatus === 'none'`, which is the one moment
 * nothing has gone wrong yet. These are the mid-draft levers: move a person between rosters, apply
 * the swap the balance engine already knows about, arm or disarm the per-captain tier filter, and
 * resume from a chosen team after a pause.
 *
 * Deliberately NOT here: un-picking (that's the draft route's `undo-pick`, which rewinds the clock)
 * and moving someone back to the pool. Both change whose turn it is, and an admin fixing a lopsided
 * roster shouldn't have to think about the clock.
 */

async function loadEvent(eventId: number) {
  return db.query.events.findFirst({ where: eq(events.id, eventId) });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  if (!Number.isFinite(eId)) return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });

  const control = await buildDraftControl(eId);
  if (!control) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  return NextResponse.json(control);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  if (!Number.isFinite(eId)) return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });

  // Finished events are read-only unless explicitly unlocked (lib/eventLock).
  const locked = await assertEventEditable(eId);
  if (locked) return locked;

  let body: { action?: string; playerIds?: unknown; teamId?: unknown; give?: unknown; take?: unknown; mode?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const event = await loadEvent(eId);
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  switch (body.action) {
    // ── Move one person to another team, mid-draft ────────────────────────────────────────────
    // Their pick stays theirs: pickNumber and pickedAt are untouched, so the order isn't rewritten
    // and the clock doesn't move. Every account of that person travels together, exactly as a pick
    // would take them.
    case 'move': {
      const playerIds = Array.isArray(body.playerIds)
        ? body.playerIds.map((x) => Number(x)).filter((n) => Number.isFinite(n))
        : [];
      const teamId = Number(body.teamId);
      if (playerIds.length === 0 || !Number.isFinite(teamId)) {
        return NextResponse.json({ error: 'playerIds and teamId are required' }, { status: 400 });
      }
      const target = await db.query.teams.findFirst({
        where: and(eq(teams.id, teamId), eq(teams.eventId, eId)),
      });
      if (!target) return NextResponse.json({ error: 'Team not found in this event' }, { status: 404 });

      const rows = await db
        .select()
        .from(players)
        .where(and(eq(players.eventId, eId), inArray(players.id, playerIds)));
      if (rows.length === 0) return NextResponse.json({ error: 'Nobody to move' }, { status: 404 });
      // Moving someone who was never picked would hand them a roster spot without a turn — that's
      // what the pool assignment on the Teams tab is for, before the draft runs.
      if (rows.some((r) => r.teamId == null)) {
        return NextResponse.json({ error: 'That player has not been drafted yet' }, { status: 400 });
      }

      await db
        .update(players)
        .set({ teamId })
        .where(and(eq(players.eventId, eId), inArray(players.id, rows.map((r) => r.id))));

      return NextResponse.json({ ok: true, moved: rows.length, teamId });
    }

    // ── Apply a two-person swap (the balance engine's suggestion, or a manual pair) ────────────
    case 'swap': {
      const give = Array.isArray(body.give) ? body.give.map(Number).filter(Number.isFinite) : [];
      const take = Array.isArray(body.take) ? body.take.map(Number).filter(Number.isFinite) : [];
      if (give.length === 0 || take.length === 0) {
        return NextResponse.json({ error: 'give and take player ids are required' }, { status: 400 });
      }
      const rows = await db
        .select()
        .from(players)
        .where(and(eq(players.eventId, eId), inArray(players.id, [...give, ...take])));
      const giveRows = rows.filter((r) => give.includes(r.id));
      const takeRows = rows.filter((r) => take.includes(r.id));
      const giveTeam = giveRows[0]?.teamId ?? null;
      const takeTeam = takeRows[0]?.teamId ?? null;
      if (giveTeam == null || takeTeam == null) {
        return NextResponse.json({ error: 'Both sides of a swap must already be on a team' }, { status: 400 });
      }
      if (giveTeam === takeTeam) {
        return NextResponse.json({ error: 'Both sides are already on the same team' }, { status: 400 });
      }

      await db
        .update(players)
        .set({ teamId: takeTeam })
        .where(and(eq(players.eventId, eId), inArray(players.id, giveRows.map((r) => r.id))));
      await db
        .update(players)
        .set({ teamId: giveTeam })
        .where(and(eq(players.eventId, eId), inArray(players.id, takeRows.map((r) => r.id))));

      return NextResponse.json({ ok: true, swapped: giveRows.length + takeRows.length });
    }

    // ── Arm / disarm the per-captain filter ───────────────────────────────────────────────────
    // Only the modes that exist are accepted; anything else would be silently ignored by the pick
    // route, which is worse than a 400 here.
    case 'balance-mode': {
      const mode = String(body.mode ?? '');
      const allowed = ['off', 'advisory', 'tiered-snake', 'dynamic-order'];
      if (!allowed.includes(mode)) {
        return NextResponse.json({ error: `mode must be one of ${allowed.join(', ')}` }, { status: 400 });
      }
      // Same validator the events PATCH runs, so a mode set from here can't produce rules JSON the
      // rest of the app would reject.
      const merged = { ...parseEventRules(event.rules), balanceMode: mode };
      const validated = validateEventRules(merged);
      if ('error' in validated) return NextResponse.json({ error: validated.error }, { status: 400 });
      await db.update(events).set({ rules: validated.rules }).where(eq(events.id, eId));
      return NextResponse.json({ ok: true, balanceMode: mode });
    }

    // ── Resume, optionally from a chosen team ─────────────────────────────────────────────────
    // Resuming in order after fixing a mis-pick would just repeat it, so the admin can name who
    // picks next; the order rotates so that's true, and everyone still picks once per round.
    case 'resume': {
      if (event.draftStatus !== 'paused') {
        return NextResponse.json({ error: 'The draft is not paused' }, { status: 400 });
      }
      const fromTeamId = body.teamId != null ? Number(body.teamId) : null;
      if (fromTeamId != null) {
        const control = await buildDraftControl(eId);
        if (!control) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        if (!control.teamOrder.includes(fromTeamId)) {
          return NextResponse.json({ error: 'That team is not in the draft order' }, { status: 400 });
        }
        const rotated = rotateOrderSoNextIs(control.teamOrder, control.currentPickNumber, fromTeamId);
        await db.update(events).set({ draftOrder: JSON.stringify(rotated) }).where(eq(events.id, eId));
      }
      await db.update(events).set({ draftStatus: 'active' }).where(eq(events.id, eId));
      return NextResponse.json({ ok: true, resumedFrom: fromTeamId });
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
