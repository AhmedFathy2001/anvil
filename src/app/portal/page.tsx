import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { clans, clanMemberships, clanStaff } from '@/db/schema';
import { isApexHost } from '@/lib/clanContext';
import { verifyUser } from '@/lib/auth';
import { billingStatus, subscriptionFacts } from '@/lib/clanBilling';
import { PLANS, PLAN_IDS, planOf, checkoutUrl, checkoutUrlWithRef, overMemberCap, TRIAL_DAYS, type Plan } from '@/lib/plans';
import AnvilMark from '@/components/AnvilMark';
import ClanLink from '@/components/ClanLink';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Billing — Anvil',
  description: 'The clans you own and their subscriptions.',
};

/**
 * /portal — your clans and their billing, apex only.
 *
 * Discord login, the same identity as everything else — the payer IS a member, so there is no
 * second account to reconcile and no second auth surface to secure. Ownership is a `clan_staff` row
 * with role 'owner', which is the same fact that lets them into the clan's admin; billing is just
 * another view of it.
 *
 * A READ dashboard plus links out. Gumroad is the merchant of record: it owns the card, the renewal
 * and the cancel, so this never touches money — it shows what tier each clan is on, whether a trial
 * is running, whether the roster has outgrown the plan, and sends you to Gumroad's own checkout to
 * change it. Anything else would be reimplementing a payment processor we deliberately do not run.
 */
export default async function PortalPage() {
  if (!isApexHost((await headers()).get('host'))) notFound();

  const session = await verifyUser();
  if (!session?.userId) redirect('/login?return=%2Fportal');

  // Clans this person OWNS. Not staffs — owns. Billing is the owner's alone; a moderator runs the
  // events, not the subscription.
  const owned = await db
    .select({
      id: clans.id,
      slug: clans.slug,
      name: clans.name,
      plan: clans.plan,
      trialEndsAt: clans.trialEndsAt,
      currentPeriodEnd: clans.currentPeriodEnd,
      cancelAtPeriodEnd: clans.cancelAtPeriodEnd,
      subscriptionId: clans.gumroadSubscriptionId,
      gumroadRef: clans.gumroadRef,
    })
    .from(clanStaff)
    .innerJoin(clans, eq(clans.id, clanStaff.clanId))
    .where(and(eq(clanStaff.userId, session.userId), eq(clanStaff.role, 'owner')))
    .orderBy(clans.name);

  // Active member seats per clan, in one grouped pass rather than a query per clan.
  const counts = new Map<number, number>();
  if (owned.length > 0) {
    const rows = await db
      .select({ clanId: clanMemberships.clanId })
      .from(clanMemberships)
      .where(and(eq(clanMemberships.kind, 'member'), isNull(clanMemberships.leftAt)));
    for (const r of rows) counts.set(r.clanId, (counts.get(r.clanId) ?? 0) + 1);
  }

  const nowMs = Date.now();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
      <header className="relative mb-9 overflow-hidden">
        <AnvilMark
          size={170}
          className="pointer-events-none absolute -top-9 right-0 hidden text-gold/[0.05] sm:block"
        />
        <p className="relative font-mono text-[10.5px] uppercase tracking-[0.22em] text-gold/85">Billing</p>
        <h1 className="display display-lg relative mt-2 text-[clamp(1.7rem,4vw,2.15rem)] font-semibold">
          Your clans
        </h1>
        <p className="relative mt-2.5 max-w-[56ch] text-[15px] leading-relaxed text-text-muted">
          Every clan you own, and what it&rsquo;s on. Payments run through Gumroad — change a plan there
          and it updates here within a minute.
        </p>
      </header>

      {owned.length === 0 ? (
        <div className="rounded-2xl border border-card-border bg-card-bg p-7">
          <h2 className="display text-lg font-semibold">You don&rsquo;t own a clan yet</h2>
          <p className="mt-2 max-w-[52ch] text-[14px] leading-relaxed text-text-muted">
            Start one free — every tier runs a real event, and you only pay when your roster outgrows
            the free cap.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <ClanLink
              href="/clans/new"
              className="rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light"
            >
              Start a clan
            </ClanLink>
            <ClanLink
              href="/pricing"
              className="rounded-lg border border-card-border px-4 py-2.5 text-sm transition-colors hover:border-gold/45"
            >
              See pricing
            </ClanLink>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {owned.map((c) => {
            const plan = planOf(c.plan);
            const members = counts.get(c.id) ?? 0;
            const overCap = overMemberCap(plan, members);
            const trialMs = c.trialEndsAt ? Date.parse(c.trialEndsAt) : NaN;
            const onTrial = Number.isFinite(trialMs) && trialMs > nowMs;
            const trialDaysLeft = onTrial ? Math.ceil((trialMs - nowMs) / 86_400_000) : 0;
            const { state } = billingStatus(
              { plan: c.plan, trialEndsAt: c.trialEndsAt, currentPeriodEnd: c.currentPeriodEnd, cancelAtPeriodEnd: c.cancelAtPeriodEnd, ...subscriptionFacts(c.subscriptionId, c.plan) },
              nowMs,
            );
            return (
              <ClanBillingCard
                key={c.id}
                slug={c.slug}
                name={c.name}
                plan={plan}
                members={members}
                overCap={overCap}
                onTrial={onTrial}
                trialDaysLeft={trialDaysLeft}
                hasSubscription={!!c.subscriptionId && c.plan !== 'free'}
                lapsed={state === 'ended' || state === 'lapsed'}
                subscriptionId={c.subscriptionId}
                checkoutRef={c.gumroadRef}
              />
            );
          })}
        </div>
      )}

      <p className="mt-8 text-center text-[12.5px] text-text-dim">
        {owned.some((c) => c.subscriptionId)
          ? 'Manage or cancel a subscription with Manage on Gumroad above, or from the receipt Gumroad emailed you.'
          : 'Subscriptions are managed on Gumroad, from the receipt it emails you.'}
        Anvil never sees your card — Gumroad is the merchant of record.
      </p>
    </div>
  );
}

