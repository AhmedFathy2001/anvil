'use client';

import { useEffect, useState } from 'react';
import { formatCountdown } from '@/lib/eventTime';

// A compact "4d 06h left" pill. Client-only because the number depends on the reader's clock, and a
// server-rendered one would be wrong by however long the page sat open. Ticks every 30s — the pill
// shows minutes at its finest, so a per-second interval would just burn renders.
export default function TimeLeft({
  until,
  prefix,
  suffix = 'left',
  className = '',
}: {
  until: string | null;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  if (!until || now === null) return null;
  const ms = Date.parse(until) - now;
  if (!Number.isFinite(ms)) return null;

  return (
    <span className={className}>
      {ms <= 0 ? 'ending now' : `${prefix ? `${prefix} ` : ''}${formatCountdown(ms)}${suffix ? ` ${suffix}` : ''}`}
    </span>
  );
}
