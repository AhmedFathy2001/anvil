import { NextResponse } from 'next/server';
import { and, desc, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { completions, eventParticipants, labLog, submissions, teams, tiles } from '@/db/schema';
import { CAN_WRITE, requirePlatformApi } from '@/lib/platformAccess';
import { deleteLabSession, forgetLabSessions, labEvent, MAX_LAB_HOURS, resetLabSession, setLabSessionEnd } from '@/lib/lab';
import { labClearTile, labCompleteTile, labSetTileProgress, LabTileError } from '@/lib/labTileControls';
import { progressGoal, progressStore } from '@/lib/labTileProgress';
import { addLabTeam, labTeams, moveLabParticipant, setLabTeamRole, type TeamRole } from '@/lib/labTeams';

// /api/staff/lab/<id> — one lab session: what is on it, what has been credited, and what its
// characters pushed that was quarantined. PATCH runs the session controls; DELETE removes the session
// and everything on it (the sweep in lib/lab does the same a week after a session ends).

export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const gate = await requirePlatformApi('support');
  if ('response' in gate) return gate.response;
  const event = await labEvent(Number((await params).eventId));
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const teamRows = await db.select({ id: teams.id }).from(teams).where(eq(teams.eventId, event.id));
  const teamIds = teamRows.map((t) => t.id);
  const [tileRows, participants, done, subs, logRows] = await Promise.all([
    db
      .select()
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
    tiles: tileRows.map((t) => {
      // Where the tile keeps its progress, for the tile controls (lib/labTileProgress).
      const store = progressStore(t);
      return {
        id: t.id,
        position: t.position,
        label: t.label,
        tileType: t.tileType,
        trackedStat: t.trackedStat,
        statType: t.statType,
        statGoal: t.statGoal,
        requiredAmount: t.requiredAmount,
        parentTileId: t.parentTileId,
        progressStore: store,
        progressGoal: progressGoal(t, store),
      };
    }),
    participants: participants.map((p) => ({ id: p.id, name: p.name, accountId: p.accountId, simulated: !!p.frozenAt })),
    completions: done.map((c) => ({ tileId: c.tileId, teamId: c.teamId, completedAt: c.completedAt })),
    submissions: subs,
    log: logRows,
    teams: await labTeams(event.id, gate.actor.user.userId),
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  const event = await labEvent(Number((await params).eventId));
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  let body: {
    action?: unknown;
    hours?: unknown;
    participantId?: unknown;
    teamId?: unknown;
    tileId?: unknown;
    value?: unknown;
    players?: unknown;
    role?: unknown;
  };
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
    case 'add-team':
      await addLabTeam(gate.actor.user.userId, event.id, typeof body.players === 'number' ? body.players : 3);
      break;
    case 'move': {
      const teamId = body.teamId === null ? null : Number.isInteger(body.teamId) ? (body.teamId as number) : undefined;
      if (!Number.isInteger(body.participantId) || teamId === undefined) return NextResponse.json({ error: 'participantId, teamId' }, { status: 400 });
      if (!(await moveLabParticipant(event.id, body.participantId as number, teamId))) return NextResponse.json({ error: 'Not on this board' }, { status: 400 });
      break;
    }
    case 'team-role': {
      const role = (['captain', 'staff', 'member'] as TeamRole[]).find((r) => r === body.role);
      if (!Number.isInteger(body.teamId) || !role) return NextResponse.json({ error: 'teamId, role' }, { status: 400 });
      if (!(await setLabTeamRole(event.id, gate.actor.user.userId, body.teamId as number, role))) return NextResponse.json({ error: 'Not on this board' }, { status: 400 });
      break;
    }
    // Tile controls (lib/labTileControls): complete, clear or set progress on any tile for any team.
    case 'tile-complete':
    case 'tile-clear':
    case 'tile-progress': {
      if (!Number.isInteger(body.teamId) || !Number.isInteger(body.tileId)) return NextResponse.json({ error: 'teamId, tileId' }, { status: 400 });
      const teamId = body.teamId as number;
      const tileId = body.tileId as number;
      const needsPlayer = body.action !== 'tile-clear';
      if (needsPlayer && !Number.isInteger(body.participantId)) return NextResponse.json({ error: 'participantId' }, { status: 400 });
      if (body.action === 'tile-progress' && (typeof body.value !== 'number' || !Number.isFinite(body.value) || body.value < 0)) {
        return NextResponse.json({ error: 'value must be a number, 0 or more' }, { status: 400 });
      }
      try {
        const tile =
          body.action === 'tile-clear'
            ? await labClearTile(event, teamId, tileId)
            : body.action === 'tile-complete'
              ? await labCompleteTile(event, teamId, tileId, body.participantId as number)
              : await labSetTileProgress(event, teamId, tileId, body.participantId as number, body.value as number);
        return NextResponse.json({ ok: true, tile });
      } catch (e) {
        if (e instanceof LabTileError) return NextResponse.json({ error: e.message }, { status: 400 });
        throw e;
      }
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  if (!(await deleteLabSession(Number((await params).eventId)))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
