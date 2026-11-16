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

/**
 * May this character be used to sign up for an event, enter one or apply to a clan?
 *
 * WHAT IS ADMITTED, WHAT IS HELD, WHO CAN UNDO IT (the answer to "an unverified character can now
 * join"). The owner's policy is three tiers, from `tierOf`:
 *   plugin  the plugin reported it while signed in (or staff confirmed it): trusted. Joins events and
 *           is granted a clan GUEST seat at once.
 *   xp      the XP check passed: semi-trusted (it can be passed by accident or spoofed). Exactly the
 *           same for the person, but the seat stays flagged in the clan's Needs review list as
 *           "added automatically, check when you can": flagged, never blocking.
 *   manual  the person asked the clan's staff to vouch and nothing else proves it. Admitted to sign
 *           up and to a guest seat, but everything that cannot be undone is held: the entry is
 *           PENDING (no team, no board place, so no progress, prize or payout), `verifiedAt` is empty
 *           so no Discord roles are given (lib/discord-roles reads it), and a seat here is never a
 *           member seat (membership only ever comes from the in-game list). One open request per
 *           person, only where a clan exists to review it, bans refused.
 * Staff see the path on the Needs review row and on the sign-up row, can vouch in one click
 * (Needs review > approve) and can remove anyone (Needs review > not a member, which also withdraws
 * the entry). A seat staff removed is never re-granted automatically. Impersonation by screenshot or
 * AI review is deliberately not built here (a later problem); what IS enforced, invisibly, is that a
 * character somebody else has proved cannot be claimed (lib/accountClaim).
 */
export function mayJoinWith(a: CharacterProof): boolean {
  return characterState(a) != null;
}

export type JoinTier = 'plugin' | 'xp' | 'manual';

/** Which of the three paths this character came in by, or null when it has not come in at all. */
export function tierOf(a: CharacterProof): JoinTier | null {
  const s = characterState(a);
  if (s === 'awaiting-manual') return 'manual';
  if (s === 'passed-awaiting-review') return a.verificationMethod === 'stat_delta' ? 'xp' : 'plugin';
  if (s === 'verified') return 'plugin';
  return null;
}

/**
 * How a clan door treats this person: `open` grants the guest seat at once (the existing rule for an
 * approved request: a guest seat, never a member one), `approval` files a request for staff. A clan
 * that is closed stays closed and a ban always wins, both decided inside `admit`. Somebody staff
 * removed is never put back automatically; the event's own approval setting is kept by the caller.
 */
export function doorPolicy(opts: { removedByStaff: boolean; eventNeedsApproval?: boolean }): 'open' | 'approval' {
  return opts.removedByStaff || opts.eventNeedsApproval ? 'approval' : 'open';
}

/**
 * May a PROVEN claim take a character from somebody whose claim nobody has confirmed? Yes: an
 * unconfirmed manual claim (staff have not vouched, nothing was proved) never beats a plugin report,
 * a passed XP check or a staff yes. The reverse never happens: an unconfirmed claim cannot take a
 * character anybody else holds, proven or not.
 */
export function mayDisplace(
  holder: CharacterProof & { claimedAt?: string | null },
  incoming: { verified: boolean; method: string },
): boolean {
  return !holder.verifiedAt && characterState(holder) === 'awaiting-manual' && incoming.verified && incoming.method !== 'manual';
}

/** What staff are shown beside a name: the three paths, plus `vouched` once staff have confirmed a manual one. */
export type JoinPath = JoinTier | 'vouched';

export function pathOf(a: CharacterProof): JoinPath | null {
  const tier = tierOf(a);
  if (tier === 'plugin' && a.verificationMethod === 'manual') return 'vouched';
  return tier;
}

/**
 * The chip's words and tooltip, one place for the sign-up rows, the roster and an event's team list.
 * Never a Discord identity: it describes the character's proof, nothing about the login behind it.
 */
export function pathChip(path: JoinPath | null | undefined): { label: string; title: string; tone: 'ok' | 'check' | 'wait' } | null {
  switch (path) {
    case 'plugin':
      return { label: 'plugin', title: 'The Anvil plugin reported this character while its owner was signed in.', tone: 'ok' };
    case 'vouched':
      return { label: 'vouched by staff', title: 'Your staff confirmed this character belongs to this person.', tone: 'ok' };
    case 'xp':
      return { label: 'verified by XP check', title: 'Passed the XP check. Added automatically; confirm it in Needs review when you can.', tone: 'check' };
    case 'manual':
      return { label: 'awaiting your staff: vouch', title: 'Asked your staff to vouch for this character. Nothing proves it yet: held until someone vouches in Needs review.', tone: 'wait' };
    default:
      return null;
  }
}
