// Capping a team KC/XP tile's split at its goal, in the order the gains happened.
//
// A team tile completes on the first check that sees the team at or past its goal, so the frozen
// split can run over (517 / 500). The tile is worth its points either way — the split only decides
// each member's SHARE — but the kills past the goal shouldn't buy anyone a bigger share. They came
// from whoever's update crossed the line; everyone who was already counted before it got theirs first.
//
// We don't know WHEN each kill happened, only a window for each member's latest gain: a plugin push
// says "between my previous push and this one" (seconds), a hiscores fetch says "between my previous
// fetch and this one" (could be hours). So the ledger below keeps, per member, their gain and the
// window their latest increase happened in. At completion, everyone whose latest window overlaps the
// window of an update that crossed the line is TIED — nobody can say who was first — and the
// overshoot comes off the tied increments in proportion. Two people logging out with 50 KC each on an
// 80 tile end on 40/40, not on whichever the sweep happened to fetch first.
//
// Pure (no database) so it is testable on its own; lib/statTileCredit does the reads and writes.

/** One member's standing on one open tile, as the last completion check saw it. */
export interface LedgerEntry {
  /** Their gain on the tile at that check. */
  g: number;
  /** Their gain before their latest increase — `g - base` is that increase. */
  base: number;
  /** The window their latest increase happened in, epoch millis. */
  from: number;
  to: number;
  /** The newest time we have any reading of them for — the start of their next increase's window. */
  seen: number;
}

/** playerId → entry. Stored as JSON on stat_tile_progress. */
export type Ledger = Record<string, LedgerEntry>;

/** What a check sees for one member: their gain now, and how fresh the reading behind it is. */
export interface Observation {
  playerId: number;
  gained: number;
  /** Latest of: their last hiscores fetch, their last plugin push raising one of the tile's keys. */
  freshAt: number;
}

export function parseLedger(json: string | null | undefined): Ledger {
  if (!json) return {};
  try {
    const v = JSON.parse(json);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Ledger) : {};
  } catch {
    return {};
  }
}

/**
 * Fold this check's readings into the ledger. Returns the new ledger and who rose since the last
 * check — the updates that may have crossed the line. A member seen for the first time has no earlier
 * reading, so their whole gain is one increase over [eventStart, freshAt].
 */
export function advanceLedger(
  prev: Ledger,
  obs: Observation[],
  eventStartMs: number,
): { next: Ledger; risen: number[] } {
  const next: Ledger = { ...prev };
  const risen: number[] = [];
  for (const o of obs) {
    const fresh = Number.isFinite(o.freshAt) ? o.freshAt : eventStartMs;
    const e = prev[o.playerId];
    if (!e) {
      next[o.playerId] = { g: o.gained, base: 0, from: eventStartMs, to: Math.max(eventStartMs, fresh), seen: fresh };
      if (o.gained > 0) risen.push(o.playerId);
    } else if (o.gained > e.g) {
      next[o.playerId] = { g: o.gained, base: e.g, from: e.seen, to: Math.max(e.seen, fresh), seen: Math.max(e.seen, fresh) };
      risen.push(o.playerId);
    } else if (fresh > e.seen || o.gained < e.g) {
      // Same gain, newer reading: they were still here at `fresh`. (A drop — a benched player, a
      // corrected baseline — is taken as-is; it can only shrink what they're owed.)
      next[o.playerId] = { ...e, g: o.gained, base: Math.min(e.base, o.gained), seen: Math.max(e.seen, fresh) };
    }
  }
  return { next, risen };
}

/** Members whose latest increase can't be ordered against any of `crossers`' — overlapping windows. */
export function tiedWith(ledger: Ledger, crossers: number[]): Set<number> {
  const tied = new Set<number>(crossers);
  const windows = crossers.map((id) => ledger[id]).filter((e): e is LedgerEntry => !!e);
  for (const [id, e] of Object.entries(ledger)) {
    if (e.g - e.base <= 0) continue;
    // Overlap, or both pinned to the same instant (two readings landing in one check).
    if (windows.some((w) => (e.from < w.to && w.from < e.to) || (e.from === w.from && e.to === w.to))) {
      tied.add(Number(id));
    }
  }
  return tied;
}

export interface SettleRow {
  playerId: number;
  gained: number;
  /** Their latest increase, which is what a tie trims. */
  increase: number;
  tied: boolean;
}

/**
 * Bring a split down to exactly `goal`. The overshoot comes off the tied members' latest increases in
 * proportion; only if those don't cover it does the rest come off everyone's remaining gain, again in
 * proportion (a check was missed, so nothing finer is honest). Whole numbers, summing to the goal.
 */
export function settleOvershoot(goal: number, rows: SettleRow[]): { playerId: number; gained: number }[] {
  const total = rows.reduce((s, r) => s + Math.max(0, r.gained), 0);
  const out = rows.map((r) => ({ playerId: r.playerId, gained: Math.max(0, r.gained) }));
  let over = total - goal;
  if (goal <= 0 || over <= 0) return out;

  const trimFrom = (weights: number[]) => {
    const sum = weights.reduce((s, w) => s + w, 0);
    if (sum <= 0 || over <= 0) return;
    const take = Math.min(over, sum);
    const shares = apportion(take, weights);
    shares.forEach((t, i) => (out[i].gained -= t));
    over -= take;
  };
  trimFrom(rows.map((r, i) => (r.tied ? Math.min(Math.max(0, r.increase), out[i].gained) : 0)));
  trimFrom(out.map((o) => o.gained));
  return out;
}

/** Split `amount` across `weights` in proportion, in whole numbers that sum exactly (largest remainder). */
function apportion(amount: number, weights: number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  const exact = weights.map((w) => (amount * w) / sum);
  const floors = exact.map(Math.floor);
  let left = amount - floors.reduce((s, f) => s + f, 0);
  const order = exact
    .map((x, i) => ({ i, frac: x - floors[i] }))
    .filter(({ i }) => weights[i] > 0)
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    if (floors[i] < weights[i]) {
      floors[i] += 1;
      left -= 1;
    }
  }
  return floors;
}
