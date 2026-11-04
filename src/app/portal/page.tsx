import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { isApexHost } from '@/lib/clanContext';
import { verifyUser } from '@/lib/auth';
import { billingPortalForUser } from '@/lib/billingPortal';
import type { BillingCardModel } from '@/lib/billingPortalCards';
import { YOUR_CLANS_HEADING, YOUR_SPACES_HEADING } from '@/lib/creatorSpaces';
import { SUPPORTER_TIERS, parseStamp, type SupporterState } from '@/lib/supporterTiers';
import AnvilMark from '@/components/AnvilMark';
import ClanLink from '@/components/ClanLink';
import CreatorChip from '@/components/CreatorChip';
import SupporterName from '@/components/SupporterName';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Billing — Anvil',
  description: 'Everything you pay for on Anvil: your clans, your creator spaces and your Supporter membership.',
};

/**
 * /portal — everything the signed-in person pays for on Anvil, apex only.
 *
 * Three things can be paid for, and each has its own catalogue: a clan's plan (lib/plans), a creator
 * space's plan (lib/creatorCatalog) and the person's own Anvil Supporter membership (lib/supporter).
 * Each section shows only when there is something in it; somebody with nothing sees the Supporter
 * offer and where to start a clan or a creator space.
 *
 * Discord login, the same identity as everything else — the payer IS a member, so there is no
 * second account to reconcile and no second auth surface to secure. Ownership is a `clan_staff` row
 * with role 'owner', which is the same fact that lets them into the clan's admin; billing is just
 * another view of it. Supporter belongs to the login itself.
 *
 * A READ dashboard plus links out. Gumroad is the merchant of record: it owns the card, the renewal
 * and the cancel, so this never touches money — it shows what each thing is on, whether a trial is
 * running, whether it has outgrown its tier, and sends you to Gumroad's own checkout (from the right
 * catalogue) to change it.
 */
