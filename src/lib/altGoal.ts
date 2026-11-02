import { COUNTER_TARGETS } from '@/lib/constants';
import { submissionCreditKey, UNATTRIBUTED_CREDIT, type CountedSubmission } from '@/lib/countProgress';
import { isIndividualMode } from '@/lib/statTracking';

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// "Either / or" tiles: a second way to finish a submission-backed tile.
//
//   "A Guardians of the Rift rare reward OR 100 reward searches using energy earned during the event"
//
// The tile keeps its own (primary) requirement — the drop pool, the kills, the collection — and
// `tiles.alt_goal` adds an alternative: a plugin counter / NPC-kill target (the names a kill tile's
// `targetNpcs` takes) and an amount, optionally CAPPED by other counters. The tile completes when the
// primary is met OR the alternative is.
//
// Crediting rides the kill-tile machinery every plugin build already has. The config route sends, for
// each such tile the team hasn't finished, extra trackedKills entries with a VIRTUAL negative tileId
// (altVirtualTileId): slot 0 is the alt goal, slots 1..n the cap counters. A plugin credits them like
// any kill tile and submits to the negative id; the submissions route decodes it back to the parent
// and stores the row against the parent with `submissions.goal` = 'alt' / 'cap:N'.
//
// THE RULE THAT MATTERS: a row with a goal never counts toward the primary requirement (100 searches
// must not read as 100 items on a drop tile). lib/countProgress drops them as a belt; every SQL total
// filters `goal IS NULL`.
//
// Caps are applied PER MEMBER, then summed (Team) or the best member taken (Solo) — the same shape as
// lib/countProgress. GOTR: a search costs one elemental + one catalytic energy point, so the searches
// that count are min(searches, elemental attuned, catalytic attuned) for each member.
//
// Pure — the server, the board and the tests share it.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

export interface AltGoal {
  /** Kill-tile target names (NPCs or COUNTER_TARGETS) — any of them counts. */
  targets: string[];
  /** How many the alternative needs. */
  amount: number;
  /** Each entry is ONE counter whose per-member total caps the goal. Absent/empty = uncapped. */
  capBy?: string[];
}

/** Virtual ids: -(parentId * STRIDE + slot). Slot 0 = the goal, 1..n = capBy[n-1]. */
export const ALT_SLOT_STRIDE = 8;
/** Cap counters a goal may carry (slots 1..MAX_ALT_CAPS). */
export const MAX_ALT_CAPS = 4;
/** What a cap counter's virtual entry asks for — "never finishes", it only keeps counting. */
export const ALT_CAP_REQUIRED = 1_000_000;
export const ALT_GOAL_KEY = 'alt';

export const GOTR_SEARCHES = 'Guardians of the Rift searches';
export const GOTR_ENERGY_CAPS = ['GOTR elemental energy', 'GOTR catalytic energy'] as const;

/**
 * Kinds whose completion runs through submissions — the ones an alternative can attach to. Hiscores
 * stat tiles (skill XP / boss KC: a trackedStat) never can: they don't complete from submissions.
 */
export const ALT_GOAL_KINDS = new Set(['drop', 'kill', 'lap', 'pvp', 'gain', 'deathless', 'diary', 'ca', 'lms', 'value', 'valuetotal', 'timed']);

export function altGoalEligible(tile: { tileType?: string | null; trackedStat?: string | null }): boolean {
  return !!tile.tileType && ALT_GOAL_KINDS.has(tile.tileType) && !tile.trackedStat;
}

const MAX_TARGETS = 10;
const MAX_NAME = 80;
const MAX_AMOUNT = 1_000_000;

