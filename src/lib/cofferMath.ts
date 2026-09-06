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
      return entry.status !== 'rejected' && entry.status !== 'cancelled';
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
  /** Approved donations + adjustments + refunds, in gp. */
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

/** Nothing at all — used where a clan has no ledger yet, so every surface has numbers to render. */
export function emptyBalance(): CofferBalance {
  return { confirmed: 0, reserved: 0, available: 0, pending: 0 };
}
