'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clanFetch } from '@/lib/clanFetch';
import { formatGp } from '@/lib/adminEventsFormat';
import WeeklyPrizeLadder from '@/components/WeeklyPrizeLadder';
import GuideLink from '@/components/GuideLink';
import { totalPrizeGp, type WeeklyPrizes } from '@/lib/weeklyPrizes';
import type { WeeklyWinner } from '@/lib/coffer';
import { useUnsavedChanges, UnsavedIndicator } from '@/components/UnsavedChanges';
import { valuesEqual } from '@/lib/unsavedChanges';

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
  initialHeld,
  settledAt,
  canEdit,
  hasCoffer,
  hcw = false,
  winners = [],
}: {
  /** Once settled: who won what, as the coffer holds it, with a "Sent it" for each still owed. */
  winners?: WeeklyWinner[];
  /** Paid in Hardcore Worlds gp: the balance shown is that pot's. */
  hcw?: boolean;
  competitionId: number;
  initial: WeeklyPrizes;
  cofferAvailable: number;
  /** Whether this ladder's gp is already set aside. Opens the toggle where the host left it. */
  initialHeld: boolean;
  /** Set once the prizes have been reserved. The ladder is history from then on. */
  settledAt: string | null;
  /** Treasurer or admin. A moderator sees the ladder and cannot change it. */
  canEdit: boolean;
  hasCoffer: boolean;
}) {
  const [prizes, setPrizes] = useState<WeeklyPrizes>(initial);
  // Holding is the default for a ladder that has none yet: a promise the pot can spend twice is the
  // whole failure the coffer exists to prevent.
  const [hold, setHold] = useState(initialHeld || totalPrizeGp(initial) === 0);
  // The coffer moves when this saves, so the number on screen has to move with it rather than
  // showing what was true when the page was rendered.
  const [available, setAvailable] = useState(cofferAvailable);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  // What the server last kept (starts as what the page opened with): the ladder and hold are dirty against it.
  const [saved, setSaved] = useState<{ prizes: WeeklyPrizes; hold: boolean }>({ prizes: initial, hold });
  const dirty = !valuesEqual({ prizes, hold }, saved);
  useUnsavedChanges(dirty);

  const locked = !canEdit || Boolean(settledAt);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await clanFetch(`/api/admin/weekly/${competitionId}/prizes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...prizes, hold }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save the prizes.');
      // The server cleans the ladder — trailing empty places dropped, amounts clamped — so take its
      // answer rather than leaving the screen showing something that will not be paid.
      setPrizes(data.prizes);
      setSaved({ prizes: data.prizes, hold });
      if (data.balance) setAvailable(data.balance.available + (data.held ? data.total : 0));
      setMessage({
        type: 'success',
        text:
          data.total > 0
            ? data.held
              ? `Saved. ${formatGp(data.total)} gp held for this week.`
              : `Saved. ${formatGp(data.total)} gp promised, nothing held.`
            : 'Saved. This competition pays nothing.',
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
          <span className="text-xs text-text-muted">{formatGp(available)} {hcw ? 'HCW gp available in the Hardcore Worlds coffer' : 'gp available in the coffer'}</span>
        </div>
      </div>
      <p className="text-xs text-text-muted mb-4">
        Held out of the clan coffer while this runs, so nothing else can promise the same gp. When
        the week ends the final standings decide who gets what — a treasurer then sends it and marks
        it paid on the coffer page. Anything nobody wins goes back to the pot.
      </p>

      {settledAt && (
        <div className="mb-4 space-y-3">
          <WinnersList winners={winners} canPay={canEdit} hcw={hcw} />
          {canEdit && <PrizeRedo competitionId={competitionId} />}
        </div>
      )}

      {!settledAt && <WeeklyPrizeLadder
        value={prizes}
        onChange={setPrizes}
        cofferAvailable={available}
        hasCoffer={hasCoffer}
        hold={hold}
        onHoldChange={setHold}
        disabled={locked}
      />}

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
          <UnsavedIndicator dirty={dirty} />
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

/**
 * Standings corrected after the end (a forced track, a fixed baseline)? Move the prizes to match and
 * post corrected results (lib/weeklyPrizeRedo). Refused by the server once any prize is marked paid.
 */
function PrizeRedo({ competitionId }: { competitionId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function redo(repost: boolean) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await clanFetch(`/api/admin/weekly/${competitionId}/prizes/redo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repost }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not redo the prizes.');
      setOpen(false);
      setMessage({
        type: 'success',
        text: data.reposted
          ? 'Prizes moved to the current standings, and corrected results posted to Discord.'
          : 'Prizes moved to the current standings.',
      });
      router.refresh();
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Could not redo the prizes.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-card-border bg-brown-dark/40 p-3 text-xs">
      {!open ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-text-muted">Standings changed after the end (for example after Update)?</span>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg border border-gold/50 px-3 py-1.5 font-semibold text-gold hover:border-gold"
          >
            Redo prizes from the current standings
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-foreground">
            This cancels the prizes set aside now and gives each place to whoever holds it on the final
            leaderboard below. Only works while none of them is marked paid.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void redo(true)}
              className="rounded-lg bg-gold/90 px-3 py-1.5 font-semibold text-brown-dark hover:bg-gold disabled:opacity-50"
            >
              {busy ? 'Working…' : 'Redo and post corrected results'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void redo(false)}
              className="rounded-lg border border-gold/50 px-3 py-1.5 font-semibold text-gold hover:border-gold disabled:opacity-50"
            >
              Redo without posting
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setOpen(false)}
              className="rounded-lg border border-card-border px-3 py-1.5 text-text-muted hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {message && (
        <p className={`mt-2 ${message.type === 'error' ? 'text-red-400' : 'text-accent-green-light'}`}>{message.text}</p>
      )}
    </div>
  );
}

