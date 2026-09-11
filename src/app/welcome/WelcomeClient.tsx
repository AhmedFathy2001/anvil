'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import AnvilMark from '@/components/AnvilMark';
import ClanLink from '@/components/ClanLink';
import ConnectCard from '@/app/profile/ConnectCard';
import LinkAccountClient from '@/app/profile/LinkAccountClient';
import type { OnboardingIntent, OnboardingState, StepKey } from '@/lib/onboarding';

interface Props {
  state: OnboardingState;
  displayName: string;
  discordUsername: string | null;
  clans: { slug: string; name: string }[];
  /** RSNs already linked to this person, for the character step's done state. */
  characters: string[];
}

/**
 * The flow. Four milestones, and the rail is the whole navigation — there is no next/back, because
 * a step is done when the world says so, not when somebody presses a button.
 *
 * That is also why this polls. Two of the four complete because of something that happens somewhere
 * else entirely: an admin approves you into a clan, or the plugin reports for the first time from a
 * game client on another screen. Asking somebody to reload until it works is how a setup flow gets
 * abandoned, so the page watches instead and moves on by itself.
 *
 * ONE QUESTION FIRST, and it is the only thing here that is asked rather than observed. The same
 * four steps served three arrivals that want different things — somebody putting their clan on
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
}: Props) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);
  // Re-opening the chooser is a local act, not a write: nulling the intent in state would be undone
  // by the next poll, and clearing it on the server would lose an answer somebody may keep.
  const [choosing, setChoosing] = useState(false);
  // Which step's panel is open. Follows the flow, but a person can look at any of them — the rail is
  // clickable, because "what do I still have to do" is a fair question at any point.
  const [open, setOpen] = useState<StepKey>(initial.current ?? 'plugin');

  // Server state wins on every re-render: the parent re-renders when ConnectCard's beacon fires, and
  // the flow must follow the facts rather than whatever the client last believed.
  useEffect(() => {
    setState(initial);
  }, [initial]);

  // Follow the flow forward as steps complete, but never drag somebody off a panel they chose to
  // open — only move when the panel they are on is finished with.
  useEffect(() => {
    const step = state.steps.find((s) => s.key === open);
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

  // Two of the four finish somewhere else entirely — a join request approved, an invite accepted, a
  // clan created in another tab, or the plugin linking a character from a game client on another
  // screen. Poll while either is outstanding and the tab is visible.
  const watchingClan = state.steps.some((s) => (s.key === 'clan' || s.key === 'character') && !s.done);
  useEffect(() => {
    if (!watchingClan) return;
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
            if (next.doneCount !== state.doneCount) {
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
  }, [watchingClan, state.doneCount, router]);

  async function finish() {
    await post({ action: 'complete' });
    // WHERE FINISHING LANDS IS PART OF THE ANSWER. A clan owner's next hour is the setup wizard, not
    // their own locker; a member wants the clan they just got into; somebody here for themselves
    // wants the page that is themselves. Falling back to the locker whenever there is no clan to
    // point at keeps the old destination for everyone the branches don't cover.
    // Bare /profile is the apex's person page, which spans their clans rather than being any one
    // clan's locker — the right end for somebody who has no clan, or did not come for one.
    const clan = clans[0];
    if (state.intent === 'owner' && clan) router.push(`/c/${clan.slug}/admin/setup`);
    else if (state.intent === 'member' && clan) router.push(`/c/${clan.slug}`);
    else router.push('/profile'); // clan-prefix: platform -- apex-only flow, apex person page
  }

  /** Answering the chooser. Also opens the step that answer makes the point of the flow. */
  async function chooseIntent(intent: OnboardingIntent) {
    await post({ action: 'intent', intent });
    setOpen(intent === 'solo' ? 'character' : 'clan');
  }

  const current = state.steps.find((s) => s.key === open) ?? state.steps[0];
  const index = state.steps.findIndex((s) => s.key === open);
  const clanStep = state.steps.find((s) => s.key === 'clan');

  // NOT ASKED YET, and nothing done that answers it for them. Somebody who already has a clan has
  // answered it by having one, and being asked "are you starting a clan?" over the top of a clan
  // they are already in would read as the page not knowing who they are.
  if (choosing || (state.intent == null && !clanStep?.done)) {
    return (
      <IntentChooser
        displayName={displayName}
        busy={busy}
        chosen={state.intent}
        onChoose={async (i) => {
          await chooseIntent(i);
          setChoosing(false);
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
      </header>

      <Rail steps={state.steps} open={open} onOpen={setOpen} />

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
                <p className="mt-3.5 text-[13px] text-text-dim">
                  {state.intent === 'owner'
                    ? 'Free, and live the moment you press the button — nothing to approve, nothing to pay. This ticks the moment it exists.'
                    : state.intent === 'solo'
                      ? 'Nothing here is waiting on this. Come back to it whenever a clan is a thing you want.'
                      : 'Waiting — this ticks itself the moment a clan accepts you. Nothing else in the flow is blocked on it.'}
                </p>
              </>
            ))}

          {current.key === 'character' &&
            (current.done ? (
              <Done>
                {characters.length === 1 ? (
                  <>
                    <b className="text-foreground">{characters[0]}</b> is yours.
                  </>
                ) : (
                  <>{characters.length} characters linked.</>
                )}
              </Done>
            ) : (
              <>
                {/* NO CLAN NEEDED, and that is the whole change. Verifying by XP asks Hiscores
                    whether the person holding this page can make the account gain XP — a question
                    about them and the game, with no clan anywhere in it. Manual review is off here
                    because it means "a moderator vouches for me" and there is no moderator to ask
                    until they are in a clan. */}
                <LinkAccountClient manualReview={false} />
                <p className="mt-3.5 text-[13px] text-text-dim">
                  Already run the plugin? It links your character on its own — skip to the last step.
                </p>
              </>
            ))}

          {/* The plugin panel is the token and the beacon, which ConnectCard already is. Rebuilding
              them here would be a second copy of something written and correct. */}
          {current.key === 'plugin' && (
            <ConnectCard
              welcomeTo={null}
              discordUsername={discordUsername}
              linkedCount={characters.length}
              verifiedCount={0}
              detectedCount={0}
              connected={state.steps.find((s) => s.key === 'plugin')?.done ?? false}
            />
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-card-border pt-5">
          {state.allSettled ? (
            <button
              type="button"
              onClick={finish}
              disabled={busy}
              className="rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
            >
              Done — take me to my locker
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
                onClick={finish}
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
    'Three things and your clan is running: make it, link your character, install the plugin. After that the plugin does the work and this page never needs opening again.',
  member:
    'Three things, once: get into your clan, link your character, install the plugin. After that the plugin fills in every board you play, in every clan you are in.',
  solo: 'Two things, once: link your character and install the plugin. Your log, your records and your profile fill themselves in from there.',
};

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
  onChoose,
}: {
  displayName: string;
  busy: boolean;
  chosen: OnboardingIntent | null;
  onChoose: (intent: OnboardingIntent) => void;
}) {
  const options: { key: OnboardingIntent; title: string; blurb: string; aside: string }[] = [
    {
      key: 'owner',
      title: 'I run a clan',
      blurb: 'Put it on Anvil — boards, competitions, roster, Discord posts.',
      aside: 'Free. Live the moment you make it.',
    },
    {
      key: 'member',
      title: 'I\u2019m in a clan',
      blurb: 'Find it here and get on its roster, so its boards count what you do.',
      aside: 'Most clans take members on approval.',
    },
    {
      key: 'solo',
      title: 'Just me for now',
      blurb: 'Track my own collection log, personal bests and records.',
      aside: 'No clan needed. Join one whenever.',
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
          Setting up
        </p>
        <h1 className="display display-lg relative mt-2 text-[clamp(1.6rem,4vw,2.05rem)] font-semibold">
          Welcome to Anvil, {displayName}
        </h1>
        <p className="relative mt-2.5 max-w-[58ch] text-[15px] leading-relaxed text-text-muted">
          One question first, so the rest of this is about you. You can change the answer at any
          time — it only decides what Anvil leads with.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            disabled={busy}
            onClick={() => onChoose(o.key)}
            aria-pressed={chosen === o.key}
            className={`group flex h-full flex-col rounded-2xl border bg-card-bg p-5 text-left transition-colors disabled:opacity-60 ${
              chosen === o.key ? 'border-gold' : 'border-card-border hover:border-gold/45'
            }`}
          >
            <span className="display text-[17px] font-semibold text-foreground group-hover:text-gold">
              {o.title}
            </span>
            <span className="mt-2 text-[13.5px] leading-relaxed text-text-muted">{o.blurb}</span>
            <span className="mt-auto pt-3.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
              {o.aside}
            </span>
          </button>
        ))}
      </div>

      <p className="mt-5 text-center text-[13px] text-text-dim">
        Not sure? Pick the middle one — nothing here is locked in.
      </p>
    </div>
  );
}

/**
 * The four milestones as one line. Clickable, and the connector between two dots fills only when the
 * step BEFORE it is done — so the rail reads as progress rather than as four unrelated lights.
 */
function Rail({
  steps,
  open,
  onOpen,
}: {
  steps: OnboardingState['steps'];
  open: StepKey;
  onOpen: (k: StepKey) => void;
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
const SHORT: Record<StepKey, string> = {
  discord: 'Discord',
  character: 'Character',
  clan: 'Clan',
  plugin: 'Plugin',
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
