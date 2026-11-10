import { verifyAdminOrModerator, verifyTileEditorForEvent } from '@/lib/auth';
import { hasRevealPolicy, isMissionTile, parseEventRules, visibleTiles } from '@/lib/eventRules';
import { maskRaceTilesForSession, raceHideOn, type RaceHideEvent } from '@/lib/raceHideAheadDb';

type Tile = Parameters<typeof visibleTiles>[1][number] & { id: number; label?: string | null; parentTileId?: number | null };

/**
 * The tiles of a board the CURRENT caller may see: all of them for staff and this board's tile
 * editors; for everyone else nothing until the board is revealed, then its reveal policy's subset.
 *
 * One gate for every public read that lists tiles or rows keyed by them (the board, its submissions,
 * its completions), so a hidden tile cannot leak through whichever read forgot the check — the event
 * GET checked only the policy and served a whole unrevealed default board to anyone.
 */
export async function tilesForViewer<T extends Tile>(
  event: { id: number; tilesRevealed: number | boolean | null; rules: string | null } & Partial<RaceHideEvent>,
  all: T[],
): Promise<T[]> {
  const shown = await revealedForViewer(event, all);
  // A tile race hiding the tiles past each team's next step (lib/raceHideAhead): those come back as
  // locked "?" cells, same id and place, nothing else.
  if (event.clanId != null && event.format !== undefined && raceHideOn(event as RaceHideEvent)) {
    return maskRaceTilesForSession(event as RaceHideEvent, shown);
  }
  return shown;
}

async function revealedForViewer<T extends Tile>(
  event: { id: number; tilesRevealed: number | boolean | null; rules: string | null },
  all: T[],
): Promise<T[]> {
  const rules = parseEventRules(event.rules);
  // Revealed classic board with no missions: everything is public, no need to ask who's calling.
  if (event.tilesRevealed && !hasRevealPolicy(rules) && !all.some(isMissionTile)) return all;
  const staff = (await verifyAdminOrModerator()) || (await verifyTileEditorForEvent(event.id));
  if (staff) return all;
  return event.tilesRevealed ? visibleTiles(rules, all) : [];
}
