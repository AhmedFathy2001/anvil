'use client';

import { useEffect, useState } from 'react';

import ClanLink from '@/components/ClanLink';
import SupporterName from '@/components/SupporterName';
import LocalTime from '@/components/LocalTime';
import { SUPPORTER_TIERS, SUPPORTER_TIER_ORDER, type SupporterTierId } from '@/lib/supporterTiers';
import Select from '@/components/Select';

interface State {
  lab: { tier: SupporterTierId; endsAt: string | null; startedAt: string } | null;
  effective: SupporterTierId | null;
  dummies: { rsn: string; tier: SupporterTierId | null }[];
  drops: number;
}

const MONTHS = [0, 3, 6, 12, 24, 36];

export default function SupporterLabClient() {
  const [state, setState] = useState<State | null>(null);
  const [months, setMonths] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const res = await fetch('/api/staff/lab/supporter');
    if (res.ok) show(await res.json());
  }
  // The picker follows the grant in force, so pressing a tier keeps its tenure.
  function show(next: State) {
    setState(next);
    if (next.lab) {
      const start = new Date(next.lab.startedAt);
      const now = new Date();
      const m = (now.getUTCFullYear() - start.getUTCFullYear()) * 12 + now.getUTCMonth() - start.getUTCMonth();
      setMonths(MONTHS.reduce((best, x) => (Math.abs(x - m) < Math.abs(best - m) ? x : best), 0));
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot mount fetch
  }, []);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError('');
    const res = await fetch('/api/staff/lab/supporter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? 'That didn’t work.');
    show(data);
  }

  const btn = 'rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:opacity-50';
  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-card-border bg-card-bg p-4">
        <h2 className="font-semibold">Your tier</h2>
        <p className="mt-1 text-sm text-text-muted">
          A lab grant lasts 24 hours and never touches Gumroad. Everyone sees it, like a real one: your name on the
          site, the plugin panel and your Discord posts. A real paid tier above it still wins.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" disabled={busy} onClick={() => act({ action: 'tier', tier: null })}
            className={`${btn} ${!state?.lab ? 'border-gold/60 text-gold' : 'border-card-border text-text-muted hover:border-gold/40'}`}>
            None
          </button>
          {SUPPORTER_TIER_ORDER.map((t) => (
            <button key={t} type="button" disabled={busy} onClick={() => act({ action: 'tier', tier: t, months })}
              className={`${btn} ${state?.lab?.tier === t ? 'border-gold/60 bg-gold/10' : 'border-card-border hover:border-gold/40'}`}>
              <SupporterName name={SUPPORTER_TIERS[t].name} tier={t} plain />
            </button>
          ))}
          <label className="ml-2 flex items-center gap-2 text-sm text-text-muted">
            supporting for
            <Select
              value={String(months)}
              onChange={(v) => {
                const m = Number(v);
                setMonths(m);
                if (state?.lab) void act({ action: 'tier', tier: state.lab.tier, months: m });
              }}
              options={MONTHS.map((m) => ({ value: String(m), label: `${m} months` }))}
              ariaLabel="Supporting for"
              className="w-32"
            />
          </label>
        </div>
        {state && (
          <p className="mt-3 text-sm text-text-muted">
            {state.lab ? (
              <>Lab grant: <b>{SUPPORTER_TIERS[state.lab.tier].name}</b>{state.lab.endsAt && <>, ends <LocalTime date={state.lab.endsAt} /></>}. </>
            ) : (
              <>No lab grant. </>
            )}
            Everyone sees you as: <b>{state.effective ? SUPPORTER_TIERS[state.effective].name : 'not a supporter'}</b>.{' '}
            <ClanLink href="/profile" className="text-gold hover:underline">Your profile</ClanLink>
            {' · '}
            <ClanLink href="/supporter" className="text-gold hover:underline">Tier page</ClanLink>
          </p>
        )}
      </section>

      <section className="rounded-xl border border-card-border bg-card-bg p-4">
        <h2 className="font-semibold">Lab clan tenure</h2>
        <p className="mt-1 text-sm text-text-muted">
          The lab clan&rsquo;s &ldquo;Backing Anvil for N&rdquo; badge, as if it had paid that long. Shows on its public home, the
          /clans card and the plugin clan card. Never touches a real subscription.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => act({ action: 'clan-tenure', months: null })}
            className={`${btn} border-card-border text-text-muted hover:border-gold/40`}>
            None
          </button>
          {[1, 3, 6, 12, 24, 36].map((m) => (
            <button key={m} type="button" disabled={busy} onClick={() => act({ action: 'clan-tenure', months: m })}
              className={`${btn} border-card-border hover:border-gold/40`}>
              {m < 12 ? `${m} mo` : `${m / 12} yr`}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-card-border bg-card-bg p-4">
        <h2 className="font-semibold">Test drops in the plugin</h2>
        <p className="mt-1 text-sm text-text-muted">
          Four test clanmates (one per tier, one free) in the hidden lab clan post drops. In the plugin: Lookup → search
          <b> lab</b> → <b>Anvil Tile Lab (staff)</b> → Recent drops. GZ any line; give gold with a tier above.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => act({ action: 'seed', count: 6 })}
            className={`${btn} border-gold/40 text-gold hover:bg-gold/10`}>
            Add 6 test drops
          </button>
          <button type="button" disabled={busy || !state?.drops} onClick={() => act({ action: 'clear' })}
            className={`${btn} border-card-border text-text-muted hover:border-gold/40`}>
            Clear test drops
          </button>
        </div>
        {state && (
          <p className="mt-3 text-sm text-text-muted">
            {state.drops} test drop{state.drops === 1 ? '' : 's'}.{' '}
            {state.dummies.length > 0 && (
              <>Clanmates: {state.dummies.map((d, i) => (
                <span key={d.rsn}>{i > 0 && ', '}<SupporterName name={d.rsn} tier={d.tier} plain /></span>
              ))}</>
            )}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-card-border bg-card-bg p-4">
        <h2 className="font-semibold">Discord posts</h2>
        <p className="mt-1 text-sm text-text-muted">
          A supporter&rsquo;s drop, pet and log posts carry their tier&rsquo;s star beside their name. With a lab tier on,
          your own real posts show it; this is the look.
        </p>
        <div className="mt-3 space-y-2">
          {SUPPORTER_TIER_ORDER.map((t) => (
            <div key={t} className="flex items-center gap-2 rounded-md border-l-4 border-gold/70 bg-background/50 px-3 py-2 text-sm">
              {/* eslint-disable-next-line @next/next/no-img-element -- the exact file Discord fetches */}
              <img src={`/icons/supporter-${t}.png`} alt="" width={20} height={20} className="rounded-full" />
              <span className="font-semibold">Zezima</span>
              <span className="text-text-dim">· {SUPPORTER_TIERS[t].name}</span>
            </div>
          ))}
        </div>
      </section>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
