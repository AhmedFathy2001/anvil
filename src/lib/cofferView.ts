// The clan coffer as someone outside the clan may read it.
//
// The page is public on purpose — a pot that pays prizes is a promise people should be able to
// check — and the amounts stay public. WHO gave or won is the clan's own business: there is no
// per-member "list me by name" switch, so a name is shown to people inside the clan and everyone
// else reads "a member". (Whether to add such a switch is the owner's decision; it needs a column.)
//
// PURE — tests/coffer-view.test.ts.

export const UNNAMED_MEMBER = 'a member';

/** A name on a coffer line: itself for an insider, "a member" for anyone else, null when there was none. */
export function cofferName(name: string | null | undefined, insider: boolean): string | null {
  if (!name) return null;
  return insider ? name : UNNAMED_MEMBER;
}

/** The donor board: amounts in order for everyone, names for insiders only. */
export function donorBoard(donors: { rsn: string; total: number }[], insider: boolean): { rsn: string | null; total: number }[] {
  return donors.map((d) => ({ rsn: insider ? d.rsn : null, total: d.total }));
}
