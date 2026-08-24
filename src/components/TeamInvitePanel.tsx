'use client';

import { useCallback, useEffect, useState } from 'react';
import NumberInput from '@/components/NumberInput';
import { MAX_INVITE_HOURS, MAX_INVITE_USES } from '@/lib/teamInvites';
import { clanFetch } from '@/lib/clanFetch';
import Checkbox from '@/components/Checkbox';

/**
 * The invite links for one team (lib/teamInvites).
 *
 * Same panel for the host and for a captain: what differs is only whether the server let this
 * caller mint, which it answers on the GET. Everyone can see the links their team has out and how
 * many seats are left — a captain who can't mint still needs to know a link exists before asking
 * for another.
 */

interface InviteRow {
  token: string;
  url: string;
  maxUses: number | null;
  uses: number;
  expiresAt: string | null;
  revokedAt: string | null;
  summary: string;
}

interface Props {
  teamId: number;
  /** Admin-only: the event switch that decides whether captains may mint. Absent for a captain. */
  captainToggle?: { eventId: number; rules: string | null };
  /** Embedded in another card (the captain's tools) — drop the frame, heading and pitch. */
  bare?: boolean;
}

export default function TeamInvitePanel({ teamId, captainToggle, bare = false }: Props) {
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [mayMint, setMayMint] = useState(false);
  const [captainInvites, setCaptainInvites] = useState(false);
  const [seats, setSeats] = useState(0);
  const [hours, setHours] = useState(0);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await clanFetch(`/api/team/${teamId}/invites`);
    if (!res.ok) return;
    const data = await res.json();
    setInvites(data.invites ?? []);
    setMayMint(!!data.mayMint);
    setCaptainInvites(!!data.captainInvites);
  }, [teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function mint() {
    setBusy(true);
    setError(null);
    try {
      const res = await clanFetch(`/api/team/${teamId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 0 means "don't set one" in both fields — an unlimited link with no expiry is the useful
        // default for a clan-v-clan, and a host who wants a tighter one says so.
        body: JSON.stringify({
          maxUses: seats > 0 ? seats : undefined,
          expiresHours: hours > 0 ? hours : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Could not make a link');
        return;
      }
      setInvites(data.invites ?? []);
      await copy(data.url);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(token: string) {
    setBusy(true);
    try {
      const res = await clanFetch(`/api/team/${teamId}/invites?token=${token}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setInvites(data.invites ?? []);
    } finally {
      setBusy(false);
    }
  }

  async function copy(path: string) {
    const full = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(full);
      setCopied(path);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setError(full); // clipboard refused — show it so they can copy by hand
    }
  }

  async function toggleCaptainInvites(next: boolean) {
    if (!captainToggle) return;
    setBusy(true);
    try {
      const res = await clanFetch(`/api/events/${captainToggle.eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: { ...JSON.parse(captainToggle.rules || '{}'), captainInvites: next } }),
      });
      if (res.ok) setCaptainInvites(next);
    } finally {
      setBusy(false);
    }
  }

  const live = invites.filter((i) => !i.revokedAt);

  return (
    <div className={bare ? '' : 'border border-card-border rounded-xl bg-card-bg p-4'}>
      {!bare && (
        <>
          <h3 className="font-semibold flex items-center gap-2 mb-1">
            <span className="w-1 h-5 bg-gold rounded-full" />
            Invite links
          </h3>
          <p className="text-sm text-text-muted mb-3">
            A link that puts whoever opens it straight onto this team — they still sign in and still
            need a verified RSN, but they skip the draft pool and the approval queue. Made for a
            visiting clan fielding its own roster.{' '}
            {/* The panel is the moment a host wonders how the rest of it fits together — the staff
                seat, the captain switch, what the other clan actually sees. */}
            <a
              href="/guide/clan-vs-clan"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:text-gold-light whitespace-nowrap"
            >
              Hosting a visiting clan →
            </a>
          </p>
        </>
      )}
      {bare && (
        <p className="text-sm text-text-muted mb-3">
          Puts whoever opens it straight onto this team — no draft pool, no approval queue. They still
          sign in and still need a verified RSN.
        </p>
      )}

      {captainToggle && (
        <Checkbox
          checked={captainInvites}
          disabled={busy}
          onChange={toggleCaptainInvites}
          className="mb-3"
          label={
            <>
              Let captains make their own links
              <span className="font-normal text-text-muted"> — applies to every team in this event</span>
            </>
          }
        />
      )}

      {mayMint && (
        <div className="flex flex-wrap items-end gap-3 mb-3">
          <label className="block">
            <span className="text-xs text-text-muted block mb-1">Seats (0 = no limit)</span>
            <div className="w-28">
              <NumberInput value={seats} onChange={setSeats} min={0} max={MAX_INVITE_USES} fallback={0} aria-label="Seats" />
            </div>
          </label>
          <label className="block">
            <span className="text-xs text-text-muted block mb-1">Expires in hours (0 = never)</span>
            <div className="w-32">
              <NumberInput value={hours} onChange={setHours} min={0} max={MAX_INVITE_HOURS} fallback={0} aria-label="Expiry in hours" />
            </div>
          </label>
          <button
            type="button"
            onClick={mint}
            disabled={busy}
            className="text-sm px-3 py-2 rounded-lg bg-gold/15 text-gold border border-gold/30 hover:bg-gold/25 transition-colors disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Make a link'}
          </button>
        </div>
      )}

      {!mayMint && (
        <p className="text-xs text-text-muted mb-3">
          Only a host can make links for this event.
        </p>
      )}

      {live.length === 0 ? (
        <p className="text-sm text-text-muted">No links out.</p>
      ) : (
        <ul className="divide-y divide-card-border">
          {live.map((i) => (
            <li key={i.token} className="py-2 flex items-center gap-2 text-sm">
              <code className="font-mono text-xs text-gold truncate">{i.url}</code>
              <span className="text-[11px] text-text-muted whitespace-nowrap ml-auto">{i.summary}</span>
              <button
                type="button"
                onClick={() => copy(i.url)}
                className="text-[11px] px-2 py-0.5 rounded border border-card-border text-text-muted hover:text-gold hover:border-gold/40 shrink-0"
              >
                {copied === i.url ? 'Copied' : 'Copy'}
              </button>
              {mayMint && (
                <button
                  type="button"
                  onClick={() => revoke(i.token)}
                  disabled={busy}
                  className="text-[11px] px-2 py-0.5 rounded border border-card-border text-text-muted hover:text-red-400 hover:border-red-400/40 shrink-0 disabled:opacity-50"
                >
                  Turn off
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-xs text-red-400 mt-2 break-all">{error}</p>}
    </div>
  );
}
