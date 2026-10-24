'use client';

import ClanLink from '@/components/ClanLink';
import { useEffect, useState } from 'react';

import LocalTime from '@/components/LocalTime';

import { sessionLive } from './sessionLive';

interface Session {
  id: number;
  name: string;
  startDate: string | null;
  endDate: string | null;
  forceEndedAt: string | null;
  characters: string[];
}

interface Character {
  id: number;
  rsn: string;
}

export default function LabClient() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [maxHours, setMaxHours] = useState(24);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<number[]>([]);
  const [name, setName] = useState('');
  const [hours, setHours] = useState(2);
  const [boardSize, setBoardSize] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const res = await fetch('/api/staff/lab');
    if (res.ok) {
      const data = await res.json();
      setSessions(data.sessions);
      setCharacters(data.characters);
      setMaxHours(data.maxHours);
    }
    setLoading(false);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount fetch
    void load();
  }, []);

  async function start() {
    setBusy(true);
    setError('');
    const res = await fetch('/api/staff/lab', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, hours, boardSize, accountIds: picked }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? 'Could not start the session.');
      return;
    }
    window.location.href = `/staff/lab/${data.eventId}`;
  }

  const liveFor = new Set(sessions.filter(sessionLive).flatMap((s) => s.characters.map((c) => c.toLowerCase())));

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-card-border bg-card-bg p-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-gold">
          <span className="h-5 w-1 bg-gold" />
          New session
        </h2>
        {loading ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : characters.length === 0 ? (
          <p className="text-sm text-text-muted">
            You have no characters on Anvil yet. Connect the plugin on one first — a session can only use your own.
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="mb-1 text-sm text-gray-300">Characters</div>
              <div className="flex flex-wrap gap-2">
                {characters.map((c) => {
                  const on = picked.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setPicked((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id]))}
                      className={`rounded-lg border px-3 py-1.5 text-sm ${on ? 'border-gold bg-gold/15 text-gold' : 'border-card-border text-gray-300 hover:border-gold/50'}`}
                    >
                      {c.rsn}
                      {liveFor.has(c.rsn.toLowerCase()) && <span className="ml-1 text-xs text-text-muted">(in a session)</span>}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm text-gray-300">
                Name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Maggot King pet"
                  className="mt-1 w-full rounded-lg border border-card-border bg-brown-dark px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm text-gray-300">
                Runs for (hours)
                <input
                  type="number"
                  min={0.25}
                  max={maxHours}
                  step={0.25}
                  value={hours}
                  onChange={(e) => setHours(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-card-border bg-brown-dark px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm text-gray-300">
                Board size
                <select
                  value={boardSize}
                  onChange={(e) => setBoardSize(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-card-border bg-brown-dark px-3 py-2 text-sm"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n}×{n} ({n * n} tiles)</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="rounded-lg border border-gold/30 bg-gold/5 px-3 py-2 text-xs text-gray-300">
              While the session runs, these characters&apos; drop/death/level posts, moments, clips, collection log, PBs,
              stats and coffer pushes go to the session log instead of anywhere real. Real play on them is not recorded
              until the session ends and the next sync runs. The session becomes the plugin&apos;s active board (it is
              the newest one).
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="button"
              disabled={busy || picked.length === 0}
              onClick={start}
              className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brown-dark disabled:opacity-50"
            >
              {busy ? 'Starting…' : 'Start session'}
            </button>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-gold">
          <span className="h-5 w-1 bg-gold" />
          Sessions
        </h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-text-muted">None yet.</p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => {
              const live = sessionLive(s);
              return (
                <li key={s.id} className={`rounded-xl border border-card-border bg-card-bg ${live ? '' : 'opacity-60'}`}>
                  <ClanLink href={`/staff/lab/${s.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-brown-light/30">
                    <span className={`rounded px-2 py-0.5 text-xs ${live ? 'bg-accent-green/15 text-accent-green-light' : 'bg-brown-light text-text-muted'}`}>
                      {live ? 'Live' : 'Ended'}
                    </span>
                    <span className="font-medium text-gray-100">{s.name}</span>
                    <span className="text-sm text-text-muted">{s.characters.join(', ')}</span>
                    <span className="ml-auto text-xs text-text-muted">
                      {live ? 'ends ' : 'ended '}
                      <LocalTime date={s.forceEndedAt ?? s.endDate ?? ''} />
                    </span>
                  </ClanLink>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
