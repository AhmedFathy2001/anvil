// The clan fund: the database half (rules in lib/clanFundRules).
//
// The owner starts a fund for ONE plan (clans.fund_plan). Members chip in through the clan fund
// Gumroad product, a yearly membership from $6 that renews until they cancel; each is a
// clan_fund_pledges row. The clan's payer covers the rest with the same product (`cover=1`). Once the
// counting chip-ins reach the plan's yearly price the clan gets the plan (clans.plan, fund_funded) and
// collection closes; if they fall short it keeps the plan for a 7-day grace, then goes to free.
//
// Gumroad notifications about the fund product come here from the webhook (api/webhooks/gumroad),
// the way Supporter ones go to lib/supporterBilling, with the same rules: a sale finds its clan by the
// `ref` on the checkout (and its person by `payer`), never by email; everything after finds the
// chip-in by its subscription id; anything that grants names a sale Gumroad stands behind, once.
//
// A fund and a plan membership never pay for the same clan: a fund can't start while a membership
// pays for the plan, and the fund never grants over one (lib/clanFundRules fundStep `blocked`).

import { and, eq, isNotNull } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, clanFundPledges, clanStaff, clans, userNotices, users } from '@/db/schema';
import { checkSaleWithGumroad, checkSubscriptionWithGumroad, nextChargeDue, type GumroadEvent } from '@/lib/gumroad';
import { isFreePlanId } from '@/lib/billingCatalog';
import { log } from '@/lib/logger';
import { PLANS } from '@/lib/plans';
import { canPayForPlan } from '@/lib/planPayers';
import {
  FUND_PLANS,
  WARN_DAYS,
  fundStep,
  fundTotals,
  isFundPlan,
  stampMs,
  totalIn,
  usd,
  type FundPlanId,
  type FundTotals,
} from '@/lib/clanFundRules';

type Clan = typeof clans.$inferSelect;
type Pledge = typeof clanFundPledges.$inferSelect;
type Result = { status: number; body: Record<string, unknown> };
const ok = (body: Record<string, unknown> = {}): Result => ({ status: 200, body: { received: true, ...body } });
const DAY = 86_400_000;
const NOTICE_KIND = 'clan_fund';

/** Swappable so a test can see what would be DMed, without Discord. */
export const fundDeps = {
  dm: async (userId: number, msg: { title: string; description: string }, path: string): Promise<boolean> => {
    const { discordDm } = await import('@/lib/ownershipClaims');
    return discordDm(userId, msg, path);
  },
};

/** Is the clan fund product set up on this deployment? Without it there are no fund buttons. */
export function fundConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return !!env.GUMROAD_URL_CLAN_FUND;
}

/** Is this notification about the clan fund product? */
export function isFundEvent(ev: Pick<GumroadEvent, 'productId' | 'productPermalink'>): boolean {
  const id = process.env.GUMROAD_PRODUCT_CLAN_FUND;
  if (id && ev.productId === id) return true;
  return !!ev.productPermalink && ev.productPermalink === (process.env.GUMROAD_PERMALINK_CLAN_FUND || 'clan-fund');
}

const nowIso = () => new Date().toISOString();

function chargedAt(stamp: string | null): number {
  const ms = stamp ? Date.parse(stamp) : NaN;
  return Number.isFinite(ms) ? Math.min(ms, Date.now()) : Date.now();
}

async function audit(clanId: number, eventType: string, detail: Record<string, unknown>, actorUserId: number | null = null) {
  await db.insert(clanAuditLog).values({ clanId, eventType, actorUserId, newValue: JSON.stringify(detail), notes: 'clan fund' }).catch(() => {});
}

export async function pledgesFor(clanId: number): Promise<Pledge[]> {
  // clan-scope: this clan.
  return db.select().from(clanFundPledges).where(eq(clanFundPledges.clanId, clanId));
}

/** Another membership pays for this clan's plan: the fund must not grant over it, nor start. */
export function membershipPaysPlan(clan: Pick<Clan, 'plan' | 'gumroadSubscriptionId' | 'fundFunded'>): boolean {
  return !!clan.gumroadSubscriptionId && !isFreePlanId(clan.plan) && !clan.fundFunded;
}

/**
 * Tell someone about the fund once: an in-site notice and a DM where a bot can reach them. `tag`
 * dedupes (the same tag for the same clan is never sent twice).
 */
