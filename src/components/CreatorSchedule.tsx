'use client';

import { useSyncExternalStore } from 'react';

import { formatSlotTime } from '@/lib/spacePage/rules';
import type { ShownSlot } from '@/lib/spacePage/store';

const noop = () => () => {};

/** True after hydration: the viewer's own zone is only known in their browser. */
function useInBrowser(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

/**
 * A creator's weekly stream times (lib/spacePage), each shown on the VIEWER's clock — "Tue 7:00 PM
 * your time". The host writes them in their own zone; the server works out each slot's next start as
 * an instant (DST-correct), and this formats it where the viewer is. Before hydration it shows the
 * host's own clock, labelled as such, so the server and the first paint agree.
 *
 * "Live now" when a connected Twitch or Kick channel is streaming (lib/connectedLive).
 */
export default function CreatorSchedule({
  slots,
  hostTz,
  live,
}: {
  slots: ShownSlot[];
  hostTz: string | null;
  /** The connected channels that are live right now, with where to watch. */
  live: { label: string; url: string }[];
}) {
  const inBrowser = useInBrowser();
  if (slots.length === 0 && live.length === 0) return null;

  return (
    <section className="mt-8" aria-label="Stream schedule">
      <h2 className="mb-3 flex flex-wrap items-center gap-2.5 text-lg font-semibold">
        <span className="h-5 w-1 rounded-full bg-gold" aria-hidden />
        Stream schedule
        {live.map((l) => (
          <a
            key={l.label}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-0.5 text-[12px] font-semibold text-red-300 hover:border-red-400"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" aria-hidden />
            Live now on {l.label}
          </a>
        ))}
      </h2>
      {slots.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {slots.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-card-border bg-card-bg px-4 py-2.5">
              <span className="min-w-0 truncate text-[14px]">{s.label || 'Stream'}</span>
              <span className="shrink-0 text-right font-mono text-[13px] text-text-muted">
                {inBrowser ? (
                  <>
                    {formatSlotTime(s.startsAt)} <span className="text-text-dim">your time</span>
                  </>
                ) : (
                  <>
                    {formatSlotTime(s.startsAt, hostTz ?? 'UTC')} <span className="text-text-dim">host&rsquo;s time</span>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
