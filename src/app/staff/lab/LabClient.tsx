'use client';

import ClanLink from '@/components/ClanLink';
import { useEffect, useState } from 'react';

import LocalTime from '@/components/LocalTime';

import { sessionLive } from './sessionLive';
import Checkbox from '@/components/Checkbox';
import Input from '@/components/Input';
import NumberInput from '@/components/NumberInput';
import Select from '@/components/Select';
import {
  LAB_FORMATS,
  LAB_ROUTE_TEMPLATES,
  MAX_LAB_FIELD,
  MAX_LAB_TEAM_SIZE,
  labFormat,
  labTileCount,
  type LabFormatKey,
  type LabPlacement,
  type LabRouteTemplate,
} from '@/lib/labPlan';

interface Session {
  id: number;
  name: string;
  startDate: string | null;
  endDate: string | null;
  forceEndedAt: string | null;
  characters: string[];
  /** How many lab test players the session holds (counted, not listed). */
  testPlayers: number;
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
  const [formatKey, setFormatKey] = useState<LabFormatKey>('classic');
  const [boardSize, setBoardSize] = useState(3);
  const [placement, setPlacement] = useState<LabPlacement>('team');
  const [route, setRoute] = useState<LabRouteTemplate>('line');
  const [raceRoutes, setRaceRoutes] = useState(false);
  const [fieldPlayers, setFieldPlayers] = useState(0);
  const [teamSize, setTeamSize] = useState(3);
  const [simulate, setSimulate] = useState(true);
  const [busy, setBusy] = useState(false);
  const fmt = labFormat(formatKey);

  function pickFormat(key: LabFormatKey) {
    const next = labFormat(key);
    setFormatKey(next.key);
    // Each type opens on its own sensible size and placement (lib/labPlan).
    setBoardSize(next.defaultSize);
    setPlacement(next.defaultPlacement);
    setRoute('line');
  }
  const [error, setError] = useState('');

