'use client';

/* eslint-disable @next/next/no-img-element -- proof screenshots are user uploads of any size */

import { useCallback, useEffect, useRef, useState } from 'react';

import Select from '@/components/Select';
import { useDialog } from '@/components/Confirm';
import { clanFetch } from '@/lib/clanFetch';
import { pageCount, proofFeedSearch, type ProofFeedQuery, type ProofFlagFilter } from '@/lib/proofFeedQuery';
import { linkHost, type ProofAttachment } from '@/lib/proofAttachments';
import { FLAG_TEXT } from '../EventNextStep';
import { CheckboxBox } from '@/components/Checkbox';

/**
 * Every proof on one board, newest first (api/admin/events/[eventId]/proofs).
 *
 * Flagged proofs already have a queue. The rest count the moment they land and, before this, could
 * only be found tile by tile — so a bad screenshot that wasn't flagged was simply never seen. This is
 * the place to skim them: filter, look, and take out what's wrong.
 *
 * Actions go through the same routes the flagged queue uses: PATCH clear-flag ("Looks fine", which
 * only means something on a flagged proof) and DELETE with a reason ("Remove", which the team sees).
 *
 * Keyboard: j / k move, x selects, o opens the screenshot.
 */

interface FeedRow {
  id: number;
  tileId: number;
  teamId: number;
  amount: number;
  imageUrl: string | null;
  note: string | null;
  source: string | null;
  flaggedReason: string | null;
  createdAt: string;
  tileLabel: string;
  teamName: string;
  playerName: string | null;
  /** Extra screenshots/links (lib/proofAttachments), start shots first. */
  attachments?: ProofAttachment[];
}

interface Filters {
  teams: { id: number; name: string; color: string | null }[];
  tiles: { id: number; label: string }[];
  players: { id: number; name: string }[];
}

const FLAG_OPTIONS: { value: ProofFlagFilter; label: string }[] = [
  { value: 'all', label: 'Flagged or not' },
  { value: 'flagged', label: 'Flagged only' },
  { value: 'unflagged', label: 'Not flagged' },
];