async function tell(userId: number, clanId: number, tag: string, msg: { title: string; body: string }): Promise<boolean> {
  const mark = `[${tag}]`;
  const prior = await db
    .select({ body: userNotices.body })
    .from(userNotices)
    .where(and(eq(userNotices.userId, userId), eq(userNotices.kind, NOTICE_KIND), eq(userNotices.refId, clanId)));
  if (prior.some((p) => p.body.endsWith(mark))) return false;
  await db
    .insert(userNotices)
    .values({ userId, kind: NOTICE_KIND, refId: clanId, title: msg.title, body: `${msg.body} ${mark}`, createdAt: nowIso() })
    .catch(() => {});
  fundDeps.dm(userId, { title: msg.title, description: msg.body }, '/settings').catch(() => false);
  return true;
}

/** The owner, and whoever pays the rest (the payer's chip-in, else the plan's recorded payer). */
async function fundContacts(clan: Clan, pledges: Pledge[]): Promise<number[]> {
  const owners = await db.select({ userId: clanStaff.userId }).from(clanStaff).where(and(eq(clanStaff.clanId, clan.id), eq(clanStaff.role, 'owner')));
  const payer = pledges.find((p) => p.isPayer && p.userId != null && (p.status === 'active' || p.status === 'cancelling'))?.userId ?? clan.planPaidByUserId;
  return [...new Set([...owners.map((o) => o.userId), ...(payer != null ? [payer] : [])])];
}

