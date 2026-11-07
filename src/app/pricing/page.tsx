import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { clans } from '@/db/schema';
import { isApexHost } from '@/lib/clanContext';
import { verifyUser } from '@/lib/auth';
import { ownedCreatorSpace } from '@/lib/clanCreate';
import { ensureClanCheckoutRef } from '@/lib/billing';
import { PLANS, checkoutUrl, type Plan } from '@/lib/plans';
import {
  CREATOR_CAPABILITY_MIN_PLAN,
  CREATOR_PLANS,
  CREATOR_PLAN_IDS,
  creatorCheckoutUrl,
  creatorCheckoutUrlWithRef,
  creatorPlanHasCapability,
  creatorPlanOf,
  type CreatorCapability,
  type CreatorPlan,
} from '@/lib/creatorCatalog';
import { creatorPricingCta, type CreatorCta, type CreatorCtaViewer } from '@/lib/creatorPricingCta';
import {
  parseBillingInterval,
  priceLine,
  usd,
  withBilling,
  yearlyPerMonthUsd,
  yearlyPriceUsd,
  type BillingInterval,
} from '@/lib/billingInterval';
import { freemiumEnforced } from '@/lib/entitlements';
import { SITE } from '@/lib/site';
import AnvilMark from '@/components/AnvilMark';
import ClanLink from '@/components/ClanLink';
import BillingSwitch from './BillingSwitch';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pricing — Anvil',
  description: `Free for clans up to ${PLANS.free.memberCap} members. Paid tiers scale with your roster, with a 30-day trial.`,
};

/**
 * /pricing — apex only.
 *
 * The one page whose numbers must not drift, so it renders `PLANS` directly rather than restating
 * them: the tiers, caps and prices here are the exact rows the provisioner and the Gumroad webhook
 * read, so a price is never a marketing figure someone has to remember to update. On a clan host
 * this is a 404 — pricing is a platform concern, not something a clan advertises on its own site.
 */
