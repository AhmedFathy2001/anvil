'use client';

import { useState } from 'react';
import { clanFetch } from '@/lib/clanFetch';
import { formatGp } from '@/lib/adminEventsFormat';
import WeeklyPrizeLadder from '@/components/WeeklyPrizeLadder';
import GuideLink from '@/components/GuideLink';
import type { WeeklyPrizes } from '@/lib/weeklyPrizes';

/**
 * What a Skill or Boss of the Week pays, place by place, out of the clan coffer.
 *
 * The ladder itself is the shared control; this adds the header, the coffer balance and the save.
 * Nothing here pays anybody — the competition's settle pass reserves against the coffer when it
 * ends, which is why the editor closes for good once that has run.
 */
export default function WeeklyPrizeEditor({
  competitionId,
  initial,
  cofferAvailable,
  settledAt,
  canEdit,
  hasCoffer,
}: {
  competitionId: number;
  initial: WeeklyPrizes;
  cofferAvailable: number;
  /** Set once the prizes have been reserved. The ladder is history from then on. */
  settledAt: string | null;
  /** Treasurer or admin. A moderator sees the ladder and cannot change it. */
  canEdit: boolean;
  hasCoffer: boolean;
}) {
  const [prizes, setPrizes] = useState<WeeklyPrizes>(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const locked = !canEdit || Boolean(settledAt);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await clanFetch(`/api/admin/weekly/${competitionId}/prizes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prizes),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save the prizes.');
      // The server cleans the ladder — trailing empty places dropped, amounts clamped — so take its
      // answer rather than leaving the screen showing something that will not be paid.
      setPrizes(data.prizes);
      setMessage({
        type: 'success',
        text: data.total > 0 ? `Saved. ${formatGp(data.total)} gp promised.` : 'Saved. This competition pays nothing.',
      });
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Could not save the prizes.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    // Anchored, because the pre-start checklist above sends people here — prizes are the one thing
    // on a fresh competition that needs a human, and they are the furthest down the page.
    <section id="prizes" className="scroll-mt-24 border border-card-border rounded-xl bg-card-bg p-5">
      <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <span className="w-1 h-5 bg-gold rounded-full" />
          Prizes
        </h2>
        <div className="flex items-center gap-3">
          <GuideLink href="/guide/coffer#out">How prizes work</GuideLink>
          <span className="text-xs text-text-muted">{formatGp(cofferAvailable)} gp available in the coffer</span>
        </div>
      </div>
      <p className="text-xs text-text-muted mb-4">
        Paid out of the clan coffer when the competition ends. Reserved automatically off the final
        standings — a treasurer sends the gp and marks it paid on the coffer page.
      </p>

      {settledAt && (
        <p className="text-xs text-accent-green-light mb-4">
          Already paid out. The prizes are on the ledger now — adjust them there rather than here.
        </p>
      )}

      <WeeklyPrizeLadder
        value={prizes}
        onChange={setPrizes}
        cofferAvailable={cofferAvailable}
        hasCoffer={hasCoffer}
        disabled={locked}
      />

      {!locked && (
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-3.5 py-1.5 text-sm font-semibold rounded-lg bg-gold/90 text-brown-dark hover:bg-gold transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save prizes'}
          </button>
          {message && (
            <span className={`text-xs ${message.type === 'error' ? 'text-red-400' : 'text-accent-green-light'}`}>
              {message.text}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
