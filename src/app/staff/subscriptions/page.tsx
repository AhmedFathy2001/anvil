import { notFound } from 'next/navigation';
import { eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { clans, supporterSubscriptions, users } from '@/db/schema';
import { CAN_BILL, requirePlatformPage } from '@/lib/platformAccess';
import { hasPlatformRole } from '@/lib/clanRoles';
import { listUnmatchedPurchases } from '@/lib/unmatchedPurchases';
import { billingStatus, subscriptionFacts, type BillingState } from '@/lib/clanBilling';
import { PLANS, PLAN_IDS } from '@/lib/plans';
import { CREATOR_FREE_ID, CREATOR_PLANS, CREATOR_PLAN_IDS } from '@/lib/creatorCatalog';
import { billingTierOf, isFreePlanId } from '@/lib/billingCatalog';
import {
  GIFT_RECURRENCE,
  SUPPORTER_TIERS,
  SUPPORTER_TIER_ORDER,
  rowInForce,
  type SupporterTierId,
} from '@/lib/supporterTiers';
import ClanLink from '@/components/ClanLink';
import UnmatchedPurchases from './UnmatchedPurchases';

export const dynamic = 'force-dynamic';

type View = 'clans' | 'people';

/** Billing states that mean a clan is (or is about to be) a paying customer — what this page lists. */
const CLAN_STATES: BillingState[] = ['active', 'cancelling', 'lapsed', 'trialing', 'comped'];

const STATE_TONE: Partial<Record<BillingState, string>> = {
  active: 'text-emerald-400',
  cancelling: 'text-yellow-400',
  lapsed: 'text-red-400',
  trialing: 'text-sky-300',
};

function day(stamp: string | null | undefined): string {
  if (!stamp) return '—';
  return stamp.slice(0, 10);
}

/**
 * Who is paying Anvil, by tier. Two kinds of subscription that never mix: a CLAN's plan
 * (lib/plans — what the clan may do) and a PERSON's Supporter tier (lib/supporterTiers — flair and
 * hosting room, following the login into every clan). Read-only, so support sees it too — except the
 * unmatched-purchases inbox at the top, whose attach / dismiss are root's (platformAccess CAN_BILL).
 */
export default async function StaffSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const actor = await requirePlatformPage('support');
  if (!actor) notFound();
  const view: View = (await searchParams).view === 'people' ? 'people' : 'clans';
  const now = Date.now();
  // Purchases the webhook could not place (lib/unmatchedPurchases), shown on both tabs.
  const unmatched = await listUnmatchedPurchases();

  // ── Clans ────────────────────────────────────────────────────────────────────────────────
  // clan-scope: global -- the platform's own view of every clan's billing.
  const clanRows = await db
    .select({
      id: clans.id,
      name: clans.name,
      slug: clans.slug,
      kind: clans.kind,
      plan: clans.plan,
      contactEmail: clans.contactEmail,
      trialEndsAt: clans.trialEndsAt,
      currentPeriodEnd: clans.currentPeriodEnd,
      cancelAtPeriodEnd: clans.cancelAtPeriodEnd,
      gumroadSubscriptionId: clans.gumroadSubscriptionId,
    })
    .from(clans)
    .where(eq(clans.status, 'active'));

  const paidClans = clanRows
    .map((c) => ({ ...c, billing: billingStatus({ ...c, ...subscriptionFacts(c.gumroadSubscriptionId, c.plan) }, now) }))
    .filter((c) => CLAN_STATES.includes(c.billing.state));
  // A trialing clan sits on free until it pays; it is shown under its own heading, not as Free.
  // Creator spaces are billed from their own catalogue (lib/creatorCatalog) and listed under their
  // own tiers, after the clan ones.
  const clanTiers: { id: string; name: string; priceUsd: number | null }[] = [
    ...PLAN_IDS.filter((id) => id !== 'free').map((id) => ({ id, name: PLANS[id].name, priceUsd: PLANS[id].priceUsd })),
    ...CREATOR_PLAN_IDS.filter((id) => id !== CREATOR_FREE_ID).map((id) => ({
      id,
      name: `Creator ${CREATOR_PLANS[id].name}`,
      priceUsd: CREATOR_PLANS[id].priceUsd,
    })),
    { id: 'trial', name: 'On trial', priceUsd: null },
  ];
  const clanTierOf = (c: (typeof paidClans)[number]): string =>
    c.billing.state === 'trialing' && isFreePlanId(c.plan) ? 'trial' : billingTierOf(c.kind, c.plan).id;
  const clansByTier = new Map(clanTiers.map((t) => [t.id, paidClans.filter((c) => clanTierOf(c) === t.id)]));

  // ── People ───────────────────────────────────────────────────────────────────────────────
  const subRows = await db
    .select({
      userId: supporterSubscriptions.userId,
      tier: supporterSubscriptions.tier,
      status: supporterSubscriptions.status,
      recurrence: supporterSubscriptions.recurrence,
      currentPeriodEnd: supporterSubscriptions.currentPeriodEnd,
      startedAt: supporterSubscriptions.startedAt,
      name: users.displayName,
      discordUsername: users.discordUsername,
    })
    .from(supporterSubscriptions)
    .innerJoin(users, eq(users.id, supporterSubscriptions.userId))
    .where(inArray(supporterSubscriptions.status, ['active', 'cancelling', 'granted']));

  // One line per person: their best row in force (the tier they actually wear).
  const best = new Map<number, (typeof subRows)[number]>();
  for (const r of subRows) {
    if (!rowInForce(r, now)) continue;
    const cur = best.get(r.userId);
    if (!cur || SUPPORTER_TIERS[r.tier as SupporterTierId].rank > SUPPORTER_TIERS[cur.tier as SupporterTierId].rank) {
      best.set(r.userId, r);
    }
  }
  const people = [...best.values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const peopleByTier = new Map(SUPPORTER_TIER_ORDER.map((t) => [t, people.filter((p) => p.tier === t)]));
  const isPaid = (r: (typeof people)[number]) => r.recurrence === 'monthly' || r.recurrence === 'yearly';

  // Rough monthly run-rate: list prices only (Gumroad holds the real charge; pay-what-you-want and
  // discounts mean the true number is higher or lower). Trials, comps, gifts and referrals are $0.
  const clanMrr = paidClans
    .filter((c) => c.billing.state === 'active' || c.billing.state === 'cancelling')
    .reduce((sum, c) => sum + (billingTierOf(c.kind, c.plan).priceUsd ?? 0), 0);
  const peopleMrr = people
    .filter(isPaid)
    .reduce((sum, p) => {
      const t = SUPPORTER_TIERS[p.tier as SupporterTierId];
      return sum + (p.recurrence === 'yearly' ? t.yearlyUsd / 12 : t.monthlyUsd);
    }, 0);

  const tab = (v: View, label: string, count: number) => (
    <ClanLink
      href={v === 'clans' ? '/staff/subscriptions' : '/staff/subscriptions?view=people'}
      className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors ${
        view === v ? 'border-gold text-gold-light' : 'border-transparent text-text-muted hover:text-foreground'
      }`}
    >
      {label}
      <span className="ml-1.5 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold">{count}</span>
    </ClanLink>
  );

  const summary =
    view === 'clans'
      ? clanTiers.map((t) => ({ label: t.name, count: clansByTier.get(t.id)?.length ?? 0 }))
      : SUPPORTER_TIER_ORDER.map((t) => ({ label: SUPPORTER_TIERS[t].name, count: peopleByTier.get(t)?.length ?? 0 }));

  return (
    <div>
      <h1 className="text-2xl font-bold">Subscriptions</h1>
      <p className="mt-1 text-sm text-gray-400">
        Who is paying, by tier. Clan plans and personal Supporter tiers are separate subscriptions. Run-rate is at list
        price: ≈ ${clanMrr.toFixed(2)}/mo from clans, ≈ ${peopleMrr.toFixed(2)}/mo from individuals.
      </p>

      <UnmatchedPurchases open={unmatched.open} resolved={unmatched.resolved} canResolve={hasPlatformRole(actor.role, CAN_BILL)} />

      <div className="mt-5 flex gap-1 border-b border-card-border overflow-x-auto overflow-y-hidden scroll-quiet">
        {tab('clans', 'Clans', paidClans.length)}
        {tab('people', 'Individuals', people.length)}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {summary.map((s) => (
          <div key={s.label} className="rounded-xl border border-card-border bg-card-bg px-4 py-3">
            <div className="text-xs uppercase tracking-wider text-gray-500">{s.label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{s.count}</div>
          </div>
        ))}
      </div>

      {view === 'clans'
        ? clanTiers.map((t) => {
            const list = clansByTier.get(t.id) ?? [];
            if (list.length === 0) return null;
            return (
              <section key={t.id} className="mt-8">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <span className="h-5 w-1 bg-gold" />
                  {t.name}
                  {t.priceUsd != null && <span className="text-sm font-normal text-gray-500">from ${t.priceUsd}/mo</span>}
                  <span className="text-sm font-normal text-gray-500">· {list.length}</span>
                </h2>
                <div className="mt-3 overflow-x-auto overflow-y-hidden">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wider text-gray-500">
                      <tr>
                        <th className="py-2 pr-4 font-medium">Clan</th>
                        <th className="py-2 pr-4 font-medium">Status</th>
                        <th className="py-2 pr-4 font-medium">Period / trial end</th>
                        <th className="py-2 font-medium">Contact</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-card-border">
                      {list.map((c) => (
                        <tr key={c.id}>
                          <td className="py-2 pr-4">
                            <ClanLink href={`/staff/clans/${c.id}`} className="hover:text-gold">
                              {c.name}
                            </ClanLink>
                            <span className="ml-2 text-xs text-gray-500">{c.slug}</span>
                          </td>
                          <td className={`py-2 pr-4 ${STATE_TONE[c.billing.state] ?? 'text-gray-400'}`}>{c.billing.label}</td>
                          <td className="py-2 pr-4 tabular-nums text-gray-400">
                            {day(c.billing.state === 'trialing' ? c.trialEndsAt : c.currentPeriodEnd)}
                          </td>
                          <td className="py-2 text-gray-400">{c.contactEmail ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })
        : SUPPORTER_TIER_ORDER.map((tierId) => {
            const t = SUPPORTER_TIERS[tierId];
            const list = peopleByTier.get(tierId) ?? [];
            if (list.length === 0) return null;
            return (
              <section key={tierId} className="mt-8">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <span className="h-5 w-1 bg-gold" />
                  {t.name}
                  <span className="text-sm font-normal text-gray-500">
                    ${t.monthlyUsd}/mo · ${t.yearlyUsd}/yr · {list.length}
                  </span>
                </h2>
                <div className="mt-3 overflow-x-auto overflow-y-hidden">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wider text-gray-500">
                      <tr>
                        <th className="py-2 pr-4 font-medium">Person</th>
                        <th className="py-2 pr-4 font-medium">Billing</th>
                        <th className="py-2 pr-4 font-medium">Status</th>
                        <th className="py-2 pr-4 font-medium">Since</th>
                        <th className="py-2 font-medium">Renews / ends</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-card-border">
                      {list.map((p) => {
                        const billing =
                          p.recurrence === GIFT_RECURRENCE
                            ? 'Staff gift'
                            : p.recurrence?.startsWith('referral')
                              ? 'Referral reward'
                              : p.recurrence === 'lab'
                                ? 'Lab'
                                : (p.recurrence ?? '—');
                        return (
                          <tr key={p.userId}>
                            <td className="py-2 pr-4">
                              <ClanLink
                                href={`/staff/people?q=${encodeURIComponent(p.name ?? p.discordUsername ?? '')}`}
                                className="hover:text-gold"
                              >
                                {p.name ?? p.discordUsername ?? `User ${p.userId}`}
                              </ClanLink>
                            </td>
                            <td className="py-2 pr-4 capitalize text-gray-400">{billing}</td>
                            <td className={`py-2 pr-4 ${p.status === 'cancelling' ? 'text-yellow-400' : 'text-gray-300'}`}>
                              {p.status === 'cancelling' ? 'Cancelling' : p.status === 'granted' ? 'Granted' : 'Active'}
                            </td>
                            <td className="py-2 pr-4 tabular-nums text-gray-400">{day(p.startedAt)}</td>
                            <td className="py-2 tabular-nums text-gray-400">{day(p.currentPeriodEnd)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}

      {(view === 'clans' ? paidClans.length : people.length) === 0 && (
        <p className="mt-6 text-sm text-gray-400">
          {view === 'clans' ? 'No clan is on a paid plan or a trial right now.' : 'Nobody holds a Supporter tier right now.'}
        </p>
      )}
    </div>
  );
}
