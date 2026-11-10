'use client';

import { useState } from 'react';

import Input from '@/components/Input';

type Option = { tier: string; months: number; name: string; usd: number; blocked: string | null };

const lengthLabel = (m: number) => (m === 12 ? '1 year' : `${m} month${m === 1 ? '' : 's'}`);

/**
 * Name a character, see what can be gifted to them (a tier they already pay for, or a lower one,
 * waits until their subscription ends), pick one, then go to the one-time checkout with it chosen.
 */
export default function GiftForm({ initial }: { initial: string }) {
  const [rsn, setRsn] = useState(initial);
  const [found, setFound] = useState<{ name: string; options: Option[] } | null>(null);
  const [pick, setPick] = useState<Option | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function call(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/supporter/gift', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { name?: string; url?: string; options?: Option[]; error?: string } | null;
    setBusy(false);
    if (!res?.ok || !data) {
      setError(data?.error ?? 'Could not check that name.');
      return null;
    }
    return data;
  }

  async function find() {
    setFound(null);
    setPick(null);
    const data = await call({ rsn });
    if (data?.name && data.options) {
      setFound({ name: data.name, options: data.options });
      setPick(data.options.find((o) => !o.blocked) ?? null);
    }
  }

  async function go() {
    if (!pick) return;
    const data = await call({ rsn, go: true, tier: pick.tier, months: pick.months });
    if (data?.url) window.location.href = data.url;
  }

  const tiers = found ? [...new Set(found.options.map((o) => o.tier))] : [];
  const reason = found?.options.find((o) => o.blocked)?.blocked ?? null;

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void find();
        }}
      >
        <label htmlFor="gift-rsn" className="text-sm font-medium">
          Their in-game name
        </label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="gift-rsn"
            value={rsn}
            maxLength={12}
            autoComplete="off"
            placeholder="e.g. Zezima"
            className="min-w-[12rem] flex-1"
            onChange={(e) => {
              setRsn(e.target.value);
              setFound(null);
              setPick(null);
            }}
          />
          <button
            type="submit"
            disabled={busy || rsn.trim().length === 0}
            className="rounded-lg border border-gold/50 px-4 py-2 text-sm font-semibold text-gold transition-colors hover:bg-gold/10 disabled:opacity-50"
          >
            Find them
          </button>
        </div>
      </form>

      {found && (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            Gifting <b className="text-gold-light">{found.name}</b>
          </p>
          <div className="grid gap-2" role="radiogroup" aria-label="Tier and length">
            {tiers.map((t) => (
              <div key={t} className="grid grid-cols-3 gap-2">
                {found.options
                  .filter((o) => o.tier === t)
                  .map((o) => {
                    const on = pick?.name === o.name;
                    return (
                      <button
                        key={o.name}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        disabled={!!o.blocked}
                        title={o.blocked ?? undefined}
                        onClick={() => setPick(o)}
                        className={`rounded-lg border px-3 py-2 text-left text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                          on ? 'border-gold bg-gold/10' : 'border-card-border hover:border-gold/50'
                        }`}
                      >
                        <span className="block font-semibold capitalize">{o.tier}</span>
                        <span className="text-text-muted">
                          {lengthLabel(o.months)} · ${o.usd}
                        </span>
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
          {reason && <p className="text-[12.5px] text-text-muted">{reason}</p>}
          {pick ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void go()}
              className="self-start rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
            >
              Gift {found.name} {lengthLabel(pick.months)} of {pick.tier[0].toUpperCase() + pick.tier.slice(1)} · ${pick.usd}
            </button>
          ) : (
            <p className="text-[13px] text-text-muted">Nothing can be gifted to them right now.</p>
          )}
          <p className="text-[12.5px] text-text-muted">
            You pay once on Gumroad and it never renews. It lands on their account when the payment clears, on top of any
            gifted time they already have.
          </p>
        </div>
      )}
      {error && <p className="text-[13px] text-red-400">{error}</p>}
    </div>
  );
}
