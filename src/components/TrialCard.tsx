'use client';

import { useEffect, useState } from 'react';


/** A date as "14 Mar 2027" in the reader's own time zone (UTC on the server and until mounted). */
function useLocalDay(ms: number): string {
  const fmt = (timeZone?: string) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone });
  const [text, setText] = useState(() => fmt('UTC'));
  useEffect(() => setText(fmt()), [ms]); // eslint-disable-line react-hooks/exhaustive-deps -- fmt only reads ms
  return text;
}

export interface TrialCardProps {
  /** "Gold", "Champion". */
  tierName: string;
  /** "clan", "space" or "you": whose trial it is, for the sentences. */
  who: 'clan' | 'space' | 'you';
  endsAt: number;
  /** lib/planTrialRules trialPhase: running, last-days or just-ended. */
  phase: 'running' | 'last-days' | 'just-ended';
  daysLeft: number;
  /** What they keep, and what they lose, when it ends: plain sentences. */
  keeps: string;
  loses: string;
  /** Where "Keep / Subscribe" goes: a checkout, or null with `soon` when the pay-now link is not set up, or neither (no checkout at all). */
  href: string | null;
  soon: boolean;
  /** "$14.99", charged today, and then every `every`. */
  chargeToday: string;
  every: 'month' | 'year';
  /** POST here records "Remind me when the trial ends"; null hides it. */
  remindUrl: string | null;
  remindRequested: boolean;
  /** Under a full plan page this is the page's own section; elsewhere a link to it. */
  planHref?: string | null;
  /** The early-bird line (components/EarlyBirdBadge), passed in from the server page. */
  children?: React.ReactNode;
  /** Only shown to platform staff: why there is no checkout. */
  staffNote?: string | null;
}

/**
 * A trial from Anvil, as the person on it sees it: the tier, that it is a trial, the exact end date
 * in their own time zone, what they keep and lose, and ONE primary action.
 *
 *   running      "Keep Gold after 14 Mar 2027"   charged today if pressed; "Remind me" beside it
 *   last-days    "Subscribe to keep Gold"
 *   just-ended   "Your trial ended on 14 Mar 2027. Subscribe to get Gold back."
 *
 * The button opens the tier's PAY-NOW checkout (no second free period): Gumroad charges at the moment
 * of purchase and then on its own recurring schedule. The site cannot make Gumroad start a membership
 * on a chosen future date, so paying early is said plainly; everyone is reminded three days before the end (lib/trialReminders).
 */
export default function TrialCard(p: TrialCardProps) {
  const day = useLocalDay(p.endsAt);
  const over = p.phase === 'just-ended';
  const has = p.who === 'you' ? 'You have' : `Your ${p.who} has`;
  const label = over ? `Subscribe to get ${p.tierName} back` : p.phase === 'last-days' ? `Subscribe to keep ${p.tierName}` : `Keep ${p.tierName} after ${day}`;
  const left = `${p.daysLeft} day${p.daysLeft === 1 ? '' : 's'}`;

  return (
    <section id="trial" className="scroll-mt-24 rounded-xl border border-gold/45 bg-gold/[0.05] p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-semibold">{over ? `Your ${p.tierName} trial ended` : `${p.tierName} trial`}</h2>
        {!over && (
          <span className="rounded-full bg-accent-green/15 px-2 py-0.5 text-[11px] font-medium text-accent-green-light">
            Trial · {left} left
          </span>
        )}
      </div>
      <p className="mt-2 text-[14px] leading-relaxed text-foreground/90">
        {over ? (
          <>
            Your trial ended on <b>{day}</b>. Subscribe to get {p.tierName} back.
          </>
        ) : (
          <>
            {has} {p.tierName} until <b>{day}</b>. This is a trial from Anvil: no card was asked for and nothing is charged.
          </>
        )}
      </p>
      <p className="mt-2 text-[13.5px] leading-relaxed text-text-muted">
        <b className="font-medium text-foreground/90">{over ? 'You kept:' : 'You keep:'}</b> {p.keeps}{' '}
        <b className="font-medium text-foreground/90">{over ? 'What ended:' : 'When it ends:'}</b> {p.loses}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {p.href ? (
          <a
            // eslint-disable-next-line clan-scope/clan-prefix -- a Gumroad checkout or the site's own checkout route, never a clan path
            href={p.href}
            className="rounded-lg bg-gold px-4 py-2.5 text-center text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light"
          >
            {label}
          </a>
        ) : p.soon ? (
          <span aria-disabled="true" className="cursor-default rounded-lg border border-card-border px-4 py-2.5 text-center text-sm font-semibold text-text-dim">
            Subscribing opens soon
          </span>
        ) : null}
        {/* Everyone is reminded now (lib/trialReminders), so there is nothing to ask for. */}
        {p.phase === 'running' && (
          <span className="self-center text-sm text-text-muted">
            We&rsquo;ll remind you 3 days before it ends: a notice here on Anvil, and a Discord message if you have said yes to those.
          </span>
        )}
      </div>
      {p.href && (
        <p className="mt-2 text-[12.5px] leading-relaxed text-text-muted">
          {p.phase === 'running'
            ? `Paying now starts your paid ${p.every} today: you'll be charged ${p.chargeToday}, then ${p.chargeToday} every ${p.every}. Your trial runs until ${day} (${left} left); to use all of it, subscribe on the day. We'll remind you 3 days before.`
            : `You'll be charged ${p.chargeToday} the day you subscribe, then every ${p.every}.`}
        </p>
      )}
      {!p.href && p.soon && (
        <p className="mt-2 text-[12.5px] leading-relaxed text-text-muted">
          The checkout for {p.tierName} is not open yet. Ask in the Anvil Discord and we will tell you when it is. Nothing is
          charged in the meantime.
        </p>
      )}
      {p.staffNote && <p className="mt-2 text-[12px] text-text-dim">Staff: {p.staffNote}</p>}
      {p.children && <div className="mt-3">{p.children}</div>}
      {p.planHref && (
        <p className="mt-3 text-[13px]">
          {/* eslint-disable-next-line clan-scope/clan-prefix -- built by the server page for this clan */}
          <a href={p.planHref} className="text-gold hover:text-gold-light">
            See all plans
          </a>
        </p>
      )}
    </section>
  );
}
