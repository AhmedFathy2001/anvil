'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import AnvilMark from '@/components/AnvilMark';
import ClanLink from '@/components/ClanLink';
import ConnectCard from '@/app/profile/ConnectCard';
import LinkAccountClient from '@/app/profile/LinkAccountClient';
import { clanPathOf } from '@/lib/clanScopedPaths'; // page.tsx passes clans only, never spaces
import { useTouchFirst } from '@/components/useTouchFirst';
import type { OnboardingIntent, OnboardingState } from '@/lib/onboarding';
import type { RailKey } from '@/lib/onboardingRail';

interface Props {
  state: OnboardingState;
  displayName: string;
  discordUsername: string | null;
  clans: { slug: string; name: string }[];
  /** RSNs already linked to this person: named in the plugin step, counted for its beacon. */
  characters: string[];
  /** Characters the plugin saw but could not link by itself, counted as the connection beacon counts them. */
  detectedCount?: number;
  /** An XP check was left running, so its fold opens on arrival. */
  xpCheckRunning?: boolean;
  /** Where they were heading when they first signed in (lib/firstLogin), or null. */
  next?: string | null;
}

/**
 * The flow. Three milestones, and the rail is the whole navigation — there is no next/back, because
 * a step is done when the world says so, not when somebody presses a button.
 *
 * That is also why this polls. Two of the three complete because of something that happens somewhere
 * else entirely: an admin approves you into a clan, or the plugin reports for the first time from a
 * game client on another screen. Asking somebody to reload until it works is how a setup flow gets
 * abandoned, so the page watches instead and moves on by itself.
 *
 * THE PLUGIN LEADS, and linking a character is not a step of its own. Installing the plugin and
 * signing in links the character by itself, so the step after Discord is the plugin, and the
 * 30-minute XP check sits folded under it for somebody who cannot run the plugin. It used to be the
 * other way round: the XP check second, the plugin last, and a new person was asked to do by hand
 * the thing the plugin does for them (lib/onboardingRail has the order and the done conditions).
 *
 * ONE QUESTION FIRST, and it is the only thing here that is asked rather than observed. The same
 * steps served three arrivals that want different things — somebody putting their clan on
 * Anvil, somebody joining the clan their friends already run, and somebody who wants neither and
 * came to track themselves — and all three were handed "Join a clan, or start one" as if founding
 * and applying were one act. The chooser splits them; everything after it is the same machinery
 * pointed somewhere else, including where finishing lands.
 */
