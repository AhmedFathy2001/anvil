'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import Select from '@/components/Select';
import { clanFetch } from '@/lib/clanFetch';

/**
 * "Can I play this on my other account?" — the asking and the answering, in one card.
 *
 * ONE COMPONENT FOR BOTH SIDES because the two audiences overlap: a co-host's moderator is usually
 * also playing, and making them load two screens to see their own request and their team's queue
 * would be a distinction drawn for the code's convenience rather than theirs. The endpoint answers
 * both halves in one read for the same reason.
 *
 * Neither half renders when it has nothing to say, so on the ordinary board — where nobody has asked
 * and nobody is waiting — the card is not there at all.
 */

interface Option {
  clanMemberId: number;
  rsn: string;
}

interface Mine {
  participantId: number;
  playingAs: string;
  open: { id: number; note: string | null; createdAt: string } | null;
  options: Option[];
}

interface Waiting {
  id: number;
  playerName: string;
  fromRsn: string | null;
  toRsn: string | null;
  note: string | null;
  teamName: string | null;
  eventName: string;
}

export default function AccountChangeCard({
  eventId,
  mode = 'both',
}: {
  eventId: number;
  /**
   * 'both' — the team page, where a player asks and a manager answers on the one screen they open.
   * 'decide' — an admin surface, which is not where somebody goes to ask about their own character.
   *
   * Without this the admin's Sign-ups tab rendered a whole card to tell an admin who happens to be
   * playing that they could ask to switch — half a page wide, one line in it, and a column of empty
   * space beside the card next to it.
   */
  mode?: 'both' | 'decide';
}) {
  const router = useRouter();
  const [mine, setMine] = useState<Mine | null>(null);
  const [waiting, setWaiting] = useState<Waiting[]>([]);
  const [picked, setPicked] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  const load = useCallback(async () => {
    const res = await clanFetch(`/api/events/${eventId}/account-change`);
    if (!res.ok) return;
    const data = await res.json();
    setMine(data.me ?? null);
    setWaiting(data.toDecide ?? []);
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send(path: string, init: RequestInit) {
    setBusy(true);
    setError(null);
    try {
      const res = await clanFetch(path, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        return false;
      }
      await load();
      // The board follows a different character now, so everything reading it is stale.
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  const showMine = mode === 'both';
  const canAsk = showMine && mine && !mine.open && mine.options.length > 0;
  const showOpen = showMine && mine?.open;
  // Nothing to ask and nothing waiting is not a card. On an admin surface that means the card is
  // simply absent until somebody has actually asked for something.
  if (!showOpen && !canAsk && waiting.length === 0) return null;

  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1 h-5 bg-gold rounded-full" />
        <h3 className="font-semibold">Playing on a different account</h3>
      </div>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {/* Waiting on YOU, first: somebody is on the other end of it. */}
      {waiting.length > 0 && (
        <ul className="mb-4 space-y-2">
          {waiting.map((w) => (
            <li key={w.id} className="rounded-lg border border-gold/25 bg-gold/[0.05] p-3">
              <p className="text-sm">
                <b className="text-foreground">{w.playerName}</b>
                {w.teamName && <span className="text-text-muted"> · {w.teamName}</span>}
              </p>
              <p className="mt-1 text-sm text-text-muted">
                {w.fromRsn ?? 'their current character'} → <b className="text-gold">{w.toRsn}</b>
              </p>
              {w.note && <p className="mt-1 text-[13px] text-text-dim italic">&ldquo;{w.note}&rdquo;</p>}
              <div className="mt-2.5 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    send(`/api/events/${eventId}/account-change/${w.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ decision: 'approved' }),
                    })
                  }
                  className="rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-brown-dark disabled:opacity-50"
                >
                  Approve &amp; repoint
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    send(`/api/events/${eventId}/account-change/${w.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ decision: 'rejected' }),
                    })
                  }
                  className="rounded-lg border border-card-border px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  No
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Their own ask. A standing request is shown rather than the form — asking twice is the
          same ask, and the server refuses it, so offering the form again would be a dead end. */}
      {showOpen ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-text-muted">
            Waiting on an answer. You are still being scored as{' '}
            <b className="text-foreground">{mine.playingAs}</b> until then.
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              send(`/api/events/${eventId}/account-change`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: mine.open!.id }),
              })
            }
            className="text-[13px] text-text-dim underline-offset-4 hover:text-gold hover:underline disabled:opacity-50"
          >
            Withdraw
          </button>
        </div>
      ) : canAsk ? (
        asking ? (
          <div className="space-y-2.5">
            <Select
              value={picked}
              onChange={setPicked}
              ariaLabel="Character to be scored on"
              options={[
                { value: '', label: 'Pick one of your characters…' },
                ...mine.options.map((o) => ({ value: String(o.clanMemberId), label: o.rsn })),
              ]}
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why, if it helps (optional)"
              className="w-full rounded-lg border border-card-border bg-brown-dark px-3 py-2 text-sm outline-none focus:border-gold"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy || !picked}
                onClick={async () => {
                  const ok = await send(`/api/events/${eventId}/account-change`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      participantId: mine.participantId,
                      clanMemberId: Number(picked),
                      note,
                    }),
                  });
                  if (ok) {
                    setAsking(false);
                    setNote('');
                    setPicked('');
                  }
                }}
                className="rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-brown-dark disabled:opacity-50"
              >
                Ask
              </button>
              <button
                type="button"
                onClick={() => setAsking(false)}
                className="rounded-lg border border-card-border px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-muted">
            Scored as <b className="text-foreground">{mine.playingAs}</b>.{' '}
            <button
              type="button"
              onClick={() => setAsking(true)}
              className="text-gold underline-offset-4 hover:underline"
            >
              Ask to switch character
            </button>
          </p>
        )
      ) : null}
    </div>
  );
}
