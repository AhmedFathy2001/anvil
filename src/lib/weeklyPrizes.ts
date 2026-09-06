import { MissionPlace } from '@/lib/eventRules';

// Coffer prizes for a Skill or Boss of the Week.
//
// The same ladder a mission already uses, asked of a different scoreboard. A mission's places are
// claimed in the order people finish; a weekly's are decided once, at the end, off the standings —
// so there is no per-claim decay, no first-bonus and no expiry here. Just: what does first get,
// what does second get, and what happens when the pot cannot pay.
//
// STORED AS JSON on weekly_competitions.prizes rather than as columns, for the reason the mission
// ladder is: the number of places is the thing that varies, and a clan that wants to pay its top
// five should not need a migration to do it.

/** A place on a weekly's prize ladder. `points` is meaningless here — a weekly has no tile value. */
export interface WeeklyPlace {
  /** Coffer prize in gp for this finishing position. 0 is not a place, it is an omission. */
  gp: number;
}

export interface WeeklyPrizes {
  /** Ranked, index 0 = first place. Empty means the competition pays nothing. */
  places: WeeklyPlace[];
  /**
   * Whether a member who gained NOTHING can still take a paying place.
   *
   * Off by default, and the default is the point: on a quiet week a board can have three entrants
   * and two of them on zero, and paying gp for turning up is not what anybody meant by "top three".
   */
  payZeroGain: boolean;
}

export const NO_WEEKLY_PRIZES: WeeklyPrizes = { places: [], payZeroGain: false };

const MAX_PLACES = 10;
/** Guards a typo'd ladder from reserving a number nobody meant. Clans can raise it by asking. */
const MAX_GP_PER_PLACE = 5_000_000_000;

function clampGp(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(MAX_GP_PER_PLACE, Math.floor(n));
}

/**
 * Tolerant parse of the stored JSON. Anything missing or malformed reads as "no prizes" rather than
 * throwing: a competition with a corrupt ladder should still run and still be scored, it just does
 * not pay out. Trailing 0-gp places are dropped, so a ladder of [1m, 0, 0] is a one-place ladder.
 */
export function parseWeeklyPrizes(raw: string | null | undefined): WeeklyPrizes {
  if (!raw) return NO_WEEKLY_PRIZES;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NO_WEEKLY_PRIZES;
  }
  if (!parsed || typeof parsed !== 'object') return NO_WEEKLY_PRIZES;
  const o = parsed as { places?: unknown; payZeroGain?: unknown };
  const list = Array.isArray(o.places) ? o.places : [];
  const places: WeeklyPlace[] = list
    .slice(0, MAX_PLACES)
    .map((p) => ({ gp: clampGp((p as { gp?: unknown })?.gp) }));
  while (places.length > 0 && places[places.length - 1].gp <= 0) places.pop();
  return { places, payZeroGain: o.payZeroGain === true };
}

export function serializeWeeklyPrizes(prizes: WeeklyPrizes): string | null {
  const cleaned = parseWeeklyPrizes(JSON.stringify(prizes));
  return cleaned.places.length > 0 ? JSON.stringify(cleaned) : null;
}

/** Total gp a ladder commits, which is what a host needs to see against the balance before saving. */
export function totalPrizeGp(prizes: WeeklyPrizes): number {
  return prizes.places.reduce((sum, p) => sum + Math.max(0, p.gp), 0);
}

export interface PrizeWinner {
  place: number;
  gp: number;
  clanMemberId: number | null;
  rsn: string;
}

/**
 * Who the ladder pays, given the final standings.
 *
 * The standings must arrive already ordered and already filtered to who is eligible — this decides
 * nothing about ranking, only about money. A place with nobody standing on it pays nobody rather
 * than sliding the next person up: if only two people entered a three-place ladder, third is not
 * won, and quietly promoting somebody into it would be inventing a result.
 *
 * A tie is not resolved here either. Whatever order the standings arrive in is the order paid, and
 * that is the same order the leaderboard showed all week — a payout that disagreed with the board
 * everyone was reading would be the worse surprise.
 */
export function winnersFor(
  prizes: WeeklyPrizes,
  standings: { clanMemberId: number | null; rsn: string; gained: number }[],
): PrizeWinner[] {
  const out: PrizeWinner[] = [];
  for (let i = 0; i < prizes.places.length; i++) {
    const place = prizes.places[i];
    const who = standings[i];
    if (!who || place.gp <= 0) continue;
    if (!prizes.payZeroGain && who.gained <= 0) continue;
    out.push({ place: i + 1, gp: place.gp, clanMemberId: who.clanMemberId, rsn: who.rsn });
  }
  return out;
}

/** Re-exported so a caller wiring both ladders sees they are the same idea. */
export type { MissionPlace };
