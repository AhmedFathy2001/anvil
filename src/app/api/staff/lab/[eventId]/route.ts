import { NextResponse } from 'next/server';
import { and, desc, eq, inArray, ne } from 'drizzle-orm';

import { db } from '@/db';
import { completions, eventParticipants, labLog, submissions, teams, tiles } from '@/db/schema';
import { CAN_WRITE, requirePlatformApi } from '@/lib/platformAccess';
import { deleteLabSession, forgetLabSessions, labEvent, MAX_LAB_HOURS, reseedLabTiles, resetLabSession, setLabSessionEnd } from '@/lib/lab';
import { labClearTile, labCompleteTile, labSetTileProgress, LabTileError } from '@/lib/labTileControls';
import { progressGoal, progressStore } from '@/lib/labTileProgress';
import { addLabTeam, labTeams, moveLabParticipant, setLabTeamRole, type TeamRole } from '@/lib/labTeams';
import { addLabField, clearSimulatedField, LAB_SIM_ENDPOINT, simulateLabField, simulatedCompletionIds } from '@/lib/labField';
import {
  addLabMission,
  announceLabMission,
  expireLabMission,
  LabMissionError,
  markLabMission,
  resetLabMission,
  setLabMissionRules,
  setMissionPolicy,
} from '@/lib/labMissions';
import { parseEventRules, parseTileMissionRules, type MissionRules } from '@/lib/eventRules';
import { LAB_ROUTE_TEMPLATES, labFormat, MAX_LAB_FIELD } from '@/lib/labPlan';
import { modeKeyFor } from '@/lib/eventModes';
import { placementOf } from '@/lib/teamPlacement';

// /api/staff/lab/<id> — one lab session: what is on it, what has been credited, and what its
// characters pushed (the lab log: replays held back, and real play that also went through). PATCH runs the session controls; DELETE removes the session
// and everything on it (the sweep in lib/lab does the same a week after a session ends).

