'use client';

import { useEffect, useState } from 'react';
import { clanFetch } from '@/lib/clanFetch';

const YOUTUBE_RETURN: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: 'YouTube channel connected.' },
  nochannel: { ok: false, text: 'That Google account has no YouTube channel. Pick the account (or brand account) that owns your channel.' },
  scopes: { ok: false, text: 'Google didn’t give Anvil the permission it asked for. Try again and press Allow.' },
  denied: { ok: false, text: 'YouTube connection cancelled.' },
  error: { ok: false, text: 'Couldn’t connect YouTube. Try again.' },
  'in-use': { ok: false, text: 'That channel is connected to another space on Anvil. Ask its admin to disconnect it first.' },
};

interface State {
  configured: boolean;
  channel: { title: string; handle: string | null; broken: boolean } | null;
  connectUrl: string | null;
}

/**
 * The space's YouTube channel (lib/gates/youtubeDb) — what "YouTube subscribers" and "YouTube
 * members" check against. Hidden when the server has no Google app configured. Tokens never reach
 * this page.
 */
export default function YoutubeChannel() {
  const [state, setState] = useState<State | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const back = new URLSearchParams(window.location.search).get('youtube');
    if (back && YOUTUBE_RETURN[back]) {
      setNote(YOUTUBE_RETURN[back]);
      const u = new URL(window.location.href);
      u.searchParams.delete('youtube');
      window.history.replaceState(null, '', u.toString());
    }
    clanFetch('/api/admin/creator/youtube')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d && setState(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!state?.configured) return null;
  const ch = state.channel;
  const connectHref = state.connectUrl ? `${state.connectUrl}&return=${encodeURIComponent(window.location.pathname)}` : null;

  async function disconnect() {
    setBusy(true);
    try {
      const res = await clanFetch('/api/admin/creator/youtube', { method: 'DELETE' });
      if (res.ok) setState((s) => (s ? { ...s, channel: null } : s));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="youtube-channel" className="scroll-mt-24 rounded-xl border border-card-border bg-card-bg p-5">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
        <span className="h-5 w-1 rounded-full bg-gold" />
        YouTube channel
      </h2>
      <p className="mb-4 text-sm text-text-muted">
        Connect your channel to let only your subscribers or channel members join an event. Anvil only reads your
        channel; members are checked in your live chat while you stream.
      </p>
      {ch && !ch.broken ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm">
            Connected as <span className="font-semibold text-gold">{ch.title}</span>
            {ch.handle && <span className="text-text-muted"> ({ch.handle})</span>}
          </span>
          <button
            type="button"
            onClick={disconnect}
            disabled={busy}
            className="text-sm text-text-muted underline-offset-4 hover:text-accent-red hover:underline disabled:opacity-50"
          >
            Disconnect
          </button>
        </div>
      ) : (
        connectHref && (
          // A full navigation to the apex OAuth start (platform-level /api/auth, never clan-prefixed).
          <button
            type="button"
            onClick={() => window.location.assign(connectHref)}
            className="inline-block rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light"
          >
            {ch?.broken ? 'Reconnect YouTube' : 'Connect YouTube'}
          </button>
        )
      )}
      {ch?.broken && (
        <p className="mt-2 text-[12.5px] text-accent-red">
          Google stopped accepting the connection to {ch.title}. Until you reconnect, new member checks can’t run.
        </p>
      )}
      {note && <p className={`mt-2 text-sm ${note.ok ? 'text-accent-green-light' : 'text-accent-red'}`}>{note.text}</p>}
    </section>
  );
}
