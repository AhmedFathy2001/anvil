'use client';

import { useState } from 'react';
import { clanFetch } from '@/lib/clanFetch';

/**
 * The way out, which the platform did not have.
 *
 * A clan created by mistake — a typo in the address, a duplicate of one you already run, a test —
 * had no delete at all. It stayed forever, kept its address reserved, and kept its in-game name
 * held against the clan that actually has that name.
 *
 * Owner-only and gated on typing the ADDRESS rather than the display name, because two clans with
 * the same display name is exactly the case this exists to clean up: a confirmation you could
 * satisfy from either of them is not a confirmation. The server checks the same thing again — this
 * is the part that stops an accident, not the part that stops an attacker.
 */
export default function DeleteClan({ slug, isOwner }: { slug: string; isOwner: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOwner) return null;

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await clanFetch('/api/admin/clan/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? 'Could not delete the clan.');
        setBusy(false);
        return;
      }
      // A full navigation, not a router push: the host we are on has just stopped resolving.
      window.location.href = j.redirect ?? '/';
    } catch {
      setError('Could not delete the clan.');
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 rounded-xl border border-red-900/40 bg-card-bg p-5">
      <div className="flex items-center gap-2">
        <span className="h-5 w-1 rounded-full bg-accent-red" />
        <h2 className="text-lg font-semibold">Delete this clan</h2>
      </div>

      <p className="mt-2 max-w-[70ch] text-sm text-text-muted">
        Removes the clan and everything in it — every board, tile, sign-up, fee, roster seat and
        setting. Members keep their characters and their other clans. This cannot be undone, and the
        address <span className="font-mono text-gold/90">{slug}</span> becomes free for anyone.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 rounded-md border border-red-900/60 px-3 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-950/40"
        >
          Delete clan
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <label className="block text-xs text-text-muted">
            Type <span className="font-mono text-gold/90">{slug}</span> to confirm.
          </label>
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={slug}
            autoComplete="off"
            className="w-full max-w-sm rounded-lg border border-card-border bg-brown-dark px-3 py-2 text-sm outline-none focus:border-red-900"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={remove}
              disabled={busy || confirm.trim().toLowerCase() !== slug.toLowerCase()}
              className="rounded-md bg-red-900/70 px-3 py-1.5 text-xs text-red-100 transition-colors hover:bg-red-900 disabled:opacity-40"
            >
              {busy ? 'Deleting…' : 'Delete permanently'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirm('');
                setError(null);
              }}
              className="rounded-md border border-card-border px-3 py-1.5 text-xs text-text-muted transition-colors hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
