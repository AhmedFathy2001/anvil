import { and, eq, isNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clanMemberships } from '@/db/schema';
import ClanLink from '@/components/ClanLink';
import { ensureClanCheckoutRef } from '@/lib/billing';
import { requireClan } from '@/lib/clanContext';
import { freemiumEnforced } from '@/lib/entitlements';
import { PLANS, planOf, truthfulFeatures, type Plan } from '@/lib/plans';
import { SITE } from '@/lib/site';
import { parseBillingInterval, usd, withBilling, yearlyPriceUsd } from '@/lib/billingInterval';
import { redirect } from 'next/navigation';
import { clanHref } from '@/lib/clanPath';
import { isCreatorSpace } from '@/lib/creatorSpaces';
import { verifyUser } from '@/lib/auth';
import { atLeast } from '@/lib/clanRoles';
import { isPlatformStaff } from '@/lib/analytics';
import { clans } from '@/db/schema';
import { buyWording, chargeText, clanBuy, soonReason } from '@/lib/buyOffer';
import { openExtrasForClans } from '@/lib/extraMemberships';
import { manageUrl } from '@/lib/gumroadLinks';
import { clanTrialUsed } from '@/lib/planTrials';
import { SECOND_MEMBERSHIP_WARNING, extraMembershipNotice } from '@/lib/supporterDuplicates';
import BuyButtons from '@/components/BuyButtons';
import EarlyBirdBadge from '@/components/EarlyBirdBadge';
import PlanTrialPanel from '@/components/PlanTrialPanel';
import PlanPayers from './PlanPayers';
import FundControls from './FundControls';
import ClanFundProgress from '@/components/ClanFundProgress';
import { ensureFundRef, fundConfigured, fundView, membershipPaysPlan } from '@/lib/clanFund';
import { FUND_PLANS, fundCheckoutUrl, goalCents, usd as usdCents } from '@/lib/clanFundRules';
import { canPayForPlan, payerCandidates, planPayerView } from '@/lib/planPayers';
import { removePayerConfirm } from '@/lib/planPayerRules';
import { ensureSupporterRef } from '@/lib/supporter';

export const dynamic = 'force-dynamic';

/**
 * Plan and billing, inside the clan's own admin.
 *
 * It used to live only at /portal, reached from the owner's profile → "Manage billing", which is
 * where nobody running a clan looks. The tone is AWARENESS, not a paywall: Anvil is free for small
 * clans, and the big ones are what keep it running. Nothing here takes anything away from anybody.
 */
