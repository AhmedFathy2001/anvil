'use client';

/* eslint-disable @next/next/no-img-element -- proof screenshots are user uploads of any size */

import { useRef, useState } from 'react';

import ClanLink from '@/components/ClanLink';
import CopyLinkButton from '@/components/CopyLinkButton';
import { useDialog } from '@/components/Confirm';
import { clanFetch } from '@/lib/clanFetch';
import type { NextStep } from '@/lib/eventNextStep';
import type { Event, Submission, Tile } from '@/lib/types';

/** Start an event now, going through the readiness gate (lib/eventReadiness) and its override. */
export function useStartNow(eventId: number, onEventChange: (e: Event) => void) {
  const { confirm } = useDialog();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  async function start(force = false): Promise<void> {
    // Same ask as the Teams page's start button: starting announces in Discord and opens the board,
    // neither of which a stray click on the Next step panel should do unasked.
    if (
      !force &&
      !(await confirm({
        title: 'Start the event now?',
        body: 'The event goes live, the start is announced in Discord, and members can see the board.',
        confirmLabel: 'Start now',
        tone: 'gold',
      }))
    ) {
      return;
    }
    setStarting(true);
    setError('');
    try {
      const res = await clanFetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start-now', ...(force ? { force: true } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        onEventChange(data);
        return;
      }
      // 409 + blockers = the readiness gate refused. The route has no `overridable` flag — every
      // blocker can be forced, which is what the Teams page's button offers — so key off the list.
      if (res.status === 409 && Array.isArray(data.blockers) && !force) {
        if (await confirm({ title: 'Start it anyway?', body: data.error, confirmLabel: 'Start now', tone: 'gold' })) {
          await start(true);
        }
        return;
      }
      setError(data.error || 'Could not start the event.');
    } finally {
      setStarting(false);
    }
  }

  return { start, starting, error };
}

/**
 * The one forge panel on the event home: what this event wants from you now, in plain words, with
 * a single action. See lib/eventNextStep for how it is decided.
 */
