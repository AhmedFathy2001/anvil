// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Collection-log tiles (tile_type 'clog'): the pure rules. No database, so every decision here is
// tested directly (tests/clog-tiles.test.ts) and shared by the submission route, the unlock ingest,
// the plugin config and the board.
//
// Three shapes, all on the ordinary tile columns (no migration, so clone / import / library copy
// them like any other kind):
//
//   count_mode 'slots', no pages   — "10 new collection log slots": any page.
//   count_mode 'slots', pages      — "3 new Barrows Chests slots": only items on the chosen pages.
//   count_mode 'complete', pages   — "finish the Wintertodt page": every slot on the page filled by
//                                    the end, what they already had included.
//
//   target_npcs     the page names (JSON array, catalogue spelling) — reused per-tileType like the
//                   diary/CA selectors. Empty/NULL = any page (slots mode only).
//   required_amount slots needed ('slots'), or how many of the listed pages ('complete'; NULL = all).
//   tracking_mode   'team' (default) or 'individual' (Solo: one member alone).
//
// WHAT COUNTS AS A NEW SLOT. The game prints "New item added to your collection log: X" exactly once
// per account per item, ever — that line is the guarantee. A slot is credited from it (the plugin's
// screenshot, the plugin's live unlock push, or a manual upload naming the item), and it is refused
// when the member's synced log already held the item before the event started.
//
// HOW A TEAM COUNTS ('slots'). A slot is (member, item): a teammate unlocking the same item is a new
// slot for THEM, so Team = the sum of every member's own new slots, Solo = the best single member.
//
// HOW A PAGE COMPLETES ('complete'). A collection-log page belongs to one account, so a page is done
// when ONE member's own log holds every slot on it — counting what they had before the event — and
// it was not already full when the event started (the last slot has to land during the event).
// Team: each listed page may be finished by a different member; Solo: one member finishes them all.
// Pooling the team's logs was the alternative and is deliberately not the reading: it would count
// N accounts' pre-event items toward one page, so most pages would start the event already "done"
// and the tile would measure roster size, not play.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

import { clogPageIndex, clogPageItems, clogPageOfItem } from '@/lib/clogDataset';
import { clogIdsForName } from '@/lib/clogUnlock';
import { parseJsonArray } from '@/lib/tileKinds';
import { isIndividualMode } from '@/lib/statTracking';
import { parseStamp } from '@/lib/dbTime';

import { clogTileMode, type ClogTileLike, type ClogTileMode, type ClogTileSpec } from '@/lib/clogTileWords';

export { clogTileMode, clogTileTitle, clogTileRule, CLOG_TILE_SETUP_NOTE } from '@/lib/clogTileWords';
export type { ClogTileLike, ClogTileMode, ClogTileSpec } from '@/lib/clogTileWords';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** The name an unlock line and a config entry are compared by: lowercase, punctuation as spaces. */
export function clogNameKey(name: string): string {
  return norm(name);
}

let pageByNorm: Map<string, string> | null = null;
/** A page name in the catalogue's own spelling, or null when the catalogue has no such page. */
export function canonicalClogPage(name: string): string | null {
  if (!pageByNorm) {
    pageByNorm = new Map();
    for (const page of clogPageIndex().keys()) pageByNorm.set(norm(page), page);
  }
  return pageByNorm.get(norm(name ?? '')) ?? null;
}

/** A stored clog tile, read: pages canonicalised (unknown ones dropped), the requirement clamped. */
export function clogTileSpec(tile: ClogTileLike): ClogTileSpec {
  const mode = clogTileMode(tile.countMode);
  const pages = [...new Set(parseJsonArray<string>(tile.targetNpcs ?? null).map((p) => canonicalClogPage(String(p))).filter((p): p is string => !!p))];
  const raw = tile.requiredAmount != null && tile.requiredAmount > 0 ? Math.floor(tile.requiredAmount) : null;
  const required = mode === 'complete'
    ? Math.min(Math.max(1, pages.length), raw ?? Math.max(1, pages.length))
    : Math.max(1, raw ?? 1);
  return { mode, pages, required };
}

/** Every item id the tile's pages hold, or null when any page counts. */
export function clogTileItemIds(spec: Pick<ClogTileSpec, 'pages'>): Set<number> | null {
  if (spec.pages.length === 0) return null;
  const index = clogPageIndex();
  const out = new Set<number>();
  for (const page of spec.pages) for (const id of index.get(page) ?? []) out.add(id);
  return out;
}

/**
 * Validation for the tile API. Returns an error, or null when the tile is coherent. `pages` is what
 * the request wants stored (already parsed); unknown page names are an error rather than silently
 * dropped, so a typo in a sheet is caught at import, not discovered mid-event.
 */