export default async function PricingPage({ searchParams }: { searchParams: Promise<{ billing?: string }> }) {
  if (!isApexHost((await headers()).get('host'))) notFound();
  // One Monthly / Yearly switch for the page, kept in the URL (?billing=yearly) so links can open it.
  const interval = parseBillingInterval((await searchParams).billing);

  // Who is looking decides the creator table's buttons (lib/creatorPricingCta): signed out, signed in
  // with no space, or the owner of one (one each, lib/creatorSpaces MAX_CREATOR_SPACES).
  const session = await verifyUser();
  const owned = session ? await ownedCreatorSpace(session.userId) : null;
  const ownedRow = owned
    ? await db.query.clans.findFirst({ where: eq(clans.id, owned.id), columns: { plan: true } })
    : null;
  const ownedPlan = owned ? creatorPlanOf(ownedRow?.plan) : null;
  // The same checkout the space's dashboard card offers: the creator tier's Gumroad link + the space's
  // ref. Only fetched (and, if missing, created — as the dashboard does) when a Free space could buy.
  const ref = owned && ownedPlan?.id === 'creator_free' ? await ensureClanCheckoutRef(owned.id) : null;
  const viewer: CreatorCtaViewer = {
    signedIn: session != null,
    space: owned && ownedPlan ? { slug: owned.slug, plan: ownedPlan.id } : null,
  };

  // The four buyable tiers, in order. `custom` is negotiated, not bought, so it gets a footnote
  // rather than a card — a card with no price reads as broken.
  const tiers = [PLANS.free, PLANS.bronze, PLANS.silver, PLANS.gold];
  const enforced = freemiumEnforced();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:py-16">
      <header className="relative mb-10 overflow-hidden text-center">
        <AnvilMark
          size={200}
          className="pointer-events-none absolute -top-12 left-1/2 hidden -translate-x-1/2 text-gold/[0.04] sm:block"
        />
        <p className="relative font-mono text-[10.5px] uppercase tracking-[0.22em] text-gold/85">Pricing</p>
        <h1 className="display display-lg relative mt-2 text-[clamp(1.8rem,4vw,2.4rem)] font-semibold [text-wrap:balance]">
          Free to start. Priced by how many you are.
        </h1>
        <p className="relative mx-auto mt-3 max-w-[54ch] text-[15.5px] leading-relaxed text-text-muted">
          Every tier runs every event format and watches every kind of tile. What you pay for is
          roster size, not features held hostage. Thirty-day trial on all of it.
        </p>
        {!enforced && (
          <p className="relative mx-auto mt-3 w-fit rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[13px] text-gold">
            Early access: every clan is free for now, whatever its size. No card needed.
          </p>
        )}
        <p className="relative mt-3 text-[13.5px]">
          <a href="#creators" className="text-gold hover:text-gold-light">
            Streamer or creator? See creator plans
          </a>
        </p>
        <div className="relative mt-5 flex justify-center">
          <BillingSwitch value={interval} />
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiers.map((t) => (
          <TierCard key={t.id} plan={t} enforced={enforced} interval={interval} />
        ))}
      </div>

      <p className="mt-6 text-center text-[13px] text-text-dim">
        Bigger than {PLANS.gold.capLabel.replace(/^Up to /, '')}?{' '}
        <ClanLink href="/clans/new" className="text-gold hover:text-gold-light">
          Start a clan
        </ClanLink>{' '}
        and get in touch — {PLANS.custom.name.toLowerCase()} plans are set by hand, never a form.
      </p>

      <section className="mt-14 rounded-2xl border border-card-border bg-card-bg p-6 sm:p-8">
        <div className="mb-1.5 flex items-center gap-2.5">
          <span className="molten h-5 w-1 shrink-0 rounded-sm" />
          <h2 className="text-[17px] font-semibold">The same in every tier</h2>
        </div>
        <p className="mb-5 ml-4 max-w-[62ch] text-[13.5px] text-text-muted">
          Nothing below is a paid unlock. The free tier runs a real event end to end.
        </p>
        <ul className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
          {[
            'Every event format — bingo, tile race, ladder, skill & boss weeks, clan-vs-clan',
            'The RuneLite plugin fills in every board automatically',
            'Discord login, announcements and slash commands in 15 languages',
            'Collection log and personal bests kept current between events',
            'One account follows you across every clan you join',
            'Your own site at /c/your-clan',
          ].map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-[13.5px]">
              <span className="mt-0.5 text-accent-green-light" aria-hidden>
                ✓
              </span>
              <span className="text-foreground/90">{f}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-8 text-center text-[12.5px] text-text-dim">
        Prices in USD, billed {interval === 'yearly' ? 'yearly (a year costs ten months)' : 'monthly'} through Gumroad, cancel anytime. Caps are active roster members —
        guests from other clans don&rsquo;t count against yours.
      </p>

      <CreatorPricing
        enforced={enforced}
        interval={interval}
        viewer={viewer}
        checkoutFor={(p) => creatorCheckoutUrlWithRef(p, ref, interval)}
        yearlyOffered={(p) => creatorCheckoutUrl(p, 'yearly') != null}
      />
    </div>
  );
}

