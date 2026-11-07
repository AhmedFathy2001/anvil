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
}

export interface KillTile extends TrackedBase {
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

export interface Tracked {
  trackedDrops?: DropTile[] | null;
  trackedKills?: KillTile[] | null;
  trackedValues?: ValueTile[] | null;
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
}

export type Fact = LootFact | ValueFact | KillFact;

export type CreditKind = 'drop' | 'value' | 'kill';

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
}

export interface MatchResult {
  credits: Credit[];
  /** Lines for the player that are not credits (a party-size refusal). */
  notes: string[];
}

// ---------------------------------------------------------------------------------------------
// Names

const WIKI_QUALIFIER = /\s*\([^)]*\)\s*$/;
const MODE_QUALIFIER = /\(awakened\)\s*$/i;

/** The in-game name for a wiki NPC name ("Armoured zombie (Zemouregal's Fort)" → "Armoured zombie"). */
export function inGameNpcName(wikiName: string): string {
  return wikiName.replace(WIKI_QUALIFIER, '').trim();
}

/** Kill-index key: lowercased, wiki qualifier dropped — except a mode the game names itself. */
export function killTargetKey(target: string | null | undefined): string | null {
  if (target == null) return null;
  const trimmed = target.trim();
  const name = MODE_QUALIFIER.test(trimmed) ? trimmed : inGameNpcName(trimmed);
  return name ? name.toLowerCase() : null;
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
export function matchLoot(fact: LootFact, t: Tracked, out: MatchResult): void {
  const drops = t.trackedDrops ?? [];
  if (drops.length === 0 || fact.items.length === 0) return;
  const done = completedSet(t);
  const creditedThisKill = new Map<number, number>();
  for (const [itemId, qty] of fact.items) {
    for (const drop of drops) {
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
      out.credits.push({ kind: 'drop', tileId: drop.tileId, label: drop.label, amount, itemId: trackingItemId, have, of, board: drop.board, inferred: fact.inf ?? null });
    }
  }
}

/** Loot-value tiles: processValueTiles. Single-haul completes once; "total" sums every qualifying haul. */
export function matchValue(fact: ValueFact, t: Tracked, out: MatchResult): void {
  if (fact.gp <= 0) return;
  for (const v of t.trackedValues ?? []) {
    if (v.completed) continue;
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
      const key = killTargetKey(target);
      if (!key) continue;
      const list = idx.get(key) ?? [];
      if (!list.includes(k)) list.push(k);
      idx.set(key, list);
    }
  }
  return idx;
}

/** Kills: creditOncePerTile + creditKillTiles. A tile reached by several moved names takes the largest, once. */
export function matchKill(fact: KillFact, t: Tracked, out: MatchResult, index = killIndex(t)): void {
  const done = completedSet(t);
  const unverified = new Set((fact.unv ?? []).map((n) => n.toLowerCase()));
  const amountByTile = new Map<KillTile, number>();
  const flagged = new Set<KillTile>();
  for (const [name, n] of Object.entries(fact.n)) {
    if (!(n > 0)) continue;
    for (const kill of index.get(name.toLowerCase()) ?? []) {
      if (n > (amountByTile.get(kill) ?? 0)) amountByTile.set(kill, n);
      if (unverified.has(name.toLowerCase())) flagged.add(kill);
    }
  }
  for (const [kill, moved] of amountByTile) {
    if (kill.currentAmount >= kill.requiredAmount) continue;
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
    });
  }
}

/** The inferred flag the plugin used for counters nobody has checked in game yet. */
export const UNVERIFIED_COUNTER = 'unverified_counter';

/** Run a batch of facts in order against one player's tracked tiles. */
export function matchFacts(facts: Fact[], t: Tracked): MatchResult {
  const out: MatchResult = { credits: [], notes: [] };
  const index = killIndex(t);
  for (const f of facts) {
    if (f.k === 'loot') matchLoot(f, t, out);
    else if (f.k === 'value') matchValue(f, t, out);
    else if (f.k === 'kill') matchKill(f, t, out, index);
  }
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
    if (!had || c.kind === 'value') {
      const copy = { ...c, parts: c.parts ? [...c.parts] : undefined };
      if (!had) byKey.set(key, copy);
      out.push(copy);
      continue;
    }
    had.amount += c.amount;
    had.have = c.have;
    had.of = c.of;
    if (c.parts) had.parts = [...(had.parts ?? []), ...c.parts];
    if (c.inferred) had.inferred = c.inferred;
  }
  return out;
}