function fmtDay(ms: number): string {
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Work the fund out again after any change, and apply it: give the clan its plan at the goal, start
 * the grace when a funded clan falls short, drop to free when the grace runs out.
 */
export async function recomputeFund(clanId: number, now = Date.now()): Promise<{ step: string; totals: FundTotals | null }> {
  const clan = await db.query.clans.findFirst({ where: eq(clans.id, clanId) });
  if (!clan) return { step: 'none', totals: null };
  const plan = isFundPlan(clan.fundPlan) ? clan.fundPlan : null;
  const pledges = await pledgesFor(clanId);
  if (!plan) {
    // No fund: nothing it can grant. (Turning it off is refused while chip-ins count, lib setFundPlan.)
    return { step: 'none', totals: null };
  }
  const totals = fundTotals(plan, pledges, now);
  const shortSince = clan.fundShortSince ? stampMs(clan.fundShortSince) : null;
  const step = fundStep({ funded: totals.funded, granted: clan.fundFunded, shortSince, blocked: membershipPaysPlan(clan), now });
  const tier = PLANS[plan];
  const contacts = step.kind === 'keep' || step.kind === 'none' ? [] : await fundContacts(clan, pledges);

  if (step.kind === 'grant') {
    const was = clan.fundFunded;
    await db.update(clans).set({ plan: plan, memberCap: tier.memberCap, fundFunded: true, fundShortSince: null }).where(eq(clans.id, clan.id));
    if (!was) {
      await audit(clan.id, 'fund_funded', { plan, total: totals.total, goal: totals.goal });
      for (const u of contacts) {
        await tell(u, clan.id, `funded-${plan}-${new Date(now).toISOString().slice(0, 10)}`, {
          title: `${clan.name}'s fund reached ${tier.name}`,
          body: `Members' chip-ins now cover ${tier.name} for the year (${usd(totals.total)} of ${usd(totals.goal)}), so the clan is on it. Chip-ins are closed until it falls short.`,
        });
      }
    } else {
      await audit(clan.id, 'fund_recovered', { plan, total: totals.total, goal: totals.goal });
    }
  } else if (step.kind === 'short') {
    if (shortSince == null) {
      await db.update(clans).set({ fundShortSince: new Date(now).toISOString() }).where(eq(clans.id, clan.id));
      await audit(clan.id, 'fund_short', { plan, total: totals.total, goal: totals.goal });
      for (const u of contacts) {
        await tell(u, clan.id, `short-${new Date(now).toISOString().slice(0, 10)}`, {
          title: `${clan.name}'s fund is ${usd(totals.left)} short`,
          body: `It has ${usd(totals.total)} of ${usd(totals.goal)} for ${tier.name}. Cover the ${usd(totals.left)} by ${fmtDay(step.graceEndsAt)}, or the clan moves to the free plan then. Nothing is deleted.`,
        });
      }
    }
  } else if (step.kind === 'drop') {
    const free = PLANS.free;
    await db.update(clans).set({ plan: free.id, memberCap: free.memberCap, fundFunded: false, fundShortSince: null }).where(eq(clans.id, clan.id));
    await audit(clan.id, 'fund_dropped', { plan, to: free.id, total: totals.total, goal: totals.goal });
    for (const u of contacts) {
      await tell(u, clan.id, `dropped-${new Date(now).toISOString().slice(0, 10)}`, {
        title: `${clan.name} is back on the free plan`,
        body: `The fund stayed ${usd(totals.left)} short of ${tier.name} for a week. Nothing is deleted. Once chip-ins reach ${usd(totals.goal)} again the clan goes back on ${tier.name}.`,
      });
    }
  }
  return { step: step.kind, totals };
}

/**
 * The owner starts the fund for a plan, changes it while it is still collecting, or turns it off
 * when nothing counts. The caller checked the owner.
 */
export async function setFundPlan(clanId: number, actorUserId: number, plan: FundPlanId | null): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const clan = await db.query.clans.findFirst({ where: eq(clans.id, clanId) });
  if (!clan) return { ok: false, error: 'Not found', status: 404 };
  if (clan.kind === 'creator') return { ok: false, error: 'A creator space has no clan fund.', status: 400 };
  const pledges = await pledgesFor(clanId);
  const now = Date.now();
  if (plan === null) {
    if (!clan.fundPlan) return { ok: true };
    const t = fundTotals(clan.fundPlan as FundPlanId, pledges, now);
    if (t.total > 0) {
      return { ok: false, error: 'Chip-ins are still running. The fund can be turned off once members have cancelled theirs.', status: 409 };
    }
    await db.update(clans).set({ fundPlan: null, fundShortSince: null, ...(clan.fundFunded ? { plan: PLANS.free.id, memberCap: PLANS.free.memberCap, fundFunded: false } : {}) }).where(eq(clans.id, clanId));
    await audit(clanId, 'fund_off', { plan: clan.fundPlan }, actorUserId);
    return { ok: true };
  }
  if (!(FUND_PLANS as readonly string[]).includes(plan)) return { ok: false, error: 'Pick Bronze, Silver or Gold.', status: 400 };
  if (membershipPaysPlan(clan)) {
    return { ok: false, error: 'A membership already pays for the plan. Cancel it on Gumroad first, so nobody pays twice.', status: 409 };
  }
  if (clan.fundFunded && clan.fundPlan !== plan) {
    return { ok: false, error: 'The fund already pays for this plan. It can change once it is collecting again.', status: 409 };
  }
  if (clan.fundPlan === plan) return { ok: true };
  await db.update(clans).set({ fundPlan: plan, fundShortSince: null }).where(eq(clans.id, clanId));
  await audit(clanId, clan.fundPlan ? 'fund_plan_changed' : 'fund_started', { plan, from: clan.fundPlan }, actorUserId);
  await recomputeFund(clanId, now);
  return { ok: true };
}

export interface FundView {
  plan: FundPlanId;
  planName: string;
  totals: FundTotals;
  /** The fund pays for the plan right now. */
  granted: boolean;
  /** When the grace ends, if the fund is short of a plan it was paying for. */
  graceEndsAt: number | null;
}

export async function fundView(clan: Pick<Clan, 'id' | 'fundPlan' | 'fundFunded' | 'fundShortSince'>, now = Date.now()): Promise<FundView | null> {
  if (!isFundPlan(clan.fundPlan)) return null;
  const totals = fundTotals(clan.fundPlan, await pledgesFor(clan.id), now);
  const since = clan.fundShortSince ? stampMs(clan.fundShortSince) : NaN;
  return {
    plan: clan.fundPlan,
    planName: PLANS[clan.fundPlan].name,
    totals,
    granted: clan.fundFunded,
    graceEndsAt: Number.isFinite(since) ? since + 7 * DAY : null,
  };
}

/** A chip-in nobody holds: logged, nothing to change. */
function unknown(ev: GumroadEvent): Result {
  log.warn('clan-fund.unknown-membership', { kind: ev.kind, subscription: ev.subscriptionId, sale: ev.saleId });
  return ok({ note: 'unknown chip-in' });
}

