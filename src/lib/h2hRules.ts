// Head-to-head challenges: the pure half (no database), so tests and client components can import it.
//
// One player challenges another, one on one: first to an item drop, or most kills of a boss or most
// XP in a skill inside a set time. Anvil tracks both sides off the same signals a bingo tile uses and
// calls the winner. BRAGGING RIGHTS ONLY: there is no stake, no wager, no prize, nothing paid and
// nothing random — a win/loss record and a "Won vs X" line are the whole reward. Nothing here may
// ever grow a field that holds gp, items or money.
//
// The database half is lib/h2h.

import { BOSSES, SKILLS } from './constants.ts';
import type { SupporterTierId } from './supporterTiers.ts';

export type H2hKind = 'drop' | 'kc' | 'xp';
export const H2H_KINDS: readonly H2hKind[] = ['drop', 'kc', 'xp'];

export type H2hStatus = 'pending' | 'active' | 'finished' | 'declined' | 'expired' | 'cancelled';
/** Statuses that hold a slot against the active-challenge cap. */
export const OPEN_STATUSES: readonly H2hStatus[] = ['pending', 'active'];

/** How long a challenge runs once accepted, in minutes: 1 hour, 24 hours, 7 days. */
export const H2H_DURATIONS = [60, 1440, 10080] as const;
export type H2hDuration = (typeof H2H_DURATIONS)[number];

export const DURATION_LABEL: Record<H2hDuration, string> = { 60: '1 hour', 1440: '24 hours', 10080: '7 days' };

/** An invitation nobody answers lapses after this. */
export const RESPOND_WINDOW_MS = 24 * 60 * 60 * 1000;

/** At most this many items in one "first to any of these" drop race. */
export const MAX_DROP_ITEMS = 5;

/** Durable creation cap per person per day, on top of the in-memory request limiter. */
export const MAX_CREATED_PER_DAY = 20;

/**
 * Open challenges (pending or active) a person may hold at once, by their Supporter tier: Free 1,
 * Supporter 5, Champion and Patron unlimited (null). Counted per PERSON, on either side.
 */
export function h2hCap(tier: SupporterTierId | null | undefined): number | null {
  if (tier === 'champion' || tier === 'patron') return null;
  if (tier === 'supporter') return 5;
  return 1;
}

/** "1 active" / "5 active" / "Unlimited", for the page. */
export function capLabel(cap: number | null): string {
  return cap == null ? 'Unlimited' : `${cap} active`;
}

export function underCap(open: number, cap: number | null): boolean {
  return cap == null || open < cap;
}

const BOSS_KEYS = new Map(BOSSES.map((b) => [b.key, b.label]));
const SKILL_KEYS = new Set<string>(SKILLS.filter((s) => s !== 'overall'));

/** The skills a challenge can race on, in the game's order (Overall last). */
export const H2H_SKILLS: string[] = [...SKILL_KEYS, 'overall'];
/** The bosses a kill race can be on: the hiscores ones, so both sides are counted the same way. */
export const H2H_BOSSES: { key: string; label: string }[] = BOSSES.map((b) => ({ key: b.key, label: b.label }));

export function skillLabel(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/** The display name of a kc/xp target, or null when the key isn't one we track. */
export function statTargetLabel(kind: 'kc' | 'xp', key: string): string | null {
  if (kind === 'kc') return BOSS_KEYS.get(key) ?? null;
  return SKILL_KEYS.has(key) || key === 'overall' ? (key === 'overall' ? 'Overall' : skillLabel(key)) : null;
}

/** What a create request asks for, already cleaned. */
export interface H2hTarget {
  kind: H2hKind;
  /** kc: a hiscores boss key; xp: a skill key; drop: null. */
  statKey: string | null;
  /** drop: the item ids that count (any one of them wins). */
  itemIds: number[];
  /** What the page and the plugin print: "Dragon pickaxe", "Zulrah", "Slayer". */
  label: string;
  durationMin: H2hDuration;
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, max) : '';
}

/**
 * Validate the target half of a create request. `itemName` looks a drop's ids up (the caller passes
 * the game's item names and whether each is a monster drop), so this stays free of datasets.
 */
export function parseTarget(
  body: Record<string, unknown>,
  items: { nameOf: (id: number) => string | null; isDrop: (id: number) => boolean },
): { ok: true; target: H2hTarget } | { ok: false; error: string } {
  const kind = str(body.kind, 8) as H2hKind;
  if (!H2H_KINDS.includes(kind)) return { ok: false, error: 'Pick what the challenge is: a drop, kills or XP.' };
  const duration = Number(body.durationMin);
  if (!(H2H_DURATIONS as readonly number[]).includes(duration)) return { ok: false, error: 'Pick 1 hour, 24 hours or 7 days.' };
  const durationMin = duration as H2hDuration;

  if (kind === 'drop') {
    const raw = Array.isArray(body.itemIds) ? body.itemIds : [];
    const ids = [...new Set(raw.map(Number).filter((n) => Number.isInteger(n) && n > 0 && n < 100_000_000))];
    if (ids.length === 0) return { ok: false, error: 'Pick the item to race for.' };
    if (ids.length > MAX_DROP_ITEMS) return { ok: false, error: `At most ${MAX_DROP_ITEMS} items in one race.` };
    const names: string[] = [];
    for (const id of ids) {
      const name = items.nameOf(id);
      if (!name) return { ok: false, error: 'That item isn’t one we know.' };
      if (!items.isDrop(id)) return { ok: false, error: `${name} isn’t a monster drop, so the plugin can’t see it land.` };
      names.push(name);
    }
    const label = names.length === 1 ? names[0] : `${names[0]} or ${names.length - 1} more`;
    return { ok: true, target: { kind, statKey: null, itemIds: ids, label, durationMin } };
  }

  const key = str(body.statKey, 48);
  const label = statTargetLabel(kind, key);
  if (!label) return { ok: false, error: kind === 'kc' ? 'Pick a boss from the list.' : 'Pick a skill from the list.' };
  return { ok: true, target: { kind, statKey: key, itemIds: [], label, durationMin } };
}

