'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import Select from '@/components/Select';
import { formatGp } from '@/lib/adminEventsFormat';
import { clanFetch } from '@/lib/clanFetch';

/**
 * Signing yourself up for a competition that takes sign-ups (lib/weeklySignups), and what you owe.
 *
 *   not entered            "Enter" (with a character picker when you have several)
 *   entered, fee owing     how much, and who to pay
 *   entered before start   "Take my sign-up back", while no fee has been handed over
 *
 * Once it runs, coming off the board is the ordinary Opt out below this card.
 */
export default function SelfEntry({
  competitionId,
  entryFee,
  started,
  seats,
  entries,
  signedIn,
}: {
  competitionId: number;
  entryFee: number | null;
  started: boolean;
  seats: { id: number; rsn: string }[];
  entries: { participantId: number; rsn: string; feeAmount: number | null; feeStatus: string | null }[];
  signedIn: boolean;
}) {
  const router = useRouter();
  const open = seats.filter((s) => !entries.some((e) => e.rsn.toLowerCase() === s.rsn.toLowerCase()));
  const [seat, setSeat] = useState(String(open[0]?.id ?? ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(method: 'POST' | 'DELETE') {
    setBusy(true);
    setError(null);
    try {
      const res = await clanFetch(`/api/weekly/${competitionId}/enter`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'POST' ? JSON.stringify({ clanMemberId: Number(seat) || undefined }) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'That didn’t work');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const fee = entryFee && entryFee > 0 ? `${formatGp(entryFee)} gp` : null;
  const owing = entries.filter((e) => e.feeStatus === 'pending');
  const paid = entries.filter((e) => e.feeStatus === 'collected' || e.feeStatus === 'confirmed');
  const canTakeBack = !started && entries.length > 0 && paid.length === 0;

  return (
    <section className="my-4 rounded-xl border border-gold/40 bg-gold/[0.06] px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gold">{entries.length ? 'You’re signed up' : 'Sign-ups are open'}</h2>
          <p className="mt-0.5 text-sm text-foreground/85">
            {entries.length
              ? `${entries.map((e) => e.rsn).join(', ')} ${entries.length === 1 ? 'is' : 'are'} entered.`
              : fee
                ? `Entry is ${fee}. Enter here, then pay your clan’s staff in game.`
                : 'Free to enter. Press Enter to join the board.'}
            {!entries.length && started ? ' It is already running: you count from the moment you join.' : ''}
          </p>
          {owing.length > 0 && (
            <p className="mt-1 text-sm text-amber-300">
              Entry fee to pay: {formatGp(owing.reduce((n, e) => n + (e.feeAmount ?? 0), 0))} gp. Pay your clan’s staff in game; they mark it here.
            </p>
          )}
          {paid.length > 0 && owing.length === 0 && <p className="mt-1 text-sm text-accent-green-light">Entry fee received.</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!signedIn ? (
            <span className="text-sm text-text-muted">Sign in to enter.</span>
          ) : open.length > 0 ? (
            <>
              {open.length > 1 && (
                <div className="w-44">
                  <Select value={seat} onChange={setSeat} ariaLabel="Character to enter" options={open.map((s) => ({ value: String(s.id), label: s.rsn }))} />
                </div>
              )}
              <button
                type="button"
                onClick={() => call('POST')}
                disabled={busy}
                className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50 max-sm:min-h-11"
              >
                {busy ? 'Entering…' : entries.length ? `Enter ${open.length > 1 ? 'another' : open[0].rsn} too` : fee ? `Enter · ${fee}` : 'Enter'}
              </button>
            </>
          ) : seats.length === 0 ? (
            <span className="max-w-xs text-sm text-text-muted">Play on your character with the Anvil plugin first, so it is linked to this clan.</span>
          ) : null}
          {canTakeBack && (
            <button type="button" onClick={() => call('DELETE')} disabled={busy} className="rounded-lg border border-card-border px-3 py-2 text-sm text-text-muted transition-colors hover:text-foreground disabled:opacity-50 max-sm:min-h-11">
              Take my sign-up back
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </section>
  );
}
