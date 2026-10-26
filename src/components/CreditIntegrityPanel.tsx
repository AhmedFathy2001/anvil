'use client';

import { useEffect, useState } from 'react';

import { clanFetch } from '@/lib/clanFetch';
import { hiscoresKeyLabel } from '@/lib/killSource';

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

/** A per-player reason for a look (lib/footprintCheck), until staff mark it fine. */
interface Signal {
  id: number;
  kind: string;
  detail: string | null;
  playerId: number;
  rsn: string;
}

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

/**
 * What a signal says, and how much it weighs: 3 strong, 2 medium, 1 weak. A weak one is shown only
 * beside another signal for the same player — alone it is just how some people play.
 */
function signalText(s: Signal): { tag: string; text: string; weight: number } {
  let d: {
    key?: string; kc?: number; hours?: number; windowHours?: number; pbSeconds?: number; runSeconds?: number;
    offShare?: number; zones?: string[]; usual?: string | null; other?: string; sameTeam?: boolean; countries?: string[];
  } = {};
  try {
    d = s.detail ? JSON.parse(s.detail) : {};
  } catch {
    /* show the generic line */
  }
  const kind = s.kind.split(':')[0];
  switch (kind) {
    case 'first_service_kill':
      return { weight: 3, tag: 'first kill', text: `No ranked ${hiscoresKeyLabel(d.key ?? '')} KC before the event; ${d.kc ?? 'some'} now. Content people often pay someone else to do.` };
    case 'long_hours':
      return { weight: 3, tag: 'long hours', text: `Gains worth at least ${d.hours} hours of efficient play in ${d.windowHours} hours — more than one person usually plays.` };
    case 'other_login':
      return { weight: 3, tag: 'other login', text: 'Played through a different Anvil login during the event — somebody else\'s RuneLite. Also what a shared family PC looks like.' };
    case 'pb_jump':
      return { weight: 2, tag: 'PB jump', text: `${hiscoresKeyLabel(d.key ?? '')} in ${mmss(d.runSeconds ?? 0)}; their best before the event was ${mmss(d.pbSeconds ?? 0)}.` };
    case 'two_countries':
      return { weight: 2, tag: 'two countries', text: `Their plugin connected from ${(d.countries ?? []).join(' and ')} within three hours.` };
    case 'shared_network':
      return d.sameTeam
        ? { weight: 1, tag: 'same network', text: `Same network as teammate ${d.other} — one machine playing two accounts, or one household.` }
        : { weight: 2, tag: 'same network', text: `Same network as ${d.other}, on another team — one household, or one person on both sides.` };
    case 'timezone_change':
      return { weight: 1, tag: 'timezone', text: `Proof PC timezone ${(d.zones ?? []).join(', ')}${d.usual ? `; earlier proofs were ${d.usual}` : ''}.` };
    case 'schedule_shift':
      return { weight: 1, tag: 'new hours', text: `${d.offShare}% of their event activity is at hours they never played before.` };
    default:
      return { weight: 1, tag: 'check', text: s.kind };
  }
}

/**
 * Boss-kill credits that do not add up (lib/creditIntegrity) — on the event Overview while it runs
 * and after. Silent when there is nothing to say: an honest board shows no panel at all, so the panel
 * appearing is itself the signal. Each row is a reason to open the tile and look, not a verdict.
 */
export default function CreditIntegrityPanel({ eventId }: { eventId: number }) {
  const [flags, setFlags] = useState<Flag[] | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    clanFetch(`/api/admin/events/${eventId}/integrity`)
      .then((r) => (r.ok ? r.json() : { flags: [] }))
      .then((d: { flags?: Flag[]; signals?: Signal[] }) => {
        if (!live) return;
        setFlags(d.flags ?? []);
        setSignals(d.signals ?? []);
      })
      .catch(() => live && setFlags([]));
    return () => {
      live = false;
    };
  }, [eventId]);

  async function looksFine(id: number) {
    setBusy(id);
    const res = await clanFetch(`/api/admin/events/${eventId}/integrity`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signalId: id }),
    }).catch(() => null);
    setBusy(null);
    if (res?.ok) setSignals((prev) => prev.filter((s) => s.id !== id));
  }

  // Strongest first; a weak signal only next to another one for the same player.
  const read = signals.map((s) => ({ s, ...signalText(s) }));
  const count = new Map<number, number>();
  for (const r of read) count.set(r.s.playerId, (count.get(r.s.playerId) ?? 0) + 1);
  const shown = read
    .filter((r) => r.weight > 1 || (count.get(r.s.playerId) ?? 0) > 1)
    .sort((a, b) => b.weight - a.weight || a.s.rsn.localeCompare(b.s.rsn));

  if (!flags || (flags.length === 0 && shown.length === 0)) return null;

  return (
    <section className="border border-yellow-500/40 rounded-xl bg-card-bg p-5">
      <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
        <span className="w-1 h-5 bg-gold rounded-full" />
        Credits &amp; players to check
        <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-300">{flags.length + shown.length}</span>
      </h2>
      <p className="text-sm text-text-muted mb-3 max-w-[75ch]">
        These boss kills don&rsquo;t match outside evidence: more than the player&rsquo;s hiscores KC rose by,
        or more in an hour than the boss allows. The hiscores lag, so a recent grind can show here for an
        hour or so. Open the tile and check the screenshots before acting. Player lines are patterns that
        boosting and account sharing leave behind; honest players can show them too. Only staff see this.
      </p>
      <ul className="grid gap-2">
        {shown.map(({ s, tag, text }) => {
          return (
            <li
              key={`signal-${s.id}`}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border border-card-border rounded-lg px-3 py-2 text-sm"
            >
              <span className="font-semibold">{s.rsn}</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-300">{tag}</span>
              <button
                type="button"
                onClick={() => looksFine(s.id)}
                disabled={busy === s.id}
                className="ml-auto text-xs text-text-muted hover:text-gold disabled:opacity-50"
              >
                Looks fine
              </button>
              <span className="text-xs text-text-muted basis-full">{text}</span>
            </li>
          );
        })}
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