function cleanNames(v: unknown, max: number): string[] | null {
  if (!Array.isArray(v)) return null;
  const out: string[] = [];
  for (const n of v) {
    if (typeof n !== 'string') return null;
    const t = n.trim().replace(/\s+/g, ' ');
    if (!t || t.length > MAX_NAME) return null;
    if (!out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  return out.length <= max ? out : null;
}

/**
 * Validate an alt goal from an API body (object, JSON text, or null/'' to clear). The single gate every
 * write path goes through, so a stored alt_goal is always well-formed.
 */
export function validateAltGoal(input: unknown): { ok: true; value: AltGoal | null } | { ok: false; error: string } {
  if (input == null || input === '') return { ok: true, value: null };
  let raw: unknown = input;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return { ok: false, error: 'altGoal must be JSON { targets, amount, capBy? }' };
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'altGoal must be an object { targets, amount, capBy? } or null' };
  }
  const o = raw as Record<string, unknown>;
  const targets = cleanNames(o.targets, MAX_TARGETS);
  if (!targets || targets.length === 0) {
    return { ok: false, error: `altGoal.targets must list 1–${MAX_TARGETS} counter or NPC names` };
  }
  const amount = o.amount;
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 1 || amount > MAX_AMOUNT) {
    return { ok: false, error: `altGoal.amount must be a whole number between 1 and ${MAX_AMOUNT.toLocaleString('en-US')}` };
  }
  let capBy: string[] | undefined;
  if (o.capBy != null) {
    const caps = cleanNames(o.capBy, MAX_ALT_CAPS);
    if (!caps) return { ok: false, error: `altGoal.capBy must list at most ${MAX_ALT_CAPS} counter names` };
    if (caps.some((c) => targets.some((t) => t.toLowerCase() === c.toLowerCase()))) {
      return { ok: false, error: 'altGoal.capBy can’t repeat one of its own targets' };
    }
    if (caps.length > 0) capBy = caps;
  }
  return { ok: true, value: capBy ? { targets, amount, capBy } : { targets, amount } };
}

/** A stored alt_goal (JSON text) or an editor object → the goal, or null when absent/malformed. */
export function parseAltGoal(raw: unknown): AltGoal | null {
  const res = validateAltGoal(raw);
  return res.ok ? res.value : null;
}

export function serializeAltGoal(goal: AltGoal | null | undefined): string | null {
  return goal ? JSON.stringify(goal) : null;
}

// ─── Virtual tile ids ───────────────────────────────────────────────────────────────────────────

export function altVirtualTileId(parentId: number, slot: number): number {
  return -(parentId * ALT_SLOT_STRIDE + slot);
}

/** A negative tileId back to its parent and slot; null for anything that isn't one. */
export function decodeAltTileId(id: number): { parentId: number; slot: number } | null {
  if (!Number.isInteger(id) || id >= 0) return null;
  const n = -id;
  const parentId = Math.floor(n / ALT_SLOT_STRIDE);
  const slot = n % ALT_SLOT_STRIDE;
  if (parentId < 1) return null;
  return { parentId, slot };
}

/** The submissions.goal value a slot stores, or null when the goal has no such slot. */
export function goalForSlot(goal: AltGoal, slot: number): string | null {
  if (slot === 0) return ALT_GOAL_KEY;
  const caps = goal.capBy ?? [];
  if (slot >= 1 && slot <= caps.length) return `cap:${slot - 1}`;
  return null;
}

/** Index into capBy for a 'cap:N' row; null for anything else. */
export function capIndex(goalValue: string | null | undefined): number | null {
  if (!goalValue || !goalValue.startsWith('cap:')) return null;
  const n = Number(goalValue.slice(4));
  return Number.isInteger(n) && n >= 0 ? n : null;
}

// ─── Progress ───────────────────────────────────────────────────────────────────────────────────

export interface GoalRow extends CountedSubmission {
  goal?: string | null;
}

export interface AltProgress {
  /** Progress toward goal.amount under the tile's mode — the capped team sum, or the best member. */
  current: number;
  /** Solo: who `current` belongs to (null in team mode or when it is the unattributed bucket). */
  finisherPlayerId: number | null;
  /** The capped sum over every member, regardless of mode. */
  teamTotal: number;
  /** Each member's capped count, keyed like lib/countProgress (UNATTRIBUTED_CREDIT for staff uploads). */
  byMember: Map<number, number>;
  /** Uncapped team totals: the goal counter and each cap counter. */
  raw: { alt: number; caps: number[] };
}

/**
 * Fold a tile's rows (ONE tile, ONE team; primary rows are ignored) into alt-goal progress. Each
 * member's goal count is capped by their own cap-counter totals, then members sum (Team) or the best
 * one counts (Solo).
 */
