// The lab's crowd: fill a session with test players, and hand the field random progress so the
// race, crowd and standings views can be seen populated (lib/labPlan decides; this writes it).
//
// Test players are the lab cast (lib/labCast ensureTestUser): logins found by the LAB_DUMMY_LOGIN
// mark only, each with a member seat in the hidden lab clan, swept with the clan like every other
// lab trace. A field player is "Lab~Field<n>" (then "Lab~F<n>" from 1000), reused across sessions.
// Filling and simulating are bulk inserts in chunks of CHUNK rows, so a 1000-player field is a few
// round trips, not thousands.
//
// SIMULATED CREDITS ARE MARKED. Each "Simulate the field" run writes one lab_log row
// (LAB_SIM_ENDPOINT) listing the completion ids it made, so the lab page can tag those rows and
// "Clear simulated" can take exactly them away. Reset wipes every completion anyway. Nothing here
// announces: these are background rows for the views to draw, not moments.

import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { completions, eventParticipants, events, labLog, teams, tiles } from '@/db/schema';
import { parseEventRules, parseTileMissionRules, missionClaimCap } from '@/lib/eventRules';
import { forgetLabSessions } from '@/lib/lab';
import { ensureTestUsers } from '@/lib/labCast';
import { labTeams } from '@/lib/labTeams';
import { fieldPlayerNames, planLabTeams, planSimulatedField, type LabPlacement, type SimTile } from '@/lib/labPlan';
import { handleBountyClaim } from '@/lib/revealEngine';
import { isTileRaceFormat } from '@/lib/utils';

type EventRow = typeof events.$inferSelect;

/** Rows per bulk insert. */
const CHUNK = 500;

/** The lab_log endpoint a simulated run is recorded under. */
export const LAB_SIM_ENDPOINT = 'lab · simulated field';

/**
 * Add `players` test players to the session: each on their own team (solo), or dealt into new teams
 * of `teamSize`. Players already on the board stay where they are. Returns how many were placed.
 */
export async function addLabField(
  actorUserId: number,
  eventId: number,
  opts: { players: number; teamSize: number; placement: LabPlacement },
): Promise<number> {
  const names = fieldPlayerNames(opts.players);
  if (!names.length) return 0;
  const onBoard = new Set(
    (await db.select({ accountId: eventParticipants.accountId }).from(eventParticipants).where(eq(eventParticipants.eventId, eventId)))
      .map((r) => r.accountId)
      .filter((n): n is number => n != null),
  );
  // One bulk pass over the whole list (lib/labCast ensureTestUsers), never a query per player.
  const cast = (await ensureTestUsers(actorUserId, names))
    .filter((u) => !onBoard.has(u.accountId))
    .map((u) => ({ accountId: u.accountId, rsn: u.rsn }));
  if (!cast.length) return 0;
  const existing = await db.select({ name: teams.name, color: teams.color }).from(teams).where(eq(teams.eventId, eventId));
  const planned = planLabTeams({
    placement: opts.placement,
    entrants: cast.map((c) => ({ key: String(c.accountId), name: c.rsn, own: false })),
    teamSize: opts.teamSize,
    existing,
  });
  const byKey = new Map(cast.map((c) => [String(c.accountId), c]));
  await db.transaction(async (tx) => {
    const teamIdByName = new Map<string, number>();
    for (let i = 0; i < planned.length; i += CHUNK) {
      const made = await tx
        .insert(teams)
        .values(planned.slice(i, i + CHUNK).map((p) => ({ eventId, name: p.name, color: p.color })))
        .returning({ id: teams.id, name: teams.name });
      for (const m of made) teamIdByName.set(m.name, m.id);
    }
    const rows = planned.flatMap((p) =>
      p.members.map((key) => {
        const c = byKey.get(key)!;
        return { eventId, accountId: c.accountId, name: c.rsn, teamId: teamIdByName.get(p.name)! };
      }),
    );
    for (let i = 0; i < rows.length; i += CHUNK) await tx.insert(eventParticipants).values(rows.slice(i, i + CHUNK));
  });
  forgetLabSessions();
  return cast.length;
}

/**
 * Random credits for the field: every team made up only of test players (your own characters'
 * teams are yours to play), over the tiles open right now, in race order on a race. Returns how many
 * completions were written.
 */