/** Completion rows sent whole up to this many; past it, counts plus your own teams' rows. */
const MAX_COMPLETION_ROWS = 3000;

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
  const simulated = await simulatedCompletionIds(event.id);
  const teamsView = await labTeams(event.id, gate.actor.user.userId);
  const ownTeamIds = new Set(teamsView.teams.filter((t) => t.members.some((m) => !m.test)).map((t) => t.id));
  const countByTile = new Map<number, { real: number; sim: number }>();
  for (const c of done) {
    const n = countByTile.get(c.tileId) ?? { real: 0, sim: 0 };
    if (simulated.has(c.id)) n.sim++;
    else n.real++;
    countByTile.set(c.tileId, n);
  }
  const rules = parseEventRules(event.rules);
  const mode = event.teamPlacement === 'solo' && modeKeyFor(event.format, event.scoringMode, event.rules) === 'classic'
    ? 'solo'
    : modeKeyFor(event.format, event.scoringMode, event.rules);

  return NextResponse.json({
    event: {
      id: event.id,
      name: event.name,
      startDate: event.startDate,
      endDate: event.endDate,
      forceEndedAt: event.forceEndedAt,
      boardSize: event.boardSize,
      format: event.format,
      scoringMode: event.scoringMode,
      mode,
      modeLabel: labFormat(mode).label,
      placement: placementOf(event),
      revealPolicy: rules.revealPolicy,
      // The mission announce policy, or null when the board drops none.
      mission: rules.mission ? { announceMode: rules.mission.announceMode, intervalMinutes: rules.mission.intervalMinutes, order: rules.mission.order } : null,
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
        points: t.points,
        mission: !!t.mission,
        revealedAt: t.revealedAt,
        closedAt: t.closedAt,
        missionRules: t.mission ? parseTileMissionRules(t.rules) : null,
        progressStore: store,
        progressGoal: progressGoal(t, store),
      };
    }),
    participants: participants.map((p) => ({ id: p.id, name: p.name, accountId: p.accountId, simulated: !!p.frozenAt })),
    // Per-tile counts always; the rows themselves only while they are few (a simulated 1000-player
    // field is far too many to poll every 5s) — past that, only your own teams' rows.
    tileCounts: [...countByTile.entries()].map(([tileId, n]) => ({ tileId, ...n })),
    completionsTotal: done.length,
    simulatedTotal: done.filter((c) => simulated.has(c.id)).length,
    completionsPartial: done.length > MAX_COMPLETION_ROWS,
    completions: (done.length > MAX_COMPLETION_ROWS ? done.filter((c) => ownTeamIds.has(c.teamId)) : done).map((c) => ({
      tileId: c.tileId,
      teamId: c.teamId,
      completedAt: c.completedAt,
      simulated: simulated.has(c.id),
    })),
    submissions: subs,
    log: logRows.filter((r) => r.endpoint !== LAB_SIM_ENDPOINT),
    teams: teamsView,
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
    label?: unknown;
    on?: unknown;
    rules?: unknown;
    to?: unknown;
    announceMode?: unknown;
    intervalMinutes?: unknown;
    order?: unknown;
    teamSize?: unknown;
    solo?: unknown;
    intensity?: unknown;
    route?: unknown;
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
    case 'reseed-tiles': {
      // Replace the tiles with the real lab set (wipes progress). Races take a route template.
      const route = LAB_ROUTE_TEMPLATES.find((t) => t.key === body.route)?.key;
      if (body.route !== undefined && !route) return NextResponse.json({ error: 'Unknown route' }, { status: 400 });
      if (!(await reseedLabTiles(event.id, { route }))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      break;
    }
    case 'clear-log':
      // The simulated-field record stays: it is what marks those credits (lib/labField).
      await db.delete(labLog).where(and(eq(labLog.eventId, event.id), ne(labLog.endpoint, LAB_SIM_ENDPOINT)));
      break;
    // The field (lib/labField): test players in bulk, random progress for them, and taking it back.
    case 'add-field': {
      const players = typeof body.players === 'number' && Number.isFinite(body.players) ? Math.min(body.players, MAX_LAB_FIELD) : 0;
      if (players < 1) return NextResponse.json({ error: 'players must be 1 or more' }, { status: 400 });
      const added = await addLabField(gate.actor.user.userId, event.id, {
        players,
        teamSize: typeof body.teamSize === 'number' ? body.teamSize : 3,
        placement: body.solo === true ? 'solo' : 'team',
      });
      return NextResponse.json({ ok: true, added });
    }
    case 'simulate-field': {
      const intensity = typeof body.intensity === 'number' && Number.isFinite(body.intensity) ? body.intensity : undefined;
      const credited = await simulateLabField(event, { intensity });
      return NextResponse.json({ ok: true, credited });
    }
    case 'clear-simulated':
      return NextResponse.json({ ok: true, removed: await clearSimulatedField(event.id) });
    // Missions (lib/labMissions): the real announce/close paths, on demand.
    case 'mission-add':
    case 'mission-mark':
    case 'mission-rules':
    case 'mission-announce':
    case 'mission-expire':
    case 'mission-reset':
    case 'mission-policy': {
      const tileId = Number.isInteger(body.tileId) ? (body.tileId as number) : undefined;
      const needsTile = body.action !== 'mission-add' && body.action !== 'mission-announce' && body.action !== 'mission-policy';
      if (needsTile && tileId == null) return NextResponse.json({ error: 'tileId' }, { status: 400 });
      try {
        if (body.action === 'mission-add') return NextResponse.json({ ok: true, tileId: await addLabMission(event, typeof body.label === 'string' ? body.label : undefined) });
        if (body.action === 'mission-mark') await markLabMission(event, tileId!, body.on !== false);
        if (body.action === 'mission-rules') {
          if (!body.rules || typeof body.rules !== 'object' || Array.isArray(body.rules)) return NextResponse.json({ error: 'rules must be an object' }, { status: 400 });
          return NextResponse.json({ ok: true, rules: await setLabMissionRules(event, tileId!, body.rules as Partial<MissionRules>) });
        }
        if (body.action === 'mission-announce') return NextResponse.json({ ok: true, announced: await announceLabMission(event, tileId) });
        if (body.action === 'mission-expire') await expireLabMission(event, tileId!);
        if (body.action === 'mission-reset') await resetLabMission(event, tileId!, body.to === 'live' ? 'live' : 'hidden');
        if (body.action === 'mission-policy') {
          await setMissionPolicy(event, {
            announceMode: body.announceMode === 'interval' ? 'interval' : 'manual',
            intervalMinutes: typeof body.intervalMinutes === 'number' ? Math.round(body.intervalMinutes) : undefined,
            order: body.order === 'sequential' ? 'sequential' : body.order === 'random' ? 'random' : undefined,
          });
        }
      } catch (e) {
        if (e instanceof LabMissionError) return NextResponse.json({ error: e.message }, { status: 400 });
        throw e;
      }
      break;
    }
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
