/**
 * Tile matching for raw plugin facts (capability `rules`). A port of what the plugin used to decide
 * for itself (AnvilPlugin.processLoot / processValueTiles / creditKillTiles / creditOncePerTile):
 * the plugin now reports WHAT happened — a loot event, a kill, a haul's value — and this decides
 * which of the player's tiles it credits and by how much.
 *
 * Pure: the caller hands in the tracked-tile lists exactly as the config route serves them
 * (`buildEnrolledConfig`), and this mutates their counts as it credits, so several facts in one
 * request see each other's progress the way the plugin's in-memory copies did.
 */
import { itemCap } from '@/lib/collectionSets';
import {
  countLineAllows,
  judgeRaidRun,
  startCountAllows,
  toaLevelAllows,
  toaModeFor,
  type StartCount,
  type TileConditions,
} from '@/lib/tileConditions';
import { RAID_KEY_MODES } from '@/lib/tileConditionsCheck';

export type SourceKind = 'npc' | 'event' | 'pvp' | 'pickpocket' | 'clog';

export interface FactBoard {
  eventId: number;
  teamId: number;
  playerId: number;
  clan?: string | null;
  name?: string | null;
}

interface TrackedBase {
  tileId: number;
  label: string;
  partOf?: number | null;
  board?: FactBoard | null;
}

export interface ItemReq {
  itemId: number;
  name?: string;
  requiredAmount: number;
  currentAmount: number;
  group?: string | null;
  groupRequire?: number | null;
}

export interface DropTile extends TrackedBase {
  requiredAmount: number;
  currentAmount: number;
  itemIds?: number[] | null;
  itemRequirements?: ItemReq[] | null;
  acceptedSources?: string[] | null;
  sourceNpcs?: string[] | null;
  partySize?: number;
  groupMode?: string | null;
  perKillCap?: number;
  setsRequired?: number;
  countMode?: string | null;
  countedItemIds?: number[] | null;
  /** A ToA level the drop's raid must have ended at (lib/tileConditions toaLevel). */
  conditions?: TileConditions | null;
}

/** Tile conditions on a config row, and the caller's count when the event started (null = unknown). */
interface Conditioned {
  conditions?: TileConditions | null;
  startCount?: number | null;
}

export interface KillTile extends TrackedBase, Conditioned {
  requiredAmount: number;
  currentAmount: number;
  targetNpcs?: string[] | null;
  coopCredit?: string | null;
  coopMinMembers?: number;
  unit?: string | null;
  capOf?: number | null;
  pingMax?: number;
}

export interface ValueTile extends TrackedBase {
  thresholdGp: number;
  currentGp?: number;
  mode?: string | null;
  sources?: string[] | null;
  completed?: boolean;
}

/** A raid tile (lib/tileConditions): judged here from the plugin's `raid` facts. */
export interface RaidTile extends TrackedBase, Conditioned {
  requiredAmount: number;
  currentAmount: number;
  /** The lower-cased clear-line names it takes a fact for. */
  keys?: string[] | null;
  completed?: boolean;
}

/** A tile the plugin judges itself (timed, deathless, LMS, PvP, diary, combat task, clog, gain), as the config lists it. */
export interface PlainTile extends TrackedBase {
  /** Conditions only the site judges: a `tile` fact never credits a row that has them. */
  conditions?: TileConditions | null;
  currentAmount?: number | null;
  requiredAmount?: number | null;
  activity?: string | null;
  thresholdSeconds?: number | null;
  placementCap?: number | null;
  partySize?: number | null;
  coopCredit?: string | null;
  coopMinMembers?: number | null;
}

/** Config list → the tile kind a `tile` fact credits there. */
export const TILE_LISTS = {
  trackedGains: 'gain',
  trackedTimed: 'timed',
  trackedDeathless: 'deathless',
  trackedLms: 'lms',
  trackedPvp: 'pvp',
  trackedDiaries: 'diary',
  trackedCombatTasks: 'ca',
  trackedClog: 'clog',
} as const;

export type TileKind = (typeof TILE_LISTS)[keyof typeof TILE_LISTS];