export function NextStepPanel({
  step,
  eventId,
  onStart,
  starting,
  error,
}: {
  step: NextStep;
  eventId: number;
  onStart: () => void;
  starting: boolean;
  error: string;
}) {
  const a = step.action;
  return (
    <section className="forge-panel px-6 sm:px-7 py-6">
      <div className="text-[13px] text-gold">Next step</div>
      <h2 className="display text-[28px] sm:text-[30px] font-semibold leading-tight mt-1.5">{step.title}</h2>
      <p className="text-[#cbbfa9] mt-2 max-w-[56ch] leading-relaxed">{step.body}</p>
      {a.kind !== 'none' && (
        <div className="mt-5">
          {a.kind === 'start' ? (
            <button type="button" onClick={onStart} disabled={starting} className="molten-btn">
              {starting ? 'Starting…' : a.label}
            </button>
          ) : a.kind === 'copy' ? (
            <CopyLinkButton path={`/events/${eventId}/${a.path}`} label={a.label} className="molten-btn" />
          ) : a.tab.startsWith('#') ? (
            <button
              type="button"
              className="molten-btn"
              onClick={() => document.getElementById(a.tab.slice(1))?.scrollIntoView({ behavior: 'smooth' })}
            >
              {a.label}
            </button>
          ) : (
            <ClanLink href={`/admin/events/${eventId}/${a.tab}`} className="molten-btn">
              {a.label}
            </ClanLink>
          )}
        </div>
      )}
      {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
    </section>
  );
}

const FLAG_TEXT: Record<string, string> = {
  no_start_proof: 'Counted without a starting screenshot',
  inferred_duplicate_pet: 'A pet duplicate the plugin worked out from context',
  inferred_duplicate_scroll: 'A champion scroll duplicate the plugin worked out from context',
  big_ping: 'The plugin claimed a lot at once without a screenshot, so only 10 were counted',
};

/**
 * Proofs the system flagged for a human look. They already count; this is where staff either
 * confirm them ("Looks fine" clears the flag) or take them back out.
 */
export function ProofsToCheck({
  eventId,
  submissions,
  tiles,
  teamNameById,
  onChange,
}: {
  eventId: number;
  submissions: Submission[];
  tiles: Tile[];
  teamNameById: Record<number, string>;
  onChange: () => void;
}) {
  const { ask } = useDialog();
  // Ids with a request in flight, and ids already handled. The ref is the guard (state lags a click
  // fired in the same frame); `handled` hides a row the moment its request succeeds, so it can't be
  // clicked again in the gap before onChange's refetch lands — that gap is how ten clicks sent ten.
  const inFlight = useRef(new Set<number>());
  const [busy, setBusy] = useState<Set<number>>(new Set());
  const [handled, setHandled] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');

  const flagged = submissions
    .filter((s) => s.flaggedReason && !handled.has(s.id))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (flagged.length === 0) return null;
  const tileName = (id: number) => tiles.find((t) => t.id === id)?.label ?? 'Tile';
  const picked = flagged.filter((s) => selected.has(s.id)).map((s) => s.id);
  const allPicked = picked.length === flagged.length;
  const anyBusy = busy.size > 0;

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** Run one request per proof, one at a time (a removal recomputes the board), skipping any in flight. */
  async function run(ids: number[], send: (id: number) => Promise<Response>) {
    const todo = ids.filter((id) => !inFlight.current.has(id));
    if (todo.length === 0) return;
    todo.forEach((id) => inFlight.current.add(id));
    setBusy(new Set(inFlight.current));
    setError('');
    let failed = 0;
    for (const id of todo) {
      try {
        const res = await send(id);
        if (res.ok) {
          setHandled((prev) => new Set(prev).add(id));
          setSelected((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        } else {
          failed += 1;
        }
      } catch {
        failed += 1;
      }
      inFlight.current.delete(id);
      setBusy(new Set(inFlight.current));
    }
    if (failed > 0) setError(`${failed} ${failed === 1 ? 'proof' : 'proofs'} couldn't be updated. Try again.`);
    onChange();
  }

  function keep(ids: number[]) {
    return run(ids, (id) =>
      clanFetch(`/api/events/${eventId}/submissions?submissionId=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear-flag' }),
      }),
    );
  }

  async function remove(ids: number[]) {
    const todo = ids.filter((id) => !inFlight.current.has(id));
    if (todo.length === 0) return;
    const many = todo.length > 1;
    const reason = await ask({
      title: many ? `Remove ${todo.length} proofs?` : 'Remove this proof?',
      body: many
        ? 'Each team loses the credit. Say why — every team sees this reason.'
        : 'The team loses the credit. Say why. The team sees this.',
      confirmLabel: 'Remove',
      tone: 'danger',
      label: 'Reason',
      required: true,
      placeholder: 'e.g. screenshot is from before the event',
    });
    if (!reason) return;
    await run(todo, (id) =>
      clanFetch(`/api/events/${eventId}/submissions?submissionId=${id}&reason=${encodeURIComponent(reason)}`, {
        method: 'DELETE',
      }),
    );
  }

  return (
    <section id="proofs" className="scroll-mt-24">
      <h2 className="flex items-center gap-2.5 text-lg font-semibold mb-1">
        <span className="molten-bar" />
        Proofs to check
        <span className="text-sm font-normal text-text-muted">oldest first</span>
      </h2>
      <div className="flex flex-wrap items-center gap-3 py-2.5 border-b border-[#2a221b]">
        <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer select-none">
          <input
            type="checkbox"
            className="w-4 h-4 accent-[var(--color-gold)]"
            checked={allPicked}
            ref={(el) => {
              if (el) el.indeterminate = picked.length > 0 && !allPicked;
            }}
            onChange={() => setSelected(allPicked ? new Set() : new Set(flagged.map((s) => s.id)))}
          />
          {picked.length > 0 ? `${picked.length} selected` : `Select all ${flagged.length}`}
        </label>
        {picked.length > 0 && (
          <div className="flex gap-2 ml-auto">
            <button
              type="button"
              disabled={anyBusy}
              onClick={() => remove(picked)}
              className="px-3 py-1.5 text-sm rounded-lg border border-tile-border hover:border-red-400/50 hover:text-red-300 transition-colors disabled:opacity-50"
            >
              Remove {picked.length}…
            </button>
            <button
              type="button"
              disabled={anyBusy}
              onClick={() => keep(picked)}
              className="px-3 py-1.5 text-sm font-semibold rounded-lg border border-gold/40 bg-gold/10 text-gold hover:bg-gold/15 transition-colors disabled:opacity-50"
            >
              {picked.length === 1 ? 'Looks fine' : `All ${picked.length} look fine`}
            </button>
          </div>
        )}
      </div>
      {error && <p className="text-sm text-red-300 mt-2">{error}</p>}
      <ul>
        {flagged.map((s) => {
          const rowBusy = busy.has(s.id);
          return (
            <li key={s.id} className={`flex flex-wrap items-center gap-4 py-3.5 border-b border-[#2a221b] ${rowBusy ? 'opacity-60' : ''}`}>
              <input
                type="checkbox"
                aria-label={`Select ${tileName(s.tileId)}`}
                className="w-4 h-4 shrink-0 accent-[var(--color-gold)]"
                checked={selected.has(s.id)}
                disabled={rowBusy}
                onChange={() => toggle(s.id)}
              />
              {s.imageUrl ? (
                <a href={s.imageUrl} target="_blank" rel="noreferrer" className="shrink-0">
                  <img src={s.imageUrl} alt="Proof" className="w-28 h-16 object-cover rounded-md border border-tile-border" />
                </a>
              ) : (
                <span className="w-28 h-16 shrink-0 rounded-md item-slot text-[11px] text-text-dim">no image</span>
              )}
              <div className="flex-1 min-w-[200px]">
                <div className="font-semibold">{tileName(s.tileId)}</div>
                <div className="text-sm text-text-muted mt-0.5">
                  {s.creditPlayerName || s.uploaderName || 'Someone'} · {teamNameById[s.teamId] ?? 'Team'} ·{' '}
                  {new Date(s.createdAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="text-sm text-yellow-400 mt-1">{FLAG_TEXT[s.flaggedReason!] ?? 'Flagged for a look'}</div>
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
                <button
                  type="button"
                  disabled={rowBusy}
                  onClick={() => keep([s.id])}
                  className="px-3 py-1.5 text-sm font-semibold rounded-lg border border-gold/40 bg-gold/10 text-gold hover:bg-gold/15 transition-colors disabled:opacity-50"
                >
                  {rowBusy ? 'Saving…' : 'Looks fine'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
