// What a character's proof state lets its owner do. Pure, so the prompts, the routes and the tests
// all read one answer.
//
// The states, from the columns that already exist (accounts.verifiedAt / provisional /
// verificationMethod; no schema change):
//   named                   a name typed in, nothing claimed yet            -> nothing: no row exists
//   xp-running              an XP check is open                             -> nothing yet: no row exists
//   awaiting-manual         asked clan staff to vouch (verifiedAt empty)    -> may join; staff confirm
//   passed-awaiting-review  passed the XP check or first plugin play, a
//                           moderator still confirms (provisional)          -> may do everything
//   verified                plugin hash match, or a moderator confirmed     -> may do everything
//
// Joining a clan's event or applying to a clan only needs the person to have CLAIMED the character:
// the claim already stops anyone else taking it, and a provisional seat shows in the clan's Needs
// review queue for staff to confirm. What stays with staff is the confirmation itself.

export interface CharacterProof {
  verifiedAt?: string | null;
  provisional?: boolean | number | null;
  verificationMethod?: string | null;
}

export type CharacterState = 'awaiting-manual' | 'passed-awaiting-review' | 'verified';

export function characterState(a: CharacterProof): CharacterState | null {
  const provisional = a.provisional === true || a.provisional === 1;
  if (a.verifiedAt) return provisional ? 'passed-awaiting-review' : 'verified';
  if (provisional && a.verificationMethod === 'manual') return 'awaiting-manual';
  return null;
}

/** May this character be used to sign up for an event, enter one or apply to a clan? */
export function mayJoinWith(a: CharacterProof): boolean {
  return characterState(a) != null;
}
