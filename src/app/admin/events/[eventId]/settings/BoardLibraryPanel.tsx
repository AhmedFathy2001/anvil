'use client';

import { useCallback, useEffect, useState } from 'react';
import { clanFetch } from '@/lib/clanFetch';
import Input from '@/components/Input';
import Textarea from '@/components/Textarea';
import Select from '@/components/Select';
import NumberInput from '@/components/NumberInput';
import type { LibraryBoard } from '@/lib/libraryBoards';

const TAGS: [string, string][] = [
  ['pvm', 'PvM'],
  ['raids', 'Raids'],
  ['skilling', 'Skilling'],
  ['slayer', 'Slayer'],
  ['clues', 'Clues'],
  ['pets', 'Pets'],
  ['collection-log', 'Collection log'],
  ['wilderness', 'Wilderness'],
  ['minigames', 'Minigames'],
  ['ironman', 'Ironman-friendly'],
  ['f2p', 'F2P'],
  ['fun', 'Just for fun'],
];

/**
 * The board library, from an event: share this board with every clan, suggest your changes back to
 * the Anvil board it was started from, and look after the boards your clan has shared.
 */
export default function BoardLibraryPanel({
  eventId,
  eventName,
  source,
}: {
  eventId: number;
  eventName: string;
  /** The library board this event was started from, if any. */
  source: { id: number; title: string; origin: 'anvil' | 'community' } | null;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(eventName);
  const [description, setDescription] = useState('');
  const [audience, setAudience] = useState('mixed');
  const [tags, setTags] = useState<string[]>([]);
  const [days, setDays] = useState(7);
  const [teams, setTeams] = useState(4);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [mine, setMine] = useState<LibraryBoard[]>([]);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    const res = await clanFetch('/api/admin/library/boards');
    if (!res.ok) return;
    const data = (await res.json()) as { boards: LibraryBoard[]; clanId: number };
    setMine(data.boards.filter((b) => b.origin === 'community' && b.clanId === data.clanId));
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() only sets state after its fetch resolves
    void load();
  }, [load]);

  async function send(url: string, init: RequestInit, ok: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await clanFetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ ok: false, text: data.error || 'That didn’t work.' });
      else {
        setMsg({ ok: true, text: ok });
        await load();
      }
      return res.ok;
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    const ok = await send(
      '/api/admin/library/boards',
      {
        method: 'POST',
        body: JSON.stringify({ eventId, title, description, audience, tags, suggestedDays: days, teamsMin: Math.max(2, teams - 2), teamsMax: teams + 2 }),
      },
      'Shared. Every clan can now start an event from it in New event → Board library.',
    );
    if (ok) setOpen(false);
  }

  return (
    <section className="mb-6 rounded-2xl border border-card-border bg-card-bg">
      <div className="flex items-center gap-2.5 border-b border-card-border px-5 py-3.5">
        <span className="molten h-5 w-1 shrink-0 rounded-sm" />
        <h2 className="text-[15px] font-semibold">Board library</h2>
        <span className="ml-auto text-[12px] text-text-muted">Share this board, or improve the one it came from.</span>
      </div>
      <div className="space-y-4 px-5 py-4 text-[13px]">
        {source?.origin === 'anvil' && (
          <div className="rounded-lg border border-gold/30 bg-gold/[0.05] p-3 space-y-2">
            <p>
              Started from Anvil&apos;s <span className="text-gold">{source.title}</span>. Changed it for the better? Send your
              version to Anvil; if it&apos;s approved, every clan starting from that board gets it.
            </p>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What you changed and why (optional)" aria-label="Note" />
            <button
              disabled={busy}
              onClick={() =>
                send('/api/admin/library/boards/suggest', { method: 'POST', body: JSON.stringify({ eventId, note }) }, 'Sent to Anvil for review.')
              }
              className="px-3 py-1.5 rounded-lg border border-gold/40 text-gold disabled:opacity-50"
            >
              Suggest my changes to Anvil
            </button>
          </div>
        )}

        {!open ? (
          <button onClick={() => setOpen(true)} className="px-3 py-1.5 rounded-lg bg-gold text-brown-dark font-semibold">
            Share this board with every clan
          </button>
        ) : (
          <div className="space-y-3 rounded-lg border border-card-border p-3">
            <p className="text-text-muted">
              It goes straight into the board library under your clan&apos;s name; no review. Only the tiles are shared, not
              your teams, sign-ups or results. You can hide or delete it any time.
            </p>
            <div>
              <label className="block text-xs text-text-muted mb-1">Name</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">What&apos;s it like? (optional)</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={1000} className="w-full bg-brown-dark border border-card-border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs text-text-muted mb-1">Who it&apos;s for</label>
                <Select
                  value={audience}
                  onChange={setAudience}
                  ariaLabel="Who it's for"
                  options={[
                    { value: 'casual', label: 'Casual' },
                    { value: 'mid', label: 'Mid-level' },
                    { value: 'endgame', label: 'Endgame' },
                    { value: 'mixed', label: 'Mixed' },
                  ]}
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">About how many days</label>
                <NumberInput value={days} onChange={setDays} min={1} max={120} fallback={7} className="w-full bg-brown-dark border border-card-border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Teams it suits</label>
                <NumberInput value={teams} onChange={setTeams} min={1} max={50} fallback={4} className="w-full bg-brown-dark border border-card-border rounded-lg px-3 py-2" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">What it&apos;s about</label>
              <div className="flex flex-wrap gap-1.5">
                {TAGS.map(([key, label]) => {
                  const on = tags.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setTags((t) => (on ? t.filter((x) => x !== key) : [...t, key]))}
                      className={`text-xs px-2 py-1 rounded-lg border ${on ? 'border-gold bg-gold/15 text-gold' : 'border-card-border text-text-muted'}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2">
              <button disabled={busy || !title.trim()} onClick={publish} className="px-3 py-1.5 rounded-lg bg-gold text-brown-dark font-semibold disabled:opacity-50">
                Share it
              </button>
              <button onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-lg border border-card-border">
                Cancel
              </button>
            </div>
          </div>
        )}
        {msg && <p className={msg.ok ? 'text-accent-green-light' : 'text-red-400'}>{msg.text}</p>}

        {mine.length > 0 && (
          <div>
            <p className="text-xs text-text-muted mb-1.5">Boards your clan has shared</p>
            <ul className="space-y-1.5">
              {mine.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-card-border px-3 py-2">
                  <span>
                    {b.title}
                    <span className="text-xs text-text-muted">
                      {' '}
                      · {b.status === 'removed' ? 'taken down by Anvil' : b.status === 'hidden' ? 'hidden' : 'shared'} · used {b.useCount}×
                    </span>
                  </span>
                  <span className="flex gap-2 text-xs">
                    {b.status !== 'removed' && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        send(
                          `/api/admin/library/boards/${b.id}`,
                          { method: 'PATCH', body: JSON.stringify({ status: b.status === 'hidden' ? 'published' : 'hidden' }) },
                          b.status === 'hidden' ? 'Shared again.' : 'Hidden from the library.',
                        )
                      }
                      className="text-text-muted hover:text-foreground"
                    >
                      {b.status === 'hidden' ? 'Share again' : 'Hide'}
                    </button>
                    )}
                    <button
                      disabled={busy}
                      onClick={() => send(`/api/admin/library/boards/${b.id}`, { method: 'DELETE' }, 'Deleted.')}
                      className="text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
