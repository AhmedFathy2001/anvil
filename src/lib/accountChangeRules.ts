// Who answers when a player asks to be tracked on a different character.
//
// PURE — no database import — so the rule can be tested without one, and so the request route, the
// decision route and the UI that decides whether to show a queue all read the same answer.
//
// THE RULE FOLLOWS THE MONEY, which is the host's own instinct for it: a clan that collects its
// members' fees is already administering those members, so it answers their requests too; a clan
// whose members paid into the host's pot has handed that administration over with the gp. There is
// no new authority here — a delegated team's staff can already repoint one of their own people
// directly (api/team/[teamId]/roster/account). What the queue adds is a way to ASK, and this decides
// who is asked.
//
// `events.cashPolicy` already says it, and `/team/[teamId]` already derives "do we collect":
//
//   host-holds              the host collects every fee          → the host answers
//   each-settles            each clan collects its own           → the team's own staff answer
//   clans-collect-host-pays clans collect, host pays winners     → the team's own staff answer
//
// AND A BOARD MAY OVERRIDE IT, because the policy is about money and this is about roster admin, and
// a host is entitled to say "not on this one" without restructuring the cash. The override lives in
// `events.rules` beside the other per-board policy, so it costs no column and no migration.

export type AccountChangeApproval = 'auto' | 'host' | 'team';

export const ACCOUNT_CHANGE_APPROVALS: AccountChangeApproval[] = ['auto', 'host', 'team'];

export function isAccountChangeApproval(v: unknown): v is AccountChangeApproval {
  return typeof v === 'string' && (ACCOUNT_CHANGE_APPROVALS as string[]).includes(v);
}

/** Does a clan fielding its own team collect that team's fees under this policy? */
export function teamCollectsOwnFees(cashPolicy: string | null | undefined): boolean {
  // Anything unrecognised reads as host-holds: an unknown policy must not silently widen who may
  // decide things, and host-holds is both the default and the narrower answer.
  return cashPolicy === 'each-settles' || cashPolicy === 'clans-collect-host-pays';
}

export type Approver = 'host' | 'team';

/**
 * Who decides this request.
 *
 * A team that is not delegated — a drafted side on somebody else's board — has no clan staff to
 * answer for it, whatever the cash policy says, so it is always the host. That is the same line the
 * repoint route already draws.
 */
export function approverFor(opts: {
  delegated: boolean;
  cashPolicy: string | null | undefined;
  override: AccountChangeApproval;
}): Approver {
  if (!opts.delegated) return 'host';
  if (opts.override === 'host') return 'host';
  if (opts.override === 'team') return 'team';
  return teamCollectsOwnFees(opts.cashPolicy) ? 'team' : 'host';
}
