// Which Jagex hiscores table corroborates which game-mode world (lib/worldModes).
//
// Every mode save that Jagex ranks has its own table, in the same index_lite.json format as the
// main game's: m=hiscore_oldschool<suffix>. The Site queues reads of those tables through the same
// fetch queue as the main game (hiscores_fetches.mode, fetched by Anvil.Forge), and uses them to
// check the KC / XP the plugin pushed from that mode (lib/modeStats).
//
// The fetch-mode names are deliberately unlike the account-type ones the queue already carries:
// 'hardcore' there is Hardcore IRONMAN (the account-type probe, lib/forgeFetchResult); the
// Hardcore Worlds save is 'hardcore_mains'.
//
// Pure (no db).

/** Fetch modes for game-mode world tables. Forge maps each onto its URL suffix. */
export type ModeFetchMode = 'hardcore_mains' | 'seasonal' | 'deadman' | 'fresh_start' | 'tournament';

export const MODE_FETCH_MODES: readonly ModeFetchMode[] = ['hardcore_mains', 'seasonal', 'deadman', 'fresh_start', 'tournament'];

/**
 * World-mode key → the table its save is ranked on.
 *
 * Left out on purpose:
 *  - 'seasonal-deadman': RuneLite's own hiscore lookup (HiscoreEndpoint.fromWorldTypes) reads any
 *    SEASONAL-flagged world from the Leagues table, ahead of its DEADMAN check, while the guess was
 *    the Deadman table. The evidence disagrees, and reading the wrong ladder would either contradict
 *    honest readings or raise their starting line, so it stays unchecked until a season settles it.
 *  - 'beta': beta worlds have no hiscores.
 *  - modes named from a world we had no entry for: nothing to map them to.
 *
 * 'grid-master' reads the tournament table: RuneLite labels that endpoint "Grid Master".
 */
const TABLE_FOR_MODE: Readonly<Record<string, ModeFetchMode>> = {
  hardcore: 'hardcore_mains',
  leagues: 'seasonal',
  deadman: 'deadman',
  'fresh-start': 'fresh_start',
  tournament: 'tournament',
  'grid-master': 'tournament',
};

/** The hiscores table a world mode's save is ranked on, or null when nothing can corroborate it. */
export function modeHiscoresTable(modeKey: string): ModeFetchMode | null {
  return Object.prototype.hasOwnProperty.call(TABLE_FOR_MODE, modeKey) ? TABLE_FOR_MODE[modeKey] : null;
}

export function isModeFetchMode(mode: unknown): mode is ModeFetchMode {
  return typeof mode === 'string' && (MODE_FETCH_MODES as readonly string[]).includes(mode);
}