function TierCard({ plan, enforced, interval }: { plan: Plan; enforced: boolean; interval: BillingInterval }) {
  const paid = plan.priceUsd != null && plan.priceUsd > 0;
  const yearly = interval === 'yearly' && paid;
  const price =
    plan.priceUsd === 0
      ? 'Free'
      : plan.priceUsd == null
        ? '—'
        : usd(yearly ? (yearlyPriceUsd(plan.priceUsd) ?? 0) : plan.priceUsd);
  // A paid start asks for a card only once caps bite. Yearly then needs its own checkout configured;
  // without one the card says so rather than quietly sending them to the monthly one.
  const paidStart = enforced && paid;
  const yearlyMissing = yearly && paidStart && checkoutUrl(plan, 'yearly') == null;
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-5 ${
        plan.popular ? 'border-gold/55 bg-gold/[0.04]' : 'border-card-border bg-card-bg'
      }`}
    >
      {plan.popular && (
        <span className="absolute -top-2.5 left-5 rounded-full bg-gold px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-brown-dark">
          Most clans
        </span>
      )}
      <h3 className="display text-[19px] font-semibold">{plan.name}</h3>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="font-mono text-[26px] font-medium tabular-nums tracking-tight">{price}</span>
        {paid && <span className="text-[12.5px] text-text-muted">{yearly ? '/yr' : '/mo'}</span>}
      </div>
      {yearly && plan.priceUsd != null && (
        <p className="text-[12px] text-text-muted">{usd(yearlyPerMonthUsd(plan.priceUsd))}/mo · two months free</p>
      )}
      <p className="mt-1 text-[12.5px] font-medium text-gold">{plan.capLabel}</p>
      <p className="mt-2.5 text-[13px] leading-relaxed text-text-muted">{plan.blurb}</p>

      <ul className="mt-4 flex flex-1 flex-col gap-1.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-[12.5px]">
            <span className="mt-0.5 text-text-dim" aria-hidden>
              ·
            </span>
            <span className="text-foreground/85">{f}</span>
          </li>
        ))}
      </ul>

      {/* Once caps bite, the tier (and ?billing=) rides along and the create form ends on its Gumroad
          checkout — that is where the trial starts. Until then every clan size is free, so no button
          asks for a card. */}
      {yearlyMissing ? (
        <span
          aria-disabled="true"
          className="mt-5 cursor-default rounded-lg border border-card-border px-4 py-2.5 text-center text-sm font-semibold text-text-dim opacity-60"
        >
          Yearly coming soon
        </span>
      ) : (
        <ClanLink
          href={paidStart ? withBilling(`/clans/new?plan=${plan.id}`, interval) : '/clans/new'}
          className={`mt-5 rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-colors ${
            plan.popular
              ? 'bg-gold text-brown-dark hover:bg-gold-light'
              : 'border border-card-border hover:border-gold/45'
          }`}
        >
          {paidStart ? 'Start 30-day trial' : 'Start free'}
        </ClanLink>
      )}
    </div>
  );
}

/**
 * "For streamers & creators" — the creator catalogue (lib/creatorCatalog), its own tiers and prices,
 * metered differently: a creator space has no roster, so the number is the players enrolled at once
 * across its events whose dates overlap (lib/creatorPlans, lib/concurrentSeats). Rendered from CREATOR_PLANS and CREATOR_CAPABILITY_MIN_PLAN, so the table cannot
 * drift from what is billed and enforced.
 */
function CreatorPricing({
  enforced,
  interval,
  viewer,
  checkoutFor,
  yearlyOffered,
}: {
  enforced: boolean;
  interval: BillingInterval;
  viewer: CreatorCtaViewer;
  checkoutFor: (p: CreatorPlan) => string | null;
  yearlyOffered: (p: CreatorPlan) => boolean;
}) {
  const cols = CREATOR_PLAN_IDS.map((id) => CREATOR_PLANS[id]);
  const has = (p: CreatorPlan, c: CreatorCapability) => creatorPlanHasCapability(p, c);
  const yes = 'Yes';
  const rows: { label: string; cell: (p: CreatorPlan) => string }[] = [
    {
      label: 'Price',
      cell: (p) => (p.priceUsd == null ? 'Talk to us' : p.priceUsd === 0 ? 'Free' : priceLine(p.priceUsd, interval)),
    },
    {
      label: 'Players at once across your events',
      cell: (p) => (p.playersPerEvent == null ? 'No cap' : p.playersPerEvent.toLocaleString('en-US')),
    },
    { label: 'Events running at once', cell: (p) => (has(p, 'concurrent-events') ? 'Several' : '1') },
    { label: 'Only people with a Discord role or boost', cell: () => yes },
    { label: 'Only your Twitch followers or subs (by tier)', cell: (p) => (has(p, 'stream-gates') ? yes : '—') },
    { label: 'Only your Kick followers or subs (any sub)', cell: (p) => (has(p, 'stream-gates') ? yes : '—') },
    { label: 'Only your YouTube subscribers or members', cell: (p) => (has(p, 'stream-gates') ? yes : '—') },
    { label: 'OBS overlay', cell: (p) => (has(p, 'overlay-unbranded') ? 'Yes, “Powered by Anvil” badge optional' : 'Yes, with a small “Powered by Anvil” badge') },
    { label: '!join in your Twitch or Kick chat', cell: (p) => (has(p, 'chat-join-bot') ? yes : '—') },
    { label: 'Listed on Anvil (if you want)', cell: (p) => (has(p, 'featured-listing') ? 'Featured first' : yes) },
  ];
  const ctas = cols.map((p) => ({
    id: p.id,
    cta: creatorPricingCta(p, viewer, { enforced, interval, checkoutFor, yearlyOffered, contactUrl: SITE.supportDiscord }),
  }));
  return (
    <section id="creators" className="mt-16 scroll-mt-24">
      <div className="mb-1.5 flex items-center gap-2.5">
        <span className="molten h-5 w-1 shrink-0 rounded-sm" />
        <h2 className="text-[20px] font-semibold">For streamers &amp; creators</h2>
      </div>
      <p className="mb-5 ml-4 max-w-[66ch] text-[13.5px] text-text-muted">
        Host events for your viewers without an in-game clan. Creator plans count the players in your
        events running at the same time, not everyone who ever joined. Events that overlap share the
        number; events on different dates get it each. Someone in two overlapping events counts twice.
        {!enforced && ' Early access: every creator gets all of this free for now.'}
      </p>
      <div className="overflow-x-auto overflow-y-hidden rounded-2xl border border-card-border bg-card-bg">
        <table className="w-full min-w-[640px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-card-border">
              <th className="px-4 py-3 font-medium text-text-muted" scope="col">
                <span className="sr-only">Feature</span>
              </th>
              {cols.map((p) => (
                <th key={p.id} scope="col" className="px-3 py-3 font-semibold">
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-card-border/60 first:border-t-0">
                <th scope="row" className="px-4 py-2.5 font-normal text-foreground/90">
                  {r.label}
                </th>
                {cols.map((p) => (
                  <td key={p.id} className="px-3 py-2.5 tabular-nums text-text-muted">
                    {r.cell(p)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {/* One action per column, the same steps as the clan cards above (lib/creatorPricingCta). */}
          <tfoot>
            <tr className="border-t border-card-border">
              <th scope="row" className="px-4 py-3">
                <span className="sr-only">Get this plan</span>
              </th>
              {ctas.map(({ id, cta }) => (
                <td key={id} className="px-3 py-3 align-top">
                  <CreatorCtaButton cta={cta} />
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-3 text-center text-[12.5px] text-text-dim">
        Each platform needs your channel connected. Follower, sub and member checks start at{' '}
        {CREATOR_PLANS[CREATOR_CAPABILITY_MIN_PLAN['stream-gates']].name}.{' '}
        {CREATOR_PLANS.creator_partner.name} plans are set by hand.{' '}
        <ClanLink href="/host" className="text-gold hover:text-gold-light">
          Start a creator space
        </ClanLink>
      </p>
    </section>
  );
}

/** A creator column's button, styled like the clan cards' (gold for the lead, outlined otherwise). */
function CreatorCtaButton({ cta }: { cta: CreatorCta }) {
  const base = 'block whitespace-nowrap rounded-lg px-3 py-2 text-center text-[13px] font-semibold transition-colors';
  if (cta.kind === 'inert') {
    return (
      <span aria-disabled="true" className={`${base} cursor-default border border-card-border text-text-dim opacity-60`}>
        {cta.label}
      </span>
    );
  }
  const look = cta.primary ? 'bg-gold text-brown-dark hover:bg-gold-light' : 'border border-card-border hover:border-gold/45';
  if (cta.kind === 'external') {
    const offSite = !cta.href.startsWith('/');
    return (
      <a
        // eslint-disable-next-line clan-scope/clan-prefix -- Gumroad checkout or the Anvil Discord, never a clan path
        href={cta.href}
        {...(offSite && cta.label === 'Talk to us' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className={`${base} ${look}`}
      >
        {cta.label}
      </a>
    );
  }
  return (
    <ClanLink href={cta.href} className={`${base} ${look}`}>
      {cta.label}
    </ClanLink>
  );
}