export default function WelcomeClient({
  state: initial,
  displayName,
  discordUsername,
  clans,
  characters,
  detectedCount = 0,
  xpCheckRunning = false,
  next = null,
}: Props) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);
  // Re-opening the chooser is a local act, not a write: nulling the intent in state would be undone
  // by the next poll, and clearing it on the server would lose an answer somebody may keep.
  const [choosing, setChoosing] = useState(false);
  // Which step's panel is open. Follows the flow, but a person can look at any of them — the rail is
  // clickable, because "what do I still have to do" is a fair question at any point.
  const [open, setOpen] = useState<RailKey>(initial.current ?? 'plugin');

  // The XP check's fold. Null is "not touched": open when a check is already running (it would look
  // lost otherwise) and on a phone, where the plugin cannot be installed and this is the one thing
  // that can be done from here. Once somebody opens or closes it, that is what it stays.
  const touchFirst = useTouchFirst();
  const [manualChoice, setManualChoice] = useState<boolean | null>(null);
  const manualOpen = manualChoice ?? (xpCheckRunning || touchFirst);
  const manualRef = useRef<HTMLDivElement>(null);

  // Server state wins on every re-render: the parent re-renders when ConnectCard's beacon fires, and
  // the flow must follow the facts rather than whatever the client last believed.
  useEffect(() => {
    setState(initial);
  }, [initial]);

  // Follow the flow forward as steps complete, but never drag somebody off a panel they chose to
  // open — only move when the panel they are on is finished with.
  useEffect(() => {
    const step = state.rail.find((s) => s.key === open);
    if (step && (step.done || step.skipped) && state.current) setOpen(state.current);
  }, [state, open]);

  const post = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true);
      try {
        const res = await fetch('/api/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.ok) setState(await res.json());
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  // Steps finish somewhere else entirely — a join request approved, an invite accepted, a clan
  // created in another tab, or the plugin reporting from a game client on another screen. Poll while
  // any is outstanding and the tab is visible. The plugin card has its own faster beacon; this is
  // the one that also covers the clan, and the panels where that card is not on screen.
  const watching = state.rail.some((s) => !s.done);
  const seen = factsOf(state);
  useEffect(() => {
    if (!watching) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      if (!alive) return;
      if (document.visibilityState === 'visible') {
        try {
          const res = await fetch('/api/onboarding', { cache: 'no-store' });
          if (res.ok) {
            const next = (await res.json()) as OnboardingState;
            if (!alive) return;
            // The FACTS, not the count: a character linked by the XP check changes what the plugin
            // step says without ticking anything on the rail.
            if (factsOf(next) !== seen) {
              setState(next);
              router.refresh();
              return;
            }
          }
        } catch {
          /* a missed poll costs nothing — the next one covers it */
        }
      }
      timer = setTimeout(tick, 12_000);
    };
    timer = setTimeout(tick, 12_000);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [watching, seen, router]);

  // `markDone` false is "Finish later": leave without closing the flow, so /welcome still opens next time.
  async function finish(markDone = true) {
    if (markDone) await post({ action: 'complete' });
    // WHERE FINISHING LANDS IS PART OF THE ANSWER. A clan owner's next hour is the setup wizard, not
    // their own locker; a member wants the clan they just got into; somebody here for themselves
    // wants the page that is themselves. Falling back to the locker whenever there is no clan to
    // point at keeps the old destination for everyone the branches don't cover.
    // Bare /profile is the apex's person page, which spans their clans rather than being any one
    // clan's locker — the right end for somebody who has no clan, or did not come for one.
    // Somebody who signed in from a deep link goes back to it: that page is why they came.
    if (next) {
      router.push(next); // clan-prefix: platform -- the literal path they were on when they signed in
      return;
    }
    const clan = clans[0];
    if (state.intent === 'owner' && clan) router.push(clanPathOf({ slug: clan.slug }, '/admin/setup'));
    else if (state.intent === 'member' && clan) router.push(clanPathOf({ slug: clan.slug }));
    else router.push('/profile'); // clan-prefix: platform -- apex-only flow, apex person page
  }

  /** Answering the chooser. Also opens the step that answer makes the point of the flow. */
  async function chooseIntent(intent: OnboardingIntent) {
    await post({ action: 'intent', intent });
    setOpen(intent === 'solo' ? 'plugin' : 'clan');
  }

  /** "Verify by XP" on the plugin card: open the fold under it and bring it into view. */
  function openManual() {
    setManualChoice(true);
    requestAnimationFrame(() => manualRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  }

  const current = state.rail.find((s) => s.key === open) ?? state.rail[0];
  const index = state.rail.findIndex((s) => s.key === open);
  const clanStep = state.rail.find((s) => s.key === 'clan');
  // Off the fact rather than the list: legacy `guest:` rows are accounts but not characters.
  const hasCharacter = state.steps.find((s) => s.key === 'character')?.done ?? false;
  const named = characters.filter((c) => !c.startsWith('guest:'));

  // NOT ASKED YET, and nothing done that answers it for them. Somebody who already has a clan has
  // answered it by having one, and being asked "are you starting a clan?" over the top of a clan
  // they are already in would read as the page not knowing who they are.
  if (choosing || (state.intent == null && !clanStep?.done)) {
    return (
      <IntentChooser
        displayName={displayName}
        busy={busy}
        chosen={state.intent}
        next={next}
        onChoose={async (i) => {
          // The two big answers go straight to the thing they mean: no rail page in between.
          // Only "just me" opens the rail, because the plugin is its first step.
          if (i === 'solo') {
            await chooseIntent(i);
            setChoosing(false);
            return;
          }
          await post({ action: 'intent', intent: i });
          router.push(i === 'owner' ? '/clans/new' : '/clans'); // clan-prefix: platform -- apex-only flow
        }}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
      <header className="relative mb-8 overflow-hidden">
        <AnvilMark
          size={170}
          className="pointer-events-none absolute -top-8 right-0 hidden text-gold/[0.05] sm:block"
        />
        <p className="relative font-mono text-[10.5px] uppercase tracking-[0.2em] text-gold/85">
          Setting up
        </p>
        <h1 className="display display-lg relative mt-2 text-[clamp(1.6rem,4vw,2.05rem)] font-semibold">
          Welcome to Anvil, {displayName}
        </h1>
        <p className="relative mt-2.5 max-w-[58ch] text-[15px] leading-relaxed text-text-muted">
          {INTRO[state.intent ?? 'member']}
        </p>
        {state.intent && (
          // The answer is never a trap: the person who came to look and then founded a clan is the
          // ordinary story. Changing it re-opens the chooser rather than editing anything.
          <button
            type="button"
            onClick={() => setChoosing(true)}
            className="relative mt-2 text-[12.5px] text-text-dim underline-offset-4 hover:text-gold hover:underline"
          >
            {HERE_FOR[state.intent]} — change
          </button>
        )}
        <p className="relative mt-2 text-[12.5px] text-text-dim">
          {state.allSettled
            ? 'All set — every step is done or skipped.'
            : `${state.doneCount} of ${state.total} done`}
        </p>
        {next && <ContinueLink next={next} />}
      </header>

      <Rail steps={state.rail} open={open} onOpen={setOpen} />

      <section className="mt-7 rounded-2xl border border-card-border bg-card-bg p-5 sm:p-7">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-text-dim">
          Step {index + 1} of {state.total}
        </p>
        <h2 className="display mt-1.5 text-[20px] font-semibold">{current.title}</h2>
        <p className="mt-1.5 max-w-[62ch] text-[14px] leading-relaxed text-text-muted">{current.blurb}</p>

        <div className="mt-5">
          {current.key === 'discord' && (
            <Done>
              Signed in{discordUsername ? <> as <b className="text-foreground">@{discordUsername}</b></> : null}.
            </Done>
          )}

          {current.key === 'clan' &&
            (current.done ? (
              <Done>
                You&rsquo;re in {clans.length === 1 ? <b className="text-foreground">{clans[0].name}</b> : `${clans.length} clans`}.
              </Done>
            ) : (
              <>
                {/* THE SAME TWO DOORS, ORDERED BY WHAT THEY CAME FOR. Both stay reachable — somebody
                    who came to join and finds their clan is not here yet should be able to start it
                    — but which one is the button and which is the aside is the whole difference
                    between the three arrivals. */}
                <div className="flex flex-wrap gap-3">
                  {state.intent === 'owner' ? (
                    <>
                      <ClanLink
                        href="/clans/new"
                        className="rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light"
                      >
                        Start your clan
                      </ClanLink>
                      <ClanLink
                        href="/clans"
                        className="rounded-lg border border-card-border px-4 py-2.5 text-sm transition-colors hover:border-gold/45"
                      >
                        Check it isn&rsquo;t already here
                      </ClanLink>
                    </>
                  ) : (
                    <>
                      <ClanLink
                        href="/clans"
                        className="rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light"
                      >
                        Find your clan
                      </ClanLink>
                      <ClanLink
                        href="/clans/new"
                        className="rounded-lg border border-card-border px-4 py-2.5 text-sm transition-colors hover:border-gold/45"
                      >
                        Start one instead
                      </ClanLink>
                    </>
                  )}
                </div>
                {state.intent !== 'owner' && !hasCharacter && (
                  // A clan takes a request from a linked character, and the plugin step on this page
                  // is what links one: do it here rather than finding that out on the clan's page
                  // and being sent to Settings with no way back.
                  <p className="mt-3.5 text-[13px] text-text-muted">
                    A clan takes a request from a linked character.{' '}
                    <button type="button" onClick={() => setOpen('plugin')} className="font-semibold text-gold hover:text-gold-light">
                      Get the plugin first
                    </button>
                    : it links yours. Then come back to find the clan.
                  </p>
                )}
                <p className="mt-3.5 text-[13px] text-text-dim">
                  {state.intent === 'owner'
                    ? 'Free, and live the moment you press the button — nothing to approve, nothing to pay. This ticks the moment it exists.'
                    : state.intent === 'solo'
                      ? 'Nothing here is waiting on this. Come back to it whenever a clan is a thing you want.'
                      : 'Waiting — this ticks itself the moment a clan accepts you. Nothing else in the flow is blocked on it.'}
                </p>
              </>
            ))}

          {current.key === 'plugin' &&
            (current.done ? (
              <Done>
                The plugin is connected
                {named.length === 1 ? (
                  <>
                    {' '}
                    and <b className="text-foreground">{named[0]}</b> is yours
                  </>
                ) : named.length > 1 ? (
                  <> and {named.length} characters are linked</>
                ) : null}
                . It tracks you from here.
              </Done>
            ) : (
              <>
                {hasCharacter && (
                  <Done>
                    {named.length === 1 ? (
                      <>
                        <b className="text-foreground">{named[0]}</b> is linked.
                      </>
                    ) : (
                      <>{named.length} characters linked.</>
                    )}{' '}
                    One thing left: the plugin.
                  </Done>
                )}
                {/* A PHONE CANNOT DO THIS STEP. RuneLite runs on a computer, so say that first rather
                    than leave somebody reading install steps for a machine they are not at, and point
                    at what they can do from here. */}
                {touchFirst && (
                  <p className="mb-1 mt-3 rounded-xl border border-card-border bg-brown-dark/50 px-4 py-3 text-[13.5px] leading-relaxed text-text-muted">
                    <b className="text-foreground">On your phone?</b> The plugin runs in RuneLite on a computer, so do this
                    step at your PC. This page keeps your place.{' '}
                    {hasCharacter
                      ? 'Press Skip for now if you want to carry on. Your character stays linked.'
                      : 'To link your character from here, use the XP check under the steps.'}
                  </p>
                )}
                {/* The plugin panel is the token and the beacon, which ConnectCard already is. Rebuilding
                    them here would be a second copy of something written and correct. */}
                <ConnectCard
                  welcomeTo={null}
                  discordUsername={discordUsername}
                  clanless
                  linkedCount={characters.length}
                  verifiedCount={0}
                  detectedCount={detectedCount}
                  connected={false}
                  pluginMissing={hasCharacter}
                  onVerifyByXp={openManual}
                />
                {/* THE FALLBACK, FOLDED. The XP check is for somebody who cannot run the plugin; it
                    was the first thing on this page and read as the way in. Gone once a character is
                    linked: asking for the same proof twice would be the page not knowing what it has.

                    Manual review is off because it means "a moderator vouches for me" and there is
                    no moderator to ask until they are in a clan. */}
                {!hasCharacter && (
                  <div ref={manualRef} className="mt-4 scroll-mt-24 rounded-xl border border-card-border">
                    <button
                      type="button"
                      aria-expanded={manualOpen}
                      onClick={() => setManualChoice(!manualOpen)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-[13.5px] text-text-muted transition-colors hover:text-foreground"
                    >
                      <span>
                        <b className="font-semibold text-foreground/90">Can&rsquo;t run the plugin?</b> Prove your
                        character another way
                      </span>
                      <span aria-hidden className="shrink-0 text-text-dim">
                        {manualOpen ? '–' : '+'}
                      </span>
                    </button>
                    {manualOpen && (
                      <div className="border-t border-card-border px-4 pb-4 pt-3.5">
                        <p className="mb-3.5 text-[13px] leading-relaxed text-text-muted">
                          Use this if you play on mobile, or can&rsquo;t install the plugin right now. It links your
                          character. The plugin is still what tracks your drops and kills, so add it when you can.
                        </p>
                        <LinkAccountClient manualReview={false} />
                      </div>
                    )}
                  </div>
                )}
              </>
            ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-card-border pt-5">
          {state.allSettled ? (
            <button
              type="button"
              onClick={() => finish()}
              disabled={busy}
              className="rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
            >
              {next ? 'Done — continue where I was going' : 'Done — take me to my profile'}
            </button>
          ) : (
            <>
              {!current.done && current.key !== 'discord' && (
                <button
                  type="button"
                  onClick={() => post({ action: current.skipped ? 'unskip' : 'skip', step: current.key })}
                  disabled={busy}
                  className="rounded-lg border border-card-border px-4 py-2.5 text-sm transition-colors hover:border-gold/45 disabled:opacity-50"
                >
                  {current.skipped ? 'Actually, I’ll do this' : 'Skip for now'}
                </button>
              )}
              <button
                type="button"
                onClick={() => finish(false)}
                disabled={busy}
                className="text-[13px] text-text-dim underline-offset-4 hover:text-text-muted hover:underline disabled:opacity-50"
              >
                Finish later
              </button>
            </>
          )}
        </div>
      </section>

      <p className="mt-5 text-center text-[13px] text-text-dim">
        Everything here is saved as you go — close the tab and come back to{' '}
        <ClanLink href="/welcome" className="text-gold hover:text-gold-light">
          /welcome
        </ClanLink>{' '}
        whenever.
      </p>
    </div>
  );
}

/** The one line under the title, said in the terms of whatever they came to do. */
const INTRO: Record<OnboardingIntent, string> = {
  owner:
    'Two things and your clan is running: make it, then get the Anvil plugin. The plugin links your character by itself and does the tracking from there.',
  member:
    'Two things, once: get the Anvil plugin, then find your clan. The plugin links your character by itself and fills in every board you play.',
  solo: 'One thing: get the Anvil plugin. It links your character by itself, and your log, your records and your profile fill in from there.',
};

/** What the poll compares: every fact, so a change that ticks nothing on the rail is still seen. */
function factsOf(state: OnboardingState): string {
  return state.steps.map((s) => `${s.key}:${s.done ? 1 : 0}${s.skipped ? 's' : ''}`).join(',');
}

/** How the header names the answer, so "change" is obviously about that and not about the account. */
const HERE_FOR: Record<OnboardingIntent, string> = {
  owner: 'Here to run a clan',
  member: 'Here to join a clan',
  solo: 'Here for yourself',
};

/**
 * The one question, asked once.
 *
 * <p>Three cards rather than a dropdown because the choice IS the page at this moment, and because
 * each one has to say what it means — "clan owner" is jargon to somebody who has simply always been
 * the person who organises things. Nothing here is a commitment: the answer only shapes what the
 * flow leads with, and the header carries a way back to it.</p>
 */
function IntentChooser({
  displayName,
  busy,
  chosen,
  next,
  onChoose,
}: {
  displayName: string;
  busy: boolean;
  chosen: OnboardingIntent | null;
  next: string | null;
  onChoose: (intent: OnboardingIntent) => void;
}) {
  const options: { key: OnboardingIntent; title: string; blurb: string; aside: string }[] = [
    {
      key: 'owner',
      title: 'I run a clan',
      blurb: 'Put it on Anvil and have your first event running in a couple of minutes.',
      aside: 'Free. Live the moment you make it.',
    },
    {
      key: 'member',
      title: 'I\u2019m joining a clan',
      blurb: 'Find your clan and ask to join, so its boards count what you do.',
      aside: 'Search, then one tap to apply.',
    },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
      <header className="relative mb-8 overflow-hidden">
        <AnvilMark
          size={170}
          className="pointer-events-none absolute -top-8 right-0 hidden text-gold/[0.05] sm:block"
        />
        <p className="relative font-mono text-[10.5px] uppercase tracking-[0.2em] text-gold/85">
          Welcome
        </p>
        <h1 className="display display-lg relative mt-2 text-[clamp(1.6rem,4vw,2.05rem)] font-semibold">
          Welcome to Anvil, {displayName}
        </h1>
        <p className="relative mt-2.5 max-w-[58ch] text-[15px] leading-relaxed text-text-muted">
          What are you here to do?
        </p>
        {next && <ContinueLink next={next} />}
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            disabled={busy}
            onClick={() => onChoose(o.key)}
            aria-pressed={chosen === o.key}
            className={`group flex h-full flex-col rounded-2xl border bg-card-bg p-6 text-left transition-colors disabled:opacity-60 ${
              chosen === o.key ? 'border-gold' : 'border-card-border hover:border-gold/45'
            }`}
          >
            <span className="display text-[19px] font-semibold text-foreground group-hover:text-gold">
              {o.title} <span aria-hidden>&rarr;</span>
            </span>
            <span className="mt-2 text-[13.5px] leading-relaxed text-text-muted">{o.blurb}</span>
            <span className="mt-auto pt-3.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
              {o.aside}
            </span>
          </button>
        ))}
      </div>

      <p className="mt-5 text-center text-[13px] text-text-dim">
        Just here for yourself?{' '}
        <button
          type="button"
          disabled={busy}
          onClick={() => onChoose('solo')}
          className="text-gold underline-offset-4 hover:text-gold-light hover:underline disabled:opacity-60"
        >
          Track my own progress
        </button>
      </p>
      {/* A fourth door that is a plain link, not an answer: somebody with viewers and no in-game clan
          has no row above, and hosting is its own page rather than a step of this setup. */}
      <p className="mt-2 text-center text-[13px] text-text-dim">
        Hosting for your viewers instead?{' '}
        <ClanLink href="/host" className="text-gold hover:text-gold-light">
          I host for my viewers
        </ClanLink>
      </p>
    </div>
  );
}

/**
 * The milestones as one line. Clickable, and the connector between two dots fills only when the
 * step BEFORE it is done — so the rail reads as progress rather than as unrelated lights.
 */
function Rail({
  steps,
  open,
  onOpen,
}: {
  steps: OnboardingState['rail'];
  open: RailKey;
  onOpen: (k: RailKey) => void;
}) {
  return (
    <ol className="flex items-stretch gap-1.5 sm:gap-2.5">
      {steps.map((s, i) => {
        const active = s.key === open;
        return (
          <li key={s.key} className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => onOpen(s.key)}
              className="group w-full text-left"
              aria-current={active ? 'step' : undefined}
            >
              <span className="flex items-center gap-1.5">
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-bold transition-colors ${
                    s.done
                      ? 'border-accent-green/50 bg-accent-green/20 text-accent-green-light'
                      : s.skipped
                        ? 'border-card-border bg-brown-dark text-text-dim'
                        : active
                          ? 'border-gold bg-gold/15 text-gold'
                          : 'border-card-border bg-brown-dark text-text-muted'
                  }`}
                >
                  {s.done ? '✓' : s.skipped ? '–' : i + 1}
                </span>
                <span
                  className={`h-px flex-1 transition-colors ${s.done ? 'bg-accent-green/40' : 'bg-card-border'}`}
                />
              </span>
              <span
                className={`mt-2 block truncate text-[12px] transition-colors ${
                  active ? 'font-semibold text-gold' : s.done ? 'text-text-muted' : 'text-text-dim'
                } group-hover:text-text-muted`}
              >
                {SHORT[s.key]}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** The rail has one line per step; the panel carries the full title. */
const SHORT: Record<RailKey, string> = {
  discord: 'Discord',
  plugin: 'Plugin',
  clan: 'Clan',
};

function Done({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2.5 rounded-xl border border-accent-green/35 bg-accent-green/[0.07] px-4 py-3 text-sm">
      <span className="text-accent-green-light" aria-hidden>
        ✓
      </span>
      <span className="text-text-muted">{children}</span>
    </p>
  );
}

/**
 * The page they were on their way to when they signed in for the first time. Onboarding is offered,
 * never a wall: one click and they are where they meant to be, and the steps stay here for later.
 */
function ContinueLink({ next }: { next: string }) {
  return (
    <p className="relative mt-3 text-[13px] text-text-muted">
      <a href={/* clan-prefix: platform -- the literal path they signed in from */ next} className="font-semibold text-gold hover:text-gold-light">
        Continue to where you were going →
      </a>{' '}
      <span className="font-mono text-[11.5px] text-text-dim">{next.length > 60 ? `${next.slice(0, 57)}…` : next}</span>
      <span className="block text-[12px] text-text-dim">You can finish setting up any time from your profile.</span>
    </p>
  );
}
