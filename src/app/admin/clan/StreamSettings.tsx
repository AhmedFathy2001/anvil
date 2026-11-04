'use client';

import { useEffect, useState } from 'react';

import ClanLink from '@/components/ClanLink';
import { clanFetch } from '@/lib/clanFetch';
import TwitchChannel from './TwitchChannel';
import KickChannel from './KickChannel';
import StreamHighlightsSettings from './StreamHighlightsSettings';
import YoutubeChannel from './YoutubeChannel';

type Platform = 'twitch' | 'kick' | 'youtube';
const PLATFORMS: Platform[] = ['twitch', 'kick', 'youtube'];

interface Offer {
  platform: Platform;
  platformName: string;
  fromClanId: number;
  fromName: string;
  channel: string;
}

/**
 * "This channel is connected to <X>. Move it here?" — shown after connecting a Twitch, Kick or
 * YouTube channel that another place you run already has (lib/streamChannels). One channel, one place.
 * Rendered BEFORE the channel sections: it reads the `?twitch=elsewhere&move=<id>` they would clear.
 */
export function MoveChannelPrompt() {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const platform = PLATFORMS.find((p) => params.get(p) === 'elsewhere');
    const from = Number(params.get('move'));
    if (!platform) return;
    const u = new URL(window.location.href);
    u.searchParams.delete(platform);
    u.searchParams.delete('move');
    window.history.replaceState(null, '', u.toString());
    if (!Number.isInteger(from) || from <= 0) return;
    let alive = true;
    clanFetch(`/api/admin/streaming/move?platform=${platform}&from=${from}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d?.offer && setOffer(d.offer as Offer))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!offer) return null;

  async function move() {
    if (!offer) return;
    setBusy(true);
    setError(null);
    try {
      const res = await clanFetch('/api/admin/streaming/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: offer.platform, from: offer.fromClanId }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error ?? 'Could not move it');
      window.location.reload();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-gold/40 bg-gold/5 p-5">
      <p className="text-sm">
        This {offer.platformName} channel (<span className="font-semibold text-gold">{offer.channel}</span>) is connected to{' '}
        <span className="font-semibold">{offer.fromName}</span>. Move it here?
      </p>
      <p className="mt-1 text-[12.5px] text-text-muted">A channel can only be connected to one place. {offer.fromName} will lose it.</p>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={move}
          disabled={busy}
          className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
        >
          {busy ? 'Moving…' : 'Move it here'}
        </button>
        <button type="button" onClick={() => setOffer(null)} disabled={busy} className="text-sm text-text-muted hover:text-foreground">
          Keep it there
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-accent-red">{error}</p>}
    </section>
  );
}

function Switch({ on, disabled, label, onToggle }: { on: boolean; disabled?: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onToggle}
      className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${
        on ? 'border-gold bg-gold/80' : 'border-card-border bg-brown-dark'
      }`}
    >
      <span className="sr-only">{label}</span>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-foreground transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

interface StreamingState {
  streaming: boolean;
  chatJoin: boolean;
  twitchLinked: { login: string } | null;
  chatJoinPlan: string | null;
  overlayHideMark: boolean;
  overlayHidePlan: string | null;
  /** Why it can't be turned on (a private clan), or null. */
  blocked?: string | null;
}

/**
 * A clan's "Streaming" switch and, once it is on, everything a streamer has: their Twitch, YouTube
 * and Kick channels, `!join` in Twitch chat, and the Anvil mark on the OBS overlay. Each event then
 * gets a "Who can join?" choice: Members only (the default), or viewers too. Viewers who join are
 * event players — they never land on the roster or the guest list.
 */
export default function StreamingSettings() {
  const [state, setState] = useState<StreamingState | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    clanFetch('/api/admin/streaming')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d && setState(d as StreamingState))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!state) return null;

  async function patch(body: Partial<Pick<StreamingState, 'streaming' | 'chatJoin' | 'overlayHideMark'>>) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await clanFetch('/api/admin/streaming', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error ?? 'Could not save');
      setState((s) => (s ? { ...s, ...body } : s));
      setMessage({ ok: true, text: 'Saved.' });
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-6 space-y-6">
      <section className="rounded-xl border border-card-border bg-card-bg p-5">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
          <span className="h-5 w-1 rounded-full bg-gold" />
          Streaming
        </h2>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <p className="max-w-[60ch] text-sm text-text-muted">
            {state.streaming
              ? 'On. Connect your stream below. Then open an event to viewers from its settings (“Who can join?”). Viewers play that one event only. They don’t join your clan.'
              : 'Stream your events? Turn this on to let viewers join an event from your stream. Your clan stays the same: viewers are not members or guests.'}{' '}
            <ClanLink href="/guide/streaming-for-clans" className="text-gold hover:text-gold-light">
              How it works
            </ClanLink>
          </p>
          <Switch
            on={state.streaming}
            disabled={saving || (!state.streaming && !!state.blocked)}
            label="Streaming"
            onToggle={() => patch({ streaming: !state.streaming })}
          />
        </div>
        {!state.streaming && state.blocked && <p className="mt-2 text-sm text-gold">{state.blocked}</p>}
      </section>

      {state.streaming && (
        <>
          <MoveChannelPrompt />
          <TwitchChannel />
          <YoutubeChannel />
          <KickChannel />
          <StreamHighlightsSettings />

          <section id="chat-join" className="scroll-mt-20 rounded-xl border border-card-border bg-card-bg p-5">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
              <span className="h-5 w-1 rounded-full bg-gold" />
              <code className="text-gold">!join</code> in Twitch chat
            </h2>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <p className="max-w-[60ch] text-sm text-text-muted">
                When a viewer types <code>!join</code>, the Anvil bot replies with the link to your event that is open to viewers.{' '}
                {state.twitchLinked
                  ? `It answers in twitch.tv/${state.twitchLinked.login}.`
                  : 'Connect your Twitch channel above first.'}
                {state.twitchLinked && <span className="mt-1 block">If your chat blocks links, type <code>/vip anvil_osrs</code> (or <code>/mod anvil_osrs</code>) in your chat so the bot’s link isn’t held.</span>}
                {state.chatJoinPlan && !state.chatJoin && <span className="block text-gold">Part of the {state.chatJoinPlan} plan.</span>}
              </p>
              <Switch
                on={state.chatJoin}
                disabled={saving || (!!state.chatJoinPlan && !state.chatJoin)}
                label="Answer !join in Twitch chat"
                onToggle={() => patch({ chatJoin: !state.chatJoin })}
              />
            </div>
          </section>

          <section className="rounded-xl border border-card-border bg-card-bg p-5">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
              <span className="h-5 w-1 rounded-full bg-gold" />
              Anvil mark on your overlay
            </h2>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <p className="max-w-[60ch] text-sm text-text-muted">
                {state.overlayHideMark
                  ? 'Hidden: your OBS overlay shows only your event.'
                  : 'Your OBS overlay shows a small “Powered by Anvil” badge (logo and anvilosrs.com) in the corner. Turn this on to hide it.'}
                {state.overlayHidePlan && !state.overlayHideMark && (
                  <span className="block text-gold">Part of the {state.overlayHidePlan} plan.</span>
                )}
              </p>
              <Switch
                on={state.overlayHideMark}
                disabled={saving || (!!state.overlayHidePlan && !state.overlayHideMark)}
                label="Hide the Anvil mark on the overlay"
                onToggle={() => patch({ overlayHideMark: !state.overlayHideMark })}
              />
            </div>
          </section>
        </>
      )}

      {message && <p className={`text-sm ${message.ok ? 'text-accent-green-light' : 'text-accent-red'}`}>{message.text}</p>}
    </div>
  );
}
