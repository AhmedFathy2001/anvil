'use client';

import { useState } from 'react';

import { clanFetch } from '@/lib/clanFetch';
import { useDialog } from '@/components/Confirm';

interface Result {
  clans: boolean;
  teams: { team: string; ok: boolean; error?: string }[];
}

/**
 * "Send final-hour heads-up" (lib/finalHour): a live-countdown post to every clan on the board, and a
 * ping of each team's role in its own channel. Pings everyone, so it asks first.
 */
export default function FinalHourButton({ eventId }: { eventId: number }) {
  const { confirm } = useDialog();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const ok = await confirm({
      title: 'Send the starting-soon heads-up?',
      body: 'Posts a live countdown to the bingo channel of every clan on this board (pinging members), and pings each team in its own channel.',
      confirmLabel: 'Send it',
      tone: 'gold',
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await clanFetch(`/api/admin/events/${eventId}/final-hour`, { method: 'POST' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error ?? 'Could not send it.');
      else setResult(d as Result);
    } catch {
      setError('Could not send it.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={send}
        disabled={busy}
        className="px-3 py-1.5 rounded-lg text-sm border border-gold/30 text-gold bg-gold/10 hover:bg-gold/20 disabled:opacity-50 transition-colors"
      >
        {busy ? 'Sending…' : '🔥 Send starting-soon heads-up'}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {result && (
        <ul className="text-xs space-y-0.5">
          <li className={result.clans ? 'text-green-400' : 'text-red-400'}>
            Clan channels: {result.clans ? 'posted' : 'host channel refused or not set up'}
          </li>
          {result.teams.length === 0 && <li className="text-text-muted">No team channels to ping.</li>}
          {result.teams.map((t, i) => (
            <li key={`${t.team}-${i}`} className={t.ok ? 'text-green-400' : 'text-red-400'}>
              {t.team}: {t.ok ? 'pinged' : t.error}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
