'use client';

import { FLAG_TEXT } from '@/app/admin/events/[eventId]/EventNextStep';
import { useCallback, useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import { useDialog } from '@/components/Confirm';
import LocalTime from '@/components/LocalTime';
import { LAB_KEEP_DAYS } from '@/lib/labRules';

import { sessionLive } from '../sessionLive';
import LabFeedChatPanel from './LabFeedChatPanel';
import LabFieldPanel from './LabFieldPanel';
import LabMissionsPanel from './LabMissionsPanel';
import type { MissionRules } from '@/lib/eventRules';
import Input from '@/components/Input';
import NumberInput from '@/components/NumberInput';
import LabTeamsPanel from './LabTeamsPanel';
import LabTileControlsPanel from './LabTileControlsPanel';
import type { LabTeamsView } from '@/lib/labTeams';
import Select from '@/components/Select';

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
  parentTileId: number | null;
  points: number;
  mission: boolean;
  revealedAt: string | null;
  closedAt: string | null;
  missionRules: MissionRules | null;
  progressStore: string | null;
  progressGoal: number | null;
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
  event: {
    id: number;
    name: string;
    startDate: string | null;
    endDate: string | null;
    forceEndedAt: string | null;
    boardSize: number;
    format: string;
    scoringMode: string;
    mode: string;
    modeLabel: string;
    placement: string;
    revealPolicy: string;
    mission: { announceMode: string; intervalMinutes: number; order: string } | null;
  };
  tiles: Tile[];
  participants: Participant[];
  completions: { tileId: number; teamId: number; completedAt: string | null; simulated: boolean }[];
  submissions: Submission[];
  log: LogRow[];
  teams: LabTeamsView;
}

/** The DB stamps are UTC with a space; LocalTime wants something Date can parse as UTC. */
const utc = (stamp: string) => (stamp.includes('T') ? stamp : `${stamp.replace(' ', 'T')}Z`);