export function altProgress(rows: GoalRow[], goal: AltGoal, trackingMode: string | null | undefined): AltProgress {
  const caps = goal.capBy ?? [];
  const per = new Map<number, { alt: number; caps: number[] }>();
  const raw = { alt: 0, caps: caps.map(() => 0) };
  for (const r of rows) {
    if (!r.goal || r.amount <= 0) continue;
    const key = submissionCreditKey(r);
    const m = per.get(key) ?? { alt: 0, caps: caps.map(() => 0) };
    if (r.goal === ALT_GOAL_KEY) {
      m.alt += r.amount;
      raw.alt += r.amount;
    } else {
      const i = capIndex(r.goal);
      if (i == null || i >= caps.length) continue;
      m.caps[i] += r.amount;
      raw.caps[i] += r.amount;
    }
    per.set(key, m);
  }
  const byMember = new Map<number, number>();
  for (const [key, m] of per) {
    const capped = caps.length > 0 ? Math.min(m.alt, ...m.caps) : m.alt;
    if (capped > 0) byMember.set(key, capped);
  }
  const teamTotal = [...byMember.values()].reduce((a, b) => a + b, 0);
  if (!isIndividualMode(trackingMode)) return { current: teamTotal, finisherPlayerId: null, teamTotal, byMember, raw };
  let bestKey = UNATTRIBUTED_CREDIT;
  let best = 0;
  for (const [key, v] of byMember) {
    if (v > best) {
      best = v;
      bestKey = key;
    }
  }
  return { current: best, finisherPlayerId: bestKey === UNATTRIBUTED_CREDIT ? null : bestKey, teamTotal, byMember, raw };
}

/** One member's own capped alt count (Solo tiles show the caller theirs). */
export function memberAltProgress(rows: GoalRow[], goal: AltGoal, playerId: number | null): number {
  return altProgress(rows, goal, 'team').byMember.get(playerId ?? UNATTRIBUTED_CREDIT) ?? 0;
}

// ─── Proof on completion ────────────────────────────────────────────────────────────────────────

/**
 * Which rows may stand as the screenshot a count-only completion needs, by the goal that completed
 * the tile. Primary completion: a primary row only. Alternative completion: an alternative-goal row
 * only — never an unrelated item screenshot, and never a cap counter's (energy proves no searches).
 * lib/submissions applies the same rule in SQL (proofGoalFilter).
 */
export function countsAsCompletionProof(row: { goal?: string | null; imageUrl?: string | null }, via: 'primary' | 'alt'): boolean {
  if (!row.imageUrl) return false;
  return via === 'alt' ? row.goal === ALT_GOAL_KEY : row.goal == null;
}

// ─── Words ──────────────────────────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString('en-US');
const isCounter = (name: string) => COUNTER_TARGETS.some((c) => c.name.toLowerCase() === name.toLowerCase());
const sameNames = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x) => b.some((y) => y.toLowerCase() === x.toLowerCase()));

export function isGotrSearchGoal(goal: AltGoal | null | undefined): boolean {
  return !!goal && goal.targets.length === 1 && goal.targets[0].toLowerCase() === GOTR_SEARCHES.toLowerCase();
}

/** Capped by exactly the two GOTR energy counters ("paid for with energy earned during the event"). */
export function isGotrEnergyCapped(goal: AltGoal | null | undefined): boolean {
  return !!goal && sameNames(goal.capBy ?? [], GOTR_ENERGY_CAPS);
}

/** English plural of a unit noun: search → searches, delve → delves, entry → entries. */
export function pluralUnit(unit: string, n = 2): string {
  if (n === 1) return unit;
  if (/(s|x|z|ch|sh)$/i.test(unit)) return `${unit}es`;
  if (/[^aeiou]y$/i.test(unit)) return `${unit.slice(0, -1)}ies`;
  return `${unit}s`;
}

function singularWord(w: string): string {
  if (/ies$/i.test(w)) return `${w.slice(0, -3)}y`;
  if (/(ches|shes|xes|sses)$/i.test(w)) return w.slice(0, -2);
  if (/[^s]s$/i.test(w)) return w.slice(0, -1);
  return w;
}

