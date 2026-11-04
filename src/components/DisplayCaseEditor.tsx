'use client';

import { useMemo, useState, type ReactNode } from 'react';

import ClanLink from '@/components/ClanLink';
import { caseDate, caseGp, DisplayCaseCard } from '@/components/DisplayCase';
import { clanFetch } from '@/lib/clanFetch';
import type { DisplayCaseCandidate, DisplayCaseEntry } from '@/lib/displayCase';

// Arranging your display case, on "your account across Anvil". Pins come from your own drops and
// collection log only (the server proves each one is yours); the slot count is your tier now.

const SHOW = 60;

export default function DisplayCaseEditor({ initialPins, slots }: { initialPins: DisplayCaseEntry[]; slots: number }) {
  const [pins, setPins] = useState(initialPins);
  const [candidates, setCandidates] = useState<DisplayCaseCandidate[] | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<'all' | 'drop' | 'clog'>('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function reload() {
    const res = await clanFetch('/api/profile/display-case');
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      setError('Could not load your items — try again.');
      return;
    }
    setPins(data.pins);
    setCandidates(data.candidates);
  }

  async function openPicker() {
    setOpen(true);
    if (candidates == null) await reload();
  }

  async function pin(c: DisplayCaseCandidate) {
    setError('');
    setBusy(true);
    try {
      const body = c.kind === 'drop' ? { kind: 'drop', momentId: c.momentId } : { kind: 'clog', accountId: c.accountId, itemId: c.itemId };
      const res = await clanFetch('/api/profile/display-case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not pin that.');
        return;
      }
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function unpin(id: number) {
    setError('');
    setBusy(true);
    try {
      const res = await clanFetch(`/api/profile/display-case?id=${id}`, { method: 'DELETE' });
      if (!res.ok) setError('Could not take that out — try again.');
      else setPins((p) => p.filter((e) => e.id !== id));
    } finally {
      setBusy(false);
    }
  }

  async function move(index: number, by: -1 | 1) {
    const to = index + by;
    if (to < 0 || to >= pins.length) return;
    const next = [...pins];
    [next[index], next[to]] = [next[to], next[index]];
    setPins(next);
    const res = await clanFetch('/api/profile/display-case', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: next.map((e) => e.id) }),
    });
    if (!res.ok) setError('Could not save the new order.');
  }

  const pinnedKeys = useMemo(
    () => new Set(pins.map((p) => (p.kind === 'clog' ? `clog:${p.accountId}:${p.itemId}` : `drop:${p.accountId}:${p.itemId}`))),
    [pins],
  );
  const shown = useMemo(() => {
    if (!candidates) return [];
    const q = query.trim().toLowerCase();
    return candidates
      .filter((c) => (source === 'all' || c.kind === source) && (!q || c.name.toLowerCase().includes(q) || (c.source ?? '').toLowerCase().includes(q)))
      .sort((a, b) => (b.valueGp ?? 0) - (a.valueGp ?? 0))
      .slice(0, SHOW);
  }, [candidates, query, source]);

  const full = pins.length >= slots;

  if (slots === 0 && pins.length === 0) {
    return (
      <p className="rounded-xl border border-card-border bg-card-bg p-4 text-sm text-text-muted">
        Pin your best drops to a display case on your profile —{' '}
        <ClanLink href="/supporter" className="text-gold hover:text-gold-light">
          4 slots with Anvil Supporter, 8 with Champion, 12 with Patron
        </ClanLink>
        .
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-text-muted">
          {Math.min(pins.length, slots)} of {slots} slots used
        </span>
        {slots === 0 && pins.length > 0 && (
          <span className="text-[13px] text-text-muted">
            · hidden while you&rsquo;re not a Supporter — your pins are kept.{' '}
            <ClanLink href="/supporter" className="text-gold hover:text-gold-light">
              Bring it back
            </ClanLink>
          </span>
        )}
        {slots > 0 && (
          <button
            type="button"
            onClick={() => void (open ? setOpen(false) : openPicker())}
            className="ml-auto rounded-lg border border-card-border px-3 py-1.5 text-sm transition-colors hover:border-gold/45"
          >
            {open ? 'Done' : '+ Pin an item'}
          </button>
        )}
      </div>

      {pins.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {pins.map((e, i) => (
            <li key={e.id} className={i >= slots ? 'opacity-45' : undefined} title={i >= slots ? 'Over your slots — not shown' : undefined}>
              <DisplayCaseCard
                entry={e}
                actions={
                  <span className="mt-2 flex items-center gap-1">
                    <IconButton label={`Move ${e.name} left`} disabled={busy || i === 0} onClick={() => void move(i, -1)}>
                      ←
                    </IconButton>
                    <IconButton label={`Move ${e.name} right`} disabled={busy || i === pins.length - 1} onClick={() => void move(i, 1)}>
                      →
                    </IconButton>
                    <IconButton label={`Take ${e.name} out`} disabled={busy} onClick={() => void unpin(e.id)}>
                      ×
                    </IconButton>
                  </span>
                }
              />
              {!e.shared && (
                <p className="mt-1 text-center text-[11px] text-text-dim">Only you see this — {e.rsn} isn&rsquo;t shared</p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-muted">Nothing pinned yet. Pick from your drops and collection log.</p>
      )}

      {open && (
        <div className="mt-4 border-t border-card-border pt-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your items"
              aria-label="Search your items"
              maxLength={60}
              className="min-w-0 flex-1 rounded-lg border border-card-border bg-brown-dark/60 px-3 py-1.5 text-sm"
            />
            {(['all', 'drop', 'clog'] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={source === k}
                onClick={() => setSource(k)}
                className={`rounded-full border px-2.5 py-1 text-xs ${source === k ? 'border-gold/60 text-gold' : 'border-card-border text-text-muted'}`}
              >
                {k === 'all' ? 'All' : k === 'drop' ? 'Drops' : 'Collection log'}
              </button>
            ))}
          </div>
          {candidates == null ? (
            <p className="text-sm text-text-muted">Loading your items…</p>
          ) : shown.length === 0 ? (
            <p className="text-sm text-text-muted">
              Nothing here yet. Items appear once the plugin has seen your collection log or your drops on a verified character.
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-card-border overflow-y-auto rounded-lg border border-card-border">
              {shown.map((c) => {
                const pinned = pinnedKeys.has(c.kind === 'clog' ? `clog:${c.accountId}:${c.itemId}` : `drop:${c.accountId}:${c.itemId}`);
                const gp = caseGp(c.valueGp);
                const when = caseDate(c.when);
                return (
                  <li key={c.key} className="flex items-center gap-3 px-3 py-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.icon} alt="" width={30} height={27} loading="lazy" className="shrink-0 [image-rendering:pixelated]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{c.name}</span>
                      <span className="block truncate text-[11.5px] text-text-dim">
                        {c.kind === 'drop' ? 'Drop' : 'Log'} · {c.rsn}
                        {c.source ? ` · ${c.source}` : ''}
                        {gp ? ` · ${gp}` : ''}
                        {when ? ` · ${when}` : ''}
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={busy || pinned || full}
                      onClick={() => void pin(c)}
                      className="shrink-0 rounded-lg border border-card-border px-2.5 py-1 text-xs transition-colors hover:border-gold/45 disabled:opacity-50"
                    >
                      {pinned ? 'Pinned' : 'Pin to display case'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {full && <p className="mt-2 text-[12.5px] text-text-muted">Your case is full — take one out to pin another.</p>}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

function IconButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded-md border border-card-border text-sm text-text-muted transition-colors hover:border-gold/45 hover:text-gold disabled:opacity-40"
    >
      {children}
    </button>
  );
}
