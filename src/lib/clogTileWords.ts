// Collection-log tiles (lib/clogTiles), the words and shapes only: no catalogue import, so client
// components (the board, the tile modal, the editor) can say what a clog tile asks for without
// bundling the 146 KB collection-log dataset.

import { isIndividualMode } from '@/lib/statTracking';
import { parseJsonArray } from '@/lib/tileKinds';

export type ClogTileMode = 'slots' | 'complete';

/** Most items one collection-log tile can list (the biggest page is well under this). */
export const MAX_CLOG_TILE_ITEMS = 600;

export interface ClogTileSpec {
  mode: ClogTileMode;
  /**
   * Page names the items were picked from — a shortcut and a label, never the pool itself: the tile
   * counts `itemIds`, so a page Jagex grows later does not silently change a running tile. A tile
   * with pages but no items (hand-written CSV) counts every item on those pages.
   */
  pages: string[];
  /** The chosen items. Empty with no pages = any item in the log (slots mode). */
  itemIds: number[];
  /** Slots needed ('slots'), or groups needed ('complete' — a group is a page's chosen items). */
  required: number;
}

export interface ClogTileLike {
  countMode?: string | null;
  targetNpcs?: string | string[] | null;
  trackedItemIds?: string | number[] | null;
  requiredAmount?: number | null;
}

/** The count mode a clog tile stores: 'complete' for whole pages, 'slots' for everything else. */
export function clogTileMode(countMode: string | null | undefined): ClogTileMode {
  return countMode === 'complete' ? 'complete' : 'slots';
}

function parseIds(raw: string | number[] | null | undefined): number[] {
  return [...new Set(parseJsonArray<number>(raw ?? null).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
}

/**
 * A stored tile's spec as written, without the catalogue (client-safe). The group count for a
 * 'complete' tile needs the catalogue, so here it is approximated by the page count (≥1); lib/clogTiles
 * clogTileSpec is the exact reading every scoring path uses.
 */
export function clogTileLooseSpec(tile: ClogTileLike): ClogTileSpec {
  const mode = clogTileMode(tile.countMode);
  const pages = [...new Set(parseJsonArray<string>(tile.targetNpcs ?? null).map(String).filter(Boolean))];
  const itemIds = parseIds(tile.trackedItemIds);
  const raw = tile.requiredAmount != null && tile.requiredAmount > 0 ? Math.floor(tile.requiredAmount) : null;
  const groups = Math.max(1, pages.length);
  const required = mode === 'complete' ? Math.min(groups, raw ?? groups) : Math.max(1, raw ?? 1);
  return { mode, pages, itemIds, required };
}

function orList(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? '';
  return `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`;
}

/**
 * The tile's own title: "10 new collection log slots", "2 new slots from: Dragon warhammer, …",
 * "Complete the Wintertodt collection log page". `itemNames` (when the caller has them) name a short
 * hand-picked list.
 */
export function clogTileTitle(spec: ClogTileSpec, itemNames?: string[]): string {
  const handPicked = itemNames && itemNames.length > 0 && (spec.pages.length === 0 || itemNames.length <= 4) ? itemNames : null;
  if (spec.mode === 'complete') {
    if (handPicked && spec.pages.length === 0) return handPicked.length <= 4 ? `Own all of: ${handPicked.join(', ')}` : `Own all ${handPicked.length} chosen collection log items`;
    if (spec.pages.length === 1) return `Complete the ${spec.pages[0]} collection log page`;
    if (spec.required >= spec.pages.length) return `Complete the ${spec.pages.join(' + ')} log pages`;
    return `Complete ${spec.required} of: ${spec.pages.join(', ')} log pages`;
  }
  const n = spec.required;
  const slots = n === 1 ? 'slot' : 'slots';
  if (handPicked && handPicked.length <= 4) return `${n} new ${slots} from: ${handPicked.join(', ')}`;
  if (spec.pages.length > 0) return `${n} new ${orList(spec.pages)} log ${slots}`;
  if (spec.itemIds.length > 0) return `${n} new log ${slots} from ${spec.itemIds.length} items`;
  return `${n} new collection log ${slots}`;
}

/** One line for members: what counts. */
export function clogTileRule(spec: ClogTileSpec, trackingMode: string | null | undefined): string {
  const solo = isIndividualMode(trackingMode);
  const chosen = spec.itemIds.length > 0;
  if (spec.mode === 'complete') {
    const multi = spec.pages.length > 1;
    const which = !multi ? (chosen ? 'every chosen item' : 'every slot on the page') : spec.required >= spec.pages.length ? 'the chosen items of every listed page' : `the chosen items of ${spec.required} of the listed pages`;
    return solo
      ? `One player owns ${which} in their own collection log by the end — slots they already had count — finishing it during the event.`
      : `A team member owns ${which} in their own collection log by the end — slots they already had count, different members may finish different pages — finishing during the event.`;
  }
  const where = chosen ? `the ${spec.itemIds.length} chosen item${spec.itemIds.length === 1 ? '' : 's'}${spec.pages.length ? ` (${spec.pages.join(', ')})` : ''}` : spec.pages.length === 0 ? 'any page' : orList(spec.pages);
  return solo
    ? `First-time collection log unlocks from ${where} during the event — one player's own new slots. Repeat drops don't count.`
    : `First-time collection log unlocks from ${where} during the event — every member's new slots add up. Repeat drops don't count.`;
}

/**
 * What admins must tell players before the event, shown in the editor and the creator. New slots
 * need only the chat message (the game sends it once, on a genuine first unlock); whole pages also
 * need each player's log synced before the start, and a screenshot of the finished page.
 */
export function clogTileSetupNote(mode: ClogTileMode): string {
  const chat = 'Players need the in-game setting Settings → Chat → "Collection log - New addition notification" switched on — the Anvil plugin credits off that message.';
  if (mode === 'slots') return `${chat} Each slot counts once per player, and a completed tile needs a screenshot (the plugin takes one with every slot).`;
  return `${chat} Whole pages count the slots players already had, so each player should sync their collection log in the Anvil plugin BEFORE the event starts. A finished page is held until there is a screenshot: open the page in game with the plugin running, or upload one.`;
}
