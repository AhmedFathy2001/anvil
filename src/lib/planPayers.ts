// Who may pay for a clan's plan, and who did: the database half (rules in lib/planPayerRules).
//
//   - The owner lets an admin, treasurer or moderator pay (clan_staff.can_pay_plan). They see the buy
//     buttons on /admin/plan, and their checkout carries their own ref (users.supporter_ref, the same
//     per-person token the Supporter checkout uses) as `payer`, so the sale records who started the
//     membership (clans.plan_paid_by_user_id). Never the email.
//   - Taking it away, or the payer leaving or dropping below moderator, never touches the membership:
//     it runs on their Gumroad account until it ends. The payer gets a notice (and a DM where a bot can
//     reach them) that it keeps charging until they cancel; the owner's plan page says to choose who
//     pays next. The daily billing run catches a payer who left without the owner doing anything.

import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, clanStaff, clans, userNotices, users } from '@/db/schema';
import { clanGrant } from '@/lib/clanGrants';
import { isFreePlanId } from '@/lib/billingCatalog';
import { log } from '@/lib/logger';
import { PAYER_ROLES, mayPayForPlan, payerStoppedText } from '@/lib/planPayerRules';

const NOTICE_KIND = 'plan_payer_stopped';

/** Swappable so a test can see what would be DMed, without Discord. */
export const payerDeps = {
  dm: async (userId: number, msg: { title: string; description: string }, path: string): Promise<boolean> => {
    const { discordDm } = await import('@/lib/ownershipClaims');
    return discordDm(userId, msg, path);
  },
};

/** May this login buy or manage this clan's plan right now? */
export async function canPayForPlan(clanId: number, userId: number): Promise<boolean> {
  const grant = await clanGrant(clanId, userId);
  if (!grant) return false;
  if (grant.isOwner) return true;
  const row = await db.query.clanStaff.findFirst({
    where: and(eq(clanStaff.clanId, clanId), eq(clanStaff.userId, userId)),
    columns: { canPayPlan: true },
  });
  return mayPayForPlan({ role: grant.role, canPayPlan: row?.canPayPlan });
}

export interface PayerCandidate {
  userId: number;
  name: string;
  role: string;
  canPay: boolean;
}

/** The staff the owner can let pay (admins, treasurers, moderators), with who already may. */
export async function payerCandidates(clanId: number): Promise<PayerCandidate[]> {
  // clan-scope: this clan.
  const rows = await db
    .select({ userId: clanStaff.userId, role: clanStaff.role, canPay: clanStaff.canPayPlan, name: users.displayName, username: users.username })
    .from(clanStaff)
    .innerJoin(users, eq(users.id, clanStaff.userId))
    .where(and(eq(clanStaff.clanId, clanId), inArray(clanStaff.role, [...PAYER_ROLES])));
  return rows
    .map((r) => ({ userId: r.userId, name: r.name || r.username || 'someone', role: r.role, canPay: r.canPay }))
    .sort((a, b) => Number(b.canPay) - Number(a.canPay) || a.name.localeCompare(b.name));
}

/** A display name for one login. */
export async function userName(userId: number | null | undefined): Promise<string | null> {
  if (userId == null) return null;
  const u = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { displayName: true, username: true } });
  return u ? u.displayName || u.username || null : null;
}

/**
 * The payer a sale names (`url_params[payer]`, their users.supporter_ref), if they may pay for this
 * clan's plan. Anyone else (a stale link, a ref pasted onto someone else's checkout) records nobody.
 */
export async function payerForSale(clanId: number, payerRef: string | null | undefined): Promise<number | null> {
  if (!payerRef) return null;
  const u = await db.query.users.findFirst({ where: eq(users.supporterRef, payerRef), columns: { id: true } });
  if (!u) return null;
  return (await canPayForPlan(clanId, u.id)) ? u.id : null;
}

async function audit(clanId: number, eventType: string, actorUserId: number | null, detail: Record<string, unknown>) {
  await db.insert(clanAuditLog).values({ clanId, eventType, actorUserId, newValue: JSON.stringify(detail), notes: 'plan payer' }).catch(() => {});
}

function fmtDay(stamp: string | null | undefined): string | null {
  if (!stamp) return null;
  const ms = Date.parse(stamp.includes('T') ? stamp : `${stamp.replace(' ', 'T')}Z`);
  return Number.isFinite(ms) ? new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : null;
}

/**
 * Tell the clan's payer, once per membership, that they no longer pay for its plan while their
 * membership still runs. Deduped on (kind, clan, subscription) through the notice's ref and title,
 * so the owner's removal and the daily check never tell them twice.
 */
