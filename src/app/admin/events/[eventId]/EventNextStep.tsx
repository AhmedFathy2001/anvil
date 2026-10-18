'use client';

/* eslint-disable @next/next/no-img-element -- proof screenshots are user uploads of any size */

import { useState } from 'react';

import ClanLink from '@/components/ClanLink';
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
      // 409 = the readiness gate refused; some of its reasons (no end date) may be overridden.
      if (res.status === 409 && data.overridable) {
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
  const [busy, setBusy] = useState<number | null>(null);
  const flagged = submissions.filter((s) => s.flaggedReason);
  if (flagged.length === 0) return null;
  const tileName = (id: number) => tiles.find((t) => t.id === id)?.label ?? 'Tile';

  async function keep(id: number) {
    setBusy(id);
    await clanFetch(`/api/events/${eventId}/submissions?submissionId=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clear-flag' }),
    });
    setBusy(null);
    onChange();
  }

  async function remove(id: number) {
    const reason = await ask({
      title: 'Remove this proof?',
      body: 'The team loses the credit. Say why. The team sees this.',
      confirmLabel: 'Remove',
      tone: 'danger',
      label: 'Reason',
      required: true,
      placeholder: 'e.g. screenshot is from before the event',
    });
    if (!reason) return;
    setBusy(id);
    await clanFetch(`/api/events/${eventId}/submissions?submissionId=${id}&reason=${encodeURIComponent(reason)}`, {
      method: 'DELETE',
    });
    setBusy(null);
    onChange();
  }

  return (
    <section id="proofs" className="scroll-mt-24">
      <h2 className="flex items-center gap-2.5 text-lg font-semibold mb-1">
        <span className="molten-bar" />
        Proofs to check
        <span className="text-sm font-normal text-text-muted">oldest first</span>
      </h2>
      <ul>
        {[...flagged]
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-4 py-3.5 border-b border-[#2a221b]">
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
                  disabled={busy === s.id}
                  onClick={() => remove(s.id)}
                  className="px-3 py-1.5 text-sm rounded-lg border border-tile-border hover:border-red-400/50 hover:text-red-300 transition-colors disabled:opacity-50"
                >
                  Remove…
                </button>
                <button
                  type="button"
                  disabled={busy === s.id}
                  onClick={() => keep(s.id)}
                  className="px-3 py-1.5 text-sm font-semibold rounded-lg border border-gold/40 bg-gold/10 text-gold hover:bg-gold/15 transition-colors disabled:opacity-50"
                >
                  Looks fine
                </button>
              </div>
            </li>
          ))}
      </ul>
    </section>
  );
}
