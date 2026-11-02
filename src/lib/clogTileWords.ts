// Collection-log tiles (lib/clogTiles), the words and shapes only: no catalogue import, so client
// components (the board, the tile modal, the editor) can say what a clog tile asks for without
// bundling the 146 KB collection-log dataset.

import { isIndividualMode } from '@/lib/statTracking';
import { parseJsonArray } from '@/lib/tileKinds';

export type ClogTileMode = 'slots' | 'complete';

export interface ClogTileSpec {
  mode: ClogTileMode;
  /** Catalogue page names. Empty = any page (slots mode). */
  pages: string[];
  /** Slots needed ('slots'), or pages needed ('complete'). */
  required: number;
}

export interface ClogTileLike {
  countMode?: string | null;
  targetNpcs?: string | string[] | null;
  requiredAmount?: number | null;
}

/** The count mode a clog tile stores: 'complete' for whole pages, 'slots' for everything else. */
export function clogTileMode(countMode: string | null | undefined): ClogTileMode {
  return countMode === 'complete' ? 'complete' : 'slots';
}

/** A stored tile's spec as written (pages are canonicalised on write; lib/clogTiles re-checks them). */
export function clogTileLooseSpec(tile: ClogTileLike): ClogTileSpec {
  const mode = clogTileMode(tile.countMode);
  const pages = [...new Set(parseJsonArray<string>(tile.targetNpcs ?? null).map(String).filter(Boolean))];
  const raw = tile.requiredAmount != null && tile.requiredAmount > 0 ? Math.floor(tile.requiredAmount) : null;
  const required = mode === 'complete'
    ? Math.min(Math.max(1, pages.length), raw ?? Math.max(1, pages.length))
    : Math.max(1, raw ?? 1);
  return { mode, pages, required };
}

function pageList(pages: string[]): string {
  if (pages.length <= 1) return pages[0] ?? '';
  return `${pages.slice(0, -1).join(', ')} or ${pages[pages.length - 1]}`;
}

/** The tile's own title: "10 new collection log slots", "Complete the Wintertodt log page". */
export function clogTileTitle(spec: ClogTileSpec): string {
  if (spec.mode === 'complete') {
    if (spec.pages.length === 1) return `Complete the ${spec.pages[0]} collection log page`;
    if (spec.required >= spec.pages.length) return `Complete the ${spec.pages.join(' + ')} log pages`;
    return `Complete ${spec.required} of: ${spec.pages.join(', ')} log pages`;
  }
  const n = spec.required;
  const slots = n === 1 ? 'slot' : 'slots';
  if (spec.pages.length === 0) return `${n} new collection log ${slots}`;
  return `${n} new ${pageList(spec.pages)} log ${slots}`;
}

/** One line for members: what counts. */
export function clogTileRule(spec: ClogTileSpec, trackingMode: string | null | undefined): string {
  const solo = isIndividualMode(trackingMode);
  if (spec.mode === 'complete') {
    const which = spec.pages.length === 1 ? 'the page' : spec.required >= spec.pages.length ? 'every listed page' : `${spec.required} of the listed pages`;
    return solo
      ? `One player fills every slot on ${which} in their own collection log (slots they already had count), finishing it during the event.`
      : `Any team member fills every slot on a page in their own collection log (slots they already had count), finishing it during the event — ${which}.`;
  }
  const where = spec.pages.length === 0 ? 'any page' : pageList(spec.pages);
  return solo
    ? `First-time collection log unlocks from ${where} during the event — one player's own new slots. Repeat drops don't count.`
    : `First-time collection log unlocks from ${where} during the event — every member's new slots add up. Repeat drops don't count.`;
}

/** What admins must tell players before the event, shown in the editor and the creator. */
export const CLOG_TILE_SETUP_NOTE =
  'Players need the in-game setting Settings → Chat → "Collection log - New addition notification" switched on (the plugin credits off that message), and should sync their collection log in the Anvil plugin before the event starts so slots they already had are known.';

