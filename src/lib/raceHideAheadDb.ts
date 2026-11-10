// The database half of lib/raceHideAhead: load a race's veil, and work out who is looking.
//
// Cheap when off: every caller asks raceHideOn(event) first (a parse of the rules it already has),
// so a board without the setting never touches the database here.

import { and, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { completions, eventEditors, events, teams, tiles, users } from '@/db/schema';
import { verifyCaptain, verifyPlayer, verifyUser, type UserPayload } from '@/lib/auth';
import { isEventOver } from '@/lib/eventLock';
import { parseEventRules, visibleTiles, type RaceHideAhead } from '@/lib/eventRules';
import {
  HIDDEN_RACE_TILE_LABEL,
  buildRaceVeil,
  hiddenFromAnotherTeam,
  maskRaceTiles,
  raceSeenFor,
  raceTileHidden,
  type RaceVeil,
  type RaceViewer,
} from '@/lib/raceHideAhead';
import { raceGraph, teamRoute, type TeamRoute } from '@/lib/raceRoutes';
import { eventRaceOpts, loadRacePicksFor } from '@/lib/raceRoutePicks';
import { isStandingsStaff, viewerTeamIds } from '@/lib/standingsAccess';
import { ttlMemo } from '@/lib/ttlMemo';

export interface RaceHideEvent {
  id: number;
  clanId?: number;
  format: string | null;
  rules: string | null;
  startDate?: string | null;
  endDate?: string | null;
  forceEndedAt?: string | null;
}

/** The setting in force right now: off unless it's a race that hasn't finished. */
export function raceHideMode(event: RaceHideEvent): RaceHideAhead {
  if (event.format !== 'tilerace') return 'off';
  const mode = parseEventRules(event.rules).raceHideAhead;
  if (mode === 'off') return 'off';
  // Once the race is over there is nothing left to reach: the whole board shows.
  if (isEventOver(event)) return 'off';
  return mode;
}

export const raceHideOn = (event: RaceHideEvent): boolean => raceHideMode(event) !== 'off';

export async function loadRaceVeilFresh(event: RaceHideEvent, mode: Exclude<RaceHideAhead, 'off'>): Promise<RaceVeil> {
  // clan-scope: global -- the event row came from a caller that already scoped it.
  const board = visibleTiles(
    parseEventRules(event.rules),
    await db.select().from(tiles).where(and(eq(tiles.eventId, event.id), isNull(tiles.parentTileId))),
  );
  const graph = raceGraph(board);
  const ids = [...graph.byId.keys()];
  const [teamRows, doneRows] = await Promise.all([
    db.select({ id: teams.id }).from(teams).where(eq(teams.eventId, event.id)),
    ids.length
      ? db.select({ teamId: completions.teamId, tileId: completions.tileId }).from(completions).where(inArray(completions.tileId, ids))
      : Promise.resolve([] as { teamId: number; tileId: number }[]),
  ]);
  const picks = await loadRacePicksFor(event, teamRows.map((t) => t.id));
  const opts = eventRaceOpts(event);
  const doneBy = new Map<number, number[]>();
  for (const r of doneRows) doneBy.set(r.teamId, [...(doneBy.get(r.teamId) ?? []), r.tileId]);
  const routes = new Map<number, TeamRoute>();
  for (const t of teamRows) routes.set(t.id, teamRoute(graph, doneBy.get(t.id) ?? [], picks?.get(t.id) ?? null, opts));
  return buildRaceVeil(mode, graph, routes);
}

/**
 * The race's veil, or null when nothing is hidden. Memoised for a moment per event: one Discord
 * fan-out or one board poll asks several times, and a finish only ever reveals more.
 */
export async function loadRaceVeil(event: RaceHideEvent): Promise<RaceVeil | null> {
  const mode = raceHideMode(event);
  if (mode === 'off') return null;
  return ttlMemo(`race-veil:${event.id}:${mode}`, () => loadRaceVeilFresh(event, mode), 3_000);
}

/**
 * Sees through "Also hide from event staff": the clan's owner, the platform owner (users.isOwner),
 * and anyone holding this board's own tile-editing grant (event_editors, role 'editor') — the board
 * can't be authored otherwise. Not the clan's admins or moderators, not team staff.
 */
export async function seesThroughStaffHide(eventId: number, user: Pick<UserPayload, 'userId' | 'isOwner'> | null): Promise<boolean> {
  if (!user) return false;
  if (user.isOwner) return true;
  // clan-scope: global -- the platform owner flag is the person's own.
  const row = await db.query.users.findFirst({ where: eq(users.id, user.userId), columns: { isOwner: true } });
  if (row?.isOwner) return true;
  const grant = await db.query.eventEditors.findFirst({
    where: and(eq(eventEditors.eventId, eventId), eq(eventEditors.userId, user.userId), eq(eventEditors.role, 'editor')),
    columns: { id: true },
  });
  return !!grant;
}

/** May this person switch "Also hide from event staff" on or off? The clan owner or the platform owner. */
export async function mayChangeStaffHide(user: Pick<UserPayload, 'userId' | 'isOwner'> | null): Promise<boolean> {
  if (!user) return false;
  if (user.isOwner) return true;
  // clan-scope: global -- the platform owner flag is the person's own.
  const row = await db.query.users.findFirst({ where: eq(users.id, user.userId), columns: { isOwner: true } });
  return row?.isOwner === true;
}

/**
 * Who a signed-in person is to this race. Staff see through while only players are hidden from;
 * under "Also hide from event staff" they get the staff view unless they see through (above).
 * Everyone else reads as their own teams.
 */
export async function raceViewerFor(
  event: RaceHideEvent,
  mode: Exclude<RaceHideAhead, 'off'>,
  user: Pick<UserPayload, 'userId' | 'playerId' | 'isOwner'> | null,
  extraTeamIds: number[] = [],
): Promise<RaceViewer> {
  let staff = false;
  if (user) {
    staff = event.clanId != null && (await isStandingsStaff({ id: event.id, clanId: event.clanId }, user.userId));
    if (staff && mode === 'players') return 'all';
    if (await seesThroughStaffHide(event.id, user)) return 'all';
  }
  const teamIds = [...new Set([...(user ? await viewerTeamIds(event.id, { userId: user.userId, playerId: user.playerId }) : []), ...extraTeamIds])];
  // Staff who also play read as their team: a moderator on a team gets no head start.
  if (staff && !teamIds.length) return 'staff';
  return { teamIds };
}

/** The viewer behind this web request (session, plus the legacy captain and player cookies). */
export async function raceViewerForSession(event: RaceHideEvent, mode: Exclude<RaceHideAhead, 'off'>): Promise<RaceViewer> {
  const user = await verifyUser();
  const extra = [(await verifyCaptain())?.teamId, (await verifyPlayer())?.teamId].filter((t): t is number => typeof t === 'number');
  return raceViewerFor(event, mode, user, extra);
}

/** What this web request may read of the race: the veil and the tile ids in view (null = all). */
export async function raceSeenForSession(event: RaceHideEvent): Promise<{ veil: RaceVeil | null; seen: Set<number> | null }> {
  const veil = await loadRaceVeil(event);
  if (!veil) return { veil: null, seen: null };
  return { veil, seen: raceSeenFor(veil, await raceViewerForSession(event, veil.mode)) };
}

/** The tiles as this web request may read them: hidden ones masked (lib/raceHideAhead maskRaceTiles). */
export async function maskRaceTilesForSession<T extends { id: number; label?: string | null; parentTileId?: number | null }>(
  event: RaceHideEvent,
  list: T[],
): Promise<T[]> {
  if (!raceHideOn(event)) return list;
  const { veil, seen } = await raceSeenForSession(event);
  return maskRaceTiles(veil, seen, list);
}

/** The tiles as one team sees them (the plugin, a team's own push or channel). */
export async function maskRaceTilesForTeams<T extends { id: number; label?: string | null; parentTileId?: number | null }>(
  event: RaceHideEvent,
  teamIds: number[],
  list: T[],
): Promise<T[]> {
  if (!raceHideOn(event)) return list;
  const veil = await loadRaceVeil(event);
  return maskRaceTiles(veil, raceSeenFor(veil, { teamIds }), list);
}

/** What a staff-side tile tool says when "Also hide from event staff" keeps this caller out. */
export const STAFF_HIDE_ERROR =
  'This race hides tiles from event staff. Only the clan owner and this board’s tile editors can see or change them.';

/**
 * Does "Also hide from event staff" keep THIS web caller out of the whole-board tile tools (bulk
 * edits, import, export, history, the route map's save)? Off on every other board.
 */
export async function staffHideBlocksSession(event: RaceHideEvent): Promise<boolean> {
  if (raceHideMode(event) !== 'staff') return false;
  return !(await seesThroughStaffHide(event.id, await verifyUser()));
}

/** Is this one tile a locked "?" for the web caller (a single-tile read or edit)? */
export async function raceTileHiddenForSession(event: RaceHideEvent, tile: { id: number; parentTileId?: number | null }): Promise<boolean> {
  if (!raceHideOn(event)) return false;
  const { veil, seen } = await raceSeenForSession(event);
  return raceTileHidden(veil, seen, tile);
}

/** staffHideBlocksSession by event id, for the routes that haven't loaded the event yet. */
export async function staffHideBlocksEventId(eventId: number): Promise<boolean> {
  // clan-scope: global -- the caller already scoped the event id to this request's clan.
  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    columns: { id: true, clanId: true, format: true, rules: true, startDate: true, endDate: true, forceEndedAt: true },
  });
  return event ? staffHideBlocksSession(event) : false;
}

