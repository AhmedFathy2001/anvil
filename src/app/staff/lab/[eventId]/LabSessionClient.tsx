'use client';

import { useCallback, useEffect, useState } from 'react';

import ClanLink from '@/components/ClanLink';
import LocalTime from '@/components/LocalTime';

import { sessionLive } from '../sessionLive';

const LAB_SLUG = 'anvil-lab';
const POLL_MS = 5_000;

interface Tile {
  id: number;
  position: number;
  label: string;
  tileType: string | null;
  trackedStat: string | null;
  statType: string | null;
  statGoal: number | null;
  requiredAmount: number | null;
}

interface Participant {
  id: number;
  name: string;
  accountId: number | null;
  simulated: boolean;
}

interface Submission {
  id: number;
  tileId: number;
  amount: number;
  note: string | null;
  itemId: number | null;
  durationSeconds: number | null;
  flaggedReason: string | null;
  createdAt: string;
}

interface LogRow {
  id: number;
  endpoint: string;
  payload: unknown;
  createdAt: string;
}

interface Detail {
  event: { id: number; name: string; startDate: string | null; endDate: string | null; forceEndedAt: string | null; boardSize: number };
  tiles: Tile[];
  participants: Participant[];
  completions: { tileId: number; completedAt: string | null }[];
  submissions: Submission[];
  log: LogRow[];
}

/** The DB stamps are UTC with a space; LocalTime wants something Date can parse as UTC. */
const utc = (stamp: string) => (stamp.includes('T') ? stamp : `${stamp.replace(' ', 'T')}Z`);

