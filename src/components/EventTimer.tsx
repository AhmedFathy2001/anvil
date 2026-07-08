'use client';

import { useEffect, useState } from 'react';
import {
  eventTimeState,
  formatCountdown,
  formatExactTime,
  type EventPhase,
} from '@/lib/eventTime';

interface Props {
  startDate?: string | null;
  endDate?: string | null;
  forceEndedAt?: string | null;
  /** Class applied to the wrapper — controls the base text colour. */
  className?: string;
}

const LABEL: Record<EventPhase, string> = {
  upcoming: 'Starts',
  active: 'Ends',
  ended: 'Ended',
  'force-ended': 'Ended',
  none: '',
};

// Shows the exact start/end time normally, and switches to a live, ticking
// countdown once the moment is within 24h. When counting down it also keeps the
// exact time visible (dimmed) so the precise moment is never hidden.
export default function EventTimer({ startDate, endDate, forceEndedAt, className }: Props) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Render nothing until mounted — locale/clock formatting is client-only.
  if (now === null) return null;

  const state = eventTimeState({ startDate, endDate, forceEndedAt, now });
  if (state.phase === 'none' || state.target === null) return null;

  const label = LABEL[state.phase];
  const exact = formatExactTime(state.target);

  // Always count down for an upcoming event (how long until kickoff); a running event only
  // switches to a live countdown once its end is within 24h.
  const showCountdown = state.phase === 'upcoming' || state.imminent;

  if (!showCountdown) {
    return (
      <span className={className}>
        {label} {exact}
      </span>
    );
  }

  return (
    <span className={className}>
      {label} in {formatCountdown(state.target - now)}
      <span className="opacity-60 font-normal"> · {exact}</span>
    </span>
  );
}