export async function simulateLabField(event: EventRow, opts: { intensity?: number; seed?: number } = {}): Promise<number> {
  const rules = parseEventRules(event.rules);
  const [tileRows, teamRows, people, done] = await Promise.all([
    db.select().from(tiles).where(eq(tiles.eventId, event.id)),
    db.select({ id: teams.id }).from(teams).where(eq(teams.eventId, event.id)),
    labParticipants(event.id),
    db
      .select({ teamId: completions.teamId, tileId: completions.tileId })
      .from(completions)
      .innerJoin(teams, eq(teams.id, completions.teamId))
      .where(eq(teams.eventId, event.id)),
  ]);
  const fieldTeams = teamRows.filter((t) => {
    const members = people.filter((p) => p.teamId === t.id);
    return members.length > 0 && members.every((p) => p.test);
  });
  if (!fieldTeams.length) return 0;
  const simTiles: SimTile[] = tileRows.map((t) => {
    const loose = t as unknown as { raceStep?: number | null; raceNext?: unknown };
    const missionCap = t.mission ? missionClaimCap(parseTileMissionRules(t.rules)) : null;
    return {
      id: t.id,
      position: t.position,
      parentTileId: t.parentTileId,
      mission: t.mission,
      revealedAt: t.revealedAt,
      closedAt: t.closedAt,
      lockout: rules.lockout || rules.revealPolicy === 'bounty' || missionCap === 1,
      raceStep: loose.raceStep ?? null,
      raceNext: loose.raceNext ?? null,
    };
  });
  const startMs = Date.parse(event.startDate ?? '') || Date.now();
  const plan = planSimulatedField({
    race: isTileRaceFormat(event.format),
    allVisible: rules.revealPolicy === 'all',
    tiles: simTiles,
    teams: fieldTeams.map((t) => ({
      id: t.id,
      memberIds: people.filter((p) => p.teamId === t.id).map((p) => p.id),
      done: done.filter((d) => d.teamId === t.id).map((d) => d.tileId),
    })),
    seed: opts.seed ?? Date.now() % 2_147_483_647,
    startMs,
    nowMs: Date.now(),
    intensity: opts.intensity ?? 0.6,
  });
  if (!plan.length) return 0;
  const ids: number[] = [];
  // Chunked: a 1000-player field on a big board is thousands of rows.
  for (let i = 0; i < plan.length; i += CHUNK) {
    const rows = await db
      .insert(completions)
      .values(plan.slice(i, i + CHUNK))
      .onConflictDoNothing()
      .returning({ id: completions.id, tileId: completions.tileId });
    ids.push(...rows.map((r) => r.id));
    // A claimed bounty draws the next one through the real engine, so the board keeps moving.
    if (rules.revealPolicy === 'bounty') for (const r of rows) await handleBountyClaim(event.id, r.tileId).catch(() => {});
  }
  if (ids.length) await db.insert(labLog).values({ eventId: event.id, accountId: null, endpoint: LAB_SIM_ENDPOINT, payload: { completionIds: ids } });
  return ids.length;
}

/** Every completion id a simulated run made on this session (and still standing). */
export async function simulatedCompletionIds(eventId: number): Promise<Set<number>> {
  const rows = await db
    .select({ payload: labLog.payload })
    .from(labLog)
    .where(and(eq(labLog.eventId, eventId), eq(labLog.endpoint, LAB_SIM_ENDPOINT)));
  const out = new Set<number>();
  for (const r of rows) {
    const ids = (r.payload as { completionIds?: unknown } | null)?.completionIds;
    if (Array.isArray(ids)) for (const id of ids) if (Number.isInteger(id)) out.add(id as number);
  }
  return out;
}

/** Take away every simulated credit on this session, and the record of them. Returns how many went. */
export async function clearSimulatedField(eventId: number): Promise<number> {
  const ids = [...(await simulatedCompletionIds(eventId))];
  let removed = 0;
  const teamIds = (await db.select({ id: teams.id }).from(teams).where(eq(teams.eventId, eventId))).map((t) => t.id);
  for (let i = 0; i < ids.length && teamIds.length; i += CHUNK) {
    const gone = await db
      .delete(completions)
      // Pinned to this session's teams, whatever the log row claims.
      .where(and(inArray(completions.id, ids.slice(i, i + CHUNK)), inArray(completions.teamId, teamIds)))
      .returning({ id: completions.id });
    removed += gone.length;
  }
  await db.delete(labLog).where(and(eq(labLog.eventId, eventId), eq(labLog.endpoint, LAB_SIM_ENDPOINT)));
  return removed;
}

/** The session's participants with whether each is a lab test player (by the login mark only). */
async function labParticipants(eventId: number): Promise<{ id: number; teamId: number | null; test: boolean }[]> {
  // labTeams already resolves the login mark per participant; reuse it rather than a second rule.
  const view = await labTeams(eventId, -1);
  return [
    ...view.teams.flatMap((t) => t.members.map((m) => ({ id: m.participantId, teamId: t.id, test: m.test }))),
    ...view.unplaced.map((m) => ({ id: m.participantId, teamId: null, test: m.test })),
  ];
}
