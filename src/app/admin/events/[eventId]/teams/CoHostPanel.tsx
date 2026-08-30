'use client';

import { useState } from 'react';

import { clanFetch } from '@/lib/clanFetch';
import type { CohostRow } from '@/lib/coHost';
import type { EventSettlement } from '@/lib/coHostSettlement';

/** Compact gp: 3,000,000 → "3M". */
function gp(n: number): string {
  const sign = n < 0 ? '−' : '';
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${sign}${(a / 1_000_000).toFixed(a % 1_000_000 === 0 ? 0 : 1)}M`;
  if (a >= 1_000) return `${sign}${(a / 1_000).toFixed(a % 1_000 === 0 ? 0 : 1)}K`;
  return `${sign}${a}`;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'invited · pending', cls: 'text-text-muted border-card-border' },
  accepted: { label: 'co-hosting', cls: 'text-accent-green-light border-accent-green/40 bg-accent-green/10' },
  declined: { label: 'declined', cls: 'text-accent-red border-accent-red/40' },
};

function crestStyle(slug: string): React.CSSProperties {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) % 360;
  return { background: `linear-gradient(135deg, hsl(${h} 42% 40%), hsl(${(h + 34) % 360} 52% 54%))` };
}

const CASH: { value: string; label: string; hint: string }[] = [
  { value: 'host-holds', label: 'Host holds the pot', hint: 'You collect every fee and pay every winner.' },
  { value: 'each-settles', label: 'Each clan settles its own', hint: 'Every clan collects its members’ fees and pays its own.' },
  { value: 'clans-collect-host-pays', label: 'Clans collect → host pays', hint: 'Clans gather fees into your pot; you pay all winners.' },
];

/**
 * Host-side co-host management — invite other clans to help run this event, and see where each stands.
 * Each accepted co-host becomes a team of its own on the board below, run by that clan's staff.
 */
export default function CoHostPanel({
  eventId,
  initial,
  cashPolicy: initialCashPolicy,
  settlement: initialSettlement,
}: {
  eventId: number;
  initial: CohostRow[];
  cashPolicy: string;
  settlement: EventSettlement | null;
}) {
  const [cohosts, setCohosts] = useState(initial);
  const [cashPolicy, setCashPolicy] = useState(initialCashPolicy);
  const [settlement, setSettlement] = useState(initialSettlement);
  const [slug, setSlug] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setCash(value: string) {
    const prev = cashPolicy;
    setCashPolicy(value);
    const res = await clanFetch(`/api/events/${eventId}/co-hosts`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cashPolicy: value }),
    });
    if (!res.ok) setCashPolicy(prev);
  }

  async function refresh() {
    const res = await clanFetch(`/api/events/${eventId}/co-hosts`);
    if (res.ok) {
      const data = await res.json();
      setCohosts(data.cohosts ?? []);
      setSettlement(data.settlement ?? null);
    }
  }

  async function end(id: number, name: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await clanFetch(`/api/cohosts/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? `Could not remove ${name}`);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function invite() {
    const clanSlug = slug.trim().toLowerCase();
    if (!clanSlug) return;
    setBusy(true);
    setError(null);
    try {
      const res = await clanFetch(`/api/events/${eventId}/co-hosts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clanSlug }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? 'Could not invite');
      if (data?.created === false) {
        // Already pending or already accepted — nothing happened, and saying so beats a cleared box
        // that looks like it worked. (A DECLINED row is re-opened server-side and comes back
        // `created: true`, so this no longer fires for the case that used to be a dead end.)
        setError('That clan is already on this event.');
      }
      setSlug('');
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-card-border bg-card-bg">
      <div className="flex items-center gap-2.5 border-b border-card-border px-5 py-3.5">
        <span className="molten h-5 w-1 shrink-0 rounded-sm" />
        <h2 className="text-[15px] font-semibold">Co-hosts</h2>
        <span className="ml-auto text-[12px] text-text-muted">Invite other clans to run a team here.</span>
      </div>

      {cohosts.length > 0 && (
        <ul className="divide-y divide-card-border">
          {cohosts.map((c) => {
            const st = STATUS[c.status] ?? STATUS.pending;
            return (
              <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[13px] font-bold text-white" style={crestStyle(c.clanSlug)}>
                  {c.clanName.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-medium">{c.clanName}</div>
                  <div className="font-mono text-[11px] text-text-muted">c / {c.clanSlug}</div>
                </div>
                <span className={`ml-auto shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] ${st.cls}`}>{st.label}</span>
                {/* There was no way to undo any of this from either side. `declineCoHostInvite` even
                    told an accepted co-host to "leave the event instead", pointing at a thing that
                    did not exist. Refused once the event starts — by then their team is on the board
                    and unwinding it is a scoring decision, not a membership one. */}
                <button
                  type="button"
                  onClick={() => end(c.id, c.clanName)}
                  disabled={busy}
                  className="shrink-0 rounded-lg border border-card-border px-2.5 py-1 text-[11.5px] text-text-muted transition-colors hover:border-accent-red/40 hover:text-accent-red disabled:opacity-50"
                >
                  {c.status === 'accepted' ? 'Remove' : 'Withdraw'}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-1 rounded-lg border border-card-border bg-background px-3 py-2 text-sm focus-within:border-gold/50">
          <span className="font-mono text-[13px] text-text-muted">anvilosrs.com/c/</span>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value.replace(/[^a-z0-9-]/gi, '').toLowerCase())}
            onKeyDown={(e) => e.key === 'Enter' && invite()}
            placeholder="clan-slug"
            className="flex-1 bg-transparent font-mono text-[13px] text-foreground outline-none placeholder:text-text-muted/50"
          />
        </div>
        <button
          type="button"
          onClick={invite}
          disabled={busy || !slug.trim()}
          className="shrink-0 rounded-lg bg-gold px-4 py-2 text-[13px] font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
        >
          {busy ? 'Inviting…' : 'Invite'}
        </button>
      </div>
      {error && <p className="px-5 pb-3 text-[12.5px] text-accent-red">{error}</p>}
      <p className="px-5 pb-4 text-[12px] text-text-muted">
        On accept, the clan gets its own team here and its staff can run it — roster, proof, their
        players’ fees. Subs, the board and the payout stay yours.
      </p>

      {/* Who holds the cash */}
      <div className="border-t border-card-border px-5 py-4">
        <div className="mb-2.5 text-[13px] font-semibold">Who holds the cash</div>
        <div className="flex flex-col gap-2">
          {CASH.map((c) => {
            const active = c.value === cashPolicy;
            return (
              <label
                key={c.value}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                  active ? 'border-gold/50 bg-gold/[0.06]' : 'border-card-border bg-background hover:border-gold/30'
                }`}
              >
                <input type="radio" name="cashPolicy" checked={active} onChange={() => setCash(c.value)} className="mt-0.5 h-4 w-4 accent-gold" />
                <span>
                  <span className={`block text-[13.5px] font-medium ${active ? 'text-gold' : ''}`}>{c.label}</span>
                  <span className="mt-0.5 block text-[12.5px] text-text-muted">{c.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Settlement — the policy made concrete, once there's a co-host and a fee. */}
      {settlement?.relevant && (
        <div className="border-t border-card-border px-5 py-4">
          <div className="mb-1 text-[13px] font-semibold">Settlement</div>
          <p className="mb-2.5 text-[12px] text-text-muted">
            {cashPolicy === 'each-settles'
              ? 'Each clan keeps its members’ fees and pays its own winners — net is that clan’s surplus.'
              : 'The host holds the pot — net is what the host owes each clan (winnings − fees in).'}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-text-muted">
                  <th className="py-1 pr-3 font-medium">Clan</th>
                  <th className="px-3 py-1 text-right font-medium">Entrants</th>
                  <th className="px-3 py-1 text-right font-medium">Fees in</th>
                  <th className="px-3 py-1 text-right font-medium">Winnings</th>
                  <th className="py-1 pl-3 text-right font-medium">Net</th>
                </tr>
              </thead>
              <tbody>
                {settlement.clans.map((c) => (
                  <tr key={c.clanId} className="border-t border-card-border/60">
                    <td className="py-1.5 pr-3">
                      {c.name}
                      {c.isHost && <span className="ml-1.5 rounded-full bg-gold/15 px-1.5 py-0.5 text-[10px] text-gold">host</span>}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{c.entrants}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{gp(c.fees)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{gp(c.winnings)}</td>
                    <td className={`py-1.5 pl-3 text-right font-medium tabular-nums ${c.net > 0 ? 'text-accent-green-light' : c.net < 0 ? 'text-accent-red' : ''}`}>
                      {gp(c.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
