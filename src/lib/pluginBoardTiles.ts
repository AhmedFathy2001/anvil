// Another board's tracked tiles folded into a /config body (X-Anvil-Boards). Pure: no database.
import type { LiveBoard } from '@/lib/pluginBoards';

/**
 * The lists another board's entries are appended to: its TILE entries, and its completions, so the
 * plugin's rule table, "Tile complete" banners and counts cover every board. Not the name lists
 * (trackedKcNames, trackedSkillNames, trackedActivityKeys): those feed the stat push, which the server
 * credits per board from hiscores on its own. trackedStats rides along for the rules' progress lines.
 */
export const TRACKED_TILE_LISTS = [
  'trackedDrops',
  'trackedKills',
  'trackedClog',
  'trackedTimed',
  'trackedValues',
  'trackedGains',
  'trackedPvp',
  'trackedLms',
  'trackedDeathless',
  'trackedDiaries',
  'trackedCombatTasks',
  'trackedCombos',
  'trackedStats',
  'completedTiles',
] as const;

const LABELLED_LISTS = new Set<string>([
  'trackedPvp', 'trackedTimed', 'trackedLms', 'trackedGains', 'trackedDeathless', 'trackedDiaries', 'trackedCombatTasks', 'trackedClog', 'trackedCombos',
  'trackedStats', 'completedTiles',
]);

/**
 * Append another board's tracked tiles to `body`'s lists, each tagged with the board it credits.
 * The active board's own entries stay untagged — that is how an older reading of them stays right.
 */
export function appendBoardTiles(body: Record<string, unknown>, extra: Record<string, unknown>, board: Pick<LiveBoard, 'eventId' | 'teamId' | 'playerId' | 'clan' | 'name'>): void {
  const tag = { eventId: board.eventId, teamId: board.teamId, playerId: board.playerId, clan: board.clan, name: board.name };
  // The kinds the plugin judges itself say their label in chat: " · <board>" tells two boards apart
  // (the plugin used to add it; an older one sees it there already and leaves it).
  const suffix = ` · ${board.name}`;
  for (const key of TRACKED_TILE_LISTS) {
    const more = extra[key];
    if (!Array.isArray(more) || more.length === 0) continue;
    const mine = Array.isArray(body[key]) ? (body[key] as unknown[]) : [];
    const named = LABELLED_LISTS.has(key);
    body[key] = [
      ...mine,
      ...more.map((e) => {
        const row = { ...(e as { label?: unknown }), board: tag };
        if (named && board.name && typeof row.label === 'string' && !row.label.endsWith(suffix)) row.label += suffix;
        return row;
      }),
    ];
  }
}
