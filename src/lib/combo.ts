import { isIndividualMode } from '@/lib/statTracking';

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// COMBO tiles — "any mixture of tiles".
//
//   "A GOTR rare reward OR 100 searches"          → any  of [drop pool, counter]
//   "A Zulrah pet AND 99 Fishing"                 → all  of [drop, hiscores XP]
//   "2 of: Tbow, Scythe, Shadow, a CoX pet"       → nOf (n = 2) of four drop tiles
//   "200 demonic gorillas or 2 zenytes (any mix)" → mix: each part adds its share — 1 zenyte + 100
//                                                   kills is 50% + 50%, done
//
// A combo is a parent tile (tileType 'combo', tiles.combo_rule) whose PARTS are ordinary tiles of any
// kind (tiles.parent_tile_id → the parent). Parts keep their own engines — hiscores sweeps, plugin
// crediting, submissions, completion sync — completely unchanged; a part completing writes an ordinary
// `completions` row, which is the part's progress. The PARENT's completion is what scores, and it is
// recomputed from its parts' completions whenever one changes (lib/comboCompletion).
//
// Parts are NOT board cells. Everything that lays the board out, counts tiles, scores or announces
// runs on board tiles only — lib/eventRules boardTiles drops parts, and SQL readers filter
// `parent_tile_id IS NULL` (lib/comboSql boardTileWhere).
//
// Pure — the server, the board, the editor and the tests share it.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

export type ComboMode = 'any' | 'all' | 'nOf' | 'mix';

export interface ComboRule {
  mode: ComboMode;
  /** nOf only: how many parts must complete (2..parts-1 to be meaningful; clamped to the part count). */
  n?: number;
}

export const COMBO_TILE_TYPE = 'combo';
/** Parts a combo may have. Small on purpose: a combo is "this or that", not a board inside a cell. */
export const MAX_COMBO_PARTS = 6;
export const MIN_COMBO_PARTS = 2;

export function isComboTile(t: { tileType?: string | null }): boolean {
  return t.tileType === COMBO_TILE_TYPE;
}

/** A combo's part — a real tile that is never a board cell of its own. */
export function isPart(t: { parentTileId?: number | null }): boolean {
  return t.parentTileId != null;
}

/** The board-cell subset: drops every combo part. */
export function withoutParts<T extends { parentTileId?: number | null }>(tiles: T[]): T[] {
  return tiles.filter((t) => !isPart(t));
}

/** Parent id → its parts, in position/id order. */
export function partsByParent<T extends { id: number; parentTileId?: number | null }>(tiles: T[]): Map<number, T[]> {
  const out = new Map<number, T[]>();
  for (const t of tiles) {
    if (t.parentTileId == null) continue;
    const list = out.get(t.parentTileId) ?? [];
    list.push(t);
    out.set(t.parentTileId, list);
  }
  for (const list of out.values()) list.sort((a, b) => a.id - b.id);
  return out;
}

/**
 * Every row of an event → its board cells, each combo carrying its `parts` (in id order). What the
 * board pages hand their client: the parts never become cells, but the combo's cell and detail can
 * show them.
 */
export function nestParts<T extends { id: number; parentTileId?: number | null; tileType?: string | null }>(tiles: T[]): (T & { parts?: T[] })[] {
  const parts = partsByParent(tiles);
  return withoutParts(tiles).map((t) => (isComboTile(t) ? { ...t, parts: parts.get(t.id) ?? [] } : t));
}

/** A tile's id plus, for a combo, its parts' — "this tile's proof" on a combo is its parts'. */
export function tileWithPartIds(tiles: readonly { id: number; parts?: readonly { id: number }[] }[], tileId: number | null | undefined): Set<number> {
  const out = new Set<number>();
  if (tileId == null) return out;
  out.add(tileId);
  for (const p of tiles.find((t) => t.id === tileId)?.parts ?? []) out.add(p.id);
  return out;
}

/**
 * Validate a combo rule from an API body (object or JSON text). The single gate every write path goes
 * through, so a stored combo_rule is always well-formed. `partCount`, when known, bounds nOf's n.
 */
export function validateComboRule(input: unknown, partCount?: number): { ok: true; value: ComboRule } | { ok: false; error: string } {
  let raw: unknown = input;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return { ok: false, error: "comboRule must be JSON { mode: 'any' | 'all' | 'nOf', n? }" };
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: "comboRule must be { mode: 'any' | 'all' | 'nOf', n? }" };
  }
  const o = raw as Record<string, unknown>;
  const mode = o.mode;
  if (mode !== 'any' && mode !== 'all' && mode !== 'nOf' && mode !== 'mix') {
    return { ok: false, error: "comboRule.mode must be 'any', 'all', 'nOf' or 'mix'" };
  }
  if (mode !== 'nOf') return { ok: true, value: { mode } };
  const n = o.n;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > MAX_COMBO_PARTS) {
    return { ok: false, error: `comboRule.n must be a whole number between 1 and ${MAX_COMBO_PARTS}` };
  }
  if (partCount != null && n > partCount) {
    return { ok: false, error: `A combo can't need ${n} of only ${partCount} parts` };
  }
  return { ok: true, value: { mode, n } };
}

