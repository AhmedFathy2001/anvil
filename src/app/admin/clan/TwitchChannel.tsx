'use client';

import { useEffect, useState } from 'react';
import { clanFetch } from '@/lib/clanFetch';

const TWITCH_RETURN: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: 'Twitch channel connected.' },
  scopes: { ok: false, text: 'Twitch didn’t give Anvil the permissions it asked for. Try again and press Authorize.' },
  denied: { ok: false, text: 'Twitch connection cancelled.' },
  error: { ok: false, text: 'Couldn’t connect Twitch. Try again.' },
  'in-use': { ok: false, text: 'That channel is connected to another space on Anvil. Ask its admin to disconnect it first.' },
};

/**
 * The space's Twitch channel (lib/entryGatesDb) — what "Twitch followers" and "Twitch subs" check
 * against. Hidden when the server has no Twitch app configured. Tokens never reach this page.
 */
export default function TwitchChannel() {
  const [state, setState] = useState<{
    configured: boolean;
    channel: { login: string; canHaveSubs: boolean; broken: boolean } | null;
    connectUrl: string | null;
  } | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    // Coming back from Twitch: say how it went, then drop the marker from the address bar.
    const back = new URLSearchParams(window.location.search).get('twitch');
    if (back && TWITCH_RETURN[back]) {
      setNote(TWITCH_RETURN[back]);
      const u = new URL(window.location.href);
      u.searchParams.delete('twitch');
      window.history.replaceState(null, '', u.toString());
    }
    clanFetch('/api/admin/creator/twitch')
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
      const res = await clanFetch('/api/admin/creator/twitch', { method: 'DELETE' });
      if (res.ok) setState((s) => (s ? { ...s, channel: null } : s));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-card-border bg-card-bg p-5">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
        <span className="h-5 w-1 rounded-full bg-gold" />
        Twitch channel
      </h2>
      <p className="mb-4 text-sm text-text-muted">
        Connect your channel to let only your followers or subs join an event (on a creator space it also shows on
        your page, marked verified). Anvil only reads who follows and subscribes. A channel can be connected to one
        place at a time.
      </p>
      {ch && !ch.broken ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm">
            Connected as <span className="font-semibold text-gold">{ch.login}</span>
            {!ch.canHaveSubs && <span className="text-text-muted"> (not an affiliate yet, so sub-only is off)</span>}
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
          // A full navigation (not a Link: it must never be prefetched) to the apex OAuth start, which is
          // platform-level (/api/auth) and so never takes a clan prefix.
          <button
            type="button"
            onClick={() => window.location.assign(connectHref)}
            className="inline-block rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light"
          >
            {ch?.broken ? 'Reconnect Twitch' : 'Connect Twitch'}
          </button>
        )
      )}
      {ch?.broken && (
        <p className="mt-2 text-[12.5px] text-accent-red">
          Twitch stopped accepting the connection to {ch.login}. Until you reconnect, Twitch-only events turn everyone away.
        </p>
      )}
      {note && <p className={`mt-2 text-sm ${note.ok ? 'text-accent-green-light' : 'text-accent-red'}`}>{note.text}</p>}
    </section>
  );
}
