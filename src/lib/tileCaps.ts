import { COUNTER_TARGETS } from '@/lib/constants';
import { isIndividualMode } from '@/lib/statTracking';

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Per-member CAPS on a kill/counter tile (tiles.cap_by).
//
//   "100 reward searches using energy earned during the event"
//
// is a kill tile over the 'Guardians of the Rift searches' counter whose count is CAPPED, per member,
// by two other counters: a search costs one elemental + one catalytic energy point, so the searches
// that count are min(searches, elemental attuned, catalytic attuned) for each member. Members are
// capped one by one and THEN summed (Team) or the best one taken (Solo) — one member's spare energy
// never pays for another's searches.
//
// Cap counters are tracked by the plugin like any kill tile. The config route sends, for a capped
// tile the team hasn't finished, extra trackedKills entries on VIRTUAL negative tile ids
// (capVirtualTileId: -(tileId * 8 + slot), slot 1..n = capBy[slot-1]); a plugin credits them like any
// kill tile and submits to the negative id; the submissions route decodes it back to the tile and
// stores the row with `submissions.goal` = 'cap:N'.
//
// THE RULE THAT MATTERS: a cap row never counts toward the tile's own requirement (energy is not
// searches) and never stands as its completion proof. lib/countProgress drops them unless it's told
// the tile's caps; every SQL total filters `goal IS NULL` (lib/capSql primaryCredit).
//
// Pure — the server, the board and the tests share it.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Virtual ids: -(tileId * STRIDE + slot). Slot 1..n = capBy[n-1]; slot 0 is never used. */
export const CAP_SLOT_STRIDE = 8;
/** Cap counters a tile may carry (slots 1..MAX_CAPS). */
export const MAX_CAPS = 4;
/** What a cap counter's virtual entry asks for — "never finishes", it only keeps counting. */
export const CAP_REQUIRED = 1_000_000;

export const GOTR_SEARCHES = 'Guardians of the Rift searches';
export const GOTR_ENERGY_CAPS = ['GOTR elemental energy', 'GOTR catalytic energy'] as const;

/** Kinds a cap can ride: a counted kill tile (NPC kills / in-game counters). */
export function capEligible(tile: { tileType?: string | null; trackedStat?: string | null }): boolean {
  return tile.tileType === 'kill' && !tile.trackedStat;
}

const MAX_NAME = 80;

/**
 * Validate a cap list from an API body (array, JSON text, or null/''/[] to clear). The single gate
 * every write path goes through, so a stored cap_by is always well-formed.
 */
