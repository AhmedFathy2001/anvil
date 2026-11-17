'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import Checkbox from '@/components/Checkbox';
import Input from '@/components/Input';
import { formatGp, parseGpInput } from '@/lib/adminEventsFormat';
import { clanFetch } from '@/lib/clanFetch';

/**
 * Sign-ups and the entry fee of a competition (lib/weeklySignups), switched on or changed after it
 * was created. Turning sign-ups on makes it a "selected people" competition: nobody is swept in
 * from the roster any more, and the people already in stay in.
 */
export default function WeeklySignupPanel({
  competitionId,
  selfSignup: initialOn,
  entryFee: initialFee,
  ended,
  canSetFee,
}: {
  competitionId: number;
  selfSignup: boolean;
  entryFee: number | null;
  ended: boolean;
  /** A treasurer or admin: the fee is the clan's money. */
  canSetFee: boolean;
}) {
  const router = useRouter();
  const [on, setOn] = useState(initialOn);
  const [feeText, setFeeText] = useState(initialFee ? formatGp(initialFee) : '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const fee = parseGpInput(feeText);
  const badFee = !!feeText.trim() && !fee;
  const dirty = on !== initialOn || (on && (fee ?? null) !== (initialFee ?? null));

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await clanFetch(`/api/admin/weekly/${competitionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selfSignup: on, ...(on && canSetFee ? { entryFee: fee ?? null } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ ok: false, text: data.error ?? 'Could not save.' });
        return;
      }
      setMessage({ ok: true, text: 'Saved.' });
      router.refresh();
    } catch {
      setMessage({ ok: false, text: 'Could not save. Check your connection and try again.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-6 rounded-xl border border-card-border bg-card-bg p-5">
      <div className="mb-1 flex items-center gap-2">
        <span className="h-5 w-1 bg-gold" />
        <h2 className="text-lg font-semibold">Sign-ups and entry fee</h2>
      </div>
      <p className="mb-4 text-sm text-text-muted">
        With sign-ups on, members enter themselves from the competition&apos;s page instead of being entered automatically. You can still add people on
        Participants.
      </p>
      <Checkbox checked={on} onChange={setOn} disabled={ended} label="Members sign themselves up" className="text-sm text-foreground/90" />
      {on && !initialOn && (
        <p className="mt-2 text-xs text-amber-300">The roster stops being entered automatically. Everyone already in stays in; take people out on Participants.</p>
      )}
      {on && (
        <div className="mt-4 max-w-xs">
          <label className="mb-1.5 block text-sm text-text-muted">Entry fee (optional)</label>
          <Input value={feeText} onChange={(e) => setFeeText(e.target.value)} placeholder="Free — or 500k, 2m" aria-label="Entry fee in gp" disabled={ended || !canSetFee} />
          <p className="mt-1.5 text-xs text-text-muted">
            {!canSetFee
              ? 'Only a treasurer or admin can set the fee.'
              : badFee
                ? 'Write an amount like 500k or 2m, or leave it empty for a free competition.'
                : fee
                  ? `${formatGp(fee)} gp each, paid in game to your staff. A change applies to people who sign up from now on.`
                  : 'Free to enter.'}
          </p>
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving || badFee || ended}
          className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save sign-ups'}
        </button>
        {message && <span className={`text-sm ${message.ok ? 'text-accent-green-light' : 'text-red-400'}`}>{message.text}</span>}
      </div>
    </section>
  );
}
