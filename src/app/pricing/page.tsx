import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { isApexHost } from '@/lib/clanContext';
import { PLANS, type Plan } from '@/lib/plans';
import AnvilMark from '@/components/AnvilMark';
import ClanLink from '@/components/ClanLink';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pricing — Anvil',
  description: 'Free for your first event. Paid tiers scale with your roster. 30-day trial on everything.',
};

/**
 * /pricing — apex only.
 *
 * The one page whose numbers must not drift, so it renders `PLANS` directly rather than restating
 * them: the tiers, caps and prices here are the exact rows the provisioner and the Gumroad webhook
 * read, so a price is never a marketing figure someone has to remember to update. On a clan host
 * this is a 404 — pricing is a platform concern, not something a clan advertises on its own site.
 */
export default async function PricingPage() {
  if (!isApexHost((await headers()).get('host'))) notFound();

  // The four buyable tiers, in order. `custom` is negotiated, not bought, so it gets a footnote
  // rather than a card — a card with no price reads as broken.
  const tiers = [PLANS.free, PLANS.bronze, PLANS.silver, PLANS.gold];

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
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiers.map((t) => (
          <TierCard key={t.id} plan={t} />
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
        Prices in USD, billed monthly through Gumroad, cancel anytime. Caps are active roster members —
        guests from other clans don&rsquo;t count against yours.
      </p>
    </div>
  );
}

function TierCard({ plan }: { plan: Plan }) {
  const price =
    plan.priceUsd === 0 ? 'Free' : plan.priceUsd == null ? '—' : `$${plan.priceUsd.toFixed(2)}`;
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
        {plan.priceUsd != null && plan.priceUsd > 0 && (
          <span className="text-[12.5px] text-text-muted">/mo</span>
        )}
      </div>
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

      <ClanLink
        href="/clans/new"
        className={`mt-5 rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-colors ${
          plan.popular
            ? 'bg-gold text-brown-dark hover:bg-gold-light'
            : 'border border-card-border hover:border-gold/45'
        }`}
      >
        {plan.priceUsd === 0 ? 'Start free' : 'Start 30-day trial'}
      </ClanLink>
    </div>
  );
}
