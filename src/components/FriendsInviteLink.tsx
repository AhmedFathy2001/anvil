'use client';

import { useState } from 'react';

/**
 * A friends event's invite link (lib/friendEvents): the only way in, so it is front and centre for
 * the host — copy it, or make a new one if it was shared too widely (the old link then stops
 * working; anybody already in stays in).
 *
 * The link lives on the apex (/f/<token>), never under a clan address: a friends host has no page.
 * `apiBase` is how to reach the event's routes from where this renders (clan-prefixed inside the
 * event's admin, the host's `/c/<slug>` from /host/friends).
 */
export default function FriendsInviteLink({
  eventId,
  token: initialToken,
  apiBase = '',
  compact = false,
}: {
  eventId: number;
  token: string;
  apiBase?: string;
  compact?: boolean;
}) {
  const [token, setToken] = useState(initialToken);
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const link = () => `${window.location.origin}/f/${token}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setManual(true);
    }
  }

  async function rotate() {
    if (!window.confirm('Make a new invite link? The old one stops working. Friends already in stay in.')) return;
    setBusy(true);
    setNote(null);
    try {
      // `apiBase` IS the host's clan prefix, passed in by whoever renders this.
      const res = await fetch(`${apiBase}/api/events/${eventId}/invite-link`, { method: 'POST' }); // clan-prefix: platform -- prefixed by apiBase
      const data: { token?: string; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) {
        setNote(data.error ?? 'That didn’t work. Try again.');
        return;
      }
      setToken(data.token);
      setNote('New link made. The old one no longer works.');
    } finally {
      setBusy(false);
    }
  }

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={copy}
          className="rounded-lg border border-gold/40 px-3 py-1.5 text-xs font-medium text-gold transition-colors hover:border-gold hover:bg-gold/10"
        >
          {copied ? 'Copied ✓' : 'Copy invite link'}
        </button>
        {manual && <span className="break-all text-xs text-text-muted select-all">{link()}</span>}
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-gold/30 bg-card-bg p-4">
      <div className="flex items-center gap-2">
        <span className="h-5 w-1 rounded-full bg-gold" aria-hidden />
        <h2 className="font-semibold">Invite link</h2>
      </div>
      <p className="mt-1 text-sm text-text-muted">
        This event is private. Send this link to your friends — it is the only way in.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={copy}
          className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light"
        >
          {copied ? 'Copied!' : 'Copy invite link'}
        </button>
        <button
          type="button"
          onClick={rotate}
          disabled={busy}
          className="rounded-xl border border-card-border px-3 py-2 text-sm text-text-muted transition-colors hover:border-gold/40 hover:text-gold disabled:opacity-60"
        >
          New link
        </button>
      </div>
      {manual && <p className="mt-2 break-all text-xs text-text-muted select-all">{link()}</p>}
      {note && <p className="mt-2 text-xs text-text-muted">{note}</p>}
    </div>
  );
}
