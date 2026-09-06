'use client';

import { useState } from 'react';
import Input from '@/components/Input';
import Checkbox from '@/components/Checkbox';
import { clanFetch } from '@/lib/clanFetch';
import { formatGp, parseGpInput } from '@/lib/adminEventsFormat';
import { MAX_WEEKLY_PLACES, totalPrizeGp, type WeeklyPrizes } from '@/lib/weeklyPrizes';

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];
const ordinal = (i: number) => ORDINALS[i] ?? `${i + 1}th`;

/**
 * What a Skill or Boss of the Week pays, place by place, out of the clan coffer.
 *
 * The same ladder a mission uses, asked of a different scoreboard — so it is deliberately the same
 * shape on screen. What a weekly needs that a mission does not is the two rules underneath, because
 * a weekly is settled once off final standings rather than claimed in the order people finish:
 * whether a zero-gain week can still take a paying place, and what happens when people finish level.
 *
 * Nothing here pays anybody. The competition's settle pass reserves against the coffer when it ends,
 * which is why the editor closes for good once that has run.
 */
export default function WeeklyPrizeEditor({
  competitionId,
  initial,
  cofferAvailable,
  settledAt,
  canEdit,
}: {
  competitionId: number;
  initial: WeeklyPrizes;
  /** What the clan can cover right now, so an over-promise is visible while authoring. */
  cofferAvailable: number;
  /** Set once the prizes have been reserved. The ladder is history from then on. */
  settledAt: string | null;
  /** Treasurer or admin. A moderator sees the ladder and cannot change it. */
  canEdit: boolean;
}) {
  const [prizes, setPrizes] = useState<WeeklyPrizes>(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const total = totalPrizeGp(prizes);
  const overPromised = total > cofferAvailable;
  const locked = !canEdit || Boolean(settledAt);

  function patch(next: Partial<WeeklyPrizes>) {
    setPrizes((p) => ({ ...p, ...next }));
    setMessage(null);
  }

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
      setMessage({ type: 'success', text: data.total > 0 ? `Saved. ${formatGp(data.total)} gp promised.` : 'Saved. This competition pays nothing.' });
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Could not save the prizes.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="border border-card-border rounded-xl bg-card-bg p-5">
      <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <span className="w-1 h-5 bg-gold rounded-full" />
          Prizes
        </h2>
        <span className="text-xs text-text-muted">{formatGp(cofferAvailable)} gp available in the coffer</span>
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

      <div className="space-y-2">
        {prizes.places.map((place, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <span className="w-16 font-semibold text-gold">{ordinal(i)}</span>
            <Input
              type="text"
              inputMode="numeric"
              value={place.gp ? String(place.gp) : ''}
              onChange={(e) => {
                const gp = parseGpInput(e.target.value) ?? 0;
                patch({ places: prizes.places.map((p, j) => (j === i ? { gp } : p)) });
              }}
              placeholder="e.g. 50m"
              className="w-28"
              disabled={locked}
              aria-label={`Prize for ${ordinal(i)} place`}
            />
            <span className="text-text-muted/60 flex-1 min-w-0">
              {place.gp > 0 ? `${formatGp(place.gp)} gp` : 'no prize for this place'}
            </span>
            {!locked && (
              <button
                type="button"
                onClick={() => patch({ places: prizes.places.filter((_, j) => j !== i) })}
                className="text-[10px] text-text-muted hover:text-red-400 transition-colors"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      {prizes.places.length === 0 && (
        <p className="text-xs text-text-muted">
          No places set — this competition pays nothing but bragging rights.
        </p>
      )}

      {!locked && prizes.places.length < MAX_WEEKLY_PLACES && (
        <button
          type="button"
          onClick={() => patch({ places: [...prizes.places, { gp: 0 }] })}
          className="mt-3 text-xs px-2.5 py-1 rounded-md bg-card-border/40 text-text-muted hover:text-foreground transition-colors"
        >
          + Add {prizes.places.length === 0 ? 'a place' : ordinal(prizes.places.length)}
        </button>
      )}

      {prizes.places.length > 0 && (
        <div className="mt-4 space-y-3 border-t border-card-border pt-4">
          <Checkbox
            checked={prizes.splitTies}
            onChange={(checked) => patch({ splitTies: checked })}
            disabled={locked}
            label="Split a place between people who finish level"
            description="Everyone tied pools the places they occupy and takes an equal share — three tied for first on a 100m / 50m / 25m ladder take 58.3m each. Off, the board's own order decides and the first of them takes the bigger prize."
          />
          <Checkbox
            checked={prizes.payZeroGain}
            onChange={(checked) => patch({ payZeroGain: checked })}
            disabled={locked}
            label="Pay a place even if they gained nothing"
            description="Off by default. On a quiet week a board can have three entrants with two on zero, and paying gp for turning up is not usually what a top three meant."
          />
        </div>
      )}

      {total > 0 && (
        <p className={`mt-4 text-xs ${overPromised ? 'text-amber-300' : 'text-text-muted'}`}>
          {overPromised
            ? `This ladder promises ${formatGp(total)} gp and the coffer has ${formatGp(cofferAvailable)} available. The places it can't cover are still recorded — as owed, unpaid — so nobody's prize quietly disappears.`
            : `Promises ${formatGp(total)} gp of the coffer's ${formatGp(cofferAvailable)}.`}
        </p>
      )}

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