/** Apply one clan fund notification. Returns what the webhook should answer. */
export async function handleFundEvent(ev: GumroadEvent): Promise<Result> {
  const row = ev.subscriptionId
    ? await db.query.clanFundPledges.findFirst({ where: eq(clanFundPledges.gumroadSubscriptionId, ev.subscriptionId) })
    : ev.saleId
      ? await db.query.clanFundPledges.findFirst({ where: eq(clanFundPledges.gumroadSaleId, ev.saleId) })
      : undefined;

  if (ev.kind === 'sale' || ev.kind === 'recurring_charge') {
    if (row && ev.saleId && row.gumroadSaleId === ev.saleId) return ok({ note: 'already applied' });
    const check = await checkSaleWithGumroad(ev.saleId, ev.productId);
    if (check === 'error') return { status: 503, body: { error: 'Could not confirm the sale with Gumroad' } };
    if (check === 'rejected') return ok({ note: 'sale not confirmed by Gumroad' });
  }

  const recurrence = ev.recurrence ?? 'yearly';
  let clanId: number | null = row?.clanId ?? null;

  switch (ev.kind) {
    case 'sale': {
      // Only sold as a membership: a sale without one could never be ended or refunded later.
      if (!ev.subscriptionId) return ok({ note: 'not a membership' });
      const periodEnd = nextChargeDue(recurrence, chargedAt(ev.saleTimestamp));
      if (row) {
        await db.update(clanFundPledges).set({ status: 'active', cents: ev.priceCents ?? row.cents, gumroadSaleId: ev.saleId, currentPeriodEnd: periodEnd, endedAt: null }).where(eq(clanFundPledges.id, row.id));
        break;
      }
      // The clan whose checkout ref came back, never the email. The person, when their ref rode along.
      const clan = ev.urlParams.ref ? await db.query.clans.findFirst({ where: eq(clans.gumroadRef, ev.urlParams.ref) }) : undefined;
      if (!clan) {
        log.warn('clan-fund.no-clan', { sale: ev.saleId, subscription: ev.subscriptionId });
        return ok({ note: 'no matching clan' });
      }
      clanId = clan.id;
      const person = ev.urlParams.payer ? await db.query.users.findFirst({ where: eq(users.supporterRef, ev.urlParams.payer), columns: { id: true } }) : undefined;
      // "Cover the rest" counts as the payer's only from someone who may pay for the plan.
      const isPayer = ev.urlParams.cover === '1' && !!person && (await canPayForPlan(clan.id, person.id));
      await db.insert(clanFundPledges).values({
        clanId: clan.id,
        userId: person?.id ?? null,
        isPayer,
        cents: ev.priceCents ?? 0,
        currency: ev.currency ?? null,
        recurrence,
        status: 'active',
        gumroadSubscriptionId: ev.subscriptionId,
        gumroadSaleId: ev.saleId,
        currentPeriodEnd: periodEnd,
        startedAt: nowIso(),
      });
      await audit(clan.id, 'fund_chip_in', { cents: ev.priceCents, payer: isPayer });
      break;
    }

    case 'recurring_charge': {
      if (!row) return unknown(ev);
      await db
        .update(clanFundPledges)
        .set({
          status: 'active',
          cents: ev.priceCents ?? row.cents,
          gumroadSaleId: ev.saleId ?? row.gumroadSaleId,
          currentPeriodEnd: nextChargeDue(row.recurrence ?? recurrence, chargedAt(ev.saleTimestamp)),
          cancelledAt: null,
          endedAt: null,
        })
        .where(eq(clanFundPledges.id, row.id));
      break;
    }

    case 'cancellation': {
      if (!row) return unknown(ev);
      // Paid for the year: it keeps counting until that runs out.
      if (row.status === 'active') await db.update(clanFundPledges).set({ status: 'cancelling', cancelledAt: nowIso() }).where(eq(clanFundPledges.id, row.id));
      break;
    }

    case 'subscription_ended': {
      if (!row) return unknown(ev);
      if (row.status !== 'refunded') await db.update(clanFundPledges).set({ status: 'ended', endedAt: nowIso() }).where(eq(clanFundPledges.id, row.id));
      break;
    }

    case 'restarted': {
      if (!row) return unknown(ev);
      if (row.status === 'refunded') return ok({ note: 'refunded' });
      const check = await checkSubscriptionWithGumroad(ev.subscriptionId);
      if (check === 'error') return { status: 503, body: { error: 'Could not confirm the subscription with Gumroad' } };
      if (check === 'dead') return ok({ note: 'subscription not running' });
      await db.update(clanFundPledges).set({ status: 'active', cancelledAt: null, endedAt: null }).where(eq(clanFundPledges.id, row.id));
      break;
    }

    case 'refund':
    case 'dispute': {
      if (!row) return unknown(ev);
      // Money taken back: it stops counting at once.
      await db.update(clanFundPledges).set({ status: 'refunded', endedAt: nowIso() }).where(eq(clanFundPledges.id, row.id));
      await audit(row.clanId, `fund_${ev.kind}`, { cents: row.cents });
      break;
    }

    default:
      return ok({ note: 'unhandled kind' });
  }

  if (clanId != null) await recomputeFund(clanId);
  return ok();
}

