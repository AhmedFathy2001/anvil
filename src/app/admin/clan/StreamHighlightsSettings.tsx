'use client';

import { useEffect, useState } from 'react';
import { clanFetch } from '@/lib/clanFetch';

interface State {
  autoClip: boolean;
  promo: boolean;
  twitch: string | null;
  youtube: string | null;
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

/**
 * Stream highlights (lib/highlights): the host's two choices. Shown once a Twitch or YouTube channel
 * is connected, since that is the only channel either switch is about.
 */
export default function StreamHighlightsSettings() {
  const [state, setState] = useState<State | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    clanFetch('/api/admin/creator/highlights')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d && setState(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!state || (!state.twitch && !state.youtube)) return null;

  async function patch(p: Partial<Pick<State, 'autoClip' | 'promo'>>) {
    if (!state) return;
    const before = state;
    setState({ ...state, ...p });
    setSaving(true);
    setError('');
    try {
      const res = await clanFetch('/api/admin/creator/highlights', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      });
      if (!res.ok) throw new Error();
      const next = await res.json();
      setState((s) => (s ? { ...s, ...next } : s));
    } catch {
      setState(before);
      setError('Couldn’t save that. Try again.');
    } finally {
      setSaving(false);
    }
  }

  const where = state.twitch ? `twitch.tv/${state.twitch}` : 'your YouTube stream';

  return (
    <section id="stream-highlights" className="scroll-mt-24 rounded-xl border border-card-border bg-card-bg p-5">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
        <span className="h-5 w-1 rounded-full bg-gold" />
        Stream highlights
      </h2>
      <p className="mb-4 text-sm text-text-muted">
        Clips of the big moments in your events, shown on the event page and your page here.
      </p>

      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Auto-clip big moments on my stream</p>
            <p className="mt-0.5 max-w-[60ch] text-[13px] text-text-muted">
              While you&rsquo;re live on {where}, Anvil clips when one of your events starts, a team clears the board or
              wins, and when your own characters get a rare drop or a pet.
              {state.youtube && ' On YouTube it saves a link to that moment in your stream instead of a clip.'}{' '}
              {state.autoClip
                ? 'It’s on because you connected your channel to stream. Turn it off any time.'
                : 'It’s off.'}
            </p>
          </div>
          <Switch on={state.autoClip} disabled={saving} label="Auto-clip big moments on my stream" onToggle={() => patch({ autoClip: !state.autoClip })} />
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Let Anvil feature clips from my events in its own promotion</p>
            <p className="mt-0.5 max-w-[60ch] text-[13px] text-text-muted">
              Anvil may share a clip from your channel on its own pages and socials, crediting you. Off unless you turn it
              on.
            </p>
          </div>
          <Switch
            on={state.promo}
            disabled={saving}
            label="Let Anvil feature clips from my events in its own promotion"
            onToggle={() => patch({ promo: !state.promo })}
          />
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-accent-red">{error}</p>}
    </section>
  );
}
