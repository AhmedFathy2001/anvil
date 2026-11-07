// What staff can do with an unmatched Gumroad purchase (lib/unmatchedPurchases): attach it to the
// space or person it belongs to, or dismiss it with a reason. Root only (platformAccess CAN_BILL),
// and every one is written to the operator log (/staff/audit).
//
// ATTACH IS THE WEBHOOK, REPLAYED. A plan purchase goes through lib/clanSale applyClanSale — the very
// function the webhook runs for a matched sale — and a Supporter one through lib/supporterBilling
// startSupporterMembership. So the space or person ends up holding the sale's subscription id, and
// every later renewal, cancel, end or refund finds them by it, exactly as if the checkout ref had
// matched in the first place.
//
// It never refunds and never writes to Gumroad. It only READS Gumroad (checkSaleWithGumroad), the
// same check the webhook makes before anything grants: a sale since refunded attaches nothing.

import { and, eq, ne, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, clans, supporterSubscriptions, unmatchedPurchases, users } from '@/db/schema';
import { checkSaleWithGumroad } from '@/lib/gumroad';
import { billingTierOf } from '@/lib/billingCatalog';
import { logBilling } from '@/lib/billingLapse';
import { applyClanSale } from '@/lib/clanSale';
import { afterSupporterChange } from '@/lib/anvilDiscord';
import { startSupporterMembership } from '@/lib/supporterBilling';
import { supporterTierForGumroad } from '@/lib/supporterTiers';
import { attachTargetProblem, cleanNote, eventFromRow, replaceProblem } from '@/lib/unmatchedPurchaseRules';

export type ActionResult =
  | { ok: true; plan?: string | null; note?: string | null }
  | { ok: false; status: number; error: string; needsConfirm?: boolean };

const fail = (status: number, error: string, extra: { needsConfirm?: boolean } = {}): ActionResult => ({ ok: false, status, error, ...extra });

/** What Gumroad has said since that means the purchase is no longer one to grant. */
const DEAD_STATES = new Set(['refunded', 'disputed', 'ended']);

type PurchaseRow = typeof unmatchedPurchases.$inferSelect;

async function openRow(id: number): Promise<{ row: PurchaseRow } | { error: ActionResult }> {
  const row = await db.query.unmatchedPurchases.findFirst({ where: eq(unmatchedPurchases.id, id) });
  if (!row) return { error: fail(404, 'No such purchase.') };
  if (row.status !== 'open') return { error: fail(409, `Already ${row.status}.`) };
  return { row };
}

/** Gumroad's word on the sale, before anything is granted from it (the webhook's own check). */
async function saleStillStands(saleId: string | null, productId: string | null): Promise<ActionResult | null> {
  const check = await checkSaleWithGumroad(saleId, productId);
  if (check === 'error') return fail(503, 'Could not reach Gumroad to confirm the sale. Try again in a minute.');
  if (check === 'rejected') return fail(409, 'Gumroad does not stand behind this sale (refunded, disputed or unknown). Dismiss it instead.');
  return null;
}

/** Take the row for this attach, so two staff (or two clicks) cannot both apply it. */
async function claim(id: number, actorUserId: number, set: { attachedClanId?: number; attachedUserId?: number }, note: string | null) {
  const [claimed] = await db
    .update(unmatchedPurchases)
    .set({ status: 'attached', resolvedAt: sql`now()`, resolvedByUserId: actorUserId, resolutionNote: note, ...set })
    .where(and(eq(unmatchedPurchases.id, id), eq(unmatchedPurchases.status, 'open')))
    .returning({ id: unmatchedPurchases.id });
  return !!claimed;
}

/** Put a claimed row back: the attach did not go through. */
async function unclaim(id: number) {
  await db
    .update(unmatchedPurchases)
    .set({ status: 'open', resolvedAt: null, resolvedByUserId: null, resolutionNote: null, attachedClanId: null, attachedUserId: null })
    .where(eq(unmatchedPurchases.id, id));
}

/**
 * Attach a clan or creator plan purchase to a space.
 *
 * Refused when: the row is not open; it is a Supporter purchase; the product's catalogue is not the
 * space's kind (creator product → creator space, clan product → clan); the space is not active;
 * Gumroad has since refunded / ended it; another space already holds its subscription; or the space
 * already has a paid plan or another membership and staff did not confirm replacing it.
 */