export interface FundSweepResult {
  checked: number;
  failed: number;
  errors: number;
  warned: number;
}

/**
 * Daily (api/cron/billing):
 *   1. chip-ins whose renewal date has gone by are asked about; one Gumroad no longer charges is
 *      'failed' (a failed card sends no notification), and its member is told;
 *   2. every fund is worked out again, which runs the grace and the drop to free;
 *   3. a funded clan that will be short in a week, as things stand, warns its owner and payer.
 */
export async function sweepClanFunds(now = Date.now()): Promise<FundSweepResult> {
  const result: FundSweepResult = { checked: 0, failed: 0, errors: 0, warned: 0 };
  if (process.env.GUMROAD_ACCESS_TOKEN) {
    // clan-scope: global -- billing is the platform's; overdue chip-ins only.
    const active = await db.select().from(clanFundPledges).where(and(eq(clanFundPledges.status, 'active'), isNotNull(clanFundPledges.gumroadSubscriptionId)));
    const due = active.filter((p) => {
      const end = stampMs(p.currentPeriodEnd);
      return Number.isNaN(end) || end < now - 2 * DAY;
    });
    result.checked = due.length;
    for (const p of due) {
      const check = await checkSubscriptionWithGumroad(p.gumroadSubscriptionId);
      if (check === 'dead') {
        await db.update(clanFundPledges).set({ status: 'failed', endedAt: nowIso() }).where(eq(clanFundPledges.id, p.id));
        result.failed += 1;
        if (p.userId != null) {
          const clan = await db.query.clans.findFirst({ where: eq(clans.id, p.clanId), columns: { name: true } });
          await tell(p.userId, p.clanId, `failed-${p.id}`, {
            title: `Your chip-in to ${clan?.name ?? 'the clan'}'s fund didn't renew`,
            body: 'Gumroad couldn\'t charge your card, so it no longer counts toward the fund. Update the card on Gumroad, or chip in again from the clan\'s fund page.',
          });
        }
      } else if (check === 'error') {
        result.errors += 1;
      }
    }
  }
  // clan-scope: global -- every clan with a fund.
  const funds = await db.select().from(clans).where(isNotNull(clans.fundPlan));
  for (const clan of funds) {
    await recomputeFund(clan.id, now);
    if (!clan.fundFunded || !isFundPlan(clan.fundPlan)) continue;
    const pledges = await pledgesFor(clan.id);
    const t = fundTotals(clan.fundPlan, pledges, now);
    const ahead = totalIn(pledges, now, WARN_DAYS);
    if (!t.funded || ahead >= t.goal) continue;
    const when = fmtDay(now + WARN_DAYS * DAY);
    for (const u of await fundContacts(clan, pledges)) {
      if (await tell(u, clan.id, `ahead-${t.goal - ahead}`, {
        title: `${clan.name}'s fund will be ${usd(t.goal - ahead)} short`,
        body: `Chip-ins that were cancelled run out by ${when}, leaving ${usd(ahead)} of ${usd(t.goal)} for ${PLANS[clan.fundPlan].name}. Cover the rest, or ask members to chip in, to keep the plan.`,
      })) result.warned += 1;
    }
  }
  return result;
}

/** Does this clan run a fund? (The site nav's "Fund" link.) */
export async function clanRunsFund(clanId: number): Promise<boolean> {
  const row = await db.query.clans.findFirst({ where: eq(clans.id, clanId), columns: { fundPlan: true } });
  return isFundPlan(row?.fundPlan);
}
