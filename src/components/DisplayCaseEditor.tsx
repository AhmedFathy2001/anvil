'use client';

import { useMemo, useState, type ReactNode } from 'react';

import CaseIcon from '@/components/CaseIcon';
import ClanLink from '@/components/ClanLink';
import { caseDate, caseGp, DisplayCaseCard } from '@/components/DisplayCase';
import { clanFetch } from '@/lib/clanFetch';
import type { DisplayCaseCandidate, DisplayCaseEntry } from '@/lib/displayCase';

// Arranging your display case, on "your account across Anvil". Pins come from your own drops,
// collection log, kill counts and personal bests only (the server proves each one is yours); the slot
// count is your tier now.

const SHOW = 60;

type Tab = 'item' | 'kc' | 'pb';
const TABS: { id: Tab; label: string; empty: string }[] = [
  { id: 'item', label: 'Items', empty: 'Items appear once the plugin has seen your collection log or your drops on a verified character.' },
  { id: 'kc', label: 'Kill counts', empty: 'Kill counts appear once the hiscores or the plugin show a kill on a verified character.' },
  { id: 'pb', label: 'Personal bests', empty: 'Times appear once the plugin has seen your personal bests on a verified character.' },
];

function tabOf(kind: DisplayCaseCandidate['kind']): Tab {
  return kind === 'kc' || kind === 'pb' ? kind : 'item';
}

/** One identity for a pin and the candidate it came from, so the picker can say "Pinned". */
function pinKey(p: Pick<DisplayCaseCandidate, 'kind' | 'accountId' | 'itemId' | 'statKey'>): string {
  return p.kind === 'kc' || p.kind === 'pb' ? `${p.kind}:${p.accountId}:${p.statKey}` : `${p.kind}:${p.accountId}:${p.itemId}`;
}

function pinBody(c: DisplayCaseCandidate) {
  if (c.kind === 'drop') return { kind: 'drop', momentId: c.momentId };
  if (c.kind === 'clog') return { kind: 'clog', accountId: c.accountId, itemId: c.itemId };
  return { kind: c.kind, accountId: c.accountId, statKey: c.statKey };
}

export default function DisplayCaseEditor({ initialPins, slots }: { initialPins: DisplayCaseEntry[]; slots: number }) {
  const [pins, setPins] = useState(initialPins);
  const [candidates, setCandidates] = useState<DisplayCaseCandidate[] | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('item');
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
      const body = pinBody(c);
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

  const pinnedKeys = useMemo(() => new Set(pins.map(pinKey)), [pins]);
  const shown = useMemo(() => {
    if (!candidates) return [];
    const q = query.trim().toLowerCase();
    return candidates
      .filter((c) => tabOf(c.kind) === tab && (!q || c.name.toLowerCase().includes(q) || (c.source ?? '').toLowerCase().includes(q) || c.rsn.toLowerCase().includes(q)))
      .sort((a, b) =>
        tab === 'item' ? (b.valueGp ?? 0) - (a.valueGp ?? 0) : tab === 'kc' ? (b.kc ?? 0) - (a.kc ?? 0) : a.name.localeCompare(b.name),
      )
      .slice(0, SHOW);
  }, [candidates, query, tab]);

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
            {open ? 'Done' : '+ Add to case'}
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
        <p className="text-sm text-text-muted">Nothing pinned yet. Pick from your drops, collection log, kill counts and personal bests.</p>
      )}

      {open && (
        <div className="mt-4 border-t border-card-border pt-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              aria-label="Search what you can pin"
              maxLength={60}
              className="min-w-0 flex-1 rounded-lg border border-card-border bg-brown-dark/60 px-3 py-1.5 text-sm"
            />
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-full border px-2.5 py-1 text-xs ${tab === t.id ? 'border-gold/60 text-gold' : 'border-card-border text-text-muted'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {candidates == null ? (
            <p className="text-sm text-text-muted">Loading…</p>
          ) : shown.length === 0 ? (
            <p className="text-sm text-text-muted">
              {query.trim() ? 'Nothing matches that.' : `Nothing here yet. ${TABS.find((t) => t.id === tab)!.empty}`}
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-card-border overflow-y-auto rounded-lg border border-card-border">
              {shown.map((c) => {
                const pinned = pinnedKeys.has(pinKey(c));
                const gp = caseGp(c.valueGp);
                const when = caseDate(c.when);
                return (
                  <li key={c.key} className="flex items-center gap-3 px-3 py-2">
                    <CaseIcon src={c.icon} width={30} height={27} className="shrink-0 max-h-8 max-w-8 object-contain" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">
                        {c.headline ? (
                          <>
                            <span className="font-mono text-gold-light">{c.headline}</span> {c.name}
                          </>
                        ) : (
                          c.name
                        )}
                      </span>
                      <span className="block truncate text-[11.5px] text-text-dim">
                        {c.kind === 'drop' ? 'Drop' : c.kind === 'clog' ? 'Log' : c.kind === 'kc' ? 'Kill count' : 'Personal best'} · {c.rsn}
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
