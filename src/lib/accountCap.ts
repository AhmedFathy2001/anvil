// "Max accounts per person" (events.max_accounts_per_person): 1–10, or 0 for NO LIMIT. Every reader
// goes through accountCap so 0 never reads as "none allowed". Pure: client and server both use it.

/** Stored for "no limit". */
export const NO_ACCOUNT_LIMIT = 0;
/** The highest number a host can type; past it is "no limit". */
export const MAX_ACCOUNTS_CAP = 10;

/** The effective cap: a big finite number for "no limit" (it reaches the browser and messages). */
export function accountCap(stored: number | null | undefined): number {
  if (stored === NO_ACCOUNT_LIMIT) return 99;
  return stored ?? 1;
}

/** A value from a request: an integer 1..MAX_ACCOUNTS_CAP, or 0 for no limit. */
export function validAccountLimit(v: unknown): v is number {
  return Number.isInteger(v) && ((v as number) === NO_ACCOUNT_LIMIT || ((v as number) >= 1 && (v as number) <= MAX_ACCOUNTS_CAP));
}
