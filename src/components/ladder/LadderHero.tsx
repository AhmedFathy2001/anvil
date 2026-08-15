'use client';

import { useEffect, useState } from 'react';
import { eventTimeState, formatExactTime, formatUtcHint } from '@/lib/eventTime';
import type { LadderChampion, LadderLifecycle } from '@/lib/ladderView';

/**
 * The ladder's header.
 *
 * A ladder is the one format that usually has no finish line, so the team-event hero's "Ends in"
 * countdown was pointing at nothing. What a ladder actually runs on is a SEASON: which one this is,
 * when the board wipes, how far through it we are — and, since all-time totals survive the wipe,
 * an explicit promise that they do. The three lifecycles get three different clocks:
 *
 *   season  — counts down to the 1st, with a meter across the month
 *   endless — counts UP from the day the ladder opened; nothing to reset
 *   bounded — counts down to the end date; it's a one-shot run, so no seasons and no hall
 *
 * The prize pool is optional throughout: plenty of ladders run for the crown alone, and the hero
 * has to read just as well with nothing in it but a name and a clock.
 */

interface Props {
  name: string;
  lifecycle: LadderLifecycle;
  season: { number: number; label: string; resetAt: string; day: number; days: number } | null;
  startDate?: string | null;
  endDate?: string | null;
  forceEndedAt?: string | null;
  shapeBadge: string;
  openNow: number;
  poolSize: number;
  totalPlayers: number;
  prizePool: number;
  prizeBreakdown: string | null;
  placementPrizes: number[];
  champion: LadderChampion | null;
  chaser: { name: string; behind: number; tasks: number } | null;
}

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(s / 86_400),
    hours: Math.floor((s % 86_400) / 3_600),
    mins: Math.floor((s % 3_600) / 60),
    secs: s % 60,
  };
}