/** The sentence a challenge is: "First to a Dragon pickaxe", "Most Zulrah kills in 24 hours". */
export function describe(kind: H2hKind, label: string, durationMin: number): string {
  const span = DURATION_LABEL[durationMin as H2hDuration] ?? `${Math.round(durationMin / 60)} hours`;
  if (kind === 'drop') return `First to ${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label} within ${span}`;
  if (kind === 'kc') return `Most ${label} kills in ${span}`;
  return `Most ${label} XP in ${span}`;
}

/** Which side won, or a tie. */
export type H2hResult = 'challenger' | 'opponent' | 'tie';

/**
 * kc / xp: the bigger gain wins; equal gains (0–0 included) are a tie.
 */
export function decideByScore(challenger: number, opponent: number): H2hResult {
  const a = Math.max(0, Math.floor(challenger || 0));
  const b = Math.max(0, Math.floor(opponent || 0));
  return a > b ? 'challenger' : b > a ? 'opponent' : 'tie';
}

/**
 * drop: the earlier landing wins; the same instant is a tie; nobody landing it by the end is a tie
 * too (a draw: neither of you got it). Null while nothing has landed and time remains.
 */
export function decideByDrop(challengerAt: number | null, opponentAt: number | null, ended: boolean): H2hResult | null {
  if (challengerAt == null && opponentAt == null) return ended ? 'tie' : null;
  if (challengerAt != null && opponentAt != null) {
    return challengerAt < opponentAt ? 'challenger' : opponentAt < challengerAt ? 'opponent' : 'tie';
  }
  return challengerAt != null ? 'challenger' : 'opponent';
}

/**
 * Does a reported drop count? Only after the challenge started and no later than its end — the same
 * rule a board applies to activity before its whistle (lib/completionGate eventActivityIsValid).
 */
export function dropCounts(occurredMs: number, startedMs: number | null, endsMs: number | null): boolean {
  if (startedMs == null || !Number.isFinite(occurredMs)) return false;
  if (occurredMs < startedMs) return false;
  return endsMs == null || occurredMs <= endsMs;
}

/** A W-L-T record from finished results, from one person's side. */
export interface H2hRecord {
  wins: number;
  losses: number;
  ties: number;
}

export function recordFor(
  rows: { result: H2hResult | null; challengerPlayerId: number; opponentPlayerId: number }[],
  playerId: number,
): H2hRecord {
  const out: H2hRecord = { wins: 0, losses: 0, ties: 0 };
  for (const r of rows) {
    if (!r.result) continue;
    const side = r.challengerPlayerId === playerId ? 'challenger' : r.opponentPlayerId === playerId ? 'opponent' : null;
    if (!side) continue;
    if (r.result === 'tie') out.ties++;
    else if (r.result === side) out.wins++;
    else out.losses++;
  }
  return out;
}

/** "3W · 1L · 2T", leaving out a zero tie count. */
export function recordLabel(r: H2hRecord): string {
  return `${r.wins}W · ${r.losses}L${r.ties ? ` · ${r.ties}T` : ''}`;
}

/** The result line a finished challenge reads as, from nobody's side: "Zezima beat Lynx to a Dragon pickaxe". */
export function resultSentence(
  kind: H2hKind,
  label: string,
  result: H2hResult,
  names: { challenger: string; opponent: string },
  scores?: { challenger: number; opponent: number },
): string {
  if (result === 'tie') {
    if (kind === 'drop') return `${names.challenger} and ${names.opponent} drew: nobody got ${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label} in time`;
    return `${names.challenger} and ${names.opponent} tied on ${label}${scores ? ` (${fmt(scores.challenger)} each)` : ''}`;
  }
  const winner = result === 'challenger' ? names.challenger : names.opponent;
  const loser = result === 'challenger' ? names.opponent : names.challenger;
  if (kind === 'drop') return `${winner} beat ${loser} to ${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label}`;
  const w = scores ? (result === 'challenger' ? scores.challenger : scores.opponent) : null;
  const l = scores ? (result === 'challenger' ? scores.opponent : scores.challenger) : null;
  const unit = kind === 'kc' ? `${label} kills` : `${label} XP`;
  return `${winner} beat ${loser} on ${unit}${w != null && l != null ? ` (${fmt(w)} to ${fmt(l)})` : ''}`;
}

export function fmt(n: number): string {
  if (n >= 1_000_000) return `${Number((n / 1_000_000).toFixed(n < 10_000_000 ? 2 : 1))}m`;
  if (n >= 10_000) return `${Number((n / 1_000).toFixed(1))}k`;
  return Math.max(0, Math.floor(n)).toLocaleString('en-US');
}

/** Both sides agreed to show it publicly. Anything else stays between the two players. */
export function isPublic(c: { challengerPublic: boolean; opponentPublic: boolean }): boolean {
  return c.challengerPublic && c.opponentPublic;
}