export function validateCapBy(input: unknown): { ok: true; value: string[] | null } | { ok: false; error: string } {
  if (input == null || input === '') return { ok: true, value: null };
  let raw: unknown = input;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return { ok: false, error: 'capBy must be a JSON list of counter names' };
    }
  }
  if (!Array.isArray(raw)) return { ok: false, error: 'capBy must be a list of counter names' };
  const out: string[] = [];
  for (const n of raw) {
    if (typeof n !== 'string') return { ok: false, error: 'capBy must be a list of counter names' };
    const t = n.trim().replace(/\s+/g, ' ');
    if (!t || t.length > MAX_NAME) return { ok: false, error: 'capBy names must be 1–80 characters' };
    if (!out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  if (out.length > MAX_CAPS) return { ok: false, error: `capBy may list at most ${MAX_CAPS} counters` };
  return { ok: true, value: out.length > 0 ? out : null };
}

/** A stored cap_by (JSON text) or an editor array → the cap counters ([] when absent/malformed). */
export function parseCapBy(raw: unknown): string[] {
  const res = validateCapBy(raw);
  return res.ok ? (res.value ?? []) : [];
}

export function serializeCapBy(caps: string[] | null | undefined): string | null {
  return caps && caps.length > 0 ? JSON.stringify(caps) : null;
}

// ─── Virtual tile ids ───────────────────────────────────────────────────────────────────────────

export function capVirtualTileId(tileId: number, slot: number): number {
  return -(tileId * CAP_SLOT_STRIDE + slot);
}

/** A negative tileId back to its tile and cap slot (1..7); null for anything that isn't one. */
export function decodeCapTileId(id: number): { tileId: number; slot: number } | null {
  if (!Number.isInteger(id) || id >= 0) return null;
  const n = -id;
  const tileId = Math.floor(n / CAP_SLOT_STRIDE);
  const slot = n % CAP_SLOT_STRIDE;
  if (tileId < 1 || slot < 1) return null;
  return { tileId, slot };
}

/** The submissions.goal value a slot stores ('cap:N'), or null when the tile has no such cap. */
export function capGoalForSlot(capBy: readonly string[], slot: number): string | null {
  return slot >= 1 && slot <= capBy.length ? `cap:${slot - 1}` : null;
}

/** Index into capBy for a 'cap:N' row; null for anything else. */
export function capIndex(goalValue: string | null | undefined): number | null {
  if (!goalValue || !goalValue.startsWith('cap:')) return null;
  const n = Number(goalValue.slice(4));
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/**
 * Which rows may stand as the screenshot a count-only completion needs: the tile's OWN rows only — a
 * cap counter's screenshot (energy) proves no searches. lib/submissions applies the same rule in SQL.
 */
export function countsAsCompletionProof(row: { goal?: string | null; imageUrl?: string | null }): boolean {
  return !!row.imageUrl && row.goal == null;
}

// ─── Progress ───────────────────────────────────────────────────────────────────────────────────

export interface CapRow {
  playerId?: number | null;
  creditPlayerId?: number | null;
  amount: number;
  goal?: string | null;
}

/** Same key as lib/countProgress submissionCreditKey (kept local to avoid an import cycle). */
const creditKey = (r: CapRow) => r.creditPlayerId ?? r.playerId ?? 0;

export interface CappedProgress {
  /** Progress under the tile's mode — the capped team sum, or the best member. */
  current: number;
  /** Solo: who `current` belongs to (null in team mode or when it is the unattributed bucket). */
  finisherPlayerId: number | null;
  /** The capped sum over every member, regardless of mode. */
  teamTotal: number;
  /** Each member's capped count (key 0 = unattributed staff uploads). */
  byMember: Map<number, number>;
  /** Uncapped team totals: the tile's own counter and each cap counter. */
  raw: { own: number; caps: number[] };
}

/**
 * Fold a capped tile's rows (ONE tile, ONE team) into its progress. `own` = the rows of the tile's own
 * counter (goal null), already weighed (distinct pools etc.); cap rows carry goal 'cap:N'. Each member's
 * own count is capped by their own cap-counter totals, then members sum (Team) or the best counts (Solo).
 */
export function cappedProgress(rows: CapRow[], capBy: readonly string[], trackingMode: string | null | undefined): CappedProgress {
  const per = new Map<number, { own: number; caps: number[] }>();
  const raw = { own: 0, caps: capBy.map(() => 0) };
  const entry = (key: number) => {
    let m = per.get(key);
    if (!m) {
      m = { own: 0, caps: capBy.map(() => 0) };
      per.set(key, m);
    }
    return m;
  };
  for (const r of rows) {
    if (r.amount <= 0) continue;
    if (r.goal == null) {
      entry(creditKey(r)).own += r.amount;
      raw.own += r.amount;
      continue;
    }
    const i = capIndex(r.goal);
    if (i == null || i >= capBy.length) continue;
    entry(creditKey(r)).caps[i] += r.amount;
    raw.caps[i] += r.amount;
  }
  const byMember = new Map<number, number>();
  for (const [key, m] of per) {
    const capped = capBy.length > 0 ? Math.min(m.own, ...m.caps) : m.own;
    if (capped > 0) byMember.set(key, capped);
  }
  const teamTotal = [...byMember.values()].reduce((a, b) => a + b, 0);
  if (!isIndividualMode(trackingMode)) return { current: teamTotal, finisherPlayerId: null, teamTotal, byMember, raw };
  let bestKey = 0;
  let best = 0;
  for (const [key, v] of byMember) {
    if (v > best) {
      best = v;
      bestKey = key;
    }
  }
  return { current: best, finisherPlayerId: bestKey === 0 ? null : bestKey, teamTotal, byMember, raw };
}

// ─── Words ──────────────────────────────────────────────────────────────────────────────────────

const sameNames = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x) => b.some((y) => y.toLowerCase() === x.toLowerCase()));

/** Capped by exactly the two GOTR energy counters ("paid for with energy earned during the event"). */
export function isGotrEnergyCapped(capBy: readonly string[] | null | undefined): boolean {
  return !!capBy && sameNames(capBy, GOTR_ENERGY_CAPS);
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

/** A counter's own noun, singular and lowercase: "GOTR elemental energy" → "energy". */
export function counterNoun(name: string): string {
  const head = name.split(':')[0].trim().split(/\s+/);
  return singularWord(head[head.length - 1] || name).toLowerCase();
}

export const isCounterTarget = (name: string) => COUNTER_TARGETS.some((c) => c.name.toLowerCase() === name.toLowerCase());

/**
 * What a capped tile's cap adds to its sentence: " paid for with energy earned during the event", or
 * " (no more than the A and B earned during the event)". Empty when uncapped.
 */
export function capPhrase(capBy: readonly string[] | null | undefined): string {
  if (!capBy || capBy.length === 0) return '';
  if (isGotrEnergyCapped(capBy)) return ' paid for with energy earned during the event';
  return ` (no more than the ${capBy.join(' and ')} earned during the event)`;
}

/** The plugin's label for a cap counter's virtual entry: "<tile> — GOTR elemental energy". */
export function capEntryLabel(tileLabel: string, cap: string): string {
  return `${tileLabel} — ${cap}`;
}
