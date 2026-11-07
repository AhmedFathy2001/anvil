import { and, eq, isNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clanMemberships } from '@/db/schema';
import ClanLink from '@/components/ClanLink';
import { ensureClanCheckoutRef } from '@/lib/billing';
import { requireClan } from '@/lib/clanContext';
import { freemiumEnforced } from '@/lib/entitlements';
import { PLANS, checkoutUrlWithRef, planOf, type Plan } from '@/lib/plans';
import { SITE } from '@/lib/site';
import { parseBillingInterval, usd, withBilling, yearlyPriceUsd } from '@/lib/billingInterval';
import { redirect } from 'next/navigation';
import { clanHref } from '@/lib/clanPath';
import { isCreatorSpace } from '@/lib/creatorSpaces';

export const dynamic = 'force-dynamic';

/**
 * Plan and billing, inside the clan's own admin.
 *
 * It used to live only at /portal, reached from the owner's profile → "Manage billing", which is
 * where nobody running a clan looks. The tone is AWARENESS, not a paywall: Anvil is free for small
 * clans, and the big ones are what keep it running. Nothing here takes anything away from anybody.
 */
export default async function AdminPlanPage({ searchParams }: { searchParams: Promise<{ billing?: string }> }) {
  const clan = await requireClan();
  const billing = parseBillingInterval((await searchParams).billing);
  // A creator space is billed from its own catalogue, on its dashboard's plan card — never offered the
  // clan tiers this page sells (lib/creatorCatalog).
  if (isCreatorSpace(clan)) redirect(await clanHref('/admin/dashboard#plan'));
  // clan-scope: the page's own clan.
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(clanMemberships)
    .where(and(eq(clanMemberships.clanId, clan.id), eq(clanMemberships.kind, 'member'), isNull(clanMemberships.leftAt)));
  const members = row?.n ?? 0;
  const plan = planOf(clan.plan);
  const free = PLANS.free;
  const freeCap = free.memberCap ?? 0;
  const paying = plan.id !== 'free';
  // The smallest plan that holds this roster — the one worth showing, rather than a price table.
  const fits: Plan | null =
    (['bronze', 'silver', 'gold'] as const).map((id) => PLANS[id]).find((p) => (p.memberCap ?? Infinity) >= members) ?? PLANS.gold;
  const ref = paying ? null : await ensureClanCheckoutRef(clan.id);
  const checkout = fits && ref ? checkoutUrlWithRef(fits, ref) : null;
  // Yearly = ten months (lib/billingInterval), offered only once that tier's yearly checkout is set.
  const checkoutYearly = fits && ref ? checkoutUrlWithRef(fits, ref, 'yearly') : null;
  const yearly = fits ? yearlyPriceUsd(fits.priceUsd) : null;
  const buys = [
    checkout && { href: checkout, label: `Choose ${fits?.name}`, interval: 'monthly' as const },
    checkoutYearly && { href: checkoutYearly, label: `${fits?.name} yearly (${usd(yearly ?? 0)})`, interval: 'yearly' as const },
  ]
    .filter((b): b is { href: string; label: string; interval: 'monthly' | 'yearly' } => !!b)
    .sort((a, b) => (a.interval === billing ? -1 : b.interval === billing ? 1 : 0));
  const cap = plan.memberCap;
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
            {plan.name} plan · {members.toLocaleString()} member{members === 1 ? '' : 's'}
          </span>
          <span className="text-[13.5px] text-text-muted">{plan.capLabel}</span>
        </div>
        <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-brown-dark" aria-hidden>
          <span className="bg-accent-green-light" style={{ width: `${usedPct}%` }} />
          {over && <span className="flex-1 bg-gold/50" />}
        </div>
        <p className="mt-3 text-[13.5px] leading-relaxed text-text-muted">
          {!over
            ? 'Your clan fits its plan.'
            : freemiumEnforced()
              ? `You're ${(members - (cap ?? 0)).toLocaleString()} over. Everyone already tracked stays tracked; a bigger plan makes room for the rest.`
              : `Everyone is still tracked while Anvil grows, so nobody in your clan loses anything today. The ${cap} limit will apply later, with notice. A plan is how a clan this size helps pay for the servers it uses.`}
        </p>
      </section>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {paying ? (
          <section className="rounded-xl border border-gold/45 bg-gold/[0.05] p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-gold">Thank you</p>
            <h2 className="mt-1 text-xl font-semibold">You&rsquo;re on {plan.name}</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-text-muted">
              Your plan keeps Anvil running for every small clan that can&rsquo;t pay. Change it or see invoices any
              time.
            </p>
            <ClanLink href="/portal" className="mt-4 inline-block text-[14px] text-gold hover:text-gold-light">
              Manage subscription and invoices
            </ClanLink>
          </section>
        ) : (
          fits && (
            <section className="flex flex-col gap-3 rounded-xl border border-gold/45 bg-gradient-to-b from-card-bg-hover to-card-bg p-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-gold">
                {over ? 'Fits your clan' : 'When you grow'}
              </p>
              <h2 className="text-xl font-semibold">
                {fits.name} · {fits.capLabel.toLowerCase()}
              </h2>
              <p className="text-[14px] text-text-muted">
                From ${fits.priceUsd} a month
                {checkoutYearly && yearly != null && <> or {usd(yearly)} a year (two months free)</>}
              </p>
              <ul className="grid gap-1 text-[13.5px] text-text-muted">
                {fits.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              {buys.map((b, i) => (
                <a
                  key={b.interval}
                  // eslint-disable-next-line clan-scope/clan-prefix -- external Gumroad checkout, never a clan path
                  href={b.href}
                  className={
                    i === 0
                      ? 'mt-1 rounded-lg bg-gold px-4 py-2.5 text-center text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light'
                      : 'rounded-lg border border-gold/40 px-4 py-2.5 text-center text-sm text-gold transition-colors hover:border-gold'
                  }
                >
                  {b.label}
                </a>
              ))}
              <ClanLink href={withBilling('/pricing', billing)} className="text-center text-[13px] text-gold hover:text-gold-light">
                Compare all plans
              </ClanLink>
            </section>
          )
        )}

        <section className="flex flex-col gap-3 rounded-xl border border-card-border bg-card-bg p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-dim">Or share it · soon</p>
          <h2 className="text-xl font-semibold">A clan fund</h2>
          <p className="text-[14px] leading-relaxed text-text-muted">
            Members who want to will be able to chip in once a year, from $6. You top up whatever&rsquo;s left, or
            nothing if they cover it. Coming soon.
          </p>
        </section>
      </div>

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