function when(s: string): string {
  const d = new Date(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`);
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function ProofFeedClient({ eventId }: { eventId: number }) {
  const { ask } = useDialog();
  const [q, setQ] = useState<ProofFeedQuery>({ teamId: null, tileId: null, playerId: null, flag: 'all', page: 1 });
  const [rows, setRows] = useState<FeedRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(30);
  const [filters, setFilters] = useState<Filters>({ teams: [], tiles: [], players: [] });
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<Set<number>>(new Set());
  const [cursor, setCursor] = useState(0);
  const inFlight = useRef(new Set<number>());
  const rowRefs = useRef(new Map<number, HTMLLIElement>());

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const res = await clanFetch(`/api/admin/events/${eventId}/proofs?${proofFeedSearch(q)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoadError(data.error || 'Could not load proofs.');
        setRows([]);
        return;
      }
      setRows(data.rows);
      setTotal(data.total);
      setPageSize(data.pageSize);
      setFilters(data.filters);
    } catch {
      setLoadError('Could not load proofs.');
      setRows([]);
    }
  }, [eventId, q]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on filter change
    void load();
  }, [load]);

  // A new page or filter starts with nothing selected and the cursor on the first row.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on query change
    setSelected(new Set());
    setCursor(0);
  }, [q]);

  const set = (patch: Partial<ProofFeedQuery>) => setQ((cur) => ({ ...cur, ...patch, page: patch.page ?? 1 }));

  /** One request per proof, one at a time (a removal recomputes the board), skipping any in flight. */
  async function run(ids: number[], send: (id: number) => Promise<Response>, verb: string) {
    const todo = ids.filter((id) => !inFlight.current.has(id));
    if (todo.length === 0) return;
    todo.forEach((id) => inFlight.current.add(id));
    setBusy(new Set(inFlight.current));
    setError('');
    let failed = 0;
    let lastError = '';
    for (const id of todo) {
      try {
        const res = await send(id);
        if (!res.ok) {
          failed += 1;
          lastError = (await res.json().catch(() => ({}))).error ?? '';
        }
      } catch {
        failed += 1;
      }
      inFlight.current.delete(id);
      setBusy(new Set(inFlight.current));
    }
    if (failed > 0) {
      setError(`${failed} ${failed === 1 ? 'proof' : 'proofs'} couldn't be ${verb}.${lastError ? ` ${lastError}` : ' Try again.'}`);
    }
    setSelected(new Set());
    await load();
  }

  function looksFine(ids: number[]) {
    return run(
      ids,
      (id) =>
        clanFetch(`/api/events/${eventId}/submissions?submissionId=${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'clear-flag' }),
        }),
      'updated',
    );
  }

  async function remove(ids: number[]) {
    const todo = ids.filter((id) => !inFlight.current.has(id));
    if (todo.length === 0) return;
    const many = todo.length > 1;
    const reason = await ask({
      title: many ? `Remove ${todo.length} proofs for good?` : 'Remove this proof for good?',
      body: many
        ? 'Each one is deleted permanently and its team loses the credit. Say why — the teams see this reason in Discord.'
        : 'It is deleted permanently and the team loses the credit. Say why — the team sees this in Discord.',
      confirmLabel: 'Remove',
      tone: 'danger',
      label: 'Reason',
      required: true,
      multiline: true,
      placeholder: 'e.g. screenshot is from before the event',
    });
    if (!reason) return;
    await run(
      todo,
      (id) =>
        clanFetch(`/api/events/${eventId}/submissions?submissionId=${id}&reason=${encodeURIComponent(reason)}`, {
          method: 'DELETE',
        }),
      'removed',
    );
  }

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // j / k / x / o. Ignored while typing or while a dialog is open (its focus trap owns the keys).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || !rows || rows.length === 0) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="listbox"]'))) return;
      const k = e.key.toLowerCase();
      if (k === 'j' || k === 'k') {
        e.preventDefault();
        setCursor((c) => {
          const next = Math.min(rows.length - 1, Math.max(0, c + (k === 'j' ? 1 : -1)));
          rowRefs.current.get(rows[next].id)?.scrollIntoView({ block: 'nearest' });
          return next;
        });
      } else if (k === 'x') {
        e.preventDefault();
        const r = rows[cursor];
        if (r) toggle(r.id);
      } else if (k === 'o') {
        const r = rows[cursor];
        if (r?.imageUrl) window.open(r.imageUrl, '_blank', 'noopener,noreferrer');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rows, cursor]);

  const pages = pageCount(total, pageSize);
  const picked = (rows ?? []).filter((r) => selected.has(r.id));
  const pickedFlagged = picked.filter((r) => r.flaggedReason).map((r) => r.id);
  const allPicked = !!rows && rows.length > 0 && picked.length === rows.length;
  const anyBusy = busy.size > 0;
  const filtered = q.teamId != null || q.tileId != null || q.playerId != null || q.flag !== 'all';

  return (
    <section>
      <div className="mb-4">
        <h2 className="flex items-center gap-2.5 text-lg font-semibold mb-1">
          <span className="w-1 h-5 bg-gold rounded-full" />
          All proofs
          <span className="text-sm font-normal text-text-muted">newest first</span>
        </h2>
        <p className="text-sm text-text-muted max-w-[70ch]">
          Every proof on this board. They all count already — flagged ones are the ones the system wasn&rsquo;t
          sure about. Remove anything that&rsquo;s wrong and the team is told why.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 mb-3">
        <Select
          ariaLabel="Team"
          value={q.teamId ? String(q.teamId) : ''}
          onChange={(v) => set({ teamId: v ? Number(v) : null })}
          options={[{ value: '', label: 'Every team' }, ...filters.teams.map((t) => ({ value: String(t.id), label: t.name, dot: t.color ?? undefined }))]}
        />
        <Select
          ariaLabel="Tile"
          value={q.tileId ? String(q.tileId) : ''}
          onChange={(v) => set({ tileId: v ? Number(v) : null })}
          options={[{ value: '', label: 'Every tile' }, ...filters.tiles.map((t) => ({ value: String(t.id), label: t.label }))]}
        />
        <Select
          ariaLabel="Player"
          value={q.playerId ? String(q.playerId) : ''}
          onChange={(v) => set({ playerId: v ? Number(v) : null })}
          options={[{ value: '', label: 'Every player' }, ...filters.players.map((p) => ({ value: String(p.id), label: p.name }))]}
        />
        <Select
          ariaLabel="Flagged"
          value={q.flag}
          onChange={(v) => set({ flag: v as ProofFlagFilter })}
          options={FLAG_OPTIONS}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 py-2.5 border-b border-[#2a221b]">
        <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer select-none">
          <CheckboxBox
            checked={allPicked}
            disabled={!rows || rows.length === 0}
            ref={(el) => {
              if (el) el.indeterminate = picked.length > 0 && !allPicked;
            }}
            onChange={() => setSelected(allPicked ? new Set() : new Set((rows ?? []).map((r) => r.id)))}
          />
          {picked.length > 0 ? `${picked.length} selected` : `Select this page`}
        </label>
        <span className="text-xs text-text-dim hidden sm:inline">j / k to move · x to select · o to open</span>
        {picked.length > 0 && (
          <div className="flex gap-2 ml-auto">
            <button
              type="button"
              disabled={anyBusy}
              onClick={() => remove(picked.map((r) => r.id))}
              className="px-3 py-1.5 text-sm rounded-lg border border-tile-border hover:border-red-400/50 hover:text-red-300 transition-colors disabled:opacity-50"
            >
              Remove {picked.length}…
            </button>
            {pickedFlagged.length > 0 && (
              <button
                type="button"
                disabled={anyBusy}
                onClick={() => looksFine(pickedFlagged)}
                title="Clears the flag on the selected flagged proofs. Unflagged ones need nothing."
                className="px-3 py-1.5 text-sm font-semibold rounded-lg border border-gold/40 bg-gold/10 text-gold hover:bg-gold/15 transition-colors disabled:opacity-50"
              >
                {pickedFlagged.length === 1 ? 'Looks fine' : `${pickedFlagged.length} flagged look fine`}
              </button>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-300 mt-2">{error}</p>}
      {loadError && <p className="text-sm text-red-300 mt-2">{loadError}</p>}

      {rows === null ? (
        <p className="text-sm text-text-muted py-8 text-center">Loading proofs…</p>
      ) : rows.length === 0 && !loadError ? (
        <div className="py-10 text-center text-sm text-text-muted">
          {filtered ? (
            <>
              No proofs match these filters.{' '}
              <button type="button" onClick={() => setQ({ teamId: null, tileId: null, playerId: null, flag: 'all', page: 1 })} className="text-gold hover:underline">
                Clear filters
              </button>
            </>
          ) : (
            'No proofs yet. They show up here as players clear tiles, newest at the top.'
          )}
        </div>
      ) : (
        <ul>
          {rows.map((s, i) => {
            const rowBusy = busy.has(s.id);
            const atCursor = i === cursor;
            return (
              <li
                key={s.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(s.id, el);
                  else rowRefs.current.delete(s.id);
                }}
                onClick={() => setCursor(i)}
                className={`flex flex-wrap items-center gap-4 py-3.5 px-2 -mx-2 border-b border-[#2a221b] rounded-md ${rowBusy ? 'opacity-60' : ''} ${
                  atCursor ? 'bg-gold/[0.04] shadow-[inset_3px_0_0_var(--gold)]' : ''
                }`}
              >
                <CheckboxBox
                  aria-label={`Select ${s.tileLabel}`}
                  className="shrink-0"
                  checked={selected.has(s.id)}
                  disabled={rowBusy}
                  onChange={() => toggle(s.id)}
                />
                {s.imageUrl ? (
                  <a href={s.imageUrl} target="_blank" rel="noreferrer" className="shrink-0">
                    <img src={s.imageUrl} alt="Proof" loading="lazy" className="w-28 h-16 object-cover rounded-md border border-tile-border" />
                  </a>
                ) : (
                  <span className="w-28 h-16 shrink-0 rounded-md item-slot grid place-items-center text-[11px] text-text-dim">no image</span>
                )}
                <div className="flex-1 min-w-[200px]">
                  <div className="font-semibold">
                    {s.tileLabel}
                    {s.amount > 1 && <span className="text-text-muted font-normal"> × {s.amount.toLocaleString()}</span>}
                  </div>
                  <div className="text-sm text-text-muted mt-0.5">
                    {s.playerName || 'Someone'} · {s.teamName} · {when(s.createdAt)}
                  </div>
                  {!!s.attachments?.length && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {s.attachments.map((a) => (
                        <a
                          key={a.id}
                          href={a.url}
                          target="_blank"
                          rel={a.kind === 'link' ? 'noopener noreferrer nofollow ugc' : 'noreferrer'}
                          title={a.kind === 'link' ? a.url : undefined}
                          className="relative shrink-0"
                        >
                          {a.kind === 'image' ? (
                            <img src={a.url} alt={a.label ? `${a.label} screenshot` : 'Extra screenshot'} loading="lazy" className="w-14 h-10 object-cover rounded border border-tile-border" />
                          ) : (
                            <span className="inline-flex h-10 items-center px-2 rounded border border-tile-border text-xs text-gold">🔗 {linkHost(a.url)}</span>
                          )}
                          {a.label && <span className="absolute -top-1 -left-1 px-1 rounded bg-black/80 text-[9px] font-semibold uppercase text-gold">{a.label}</span>}
                        </a>
                      ))}
                    </div>
                  )}
                  {s.flaggedReason ? (
                    <div className="text-sm text-yellow-400 mt-1">{FLAG_TEXT[s.flaggedReason] ?? 'Flagged for a look'}</div>
                  ) : (
                    s.note && <div className="text-xs text-text-muted mt-1 truncate max-w-[60ch]">“{s.note}”</div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={rowBusy}
                    onClick={() => remove([s.id])}
                    className="px-3 py-1.5 text-sm rounded-lg border border-tile-border hover:border-red-400/50 hover:text-red-300 transition-colors disabled:opacity-50"
                  >
                    Remove…
                  </button>
                  {s.flaggedReason && (
                    <button
                      type="button"
                      disabled={rowBusy}
                      onClick={() => looksFine([s.id])}
                      className="px-3 py-1.5 text-sm font-semibold rounded-lg border border-gold/40 bg-gold/10 text-gold hover:bg-gold/15 transition-colors disabled:opacity-50"
                    >
                      {rowBusy ? 'Saving…' : 'Looks fine'}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {total > 0 && (
        <div className="flex items-center justify-between gap-3 mt-4 text-sm text-text-muted">
          <span>
            {total.toLocaleString()} {total === 1 ? 'proof' : 'proofs'} · page {q.page} of {pages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={q.page <= 1}
              onClick={() => set({ page: q.page - 1 })}
              className="px-3 py-1.5 rounded-lg border border-card-border hover:border-gold/40 disabled:opacity-40"
            >
              ← Newer
            </button>
            <button
              type="button"
              disabled={q.page >= pages}
              onClick={() => set({ page: q.page + 1 })}
              className="px-3 py-1.5 rounded-lg border border-card-border hover:border-gold/40 disabled:opacity-40"
            >
              Older →
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