/**
 * What ONE credit of the goal is, singular — the `unit` the plugin pluralises ("or 37/100 searches",
 * chat lines): "search" for GOTR, "kill" for monsters, else the counter's own noun ("Hunter Rumours"
 * → "rumour", "Slayer tasks: Mortimer" → "task", "Doom of Mokhaiotl delves" → "delve").
 */
export function altGoalUnitSingular(goal: AltGoal): string {
  if (isGotrSearchGoal(goal)) return 'search';
  if (!goal.targets.every(isCounter)) return 'kill';
  const nouns = goal.targets.map(counterNoun);
  return nouns.every((n) => n === nouns[0]) ? nouns[0] : 'credit';
}

/** A counter's own noun, singular and lowercase: "GOTR elemental energy" → "energy". */
export function counterNoun(name: string): string {
  const head = name.split(':')[0].trim().split(/\s+/);
  return singularWord(head[head.length - 1] || name).toLowerCase();
}

/** What the goal's units are called, plural: "searches", "kills", "rumours". */
export function altGoalUnit(goal: AltGoal): string {
  return pluralUnit(altGoalUnitSingular(goal));
}

/**
 * The alternative as a phrase that follows "or": "100 reward searches paid for with energy earned
 * during the event", "25 Hunter Rumours", "50 Cow kills".
 */
export function altGoalPhrase(goal: AltGoal): string {
  const n = fmt(goal.amount);
  let base: string;
  if (isGotrSearchGoal(goal)) base = `${n} reward searches`;
  else if (goal.targets.every(isCounter)) base = `${n} ${goal.targets.join(' / ')}`;
  else base = `${n} ${goal.targets.join(' / ')} kills`;
  const caps = goal.capBy ?? [];
  if (caps.length === 0) return base;
  if (isGotrSearchGoal(goal) && isGotrEnergyCapped(goal)) return `${base} paid for with energy earned during the event`;
  return `${base} (no more than the ${caps.join(' and ')} earned during the event)`;
}

/** The short progress note next to a primary bar: "or 37/100 searches". */
export function altGoalProgressNote(goal: AltGoal, current: number): string {
  return `or ${fmt(Math.min(current, goal.amount))}/${fmt(goal.amount)} ${altGoalUnit(goal)}`;
}

/** What a tile title gains from its alternative: " or 100 searches", " or 50 Chicken kills". */
export function altTitleSuffix(goal: AltGoal | null | undefined): string {
  if (!goal) return '';
  const unit = altGoalUnitSingular(goal) === 'kill' ? `${goal.targets.join(' / ')} kills` : altGoalUnit(goal);
  return ` or ${fmt(goal.amount)} ${unit}`;
}

/** "Get" → "gets", "Do" → "does", "Catch" → "catches" — the creator's verbs, third person. */
function thirdPerson(verb: string): string {
  const v = verb.toLowerCase();
  if (/(o|s|x|z|ch|sh)$/.test(v)) return `${v}es`;
  if (/[^aeiou]y$/.test(v)) return `${v.slice(0, -1)}ies`;
  return `${v}s`;
}

/**
 * The creator's one-sentence summary of an either/or tile: "Done when the team gets any GOTR rare
 * reward — or does 100 reward searches paid for with energy earned during the event."
 */
export function eitherOrSentence(
  task: { verb: string; noun: string; amount: number | null },
  goal: AltGoal,
  solo = false,
): string {
  const who = solo ? 'one player' : 'the team';
  const what = task.amount != null ? `${fmt(task.amount)} ${task.noun}` : task.noun;
  return `Done when ${who} ${thirdPerson(task.verb)} ${what} — or does ${altGoalPhrase(goal)}.`;
}

/** The plugin's label for a virtual entry: "<tile> — or 100 searches" / "<tile> — GOTR elemental energy". */
export function altEntryLabel(parentLabel: string, goal: AltGoal, slot: number): string {
  if (slot === 0) return `${parentLabel} — or ${fmt(goal.amount)} ${altGoalUnit(goal)}`;
  const cap = goal.capBy?.[slot - 1] ?? 'cap';
  return `${parentLabel} — ${cap}`;
}