  async function load() {
    const res = await fetch('/api/staff/lab');
    if (res.ok) {
      const data = await res.json();
      setSessions(data.sessions);
      setCharacters(data.characters);
      setMaxHours(data.maxHours);
      setRaceRoutes(!!data.raceRoutes);
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
      body: JSON.stringify({
        name,
        hours,
        boardSize,
        accountIds: picked,
        format: formatKey,
        placement,
        route: fmt.format === 'tilerace' && raceRoutes ? route : undefined,
        fieldPlayers,
        teamSize,
        simulate: fieldPlayers > 0 && simulate,
      }),
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
            <div>
              <div className="mb-1 text-sm text-gray-300">Event type</div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {LAB_FORMATS.map((f) => {
                  const on = f.key === formatKey;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => pickFormat(f.key)}
                      className={`rounded-lg border px-3 py-2 text-left ${on ? 'border-gold bg-gold/10' : 'border-card-border hover:border-gold/50'}`}
                    >
                      <div className={`text-sm font-medium ${on ? 'text-gold' : 'text-gray-100'}`}>{f.label}</div>
                      <div className="mt-0.5 line-clamp-2 text-xs text-text-muted">{f.blurb}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm text-gray-300">
                Name
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Maggot King pet" className="mt-1" />
              </label>
              <label className="text-sm text-gray-300">
                Runs for (hours)
                <NumberInput value={hours} onChange={setHours} min={0.25} max={maxHours} step={0.25} fallback={2} className="mt-1" aria-label="Runs for (hours)" />
              </label>
              <label className="text-sm text-gray-300">
                {fmt.square ? 'Board size' : fmt.sizeLabel}
                {fmt.square ? (
                  <Select
                    value={String(boardSize)}
                    onChange={(v) => setBoardSize(Number(v))}
                    options={Array.from({ length: fmt.max - fmt.min + 1 }, (_, i) => fmt.min + i).map((n) => ({ value: String(n), label: `${n}×${n} (${n * n} tiles)` }))}
                    ariaLabel="Board size"
                    className="mt-1"
                  />
                ) : (
                  <NumberInput value={boardSize} onChange={setBoardSize} min={fmt.min} max={fmt.max} fallback={fmt.defaultSize} className="mt-1" aria-label={fmt.sizeLabel} />
                )}
              </label>
            </div>
            {fmt.format === 'tilerace' && (
              <div>
                <div className="mb-1 text-sm text-gray-300">Route</div>
                {raceRoutes ? (
                  <div className="flex flex-wrap gap-2">
                    {LAB_ROUTE_TEMPLATES.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        title={t.help}
                        onClick={() => setRoute(t.key)}
                        className={`rounded-lg border px-3 py-1.5 text-sm ${route === t.key ? 'border-gold bg-gold/15 text-gold' : 'border-card-border text-gray-300 hover:border-gold/50'}`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-text-muted">A straight line. Branching routes appear here once this build supports them.</p>
                )}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="text-sm text-gray-300">
                Teams
                <div className="mt-1 flex gap-2">
                  {(['team', 'solo'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPlacement(p)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm ${placement === p ? 'border-gold bg-gold/15 text-gold' : 'border-card-border text-gray-300 hover:border-gold/50'}`}
                    >
                      {p === 'team' ? 'Teams' : 'Solo'}
                    </button>
                  ))}
                </div>
              </div>
              <label className="text-sm text-gray-300">
                Test players to add
                <NumberInput value={fieldPlayers} onChange={setFieldPlayers} min={0} max={MAX_LAB_FIELD} fallback={0} className="mt-1" aria-label="Test players to add" />
              </label>
              {placement === 'team' && (
                <label className="text-sm text-gray-300">
                  Players per team
                  <NumberInput value={teamSize} onChange={setTeamSize} min={1} max={MAX_LAB_TEAM_SIZE} fallback={3} className="mt-1" aria-label="Players per team" />
                </label>
              )}
            </div>
            <p className="text-xs text-text-muted">
              {labTileCount(fmt, boardSize)} tile{labTileCount(fmt, boardSize) === 1 ? '' : 's'} ·{' '}
              {placement === 'solo'
                ? `every entrant on their own (${picked.length + fieldPlayers} entrants)`
                : `your characters on "Lab"${fieldPlayers > 0 ? `, ${Math.ceil(fieldPlayers / Math.max(1, teamSize))} test teams of up to ${teamSize}` : ''}`}
              . Test players are lab users (Lab~Field…), never real people; up to {MAX_LAB_FIELD.toLocaleString()}.
            </p>
            {fieldPlayers > 0 && (
              <Checkbox
                checked={simulate}
                onChange={setSimulate}
                label="Give the test players random progress"
                description="Credits spread across their teams over the open tiles, in race order on a race. Marked as simulated on the session page; Reset or Clear simulated takes them away."
              />
            )}
            <div className="rounded-lg border border-gold/30 bg-gold/5 px-3 py-2 text-xs text-gray-300">
              The session becomes the plugin&apos;s active board for these characters (it is the newest one). Real play
              still counts everywhere as usual: the clan&apos;s Discord and feed, the profile, and every real board they
              are on. It is also copied to the session log and onto this board. Only scenarios the dev client replays are
              held back: those reach the session and nothing else.
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="button"
              disabled={busy || picked.length === 0}
              onClick={start}
              className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brown-dark disabled:opacity-50"
            >
              {busy ? (fieldPlayers > 20 ? 'Seating the field…' : 'Starting…') : 'Start session'}
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
                    <span className="text-sm text-text-muted">
                      {s.characters.slice(0, 4).join(', ')}
                      {s.characters.length > 4 ? ` +${s.characters.length - 4} more` : ''}
                      {s.testPlayers > 0 ? ` · ${s.testPlayers.toLocaleString()} test player${s.testPlayers === 1 ? '' : 's'}` : ''}
                    </span>
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
