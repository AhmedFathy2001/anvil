'use client';

import { useEffect, useState } from 'react';
import { eventTimeState, formatExactTime } from '@/lib/eventTime';

interface Props {
  startDate?: string | null;
  endDate?: string | null;
  forceEndedAt?: string | null;
}

function parts(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(totalSec / 86_400),
    hours: Math.floor((totalSec % 86_400) / 3_600),
    mins: Math.floor((totalSec % 3_600) / 60),
    secs: totalSec % 60,
  };
}

// Prominent, ticking countdown that appears ONLY in the final-day window: less than 24h until an
// upcoming event starts, or until an active event ends (the `imminent` flag in eventTimeState).
// Outside that window — days out, ended, or force-ended — it renders nothing, and the compact status
// pill in the board header carries the timing instead. Rendered above the board so it still shows
// when the board itself is hidden (sign-ups not open / tiles not revealed).
export default function EventCountdown({ startDate, endDate, forceEndedAt }: Props) {
  // Null until mounted so the server render (which has no stable "now") and the first client render
  // agree — the timer is client-only, avoiding a hydration mismatch on the live seconds.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  if (now === null) return null;

  const state = eventTimeState({ startDate, endDate, forceEndedAt, now });
  if (!state.imminent || state.target === null) return null;
  if (state.phase !== 'upcoming' && state.phase !== 'active') return null;

  const remaining = state.target - now;
  if (remaining <= 0) return null;

  const { days, hours, mins, secs } = parts(remaining);
  const starting = state.phase === 'upcoming';
  const label = starting ? 'Event starts in' : 'Event ends in';

  // Within 24h `days` is 0; keep the segment only in the rare boundary case.
  const segments = [
    ...(days > 0 ? [{ value: days, unit: 'Days' }] : []),
    { value: hours, unit: 'Hours' },
    { value: mins, unit: 'Mins' },
    { value: secs, unit: 'Secs' },
  ];

  const ring = starting ? 'border-blue-500/30 bg-blue-500/5' : 'border-gold/30 bg-gold/5';
  const accent = starting ? 'text-blue-400' : 'text-gold';
  const dot = starting ? 'bg-blue-400' : 'bg-gold';

  return (
    <div className={`mb-6 rounded-xl border ${ring} p-5 text-center`}>
      <div className={`mb-3 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest ${accent}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${dot} animate-pulse`} />
        {label}
      </div>
      <div className="flex items-start justify-center gap-3 sm:gap-4">
        {segments.map((s) => (
          <div key={s.unit} className="flex flex-col items-center">
            <span className="tabular-nums rounded-lg border border-card-border bg-card-bg px-3 py-2 text-3xl font-bold text-foreground min-w-[3rem] sm:min-w-[4.5rem] sm:text-5xl">
              {String(s.value).padStart(2, '0')}
            </span>
            <span className="mt-1.5 text-[10px] uppercase tracking-wide text-text-muted sm:text-xs">{s.unit}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 text-xs text-text-muted">{formatExactTime(state.target)}</div>
    </div>
  );
}