export interface Tracked {
  trackedDrops?: DropTile[] | null;
  trackedKills?: KillTile[] | null;
  trackedValues?: ValueTile[] | null;
  trackedGains?: PlainTile[] | null;
  trackedTimed?: PlainTile[] | null;
  trackedDeathless?: PlainTile[] | null;
  trackedLms?: PlainTile[] | null;
  trackedPvp?: PlainTile[] | null;
  trackedDiaries?: PlainTile[] | null;
  trackedCombatTasks?: PlainTile[] | null;
  trackedClog?: PlainTile[] | null;
  trackedRaids?: RaidTile[] | null;
  trackedCombos?: { tileId: number; label: string }[] | null;
  /** Team-level completions; a per-item collection tile is gated on this, not on its count. */
  completedTiles?: { tileId: number }[] | null;
}

/** One loot event, after the plugin's own clean-up (worn items removed, clue source folded, LMS dropped). */
export interface LootFact {
  k: 'loot';
  src: string | null;
  kind: SourceKind;
  /** [itemId, quantity] pairs. */
  items: [number, number][];
  /** Raid party size when the player was in an instance; null/absent otherwise. */
  party?: number | null;
  /** The item was worked out, not seen (a duplicate pet or scroll); the site flags it for review. */
  inf?: string | null;
  /** Inside a raid: the ToA level at the chest, and the party deaths seen. */
  lvl?: number | null;
  deaths?: number | null;
}

/** A haul priced by the client (GE value of the whole loot), for loot-value tiles. */
export interface ValueFact {
  k: 'value';
  src: string | null;
  kind: SourceKind;
  gp: number;
}

/**
 * One kill/open/counter event. `n` maps each counter name that moved to its amount: usually one
 * name and 1, but a slayer task or a GOTR game moves several for ONE event, and a tile listing more
 * than one of them takes the largest amount once, never the sum.
 */
export interface KillFact {
  k: 'kill';
  n: Record<string, number>;
  /** Names whose signal is unverified in game — the credit counts, staff see a check badge. */
  unv?: string[];
  /** A whole-fact flag (DuplicateInference etc.), carried onto the submission. */
  inf?: string | null;
  /** The absolute count the game's count line read for a name ("kill 3"), when the plugin read one. */
  c?: Record<string, number>;
}

/**
 * One raid clear on a key a raid tile listed (lib/tileConditions RaidRun, as the plugin saw it).
 * `key` is the clear line's raid name, lower-cased; the rest are absent when not seen.
 */
export interface RaidFact {
  k: 'raid';
  key: string;
  sec?: number;
  party?: number;
  scale?: number;
  deaths?: number;
  lvl?: number;
  mates?: number;
  all?: true;
  /** The raid's count line ("Your completed … count is: N"). */
  kc?: number;
}

/**
 * A tile the plugin decided on itself — its gates (party, deaths, raid level, roster, placement,
 * selectors) and its instant chat line stay in game; the site checks the tile is the caller's, files
 * it on the right board and writes the banner. `n` is the amount (1 but for gains), `sec` a timed
 * clear's seconds; `what` names the item / page / diary / task / victim; `tier` a combat task's
 * tier; `pg` a finished clog page; `tr` a Barracuda Trials rank run; `lvl` the ToA raid level;
 * `party` the party seen; `place`/`kills` an LMS finish.
 *
 * `note` marks a proof saved by an older plugin build, replayed from disk: its note and banner are
 * kept as written, `item`/`inf` are its itemId/inferred flag, and it may name any tracked tile, as
 * that build's submission could.
 */
export interface TileFact {
  k: 'tile';
  t: number;
  n: number;
  sec?: number;
  what?: string;
  tier?: string;
  pg?: true;
  tr?: true;
  lvl?: number;
  party?: number;
  place?: number;
  kills?: number;
  item?: number;
  inf?: string;
  note?: string;
}

/**
 * `done`: a fact the plugin re-sends after a transient filing failure carries the tiles it already
 * landed on (or was refused by), so only the ones that failed are filed again.
 */
export type Fact = (LootFact | ValueFact | KillFact | TileFact | RaidFact) & {
  done?: number[];
  /** The plugin's own id for this fact (lib/pluginFacts/factIds): made once, sent again unchanged. */
  id?: string;
};

export type CreditKind = 'drop' | 'value' | 'kill' | 'tile' | 'raid';