export function clogTileError(mode: string | null | undefined, pages: string[], requiredAmount: number | null | undefined): string | null {
  if (mode != null && mode !== 'slots' && mode !== 'complete') return "A collection log tile counts 'slots' or 'complete' pages.";
  const unknown = pages.filter((p) => !canonicalClogPage(p));
  if (unknown.length > 0) return `Not a collection log page: ${unknown.slice(0, 3).join(', ')}`;
  if (pages.length > 40) return 'At most 40 collection log pages on one tile.';
  if (clogTileMode(mode) === 'complete') {
    if (pages.length === 0) return 'Pick the collection log page(s) to complete.';
    if (requiredAmount != null && (requiredAmount < 1 || requiredAmount > pages.length)) {
      return `Pages needed must be between 1 and ${pages.length}.`;
    }
  } else if (requiredAmount != null && (requiredAmount < 1 || requiredAmount > 2000)) {
    return 'New slots needed must be between 1 and 2000.';
  }
  return null;
}

// ─── New slots ───────────────────────────────────────────────────────────────────────────────

export type ClogSlotVerdict =
  | { ok: true; itemId: number }
  | { ok: false; reason: 'unknown-item' | 'off-page' | 'owned-before' | 'already-counted' };

/**
 * Whether an unlock is a new slot for this member on this tile, and which catalogue id it is.
 *
 * `candidates` are the ids the unlock could be (a name maps to several ids for a few variants; a
 * manual upload names one). The first that survives every check wins:
 *   on the tile's pages → not in the member's log before the event → not already counted for them.
 */
export function decideClogSlot(args: {
  candidates: number[];
  spec: Pick<ClogTileSpec, 'pages'>;
  ownedBefore: ReadonlySet<number>;
  counted: ReadonlySet<number>;
}): ClogSlotVerdict {
  const owner = clogPageOfItem();
  const inCatalogue = args.candidates.filter((id) => owner.has(id));
  if (inCatalogue.length === 0) return { ok: false, reason: 'unknown-item' };
  const pool = clogTileItemIds(args.spec);
  const onPage = pool ? inCatalogue.filter((id) => pool.has(id)) : inCatalogue;
  if (onPage.length === 0) return { ok: false, reason: 'off-page' };
  const fresh = onPage.filter((id) => !args.ownedBefore.has(id));
  if (fresh.length === 0) return { ok: false, reason: 'owned-before' };
  const uncounted = fresh.filter((id) => !args.counted.has(id));
  if (uncounted.length === 0) return { ok: false, reason: 'already-counted' };
  return { ok: true, itemId: uncounted[0] };
}

/** {@link decideClogSlot} for an unlock line's item NAME. */
export function decideClogSlotByName(
  name: string,
  spec: Pick<ClogTileSpec, 'pages'>,
  ownedBefore: ReadonlySet<number>,
  counted: ReadonlySet<number>,
): ClogSlotVerdict {
  return decideClogSlot({ candidates: clogIdsForName(name), spec, ownedBefore, counted });
}

/** Why a slot was refused, said to the person who uploaded it. */
export function clogSlotRefusal(reason: Exclude<ClogSlotVerdict, { ok: true }>['reason']): string {
  switch (reason) {
    case 'unknown-item':
      return 'That item is not in the collection log.';
    case 'off-page':
      return 'That item is not on the collection log page(s) this tile counts.';
    case 'owned-before':
      return 'That slot was already in your collection log before the event started — only new slots count.';
    case 'already-counted':
      return 'That slot already counts for you on this tile.';
  }
}

export interface ClogLogRow {
  itemId: number;
  firstSeenAt: string | null;
}

/**
 * What a member's synced log held when the event started: every row we first saw before the start,
 * and every row from their first-ever sync (NULL date — unknowable, so treated as old).
 *
 * `provenNew` are slots the unlock line itself proved during the event (this tile's own credits):
 * a first-ever sync taken after the unlock files them undated, and they must not read as pre-event.
 */
export function ownedAtStart(rows: ClogLogRow[], eventStartMs: number, provenNew: ReadonlySet<number> = new Set()): Set<number> {
  const out = new Set<number>();
  for (const r of rows) {
    if (provenNew.has(r.itemId)) continue;
    const at = r.firstSeenAt ? parseStamp(r.firstSeenAt) : null;
    if (at == null || at < eventStartMs) out.add(r.itemId);
  }
  return out;
}

// ─── Whole pages ─────────────────────────────────────────────────────────────────────────────

export interface ClogMemberLog {
  playerId: number;
  /** Has this member ever synced their collection log? Without it only credited slots are known. */
  synced: boolean;
  /** Every item their log holds now (synced rows + live unlocks). */
  owned: ReadonlySet<number>;
  /** What it held when the event started ({@link ownedAtStart}). */
  ownedAtStart: ReadonlySet<number>;
  /** Slots this tile credited them during the event (unlock line / manual upload). */
  credited: ReadonlySet<number>;
}