async function tellPayerStopped(clan: typeof clans.$inferSelect, payerUserId: number): Promise<boolean> {
  const already = await db
    .select({ id: userNotices.id, body: userNotices.body })
    .from(userNotices)
    .where(and(eq(userNotices.userId, payerUserId), eq(userNotices.kind, NOTICE_KIND), eq(userNotices.refId, clan.id)))
    .orderBy(desc(userNotices.id))
    .limit(5);
  const tag = `[${clan.gumroadSubscriptionId ?? 'none'}]`;
  if (already.some((n) => n.body.endsWith(tag))) return false;
  const text = payerStoppedText({
    clanName: clan.name,
    payerName: (await userName(payerUserId)) ?? 'They',
    renews: fmtDay(clan.currentPeriodEnd),
    cancelled: clan.cancelAtPeriodEnd,
  });
  await db
    .insert(userNotices)
    .values({ userId: payerUserId, kind: NOTICE_KIND, refId: clan.id, title: text.payer.title, body: `${text.payer.body} ${tag}`, createdAt: new Date().toISOString() })
    .catch(() => {});
  payerDeps.dm(payerUserId, { title: text.payer.title, description: text.payer.body }, '/settings').catch(() => false);
  return true;
}

/** Is the clan's recorded payer paying for a membership that is still running? */
function liveMembership(clan: Pick<typeof clans.$inferSelect, 'plan' | 'gumroadSubscriptionId'> & { fundFunded?: boolean }): boolean {
  // A plan the clan fund pays for (lib/clanFund) is nobody's membership.
  return !!clan.gumroadSubscriptionId && !isFreePlanId(clan.plan) && !clan.fundFunded;
}

/**
 * The owner lets one of the clan's admins, treasurers or moderators pay, or stops them. Taking it from
 * the person paying now tells them their membership keeps running. The caller checked the owner.
 */
export async function setPlanPayer(clanId: number, actorUserId: number, targetUserId: number, on: boolean): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const row = await db.query.clanStaff.findFirst({ where: and(eq(clanStaff.clanId, clanId), eq(clanStaff.userId, targetUserId)) });
  if (!row || !(PAYER_ROLES as readonly string[]).includes(row.role)) {
    return { ok: false, error: 'Only an admin, treasurer or moderator can be let pay.', status: 400 };
  }
  if (row.canPayPlan === on) return { ok: true };
  await db.update(clanStaff).set({ canPayPlan: on }).where(eq(clanStaff.id, row.id));
  await audit(clanId, on ? 'plan_payer_granted' : 'plan_payer_removed', actorUserId, { userId: targetUserId });
  if (!on) {
    const clan = await db.query.clans.findFirst({ where: eq(clans.id, clanId) });
    if (clan && clan.planPaidByUserId === targetUserId && liveMembership(clan)) await tellPayerStopped(clan, targetUserId);
  }
  return { ok: true };
}

export interface PlanPayerView {
  /** Who started the membership paying for the plan, if known. */
  payer: { userId: number; name: string } | null;
  /** That person can no longer pay (removed, left, role dropped) while the membership still runs. */
  payerStopped: boolean;
}

/** What the plan page says about who pays. */
export async function planPayerView(clan: Pick<typeof clans.$inferSelect, 'id' | 'plan' | 'gumroadSubscriptionId' | 'planPaidByUserId'> & { fundFunded?: boolean }): Promise<PlanPayerView> {
  if (!clan.planPaidByUserId || !liveMembership(clan)) return { payer: null, payerStopped: false };
  const name = (await userName(clan.planPaidByUserId)) ?? 'someone';
  return { payer: { userId: clan.planPaidByUserId, name }, payerStopped: !(await canPayForPlan(clan.id, clan.planPaidByUserId)) };
}

/**
 * Daily (api/cron/billing): a payer who left the clan or lost the role without the owner removing
 * them is told the same way. Clans with a running membership and a recorded payer only.
 */
export async function sweepPlanPayers(): Promise<{ told: number }> {
  // clan-scope: global -- billing is the platform's; only clans that record a payer.
  const rows = await db.select().from(clans).where(and(isNotNull(clans.planPaidByUserId), isNotNull(clans.gumroadSubscriptionId)));
  let told = 0;
  for (const clan of rows) {
    if (!liveMembership(clan) || clan.planPaidByUserId == null) continue;
    if (await canPayForPlan(clan.id, clan.planPaidByUserId)) continue;
    if (await tellPayerStopped(clan, clan.planPaidByUserId)) {
      told += 1;
      log.info('plan-payer.stopped', { clanId: clan.id });
    }
  }
  return { told };
}
