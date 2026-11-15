// Pure core of lib/emissionRouting: does ONE clan announce one character's drop, death, pet or level?
// No database import, so the rule is testable on its own (tests/emission-rule.test.ts).

/** The value `users.block_guest_emissions` takes for an account nobody has touched: quiet in guest clans. */
export const GUEST_POSTS_BLOCKED_BY_DEFAULT = true;

export interface EmissionRuleInput {
  /** The character's seat in this clan; null/undefined = no seat (an alt pointed here by its owner). */
  seat: 'member' | 'guest' | null | undefined;
  /** The per-(character, clan) choice: true = always announce here, false = never, undefined = none made. */
  override: boolean | null | undefined;
  /** The clan's own "Only announce your own members" setting. */
  clanBlocksGuests: boolean;
  /** The player's `block_guest_emissions`: true unless they turned guest-clan posting on. */
  userBlocksGuests: boolean;
}

/**
 * 'member' / 'guest' = announce here as that; null = stay quiet.
 *
 *   own clan      announces unless the player set "never" for it. Nothing else applies.
 *   guest clan    quiet when the player set "never", or the clan refuses guests (absolute);
 *                 announces when the player set "always" for this clan;
 *                 otherwise only when the player turned guest-clan posting ON and holds a guest seat.
 */
export function emissionDecision(input: EmissionRuleInput): 'member' | 'guest' | null {
  const { seat, override } = input;
  if (seat === 'member') return override === false ? null : 'member';
  if (override === false) return null;
  if (input.clanBlocksGuests) return null;
  if (override === true) return 'guest';
  if (input.userBlocksGuests) return null;
  return seat === 'guest' ? 'guest' : null;
}
