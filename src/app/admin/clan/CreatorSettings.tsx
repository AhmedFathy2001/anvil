'use client';

import { useEffect, useState } from 'react';
import Input from '@/components/Input';
import { clanFetch } from '@/lib/clanFetch';
import YoutubeChannel from './YoutubeChannel';
import KickChannel from './KickChannel';
import { MoveChannelPrompt } from './StreamSettings';
import TwitchChannel from './TwitchChannel';

/**
 * A creator space's settings: the name, the channels its page links to (connected, never typed),
 * and whether Anvil may
 * advertise it (the clans directory, and the space's events on the "Open to everyone" feed once
 * they are advertised too). Off by default — a creator space starts unlisted.
 */
export default function CreatorSettings() {
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState('');
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

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-card-border bg-card-bg p-5">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
          <span className="h-5 w-1 rounded-full bg-gold" />
          Your space
        </h2>
        <p className="mb-4 text-sm text-text-muted">
          The name on your page. Your page links to the channels you connect below (Twitch, YouTube, Kick), each marked
          verified. Links can&apos;t be typed in: connecting proves the channel is yours.
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="creator-name" className="mb-1.5 block text-sm text-foreground/80">
              Name
            </label>
            <Input id="creator-name" value={name} maxLength={64} onChange={(e) => setName(e.target.value)} className="rounded-xl px-4 py-2.5" />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              disabled={saving || !name.trim()}
              onClick={() => patch({ name })}
              className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <a href="#channels" className="text-sm text-gold hover:text-gold-light">
              Connect your Twitch, YouTube or Kick channel
            </a>
          </div>
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
              ? 'Your space is listed in the Anvil clans directory, and your new events start listed on anvilosrs.com/events. Switch any event off in its own settings.'
              : 'Unlisted: only people with your link can find your space. Turn this on to list it in the Anvil clans directory. You can still list single events on anvilosrs.com/events from their settings.'}
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

      <MoveChannelPrompt />

      {/* The only source of the stream links on the public page (lib/creatorHome creatorLinks). */}
      <div id="channels" className="scroll-mt-24 space-y-6">
        <TwitchChannel />

        <YoutubeChannel />

        <KickChannel />
      </div>

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
