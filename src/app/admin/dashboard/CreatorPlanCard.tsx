import ClanLink from '@/components/ClanLink';
import { ensureClanCheckoutRef } from '@/lib/billing';
import { creatorPlanCard, liveEventLimit } from '@/lib/creatorPlans';
import { creatorSeatMeter, liveEventCount } from '@/lib/creatorPlansDb';
import { CREATOR_PLANS, creatorPlanOf } from '@/lib/creatorCatalog';
import { buyWording, chargeText, creatorBuy } from '@/lib/buyOffer';
import { clanTrialUsed } from '@/lib/planTrials';
import { SECOND_MEMBERSHIP_WARNING } from '@/lib/supporterDuplicates';
import { db } from '@/db';
import { clans } from '@/db/schema';
import { eq } from 'drizzle-orm';
import BuyButtons from '@/components/BuyButtons';
import EarlyBirdBadge from '@/components/EarlyBirdBadge';
import { usd, withBilling, yearlyPriceUsd, type BillingInterval } from '@/lib/billingInterval';

/**
 * A creator's plan, in plain words, on their dashboard (lib/creatorPlans): which plan, the most
 * players at once across their events (events whose dates overlap share the cap; one person on two
 * boards counts on both), each current event's own count, and the one tier worth looking at next
 * with a button straight to its checkout.
 *
 * The checkout is the CREATOR catalogue's (lib/creatorCatalog creatorCheckoutUrlWithRef + the space's
 * `ref`): its own Gumroad products, never a clan tier. The webhook finds the space by that ref and
 * moves `clans.plan` within the creator catalogue. No checkout URL configured → no button.
 */
