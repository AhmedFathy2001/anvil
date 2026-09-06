import { MissionPlace } from '@/lib/eventRules';
import { splitEvenly } from '@/lib/splitGp';

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
  /**
   * What to do when people finish DEAD LEVEL.
   *
   * Off, the board's own order decides and one of them takes the bigger prize — which is fine for
   * XP, where an exact tie means nobody trained, and indefensible for a boss week, where three
   * people on 40 kc each is Tuesday. On, everyone tied pools the places they occupy and splits it
   * evenly, which is what a host does by hand anyway.
   */
  splitTies: boolean;
}

export const NO_WEEKLY_PRIZES: WeeklyPrizes = { places: [], payZeroGain: false, splitTies: false };

/** Ten is what the editor offers and what the parser keeps; a longer ladder is a typo. */
export const MAX_WEEKLY_PLACES = 10;
const MAX_PLACES = MAX_WEEKLY_PLACES;
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
  const o = parsed as { places?: unknown; payZeroGain?: unknown; splitTies?: unknown };
  const list = Array.isArray(o.places) ? o.places : [];
  const places: WeeklyPlace[] = list
    .slice(0, MAX_PLACES)
    .map((p) => ({ gp: clampGp((p as { gp?: unknown })?.gp) }));
  while (places.length > 0 && places[places.length - 1].gp <= 0) places.pop();
  return { places, payZeroGain: o.payZeroGain === true, splitTies: o.splitTies === true };
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
  /**
   * The LEDGER SLOT this payment occupies, 1-based and unique within the competition.
   *
   * Equal to the finishing position everywhere except inside a split, where three people tied for
   * first take slots 1, 2 and 3 while all three finished first. It is a slot rather than a rank
   * because the coffer keys a weekly award on (competition, place) — that unique index is what makes
   * the settle pass safe to run twice, and it can only hold if every payment has its own number.
   */
  place: number;
  /** Where they actually finished. What the board showed, and what a winner will say they got. */
  rank: number;
  /** How many finished level with them. 1 is an outright win; more means this gp is a share. */
  sharedWith: number;
  gp: number;
  clanMemberId: number | null;
  rsn: string;
}

type Standing = { clanMemberId: number | null; rsn: string; gained: number };

/** The gp a ladder attaches to one finishing position. Positions past the ladder are worth nothing. */
const gpAt = (prizes: WeeklyPrizes, position: number) => prizes.places[position - 1]?.gp ?? 0;

/**
 * Consecutive runs of standings on the SAME gain — the tie groups.
 *
 * Consecutive because the standings arrive sorted: two people level with each other are neighbours,
 * and anyone else on that number would have to be between them.
 */
function tieGroups(standings: Standing[]): Standing[][] {
  const groups: Standing[][] = [];
  for (const row of standings) {
    const last = groups[groups.length - 1];
    if (last && last[0].gained === row.gained) last.push(row);
    else groups.push([row]);
  }
  return groups;
}

/**
 * Who the ladder pays, given the final standings.
 *
 * The standings must arrive already ordered and already filtered to who is eligible — this decides
 * nothing about ranking, only about money. A place with nobody standing on it pays nobody rather
 * than sliding the next person up: if only two people entered a three-place ladder, third is not
 * won, and quietly promoting somebody into it would be inventing a result.
 *
 * TIES, which are the reason this is not a one-line loop. Off (`splitTies` false) the board's own
 * order is paid, unchanged, because it is the order everybody watched all week. On, each set of
 * people level with each other pools the places they occupy and takes an equal share: three tied for
 * first on a 100m / 50m / 25m ladder take 58,333,333 gp each, not 100m to whoever the sort put on
 * top. The pooled positions can run past the end of the ladder — six people tied for first on a
 * three-place ladder split those three places six ways — which is exactly the case a per-place
 * payout cannot express, and the reason a split pays by SLOT rather than by place.
 *
 * The remainder of an uneven division is handed out a gp at a time from the top, so the shares add
 * up to the pool exactly and the ledger balances against the ladder that was advertised.
 */
export function winnersFor(prizes: WeeklyPrizes, standings: Standing[]): PrizeWinner[] {
  const out: PrizeWinner[] = [];
  const paying = (who: Standing) => prizes.payZeroGain || who.gained > 0;

  if (!prizes.splitTies) {
    for (let i = 0; i < prizes.places.length; i++) {
      const gp = prizes.places[i].gp;
      const who = standings[i];
      if (!who || gp <= 0 || !paying(who)) continue;
      out.push({ place: i + 1, rank: i + 1, sharedWith: 1, gp, clanMemberId: who.clanMemberId, rsn: who.rsn });
    }
    return out;
  }

  let position = 1; // 1-based finishing position of the next group's first member
  let slot = 1; // 1-based ledger slot of the next payment
  for (const group of tieGroups(standings)) {
    const rank = position;
    position += group.length;

    // Everything this group's positions are collectively worth, then split evenly.
    let pool = 0;
    for (let i = 0; i < group.length; i++) pool += gpAt(prizes, rank + i);
    if (pool <= 0) continue;

    const shares = splitEvenly(pool, group.length);
    for (const [i, who] of group.entries()) {
      const gp = shares[i];
      // A zero-gain finisher still OCCUPIES the position (nobody is promoted past them), they are
      // simply not paid for it — so their share is dropped rather than redistributed.
      if (gp > 0 && paying(who)) {
        out.push({ place: slot, rank, sharedWith: group.length, gp, clanMemberId: who.clanMemberId, rsn: who.rsn });
      }
      slot++;
    }
  }
  return out;
}

/** Re-exported so a caller wiring both ladders sees they are the same idea. */
export type { MissionPlace };
