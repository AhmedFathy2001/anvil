'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import { clanFetch } from '@/lib/clanFetch';

type Verdict =
  | { outcome: 'insider' }
  | { outcome: 'outsider'; needsApproval: boolean }
  | { outcome: 'refused'; reason: 'not-visible' | 'banned' | 'signed-out' };

interface EnterInfo {
  verdict: Verdict;
  options: { id: number; rsn: string }[];
}

/**
 * Entering an event hosted by a clan you are not in.
 *
 * The whole flow existed on the server and could not be reached: `/api/events/[eventId]/enter` —
 * guest admission, the ban check, the rate limit, the account picker — had no caller anywhere in the
 * app, and no test. A visitor who found a public board had no way in, which made "public" mean
 * "readable" and nothing more.
 *
 * The server decides WHETHER to render this (the viewer is an outsider who can see the event); this
 * asks the route what entering would involve, because the answer includes which of their characters
 * are eligible and only the route knows that. One GET, and only for the people it applies to.
 */
export default function EnterEvent({ eventId, signupFee }: { eventId: number; signupFee: number | null }) {
  const router = useRouter();
  const [info, setInfo] = useState<EnterInfo | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    clanFetch(`/api/events/${eventId}/enter`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: EnterInfo | null) => {
        if (!alive || !d) return;
        setInfo(d);
        // One character is the common case; pre-select it so entering is one press, not two.
        if (d.options.length === 1) setChosen(d.options[0].id);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [eventId]);

  if (!info) return null;
  const { verdict, options } = info;

  // The server already filtered to outsiders, but a verdict can change between render and fetch —
  // somebody accepted into the clan in another tab — so trust the route's answer over the reason we
  // were mounted.
  if (verdict.outcome === 'insider') return null;

  if (verdict.outcome === 'refused') {
    if (verdict.reason === 'banned') {
      return (
        <Card tone="muted">
          <div className="font-semibold">You can’t enter this one</div>
          <div className="text-sm text-text-muted">This clan has barred you from its events.</div>
        </Card>
      );
    }
    return null; // signed-out and not-visible are the page's own business, not this card's
  }

  async function enter() {
    if (chosen == null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await clanFetch(`/api/events/${eventId}/enter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: chosen }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? 'Could not enter');
      if (data?.pending) {
        setPending(data.message ?? 'Sent to the host.');
        return;
      }
      // Seated: they now hold a guest seat here, so the ordinary sign-up banner takes over. The
      // server has to re-render for that, and it is the same page — refresh rather than navigate.
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (pending) {
    return (
      <Card tone="info">
        <div className="font-semibold">Waiting on the host</div>
        <div className="text-sm text-text-muted">{pending}</div>
      </Card>
    );
  }

  // Nothing to enter with. Say which door to go through rather than showing an empty picker — an
  // unverified character is the usual reason, and it is fixed somewhere else entirely.
  if (options.length === 0) {
    return (
      <Card tone="info">
        <div className="min-w-0">
          <div className="font-semibold">Verify a character to enter</div>
          <div className="text-sm text-text-muted">
            Entering someone else’s event needs a character you have proved is yours.
          </div>
        </div>
        <ClanLink
          href="/profile"
          className="shrink-0 rounded-lg border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-medium text-gold transition-colors hover:bg-gold/20"
        >
          Go to profile
        </ClanLink>
      </Card>
    );
  }

  const asks = verdict.needsApproval;

  return (
    <Card tone="info">
      <div className="min-w-0">
        <div className="font-semibold">{asks ? 'Ask to play in this event' : 'You can enter this event'}</div>
        <div className="text-sm text-text-muted">
          {asks
            ? 'The host reviews entries from outside the clan.'
            : 'You’ll join as a guest of the hosting clan.'}
          {signupFee ? ` Sign-up fee: ${signupFee.toLocaleString()} gp.` : ''}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {options.length > 1 && (
          <select
            value={chosen ?? ''}
            onChange={(e) => setChosen(Number(e.target.value) || null)}
            className="rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-gold/50"
          >
            <option value="">Which character?</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.rsn}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={enter}
          disabled={busy || chosen == null}
          className="rounded-lg border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-medium text-gold transition-colors hover:bg-gold/20 disabled:opacity-50"
        >
          {busy ? 'Sending…' : asks ? 'Ask to join' : 'Enter'}
        </button>
      </div>
      {error && <p className="w-full text-[12.5px] text-accent-red">{error}</p>}
    </Card>
  );
}

function Card({ tone, children }: { tone: 'info' | 'muted'; children: React.ReactNode }) {
  const cls = tone === 'muted' ? 'border-card-border bg-brown-dark' : 'border-gold/30 bg-gold/10';
  return (
    <div className={`mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 ${cls}`}>
      {children}
    </div>
  );
}
