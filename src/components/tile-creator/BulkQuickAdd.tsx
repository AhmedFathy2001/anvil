'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { clanFetch } from '@/lib/clanFetch';
import { useModalA11y } from '@/hooks/useModalA11y';
import { draftToCsvRow, howItCountsLine, type TileDraft } from '@/lib/tileCreatorConfig';
import { comboRuleLead } from '@/lib/combo';
import type { TaskCandidate } from '@/lib/taskMatch';
import type { BulkLineResult } from '@/lib/taskSuggest';
import type { TierBand } from '@/lib/tileFilter';
import TileCreator from './TileCreator';
import { CheckIcon, KindBadge, PrimaryButton, SecondaryButton } from './parts';

interface Row extends BulkLineResult {
  /** What this line will be added as; null while a "pick one" line is unanswered. */
  draft: TileDraft | null;
  chosen: TaskCandidate | null;
  /** The admin picked or edited this line themselves — a re-check of the list keeps their answer. */
  manual?: boolean;
}

function draftOf(c: TaskCandidate, points: number | null): TileDraft {
  return { label: c.title, config: c.config, points, trackingMode: 'team', category: c.tileCategory ?? null };
}

/**
 * "Quick add: paste your list". One task per line, written however the clan wrote it; every line
 * goes through the same matcher as the single-tile search and lands in a review table — ready,
 * pick one (inline choice), or screenshot (no match → a standard manual tile). Adding goes through
 * the board's import route in append mode, which fills blank placeholders before it grows the board.
 */