export async function attachToSpace(opts: {
  id: number;
  clanId: number;
  confirmReplace: boolean;
  note: unknown;
  actorUserId: number;
  actorRole: string;
}): Promise<ActionResult> {
  const got = await openRow(opts.id);
  if ('error' in got) return got.error;
  const row = got.row;
  if (DEAD_STATES.has(row.gumroadState)) return fail(409, `Gumroad has since reported this membership ${row.gumroadState}. Dismiss it instead.`);

  const target = await db.query.clans.findFirst({ where: eq(clans.id, opts.clanId) });
  if (!target) return fail(404, 'No such space.');
  const problem = attachTargetProblem(row.kind, target);
  if (problem) return fail(400, problem);

  if (row.gumroadSaleId && row.gumroadSaleId === target.gumroadSaleId) return fail(409, 'That space already has this sale applied.');
  if (row.gumroadSubscriptionId) {
    if (target.gumroadSubscriptionId === row.gumroadSubscriptionId) return fail(409, 'That space already holds this membership.');
    const holder = await db.query.clans.findFirst({
      where: and(eq(clans.gumroadSubscriptionId, row.gumroadSubscriptionId), ne(clans.id, target.id)),
      columns: { name: true, slug: true },
    });
    // Two spaces holding one subscription would make every later notification land on whichever the
    // webhook finds first.
    if (holder) return fail(409, `This membership is already held by ${holder.name} (${holder.slug}).`);
  }

  const replacing = replaceProblem(
    { planIsFree: billingTierOf(target.kind, target.plan).free, gumroadSubscriptionId: target.gumroadSubscriptionId },
    row.gumroadSubscriptionId,
    false,
  );
  if (replacing && !opts.confirmReplace) return fail(409, replacing, { needsConfirm: true });

  const ev = eventFromRow(row);
  const refused = await saleStillStands(ev.saleId, ev.productId);
  if (refused) return refused;

  const note = cleanNote(opts.note);
  if (!(await claim(row.id, opts.actorUserId, { attachedClanId: target.id }, note))) return fail(409, 'Someone else resolved this purchase just now.');

  const notes = `staff attach of unmatched purchase #${row.id}`;
  let result: Awaited<ReturnType<typeof applyClanSale>>;
  try {
    result = await applyClanSale(target, ev, notes);
  } catch (err) {
    await unclaim(row.id);
    throw err;
  }
  if (!result.plan && result.note === 'duplicate membership') {
    // The webhook's own rule: a second trial on a space already paying is recorded, not applied.
    await unclaim(row.id);
    return fail(409, 'Gumroad shows this as a free trial on a space that has had a membership and is still paying for another, so the webhook rule keeps the current one. Cancel the duplicate on Gumroad, then dismiss this.');
  }
  // Gumroad already told us the buyer cancelled (the row heard it while open): the webhook would have
  // set the cancel flag on that notification, so it is set now. The plan runs to the term's end.
  if (row.gumroadState === 'cancelled') {
    await db.update(clans).set({ cancelAtPeriodEnd: true }).where(eq(clans.id, target.id));
    await logBilling(target.id, 'billing_cancelled', { plan: result.plan ?? target.plan, effective: 'period end' }, notes);
  }

  await db.insert(clanAuditLog).values({
    clanId: target.id,
    eventType: 'platform_purchase_attached',
    actorUserId: opts.actorUserId,
    oldValue: JSON.stringify({ plan: target.plan, subscription: target.gumroadSubscriptionId }),
    newValue: JSON.stringify({
      unmatchedId: row.id,
      kind: row.kind,
      reason: row.reason,
      sale: row.gumroadSaleId,
      subscription: row.gumroadSubscriptionId,
      product: row.productName ?? row.productId,
      tier: row.tier,
      plan: result.plan ?? null,
      held: result.note ?? null,
      replaced: !!replacing,
      note,
    }),
    notes: `platform ${opts.actorRole}`,
  });
  return { ok: true, plan: result.plan ?? null, note: result.note ?? null };
}

/**
 * Attach a Supporter purchase to a person's login. Refused when: the row is not open or not a
 * Supporter one; Gumroad has since refunded / ended it; it names no subscription or no tier we sell
 * (the webhook grants nothing for either); or another membership row already holds the subscription.
 */
