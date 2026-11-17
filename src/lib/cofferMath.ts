// Coffer arithmetic, with no database attached.
//
// Split from lib/coffer the same way adminEventsFormat split from adminEventsOverview: a page, a
// client component and a test all need to know what a balance MEANS, and none of them should have
// to import @/db to find out.
//
// Three numbers, and they are not interchangeable:
//   confirmed — approved donations + adjustments + refunds. What the clan HAS.
//   reserved  — gp already committed: prizes claimed but not yet sent, and pools handed to an event.
//   available — confirmed − reserved. The ONLY number a prize may be funded against, because the
//               alternative is promising the same 50m to two winners while a treasurer is asleep.
//
// A pending donation counts toward nothing. Somebody typing "I gave 100m" is a claim about the past
// that staff either recognise or don't, and until they do it must not be able to fund a mission.

/** Which (kind, status) pairs are settled money. Everything else is a claim or a cancelled row. */
export function countsTowardBalance(entry: { kind: string; status: string }): boolean {
  switch (entry.kind) {
    case 'donation':
      return entry.status === 'approved';
    case 'adjustment':
    case 'refund':
      // Not 'pending' either: an in-game coffer reading waiting for a second client (lib/cofferSync)
      // is a claim, not money. Staff adjustments and refunds always land 'approved'.
      return entry.status !== 'rejected' && entry.status !== 'cancelled' && entry.status !== 'pending';
    case 'withdrawal':
      // RuneLite saw coins move from the physical Clan Coffer into a member's bank. That changes
      // custody, not ownership: the clan still has the gp until a prize/payment or explicit negative
      // adjustment records that it was actually spent.
      return false;
    case 'award':
    // A prize pool handed to an event is the same movement as an award, one step earlier: the gp is
    // committed to a board that splits it its own way, rather than to a person who won a place.
    case 'pool':
      // Reserved gp is spoken for even before it is sent — that is the whole point of reserving it.
      return entry.status === 'reserved' || entry.status === 'paid';
    default:
      return false;
  }
}

export interface CofferBalance {
  /** Approved donations + adjustments + refunds, in gp. Physical bank transfers do not change it. */
  confirmed: number;
  /** Claimed-but-unpaid prizes, as a POSITIVE number of gp owed. */
  reserved: number;
  /** confirmed − reserved: what a new prize may be funded against. Never below zero. */
  available: number;
  /** Donations filed but not yet approved, as a positive gp total (staff queue signal). */
  pending: number;
}

/**
 * Balance arithmetic over already-grouped (kind, status, signed total) rows. Separated from the
 * query so a caller that has the rows for another reason — the coffer page draws the same numbers
 * it lists — doesn't run the query twice.
 */
export function foldBalance(groups: { kind: string; status: string; total: number }[]): CofferBalance {
  let confirmed = 0;
  let reserved = 0;
  let pending = 0;
  for (const g of groups) {
    if (g.kind === 'donation' && g.status === 'pending') pending += g.total;
    if (!countsTowardBalance(g)) continue;
    // Award and pool totals are stored negative; `reserved` reads better as gp owed, so flip the sign.
    if (g.kind === 'award' || g.kind === 'pool') reserved += -g.total;
    else confirmed += g.total;
  }
  const available = Math.max(0, confirmed - reserved);
  return { confirmed, reserved, available, pending };
}

/** What the clan has promised and what it has paid, over the WHOLE ledger. */
export interface CofferMoneyOut {
  /** Prizes and pools not yet sent, held or not. */
  stillOwed: number;
  /** Prizes and pools sent, plus gp taken out by hand. */
  paidOut: number;
  /** How many movements those two add up. Zero hides the line. */
  count: number;
}

/**
 * The "still owed / paid out" line on the coffer page, from grouped totals of the money-out rows:
 * awards, pools, and negative adjustments (`total` is the sum of their absolute amounts).
 *
 * The page used to add these up in the browser from the newest 200 ledger rows, so a clan with a
 * longer ledger was told it owed and had paid less than it really had.
 */
export function foldMoneyOut(groups: { kind: string; status: string; total: number; count: number }[]): CofferMoneyOut {
  const out: CofferMoneyOut = { stillOwed: 0, paidOut: 0, count: 0 };
  for (const g of groups) {
    if (g.kind !== 'award' && g.kind !== 'pool' && g.kind !== 'adjustment') continue;
    out.count += g.count;
    if (g.status === 'reserved' || g.status === 'planned' || g.status === 'unfunded') out.stillOwed += g.total;
    if (g.status === 'paid' || g.kind === 'adjustment') out.paidOut += g.total;
  }
  return out;
}

/** Nothing at all — used where a clan has no ledger yet, so every surface has numbers to render. */
export function emptyBalance(): CofferBalance {
  return { confirmed: 0, reserved: 0, available: 0, pending: 0 };
}
