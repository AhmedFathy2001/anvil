'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import { useDialog } from '@/components/Confirm';
import LocalTime from '@/components/LocalTime';
import { clanFetch, clanUrl } from '@/lib/clanFetch';
import type { PracticeView } from '@/lib/practice';
import { CopyTiles, PickTiles, fillPicked, type PickedRow } from '@/app/admin/events/practice/PracticeSetup';
import { cn } from '@/lib/utils';

function untilText(endIso: string | null, now: number): string {
  if (!endIso) return '';
  const ms = Date.parse(endIso) - now;
  if (!Number.isFinite(ms) || ms <= 0) return 'ending';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function ago(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

function fmt(n: number | null): string {
  return n == null ? '–' : n.toLocaleString();
}

export default function PracticeBoardClient({
  view,
  manage,
  maxTiles,
  note,
}: {
  view: PracticeView;
  manage: boolean;
  maxTiles: number;
  note: string | null;
}) {
  const router = useRouter();
  const { confirm, ask, notify } = useDialog();
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [adding, setAdding] = useState<null | 'copy' | 'pick'>(null);
  const [boards, setBoards] = useState<{ id: number; name: string; startDate: string | null; tiles: number }[] | null>(null);
  const [boardId, setBoardId] = useState<number | null>(null);
  const [copyIds, setCopyIds] = useState<number[]>([]);
  const [picked, setPicked] = useState<PickedRow[]>([]);
  const room = Math.max(0, maxTiles - view.tileCount);

  // Progress comes from real play: re-read the page every 15s while it runs.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    const poll = view.running ? setInterval(() => router.refresh(), 15_000) : null;
    return () => {
      clearInterval(tick);
      if (poll) clearInterval(poll);
    };
  }, [router, view.running]);

  useEffect(() => {
    if (!adding || boards != null) return;
    clanFetch('/api/admin/practice')
      .then((r) => (r.ok ? r.json() : { boards: [] }))
      .then((d: { boards?: { id: number; name: string; startDate: string | null; tiles: number }[] }) => {
        const list = d.boards ?? [];
        setBoards(list);
        if (list[0]) setBoardId(list[0].id);
      })
      .catch(() => setBoards([]));
  }, [adding, boards]);

  async function act(key: string, body: Record<string, unknown>): Promise<boolean> {
    setBusy(key);
    try {
      const res = await clanFetch(`/api/admin/practice/${view.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data.error || 'That did not work.', 'error');
        return false;
      }
      if (data.deleted) router.push(clanUrl('/admin/events'));
      else router.refresh();
      return true;
    } finally {
      setBusy(null);
    }
  }

  async function lower(tileId: number, goal: number | null) {
    const answer = await ask({
      title: 'Lower the target',
      body: 'Only this practice board’s copy changes. A real kill or two then finishes it.',
      initial: String(Math.min(2, goal ?? 2)),
      confirmLabel: 'Lower it',
    });
    if (answer == null) return;
    const to = Number(answer);
    if (!Number.isInteger(to) || to < 1) {
      notify('Pick a whole number of at least 1.', 'error');
      return;
    }
    await act(`lower:${tileId}`, { action: 'lower', tileId, to });
  }

  async function addTiles() {
    if (adding === 'copy') {
      if (!boardId || copyIds.length === 0) return;
      if (await act('add', { action: 'addFromBoard', boardId, tileIds: copyIds })) setAdding(null);
      return;
    }
    if (adding === 'pick' && picked.length > 0) {
      setBusy('add');
      try {
        const made = await clanFetch(`/api/admin/practice/${view.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'addBlank', count: picked.length }),
        });
        if (!made.ok) {
          notify((await made.json().catch(() => ({}))).error || 'Could not add tiles.', 'error');
          return;
        }
        const problem = await fillPicked(view.id, picked);
        if (problem) notify(problem, 'error');
        setPicked([]);
        setAdding(null);
        router.refresh();
      } finally {
        setBusy(null);
      }
    }
  }

  const teamName = (teamId: number) => view.teams.find((t) => t.id === teamId)?.name ?? 'Team';
  const twoTeams = view.teams.length > 1;
  const btn = 'h-9 px-3 rounded-lg border border-card-border text-sm hover:border-gold/50 transition-colors disabled:opacity-40';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/50 bg-amber-950/40 px-4 py-3">
        <span className="rounded bg-amber-400 px-2 py-0.5 text-[11px] font-bold tracking-wider text-brown-dark">PRACTICE</span>
        <div className="flex-1 min-w-0 text-sm text-amber-100">
          {view.running
            ? <>Only you and the people on it can see this board. {view.hook ? `Posts go to the test ${view.hook}.` : 'Nothing posts to Discord.'} Nothing counts.</>
            : 'This practice board has ended. Only the clan’s admins can see it now, and it is deleted 7 days after it ended.'}
        </div>
        <span className="text-sm text-amber-100">{view.running ? `Ends in ${untilText(view.endDate, now)}` : 'Ended'}</span>
      </div>

      {note && <div className="rounded-lg border border-red-400/40 bg-red-950/30 px-4 py-2 text-sm text-red-200">{note}</div>}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {view.sourceName && <div className="text-xs text-text-muted">Copied from {view.sourceName}</div>}
          <h1 className="text-2xl font-bold">{view.name}</h1>
        </div>
        {manage && (
          <div className="flex flex-wrap gap-2">
            {view.running && (
              <>
                <button
                  type="button"
                  className={btn}
                  disabled={!!busy}
                  onClick={async () => {
                    if (await confirm({ title: 'Reset all progress?', body: 'Every tile starts over from now. The tiles and people stay.', confirmLabel: 'Reset all' })) {
                      await act('reset', { action: 'reset' });
                    }
                  }}
                >
                  Reset all progress
                </button>
                <button type="button" className={btn} disabled={!!busy || room === 0} onClick={() => setAdding(adding ? null : 'copy')}>
                  Add tiles
                </button>
                <button
                  type="button"
                  className={cn(btn, 'border-red-900/70 text-red-300 hover:border-red-400/60')}
                  disabled={!!busy}
                  onClick={async () => {
                    if (await confirm({ title: 'End the practice board now?', body: 'It stops counting. It is deleted 7 days later.', confirmLabel: 'End now' })) {
                      await act('end', { action: 'end' });
                    }
                  }}
                >
                  End now
                </button>
              </>
            )}
            {!view.running && (
              <>
                <ClanLink href="/admin/events/practice" className={cn(btn, 'inline-flex items-center')}>
                  Start another
                </ClanLink>
                <button
                  type="button"
                  className={cn(btn, 'border-red-900/70 text-red-300')}
                  disabled={!!busy}
                  onClick={async () => {
                    if (await confirm({ title: 'Delete this practice board?', body: 'It goes now instead of in 7 days.', confirmLabel: 'Delete' })) {
                      await act('delete', { action: 'delete' });
                    }
                  }}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {manage && adding && (
        <div className="rounded-xl border border-card-border bg-card-bg p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button type="button" className={cn(btn, adding === 'copy' && 'border-gold text-gold')} onClick={() => setAdding('copy')}>
              From a board
            </button>
            <button type="button" className={cn(btn, adding === 'pick' && 'border-gold text-gold')} onClick={() => setAdding('pick')}>
              From the library or typed
            </button>
            <span className="text-xs text-text-muted ml-auto">Room for {room} more</span>
          </div>
          {adding === 'copy' ? (
            <CopyTiles boards={boards} boardId={boardId} onBoard={setBoardId} picked={copyIds} onChange={setCopyIds} max={room} preselect={false} />
          ) : (
            <PickTiles picked={picked} onChange={setPicked} max={room} />
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className={btn} onClick={() => setAdding(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="h-9 px-4 rounded-lg bg-gold text-brown-dark text-sm font-semibold disabled:opacity-40"
              disabled={busy === 'add' || (adding === 'copy' ? copyIds.length === 0 : picked.length === 0)}
              onClick={addTiles}
            >
              {busy === 'add' ? 'Adding…' : 'Add to the board'}
            </button>
          </div>
        </div>
      )}

      <div className={cn('grid gap-2.5', twoTeams ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1')}>
        {view.teams.map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded-xl border border-card-border bg-card-bg px-4 py-3">
            <div className="min-w-0">
              <div className="text-xs text-text-muted">{t.name}</div>
              <div className="text-sm font-semibold truncate">{t.players.join(', ') || 'Nobody yet'}</div>
            </div>
            <div className="text-xl font-bold" style={{ color: t.color }}>
              {t.done} / {view.tileCount}
            </div>
          </div>
        ))}
      </div>

      <section className="space-y-2">
        <div className="text-xs font-semibold tracking-wide text-text-muted uppercase">Tiles · progress from real play</div>
        {view.tiles.length === 0 && <div className="text-sm text-text-muted">No tiles yet.</div>}
        {view.tiles.map((tile) => {
          const allDone = tile.teams.every((t) => t.done);
          return (
            <div
              key={tile.id}
              className={cn(
                'flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3',
                tile.hidden ? 'border-dashed border-card-border' : allDone ? 'border-green-700/60 bg-green-950/30' : 'border-card-border bg-card-bg',
              )}
            >
              <div className="flex-1 min-w-[12rem] space-y-1.5">
                <div className={cn('text-sm font-semibold', tile.hidden && 'text-text-muted')}>
                  {tile.label}
                  {tile.hidden && <span className="ml-2 text-xs font-normal">hidden from players for now — they see it as members will</span>}
                </div>
                {tile.teams.map((t) => (
                  <div key={t.teamId} className="flex items-center gap-2 text-xs text-text-muted">
                    {twoTeams && <span className="w-20 shrink-0 truncate">{teamName(t.teamId)}</span>}
                    {t.done ? (
                      <span className="text-green-300">
                        Done{t.doneBy ? ` by ${t.doneBy}` : ''}
                        {t.doneAt ? ` · ${ago(t.doneAt.includes('T') ? t.doneAt : `${t.doneAt.replace(' ', 'T')}Z`, now)} ago` : ''}
                        {view.hook ? ' · posted to the test hook' : ''}
                      </span>
                    ) : tile.store && tile.goal != null ? (
                      <>
                        <div className="h-1.5 flex-1 max-w-xs rounded bg-brown-dark">
                          <div
                            className="h-1.5 rounded bg-gold"
                            style={{ width: `${tile.store === 'fastest' ? (t.progress ? 100 : 0) : Math.min(100, Math.round(((t.progress ?? 0) / tile.goal) * 100))}%` }}
                          />
                        </div>
                        <span>
                          {tile.store === 'fastest' ? `${fmt(t.progress)}s best · under ${fmt(tile.goal)}s` : `${fmt(t.progress)} / ${fmt(tile.goal)}`}
                        </span>
                      </>
                    ) : (
                      <span>Waiting</span>
                    )}
                  </div>
                ))}
              </div>
              {manage && view.running && (
                <div className="flex gap-2">
                  {tile.lowerable && (
                    <button type="button" className={btn} disabled={!!busy} onClick={() => lower(tile.id, tile.goal)}>
                      Lower target
                    </button>
                  )}
                  <button type="button" className={btn} disabled={!!busy} onClick={() => act(`reset:${tile.id}`, { action: 'resetTile', tileId: tile.id })}>
                    Reset
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section className="rounded-xl border border-card-border bg-card-bg p-4 space-y-2">
        <div className="text-xs font-semibold tracking-wide text-text-muted uppercase">What happened · last 15 min</div>
        {view.log.length === 0 && <div className="text-sm text-text-muted">Nothing yet. Play on one of the characters above and it shows here.</div>}
        {view.log.map((l, i) => (
          <div key={i} className="flex justify-between gap-3 text-sm">
            <span className={cn(l.kind === 'done' && 'text-green-300', l.kind === 'seen' && 'text-text-muted')}>
              {l.who}: {l.text}
            </span>
            <span className="text-text-muted shrink-0">{ago(l.at, now)}</span>
          </div>
        ))}
        {view.endDate && (
          <div className="pt-1 text-xs text-text-muted">
            {view.running ? 'Runs until' : 'Ended'} <LocalTime date={view.forceEndedAt ?? view.endDate} format="datetime" />.
          </div>
        )}
      </section>
    </div>
  );
}
