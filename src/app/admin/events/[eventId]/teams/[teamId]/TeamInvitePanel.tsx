'use client';

import { useCallback, useEffect, useState } from 'react';
import Input from '@/components/Input';

interface InviteRow {
  id: number;
  token: string;
  teamId: number;
  label: string | null;
  maxUses: number | null;
  uses: number;
  expiresAt: string | null;
  revokedAt: string | null;
  summary: string;
  path: string;
}

/**
 * The link that puts the other clan's players straight onto this team.
 *
 * Staff seats gave their moderator the roster; this is the way IN for the players themselves. The
 * host mints it, the other clan shares it however they like, and whoever opens it lands here rather
 * than in the draft pool — still signing in with Discord, still needing a verified RSN.
 *
 * Shows only this team's links even though the endpoint is event-wide: the panel lives on a team
 * page, and a list of every team's links here would be a different feature wearing this one's name.
 */
export default function TeamInvitePanel({ eventId, teamId }: { eventId: number; teamId: number }) {
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [seats, setSeats] = useState('');
  const [expires, setExpires] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/invites`);
      if (res.ok) {
        const data = await res.json();
        setInvites((data.invites ?? []).filter((i: InviteRow) => i.teamId === teamId));
      }
    } catch {
      /* leave the list as it was */
    }
  }, [eventId, teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function mint() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/invites`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          teamId,
          label: label.trim() || null,
          // Empty means unlimited, which is a real choice rather than a missing one.
          maxUses: seats.trim() ? Number(seats) : null,
          expiresAt: expires ? new Date(expires).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Could not make a link');
        return;
      }
      setLabel('');
      setSeats('');
      setExpires('');
      setOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function revoke(token: string) {
    setBusy(true);
    try {
      await fetch(`/api/events/${eventId}/invites/${token}`, { method: 'DELETE' });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function copy(path: string, token: string) {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(token);
      window.setTimeout(() => setCopied((c) => (c === token ? null : c)), 2000);
    } catch {
      // Clipboard can be refused (permissions, http). Select-and-copy still works from the field.
      setError('Copy the link from the box instead — the browser refused clipboard access.');
    }
  }

  const live = invites.filter((i) => !i.revokedAt);

  return (
    <section className="border border-card-border rounded-xl bg-card-bg p-4 mb-4">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <span className="w-1 h-5 bg-gold rounded-full" />
        <h2 className="text-base font-bold">Invite links</h2>
        <span className="text-xs text-text-muted">
          {live.length === 0 ? 'none yet' : `${live.length} live`}
        </span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="ml-auto text-xs font-semibold px-3 py-1.5 border border-card-border rounded-lg hover:border-gold/40 transition-colors"
        >
          {open ? 'Close' : 'New link'}
        </button>
      </div>
      <p className="text-xs text-text-muted mb-3 max-w-[75ch]">
        Anyone who opens one of these lands on <b>this team</b> with no approval needed — they still
        sign in with Discord and still need a verified RSN. Fees are unchanged: an invited player owes
        what everyone else owes, and this team&rsquo;s captain or staff can settle it from their team page.
      </p>

      {invites.length > 0 && (
        <div className="grid gap-1.5 mb-3">
          {invites.map((i) => (
            <div
              key={i.id}
              className={`border border-card-border rounded-lg bg-brown-dark/40 px-3 py-2 ${i.revokedAt ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center gap-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{i.label ?? 'Invite link'}</div>
                  <div className="text-xs text-text-muted">{i.summary}</div>
                </div>
                {!i.revokedAt && (
                  <>
                    <button
                      type="button"
                      onClick={() => copy(i.path, i.token)}
                      className="ml-auto shrink-0 text-xs px-2.5 py-1.5 border border-card-border rounded-lg hover:border-gold/40 transition-colors"
                    >
                      {copied === i.token ? 'Copied' : 'Copy link'}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => revoke(i.token)}
                      className="shrink-0 text-xs px-2.5 py-1.5 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    >
                      Turn off
                    </button>
                  </>
                )}
              </div>
              {!i.revokedAt && (
                <input
                  readOnly
                  value={i.path}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label="Invite link"
                  className="mt-2 w-full rounded-md border border-card-border bg-brown-dark/60 px-2 py-1 font-mono text-[11px] text-text-muted"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="border border-card-border rounded-lg p-3 bg-brown-dark/30">
          <div className="grid gap-2 sm:grid-cols-3 mb-2">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Name it, e.g. Ironforge"
              maxLength={60}
              aria-label="Label"
            />
            <Input
              value={seats}
              onChange={(e) => setSeats(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="Seats (blank = no limit)"
              inputMode="numeric"
              aria-label="Seats"
            />
            <Input
              type="datetime-local"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
              aria-label="Expires"
            />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={mint}
            className="text-xs font-semibold px-3 py-1.5 border border-gold/30 bg-gold/20 text-gold rounded-lg hover:bg-gold/30 transition-colors disabled:opacity-50"
          >
            {busy ? 'Making…' : 'Make the link'}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
    </section>
  );
}