function compactGp(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(n % 1e9 === 0 ? 0 : 1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`;
  return String(n);
}

const medal = (place: number) => (place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : `#${place}`);

export default function LadderHero({
  name,
  lifecycle,
  season,
  startDate,
  endDate,
  forceEndedAt,
  shapeBadge,
  openNow,
  poolSize,
  totalPlayers,
  prizePool,
  prizeBreakdown,
  placementPrizes,
  champion,
  chaser,
}: Props) {
  // Client-only clock, like EventHero: null until mounted so SSR and first paint agree.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const state = now === null ? null : eventTimeState({ startDate, endDate, forceEndedAt, now });
  const phase = state?.phase ?? 'none';
  // Derived from the dates, not the clock: the clock is null until mount, so a clock-derived
  // `finished` made the server render the LIVE header for a run that ended days ago, and the
  // countdown label flashed "Ladder ends in" over 00:00:00 before hydration corrected it.
  const finished = !!forceEndedAt || (!!endDate && Date.parse(endDate) <= (now ?? Date.now()));
  const hasPrize = prizePool > 0;
  const prizes = placementPrizes.filter((p) => p > 0);

  // A finished ladder has nothing to count down to. Leaving the countdown in place ran it to
  // 00:00:00 under the label "Ladder ends in", which reads as a bug rather than a result.
  let clockLabel = 'Season resets in';
  let target: number | null = season ? Date.parse(season.resetAt) : null;
  let countUp = false;
  if (lifecycle === 'endless') {
    clockLabel = 'Running for';
    countUp = true;
    target = startDate ? Date.parse(startDate) : null;
  } else if (lifecycle === 'bounded') {
    clockLabel = phase === 'upcoming' ? 'Starts in' : 'Ladder ends in';
    target = state?.target ?? (endDate ? Date.parse(endDate) : null);
  }

  const seasonLine =
    lifecycle === 'season' && season
      ? `Season ${season.number} · ${season.label}`
      : lifecycle === 'endless'
        ? 'No seasons · one board, running since ' + (startDate ? formatExactTime(Date.parse(startDate)) : 'day one')
        : endDate
          ? 'One run, no reset'
          : 'Ladder';

  const subline =
    lifecycle === 'season' && season ? (
      <>
        <span className="font-semibold text-foreground">{formatUtcHint(season.resetAt)}</span>{' '}
        — the season board wipes to zero and Season {season.number + 1} starts on the same task pool.
        All-time totals keep counting.
      </>
    ) : lifecycle === 'endless' ? (
      <>This ladder never resets — every point ever earned still counts. The monthly and 7-day boards are how you see who is moving <em>now</em>.</>
    ) : (
      <>
        {finished
          ? 'This one had a finish line, so there were no seasons and nothing to reset — these standings are final.'
          : 'This one has a finish line, so there are no seasons and nothing to reset — final standings lock at the end.'}
      </>
    );

  return (
    <div className="relative mb-4 overflow-hidden rounded-2xl border border-gold/25 bg-card-bg">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_12%_0%,rgba(212,175,55,0.16),transparent_62%),radial-gradient(90%_70%_at_50%_118%,rgba(212,175,55,0.13),transparent_70%)]" />

      <div className="relative grid gap-7 p-6 sm:p-8 lg:grid-cols-[1.5fr_1fr]">
        <div className="min-w-0">
          <div className="mb-2 flex h-4 items-center text-[11px] font-semibold uppercase tracking-widest">
            {now !== null && (
              <span className={`flex items-center gap-1.5 ${finished ? 'text-text-muted' : 'text-accent-green-light'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${finished ? 'bg-text-muted' : 'animate-pulse bg-accent-green-light'}`} />
                {finished ? 'Finished' : 'Running'}
              </span>
            )}
          </div>

          <h1 className="break-words text-2xl font-extrabold leading-tight text-gold sm:text-4xl">{name}</h1>
          <p className="mt-1.5 text-sm text-text-muted">{seasonLine}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-gold/15 px-2.5 py-0.5 font-medium text-gold">{shapeBadge}</span>
            <span className="rounded-full border border-purple-400/25 bg-purple-500/15 px-2.5 py-0.5 font-medium text-purple-300">
              {openNow} open of {poolSize} in the pool
            </span>
            <span className="rounded-full border border-card-border bg-brown-dark/60 px-2.5 py-0.5 text-text-muted">
              {totalPlayers} player{totalPlayers === 1 ? '' : 's'} scoring
            </span>
          </div>

          {hasPrize && (
            <div className="mt-6">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-gold/60">Prize pool</div>
              <div className="mt-1 bg-gradient-to-b from-[#ffe9a8] via-[#f2c14e] to-[#c8962c] bg-clip-text text-3xl font-black leading-none tracking-tight text-transparent tabular-nums sm:text-5xl">
                {prizePool.toLocaleString()}
                <span className="ml-1.5 align-baseline text-lg font-bold text-gold sm:text-2xl">gp</span>
              </div>
              {prizeBreakdown && <div className="mt-2 text-xs text-text-muted">{prizeBreakdown}</div>}
              {prizes.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {prizes.map((amt, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gold/20 bg-gold/5 px-3 py-1.5 text-sm"
                    >
                      <span aria-hidden>{medal(i + 1)}</span>
                      <span className="font-semibold text-gold tabular-nums">{compactGp(amt)}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-6">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-gold/60">
              {finished ? 'Ended' : clockLabel}
            </div>
            {finished ? (
              <div className="mt-1.5 text-2xl font-bold text-foreground sm:text-3xl">
                {forceEndedAt ?? endDate ? formatExactTime(Date.parse((forceEndedAt ?? endDate)!)) : 'Closed'}
              </div>
            ) : (
              <Clock now={now} target={target} countUp={countUp} />
            )}
            <p className="mt-3 max-w-xl text-xs leading-relaxed text-text-muted">{subline}</p>
          </div>

          {lifecycle === 'season' && season && (
            <div className="mt-4 max-w-md">
              <div className="mb-1.5 flex justify-between text-[10px] uppercase tracking-wider text-text-muted">
                <span>{season.label.split(' ')[0]} 1</span>
                <span>Day {season.day} of {season.days}</span>
                <span>Reset</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full border border-card-border bg-brown-dark">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-gold-dark to-gold-light"
                  style={{ width: `${Math.round((season.day / season.days) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {champion && (
          <div className="self-start rounded-xl border border-gold/20 bg-gradient-to-b from-gold/10 to-transparent p-4 sm:p-5">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-gold/70">Holding the crown</div>
            <div className="mt-2.5 flex items-center gap-3">
              <span className="text-2xl leading-none" aria-hidden>👑</span>
              <div className="min-w-0">
                <div className="truncate text-lg font-bold text-gold-light">{champion.name}</div>
                <div className="text-xs text-text-muted">
                  {Math.round(champion.points).toLocaleString()} pts · {champion.tasks} task{champion.tasks === 1 ? '' : 's'}
                  {champion.heldDays > 0 && <> · in front for {champion.heldDays} day{champion.heldDays === 1 ? '' : 's'}</>}
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2 border-t border-gold/15 pt-3 text-xs text-text-muted">
              {champion.streak > 1 && (
                <p>
                  <span className="font-semibold text-foreground">🔥 {champion.streak}-day</span> claim streak
                </p>
              )}
              {chaser && (
                <p>
                  <span className="font-semibold text-foreground">{chaser.name}</span> is{' '}
                  {chaser.behind.toLocaleString()} pts back
                </p>
              )}
              {!hasPrize && (
                <p className="border-t border-gold/15 pt-2.5">
                  No prize on this one — what&apos;s on the line is the crown, the streak, and a permanent line in the hall.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Clock({ now, target, countUp }: { now: number | null; target: number | null; countUp: boolean }) {
  if (now === null || target === null) {
    return <div className="mt-1.5 text-2xl font-bold text-foreground sm:text-3xl">TBD</div>;
  }
  const ms = countUp ? now - target : target - now;
  const { days, hours, mins, secs } = parts(ms);
  const segments = [
    ...(days > 0 ? [{ value: days, unit: 'Days' }] : []),
    { value: hours, unit: 'Hrs' },
    { value: mins, unit: 'Min' },
    { value: secs, unit: 'Sec' },
  ];
  return (
    <div className="mt-1.5 flex items-start gap-2 sm:gap-2.5">
      {segments.map((s) => (
        <div key={s.unit} className="flex flex-col items-center">
          <span
            className="min-w-[2.75rem] rounded-lg border border-gold/15 bg-black/25 px-2.5 py-1.5 text-2xl font-bold tabular-nums text-foreground sm:min-w-[3.5rem] sm:text-4xl"
            suppressHydrationWarning
          >
            {String(s.value).padStart(2, '0')}
          </span>
          <span className="mt-1 text-[10px] uppercase tracking-wide text-text-muted">{s.unit}</span>
        </div>
      ))}
    </div>
  );
}