export async function attachToUser(opts: {
  id: number;
  userId: number;
  note: unknown;
  actorUserId: number;
  actorRole: string;
}): Promise<ActionResult> {
  const got = await openRow(opts.id);
  if ('error' in got) return got.error;
  const row = got.row;
  if (row.kind !== 'supporter') return fail(400, 'Only a Supporter purchase is attached to a person; this one goes on a space.');
  if (DEAD_STATES.has(row.gumroadState)) return fail(409, `Gumroad has since reported this membership ${row.gumroadState}. Dismiss it instead.`);
  if (!row.gumroadSubscriptionId) return fail(400, 'This sale has no subscription, so nothing could ever renew or end it. Dismiss it instead.');
  const tier = supporterTierForGumroad(row.tier);
  if (!tier) return fail(400, `"${row.tier ?? 'no tier'}" is not a Supporter tier.`);

  const user = await db.query.users.findFirst({ where: eq(users.id, opts.userId), columns: { id: true } });
  if (!user) return fail(404, 'No such login.');
  const held = await db.query.supporterSubscriptions.findFirst({
    where: eq(supporterSubscriptions.gumroadSubscriptionId, row.gumroadSubscriptionId),
    columns: { id: true, userId: true },
  });
  if (held) return fail(409, `This membership is already held by login #${held.userId}.`);

  const ev = eventFromRow(row);
  const refused = await saleStillStands(ev.saleId, ev.productId);
  if (refused) return refused;

  const note = cleanNote(opts.note);
  if (!(await claim(row.id, opts.actorUserId, { attachedUserId: user.id }, note))) return fail(409, 'Someone else resolved this purchase just now.');

  let membershipId: number | null;
  try {
    membershipId = await startSupporterMembership(user.id, ev, tier);
  } catch (err) {
    await unclaim(row.id);
    throw err;
  }
  if (membershipId && row.gumroadState === 'cancelled') {
    // Already cancelled on Gumroad: runs to the term's end, as the webhook's cancellation would have set.
    await db.update(supporterSubscriptions).set({ status: 'cancelling' }).where(eq(supporterSubscriptions.id, membershipId));
    afterSupporterChange(user.id);
  }

  await db.insert(clanAuditLog).values({
    clanId: null,
    eventType: 'platform_purchase_attached',
    actorUserId: opts.actorUserId,
    newValue: JSON.stringify({
      unmatchedId: row.id,
      kind: row.kind,
      reason: row.reason,
      sale: row.gumroadSaleId,
      subscription: row.gumroadSubscriptionId,
      product: row.productName ?? row.productId,
      tier,
      userId: user.id,
      membershipId,
      note,
    }),
    notes: `platform ${opts.actorRole}`,
  });
  return { ok: true, plan: tier };
}

/** Close a purchase without attaching it. The note is required: the log must say why. */
export async function dismissPurchase(opts: { id: number; note: unknown; actorUserId: number; actorRole: string }): Promise<ActionResult> {
  const note = cleanNote(opts.note);
  if (!note) return fail(400, 'Say why it is being dismissed.');
  const got = await openRow(opts.id);
  if ('error' in got) return got.error;
  const row = got.row;
  const [done] = await db
    .update(unmatchedPurchases)
    .set({ status: 'dismissed', resolvedAt: sql`now()`, resolvedByUserId: opts.actorUserId, resolutionNote: note })
    .where(and(eq(unmatchedPurchases.id, row.id), eq(unmatchedPurchases.status, 'open')))
    .returning({ id: unmatchedPurchases.id });
  if (!done) return fail(409, 'Someone else resolved this purchase just now.');
  await db.insert(clanAuditLog).values({
    // Belongs to no space: nothing was applied anywhere. The buyer's email is never logged.
    clanId: null,
    eventType: 'platform_purchase_dismissed',
    actorUserId: opts.actorUserId,
    newValue: JSON.stringify({
      unmatchedId: row.id,
      kind: row.kind,
      reason: row.reason,
      sale: row.gumroadSaleId,
      subscription: row.gumroadSubscriptionId,
      product: row.productName ?? row.productId,
      tier: row.tier,
      note,
    }),
    notes: `platform ${opts.actorRole}`,
  });
  return { ok: true };
}
