'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import AnvilMark from '@/components/AnvilMark';
import ClanLink from '@/components/ClanLink';
import ConnectCard from '@/app/profile/ConnectCard';
import type { OnboardingState, StepKey } from '@/lib/onboarding';

interface Props {
  state: OnboardingState;
  displayName: string;
  discordUsername: string | null;
  clans: { slug: string; name: string }[];
}

/**
 * The flow. Four milestones, and the rail is the whole navigation — there is no next/back, because
 * a step is done when the world says so, not when somebody presses a button.
 *
 * That is also why this polls. Two of the four complete because of something that happens somewhere
 * else entirely: an admin approves you into a clan, or the plugin reports for the first time from a
 * game client on another screen. Asking somebody to reload until it works is how a setup flow gets
 * abandoned, so the page watches instead and moves on by itself.
 */
export default function WelcomeClient({ state: initial, displayName, discordUsername, clans }: Props) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);
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

  // The clan step finishes elsewhere — a join request approved, an invite accepted, a clan created in
  // another tab. Poll while it is the outstanding one and the tab is visible.
  const watchingClan = !state.steps.find((s) => s.key === 'clan')?.done;
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
    // clan-prefix: platform -- same as the page's redirect: this flow is apex-only, and bare
    // /profile there is the person page that spans their clans rather than any one clan's locker.
    router.push('/profile');
  }

  const current = state.steps.find((s) => s.key === open) ?? state.steps[0];
  const index = state.steps.findIndex((s) => s.key === open);

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
          Four things, once. After that the plugin does the work and this page never needs opening
          again — in this clan or any other you join.
        </p>
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
                <div className="flex flex-wrap gap-3">
                  <ClanLink
                    href="/clans"
                    className="rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light"
                  >
                    Find a clan
                  </ClanLink>
                  <ClanLink
                    href="/clans/new"
                    className="rounded-lg border border-card-border px-4 py-2.5 text-sm transition-colors hover:border-gold/45"
                  >
                    Start one
                  </ClanLink>
                </div>
                <p className="mt-3.5 text-[13px] text-text-dim">
                  Waiting — this ticks itself the moment you join one or a clan accepts you.
                </p>
              </>
            ))}

          {/* ONE PANEL FOR THE LAST TWO, because it is one action. Pasting the token links your
              character AND starts the plugin reporting; the rail still shows them apart because they
              are different milestones, and an admin adding your RSN completes the first without the
              second. Rebuilding the token box and the beacon here would have been a second copy of
              something already written and already correct. */}
          {(current.key === 'character' || current.key === 'plugin') && (
            <ConnectCard
              welcomeTo={null}
              discordUsername={discordUsername}
              linkedCount={state.steps.find((s) => s.key === 'character')?.done ? 1 : 0}
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
  clan: 'Clan',
  character: 'Character',
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