export default function BulkQuickAdd({
  eventId,
  pointsMode,
  tierBands,
  teamPlay,
  onClose,
  onCreated,
  onUploadFile,
}: {
  eventId: number;
  pointsMode: boolean;
  tierBands: TierBand[];
  teamPlay: boolean;
  onClose: () => void;
  onCreated: (summary: { created: number; applied: number; ignored: number }) => void;
  onUploadFile: () => void;
}) {
  const ref = useModalA11y<HTMLDivElement>({ onClose });
  const bands = useMemo(() => [...tierBands].sort((a, b) => a.min - b.min), [tierBands]);
  const [text, setText] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [checking, setChecking] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [defaultBand, setDefaultBand] = useState<string>(bands.find((b) => b.min > 0)?.key ?? bands[0]?.key ?? '');
  const [editing, setEditing] = useState<number | null>(null);
  const seq = useRef(0);

  const defaultPoints = Math.max(1, bands.find((b) => b.key === defaultBand)?.min ?? 1);
  const lines = useMemo(() => text.split('\n').map((l) => l.trim()).filter(Boolean), [text]);
  const linesKey = lines.join('\n');

  // Re-check the list a moment after typing stops. Rows the admin already settled keep their answer.
  useEffect(() => {
    if (!linesKey) {
      setRows([]);
      return;
    }
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      setChecking(true);
      try {
        const res = await clanFetch('/api/admin/task-suggest/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lines: linesKey.split('\n') }),
        });
        const data = await res.json().catch(() => []);
        if (mine !== seq.current) return;
        if (!res.ok) {
          setError((data as { error?: string }).error || 'Could not read the list.');
          return;
        }
        setError(null);
        setRows((prev) =>
          (data as BulkLineResult[]).map((r) => {
            const kept = prev.find((p) => p.line === r.line && p.manual);
            if (kept) return { ...r, draft: kept.draft, chosen: kept.chosen, manual: true };
            const chosen = r.status === 'ready' ? r.choices[0] : r.status === 'screenshot' ? r.fallback : null;
            return { ...r, chosen, draft: chosen ? draftOf(chosen, r.points) : null };
          }),
        );
      } catch {
        if (mine === seq.current) setError('Could not read the list.');
      } finally {
        if (mine === seq.current) setChecking(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [linesKey]);

  const counts = {
    ready: rows.filter((r) => r.status === 'ready' || (r.status === 'pick' && r.draft)).length,
    pick: rows.filter((r) => r.status === 'pick' && !r.draft).length,
    screenshot: rows.filter((r) => r.status === 'screenshot').length,
  };
  const settled = rows.filter((r) => r.draft);

  /** The admin typed this line's points in the table. */
  function setRowPoints(i: number, v: number | null) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, points: v, draft: r.draft ? { ...r.draft, points: v } : r.draft, manual: true } : r)));
  }

  function choose(i: number, c: TaskCandidate) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, chosen: c, draft: draftOf(c, r.points), manual: true } : r)));
  }

  async function addRows(which: 'settled' | 'all') {
    const list = rows.map((r) => r.draft ?? (which === 'all' ? draftOf(r.choices[0] ?? r.fallback, r.points) : null)).filter((d): d is TileDraft => !!d);
    if (list.length === 0) return;
    setAdding(true);
    setError(null);
    try {
      const res = await clanFetch(`/api/events/${eventId}/tiles/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          append: true,
          rows: list.map((d) => draftToCsvRow({ ...d, points: pointsMode ? d.points ?? defaultPoints : d.points ?? 1 })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not add the tiles.');
        return;
      }
      onCreated({ created: data.created ?? 0, applied: data.applied ?? 0, ignored: data.ignored ?? 0 });
    } catch {
      setError('Could not add the tiles.');
    } finally {
      setAdding(false);
    }
  }

  const editingRow = editing != null ? rows[editing] : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-6xl max-h-full sm:max-h-[92vh] flex flex-col bg-card-bg border border-card-border sm:rounded-xl overflow-hidden focus:outline-none"
      >
        <div className="shrink-0 flex flex-wrap items-start justify-between gap-3 border-b border-card-border px-4 sm:px-5 py-4">
          <div className="min-w-0">
            <h3 id="bulk-title" className="text-base font-bold flex items-center gap-2">
              <span className="w-1 h-5 bg-gold rounded-full" aria-hidden="true" />
              Quick add: paste your list
            </h3>
            <p className="text-xs text-text-muted mt-1 max-w-2xl">
              One task per line, written however your clan wrote it. We turn each line into a tile; you only fix the ones we flag.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SecondaryButton onClick={onUploadFile}>Upload CSV / Excel</SecondaryButton>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-11 h-11 grid place-items-center rounded-lg border border-card-border text-text-muted hover:text-foreground text-lg"
            >
              &times;
            </button>
          </div>
        </div>

        {editingRow ? (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 max-w-lg w-full mx-auto">
            <TileCreator
              eventId={eventId}
              pointsMode={pointsMode}
              tierBands={tierBands}
              teamPlay={teamPlay}
              initialQuery={editingRow.text}
              initialCandidate={editingRow.chosen ?? undefined}
              onDone={(draft, candidate) => {
                setRows((prev) => prev.map((r, j) => (j === editing ? { ...r, draft, chosen: candidate, manual: true, status: r.status === 'screenshot' && candidate.engine !== 'screenshot' ? 'ready' : r.status } : r)));
                setEditing(null);
              }}
            />
            <button type="button" onClick={() => setEditing(null)} className="mt-4 min-h-11 text-sm text-text-muted hover:text-foreground">
              Back to the list
            </button>
          </div>
        ) : (
          <div className="flex-1 min-h-0 grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] overflow-y-auto lg:overflow-hidden">
            <div className="p-4 sm:p-5 lg:border-r border-card-border lg:overflow-y-auto">
              <label htmlFor="bulk-paste" className="block text-sm font-semibold mb-2">Your list</label>
              <textarea
                id="bulk-paste"
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={14}
                placeholder={'25 Hunter rumours\n150 herbiboars\n5 CoX or ToB, no Entry Mode – 30 pts'}
                className="w-full bg-brown-dark border border-card-border rounded-lg px-3 py-2 text-sm leading-6 font-mono focus:border-gold focus:outline-none"
              />
              <p className="mt-1.5 text-xs text-text-muted">Tip: add “– 20 pts” to a line to set its points.</p>
            </div>

            <div className="p-4 sm:p-5 lg:overflow-y-auto min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-3 text-xs" aria-live="polite">
                <span className="text-text-muted">{lines.length} line{lines.length === 1 ? '' : 's'}{checking ? ' · checking…' : ''}</span>
                <span className="rounded-full border border-accent-green/30 bg-accent-green/10 text-accent-green-light px-2.5 py-1">{counts.ready} ready</span>
                <span className="rounded-full border border-gold/30 bg-gold/10 text-gold px-2.5 py-1">{counts.pick} pick one</span>
                <span className="rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-200 px-2.5 py-1">{counts.screenshot} screenshot</span>
                {pointsMode && (
                  <label className="ml-auto flex items-center gap-2 text-text-muted">
                    Default worth
                    <select
                      value={defaultBand}
                      onChange={(e) => setDefaultBand(e.target.value)}
                      className="min-h-11 bg-brown-dark border border-card-border rounded-lg px-2 text-foreground"
                    >
                      {bands.map((b) => (
                        <option key={b.key} value={b.key}>{b.label} · {Math.max(1, b.min)} pts</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              {rows.length === 0 ? (
                <p className="text-sm text-text-muted">Paste your list on the left. Each line shows up here with how it will count.</p>
              ) : (
                <div role="table" aria-label="Tiles to add" className="text-sm">
                  <div role="row" className="hidden md:grid grid-cols-[minmax(0,2.2fr)_6rem_4rem_minmax(0,1.6fr)_4.5rem] gap-2 px-2 pb-1.5 text-[11px] uppercase tracking-wide text-text-muted border-b border-card-border">
                    <span role="columnheader">Tile</span>
                    <span role="columnheader">Kind</span>
                    <span role="columnheader">Need</span>
                    <span role="columnheader">How it counts</span>
                    <span role="columnheader" className="text-right" title={pointsMode ? undefined : 'Saved with the tile; points only matter on a points-scoring board.'}>Pts</span>
                  </div>
                  {rows.map((r, i) => {
                    const c = r.chosen;
                    const how = r.draft ? howItCountsLine(r.draft.config) : null;
                    const need = c?.amount ?? r.draft?.config.requiredAmount ?? r.draft?.config.statGoal ?? null;
                    const pts = r.draft?.points ?? r.points ?? defaultPoints;
                    return (
                      <div
                        role="row"
                        key={`${i}-${r.line}`}
                        className="grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,2.2fr)_6rem_4rem_minmax(0,1.6fr)_4.5rem] gap-x-2 gap-y-1 items-center px-2 py-2 border-b border-card-border/60"
                      >
                        <span role="cell" className="min-w-0">
                          <button
                            type="button"
                            onClick={() => setEditing(i)}
                            className="min-h-11 text-left hover:text-gold"
                            title="Open in the single-tile editor"
                          >
                            <span className="block font-medium break-words">{r.draft?.label ?? r.text}</span>
                            {/* Combo tile (lib/combo): the rule, then each part on its own line. */}
                            {r.draft?.config.tileType === 'combo' && r.draft.config.parts && (
                              <span className="block text-xs text-text-muted">
                                Done with {comboRuleLead(r.draft.config.comboRule ?? { mode: 'any' }, r.draft.config.parts.length)}:
                                {r.draft.config.parts.map((p, k) => (
                                  <span key={k} className="block pl-2">· {p.label}</span>
                                ))}
                              </span>
                            )}
                            {r.status === 'pick' && !r.draft && <span className="block text-xs text-gold">Which one did you mean?</span>}
                          </button>
                          {r.status === 'pick' && (
                            <span className="mt-1 flex flex-wrap gap-1.5">
                              {r.choices.map((ch) => (
                                <button
                                  key={ch.key}
                                  type="button"
                                  aria-pressed={c?.key === ch.key}
                                  onClick={() => choose(i, ch)}
                                  className={`min-h-11 px-2.5 rounded-lg border text-xs text-left ${c?.key === ch.key ? 'border-gold bg-gold/15 text-gold' : 'border-card-border hover:border-gold/50'}`}
                                >
                                  {ch.title}
                                </button>
                              ))}
                              <button
                                type="button"
                                aria-pressed={c?.key === 'screenshot'}
                                onClick={() => choose(i, r.fallback)}
                                className={`min-h-11 px-2.5 rounded-lg border text-xs ${c?.key === 'screenshot' ? 'border-gold bg-gold/15 text-gold' : 'border-card-border hover:border-gold/50'}`}
                              >
                                Screenshot tile
                              </button>
                            </span>
                          )}
                        </span>
                        <span role="cell" className="justify-self-end md:justify-self-start">
                          {c ? <KindBadge>{c.badge}</KindBadge> : <span className="text-xs text-text-muted">—</span>}
                        </span>
                        <span role="cell" className="text-xs md:text-sm text-text-muted md:text-foreground">
                          <span className="md:hidden">Need </span>{need != null ? need.toLocaleString('en-US') : '—'}
                        </span>
                        <span role="cell" className={`text-xs flex items-start gap-1 ${how?.engine === 'screenshot' ? 'text-amber-200' : 'text-accent-green-light'}`}>
                          {how && how.engine !== 'screenshot' && <CheckIcon className="mt-0.5 shrink-0" />}
                          {how ? (how.engine === 'hiscores' ? 'Hiscores' : how.engine === 'plugin' ? `Plugin${c?.source === 'gain' ? ', inventory' : c?.source === 'counter' ? ', chat line' : c?.source === 'trial' ? ', rank line' : ''}` : 'Staff approve a screenshot') : ''}
                        </span>
                        <span role="cell" className="text-right text-sm">
                          {/* Editable; on a tiles-scored board it is kept with the tile but scores nothing. */}
                          <input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            aria-label={`Points for ${r.draft?.label ?? r.text}`}
                            value={pointsMode ? pts : (r.draft?.points ?? r.points ?? '')}
                            placeholder={pointsMode ? undefined : '—'}
                            onChange={(e) => setRowPoints(i, e.target.value === '' ? null : Math.max(0, Math.round(Number(e.target.value))))}
                            className={`w-16 min-h-11 px-1.5 rounded bg-brown-dark border border-card-border text-right focus:outline-none focus:border-gold ${pointsMode ? '' : 'text-text-muted'}`}
                          />
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {!editingRow && (
          <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-t border-card-border px-4 sm:px-5 py-3">
            <span className="text-xs text-text-muted">
              Click any tile to open it in the single-tile editor.
              {!pointsMode && rows.some((r) => r.points != null) && ' Points are saved with the tiles but only count on a points-scoring board.'}
            </span>
            <div className="flex flex-wrap gap-2 ml-auto">
              {error && <span role="alert" className="text-sm text-red-300 self-center">{error}</span>}
              {counts.pick > 0 && (
                <SecondaryButton onClick={() => addRows('settled')} disabled={adding || settled.length === 0}>
                  Add the {settled.length} settled
                </SecondaryButton>
              )}
              <PrimaryButton onClick={() => addRows('all')} disabled={adding || rows.length === 0 || checking}>
                {adding ? 'Adding…' : `Add all ${rows.length} tile${rows.length === 1 ? '' : 's'}`}
              </PrimaryButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
