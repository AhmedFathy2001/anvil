'use client';

import { useCallback, useEffect, useState } from 'react';

import { clanFetch } from '@/lib/clanFetch';
import { CheckboxBox } from '@/components/Checkbox';
import Select from '@/components/Select';

interface CastMember {
  participantId: number;
  userId: number;
  name: string;
  teamId: number | null;
}

interface State {
  platformOn: boolean;
  chatEnabled: boolean;
  chatPaused: boolean;
  cast: CastMember[];
  note?: string;
}

/**
 * The plugin's Feed tab and event chat, tried from one dev client: make the session's test players
 * talk in its chat, and file drops on its board that reach the Feed live (lib/labFeedChat).
 */
export default function LabFeedChatPanel({ eventId }: { eventId: number }) {
  const [state, setState] = useState<State | null>(null);
  const [who, setWho] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [teamOnly, setTeamOnly] = useState(false);
  const [count, setCount] = useState(10);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ error: boolean; text: string } | null>(null);

  const url = `/api/staff/lab/${eventId}/feed-chat`;
  const load = useCallback(async () => {
    const r = await clanFetch(url);
    if (r.ok) setState(await r.json());
  }, [url]);
  useEffect(() => {
    void load();
  }, [load]);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await clanFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Failed');
      setState(d);
      if (d.note) setMsg({ error: false, text: d.note });
      return true;
    } catch (e) {
      setMsg({ error: true, text: (e as Error).message });
      return false;
    } finally {
      setBusy(false);
    }
  }

  const btn = 'rounded-lg border border-card-border px-2.5 py-1 text-xs text-gray-200 hover:border-gold/60 disabled:opacity-50';
  const speaker = who ?? state?.cast[0]?.participantId ?? null;

  return (
    <section>
      <h2 className="mb-1 flex items-center gap-2 font-semibold text-gold"><span className="h-5 w-1 bg-gold" />Feed &amp; chat</h2>
      <p className="mb-3 text-xs text-text-muted">
        Open the plugin&rsquo;s Feed tab on this session&rsquo;s board. Lines and drops made here arrive there live, as a real
        player&rsquo;s would.
      </p>
      {!state ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-text-muted">Chat on this session:</span>
            <span className={state.chatEnabled ? 'text-accent-green-light' : 'text-text-muted'}>{state.chatEnabled ? 'on' : 'off'}</span>
            <button type="button" className={btn} disabled={busy} onClick={() => void post({ action: 'chat', on: !state.chatEnabled })}>
              {state.chatEnabled ? 'Turn off' : 'Turn on'}
            </button>
            {!state.platformOn && (
              <span className="text-xs text-accent-red">Event chat is off across Anvil: turn it on at Staff → Event chat first.</span>
            )}
          </div>

          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (speaker == null || !text.trim()) return;
              if (await post({ action: 'say', participantId: speaker, body: text, teamOnly })) setText('');
            }}
          >
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              Say as
              <Select
                value={speaker == null ? '' : String(speaker)}
                onChange={(v) => setWho(Number(v))}
                options={state.cast.map((c) => ({ value: String(c.participantId), label: `${c.name}${c.teamId == null ? ' (no team)' : ''}` }))}
                ariaLabel="Say as"
                className="min-w-[10rem]"
              />
            </label>
            <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-xs text-text-muted">
              Message
              <input
                value={text}
                maxLength={200}
                onChange={(e) => setText(e.target.value)}
                placeholder="gz on the fang"
                className="rounded border border-card-border bg-background px-2 py-1 text-sm text-foreground"
              />
            </label>
            <label className="flex items-center gap-1.5 pb-1.5 text-xs text-text-muted">
              <CheckboxBox checked={teamOnly} onChange={(e) => setTeamOnly(e.target.checked)} />
              Team only
            </label>
            <button type="submit" className={btn} disabled={busy || speaker == null || !text.trim()}>
              Send
            </button>
          </form>
          {state.cast.length === 0 && <p className="text-xs text-text-muted">Add a team of test players below to have someone to speak as.</p>}

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-text-muted">Drops on this board:</span>
            <input
              type="number"
              min={1}
              max={60}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-16 rounded border border-card-border bg-background px-2 py-1 text-sm"
              aria-label="How many drops"
            />
            <button type="button" className={btn} disabled={busy} onClick={() => void post({ action: 'drops', count })}>
              File drops
            </button>
            <span className="text-xs text-text-muted">A mix from 120m down to 200k, and pets: some clear the floor, the rest roll up.</span>
          </div>

          {msg && <p className={`text-xs ${msg.error ? 'text-accent-red' : 'text-text-muted'}`}>{msg.text}</p>}
        </div>
      )}
    </section>
  );
}
