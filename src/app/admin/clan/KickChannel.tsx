'use client';

import { useEffect, useState } from 'react';
import { clanFetch } from '@/lib/clanFetch';

const KICK_RETURN: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: 'Kick channel connected.' },
  webhooks: { ok: false, text: 'Kick connected, but Kick refused to send Anvil your channel’s events. Press “Reconnect events”.' },
  scopes: { ok: false, text: 'Kick didn’t give Anvil the permissions it asked for. Try again and press Allow.' },
  denied: { ok: false, text: 'Kick connection cancelled.' },
  error: { ok: false, text: 'Couldn’t connect Kick. Try again.' },
  'in-use': { ok: false, text: 'That channel is connected to another space on Anvil. Ask its admin to disconnect it first.' },
};

interface KickState {
  configured: boolean;
  channel: { slug: string; broken: boolean; followersOnlyChat: boolean; chatJoin: boolean } | null;
  connectUrl: string | null;
  /** The plan `!join` needs, when this space's plan does not include it (lib/creatorPlans); else null. */
  chatJoinPlan?: string | null;
}

/**
 * The space's Kick channel (lib/gates/kickDb): what "Kick followers" / "Kick subs" check against,
 * whether its chat is followers-only, and `!join` in its chat. Hidden when the server has no Kick app
 * configured. Tokens never reach this page.
 *
 * Kick cannot be ASKED who follows or subscribes, so the words here say exactly what Anvil can know.
 */
export default function KickChannel() {
  const [state, setState] = useState<KickState | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const back = new URLSearchParams(window.location.search).get('kick');
    if (back && KICK_RETURN[back]) {
      setNote(KICK_RETURN[back]);
      const u = new URL(window.location.href);
      u.searchParams.delete('kick');
      window.history.replaceState(null, '', u.toString());
    }
    clanFetch('/api/admin/creator/kick')
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

  async function send(method: 'PATCH' | 'DELETE', body?: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setNote(null);
    try {
      const res = await clanFetch('/api/admin/creator/kick', {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNote({ ok: false, text: d.error || 'Failed to save' });
        return false;
      }
      if (method === 'DELETE') setState((s) => (s ? { ...s, channel: null } : s));
      else if (d.channel) setState((s) => (s ? { ...s, channel: d.channel } : s));
      return true;
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="kick-channel" className="scroll-mt-24 rounded-xl border border-card-border bg-card-bg p-5">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
        <span className="h-5 w-1 rounded-full bg-gold" />
        Kick channel
      </h2>
      <p className="mb-4 max-w-[70ch] text-sm text-text-muted">
        Connect your channel to let only your Kick followers or subs join an event, and to answer <code>!join</code> in your chat.
        Kick doesn’t let apps look up followers, so Anvil counts <strong>people who follow after you connect</strong>, or who type
        their Anvil code in your chat while it is followers-only. Subs are any sub (Kick has no tiers): new subs, renewals and gifts
        after you connect, or a sub badge on a viewer’s code.
      </p>
      {ch && !ch.broken ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm">
              Connected as <span className="font-semibold text-gold">{ch.slug}</span>
            </span>
            <button
              type="button"
              onClick={() => send('PATCH', { resubscribe: true }).then((ok) => ok && setNote({ ok: true, text: 'Kick events reconnected.' }))}
              disabled={busy}
              className="text-sm text-text-muted underline-offset-4 hover:text-gold hover:underline disabled:opacity-50"
            >
              Reconnect events
            </button>
            <button
              type="button"
              onClick={() => send('DELETE')}
              disabled={busy}
              className="text-sm text-text-muted underline-offset-4 hover:text-accent-red hover:underline disabled:opacity-50"
            >
              Disconnect
            </button>
          </div>
          <Toggle
            label="My Kick chat is followers-only"
            hint="Only followers can type there, so a viewer who types their Anvil code counts as a follower. Turn this off if you open your chat to everyone."
            on={ch.followersOnlyChat}
            busy={busy}
            onChange={(next) => send('PATCH', { followersOnlyChat: next })}
          />
          <Toggle
            label={
              <>
                <code className="text-gold">!join</code> in Kick chat
              </>
            }
            hint={`When a viewer types !join in kick.com/${ch.slug}, the Anvil bot replies with the link to your open event (at most once every 30 seconds).`}
            on={ch.chatJoin}
            busy={busy}
            locked={state.chatJoinPlan && !ch.chatJoin ? `Part of the ${state.chatJoinPlan} plan.` : null}
            onChange={(next) => send('PATCH', { chatJoin: next })}
          />
        </div>
      ) : (
        connectHref && (
          <button
            type="button"
            onClick={() => window.location.assign(connectHref)}
            className="inline-block rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light"
          >
            {ch?.broken ? 'Reconnect Kick' : 'Connect Kick'}
          </button>
        )
      )}
      {ch?.broken && (
        <p className="mt-2 text-[12.5px] text-accent-red">
          Kick stopped accepting the connection to {ch.slug}. Followers and subs keep being recorded, but <code>!join</code> can’t reply until
          you reconnect.
        </p>
      )}
      {note && <p className={`mt-2 text-sm ${note.ok ? 'text-accent-green-light' : 'text-accent-red'}`}>{note.text}</p>}
    </section>
  );
}

function Toggle({
  label,
  hint,
  on,
  busy,
  locked,
  onChange,
}: {
  label: React.ReactNode;
  hint: string;
  on: boolean;
  busy: boolean;
  /** Plan note; the switch cannot be turned on while set. */
  locked?: string | null;
  onChange: (next: boolean) => Promise<boolean>;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-[60ch]">
        <div className="text-sm font-medium">{label}</div>
        <p className="text-[12.5px] text-text-muted">{hint}</p>
        {locked && <p className="text-[12.5px] text-gold">{locked}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={busy || !!locked}
        onClick={() => void onChange(!on)}
        className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${
          on ? 'border-gold bg-gold/80' : 'border-card-border bg-brown-dark'
        }`}
      >
        <span className="sr-only">{typeof label === 'string' ? label : 'Toggle'}</span>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-foreground transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}
