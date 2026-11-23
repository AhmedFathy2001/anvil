// Who may pay for a clan's plan: the pure half (lib/planPayers does the reads and writes;
// tests/plan-payer-rules.test.ts).
//
// The owner always may. They can let an admin, treasurer or moderator pay too (clan_staff.can_pay_plan):
// some clans have one person with the card, and it isn't always the owner. Whoever pays, the Gumroad
// membership is THEIRS: on their account, their card, and only they can cancel it. So taking the
// permission away, or the payer leaving, never touches a running membership: it keeps the plan until
// it ends, and both sides are told.

/** Roles the owner can let pay. A plain member never: paying would make them the clan's billing contact. */
export const PAYER_ROLES = ['admin', 'treasurer', 'moderator'] as const;

export function isPayerRole(role: string | null | undefined): boolean {
  return (PAYER_ROLES as readonly string[]).includes(role ?? '');
}

/** May this person buy or manage the clan's plan? `role` and `canPayPlan` are their clan_staff row's. */
export function mayPayForPlan(grant: { role: string | null | undefined; canPayPlan?: boolean | null; isOwner?: boolean } | null): boolean {
  if (!grant) return false;
  if (grant.isOwner || grant.role === 'owner') return true;
  return !!grant.canPayPlan && isPayerRole(grant.role);
}

/**
 * The membership's payer can no longer pay (the owner took it away, they left, or their role dropped):
 * what each side is told. `renews` is the membership's next charge date as text, or null if unknown.
 */
export function payerStoppedText(args: { clanName: string; payerName: string; renews: string | null; cancelled: boolean }): {
  payer: { title: string; body: string };
  owner: string;
} {
  const until = args.renews ? ` until ${args.renews}` : '';
  return {
    payer: {
      title: `You no longer pay for ${args.clanName}'s plan`,
      body: args.cancelled
        ? `Your membership is already cancelled, so it ends${until} and nothing more is charged.`
        : `Your membership is still active and will keep charging you${args.renews ? ` on ${args.renews}` : ''} unless you cancel it on Gumroad. Only you can cancel it.`,
    },
    owner: args.cancelled
      ? `${args.payerName} can no longer pay for the plan. Their membership is cancelled and keeps the plan${until}. Choose who pays next before then.`
      : `${args.payerName} can no longer pay for the plan. Their membership still pays for it${until}, and we've told them how to cancel. Choose who pays next before then.`,
  };
}

/** The owner's confirm before taking the permission from the person paying now. */
export function removePayerConfirm(args: { payerName: string; renews: string | null }): { title: string; body: string } {
  const until = args.renews ? ` until ${args.renews}` : '';
  return {
    title: `Stop ${args.payerName} paying for the plan?`,
    body: `Their membership runs on their account${until}, and only they can cancel it. We'll ask them to. If they don't, the clan keeps its plan until it ends. To keep it after that, you or someone you choose subscribes.`,
  };
}