export interface Credit {
  kind: CreditKind;
  tileId: number;
  label: string;
  amount: number;
  /** Per-item collection tiles and "different items" pools name the item. */
  itemId?: number;
  /** Progress after this credit, in the unit the tile's row shows. */
  have: number;
  of: number;
  board?: FactBoard | null;
  inferred?: string | null;
  /** Value tiles in single-haul mode: this credit completes the tile. */
  completes?: boolean;
  /** Kill tiles: the parts the amount is made of (one per real action), for splitting into pings. */
  parts?: number[];
  /** Kill tiles: a cap counter (not a tile of its own, never a chat line). */
  quiet?: boolean;
  /** Kill tiles that need the client's view of its company. */
  coop?: boolean;
  pingMax?: number;
  /**
   * The tile's conditions (lib/tileConditions) were checked here on the site: only such a credit may
   * reach a conditioned tile (the facts route marks its filing, lib/pluginFacts/judged).
   */
  judged?: true;
  /** Raid credits: the clear as reported. */
  raid?: RaidFact;
  /** Tile credits: the fact as reported, the tile's kind and its config row. */
  fact?: TileFact;
  tileKind?: TileKind | 'drop' | 'kill' | 'value' | 'raid';
  row?: PlainTile;
  /** Indices (in the posted array) of the facts this credit came from. */
  fi?: number[];
}

export interface MatchResult {
  credits: Credit[];
  /** Lines for the player that are not credits (a party-size refusal). */
  notes: string[];
}

// ---------------------------------------------------------------------------------------------
// Names

const WIKI_QUALIFIER = /\s*\([^)]*\)\s*$/;
/**
 * Qualifiers that are part of the name the plugin reports, not wiki disambiguation: the awakened
 * DT2 bosses' count lines, and RuneLite's Tempoross / Wintertodt reward event names. Their bare
 * name would reach a different source ("Casket" is a fished casket), so it is never a key.
 */
const GAME_QUALIFIER = /\((awakened|tempoross|wintertodt)\)\s*$/i;
const CLUE_TIERS = ['beginner', 'easy', 'medium', 'hard', 'elite', 'master'];

/** The in-game name for a wiki NPC name ("Armoured zombie (Zemouregal's Fort)" → "Armoured zombie"). */
export function inGameNpcName(wikiName: string): string {
  return wikiName.replace(WIKI_QUALIFIER, '').trim();
}

/**
 * A clue-ish name folded to the plugin's "clue scroll (<tier>)" (AnvilPlugin.normalizeClueSource,
 * which every casket open is counted under), or null. "Reward casket (hard)" and "Clue Scroll
 * (Hard)" both land on "clue scroll (hard)"; a tierless name is not a clue key.
 */
function clueKey(lower: string): string | null {
  if (!(lower.includes('clue') || lower.includes('treasure trail') || lower.includes('casket'))) return null;
  const tier = CLUE_TIERS.find((t) => lower.includes(t));
  return tier ? `clue scroll (${tier})` : null;
}

/**
 * Every kill-index key a tile target answers to, lowercased:
 *  - a clue tier → only the plugin's "clue scroll (<tier>)" (a tier never reaches another tier);
 *  - a game-named qualifier ("Vardorvis (awakened)", "Supply crate (Wintertodt)") → the full name only;
 *  - otherwise the in-game name without a wiki qualifier ("Armoured zombie (Zemouregal's Fort)" →
 *    "armoured zombie") plus the name as written, for any other event name that carries "(…)".
 */
export function killTargetKeys(target: string | null | undefined): string[] {
  if (target == null) return [];
  const trimmed = target.trim();
  if (!trimmed) return [];
  const lower = trimmed.toLowerCase();
  const clue = clueKey(lower);
  if (clue) return [clue];
  if (GAME_QUALIFIER.test(trimmed)) return [lower];
  const stripped = inGameNpcName(trimmed).toLowerCase();
  return !stripped || stripped === lower ? [lower] : [stripped, lower];
}

/** The primary kill-index key for a target (see killTargetKeys). */
export function killTargetKey(target: string | null | undefined): string | null {
  return killTargetKeys(target)[0] ?? null;
}

/** The reported loot source is one of a tile's configured (wiki-named) NPCs. */
export function sourceMatches(sourceNpcs: string[], source: string | null): boolean {
  if (source == null) return false;
  const s = source.toLowerCase();
  return sourceNpcs.some((npc) => npc != null && (s === npc.toLowerCase() || s === inGameNpcName(npc).toLowerCase()));
}

/** Loot-value tile source filter: "PvP" = a player kill; anything else is a source name. Empty = any. */
export function valueSourceMatches(sources: string[] | null | undefined, source: string | null, kind: SourceKind): boolean {
  if (!sources || sources.length === 0) return true;
  return sources.some((s) => s != null && (s.toLowerCase() === 'pvp' ? kind === 'pvp' : source != null && s.toLowerCase() === source.toLowerCase()));
}

