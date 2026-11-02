// Which entry fee someone owes, and how to say the fees out loud. No `@/db`: the sign-up form, the
// event page and the tests all need these, and none of them should open a connection for it.
//
// A board has a member fee (events.signupFee) and, optionally, a guest fee (events.guestSignupFee).
// A guest is an entrant with no member seat in a clan running the board — see lib/entryFee. On top of
// that a staff member can price one entry by hand (signup_fees.custom_amount): an invite discount, a
// comp. The pot always sums the real fee rows, so mixed amounts add up without any of this knowing.

export interface EventFees {
  signupFee: number | null;
  /** Absent/null = guests pay signupFee. */
  guestSignupFee?: number | null;
}

/** The fee this entrant owes by default. Null/0 = nothing owed. */
export function standardFee(event: EventFees, isGuest: boolean): number | null {
  if (isGuest && event.guestSignupFee != null) return event.guestSignupFee;
  return event.signupFee;
}

/** True when guests pay something different from members. */
export function hasGuestFee(event: EventFees): boolean {
  return event.guestSignupFee != null && event.guestSignupFee !== (event.signupFee ?? 0);
}

/** True when anyone owes anything at all. */
export function chargesFee(event: EventFees): boolean {
  return (event.signupFee ?? 0) > 0 || (event.guestSignupFee ?? 0) > 0;
}

/**
 * The fees in one phrase: "5,000,000 gp", "Members 5,000,000 gp · guests 10,000,000 gp", or null when
 * the board is free for everyone.
 */
export function feeLabel(event: EventFees): string | null {
  if (!chargesFee(event)) return null;
  const member = event.signupFee ?? 0;
  if (!hasGuestFee(event)) return `${member.toLocaleString()} gp`;
  const fmt = (n: number) => (n > 0 ? `${n.toLocaleString()} gp` : 'free');
  return `Members ${fmt(member)} · guests ${fmt(event.guestSignupFee ?? 0)}`;
}

/**
 * "12 paid entries · 75,000,000 gp" when the fees differ, "12 paid entries × 5,000,000 gp" when every
 * paid entry paid the member fee — the multiplication only when it is true.
 */
export function paidEntriesLabel(count: number, gp: number, signupFee: number | null): string {
  const entries = `${count} paid ${count === 1 ? 'entry' : 'entries'}`;
  const fee = signupFee ?? 0;
  if (fee > 0 && gp === fee * count) return `${entries} × ${fee.toLocaleString()} gp`;
  return `${entries} · ${gp.toLocaleString()} gp`;
}