/**
 * A finished competition's results as they pay: each place, who, how much, and whether it has been
 * sent. "Sent it" marks one paid on the coffer, once the gp has gone over in game.
 */
function WinnersList({ winners, canPay, hcw }: { winners: WeeklyWinner[]; canPay: boolean; hcw: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function pay(entryId: number) {
    setBusy(entryId);
    setError(null);
    try {
      const res = await clanFetch(`/api/admin/coffer/${entryId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'pay' }) });
      if (!res.ok) setError(((await res.json().catch(() => ({}))) as { error?: string }).error || 'Could not mark it paid.');
      else router.refresh();
    } catch {
      setError('Could not mark it paid.');
    } finally {
      setBusy(null);
    }
  }
  if (winners.length === 0) {
    return <p className="text-sm text-text-muted">Finished. Nobody placed for a prize, so nothing was taken from the coffer.</p>;
  }
  const owed = winners.filter((w) => w.status !== 'paid').reduce((n, w) => n + w.gp, 0);
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">Results</p>
      <ul className="divide-y divide-card-border rounded-lg border border-card-border">
        {winners.map((w) => (
          <li key={w.entryId} className="flex items-center gap-3 px-3 py-2">
            <span className="w-8 shrink-0 font-mono text-sm text-gold">{w.place ? `#${w.place}` : ''}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{w.rsn ?? 'A winner'}</span>
            <span className="shrink-0 text-sm text-gold-light">{formatGp(w.gp)}{hcw ? ' HCW gp' : ''}</span>
            {w.status === 'paid' ? (
              <span className="shrink-0 rounded-full border border-accent-green-light/40 px-2 py-0.5 text-xs text-accent-green-light">Sent</span>
            ) : canPay ? (
              <button
                type="button"
                disabled={busy === w.entryId}
                onClick={() => pay(w.entryId)}
                className="shrink-0 rounded-lg border border-gold bg-gold/20 px-2.5 py-1 text-xs font-semibold text-gold hover:bg-gold/30 disabled:opacity-50"
              >
                {busy === w.entryId ? 'Saving…' : 'Sent it'}
              </button>
            ) : (
              <span className="shrink-0 text-xs text-text-muted">Held for them</span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-xs text-text-muted">
        {owed > 0
          ? `${formatGp(owed)} is held in the coffer for these winners. Send each one in game, then press Sent it.`
          : 'Every prize has been sent.'}
      </p>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