// ---------------------------------------------------------------------------------------------
// Collection progress (the plugin's ClogTaskModel.collectionProgress, which mirrors lib/collectionSets)

function requireCount(grp: ItemReq[]): number {
  const declared = grp.map((r) => r.groupRequire ?? 0).filter((n) => n > 0);
  const want = declared.length > 0 ? Math.max(...declared) : grp.length;
  return Math.min(Math.max(1, want), grp.length);
}

const met = (r: ItemReq) => r.currentAmount >= Math.max(1, r.requiredAmount);

function times(grp: ItemReq[], require: number): number {
  const per = grp.map((r) => Math.floor(r.currentAmount / Math.max(1, r.requiredAmount))).sort((a, b) => b - a);
  return per[Math.min(require, per.length) - 1] ?? 0;
}

/** [current, goal] for a collection tile, in the unit its row shows (pieces of the leading path). */
export function collectionProgress(reqs: ItemReq[], groupMode: string | null | undefined, setsRequired: number | undefined): [number, number] {
  const ungrouped: ItemReq[] = [];
  const groups = new Map<string, ItemReq[]>();
  for (const r of reqs) {
    const tag = r.group?.trim().toLowerCase();
    if (!tag) ungrouped.push(r);
    else groups.set(tag, [...(groups.get(tag) ?? []), r]);
  }
  const ungroupedSat = ungrouped.filter(met).length;
  if (groups.size === 0) return [ungroupedSat, Math.max(1, ungrouped.length)];
  const all = (groupMode ?? '').toLowerCase() === 'all';
  const sets = Math.max(1, setsRequired ?? 1);
  if (all) {
    let sat = ungroupedSat;
    let goal = ungrouped.length;
    for (const g of groups.values()) {
      const need = requireCount(g);
      sat += Math.min(g.filter(met).length, need);
      goal += need;
    }
    return [sat, Math.max(1, goal)];
  }
  if (sets > 1) {
    // N sets counted across groups: progress in pieces, done sets in full, the closest next one partly.
    let setsDone = 0;
    let unit = Number.MAX_SAFE_INTEGER;
    let bestPartial = 0;
    for (const g of groups.values()) {
      const need = requireCount(g);
      const t = times(g, need);
      setsDone += t;
      unit = Math.min(unit, need);
      const partial = g.filter((r) => r.currentAmount >= (t + 1) * Math.max(1, r.requiredAmount)).length;
      bestPartial = Math.max(bestPartial, Math.min(partial, need - 1));
    }
    const goal = ungrouped.length + sets * unit;
    const done = Math.min(setsDone, sets);
    const current = ungroupedSat + done * unit + (done < sets ? Math.min(bestPartial, unit - 1) : 0);
    const complete = setsDone >= sets && ungroupedSat >= ungrouped.length;
    return [complete ? goal : Math.min(current, goal - 1), Math.max(1, goal)];
  }
  // "any": each set plus the always-required items is one alternative; report the closest one.
  let best: [number, number] = [0, 1];
  let bestRemaining = Number.MAX_SAFE_INTEGER;
  for (const g of groups.values()) {
    const need = requireCount(g);
    const sat = ungroupedSat + Math.min(g.filter(met).length, need);
    const goal = ungrouped.length + need;
    if (goal <= 0) continue;
    if (sat >= goal) return [goal, goal];
    const remaining = goal - sat;
    if (remaining < bestRemaining || (remaining === bestRemaining && sat > best[0])) {
      best = [sat, Math.max(1, goal)];
      bestRemaining = remaining;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------------------------
// Matching

function completedSet(t: Tracked): Set<number> {
  return new Set((t.completedTiles ?? []).map((c) => c.tileId));
}

/** Drops: processLoot. Every tile tracking an item is credited (a sunfire piece on two tiles counts on both). */
export function matchLoot(fact: LootFact, t: Tracked, out: MatchResult, skip?: Set<number>): void {
  const drops = t.trackedDrops ?? [];
  if (drops.length === 0 || fact.items.length === 0) return;
  const done = completedSet(t);
  const creditedThisKill = new Map<number, number>();
  for (const [itemId, qty] of fact.items) {
    for (const drop of drops) {
      if (skip?.has(drop.tileId)) continue;
      const tracks = drop.itemRequirements?.length
        ? drop.itemRequirements.some((r) => r.itemId === itemId)
        : (drop.itemIds ?? []).includes(itemId);
      if (!tracks) continue;
      const perItem = !!drop.itemRequirements?.length;
      if (perItem ? done.has(drop.tileId) : drop.currentAmount >= drop.requiredAmount) continue;
      // Source kind: an explicit filter must match; none means "anything but PvP".
      if (drop.acceptedSources?.length) {
        if (!drop.acceptedSources.includes(fact.kind)) continue;
      } else if (fact.kind === 'pvp') continue;
      if (drop.sourceNpcs?.length && !sourceMatches(drop.sourceNpcs, fact.src)) continue;
      // A drop that must come from a ToA raid at a level (lib/tileConditions toaLevel): the plugin
      // reads the level at the chest and sends it with the loot.
      const toa = drop.conditions?.toaLevel;
      if (toa) {
        const verdict = fact.lvl == null ? ({ ok: false, why: 'the raid level was not seen' } as const) : toaLevelAllows(toa, fact.lvl);
        if (!verdict.ok) {
          out.notes.push(notCounted(drop, verdict.why));
          continue;
        }
      }
      if ((drop.partySize ?? 0) > 0) {
        const seen = fact.party ?? 0;
        if (fact.party == null || seen !== drop.partySize) {
          out.notes.push(`Drop not counted for ${drop.label}: party of ${seen}, tile requires ${drop.partySize}.`);
          continue;
        }
      }
      let stack = Math.max(1, qty);
      let killRoom = Number.MAX_SAFE_INTEGER;
      if ((drop.perKillCap ?? 0) > 0) {
        killRoom = drop.perKillCap! - (creditedThisKill.get(drop.tileId) ?? 0);
        if (killRoom <= 0) continue;
        stack = Math.min(stack, killRoom);
      }
      let amount: number;
      let trackingItemId: number | undefined;
      if (perItem) {
        const req = drop.itemRequirements!.find((r) => r.itemId === itemId)!;
        const cap = itemCap(req, drop.groupMode, drop.setsRequired);
        if (req.currentAmount >= cap) continue;
        trackingItemId = itemId;
        const perItemRoom = Math.max(1, cap - req.currentAmount);
        const tileRoom = Math.max(1, drop.requiredAmount - drop.currentAmount);
        amount = Math.min(stack, perItemRoom, tileRoom);
        req.currentAmount += amount;
      } else if (drop.countMode === 'distinct') {
        drop.countedItemIds ??= [];
        if (drop.countedItemIds.includes(itemId)) continue;
        drop.countedItemIds.push(itemId);
        trackingItemId = itemId;
        amount = 1;
      } else {
        amount = Math.min(stack, Math.max(1, drop.requiredAmount - drop.currentAmount));
      }
      if ((drop.perKillCap ?? 0) > 0) {
        amount = Math.min(amount, killRoom);
        creditedThisKill.set(drop.tileId, (creditedThisKill.get(drop.tileId) ?? 0) + amount);
      }
      drop.currentAmount += amount;
      const [have, of] = perItem
        ? collectionProgress(drop.itemRequirements!, drop.groupMode, drop.setsRequired)
        : [drop.currentAmount, drop.requiredAmount];
      out.credits.push({ kind: 'drop', tileId: drop.tileId, label: drop.label, amount, itemId: trackingItemId, have, of, board: drop.board, inferred: fact.inf ?? null, ...(toa ? { judged: true as const } : {}) });
    }
  }
}

/** Loot-value tiles: processValueTiles. Single-haul completes once; "total" sums every qualifying haul. */
export function matchValue(fact: ValueFact, t: Tracked, out: MatchResult, skip?: Set<number>): void {
  if (fact.gp <= 0) return;
  for (const v of t.trackedValues ?? []) {
    if (v.completed || skip?.has(v.tileId)) continue;
    const total = (v.mode ?? '').toLowerCase() === 'total';
    if (!total && fact.gp < v.thresholdGp) continue;
    if (!valueSourceMatches(v.sources, fact.src, fact.kind)) continue;
    const amount = Math.min(fact.gp, 2_147_483_647);
    if (total) {
      v.currentGp = (v.currentGp ?? 0) + fact.gp;
      out.credits.push({ kind: 'value', tileId: v.tileId, label: v.label, amount, have: Math.min(v.currentGp, v.thresholdGp), of: v.thresholdGp, board: v.board });
    } else {
      v.completed = true;
      out.credits.push({ kind: 'value', tileId: v.tileId, label: v.label, amount, have: v.thresholdGp, of: v.thresholdGp, board: v.board, completes: true });
    }
  }
}

/** Index kill tiles by every target key they answer to (a tile appears under each of its names). */
export function killIndex(t: Tracked): Map<string, KillTile[]> {
  const idx = new Map<string, KillTile[]>();
  for (const k of t.trackedKills ?? []) {
    for (const target of k.targetNpcs ?? []) {
      for (const key of killTargetKeys(target)) {
        const list = idx.get(key) ?? [];
        if (!list.includes(k)) list.push(k);
        idx.set(key, list);
      }
    }
  }
  return idx;
}

/** Kills: creditOncePerTile + creditKillTiles. A tile reached by several moved names takes the largest, once. */
export function matchKill(fact: KillFact, t: Tracked, out: MatchResult, index = killIndex(t), skip?: Set<number>): void {
  const done = completedSet(t);
  const unverified = new Set((fact.unv ?? []).map((n) => n.toLowerCase()));
  const amountByTile = new Map<KillTile, number>();
  const flagged = new Set<KillTile>();
  // The game's count line for the name that reached each tile (the highest, if several did).
  const lineByTile = new Map<KillTile, number>();
  const lines = new Map(Object.entries(fact.c ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  for (const [name, n] of Object.entries(fact.n)) {
    if (!(n > 0)) continue;
    for (const kill of index.get(name.toLowerCase()) ?? []) {
      if (n > (amountByTile.get(kill) ?? 0)) amountByTile.set(kill, n);
      if (unverified.has(name.toLowerCase())) flagged.add(kill);
      const line = lines.get(name.toLowerCase());
      if (line != null && line > (lineByTile.get(kill) ?? 0)) lineByTile.set(kill, line);
    }
  }
  for (const [kill, moved] of amountByTile) {
    if (kill.currentAmount >= kill.requiredAmount || skip?.has(kill.tileId)) continue;
    // "First 5 CoX" / "over 50 kills": the count when the event started, else the kill's own count line.
    const bar = kill.conditions?.startCount;
    if (bar) {
      const why = startCountRefusal(bar, kill.startCount ?? null, lineByTile.get(kill) ?? null, moved, KILL_WORDS);
      if (why) {
        out.notes.push(notCounted(kill, why));
        continue;
      }
    }
    // Never more than the tile still needs: an inflated count must not fan out into a flood of pings.
    const amount = Math.min(moved, kill.requiredAmount - kill.currentAmount);
    const cap = kill.capOf != null && kill.capOf > 0;
    if (cap && done.has(kill.capOf!)) continue;
    kill.currentAmount += amount;
    out.credits.push({
      kind: 'kill',
      tileId: kill.tileId,
      label: kill.label,
      amount,
      have: kill.currentAmount,
      of: kill.requiredAmount,
      board: kill.board,
      inferred: flagged.has(kill) ? UNVERIFIED_COUNTER : fact.inf ?? null,
      parts: [amount],
      quiet: cap,
      coop: (kill.coopCredit ?? '').toLowerCase() === 'per-kill' || (kill.coopMinMembers ?? 0) > 0,
      pingMax: kill.pingMax,
      ...(bar ? { judged: true as const } : {}),
    });
  }
}

/**
 * A tile the plugin judged itself: credited when it is one of the caller's tiles of a kind the plugin
 * may file this way (a replayed older proof may name any tracked tile). The submissions route still
 * does every check it always did.
 */
export function matchTile(fact: TileFact, t: Tracked, out: MatchResult, skip?: Set<number>): void {
  if (skip?.has(fact.t)) return;
  const lists: [string, PlainTile[] | null | undefined][] = Object.keys(TILE_LISTS).map((k) => [k, t[k as keyof typeof TILE_LISTS]]);
  if (fact.note != null) {
    lists.push(['drop', t.trackedDrops], ['kill', t.trackedKills], ['value', t.trackedValues as PlainTile[] | null | undefined]);
  }
  for (const [key, rows] of lists) {
    const row = rows?.find((r) => r?.tileId === fact.t);
    if (!row) continue;
    const kind = (TILE_LISTS as Record<string, TileKind>)[key] ?? (key as 'drop' | 'kill' | 'value');
    // The plugin judged this one itself, and it can't have judged conditions only the site checks
    // (a start count, a ToA level, raid bars): such a tile counts only through its own facts.
    const c = row.conditions;
    if (c && (c.startCount || c.toaLevel || c.raids?.length)) {
      out.notes.push(notCounted(row, 'this tile counts only clears and kills the site has checked'));
      return;
    }
    if (kind === 'timed' && !fact.sec) return;
    const combo = row.partOf ? t.trackedCombos?.find((c) => c.tileId === row.partOf) : undefined;
    const label = combo && (kind === 'gain' || kind === 'clog') ? `${combo.label.trim()} — ${row.label.trim()}` : row.label;
    const of = Math.max(1, row.requiredAmount ?? 1);
    row.currentAmount = Math.min(of, (row.currentAmount ?? 0) + fact.n);
    out.credits.push({ kind: 'tile', tileId: fact.t, label, amount: fact.n, have: row.currentAmount, of, board: row.board, inferred: fact.inf ?? null, fact, tileKind: kind, row });
    return;
  }
}

// ---------------------------------------------------------------------------------------------
// Tile conditions (lib/tileConditions): raid clears, and the count when the event started

/** "Not counted: <tile>: <why>." — the line the plugin prints for a site-judged refusal. */
export function notCounted(row: { label: string; board?: FactBoard | null }, why: string): string {
  const name = row.board?.name;
  const label = name && !row.label.endsWith(` \u00b7 ${name}`) ? `${row.label} \u00b7 ${name}` : row.label;
  return `Not counted: ${label}: ${why}.`;
}

const KILL_WORDS = { one: 'kill', many: 'kills' };
const CLEAR_WORDS = { one: 'clear', many: 'clears' };

/**
 * Why a start-count tile refuses this player's credit, or null when it takes it. The count from the
 * event start decides when it is known; otherwise the game's count line, which reads the count
 * AFTER this event (`moved` of them), so the count before it is line - moved. Neither known: taken.
 */
export function startCountRefusal(bar: StartCount, start: number | null, line: number | null, moved: number, noun: { one: string; many: string }): string | null {
  if (start != null) {
    return startCountAllows(bar, start) ? null : `you had ${start.toLocaleString('en-US')} ${start === 1 ? noun.one : noun.many} when it started`;
  }
  // Neither known: refused, never assumed. A missed first would be lost, but a fifth kill credited as a
  // first can't be taken back by anything the player sees.
  if (line == null) return `your ${noun.one} count wasn't seen; make sure the game's ${noun.one} count messages are on`;
  // countLineAllows reads one event: shift a burst of several so "line" is the first of them.
  const first = line - Math.max(1, moved) + 1;
  if (countLineAllows(bar, first)) return null;
  return bar.op === 'lt'
    ? `this was ${noun.one} ${first.toLocaleString('en-US')}, so you'd done it before`
    : `this was ${noun.one} ${first.toLocaleString('en-US')}, needs over ${bar.n.toLocaleString('en-US')} before it`;
}

/**
 * A raid clear against the caller's raid tiles. Each tile listing the clear's key judges it on its own
 * (judgeRaidRun: the picks' bars, then deaths and teammates, then the start count); a refusal is a
 * note in plain words, since the plugin says nothing itself for these tiles.
 */
export function matchRaid(fact: RaidFact, t: Tracked, out: MatchResult, skip?: Set<number>): void {
  const mode = RAID_KEY_MODES.get(fact.key.toLowerCase());
  if (!mode) return;
  const done = completedSet(t);
  const run = {
    raid: mode.raid,
    // ToA's mode is its level; the line's name is only the band the level fell in.
    mode: mode.raid === 'toa' && fact.lvl != null ? toaModeFor(fact.lvl) : mode.mode,
    sec: fact.sec ?? null,
    party: fact.party ?? null,
    scale: fact.scale ?? null,
    deaths: fact.deaths ?? null,
    lvl: fact.lvl ?? null,
    mates: fact.mates ?? null,
    allMates: fact.all ?? null,
  };
  for (const r of t.trackedRaids ?? []) {
    if (skip?.has(r.tileId) || r.completed || done.has(r.tileId)) continue;
    if (!(r.keys ?? []).includes(fact.key.toLowerCase())) continue;
    const c = r.conditions;
    if (!c) continue;
    if (r.currentAmount >= r.requiredAmount) continue;
    const verdict = judgeRaidRun(c, run);
    if (!verdict.ok) {
      out.notes.push(notCounted(r, verdict.why));
      continue;
    }
    if (c.startCount) {
      const why = startCountRefusal(c.startCount, r.startCount ?? null, fact.kc ?? null, 1, CLEAR_WORDS);
      if (why) {
        out.notes.push(notCounted(r, why));
        continue;
      }
    }
    r.currentAmount += 1;
    out.credits.push({ kind: 'raid', tileId: r.tileId, label: r.label, amount: 1, have: r.currentAmount, of: r.requiredAmount, board: r.board, raid: fact, tileKind: 'raid', judged: true });
  }
}

/** The inferred flag the plugin used for counters nobody has checked in game yet. */
export const UNVERIFIED_COUNTER = 'unverified_counter';

/** Run a batch of facts in order against one player's tracked tiles. */
export function matchFacts(facts: Fact[], t: Tracked): MatchResult {
  const out: MatchResult = { credits: [], notes: [] };
  const index = killIndex(t);
  facts.forEach((f, i) => {
    const from = out.credits.length;
    const skip = f.done?.length ? new Set(f.done) : undefined;
    if (f.k === 'loot') matchLoot(f, t, out, skip);
    else if (f.k === 'value') matchValue(f, t, out, skip);
    else if (f.k === 'kill') matchKill(f, t, out, index, skip);
    else if (f.k === 'tile') matchTile(f, t, out, skip);
    else if (f.k === 'raid') matchRaid(f, t, out, skip);
    for (const c of out.credits.slice(from)) c.fi = [i];
  });
  return out;
}

// ---------------------------------------------------------------------------------------------
// Submission planning (the plugin's flush rules)

/** The most one image-less ping may credit when the site sent no pingMax (lib/pingMax). */
export const MAX_PING_AMOUNT = 10;
const PROOF_LARGE_TILE_MIN = 25;
const PROOF_MILESTONE_FRACTION = 0.25;

/** A grindy kill tile proves only on 25% steps (and completion); a small one proves every credit. */
export function crossesProofMilestone(added: number, current: number, required: number): boolean {
  if (required < PROOF_LARGE_TILE_MIN) return true;
  const step = Math.max(1, required * PROOF_MILESTONE_FRACTION);
  return Math.floor(current / step) > Math.floor((current - added) / step);
}

/** Image-less pings for a kill burst, or null when it must go as a proof (planPings). */
export function planPings(parts: number[], total: number, pingMax: number | undefined): number[] | null {
  if (!pingMax || pingMax <= 0) return total <= MAX_PING_AMOUNT ? [total] : null;
  const sum = parts.reduce((a, b) => a + b, 0);
  if (sum !== total || total <= pingMax) return [total];
  const out: number[] = [];
  let chunk = 0;
  for (const p of parts) {
    if (chunk > 0 && chunk + p > pingMax) {
      out.push(chunk);
      chunk = 0;
    }
    chunk += p;
  }
  if (chunk > 0) out.push(chunk);
  return out;
}

/** Does this kill credit want a screenshot proof (milestone, completion, or too big for a ping)? */
export function killWantsProof(c: Credit): boolean {
  if (c.have >= c.of) return true;
  if (crossesProofMilestone(c.amount, c.have, c.of)) return true;
  return planPings(c.parts ?? [c.amount], c.amount, c.pingMax) == null;
}

/** Fold same-tile credits of one batch into one (the plugin's per-tile burst). */
export function coalesce(credits: Credit[]): Credit[] {
  const out: Credit[] = [];
  const byKey = new Map<string, Credit>();
  for (const c of credits) {
    const key = `${c.kind}:${c.tileId}:${c.itemId ?? '-'}`;
    const had = byKey.get(key);
    if (!had || c.kind === 'value' || c.kind === 'tile' || c.kind === 'raid') {
      const copy = { ...c, parts: c.parts ? [...c.parts] : undefined, fi: c.fi ? [...c.fi] : undefined };
      if (!had) byKey.set(key, copy);
      out.push(copy);
      continue;
    }
    had.amount += c.amount;
    had.have = c.have;
    had.of = c.of;
    if (c.parts) had.parts = [...(had.parts ?? []), ...c.parts];
    if (c.inferred) had.inferred = c.inferred;
    for (const i of c.fi ?? []) if (!had.fi?.includes(i)) (had.fi ??= []).push(i);
  }
  return out;
}
