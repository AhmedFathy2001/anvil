'use client';

import { useEffect, useState } from 'react';

import { clanFetch } from '@/lib/clanFetch';

interface Flag {
  kind: 'hiscores' | 'rate';
  playerId: number;
  rsn: string;
  tileId: number;
  tileTitle: string;
  credited: number;
  allowed: number;
  detail: string;
}

/**
 * Boss-kill credits that do not add up (lib/creditIntegrity) — on the event Overview while it runs
 * and after. Silent when there is nothing to say: an honest board shows no panel at all, so the panel
 * appearing is itself the signal. Each row is a reason to open the tile and look, not a verdict.
 */
export default function CreditIntegrityPanel({ eventId }: { eventId: number }) {
  const [flags, setFlags] = useState<Flag[] | null>(null);

  useEffect(() => {
    let live = true;
    clanFetch(`/api/admin/events/${eventId}/integrity`)
      .then((r) => (r.ok ? r.json() : { flags: [] }))
      .then((d: { flags?: Flag[] }) => live && setFlags(d.flags ?? []))
      .catch(() => live && setFlags([]));
    return () => {
      live = false;
    };
  }, [eventId]);

  if (!flags || flags.length === 0) return null;

  return (
    <section className="border border-yellow-500/40 rounded-xl bg-card-bg p-5">
      <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
        <span className="w-1 h-5 bg-gold rounded-full" />
        Kill credits to check
        <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-300">{flags.length}</span>
      </h2>
      <p className="text-sm text-text-muted mb-3 max-w-[75ch]">
        These boss kills don&rsquo;t match outside evidence: more than the player&rsquo;s hiscores KC rose by,
        or more in an hour than the boss allows. The hiscores lag, so a recent grind can show here for an
        hour or so. Open the tile and check the screenshots before acting.
      </p>
      <ul className="grid gap-2">
        {flags.map((f) => (
          <li
            key={`${f.kind}-${f.playerId}-${f.tileId}`}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border border-card-border rounded-lg px-3 py-2 text-sm"
          >
            <span className="font-semibold">{f.rsn}</span>
            <span className="text-text-muted">{f.tileTitle}</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-300">
              {f.kind === 'hiscores' ? 'hiscores mismatch' : 'too fast'}
            </span>
            <span className="text-xs text-text-muted basis-full">{f.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