/** A stored combo_rule (JSON text) → the rule; malformed/absent reads as 'any' (the forgiving default). */
export function parseComboRule(raw: unknown): ComboRule {
  if (raw == null || raw === '') return { mode: 'any' };
  const res = validateComboRule(raw);
  return res.ok ? res.value : { mode: 'any' };
}

export function serializeComboRule(rule: ComboRule): string {
  return JSON.stringify(rule.mode === 'nOf' ? { mode: 'nOf', n: rule.n } : { mode: rule.mode });
}

/** How many parts must complete under the rule ('mix' counts shares instead: 1 whole part's worth). */
export function comboNeeded(rule: ComboRule, partCount: number): number {
  if (partCount <= 0) return 1;
  if (rule.mode === 'mix') return 1;
  if (rule.mode === 'all') return partCount;
  if (rule.mode === 'nOf') return Math.max(1, Math.min(rule.n ?? 1, partCount));
  return 1;
}

/** A part's completion, for one team. */
export interface PartCompletion {
  tileId: number;
  /** Who finished it — a Solo part's finisher; null for a team total / manual completion. */
  creditPlayerId?: number | null;
}

export interface ComboEvaluation {
  complete: boolean;
  /** Parts done (for the team; under a Solo combo, the best single member's — team-wide parts included). */
  done: number;
  needed: number;
  total: number;
  /** Solo combo: the member who satisfied the rule alone. Null for a team combo. */
  finisherPlayerId: number | null;
}

/**
 * Does a team's set of part completions satisfy the combo rule?
 *
 * Team combo (the default): parts done by anyone on the team count.
 * Solo combo ("one player does it all"): a part counts for a member when THEY finished it (a Solo
 * part's completion names its finisher) — or when it was finished as a team (no finisher: a team-total
 * part or a manual completion), which counts for everyone. The combo completes when one member's own
 * tally meets the rule; they are its finisher.
 */
export function evaluateCombo(
  rule: ComboRule,
  partIds: readonly number[],
  completions: readonly PartCompletion[],
  trackingMode?: string | null,
): ComboEvaluation {
  const total = partIds.length;
  const needed = comboNeeded(rule, total);
  const partSet = new Set(partIds);
  const doneRows = completions.filter((c) => partSet.has(c.tileId));
  const teamDone = new Set(doneRows.map((c) => c.tileId));
  if (total === 0) return { complete: false, done: 0, needed, total, finisherPlayerId: null };
  if (!isIndividualMode(trackingMode)) {
    return { complete: teamDone.size >= needed, done: teamDone.size, needed, total, finisherPlayerId: null };
  }
  const shared = new Set(doneRows.filter((c) => c.creditPlayerId == null).map((c) => c.tileId));
  const perMember = new Map<number, Set<number>>();
  for (const c of doneRows) {
    if (c.creditPlayerId == null) continue;
    const s = perMember.get(c.creditPlayerId) ?? new Set(shared);
    s.add(c.tileId);
    perMember.set(c.creditPlayerId, s);
  }
  let best = shared.size;
  let finisher: number | null = null;
  for (const [player, s] of perMember) {
    // Every member's set includes the team-wide parts, so the first member seen ties `best` and takes
    // it; after that only a strictly bigger tally wins.
    if (s.size > best || finisher == null) {
      best = s.size;
      finisher = player;
    }
  }
  return { complete: best >= needed, done: best, needed, total, finisherPlayerId: best >= needed ? finisher : null };
}

// ─── Words ──────────────────────────────────────────────────────────────────────────────────────

const SPELLED = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];
const spell = (n: number) => SPELLED[n] ?? String(n);

/** "any one of" / "all of" / "any 2 of" — the rule as the lead-in to a list of parts. */
export function comboRuleLead(rule: ComboRule, partCount: number): string {
  if (rule.mode === 'mix') return 'any mix of';
  if (rule.mode === 'all' || (rule.mode === 'nOf' && comboNeeded(rule, partCount) >= partCount && partCount > 1)) {
    return partCount === 2 ? 'both of' : 'all of';
  }
  const n = comboNeeded(rule, partCount);
  return n === 1 ? 'any one of' : `any ${spell(n)} of`;
}

/** Short rule label for a cell / badge: "Any 1 of 2", "All 3", "2 of 4". */
export function comboRuleShort(rule: ComboRule, partCount: number): string {
  if (rule.mode === 'mix') return 'Mix to 100%';
  if (rule.mode === 'all') return `All ${partCount}`;
  const n = comboNeeded(rule, partCount);
  return n === 1 ? `Any of ${partCount}` : `${n} of ${partCount}`;
}

/** "1 of 2 done" — the parent's progress line. Counts toward what the rule needs, not every part. */
export function comboProgressNote(done: number, needed: number): string {
  return `${Math.min(done, needed)} of ${needed} done`;
}