function ClanBillingCard({
  slug,
  name,
  plan,
  members,
  overCap,
  onTrial,
  trialDaysLeft,
  hasSubscription,
  lapsed,
  subscriptionId,
  checkoutRef,
}: {
  slug: string;
  name: string;
  plan: Plan;
  members: number;
  overCap: boolean;
  onTrial: boolean;
  trialDaysLeft: number;
  hasSubscription: boolean;
  /** Its membership stopped being paid — a failed card or an end — or the renewal is overdue. */
  lapsed: boolean;
  /** The Gumroad membership behind it, ended or not — its manage page updates the card, cancels or restarts. */
  subscriptionId: string | null;
  checkoutRef: string | null;
}) {
  const paid = PLAN_IDS.map((id) => PLANS[id]).filter((p) => p.memberCap != null && checkoutUrl(p));
  // What "upgrade" points at: the smallest tier that holds the roster when it has outgrown this one
  // (a lapsed Silver clan of 296 dropped to free needs Silver, not the next step, Bronze), else the
  // next tier up.
  const fits = paid.find((p) => p.memberCap! >= members);
  // A new membership whose free trial is running while the clan stays on free: the trial is once per
  // clan (webhooks/gumroad), so the plan starts with the first payment, when the trial ends.
  const held = onTrial && plan.priceUsd === 0 && !!subscriptionId;
  // An overdue clan still on its paid plan renews that plan.
  const renewing = lapsed && plan.priceUsd !== 0 && paid.includes(plan);
  const higher = renewing ? plan : overCap && fits ? fits : paid.find((p) => plan.memberCap != null && p.memberCap! > plan.memberCap);
  const cap = plan.memberCap == null ? '∞' : plan.memberCap.toLocaleString();

  return (
    <div className="rounded-2xl border border-card-border bg-card-bg p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="display text-[18px] font-semibold">{name}</h2>
            <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[11px] font-semibold text-gold">
              {plan.name}
            </span>
            {onTrial && !held && (
              <span className="rounded-full bg-accent-green/15 px-2 py-0.5 text-[11px] font-medium text-accent-green-light">
                Trial · {trialDaysLeft}d left
              </span>
            )}
          </div>
          <p className="mt-1 font-mono text-[12.5px] text-text-muted">
            {members.toLocaleString()} / {cap} members
            {plan.priceUsd != null && plan.priceUsd > 0 && (
              <> · ${plan.priceUsd.toFixed(2)}/mo</>
            )}
          </p>
        </div>
        <ClanLink
          href={`/c/${slug}/admin`}
          className="shrink-0 rounded-lg border border-card-border px-3 py-1.5 text-[13px] transition-colors hover:border-gold/45"
        >
          Open admin
        </ClanLink>
      </div>

      {held && (
        <div className="mt-3 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-[12.5px] text-gold-light">
          Your new membership starts with its first payment, in {trialDaysLeft} day{trialDaysLeft === 1 ? '' : 's'}.
          The free trial is once per clan, and this clan has had one. To start now, cancel this one under
          Manage on Gumroad and ask us for a link without the trial.
        </div>
      )}

      {lapsed && (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12.5px] text-red-300">
          {plan.priceUsd === 0
            ? 'Your paid membership ended — the last payment didn\u2019t go through.'
            : 'Your renewal is overdue — the last payment didn\u2019t go through.'}{' '}
          Nothing is deleted. Update your card under Manage on Gumroad, or subscribe again below.
        </div>
      )}

      {overCap && (
        <div className="mt-3 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-[12.5px] text-orange-300">
          This roster is over the {plan.name} cap of {cap}. Nothing breaks and nobody is removed — but
          the next tier gives you room.
        </div>
      )}

      {higher && !held && (
        <div className="mt-3.5 flex items-center gap-2">
          <a
            href={checkoutUrlWithRef(higher, checkoutRef)!}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-gold px-3.5 py-1.5 text-[13px] font-semibold text-brown-dark transition-colors hover:bg-gold-light"
          >
            {renewing ? `Renew ${higher.name}` : lapsed ? `Subscribe to ${higher.name}` : onTrial || !hasSubscription ? `Upgrade to ${higher.name}` : `Move to ${higher.name}`}
          </a>
          <span className="text-[12px] text-text-dim">up to {higher.memberCap?.toLocaleString()} members</span>
        </div>
      )}

      {subscriptionId && (
        <p className="mt-3 text-[12.5px] text-text-dim">
          <a
            // Gumroad's own page for this membership: card, cancel, restart. It signs the buyer in by
            // emailing a link to the address they PAID with, which may not be the one Anvil has.
            href={`https://gumroad.com/subscriptions/${subscriptionId}/manage`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-gold hover:underline"
          >
            Manage on Gumroad
          </a>{' '}
          — update the card or cancel. Gumroad emails a sign-in link to the address you paid with.
        </p>
      )}

      {!higher && plan.priceUsd === 0 && !onTrial && (
        <p className="mt-3 text-[12.5px] text-text-dim">
          On the free tier. Your {TRIAL_DAYS}-day trial of the paid tiers is available whenever your
          roster needs it.
        </p>
      )}
    </div>
  );
}
