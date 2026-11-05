import { and, desc, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { completions, events, teams, tiles } from '@/db/schema';
import { boardHidden, boardSize, completionAt, completionFinisher } from '@/lib/panelRows';
import { eventFeedFloor, isClanWorthy, panelFeedWorthy } from '@/lib/moments';
import { boardTileItemIds, clanScopeFor, momentsForClan, momentsForEvent, type MomentRow } from '@/lib/momentsStore';
import { labMomentsForEvent } from '@/lib/lab';
import { standingsHidden } from '@/lib/standingsVisibility';
import { isTileRevealed, parseEventRules } from '@/lib/eventRules';
import { collapseRuns, runInfoOf, runKey, stampMs, type WithRun } from '@/lib/feedRuns';

import { kindGroup, type KindGroup } from './feedUi';

// What each Feed list holds, in the order it shows, back-to-back repeats collapsed (lib/feedRuns).
// The opened list (pluginUi/feedView) and its live rows (lib/panelRows) both read it, so a live row
// that extends the run at the top deletes exactly the row the opened list drew.

// 'tasks' is the old name of 'achievements', for a panel still holding a chip from before.
export const groupOf = (f: string): KindGroup | null =>
  f === 'drops' || f === 'pets' || f === 'achievements' || f === 'deaths' ? f : f === 'tasks' ? 'achievements' : null;

/** The stored moment kinds behind each Feed filter (feedUi kindGroup, the other way round). */
export const KINDS_OF: Record<KindGroup, readonly string[]> = {
  drops: ['unique', 'loot'],
  pets: ['pet'],
  deaths: ['death'],
  achievements: ['ca', 'level', 'clog', 'diary', 'quest'],
};

/**
 * A clan's Feed list for a filter ('all' or a kind group), collapsed, newest first, not yet cut to
 * the row cap. `skip`: moment ids to leave out (a live batch's later moments, not on screen yet).
 */
export async function clanFeedList(clanId: number, filter: string, skip?: ReadonlySet<number>): Promise<{ list: WithRun<MomentRow>[]; floor: number }> {
  const scope = await clanScopeFor(clanId);
  const g = groupOf(filter);
  const raw = (await momentsForClan(clanId, 120, g ? KINDS_OF[g] : undefined))
    .filter((m) => !skip?.has(m.id))
    .filter((m) => panelFeedWorthy(m, scope.minLootGp) && isClanWorthy(m, scope))
    .filter((m) => !g || kindGroup(m.kind) === g);
  // Drops filed on a board with hidden standings stay out of the clan's feed (the board's own feed
  // shows each team its own). Checked fresh per board.
  const boards = [...new Set(raw.map((m) => m.eventId).filter((e): e is number => e != null))];
  const hidden = new Set<number>();
  for (const e of boards) if (await boardHidden(e)) hidden.add(e);
  const shown = raw.filter((m) => m.eventId == null || !hidden.has(m.eventId));
  return { list: collapseRuns(shown, runKey, (m) => stampMs(m.occurredAt)).map(withRun), floor: scope.minLootGp };
}

export type BoardCompletion = Awaited<ReturnType<typeof boardCompletions>>[number];

/** One entry of a board's list: a moment (maybe a collapsed run) or a finished tile. */
export type EventFeedItem = { at: number; m: WithRun<MomentRow>; c?: undefined } | { at: number; c: BoardCompletion; m?: undefined };

/**
 * A board's Feed list for a filter ('all', 'tiles', 'team', a kind group), collapsed, newest first,
 * not yet cut to the row cap. `teamId` is the viewer's team ('team', and every list while standings
 * are hidden, show only it). A finished tile between two deaths keeps them apart.
 */
export async function eventFeedList(
  eventId: number,
  filter: string,
  teamId: number | null,
  skip?: ReadonlySet<number>,
): Promise<{ items: EventFeedItem[]; floor: number; ev: typeof events.$inferSelect | undefined }> {
  const floor = eventFeedFloor(await boardSize(eventId));
  // clan-scope: this clan -- by id; the viewer reached this board through their own seat or home board
  const ev = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  const hidden = ev ? standingsHidden(ev) : false;
  const g = groupOf(filter);
  const own = (t: number | null) => teamId != null && t === teamId;
  const tileItems = await boardTileItemIds(eventId);
  // Behind the curtain each team sees only its own.
  const visible = (t: number | null) => (filter === 'team' || hidden ? own(t) : true);
  // A lab board's moments never become real rows; they're read from its session's log (lib/labFeed).
  const labRows = filter === 'tiles' ? [] : await labMomentsForEvent(eventId);
  const momentList =
    filter === 'tiles'
      ? []
      : [...(await momentsForEvent(eventId, 600)), ...labRows]
          .filter((m) => !skip?.has(m.id))
          // Under the floor still shows when it's an item one of the board's tiles wants. A lab
          // board shows everything its tester did: that's what they're there to check.
          .filter((m) => m.id < 0 || panelFeedWorthy(m, floor) || (m.itemId != null && tileItems.has(m.itemId)))
          .filter((m) => !g || kindGroup(m.kind) === g)
          .filter((m) => visible(m.teamId))
          .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : 0));
  // Finished tiles: in All, Tiles and My team (a drop filter is about drops).
  const tileItemsDone: EventFeedItem[] =
    g != null ? [] : (await boardCompletions(eventId)).filter((c) => visible(c.teamId)).map((c) => ({ at: Date.parse(completionAt(c.at)), c }));
  const merged: EventFeedItem[] = [...momentList.map((m) => ({ at: Date.parse(m.occurredAt), m })), ...tileItemsDone].sort((a, b) => (b.at || 0) - (a.at || 0));
  const items = collapseRuns(merged, (i) => (i.m ? runKey(i.m) : null), (i) => i.at).map((group): EventFeedItem => {
    const head = group[0];
    if (!head.m) return head;
    return { at: head.at, m: withRun(group.map((i) => i.m!)) };
  });
  return { items, floor, ev };
}

function withRun<T extends MomentRow>(group: T[]): WithRun<T> {
  const run = runInfoOf(group);
  return run ? { ...group[0], run } : group[0];
}

/** A board's finished tiles, newest first (combo parts aren't board cells). */
export async function boardCompletions(eventId: number) {
  // clan-scope: this clan -- by the board id the caller already resolved for this viewer
  const ev = await db.query.events.findFirst({ where: eq(events.id, eventId), columns: { tilesRevealed: true, rules: true } });
  // A tile members can't see yet (unrevealed board, scheduled reveal, unannounced mission) isn't named.
  if (!ev?.tilesRevealed) return [];
  const rules = parseEventRules(ev.rules);
  const rows = await db
    .select({
      revealedAt: tiles.revealedAt,
      mission: tiles.mission,
      tileId: completions.tileId,
      teamId: completions.teamId,
      at: completions.completedAt,
      label: tiles.label,
      teamName: teams.name,
      teamColor: teams.color,
      who: completionFinisher,
    })
    .from(completions)
    .innerJoin(tiles, eq(tiles.id, completions.tileId))
    .innerJoin(teams, eq(teams.id, completions.teamId))
    .where(and(eq(tiles.eventId, eventId), isNull(tiles.parentTileId)))
    .orderBy(desc(completions.completedAt))
    .limit(120);
  return rows.filter((t) => isTileRevealed(rules, t)).slice(0, 80);
}