/** "Get A, or do B" style sentence: "Done when the team does any one of: A; B." */
export function comboSentence(rule: ComboRule, partLabels: readonly string[], solo = false): string {
  const who = solo ? 'one player' : 'the team';
  const tail = rule.mode === 'mix' ? ' — each part adds its share, done at 100%' : '';
  return `Done when ${who} does ${comboRuleLead(rule, partLabels.length)}: ${partLabels.join('; ')}${tail}.`;
}

/** Default label for a combo from its parts: "A or B", "A and B", "2 of: A, B, C". */
export function comboLabel(rule: ComboRule, partLabels: readonly string[]): string {
  if (partLabels.length === 0) return 'Combo';
  if (rule.mode === 'mix') return `${joinWith(partLabels, 'or')} (any mix)`;
  if (rule.mode === 'all') return joinWith(partLabels, 'and');
  const n = comboNeeded(rule, partLabels.length);
  if (n === 1) return joinWith(partLabels, 'or');
  return `${n} of: ${partLabels.join(', ')}`;
}

function joinWith(labels: readonly string[], word: string): string {
  if (labels.length <= 2) return labels.join(` ${word} `);
  return `${labels.slice(0, -1).join(', ')} ${word} ${labels[labels.length - 1]}`;
}

// ─── Mix ('mix'): weighted shares ──────────────────────────────────────────────────────────────
//
// "200 demonic gorilla kills or 2 zenytes (any mix)": each part contributes weight × its own fraction
// done, capped at its own share — so 1 zenyte (½ of 2) and 100 kills (½ of 200) make 100%. A part with
// no partial progress (a timed clear, a single item) is worth 0 or its whole weight. Team combos sum
// the team's fractions; a Solo combo sums each member's own and completes on the first to reach 100%.

/** Rounding slack, so 1/3 + 1/3 + 1/3 reads as done. */
const MIX_EPSILON = 1e-9;

/** A part's progress for one team (or one member): finished, or how far along. */
export interface PartState {
  done: boolean;
  current?: number | null;
  required?: number | null;
}

/** A part's weight in a mix (null/absent/invalid = 1). */
export function comboWeightOf(part: { comboWeight?: number | null }): number {
  const w = part.comboWeight;
  return typeof w === 'number' && Number.isFinite(w) && w > 0 ? w : 1;
}

/** Validate a part weight from an API body: (0, 1], or null/'' for the default 1. */
export function validateComboWeight(input: unknown): { ok: true; value: number | null } | { ok: false; error: string } {
  if (input == null || input === '') return { ok: true, value: null };
  const n = typeof input === 'string' ? Number(input) : input;
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0 || n > 1) {
    return { ok: false, error: 'A part’s weight must be more than 0 and at most 1 (1 = a whole part completes the combo).' };
  }
  return { ok: true, value: n === 1 ? null : Math.round(n * 1000) / 1000 };
}

/** How much of its part is done, 0..1 — finished parts are 1, parts without partial progress 0. */
export function partFraction(st: PartState | undefined): number {
  if (!st) return 0;
  if (st.done) return 1;
  if (st.current == null || st.required == null || st.required <= 0) return 0;
  return Math.max(0, Math.min(1, st.current / st.required));
}

/** Σ weight × fraction over the parts — 1 = 100%. Each part capped at its own share. */
export function mixShare(parts: readonly { id: number; comboWeight?: number | null }[], state: (partId: number) => PartState | undefined): number {
  return parts.reduce((sum, p) => sum + comboWeightOf(p) * partFraction(state(p.id)), 0);
}

export interface MixEvaluation {
  complete: boolean;
  /** The team's share (Team), or the best member's (Solo), 0..∞ — 1 = 100%. */
  share: number;
  /** Solo: the member who reached 100% alone. */
  finisherPlayerId: number | null;
}

/**
 * Evaluate a mix combo. `team` is each part's state for the team; `members` (Solo only) each member's
 * own state per part — a part the team finished without a named finisher counts as done for everyone.
 */
export function evaluateMix(
  parts: readonly { id: number; comboWeight?: number | null }[],
  team: (partId: number) => PartState | undefined,
  trackingMode?: string | null,
  members?: Map<number, (partId: number) => PartState | undefined>,
): MixEvaluation {
  if (parts.length === 0) return { complete: false, share: 0, finisherPlayerId: null };
  if (!isIndividualMode(trackingMode) || !members) {
    const share = mixShare(parts, team);
    return { complete: share >= 1 - MIX_EPSILON, share, finisherPlayerId: null };
  }
  let best = 0;
  let finisher: number | null = null;
  for (const [player, own] of members) {
    const share = mixShare(parts, own);
    if (share > best) {
      best = share;
      finisher = player;
    }
  }
  const complete = best >= 1 - MIX_EPSILON;
  return { complete, share: best, finisherPlayerId: complete ? finisher : null };
}

/** "75%" — a mix's share as the board says it (floored, so 99.9% never reads as done). */
export function mixPercent(share: number): string {
  return `${Math.min(100, Math.floor(share * 100 + MIX_EPSILON * 100))}%`;
}