export default async function AdminPlanPage({ searchParams }: { searchParams: Promise<{ billing?: string; plan?: string }> }) {
  const clan = await requireClan();
  const query = await searchParams;
  const billing = parseBillingInterval(query.billing);
  // A creator space is billed from its own catalogue, on its dashboard's plan card — never offered the
  // clan tiers this page sells (lib/creatorCatalog).
  if (isCreatorSpace(clan)) redirect(await clanHref('/admin/dashboard#plan'));
  // clan-scope: the page's own clan.
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(clanMemberships)
    .where(and(eq(clanMemberships.clanId, clan.id), eq(clanMemberships.kind, 'member'), isNull(clanMemberships.leftAt)));
  const members = row?.n ?? 0;
  // What the clan PAYS for (clans.plan). A running trial from Anvil is said by its own card below;
  // the cap bar reads the plan in force, which is the trial's tier while it runs.
  const plan = planOf(clan.paidPlan);
  const inForce = planOf(clan.plan);
  const onTrial = inForce.id !== plan.id;
  const free = PLANS.free;
  const freeCap = free.memberCap ?? 0;
  const paying = plan.id !== 'free';
  // The smallest plan that holds this roster — the one worth showing, rather than a price table.
  const paidTiers = (['bronze', 'silver', 'gold'] as const).map((id) => PLANS[id]);
  const smallest: Plan = paidTiers.find((p) => (p.memberCap ?? Infinity) >= members) ?? PLANS.gold;
  // Every tier that holds the roster can be bought, not only the smallest: a clan may want Gold's room
  // ahead of time. ?plan= (from /pricing, or the picks below) says which one this page is offering.
  const choices = paidTiers.filter((p) => (p.memberCap ?? Infinity) >= (smallest.memberCap ?? Infinity));
  const fits: Plan | null = choices.find((p) => p.id === query.plan) ?? smallest;
  const session = await verifyUser();
  const isOwner = !!session && atLeast(session.role, 'owner');
  // The owner, or an admin, treasurer or moderator the owner let pay (lib/planPayers). Their checkout
  // carries their own ref, so the sale records whose membership it is.
  const canPay = isOwner || (!!session && (await canPayForPlan(clan.id, session.userId)));
  const payerRef = canPay && session ? await ensureSupporterRef(session.userId) : null;
  const viewerIsStaff = !!session && (await isPlatformStaff(session.userId));
  const ref = paying ? null : await ensureClanCheckoutRef(clan.id);
  // ONE TRIAL (lib/buyOffer): a clan that has had its trial from Anvil, a Gumroad trial or a
  // membership is only ever sent to the pay-now product, charged that day. Every clan made since
  // automatic trials began has had one, so "Start free trial" is for older clans that never did.
  const [billingRow, extras] = await Promise.all([
    db.query.clans.findFirst({ where: eq(clans.id, clan.id), columns: { id: true, plan: true, trialEndsAt: true, gumroadSubscriptionId: true, planPaidByUserId: true, currentPeriodEnd: true, cancelAtPeriodEnd: true, fundPlan: true, fundFunded: true, fundShortSince: true } }),
    openExtrasForClans([clan.id]),
  ]);
  const trialUsed = billingRow ? await clanTrialUsed(billingRow) : true;
  // Who pays (lib/planPayers): shown to everyone on this page; the owner manages who may.
  const payerView = billingRow ? await planPayerView(billingRow) : { payer: null, payerStopped: false };
  const candidates = isOwner ? await payerCandidates(clan.id) : [];
  // The clan fund (lib/clanFund): members chip in toward one plan; the payer covers the rest.
  const fund = billingRow ? await fundView(billingRow) : null;
  const fundOn = fundConfigured();
  const fundBlocked = billingRow && membershipPaysPlan(billingRow) ? 'A membership already pays for the plan. To fund it with chip-ins instead, cancel that membership on Gumroad first, so nobody pays twice.' : null;
  const coverUrl =
    fund && fundOn && canPay && !fund.totals.funded && session
      ? fundCheckoutUrl(process.env.GUMROAD_URL_CLAN_FUND, await ensureFundRef(clan.id), payerRef, true)
      : null;
  const renewsMs = billingRow?.currentPeriodEnd ? Date.parse(billingRow.currentPeriodEnd.includes('T') ? billingRow.currentPeriodEnd : `${billingRow.currentPeriodEnd.replace(' ', 'T')}Z`) : NaN;
  const yearly = fits ? yearlyPriceUsd(fits.priceUsd) : null;
  // Monthly and, once that tier's yearly checkout is set, yearly (a year costs ten months).
  const offers = fits && ref
    ? (['monthly', 'yearly'] as const)
        .map((interval) => ({ interval, buttons: clanBuy(fits, ref, interval, trialUsed, payerRef) }))
        .filter((o) => o.buttons.kind !== 'none' && (o.interval === 'monthly' || o.buttons.kind !== 'soon' || clanBuy(fits, ref, 'yearly', false).kind !== 'none'))
        .sort((a, b) => (a.interval === billing ? -1 : b.interval === billing ? 1 : 0))
    : [];
  const checkoutYearly = offers.some((o) => o.interval === 'yearly');
  const toCancel = extras.filter((e) => e.state === 'to_cancel');
  const waiting = extras.find((e) => e.state === 'waiting') ?? null;
  const held = !paying && !!billingRow?.gumroadSubscriptionId && !!billingRow.trialEndsAt && Date.parse(billingRow.trialEndsAt) > Date.now();
  const dayMonth = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const cap = inForce.memberCap;
  const usedPct = cap ? Math.min(100, Math.round((Math.min(members, cap) / Math.max(members, cap)) * 100)) : 100;
  const over = cap != null && members > cap;

  return (
    <div className="max-w-4xl">
      <header className="mb-8">
        <h1 className="display display-lg text-4xl font-semibold leading-tight sm:text-[44px]">Plan and billing</h1>
        <p className="mt-2 max-w-[66ch] text-[15px] leading-relaxed text-text-muted">
          Anvil is a free, indie project. It&rsquo;s free for clans up to {freeCap} members, and bigger clans keep it
          running for everyone else.
        </p>
      </header>

      <section id="plan-usage" className="scroll-mt-24 rounded-xl border border-card-border bg-card-bg p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-base font-semibold">
            {onTrial ? `${inForce.name} trial` : `${plan.name} plan`} · {members.toLocaleString()} member{members === 1 ? '' : 's'}
          </span>
          <span className={`text-[13.5px] ${over ? 'font-medium text-orange-300' : 'text-text-muted'}`}>
            {over ? `${members.toLocaleString()} of ${(cap ?? 0).toLocaleString()} members` : inForce.capLabel}
            {onTrial && ` (${plan.name}: ${plan.capLabel.toLowerCase()})`}
          </span>
        </div>
        <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-brown-dark" aria-hidden>
          <span className="bg-accent-green-light" style={{ width: `${usedPct}%` }} />
          {/* The part past the cap, in the site's over-the-limit colour. */}
          {over && <span className="flex-1 bg-orange-400" />}
        </div>
        <p className="mt-3 text-[13.5px] leading-relaxed text-text-muted">
          {!over
            ? 'Your clan fits its plan.'
            : freemiumEnforced()
              ? `You're ${(members - (cap ?? 0)).toLocaleString()} over. Everyone already tracked stays tracked; a bigger plan makes room for the rest.`
              : `Your clan has ${members.toLocaleString()} members. ${inForce.name} covers up to ${(cap ?? 0).toLocaleString()}. ${
                  fits?.memberCap ? `${fits.name} covers up to ${fits.memberCap.toLocaleString()} and helps` : 'A plan helps'
                } pay for the servers a clan this size uses.`}
        </p>
      </section>

      {toCancel.map((m) => {
        const n = extraMembershipNotice({
          tierName: planOf(m.plan).name,
          keptTierName: plan.name,
          reason: m.reason,
          cancelledAt: m.cancelledAt?.getTime() ?? null,
          periodEndsAt: m.periodEndsAt?.getTime() ?? null,
        });
        return (
          <div
            key={m.id}
            role="status"
            className={`mt-5 rounded-xl border px-4 py-3 text-[13.5px] leading-relaxed ${n.askCancel ? 'border-orange-500/40 bg-orange-500/10 text-orange-200' : 'border-card-border text-text-muted'}`}
          >
            {n.lead}:{' '}
            <a href={manageUrl(m.gumroadSubscriptionId)} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
              {n.link}
            </a>
            .{n.askCancel && ' Gumroad emails a sign-in link to the address you paid with. This notice goes away once that membership has ended.'}
          </div>
        );
      })}
      {waiting && (
        <div role="status" className="mt-5 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-[13.5px] leading-relaxed text-gold-light">
          You&rsquo;ve already had your free trial, so {planOf(waiting.plan).name} starts when your first payment goes through
          {waiting.trialEndsAt ? ` on ${dayMonth(waiting.trialEndsAt.getTime())}` : ''}. Until then the clan stays on {plan.name}, which
          you are still paying for. When {planOf(waiting.plan).name} starts, cancel the {plan.name} membership on Gumroad so you are
          not charged twice.
        </div>
      )}
      {held && billingRow?.trialEndsAt && (
        <div role="status" className="mt-5 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-[13.5px] leading-relaxed text-gold-light">
          You&rsquo;ve already had your free trial, so your new plan starts when your first payment goes through on{' '}
          {dayMonth(Date.parse(billingRow.trialEndsAt))}. Gumroad opened this membership with a free period, and nothing is charged
          until then.{' '}
          <ClanLink href="/portal" className="font-semibold underline">
            Billing
          </ClanLink>{' '}
          has the link to manage it.
        </div>
      )}

      {isOwner && payerView.payer && payerView.payerStopped && (
        <div role="status" className="mt-5 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-[13.5px] leading-relaxed text-gold-light">
          {payerView.payer.name} can no longer pay for the plan. Their membership still pays for it
          {Number.isFinite(renewsMs) ? ` until ${dayMonth(renewsMs)}` : ''}, and we&rsquo;ve told them how to cancel. Choose who pays next before then.
        </div>
      )}

      <div className="mt-5">
        {/* A membership already waiting for its first payment: no second buy button beside it. */}
        <PlanTrialPanel clan={clan} billing={billing} canBuy={canPay && !held && !billingRow?.fundPlan} payerRef={payerRef} viewerIsStaff={viewerIsStaff} earlyBird={paying || !fits} />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {paying ? (
          <section className="rounded-xl border border-gold/45 bg-gold/[0.05] p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-gold">Thank you</p>
            <h2 className="mt-1 text-xl font-semibold">You&rsquo;re on {plan.name}</h2>
            {payerView.payer && (
              <p className="mt-1 text-[14px] font-medium">
                Paid by {session?.userId === payerView.payer.userId ? 'you' : payerView.payer.name}
                {Number.isFinite(renewsMs) && (
                  <span className="font-normal text-text-muted">
                    {' '}· {billingRow?.cancelAtPeriodEnd ? 'ends' : 'renews'} {dayMonth(renewsMs)}
                  </span>
                )}
              </p>
            )}
            <p className="mt-2 text-[14px] leading-relaxed text-text-muted">
              Your plan keeps Anvil running for every small clan that can&rsquo;t pay. Change it or see invoices any
              time.
            </p>
            {session && payerView.payer?.userId === session.userId && billingRow?.gumroadSubscriptionId ? (
              <a href={manageUrl(billingRow.gumroadSubscriptionId)} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-[14px] text-gold hover:text-gold-light">
                Manage your membership on Gumroad
              </a>
            ) : isOwner ? (
              <ClanLink href="/portal" className="mt-4 inline-block text-[14px] text-gold hover:text-gold-light">
                Manage subscription and invoices
              </ClanLink>
            ) : null}
            {payerView.payer && session?.userId !== payerView.payer.userId && (
              <p className="mt-2 text-[12.5px] leading-relaxed text-text-muted">
                {payerView.payer.name} holds this membership on their own Gumroad account, so only they can cancel it or change the card.
              </p>
            )}
            <p className="mt-3 text-[12.5px] leading-relaxed text-text-muted">Moving to another tier: {SECOND_MEMBERSHIP_WARNING}</p>
          </section>
        ) : (
          fits && (
            <section className="flex flex-col gap-3 rounded-xl border border-gold/45 bg-gradient-to-b from-card-bg-hover to-card-bg p-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-gold">
                {fits.id !== smallest.id ? 'Your pick' : over ? 'Fits your clan' : 'When you grow'}
              </p>
              <h2 className="text-xl font-semibold">
                {fits.name} · {fits.capLabel.toLowerCase()}
              </h2>
              <p className="text-[14px] text-text-muted">
                ${fits.priceUsd} a month
                {checkoutYearly && yearly != null && <> or {usd(yearly)} a year (12 months for the price of 10)</>}
              </p>
              <EarlyBirdBadge />
              <p className="text-[13px] leading-relaxed text-text-muted">
                Discord posts, every event format and drop tracking are already on the free plan. A plan is about roster size.
              </p>
              <ul className="grid gap-1 text-[13.5px] text-text-muted">
                {truthfulFeatures(fits).map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              {fund ? (
                <p className="text-[13px] leading-relaxed text-text-muted">
                  The clan is funding {fund.planName} with chip-ins (below), so there is nothing to subscribe to here: nobody pays twice.
                </p>
              ) : canPay && held ? (
                <p className="text-[13px] text-text-muted">
                  You already have a membership waiting for its first payment (see the notice above), so there is nothing to
                  buy here.
                </p>
              ) : canPay ? (
                offers.map((o) => {
                  const wording = buyWording(o.buttons, {
                    tierName: fits.name,
                    charge: chargeText(fits.priceUsd ?? 0, o.interval),
                    verb: o.interval === 'yearly' ? `Subscribe to ${fits.name}, yearly` : `Subscribe to ${fits.name}`,
                  });
                  return wording ? (
                    <BuyButtons
                      key={o.interval}
                      wording={wording}
                      caption={offers.length > 1 ? (o.interval === 'yearly' ? 'Yearly' : 'Monthly') : null}
                      staffNote={viewerIsStaff && o.buttons.kind === 'soon' ? soonReason(o.interval === 'yearly' ? fits.gumroadUrlYearlyEnv : fits.gumroadUrlEnv) : null}
                    />
                  ) : null;
                })
              ) : (
                <p className="text-[13px] text-text-muted">The owner, or someone they choose, pays for the plan.</p>
              )}
              {choices.length > 1 && (
                <p className="text-center text-[13px] text-text-muted">
                  Or pick another:{' '}
                  {choices
                    .filter((p) => p.id !== fits.id)
                    .map((p, i) => (
                      <span key={p.id}>
                        {i > 0 && ' · '}
                        <ClanLink href={withBilling(`/admin/plan?plan=${p.id}`, billing)} className="text-gold hover:text-gold-light">
                          {p.name} (${p.priceUsd}/mo)
                        </ClanLink>
                      </span>
                    ))}
                </p>
              )}
              <ClanLink href={withBilling('/pricing', billing)} className="text-center text-[13px] text-gold hover:text-gold-light">
                Compare all plans
              </ClanLink>
            </section>
          )
        )}

        <section id="fund" className="flex scroll-mt-24 flex-col gap-3 rounded-xl border border-card-border bg-card-bg p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-dim">Or share it</p>
          <h2 className="text-xl font-semibold">Clan fund</h2>
          <p className="text-[14px] leading-relaxed text-text-muted">
            Members chip in once a year, from $6, and it renews until they cancel. Once chip-ins reach the plan&rsquo;s yearly price the
            clan is on it; whoever pays for the plan covers the rest.
          </p>
          {fund && <ClanFundProgress planName={fund.planName} totals={fund.totals} graceEndsAt={fund.granted && !fund.totals.funded ? fund.graceEndsAt : null} />}
          {coverUrl && fund && (
            <a
              href={coverUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-gold px-4 text-[14px] font-semibold text-brown-dark transition-colors hover:bg-gold-light"
            >
              Cover the rest · {usdCents(fund.totals.left)} (enter it on Gumroad)
            </a>
          )}
          {fund && (
            <ClanLink href="/fund" className="text-[13px] text-gold hover:text-gold-light">
              The fund page members see
            </ClanLink>
          )}
          {isOwner && fundOn ? (
            <FundControls
              current={fund?.plan ?? null}
              locked={!!fund?.granted}
              blockedReason={fundBlocked}
              options={FUND_PLANS.map((id) => ({ id, label: PLANS[id].name, goal: usdCents(goalCents(id)) }))}
            />
          ) : !fundOn ? (
            <p className="text-[13px] text-text-muted">Coming soon.{viewerIsStaff ? ' (Staff: set GUMROAD_URL_CLAN_FUND and GUMROAD_PRODUCT_CLAN_FUND to switch it on.)' : ''}</p>
          ) : !fund ? (
            <p className="text-[13px] text-text-muted">The owner can start one here.</p>
          ) : null}
        </section>
      </div>

      {isOwner && (
        <PlanPayers
          candidates={candidates}
          payingUserId={payerView.payer && !payerView.payerStopped ? payerView.payer.userId : null}
          confirmText={payerView.payer ? removePayerConfirm({ payerName: payerView.payer.name, renews: Number.isFinite(renewsMs) ? dayMonth(renewsMs) : null }) : null}
        />
      )}

      <section id="anvil-discord" className="mt-5 flex scroll-mt-24 flex-wrap items-center gap-4 rounded-xl border border-card-border bg-card-bg px-5 py-4">
        <p className="min-w-0 flex-[1_1_22rem] text-[14px] leading-relaxed text-text-muted">
          <b className="text-foreground">Run a clan on Anvil?</b> The Anvil Discord is where leaders swap setups, ask
          for features and hear first about what&rsquo;s coming.
        </p>
        <a
          href={SITE.supportDiscord}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-[#5865f2] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Join the Anvil Discord
        </a>
      </section>
    </div>
  );
}