export interface ClogPageState {
  page: string;
  total: number;
  /** Members who finished it during the event. */
  doneBy: number[];
  /** The member closest to finishing it, and how many slots they hold. */
  best: { playerId: number; have: number } | null;
}

export interface ClogPagesProgress {
  /** Pages done (Team: by anyone; Solo: by the best member). */
  current: number;
  required: number;
  complete: boolean;
  /** Solo: who did it. Null on a team tile. */
  finisherPlayerId: number | null;
  pages: ClogPageState[];
  /** Members with no synced log — the tile can only see what they were credited. */
  unsynced: number[];
}

/** Has this member finished this page DURING the event? */
function pageDoneBy(items: ClogItemIdList, m: ClogMemberLog): { done: boolean; have: number } {
  let have = 0;
  let allAtStart = items.length > 0;
  for (const id of items) {
    const held = m.owned.has(id) || m.credited.has(id);
    if (held) have++;
    if (!(m.ownedAtStart.has(id) && !m.credited.has(id))) allAtStart = false;
  }
  return { done: items.length > 0 && have === items.length && !allAtStart, have };
}
type ClogItemIdList = number[];

/** A 'complete' tile's progress from each member's log. Pure. */
export function evaluateClogPages(
  spec: ClogTileSpec,
  members: ClogMemberLog[],
  trackingMode: string | null | undefined,
): ClogPagesProgress {
  const pages: ClogPageState[] = spec.pages.map((page) => {
    // Distinct ids: a page can list one item twice (variants share a slot's name, never its id).
    const items = [...new Set(clogPageItems(page).map((i) => i.id))];
    const doneBy: number[] = [];
    let best: ClogPageState['best'] = null;
    for (const m of members) {
      const r = pageDoneBy(items, m);
      if (r.done) doneBy.push(m.playerId);
      if (!best || r.have > best.have) best = { playerId: m.playerId, have: r.have };
    }
    return { page, total: items.length, doneBy, best };
  });
  const unsynced = members.filter((m) => !m.synced).map((m) => m.playerId);

  if (!isIndividualMode(trackingMode)) {
    const current = pages.filter((p) => p.doneBy.length > 0).length;
    return { current, required: spec.required, complete: current >= spec.required, finisherPlayerId: null, pages, unsynced };
  }
  let bestId: number | null = null;
  let bestCount = 0;
  for (const m of members) {
    const n = pages.filter((p) => p.doneBy.includes(m.playerId)).length;
    if (n > bestCount) {
      bestCount = n;
      bestId = m.playerId;
    }
  }
  return {
    current: bestCount,
    required: spec.required,
    complete: bestCount >= spec.required,
    finisherPlayerId: bestCount >= spec.required ? bestId : null,
    pages,
    unsynced,
  };
}

// ─── Plugin config ───────────────────────────────────────────────────────────────────────────

export interface PluginClogEntry {
  tileId: number;
  position: number;
  label: string;
  description: string | null;
  points: number;
  category: string | null;
  /** 'slots' or 'complete' — the plugin only words its chat notice off it. */
  mode: ClogTileMode;
  pages: string[];
  /** The item names that count ({@link clogNameKey} form), or null for any item in the log. */
  items: string[] | null;
  requiredAmount: number;
  currentAmount: number;
  trackingMode: string;
  completed: boolean;
}

/**
 * The trackedClog row the plugin credits from. The plugin's whole decision is "is this unlock's
 * name in `items` (or is `items` null) and is the tile not done" — the site re-checks everything.
 */
export function pluginClogEntry(
  tile: { id: number; position: number | null; label: string; description: string | null; points: number | null; category: string | null; trackingMode: string | null } & ClogTileLike,
  currentAmount: number,
  completed: boolean,
): PluginClogEntry {
  const spec = clogTileSpec(tile);
  const items = spec.pages.length === 0
    ? null
    : [...new Set(spec.pages.flatMap((p) => clogPageItems(p).map((i) => clogNameKey(i.name))))];
  return {
    tileId: tile.id,
    position: tile.position ?? 0,
    label: tile.label,
    description: tile.description ?? null,
    points: tile.points ?? 0,
    category: tile.category ?? null,
    mode: spec.mode,
    pages: spec.pages,
    items,
    requiredAmount: spec.required,
    currentAmount,
    trackingMode: tile.trackingMode ?? 'team',
    completed,
  };
}

/** The item a plugin proof names: the banner detail, else the game's own unlock line in its chat. */
export function clogItemFromProof(claims: { detail?: string | null; chat?: { text: string }[] } | null): string | null {
  if (!claims) return null;
  const detail = claims.detail?.trim();
  if (detail) return detail;
  for (const c of [...(claims.chat ?? [])].reverse()) {
    const m = /New item added to your collection log:\s*(.+?)\s*$/i.exec(c.text.replace(/<[^>]*>/g, ''));
    if (m) return m[1];
  }
  return null;
}