export default function LabSessionClient({ eventId }: { eventId: number }) {
  const [data, setData] = useState<Detail | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [openLog, setOpenLog] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/staff/lab/${eventId}`);
    if (res.ok) setData(await res.json());
  }, [eventId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount fetch, then a light poll
    void load();
    const t = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action);
    setError('');
    const res = await fetch(`/api/staff/lab/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? 'That did not work.');
    setBusy('');
    await load();
  }

  if (!data) return <p className="text-sm text-text-muted">Loading…</p>;
  const { event } = data;
  const live = sessionLive(event);
  const doneIds = new Set(data.completions.map((c) => c.tileId));
  const tileById = new Map(data.tiles.map((t) => [t.id, t]));
  const btn = 'rounded-lg border border-card-border px-3 py-1.5 text-sm text-gray-200 hover:border-gold/60 disabled:opacity-50';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 flex flex-wrap items-center gap-2 text-2xl font-bold text-gold">
          <span className="h-6 w-1 rounded-full bg-gold" />
          {event.name}
          <span className={`rounded px-2 py-0.5 text-xs font-normal ${live ? 'bg-accent-green/15 text-accent-green-light' : 'bg-brown-light text-text-muted'}`}>
            {live ? 'Live' : 'Ended'}
          </span>
        </h1>
        <p className="text-sm text-text-muted">
          {live ? 'Ends ' : 'Ended '}
          <LocalTime date={event.forceEndedAt ?? event.endDate ?? ''} /> · {data.participants.map((p) => p.name).join(', ')}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <ClanLink href={`/c/${LAB_SLUG}/admin/events/${event.id}/tiles`} className="rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-brown-dark">
          Edit tiles
        </ClanLink>
        <ClanLink href={`/c/${LAB_SLUG}/events/${event.id}`} className={btn}>View board</ClanLink>
        <button type="button" className={btn} disabled={!!busy} onClick={() => act('extend', { hours: 1 })}>
          {live ? 'Run 1h from now' : 'Restart for 1h'}
        </button>
        {live && (
          <button type="button" className={btn} disabled={!!busy} onClick={() => act('end')}>End now</button>
        )}
        <button type="button" className={btn} disabled={!!busy} onClick={() => act('reset')}>Reset progress</button>
        <button type="button" className={btn} disabled={!!busy} onClick={() => act('clear-log')}>Clear log</button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <p className="text-xs text-text-muted">
        In the plugin, the session is your active board within ~30s (one config poll). Reset keeps the tiles and the
        characters and wipes everything credited, so the same test can run again.
      </p>

      <section>
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-gold"><span className="h-5 w-1 bg-gold" />Board</h2>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(1, event.boardSize)}, minmax(0, 1fr))` }}>
          {data.tiles.map((t) => (
            <div
              key={t.id}
              className={`rounded-lg border p-2 text-xs ${doneIds.has(t.id) ? 'border-accent-green bg-accent-green/10' : 'border-card-border bg-card-bg'}`}
            >
              <div className="font-medium text-gray-100">{t.label}</div>
              <div className="text-text-muted">
                {t.tileType ?? 'standard'}
                {t.trackedStat ? ` · ${t.trackedStat} ${t.statGoal ?? ''}` : ''}
              </div>
              {doneIds.has(t.id) && <div className="mt-1 text-accent-green-light">✓ complete</div>}
            </div>
          ))}
        </div>
      </section>

      <StatSimulator eventId={eventId} tiles={data.tiles} participants={data.participants} onDone={load} />

      <section>
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-gold"><span className="h-5 w-1 bg-gold" />Characters</h2>
        <ul className="space-y-1 text-sm">
          {data.participants.map((p) => (
            <li key={p.id} className="flex items-center gap-3">
              <span className="text-gray-100">{p.name}</span>
              {p.simulated && <span className="rounded bg-gold/15 px-2 py-0.5 text-xs text-gold">stats simulated</span>}
              <button type="button" className="text-xs text-text-muted hover:text-red-400" onClick={() => act('remove-character', { participantId: p.id })}>
                remove
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-gold"><span className="h-5 w-1 bg-gold" />Submissions</h2>
        {data.submissions.length === 0 ? (
          <p className="text-sm text-text-muted">Nothing credited yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {data.submissions.map((s) => (
              <li key={s.id} className="flex flex-wrap gap-x-3 text-gray-300">
                <span className="text-text-muted"><LocalTime date={utc(s.createdAt)} format="time" /></span>
                <span className="text-gray-100">{tileById.get(s.tileId)?.label ?? `tile ${s.tileId}`}</span>
                <span>+{s.amount}</span>
                {s.durationSeconds != null && <span>{s.durationSeconds}s</span>}
                {s.itemId != null && <span>item {s.itemId}</span>}
                {s.note && <span className="text-text-muted">{s.note}</span>}
                {s.flaggedReason && <span className="text-gold">⚑ {s.flaggedReason}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-1 flex items-center gap-2 font-semibold text-gold"><span className="h-5 w-1 bg-gold" />Quarantined pushes</h2>
        <p className="mb-3 text-xs text-text-muted">
          What would have reached Discord, moments or the character&apos;s real profile. A scenario name after the route
          means the dev client was replaying it.
        </p>
        {data.log.length === 0 ? (
          <p className="text-sm text-text-muted">Nothing yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {data.log.map((row) => (
              <li key={row.id} className="rounded-lg border border-card-border bg-card-bg">
                <button
                  type="button"
                  className="flex w-full flex-wrap gap-3 px-3 py-2 text-left"
                  onClick={() => setOpenLog(openLog === row.id ? null : row.id)}
                >
                  <span className="text-text-muted"><LocalTime date={utc(row.createdAt)} format="time" /></span>
                  <span className="font-mono text-gold">{row.endpoint}</span>
                  <span className="truncate text-gray-300">{summary(row.payload)}</span>
                </button>
                {openLog === row.id && (
                  <pre className="max-h-96 overflow-auto border-t border-card-border px-3 py-2 text-xs text-gray-300">
                    {JSON.stringify(row.payload, null, 2)}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** One line for a quarantined body: the notify kind, or the first few keys. */
function summary(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return String(payload ?? '');
  const p = payload as Record<string, unknown>;
  if (typeof p.kind === 'string') return `${p.channel ?? ''} ${p.kind}`.trim();
  if (typeof p.channel === 'string') return p.channel;
  return Object.keys(p).slice(0, 4).join(', ');
}

function StatSimulator({
  eventId,
  tiles,
  participants,
  onDone,
}: {
  eventId: number;
  tiles: Tile[];
  participants: Participant[];
  onDone: () => Promise<void>;
}) {
  const statTiles = tiles.filter((t) => t.trackedStat && t.statType);
  const [participantId, setParticipantId] = useState<number | ''>(participants[0]?.id ?? '');
  const [statType, setStatType] = useState('boss');
  const [key, setKey] = useState('');
  const [gain, setGain] = useState(1);
  const [baseline, setBaseline] = useState('');
  const [result, setResult] = useState('');

  function pickTile(id: number) {
    const t = statTiles.find((x) => x.id === id);
    if (!t) return;
    setStatType(t.statType ?? 'boss');
    setKey(t.trackedStat ?? '');
    if (t.statGoal) setGain(t.statGoal);
  }

  async function run() {
    setResult('');
    const res = await fetch(`/api/staff/lab/${eventId}/stats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participantId: participantId === '' ? null : participantId,
        statType,
        key,
        gain,
        ...(baseline.trim() !== '' ? { baseline: Number(baseline) } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setResult(
      res.ok
        ? `Gain now ${Number(data.gain).toLocaleString()}${data.completed?.length ? ` — completed: ${data.completed.join(', ')}` : ''}`
        : data.error ?? 'Failed',
    );
    await onDone();
  }

  const field = 'mt-1 w-full rounded-lg border border-card-border bg-brown-dark px-3 py-2 text-sm';
  return (
    <section className="rounded-xl border border-card-border bg-card-bg p-5">
      <h2 className="mb-1 flex items-center gap-2 font-semibold text-gold"><span className="h-5 w-1 bg-gold" />Simulate a stat gain</h2>
      <p className="mb-3 text-xs text-text-muted">
        For XP, boss KC and hiscores-activity tiles, which no chat line can fake. Sets this character&apos;s baseline and
        reading on this board only (the hiscores sweep leaves them alone) and runs the real stat-tile check. Gains add
        up across runs; Reset clears them.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {statTiles.length > 0 && (
          <label className="text-sm text-gray-300 sm:col-span-3">
            From a tile
            <select className={field} defaultValue="" onChange={(e) => pickTile(Number(e.target.value))}>
              <option value="" disabled>Pick a stat tile…</option>
              {statTiles.map((t) => (
                <option key={t.id} value={t.id}>{t.label} — {t.trackedStat} ({t.statType})</option>
              ))}
            </select>
          </label>
        )}
        <label className="text-sm text-gray-300">
          Character
          <select className={field} value={participantId} onChange={(e) => setParticipantId(Number(e.target.value))}>
            {participants.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-gray-300">
          Type
          <select className={field} value={statType} onChange={(e) => setStatType(e.target.value)}>
            <option value="boss">boss / activity</option>
            <option value="skill">skill (XP)</option>
          </select>
        </label>
        <label className="text-sm text-gray-300">
          Hiscores key
          <input className={field} value={key} onChange={(e) => setKey(e.target.value)} placeholder="vorkath / slayer / overall" />
        </label>
        <label className="text-sm text-gray-300">
          Add
          <input className={field} type="number" min={0} value={gain} onChange={(e) => setGain(Number(e.target.value))} />
        </label>
        <label className="text-sm text-gray-300">
          Starting value (optional)
          <input className={field} value={baseline} onChange={(e) => setBaseline(e.target.value)} placeholder="keep current" />
        </label>
        <div className="flex items-end">
          <button
            type="button"
            disabled={!key || participantId === ''}
            onClick={run}
            className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brown-dark disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      </div>
      {result && <p className="mt-3 text-sm text-gray-200">{result}</p>}
    </section>
  );
}
