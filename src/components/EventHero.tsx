'use client';

import { useEffect, useState } from 'react';
import { eventTimeState, formatExactTime, type EventPhase } from '@/lib/eventTime';

interface Props {
  name: string;
  shapeBadge: string;
  pointsOnBoard: number | null;
  teamsCount: number;
  prizePool: number;
  prizeBreakdown: string | null;
  startDate?: string | null;
  endDate?: string | null;
  forceEndedAt?: string | null;
  // Prize per placement (gp by place, index 0 = 1st), shown as the reward breakdown. Empty = not set.
  placementPrizes: number[];
}

function countParts(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(totalSec / 86_400),
    hours: Math.floor((totalSec % 86_400) / 3_600),
    mins: Math.floor((totalSec % 3_600) / 60),
    secs: totalSec % 60,
  };
}

// Compact gp for the prize chips: 275,000,000 → "275M", 1,200,000,000 → "1.2B".
function compactGp(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(n % 1e9 === 0 ? 0 : 1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`;
  return String(n);
}

function medal(place: number): string {
  return place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : `#${place}`;
}

const STATUS: Record<EventPhase, { label: string; dot: string; text: string }> = {
  active: { label: 'Live', dot: 'bg-accent-green-light', text: 'text-accent-green-light' },
  upcoming: { label: 'Upcoming', dot: 'bg-blue-400', text: 'text-blue-400' },
  ended: { label: 'Ended', dot: 'bg-text-muted', text: 'text-text-muted' },
  'force-ended': { label: 'Ended', dot: 'bg-red-400', text: 'text-red-400' },
  none: { label: 'Draft', dot: 'bg-text-muted', text: 'text-text-muted' },
};

// The event page's hero: one cohesive header that merges identity (title + status + shape), the prize
// pool (the reward), a live countdown (the urgency), and the prize-per-placement breakdown. Forge-glow
// styling ties it to the Anvil brand.
export default function EventHero({
  name,
  shapeBadge,
  pointsOnBoard,
  teamsCount,
  prizePool,
  prizeBreakdown,
  startDate,
  endDate,
  forceEndedAt,
  placementPrizes,
}: Props) {
  // Client-only clock — null until mounted so SSR and first render agree (no hydration mismatch).
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const state = now === null ? null : eventTimeState({ startDate, endDate, forceEndedAt, now });
  const phase = state?.phase ?? 'none';
  const status = STATUS[phase];
  const hasPrize = prizePool > 0;
  const prizes = placementPrizes.filter((p) => p > 0);

  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl border border-gold/25 bg-card-bg">
      {/* Forge heat — a soft gold glow rising from the base, behind the content. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_70%_at_50%_115%,rgba(212,175,55,0.14),transparent_70%)]" />

      <div className="relative p-6 sm:p-8">
        {/* Identity. The status derives from the client clock, so keep its row height reserved and
            only fill it once mounted — otherwise a live event would flash "Draft" on first paint. */}
        <div className="mb-2 flex h-4 items-center text-[11px] font-semibold uppercase tracking-widest">
          {now !== null && (
            <span className={`flex items-center gap-1.5 ${status.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot} ${phase === 'active' ? 'animate-pulse' : ''}`} />
              {status.label}
            </span>
          )}
        </div>
        <h1 className="break-words text-2xl font-extrabold leading-tight text-gold sm:text-4xl">{name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
          <span className="rounded-full bg-gold/15 px-2 py-0.5 font-medium text-gold">{shapeBadge}</span>
          {pointsOnBoard !== null && (
            <span className="rounded-full bg-purple-500/15 px-2 py-0.5 font-medium text-purple-300">
              {pointsOnBoard.toLocaleString()} pts on the board
            </span>
          )}
          <span>{teamsCount} team{teamsCount !== 1 ? 's' : ''}</span>
        </div>

        {/* The two focal points — reward and urgency. */}
        <div className={`mt-6 grid gap-6 ${hasPrize ? 'sm:grid-cols-2 sm:divide-x sm:divide-card-border' : ''}`}>
          {hasPrize && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-gold/60">Prize pool</div>
              <div className="mt-1 bg-gradient-to-b from-[#ffe9a8] via-[#f2c14e] to-[#c8962c] bg-clip-text text-4xl font-black leading-none tracking-tight text-transparent tabular-nums sm:text-6xl">
                {prizePool.toLocaleString()}
                <span className="ml-1.5 align-baseline text-xl font-bold text-gold sm:text-3xl">gp</span>
              </div>
              {prizeBreakdown && <div className="mt-2 text-xs text-text-muted">{prizeBreakdown}</div>}
            </div>
          )}

          <div className={hasPrize ? 'sm:pl-6' : ''}>
            <CountdownBlock now={now} phase={phase} target={state?.target ?? null} />
          </div>
        </div>

        {/* Prizes on the line — the reward per placement. */}
        {prizes.length > 0 && (
          <div className="mt-6 border-t border-card-border pt-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gold/60">
              Prizes on the line
            </div>
            <div className="flex flex-wrap gap-2">
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
          </div>
        )}
      </div>
    </div>
  );
}

function CountdownBlock({ now, phase, target }: { now: number | null; phase: EventPhase; target: number | null }) {
  // Ended states have no live countdown — just say so (with the finish time when we have it).
  if (phase === 'ended' || phase === 'force-ended') {
    return (
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">Finished</div>
        <div className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">Event ended</div>
        {target !== null && <div className="mt-2 text-xs text-text-muted">{formatExactTime(target)}</div>}
      </div>
    );
  }
  if (now === null || target === null || target <= now) {
    // Pre-mount, unscheduled, or a target that just elapsed (the next tick re-derives the phase).
    return (
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">Schedule</div>
        <div className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">
          {target !== null ? formatExactTime(target) : 'TBD'}
        </div>
      </div>
    );
  }

  const { days, hours, mins, secs } = countParts(target - now);
  const label = phase === 'upcoming' ? 'Starts in' : 'Ends in';
  const segments = [
    ...(days > 0 ? [{ value: days, unit: 'Days' }] : []),
    { value: hours, unit: 'Hrs' },
    { value: mins, unit: 'Min' },
    { value: secs, unit: 'Sec' },
  ];

  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-widest text-gold/60">{label}</div>
      <div className="mt-1.5 flex items-start gap-2 sm:gap-2.5">
        {segments.map((s) => (
          <div key={s.unit} className="flex flex-col items-center">
            <span className="tabular-nums rounded-lg border border-gold/15 bg-black/25 px-2.5 py-1.5 text-2xl font-bold text-foreground min-w-[2.75rem] sm:text-4xl sm:min-w-[3.5rem]">
              {String(s.value).padStart(2, '0')}
            </span>
            <span className="mt-1 text-[10px] uppercase tracking-wide text-text-muted">{s.unit}</span>
          </div>
        ))}
      </div>
      {target !== null && <div className="mt-2 text-xs text-text-muted">{formatExactTime(target)}</div>}
    </div>
  );
}