export default async function PortalPage() {
  if (!isApexHost((await headers()).get('host'))) notFound();

  const session = await verifyUser();
  if (!session?.userId) redirect('/login?return=%2Fportal');

  const portal = await billingPortalForUser(session.userId);
  const ownsSomething = portal.clans.length > 0 || portal.spaces.length > 0;
  const anySubscription =
    [...portal.clans, ...portal.spaces].some((c) => c.subscriptionId) || !!portal.supporterSubscriptionId;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
      <header className="relative mb-9 overflow-hidden">
        <AnvilMark
          size={170}
          className="pointer-events-none absolute -top-9 right-0 hidden text-gold/[0.05] sm:block"
        />
        <h1 className="display display-lg relative text-[clamp(1.7rem,4vw,2.15rem)] font-semibold">Billing</h1>
        <p className="relative mt-2.5 max-w-[56ch] text-[15px] leading-relaxed text-text-muted">
          Everything you pay for on Anvil. Payments run through Gumroad — change something there and it
          updates here within a minute.
        </p>
      </header>

      <div className="flex flex-col gap-10">
        {portal.clans.length > 0 && (
          <Section title={YOUR_CLANS_HEADING}>
            {portal.clans.map((c) => (
              <PlanCard key={c.id} card={c} />
            ))}
          </Section>
        )}

        {portal.spaces.length > 0 && (
          <Section title={YOUR_SPACES_HEADING}>
            {portal.spaces.map((c) => (
              <PlanCard key={c.id} card={c} />
            ))}
          </Section>
        )}

        <Section title="Anvil Supporter">
          <SupporterCard state={portal.supporter} subscriptionId={portal.supporterSubscriptionId} />
        </Section>

        {!ownsSomething && <StartSomething />}
      </div>

      <p className="mt-10 text-center text-[12.5px] text-text-dim">
        {anySubscription
          ? 'Manage or cancel a subscription with Manage on Gumroad above, or from the receipt Gumroad emailed you. '
          : 'Subscriptions are managed on Gumroad, from the receipt it emails you. '}
        Anvil never sees your card — Gumroad is the merchant of record.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <span className="h-5 w-1 rounded-full bg-gold" aria-hidden />
        {title}
      </h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function ManageOnGumroad({ subscriptionId }: { subscriptionId: string }) {
  return (
    <p className="mt-3 text-[12.5px] text-text-dim">
      <a
        // Gumroad's own page for this membership: card, cancel, restart. It signs the buyer in by
        // emailing a link to the address they PAID with, which may not be the one Anvil has.
        href={`https://gumroad.com/subscriptions/${encodeURIComponent(subscriptionId)}/manage`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-gold hover:underline"
      >
        Manage on Gumroad
      </a>{' '}
      — update the card or cancel. Gumroad emails a sign-in link to the address you paid with.
    </p>
  );
}

/** One clan or creator space — the model (lib/billingPortalCards) already chose its catalogue. */
function PlanCard({ card }: { card: BillingCardModel }) {
  return (
    <div className="rounded-2xl border border-card-border bg-card-bg p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="display text-[18px] font-semibold">{card.name}</h3>
            {card.creator && <CreatorChip />}
            <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[11px] font-semibold text-gold">
              {card.tierName}
            </span>
            {card.onTrial && !card.held && (
              <span className="rounded-full bg-accent-green/15 px-2 py-0.5 text-[11px] font-medium text-accent-green-light">
                Trial · {card.trialDaysLeft}d left
              </span>
            )}
          </div>
          <p className="mt-1 font-mono text-[12.5px] text-text-muted">
            {card.meter}
            {card.priceUsd != null && card.priceUsd > 0 && <> · ${card.priceUsd.toFixed(2)}/mo</>}
          </p>
        </div>
        <ClanLink
          href={`/c/${card.slug}/admin`}
          className="shrink-0 rounded-lg border border-card-border px-3 py-1.5 text-[13px] transition-colors hover:border-gold/45"
        >
          Open admin
        </ClanLink>
      </div>

      {card.held && (
        <div className="mt-3 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-[12.5px] text-gold-light">
          Your new membership starts with its first payment, in {card.trialDaysLeft} day{card.trialDaysLeft === 1 ? '' : 's'}.
          The free trial is once per {card.creator ? 'space' : 'clan'}, and this one has had one. To start now, cancel
          this one under Manage on Gumroad and ask us for a link without the trial.
        </div>
      )}

      {card.lapsed && (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12.5px] text-red-300">
          {card.overdue
            ? 'Your renewal is overdue — the last payment didn’t go through.'
            : 'Your paid membership ended — the last payment didn’t go through.'}{' '}
          Nothing is deleted. Update your card under Manage on Gumroad, or subscribe again below.
        </div>
      )}

      {card.overLine && (
        <div className="mt-3 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-[12.5px] text-orange-300">
          {card.overLine}
        </div>
      )}

      {card.upgrade && (
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <a
            href={card.upgrade.href}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-gold px-3.5 py-1.5 text-[13px] font-semibold text-brown-dark transition-colors hover:bg-gold-light"
          >
            {card.upgrade.label}
          </a>
          <span className="text-[12px] text-text-dim">{card.upgrade.detail}</span>
        </div>
      )}

      {card.subscriptionId && <ManageOnGumroad subscriptionId={card.subscriptionId} />}

      {card.freeNote && <p className="mt-3 text-[12.5px] text-text-dim">{card.freeNote}</p>}
    </div>
  );
}

function formatDay(stamp: string | null): string | null {
  const ms = parseStamp(stamp);
  return Number.isNaN(ms) ? null : new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/** The person's own Supporter membership, or the offer when they have none. */
function SupporterCard({ state, subscriptionId }: { state: SupporterState | null; subscriptionId: string | null }) {
  if (!state) {
    const from = SUPPORTER_TIERS.supporter;
    return (
      <div className="rounded-2xl border border-card-border bg-card-bg p-5">
        <h3 className="display text-[18px] font-semibold">Become a Supporter</h3>
        <p className="mt-1.5 max-w-[56ch] text-[13.5px] leading-relaxed text-text-muted">
          Anvil is an indie project. Supporters keep it running and free for every clan, and get flair
          their clanmates can see and more room to host. From ${from.monthlyUsd} a month.
        </p>
        <div className="mt-4">
          <ClanLink
            href="/supporter"
            className="rounded-lg bg-gold px-3.5 py-1.5 text-[13px] font-semibold text-brown-dark transition-colors hover:bg-gold-light"
          >
            Become a Supporter
          </ClanLink>
        </div>
      </div>
    );
  }

  const since = formatDay(state.since);
  const renews = formatDay(state.renewsAt);
  const ends = formatDay(state.endsAt);
  const top = state.tier.id === 'patron';
  const how = state.gift ? 'A gift from Anvil' : state.earned ? 'Earned through invites' : null;
  const when = renews ? `Renews ${renews}` : ends ? `Ends ${ends}` : null;
  return (
    <div className="rounded-2xl border border-card-border bg-card-bg p-5">
      <div className="flex flex-wrap items-center gap-2">
        <SupporterName
          name={`Anvil ${state.tier.name}`}
          tier={state.tier.id}
          style={state.style}
          className="display text-[18px] font-semibold"
          plain
        />
      </div>
      <p className="mt-1 font-mono text-[12.5px] text-text-muted">
        {[how, when, since ? `Supporter since ${since}` : null].filter(Boolean).join(' · ')}
      </p>
      <div className="mt-3.5 flex flex-wrap items-center gap-3">
        <ClanLink
          href="/supporter"
          className={
            top
              ? 'rounded-lg border border-card-border px-3.5 py-1.5 text-[13px] transition-colors hover:border-gold/45'
              : 'rounded-lg bg-gold px-3.5 py-1.5 text-[13px] font-semibold text-brown-dark transition-colors hover:bg-gold-light'
          }
        >
          {top ? 'Your perks' : 'Upgrade'}
        </ClanLink>
      </div>
      {subscriptionId && <ManageOnGumroad subscriptionId={subscriptionId} />}
    </div>
  );
}

/** For somebody who owns nothing yet: where to start. */
function StartSomething() {
  return (
    <div className="rounded-2xl border border-card-border bg-card-bg p-6">
      <h2 className="display text-lg font-semibold">Run something on Anvil</h2>
      <p className="mt-2 max-w-[52ch] text-[14px] leading-relaxed text-text-muted">
        Start a clan, or host events for your viewers as a creator. Both start free — you only pay when
        you outgrow the free tier.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <ClanLink
          href="/clans/new"
          className="rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light"
        >
          Start a clan
        </ClanLink>
        <ClanLink
          href="/host"
          className="rounded-lg border border-card-border px-4 py-2.5 text-sm transition-colors hover:border-gold/45"
        >
          Host as a creator
        </ClanLink>
        <ClanLink
          href="/pricing"
          className="rounded-lg border border-card-border px-4 py-2.5 text-sm transition-colors hover:border-gold/45"
        >
          See pricing
        </ClanLink>
      </div>
    </div>
  );
}