export default function LabSessionClient({ eventId }: { eventId: number }) {
  const [data, setData] = useState<Detail | null>(null);
  const [busy, setBusy] = useState('');
  const router = useRouter();
  const { confirm } = useDialog();
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

  async function remove() {
    const ok = await confirm({
      title: 'Delete this lab session?',
      body: 'The board, its tiles, everything credited, the uploaded proofs and the log are deleted. This can’t be undone.',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    setBusy('delete');
    setError('');
    const res = await fetch(`/api/staff/lab/${eventId}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/staff/lab');
      return;
    }
    setError((await res.json().catch(() => ({}))).error ?? 'That did not work.');
    setBusy('');
  }

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
  const doneBy = new Map<number, { real: number; sim: number }>();
  for (const c of data.completions) {
    const n = doneBy.get(c.tileId) ?? { real: 0, sim: 0 };
    if (c.simulated) n.sim++;
    else n.real++;
    doneBy.set(c.tileId, n);
  }
  const teamCount = data.teams.teams.length;
  const testTeams = data.teams.teams.filter((t) => t.members.length > 0 && t.members.every((m) => m.test)).length;
  const square = event.mode === 'classic' || event.mode === 'solo';
  const testIds = new Set(
    [...data.teams.teams.flatMap((t) => t.members), ...data.teams.unplaced].filter((m) => m.test).map((m) => m.participantId),
  );
  const own = data.participants.filter((p) => !testIds.has(p.id));
  const testPlayers = data.participants.length - own.length;
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
          <LocalTime date={event.forceEndedAt ?? event.endDate ?? ''} /> · {event.modeLabel}
          {event.placement === 'solo' ? ' · solo' : ''} · {data.tiles.filter((t) => t.parentTileId == null).length} tiles ·{' '}
          {own.map((p) => p.name).join(', ')}
          {testPlayers > 0 ? ` + ${testPlayers} test player${testPlayers === 1 ? '' : 's'}` : ''}
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
        <button
          type="button"
          className="rounded-lg border border-red-400/40 px-3 py-1.5 text-sm text-red-400 hover:border-red-400 disabled:opacity-50"
          disabled={!!busy}
          onClick={() => void remove()}
        >
          {busy === 'delete' ? 'Deleting…' : 'Delete session'}
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <p className="text-xs text-text-muted">
        In the plugin, the session is your active board within ~30s (one config poll). Reset keeps the tiles and the
        characters and wipes everything credited, so the same test can run again. An ended session is deleted
        automatically {LAB_KEEP_DAYS} days after it ends.
      </p>

      <section>
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-gold"><span className="h-5 w-1 bg-gold" />Board</h2>
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: square ? `repeat(${Math.max(1, event.boardSize)}, minmax(0, 1fr))` : 'repeat(auto-fill, minmax(9rem, 1fr))' }}
        >
          {data.tiles.filter((t) => t.parentTileId == null).map((t) => {
            const done = doneBy.get(t.id);
            const any = !!done && done.real + done.sim > 0;
            return (
              <div
                key={t.id}
                className={`rounded-lg border p-2 text-xs ${any ? 'border-accent-green bg-accent-green/10' : 'border-card-border bg-card-bg'} ${t.mission && !t.revealedAt ? 'border-dashed opacity-70' : ''}`}
              >
                <div className="font-medium text-gray-100">{t.label}</div>
                <div className="text-text-muted">
                  {t.tileType ?? 'standard'}
                  {t.trackedStat ? ` · ${t.trackedStat} ${t.statGoal ?? ''}` : ''}
                  {event.scoringMode === 'points' ? ` · ${t.points} pts` : ''}
                </div>
                {t.mission && (
                  <div className="mt-1 text-gold">mission · {t.closedAt ? 'closed' : t.revealedAt ? 'live' : 'hidden'}</div>
                )}
                {!t.mission && event.revealPolicy !== 'all' && (
                  <div className="mt-1 text-text-muted">{t.closedAt ? 'closed' : t.revealedAt ? 'open' : 'not drawn yet'}</div>
                )}
                {any && (
                  <div className="mt-1 text-accent-green-light">
                    ✓ {teamCount > 1 ? `${done!.real + done!.sim} team${done!.real + done!.sim === 1 ? '' : 's'}` : 'complete'}
                    {done!.sim > 0 && <span className="ml-1 rounded bg-gold/15 px-1 text-gold">{done!.sim} simulated</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <LabTileControlsPanel eventId={eventId} tiles={data.tiles} teams={data.teams} completions={data.completions} onDone={load} />

      <LabMissionsPanel
        tiles={data.tiles}
        policy={event.mission}
        pointsMode={event.scoringMode === 'points'}
        teamPlay={event.placement !== 'solo'}
        busy={!!busy}
        act={act}
      />

      <LabFieldPanel
        solo={event.placement === 'solo'}
        teams={teamCount}
        testTeams={testTeams}
        simulated={data.completions.filter((c) => c.simulated).length}
        credits={data.completions.length}
        busy={!!busy}
        act={act}
      />

      <StatSimulator eventId={eventId} tiles={data.tiles} participants={data.participants} onDone={load} />

      <section>
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-gold"><span className="h-5 w-1 bg-gold" />Characters</h2>
        <ul className="space-y-1 text-sm">
          {own.map((p) => (
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

      <LabTeamsPanel teams={data.teams} busy={!!busy} act={act} />

      <LabFeedChatPanel eventId={eventId} />

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
                {s.flaggedReason && (
                  <span className="text-gold" title={s.flaggedReason}>
                    ⚑ {FLAG_TEXT[s.flaggedReason] ?? s.flaggedReason}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-1 flex items-center gap-2 font-semibold text-gold"><span className="h-5 w-1 bg-gold" />Session log</h2>
        <p className="mb-3 text-xs text-text-muted">
          Everything the characters pushed during the session: Discord posts, moments, profile and stat pushes. A
          scenario name after the route means the dev client replayed it, and it stopped here. Without one it was real
          play, and it also went everywhere it normally goes.
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

/** One line for a logged body: the notify kind, or the first few keys. */
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
  const [tilePick, setTilePick] = useState('');

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
            <Select
              value={tilePick}
              onChange={(v) => {
                setTilePick(v);
                pickTile(Number(v));
              }}
              options={statTiles.map((t) => ({ value: String(t.id), label: `${t.label} — ${t.trackedStat} (${t.statType})` }))}
              placeholder="Pick a stat tile…"
              ariaLabel="From a tile"
              className="mt-1"
            />
          </label>
        )}
        <label className="text-sm text-gray-300">
          Character
          <Select
            value={String(participantId)}
            onChange={(v) => setParticipantId(Number(v))}
            options={participants.map((p) => ({ value: String(p.id), label: p.name }))}
            ariaLabel="Character"
            className="mt-1"
          />
        </label>
        <label className="text-sm text-gray-300">
          Type
          <Select
            value={statType}
            onChange={setStatType}
            options={[
              { value: 'boss', label: 'boss / activity' },
              { value: 'skill', label: 'skill (XP)' },
            ]}
            ariaLabel="Type"
            className="mt-1"
          />
        </label>
        <label className="text-sm text-gray-300">
          Hiscores key
          <Input className="mt-1" value={key} onChange={(e) => setKey(e.target.value)} placeholder="vorkath / slayer / overall" />
        </label>
        <label className="text-sm text-gray-300">
          Add
          <NumberInput className="mt-1" min={0} value={gain} onChange={setGain} fallback={0} aria-label="Add" />
        </label>
        <label className="text-sm text-gray-300">
          Starting value (optional)
          <Input className="mt-1" value={baseline} onChange={(e) => setBaseline(e.target.value)} placeholder="keep current" />
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
