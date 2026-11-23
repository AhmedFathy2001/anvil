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
  'trackedRaids',
  'trackedDiaries',
  'trackedCombatTasks',
  'trackedCombos',
  'trackedStats',
  'completedTiles',
] as const;

const LABELLED_LISTS = new Set<string>([
  'trackedPvp', 'trackedTimed', 'trackedLms', 'trackedGains', 'trackedDeathless', 'trackedRaids', 'trackedDiaries', 'trackedCombatTasks', 'trackedClog', 'trackedCombos',
  'trackedStats', 'completedTiles',
]);

/** What a practice board's popups and chat lines start with (lib/practice). */
export const PRACTICE_PREFIX = '[Practice] ';

/** A practice board's label: "[Practice] <label>", once. */
export function practiceLabel(label: string): string {
  return label.startsWith(PRACTICE_PREFIX) ? label : `${PRACTICE_PREFIX}${label}`;
}

/**
 * The label a popup or chat line shows for a row of `board`: a practice board's starts with
 * "[Practice]" (a clan has one at a time, so that says which board), any other board's ends with
 * " · <board>". Idempotent either way, so a label that went through it once comes back unchanged.
 */
export function boardLabel(label: string, board: { name?: string | null; practice?: boolean | null } | null | undefined): string {
  if (board?.practice) return practiceLabel(label);
  const name = board?.name;
  return name && !label.endsWith(` \u00b7 ${name}`) ? `${label} \u00b7 ${name}` : label;
}

/**
 * The ACTIVE board's own lists when it is a practice board: they go untagged, so nothing downstream
 * could know to say "[Practice]" — the labels carry it themselves. New rows, so nothing shared with
 * the panel (which shows the plain tile names under its PRACTICE banner) changes.
 */
export function prefixPracticeLabels(body: Record<string, unknown>): void {
  for (const key of TRACKED_TILE_LISTS) {
    const rows = body[key];
    if (!Array.isArray(rows) || rows.length === 0) continue;
    body[key] = rows.map((e) => {
      const row = e as { label?: unknown };
      return typeof row.label === 'string' ? { ...row, label: practiceLabel(row.label) } : row;
    });
  }
}

/**
 * Append another board's tracked tiles to `body`'s lists, each tagged with the board it credits.
 * The active board's own entries stay untagged — that is how an older reading of them stays right.
 */
export function appendBoardTiles(body: Record<string, unknown>, extra: Record<string, unknown>, board: Pick<LiveBoard, 'eventId' | 'teamId' | 'playerId' | 'clan' | 'name'> & { practice?: boolean }): void {
  // `practice: true` on a practice board's entries (lib/practice), so a popup off one says "[Practice]".
  const tag = { eventId: board.eventId, teamId: board.teamId, playerId: board.playerId, clan: board.clan, name: board.name, ...(board.practice ? { practice: true } : {}) };
  // The kinds the plugin judges itself say their label in chat: " · <board>" tells two boards apart
  // (the plugin used to add it; an older one sees it there already and leaves it). A practice board's
  // say "[Practice] <label>" instead — on EVERY list, since the site-judged kinds' named() would
  // prefix them anyway (lib/pluginFacts/rules) and a prefix is idempotent.
  for (const key of TRACKED_TILE_LISTS) {
    const more = extra[key];
    if (!Array.isArray(more) || more.length === 0) continue;
    const mine = Array.isArray(body[key]) ? (body[key] as unknown[]) : [];
    const named = LABELLED_LISTS.has(key) || board.practice === true;
    body[key] = [
      ...mine,
      ...more.map((e) => {
        const row = { ...(e as { label?: unknown }), board: tag };
        if (named && typeof row.label === 'string') row.label = boardLabel(row.label, board);
        return row;
      }),
    ];
  }
}
