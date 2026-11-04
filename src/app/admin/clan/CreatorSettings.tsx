'use client';

import { useEffect, useState } from 'react';
import Input from '@/components/Input';
import { clanFetch } from '@/lib/clanFetch';
import { checkStreamLink } from '@/lib/creatorSpaces';
import YoutubeChannel from './YoutubeChannel';
import KickChannel from './KickChannel';

/**
 * A creator space's settings: the name, the stream links shown on its page, and whether Anvil may
 * advertise it (the clans directory, and the space's events on the "Open to everyone" feed once
 * they are advertised too). Off by default — a creator space starts unlisted.
 */
export default function CreatorSettings() {
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState('');
  const [twitch, setTwitch] = useState('');
  const [kick, setKick] = useState('');
  const [advertised, setAdvertised] = useState(false);
  const [chatJoin, setChatJoin] = useState(false);
  const [twitchLinked, setTwitchLinked] = useState<{ login: string } | null>(null);
  // What the plan allows (lib/creatorPlans): the plan name a switch needs, or null when allowed.
  const [chatJoinPlan, setChatJoinPlan] = useState<string | null>(null);
  const [hideMark, setHideMark] = useState(false);
  const [hideMarkPlan, setHideMarkPlan] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    clanFetch('/api/admin/creator')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        setName(d.name ?? '');
        setTwitch(d.twitchUrl ?? '');
        setKick(d.kickUrl ?? '');
        setAdvertised(!!d.advertised);
        setChatJoin(!!d.chatJoin);
        setTwitchLinked(d.twitchLinked && typeof d.twitchLinked.login === 'string' ? { login: d.twitchLinked.login } : null);
        setChatJoinPlan(typeof d.chatJoinPlan === 'string' ? d.chatJoinPlan : null);
        setHideMark(!!d.overlayHideMark);
        setHideMarkPlan(typeof d.overlayHidePlan === 'string' ? d.overlayHidePlan : null);
        setLoaded(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function patch(body: Record<string, unknown>): Promise<boolean> {
    setSaving(true);
    setMessage(null);
    try {
      const res = await clanFetch('/api/admin/creator', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setMessage({ type: 'err', text: d.error || 'Failed to save' });
        return false;
      }
      setMessage({ type: 'ok', text: 'Saved.' });
      return true;
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;
  const twitchCheck = checkStreamLink('twitch', twitch);
  const kickCheck = checkStreamLink('kick', kick);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-card-border bg-card-bg p-5">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
          <span className="h-5 w-1 rounded-full bg-gold" />
          Your space
        </h2>
        <p className="mb-4 text-sm text-text-muted">The name and links on your page. Links are shown, not connected.</p>
        <div className="space-y-4">
          <div>
            <label htmlFor="creator-name" className="mb-1.5 block text-sm text-foreground/80">
              Name
            </label>
            <Input id="creator-name" value={name} maxLength={64} onChange={(e) => setName(e.target.value)} className="rounded-xl px-4 py-2.5" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="creator-twitch" className="mb-1.5 block text-sm text-foreground/80">
                Twitch
              </label>
              <Input id="creator-twitch" value={twitch} placeholder="https://twitch.tv/you" onChange={(e) => setTwitch(e.target.value)} className="rounded-xl px-4 py-2.5" />
              {!twitchCheck.ok && <p className="mt-1 text-xs text-accent-red">{twitchCheck.error}</p>}
            </div>
            <div>
              <label htmlFor="creator-kick" className="mb-1.5 block text-sm text-foreground/80">
                Kick
              </label>
              <Input id="creator-kick" value={kick} placeholder="https://kick.com/you" onChange={(e) => setKick(e.target.value)} className="rounded-xl px-4 py-2.5" />
              {!kickCheck.ok && <p className="mt-1 text-xs text-accent-red">{kickCheck.error}</p>}
            </div>
          </div>
          <button
            type="button"
            disabled={saving || !name.trim() || !twitchCheck.ok || !kickCheck.ok}
            onClick={() => patch({ name, twitchUrl: twitch, kickUrl: kick })}
            className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-card-border bg-card-bg p-5">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
          <span className="h-5 w-1 rounded-full bg-gold" />
          Advertise on Anvil
        </h2>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <p className="max-w-[60ch] text-sm text-text-muted">
            {advertised
              ? 'Your space is listed in the Anvil clans directory. Events you mark as advertised also show on the Anvil home page.'
              : 'Unlisted: only people with your link can find your space. Turn this on to list it in the Anvil clans directory.'}
          </p>
          <button
            type="button"
            role="switch"
            aria-checked={advertised}
            disabled={saving}
            onClick={async () => {
              const next = !advertised;
              if (await patch({ advertised: next })) setAdvertised(next);
            }}
            className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${
              advertised ? 'border-gold bg-gold/80' : 'border-card-border bg-brown-dark'
            }`}
          >
            <span className="sr-only">Advertise on Anvil</span>
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-foreground transition-all ${advertised ? 'left-[22px]' : 'left-0.5'}`}
            />
          </button>
        </div>
      </section>

      <TwitchChannel />

      <YoutubeChannel />

      <KickChannel />

      <section className="rounded-xl border border-card-border bg-card-bg p-5">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
          <span className="h-5 w-1 rounded-full bg-gold" />
          <code className="text-gold">!join</code> in Twitch chat
        </h2>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <p className="max-w-[60ch] text-sm text-text-muted">
            When a viewer types <code>!join</code>, the Anvil bot replies with the link to your open event (at most once every
            30 seconds). {twitchLinked
              ? `It answers in twitch.tv/${twitchLinked.login}.`
              : 'It only answers in a Twitch channel you have connected to Anvil. Connect yours above first.'}
            {chatJoinPlan && !chatJoin && <span className="block text-gold">Part of the {chatJoinPlan} plan.</span>}
          </p>
          <button
            type="button"
            role="switch"
            aria-checked={chatJoin}
            disabled={saving || (!!chatJoinPlan && !chatJoin)}
            onClick={async () => {
              const next = !chatJoin;
              if (await patch({ chatJoin: next })) setChatJoin(next);
            }}
            className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${
              chatJoin ? 'border-gold bg-gold/80' : 'border-card-border bg-brown-dark'
            }`}
          >
            <span className="sr-only">Answer !join in Twitch chat</span>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-foreground transition-all ${chatJoin ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-card-border bg-card-bg p-5">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
          <span className="h-5 w-1 rounded-full bg-gold" />
          Anvil mark on your overlay
        </h2>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <p className="max-w-[60ch] text-sm text-text-muted">
            {hideMark
              ? 'Hidden: your OBS overlay shows only your event.'
              : 'Your OBS overlay shows a small “Anvil” in the corner. Turn this on to hide it.'}
            {hideMarkPlan && !hideMark && <span className="block text-gold">Part of the {hideMarkPlan} plan.</span>}
          </p>
          <button
            type="button"
            role="switch"
            aria-checked={hideMark}
            disabled={saving || (!!hideMarkPlan && !hideMark)}
            onClick={async () => {
              const next = !hideMark;
              if (await patch({ overlayHideMark: next })) setHideMark(next);
            }}
            className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${
              hideMark ? 'border-gold bg-gold/80' : 'border-card-border bg-brown-dark'
            }`}
          >
            <span className="sr-only">Hide the Anvil mark on the overlay</span>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-foreground transition-all ${hideMark ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>
      </section>

      {message && (
        <p className={`text-sm ${message.type === 'ok' ? 'text-accent-green-light' : 'text-accent-red'}`}>{message.text}</p>
      )}
    </div>
  );
}

const TWITCH_RETURN: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: 'Twitch channel connected.' },
  scopes: { ok: false, text: 'Twitch didn’t give Anvil the permissions it asked for. Try again and press Authorize.' },
  denied: { ok: false, text: 'Twitch connection cancelled.' },
  error: { ok: false, text: 'Couldn’t connect Twitch. Try again.' },
};

/**
 * The space's Twitch channel (lib/entryGatesDb) — what "Twitch followers" and "Twitch subs" check
 * against. Hidden when the server has no Twitch app configured. Tokens never reach this page.
 */
function TwitchChannel() {
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
        Connect your channel to let only your followers or subs join an event. Anvil only reads who follows and
        subscribes.
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
