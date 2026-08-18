'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Account {
  id: number;
  rsn: string;
  isPrimary: number | null;
}

/**
 * The one button on the invite page, plus the account picker it needs.
 *
 * Someone with a single verified account should not be made to choose anything, so the picker only
 * appears when there is a real choice to make.
 */
export default function JoinClient({
  eventId,
  token,
  teamName,
  accounts,
  seatsLeft,
}: {
  eventId: number;
  token: string;
  teamName: string;
  accounts: Account[];
  seatsLeft: number | null;
}) {
  const router = useRouter();
  const [chosen, setChosen] = useState<number>(
    accounts.find((a) => a.isPrimary === 1)?.id ?? accounts[0].id,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/join/${token}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clanMemberId: chosen }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'That did not work — try again in a moment.');
        return;
      }
      setDone(data.alreadyOn ? `You were already on ${data.teamName}.` : `You're on ${data.teamName}.`);
      router.refresh();
    } catch {
      setError('That did not work — check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mt-5">
        <div className="rounded-lg border border-accent-green/30 bg-accent-green/10 p-4 text-sm">{done}</div>
        <a
          href={`/events/${eventId}`}
          className="mt-3 inline-block rounded-lg border border-gold/30 bg-gold/20 px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/30"
        >
          Go to the board →
        </a>
      </div>
    );
  }

  return (
    <div className="mt-5">
      {accounts.length > 1 && (
        <label className="block">
          <span className="text-xs text-text-muted">Which account are you playing?</span>
          <select
            value={chosen}
            onChange={(e) => setChosen(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-card-border bg-brown-dark/40 px-3 py-2 text-sm"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.rsn}
              </option>
            ))}
          </select>
        </label>
      )}

      <button
        onClick={join}
        disabled={busy}
        className="mt-4 w-full rounded-lg border border-gold/30 bg-gold/20 px-4 py-2.5 text-sm font-semibold text-gold transition-colors hover:bg-gold/30 disabled:opacity-50"
      >
        {busy ? 'Joining…' : `Join ${teamName}`}
      </button>

      <p className="mt-2 text-center text-[11px] text-text-muted">
        {seatsLeft == null ? 'No approval needed.' : `No approval needed · ${seatsLeft} seat${seatsLeft === 1 ? '' : 's'} left`}
      </p>
      {error && <p className="mt-3 rounded-lg border border-card-border bg-brown-dark/40 p-3 text-sm">{error}</p>}
    </div>
  );
}
