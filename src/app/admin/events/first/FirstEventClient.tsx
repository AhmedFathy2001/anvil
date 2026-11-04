'use client';

import { useState } from 'react';
import ClanLink from '@/components/ClanLink';
import DateRangeField from '@/components/DateRangeField';
import Input from '@/components/Input';
import { clanFetch, clanUrl } from '@/lib/clanFetch';

/**
 * Three formats, as big cards. Each maps to an existing event mode on its default size; the full
 * wizard (/admin/events/new?format=…) is where every other choice lives.
 */
const FORMATS = [
  { key: 'classic', title: 'Bingo', line: 'A 5×5 grid of tasks. Most tiles wins.', format: 'bingo', scoringMode: 'tiles', size: 5 },
  { key: 'leagues', title: 'Points board', line: 'A list of tasks worth points. Highest score wins.', format: 'bingo', scoringMode: 'points', size: 20 },
  { key: 'race', title: 'Team race', line: 'Tasks in order. Furthest along wins.', format: 'tilerace', scoringMode: 'tiles', size: 10 },
] as const;

type FormatKey = (typeof FORMATS)[number]['key'];

export default function FirstEventClient({ suggestedName, first }: { suggestedName: string; first: boolean }) {
  const [name, setName] = useState(suggestedName);
  const [startIso, setStartIso] = useState('');
  const [endIso, setEndIso] = useState('');
  const [pick, setPick] = useState<FormatKey>('classic');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const f = FORMATS.find((x) => x.key === pick)!;
    setBusy(true);
    setError(null);
    try {
      const res = await clanFetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          boardSize: f.size,
          format: f.format,
          scoringMode: f.scoringMode,
          ...(startIso ? { startDate: startIso } : {}),
          ...(endIso ? { endDate: endIso } : {}),
        }),
      });
      const data: { id?: number; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok || !data.id) {
        setError(data.error || 'That didn’t work. Try again.');
        return;
      }
      setCreated(data.id);
    } finally {
      setBusy(false);
    }
  }

  if (created != null) {
    const link = `${window.location.origin}${clanUrl(`/events/${created}`)}`;
    return (
      <div className="mx-auto max-w-xl py-6">
        <div className="rounded-2xl border border-gold/30 bg-card-bg p-8 text-center">
          <h1 className="display text-3xl font-semibold">Your event is ready</h1>
          <p className="mt-2 text-text-muted">Share this link on stream or in Discord.</p>
          <p className="mt-4 break-all rounded-lg bg-brown-dark px-3 py-2 font-mono text-sm text-foreground">{link}</p>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
            className="mt-5 w-full rounded-xl bg-gold px-6 py-4 text-lg font-semibold text-brown-dark transition-colors hover:bg-gold-light"
          >
            {copied ? 'Copied!' : 'Copy invite link'}
          </button>
        </div>
        <p className="mt-4 text-center text-[13px] text-text-dim">
          <ClanLink href={`/admin/events/${created}`} className="hover:text-gold">
            Fill in your tiles
          </ClanLink>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={create} className="mx-auto max-w-2xl py-2">
      <h1 className="display text-3xl font-semibold sm:text-4xl">{first ? 'Create your first event' : 'New event'}</h1>

      <div className="mt-6">
        <label htmlFor="ev-name" className="mb-1.5 block text-base font-medium">
          Name
        </label>
        <Input
          id="ev-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={100}
          className="rounded-xl px-4 py-3 text-base"
        />
      </div>

      <div className="mt-6">
        <div className="mb-1.5 text-base font-medium">What kind?</div>
        <div className="grid gap-3 sm:grid-cols-3">
          {FORMATS.map((f) => {
            const on = pick === f.key;
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={on}
                onClick={() => setPick(f.key)}
                className={`rounded-xl border p-5 text-left transition-colors ${
                  on ? 'border-gold bg-gold/10' : 'border-card-border bg-card-bg hover:border-gold/40'
                }`}
              >
                <span className={`block text-lg font-semibold ${on ? 'text-gold' : ''}`}>{f.title}</span>
                <span className="mt-1 block text-sm text-text-muted">{f.line}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-1.5 text-base font-medium">When?</div>
        <DateRangeField
          startIso={startIso}
          endIso={endIso}
          onChange={({ startIso: a, endIso: b }) => {
            setStartIso(a);
            setEndIso(b);
          }}
          allowOpenEnded
        />
        <p className="mt-1.5 text-[13px] text-text-dim">Leave it empty to start it yourself.</p>
      </div>

      {error && <p className="mt-4 text-sm text-accent-red">{error}</p>}

      <button
        type="submit"
        disabled={busy || !name.trim()}
        className="mt-8 w-full rounded-xl bg-gold px-6 py-4 text-lg font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
      >
        {busy ? 'Creating…' : 'Create event'}
      </button>

      <p className="mt-4 text-center text-[13px]">
        <ClanLink href={`/admin/events/new?format=${pick}`} className="text-text-muted hover:text-gold">
          More options
        </ClanLink>
      </p>
    </form>
  );
}
