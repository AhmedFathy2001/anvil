'use client';

import Select from '@/components/Select';
import { useCallback, useEffect, useState } from 'react';
import { clanFetch } from '@/lib/clanFetch';
import { EVENT_POST_KINDS, type EventPostKind } from '@/lib/eventWebhookKinds';

interface Hook {
  id: number;
  label: string | null;
  teamId: number | null;
  kinds: EventPostKind[];
  url: string;
}

const ALL_KINDS = EVENT_POST_KINDS.map((k) => k.key) as EventPostKind[];
// A team's channel wants that team's news plus "it started / it ended" — not the whole board's.
const TEAM_DEFAULT: EventPostKind[] = ['drops', 'completions', 'win', 'lifecycle'];

/**
 * Extra webhooks for this event (lib/eventWebhooks): any number of Discord channels — another
 * server, a team's own channel — that get a copy of this board's posts, on top of the clan's bingo
 * channel. Each picks which kinds, and can be narrowed to one team's drops/completions/win.
 */
export default function EventWebhooksPanel({ eventId, teams }: { eventId: number; teams: { id: number; name: string; color: string | null }[] }) {
  const [hooks, setHooks] = useState<Hook[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [teamId, setTeamId] = useState<number | null>(null);
  const [kinds, setKinds] = useState<EventPostKind[]>(ALL_KINDS);

  const base = `/api/admin/events/${eventId}/webhooks`;

  const load = useCallback(async () => {
    const res = await clanFetch(base);
    const data = await res.json().catch(() => ({}));
    if (res.ok) setHooks(data.hooks ?? []);
    else setError(data.error ?? 'Could not load webhooks.');
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  async function call(key: string, init: RequestInit & { path?: string }, done?: (data: Record<string, unknown>) => void) {
    setBusy(key);
    setError(null);
    setNote(null);
    try {
      const res = await clanFetch(init.path ?? base, { headers: { 'Content-Type': 'application/json' }, ...init });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'That did not work.');
      done?.(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const add = () =>
    call('add', { method: 'POST', body: JSON.stringify({ url, label, teamId, kinds }) }, (data) => {
      setHooks((h) => [...(h ?? []), data.hook as Hook]);
      setUrl('');
      setLabel('');
      setNote('Added — use Test to check it lands.');
    });

  const toggleKind = (hook: Hook, kind: EventPostKind) => {
    const next = hook.kinds.includes(kind) ? hook.kinds.filter((k) => k !== kind) : [...hook.kinds, kind];
    if (next.length === 0) return;
    void call(`kinds-${hook.id}`, { method: 'PATCH', body: JSON.stringify({ id: hook.id, kinds: next }) }, (data) =>
      setHooks((h) => (h ?? []).map((x) => (x.id === hook.id ? (data.hook as Hook) : x))),
    );
  };

  const teamName = (id: number | null) => (id == null ? 'Whole event' : teams.find((t) => t.id === id)?.name ?? 'Team');

  const kindChips = (selected: EventPostKind[], onToggle: (k: EventPostKind) => void, disabled = false) => (
    <div className="flex flex-wrap gap-1.5">
      {EVENT_POST_KINDS.map((k) => {
        const on = selected.includes(k.key);
        return (
          <button
            key={k.key}
            type="button"
            title={k.help}
            disabled={disabled}
            onClick={() => onToggle(k.key)}
            className={`rounded border px-2 py-1 text-[11px] transition-colors ${
              on ? 'border-gold bg-gold/20 text-gold' : 'border-card-border text-text-muted hover:border-gold/50'
            } disabled:opacity-60`}
          >
            {k.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <section className="mb-6 rounded-2xl border border-card-border bg-card-bg">
      <div className="flex items-center gap-2.5 border-b border-card-border px-5 py-3.5">
        <span className="molten h-5 w-1 shrink-0 rounded-sm" />
        <h2 className="text-[15px] font-semibold">Event webhooks</h2>
        <span className="ml-auto text-[12px] text-text-muted">Send this event’s posts to more channels.</span>
      </div>

      <div className="space-y-4 px-5 py-4 text-[13px]">
        <p className="text-[12px] text-text-muted">
          Every hook here gets a copy of this event’s posts — on top of your clan’s bingo channel, never instead of it.
          Use one per channel: another server, a stream channel, or a team’s own channel. A team hook only gets
          <em> that team’s</em> drops, completions and win (plus any event-wide posts you tick). Discord webhook URLs only.
        </p>

        {hooks == null ? (
          <p className="text-text-muted">Loading…</p>
        ) : hooks.length === 0 ? (
          <p className="text-text-muted">No extra webhooks yet.</p>
        ) : (
          <ul className="space-y-2">
            {hooks.map((h) => (
              <li key={h.id} className="rounded-lg border border-card-border p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{h.label || teamName(h.teamId)}</span>
                  <span className="rounded-full border border-card-border px-2 py-0.5 text-[11px] text-text-muted">{teamName(h.teamId)}</span>
                  <code className="text-[11px] text-text-muted">{h.url}</code>
                  <span className="ml-auto flex gap-3">
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => call(`test-${h.id}`, { method: 'POST', body: JSON.stringify({ testId: h.id }) }, () => setNote('Test post sent.'))}
                      className="text-[12px] text-text-muted hover:text-gold hover:underline underline-offset-4"
                    >
                      {busy === `test-${h.id}` ? 'Sending…' : 'Test'}
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() =>
                        call(`del-${h.id}`, { method: 'DELETE', path: `${base}?id=${h.id}` }, () =>
                          setHooks((list) => (list ?? []).filter((x) => x.id !== h.id)),
                        )
                      }
                      className="text-[12px] text-text-muted hover:text-accent-red hover:underline underline-offset-4"
                    >
                      Remove
                    </button>
                  </span>
                </div>
                {kindChips(h.kinds, (k) => toggleKind(h, k), busy !== null)}
              </li>
            ))}
          </ul>
        )}

        <div className="rounded-lg border border-dashed border-card-border p-3 space-y-2">
          <div className="text-[12px] font-semibold">Add a webhook</div>
          <div className="flex flex-wrap gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/…"
              className="min-w-0 flex-[2] rounded border border-card-border bg-brown-dark px-2.5 py-1.5 text-[12px]"
            />
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Name (optional)"
              className="min-w-0 flex-1 rounded border border-card-border bg-brown-dark px-2.5 py-1.5 text-[12px]"
            />
            <Select
              value={teamId != null ? String(teamId) : ''}
              onChange={(raw) => {
                const v = raw ? Number(raw) : null;
                setTeamId(v);
                setKinds(v == null ? ALL_KINDS : TEAM_DEFAULT);
              }}
              ariaLabel="Which team this webhook is for"
              className="min-w-[10rem] flex-1"
              options={[
                { value: '', label: 'Whole event' },
                ...teams.map((t) => ({ value: String(t.id), label: `Team: ${t.name}` })),
              ]}
            />
          </div>
          {kindChips(kinds, (k) => setKinds((ks) => (ks.includes(k) ? (ks.length > 1 ? ks.filter((x) => x !== k) : ks) : [...ks, k])))}
          <button
            type="button"
            disabled={busy !== null || !url.trim()}
            onClick={add}
            className="rounded-lg border border-gold/60 bg-gold/15 px-3 py-1.5 text-[12px] font-medium text-gold hover:bg-gold/25 disabled:opacity-50"
          >
            {busy === 'add' ? 'Adding…' : 'Add webhook'}
          </button>
        </div>

        {note && <p className="text-[12px] text-accent-green-light">{note}</p>}
        {error && <p className="text-[12px] text-red-400">{error}</p>}
      </div>
    </section>
  );
}
