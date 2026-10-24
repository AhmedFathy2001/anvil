import { NextResponse } from 'next/server';
import { and, desc, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { completions, eventParticipants, labLog, submissions, teams, tiles } from '@/db/schema';
import { CAN_WRITE, requirePlatformApi } from '@/lib/platformAccess';
import { forgetLabSessions, labEvent, MAX_LAB_HOURS, resetLabSession, setLabSessionEnd } from '@/lib/lab';

// /api/staff/lab/<id> — one lab session: what is on it, what has been credited, and what its
// characters pushed that was quarantined. PATCH runs the session controls.

export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const gate = await requirePlatformApi('support');
  if ('response' in gate) return gate.response;
  const event = await labEvent(Number((await params).eventId));
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const teamRows = await db.select({ id: teams.id }).from(teams).where(eq(teams.eventId, event.id));
  const teamIds = teamRows.map((t) => t.id);
  const [tileRows, participants, done, subs, logRows] = await Promise.all([
    db
      .select({
        id: tiles.id,
        position: tiles.position,
        label: tiles.label,
        tileType: tiles.tileType,
        trackedStat: tiles.trackedStat,
        statType: tiles.statType,
        statGoal: tiles.statGoal,
        requiredAmount: tiles.requiredAmount,
      })
      .from(tiles)
      .where(eq(tiles.eventId, event.id))
      .orderBy(tiles.position),
    db
      .select({
        id: eventParticipants.id,
        name: eventParticipants.name,
        accountId: eventParticipants.accountId,
        frozenAt: eventParticipants.frozenAt,
        statsSnapshot: eventParticipants.statsSnapshot,
        frozenStats: eventParticipants.frozenStats,
      })
      .from(eventParticipants)
      .where(eq(eventParticipants.eventId, event.id)),
    teamIds.length ? db.select().from(completions).where(inArray(completions.teamId, teamIds)) : [],
    teamIds.length
      ? db
          .select({
            id: submissions.id,
            tileId: submissions.tileId,
            amount: submissions.amount,
            itemId: submissions.itemId,
            durationSeconds: submissions.durationSeconds,
            flaggedReason: submissions.flaggedReason,
            note: submissions.note,
            createdAt: submissions.createdAt,
          })
          .from(submissions)
          .where(inArray(submissions.teamId, teamIds))
          .orderBy(desc(submissions.id))
          .limit(100)
      : [],
    db.select().from(labLog).where(eq(labLog.eventId, event.id)).orderBy(desc(labLog.id)).limit(100),
  ]);

  return NextResponse.json({
    event: {
      id: event.id,
      name: event.name,
      startDate: event.startDate,
      endDate: event.endDate,
      forceEndedAt: event.forceEndedAt,
      boardSize: event.boardSize,
    },
    tiles: tileRows,
    participants: participants.map((p) => ({ id: p.id, name: p.name, accountId: p.accountId, simulated: !!p.frozenAt })),
    completions: done.map((c) => ({ tileId: c.tileId, completedAt: c.completedAt })),
    submissions: subs,
    log: logRows,
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  const event = await labEvent(Number((await params).eventId));
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  let body: { action?: unknown; hours?: unknown; participantId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  switch (body.action) {
    case 'end':
      await setLabSessionEnd(event.id, null);
      break;
    case 'extend': {
      const hours = typeof body.hours === 'number' && Number.isFinite(body.hours) ? body.hours : 1;
      const end = new Date(Date.now() + Math.min(Math.max(hours, 0.25), MAX_LAB_HOURS) * 3_600_000);
      await setLabSessionEnd(event.id, end.toISOString());
      break;
    }
    case 'reset':
      await resetLabSession(event.id);
      break;
    case 'reset-keep-log':
      await resetLabSession(event.id, { keepLog: true });
      break;
    case 'clear-log':
      await db.delete(labLog).where(eq(labLog.eventId, event.id));
      break;
    case 'remove-character': {
      if (!Number.isInteger(body.participantId)) return NextResponse.json({ error: 'participantId' }, { status: 400 });
      await db
        .delete(eventParticipants)
        .where(and(eq(eventParticipants.id, body.participantId as number), eq(eventParticipants.eventId, event.id)));
      forgetLabSessions();
      break;
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