/**
 * Is this tile still a locked "?" for some team other than `teamId`? Then a Discord post, feed line
 * or chat line naming it stays with that team (lib/standingsVisibility curtainRoute). A combo part
 * counts as its combo. False on every board without the setting.
 */
export async function raceTileHiddenFromOthers(eventId: number, tileId: number, teamId: number | null | undefined): Promise<boolean> {
  // clan-scope: global -- the caller already scoped the event id.
  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    columns: { id: true, clanId: true, format: true, rules: true, startDate: true, endDate: true, forceEndedAt: true },
  });
  if (!event || !raceHideOn(event)) return false;
  const veil = await loadRaceVeil(event);
  if (!veil) return false;
  let cell = tileId;
  if (!veil.covered.has(cell)) {
    const row = await db.query.tiles.findFirst({ where: eq(tiles.id, tileId), columns: { parentTileId: true } });
    if (row?.parentTileId == null) return false;
    cell = row.parentTileId;
  }
  return hiddenFromAnotherTeam(veil, cell, teamId);
}

/**
 * For a reply anyone in a shared Discord channel may read: rows naming race tiles that some team
 * still sees as a locked "?" lose the name. Rows carry `tileId` and `label`; others pass through.
 */
export async function publicRaceLabels<R extends { tileId: number; label: string }>(event: RaceHideEvent, rows: R[]): Promise<R[]> {
  if (!raceHideOn(event) || !rows.length) return rows;
  const veil = await loadRaceVeil(event);
  return rows.map((r) => (raceTileHidden(veil, veil?.everyone ?? null, { id: r.tileId }) ? { ...r, label: HIDDEN_RACE_TILE_LABEL } : r));
}

/** What the editor-grant routes say when "Also hide from event staff" keeps the caller out. */
export const STAFF_HIDE_GRANT_ERROR =
  'This race hides tiles from event staff. Only the clan owner can give or take away tile editing on it.';

/**
 * Tile editing on a board under "Also hide from event staff" sees through the hide
 * (seesThroughStaffHide), so while it's on only the clan owner (or the platform owner) may hand it
 * out or take it back. Any other board, or a treasurer grant: not blocked.
 */
export async function editorGrantBlocked(
  eventIds: number[],
  user: Pick<UserPayload, 'userId' | 'isOwner'> | null,
): Promise<boolean> {
  if (!eventIds.length) return false;
  // clan-scope: global -- the callers already scoped every id to their clan.
  const rows = await db
    .select({ id: events.id, rules: events.rules, format: events.format })
    .from(events)
    .where(inArray(events.id, eventIds));
  // The stored setting, whether or not the race has ended: a grant outlives the race.
  const staffHidden = rows.some((e) => e.format === 'tilerace' && parseEventRules(e.rules).raceHideAhead === 'staff');
  return staffHidden && !(await mayChangeStaffHide(user));
}