export default async function CreatorPlanCard({
  clanId,
  clanPlan,
  paidPlan,
  canBuy,
  billing = 'monthly',
}: {
  clanId: number;
  /** The plan in force (a running trial from Anvil counts): what the meters and limits read. */
  clanPlan: string;
  /** clans.plan: what the space pays for. Defaults to the plan in force. */
  paidPlan?: string;
  canBuy: boolean;
  /** Which price leads (?billing= from /pricing). Both are offered when the yearly checkout exists. */
  billing?: BillingInterval;
}) {
  const [meter, live] = await Promise.all([creatorSeatMeter(clanId), liveEventCount(clanId)]);
  const card = creatorPlanCard({ clanPlan, meter });
  const plan = creatorPlanOf(clanPlan);
  const paid = creatorPlanOf(paidPlan ?? clanPlan);
  const paying = paid.id !== 'creator_free';
  const onTrial = paid.id !== plan.id;
  // What to buy next is counted from what they PAY for: during a trial that is the tier they would keep.
  const paidCard = onTrial ? creatorPlanCard({ clanPlan: paid.id, meter }) : card;
  const next = paidCard.next ? CREATOR_PLANS[paidCard.next.id] : null;
  const ref = canBuy && next && !paying ? await ensureClanCheckoutRef(clanId) : null;
  // ONE TRIAL (lib/buyOffer): a space that has had its trial only ever gets the pay-now checkout.
  const row = ref ? await db.query.clans.findFirst({ where: eq(clans.id, clanId), columns: { id: true, trialEndsAt: true, gumroadSubscriptionId: true } }) : null;
  const trialUsed = row ? await clanTrialUsed(row) : true;
  const yearly = next ? yearlyPriceUsd(next.priceUsd) : null;
  // Monthly, and yearly once its checkout is set (a year costs ten months). The interval asked for leads.
  const offers = next && ref
    ? (['monthly', 'yearly'] as const)
        .map((interval) => ({ interval, buttons: creatorBuy(next, ref, interval, trialUsed) }))
        .filter((o) => o.buttons.kind !== 'none' && (o.interval === 'monthly' || creatorBuy(next, ref, 'yearly', false).kind !== 'none'))
        .sort((a, b) => (a.interval === billing ? -1 : b.interval === billing ? 1 : 0))
    : [];
  const checkoutYearly = offers.some((o) => o.interval === 'yearly');
  const cap = card.playersCap;
  const players = meter?.peak ?? 0;
  const fmt = (n: number) => n.toLocaleString('en-US');
  const pct = cap ? Math.min(100, Math.round((players / cap) * 100)) : 0;
  const liveLimit = liveEventLimit(plan);

  return (
    <section id="plan" className="scroll-mt-24 rounded-xl border border-card-border bg-card-bg p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Your plan: {onTrial ? `${card.planName} (trial from Anvil; you pay for ${paid.name})` : card.planName}</h2>
        {paying && (
          <ClanLink href="/portal" className="text-[13px] text-gold hover:text-gold-light">
            Manage billing
          </ClanLink>
        )}
      </div>
      {paying && <p className="mt-1 text-[12.5px] text-text-muted">Moving to another tier: {SECOND_MEMBERSHIP_WARNING}</p>}

      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-[13px] text-text-muted">
            {meter && !meter.current ? 'Biggest past event' : 'Players at once across your events'}
          </dt>
          <dd className="mt-0.5 text-[15px]">
            {meter ? (
              <>
                <b>{fmt(players)}</b>
                {cap != null ? ` / ${fmt(cap)} players` : ' players (no cap)'}
                {meter.peakEvents.length > 1 && (
                  <span className="text-text-muted"> · {meter.peakEvents.map((e) => e.name).join(' + ')} overlap</span>
                )}
                {meter.peakEvents.length === 1 && <span className="text-text-muted"> · {meter.peakEvents[0].name}</span>}
              </>
            ) : (
              'No events yet'
            )}
          </dd>
          {cap != null && meter && (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-brown-dark" aria-hidden>
              <span className={`block h-full ${card.over ? 'bg-gold' : 'bg-accent-green-light'}`} style={{ width: `${pct}%` }} />
            </div>
          )}
          <p className="mt-1.5 text-[12.5px] leading-snug text-text-muted">
            Counted per event they’re in. Events whose dates overlap share this; events apart get it each.
          </p>
          {meter && meter.events.length > 1 && (
            <ul className="mt-2 grid gap-0.5 text-[13px] text-text-muted">
              {meter.events.slice(0, 6).map((e) => (
                <li key={`${e.name}-${e.when}-${e.players}`}>
                  {e.name}: <span className="text-foreground">{fmt(e.players)}</span>
                  {e.when === 'draft' ? ' (no dates yet)' : e.when === 'upcoming' ? ' (upcoming)' : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <dt className="text-[13px] text-text-muted">Events running at once</dt>
          <dd className="mt-0.5 text-[15px]">
            {liveLimit != null ? `${live} of ${liveLimit}` : `${live} (no limit)`}
          </dd>
        </div>
      </dl>

      {card.over && (
        <p className="mt-3 text-[13.5px] leading-relaxed text-text-muted">
          {card.enforced
            ? `You're over your plan's players at once: new players can't join events running at the same time. ${next ? `Upgrade to ${next.name} for ${fmt(next.playersPerEvent ?? 0)} players at once.` : 'Get in touch about a Partner plan.'}`
            : `That's more than ${card.planName} allows. Everyone still gets in while Anvil is growing; the limit starts later, with notice.`}
        </p>
      )}

      {next && paidCard.next && (
        <div className="mt-4 rounded-lg border border-gold/40 bg-gold/[0.05] p-4">
          <p className="text-[15px] font-semibold">
            {next.name}: ${next.priceUsd} a month
            {checkoutYearly && yearly != null && (
              <span className="font-normal text-text-muted"> or {usd(yearly)} a year (12 months for the price of 10)</span>
            )}
          </p>
          <EarlyBirdBadge className="mt-1.5" />
          <ul className="mt-1.5 grid gap-1 text-[13.5px] text-text-muted">
            <li>Up to {fmt(next.playersPerEvent ?? 0)} players at once across your events</li>
            {paidCard.next.perks.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            {offers.map((o) => {
              const wording = buyWording(o.buttons, {
                tierName: next.name,
                charge: chargeText(next.priceUsd ?? 0, o.interval),
                verb: o.interval === 'yearly' ? `Subscribe to ${next.name}, yearly` : `Subscribe to ${next.name}`,
              });
              return wording ? <BuyButtons key={o.interval} wording={wording} caption={offers.length > 1 ? (o.interval === 'yearly' ? 'Yearly' : 'Monthly') : null} className="w-full" /> : null;
            })}
            <ClanLink href={withBilling('/pricing#creators', billing)} className="text-[13px] text-gold hover:text-gold-light">
              Compare plans
            </ClanLink>
          </div>
        </div>
      )}
    </section>
  );
}
