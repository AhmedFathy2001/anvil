'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Input from '@/components/Input';
import { clanFetch } from '@/lib/clanFetch';
import AnvilTaskEditor, { type AnvilTaskDraft } from '@/components/AnvilTaskEditor';
import { tileTierKey, DEFAULT_TIER_BANDS } from '@/lib/tileFilter';
import { TILE_KIND_BADGES, tileKindKey, type TileKindLike } from '@/lib/tileKinds';
import type { AnvilTask } from '@/lib/libraryTasks';
import type { LibraryBoard } from '@/lib/libraryBoards';
import type { BoardEditPayload, LibraryProposal } from '@/lib/libraryProposals';
import type { TileCsvRow } from '@/lib/csvTiles';

type Tab = 'suggestions' | 'tasks' | 'boards';

async function call(url: string, init?: RequestInit): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await clanFetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

/**
 * Anvil's task and board library, for staff: review suggestions (approving applies them), write and
 * archive tasks — a save reaches every clan copy that still follows the task — and look after boards.
 */
export default function StaffLibraryClient({ canEdit }: { canEdit: boolean }) {
  const [tab, setTab] = useState<Tab>('suggestions');
  const [pending, setPending] = useState<LibraryProposal[]>([]);
  const [reviewed, setReviewed] = useState<LibraryProposal[]>([]);
  const [showReviewed, setShowReviewed] = useState(false);
  const [tasks, setTasks] = useState<AnvilTask[] | null>(null);
  const [boards, setBoards] = useState<LibraryBoard[] | null>(null);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<{ task: AnvilTask | null } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [p, r, t, b] = await Promise.all([
      call('/api/staff/library/proposals?status=pending'),
      call('/api/staff/library/proposals?status=reviewed'),
      call('/api/staff/library/tasks'),
      call('/api/staff/library/boards'),
    ]);
    setPending((p.data.proposals as LibraryProposal[]) ?? []);
    setReviewed((r.data.proposals as LibraryProposal[]) ?? []);
    setTasks((t.data.tasks as AnvilTask[]) ?? []);
    setBoards((b.data.boards as LibraryBoard[]) ?? []);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() only sets state after its fetches resolve
    void load();
  }, [load]);

  async function act(url: string, init: RequestInit, ok: string) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await call(url, init);
      setMsg(r.ok ? { ok: true, text: ok } : { ok: false, text: (r.data.error as string) || 'That didn’t work.' });
      if (r.ok) await load();
      return r.ok;
    } finally {
      setBusy(false);
    }
  }

  async function saveTask(draft: AnvilTaskDraft, target: AnvilTask | null): Promise<string | null> {
    const r = await call(target ? `/api/staff/library/tasks/${target.id}` : '/api/staff/library/tasks', {
      method: target ? 'PATCH' : 'POST',
      body: JSON.stringify(draft),
    });
    if (!r.ok) return (r.data.error as string) || 'Could not save.';
    setMsg({ ok: true, text: target ? 'Saved. Every clan copy that follows it has the new version.' : 'Added to the library.' });
    await load();
    return null;
  }

  const shownTasks = useMemo(() => {
    const w = q.toLowerCase();
    return (tasks ?? []).filter((t) => !w || `${t.label} ${t.category ?? ''}`.toLowerCase().includes(w));
  }, [tasks, q]);

  const tabCls = (on: boolean) =>
    `px-3 py-1.5 text-sm rounded-lg border ${on ? 'border-gold/50 bg-gold/10 text-gold' : 'border-card-border text-text-muted hover:text-foreground'}`;

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Task &amp; board library</h1>
        <p className="text-sm text-text-muted mt-1">
          Every clan browses and imports from here. Saving a task updates every clan copy that still follows it; clans
          that changed theirs get an offer instead.
        </p>
      </div>
      <div className="flex gap-2">
        <button className={tabCls(tab === 'suggestions')} onClick={() => setTab('suggestions')}>
          Suggestions{pending.length ? ` (${pending.length})` : ''}
        </button>
        <button className={tabCls(tab === 'tasks')} onClick={() => setTab('tasks')}>
          Tasks{tasks ? ` (${tasks.length})` : ''}
        </button>
        <button className={tabCls(tab === 'boards')} onClick={() => setTab('boards')}>
          Boards{boards ? ` (${boards.length})` : ''}
        </button>
      </div>
      {msg && <p className={`text-sm ${msg.ok ? 'text-accent-green-light' : 'text-red-400'}`}>{msg.text}</p>}

      {tab === 'suggestions' && (
        <div className="space-y-3">
          {pending.length === 0 && <p className="text-sm text-text-muted">Nothing waiting.</p>}
          {pending.map((p) => (
            <ProposalCard key={p.id} p={p} tasks={tasks ?? []} boards={boards ?? []} canEdit={canEdit} busy={busy} act={act} />
          ))}
          <button className="text-xs text-text-muted hover:text-foreground" onClick={() => setShowReviewed((v) => !v)}>
            {showReviewed ? 'Hide' : 'Show'} reviewed ({reviewed.length})
          </button>
          {showReviewed && (
            <ul className="space-y-1 text-sm">
              {reviewed.map((p) => (
                <li key={p.id} className="text-text-muted">
                  {p.status === 'approved' ? '✓' : '✕'} {kindLabel(p)}: {titleOf(p)} — {p.proposerName}
                  {p.reviewNote ? ` · “${p.reviewNote}”` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'tasks' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks…" aria-label="Search tasks" />
            {canEdit && (
              <button onClick={() => setEditing({ task: null })} className="px-3 py-1.5 rounded-lg bg-gold text-brown-dark font-semibold text-sm whitespace-nowrap">
                New task
              </button>
            )}
          </div>
          <ul className="divide-y divide-card-border/60 rounded-xl border border-card-border bg-card-bg">
            {shownTasks.map((t) => {
              const badge = TILE_KIND_BADGES[tileKindKey(t.config as TileKindLike)];
              const tier = DEFAULT_TIER_BANDS.find((b) => b.key === tileTierKey(t.points))?.label;
              return (
                <li key={t.id} className={`flex items-center gap-3 px-3 py-2 ${t.archived ? 'opacity-50' : ''}`}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm truncate">{t.label}</span>
                    <span className="block text-[11px] text-text-muted">
                      {[t.category, tier, `${t.points} pts`, `v${t.version}`, t.archived ? 'archived' : null].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {badge && <span className={`text-[10px] px-1.5 py-0.5 rounded ${badge.cls}`}>{badge.label}</span>}
                  {canEdit && (
                    <>
                      <button onClick={() => setEditing({ task: t })} className="text-xs text-gold">
                        Edit
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          act(`/api/staff/library/tasks/${t.id}`, { method: 'PATCH', body: JSON.stringify({ archived: !t.archived }) }, t.archived ? 'Back in the library.' : 'Archived — hidden from browsing; clan copies keep it.')
                        }
                        className="text-xs text-text-muted"
                      >
                        {t.archived ? 'Restore' : 'Archive'}
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {tab === 'boards' && (
        <ul className="space-y-2">
          {(boards ?? []).map((b) => (
            <li key={b.id} className={`rounded-xl border border-card-border bg-card-bg px-4 py-3 ${b.status === 'hidden' ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{b.title}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${b.origin === 'anvil' ? 'bg-gold/20 text-gold' : 'bg-blue-500/15 text-blue-300'}`}>
                  {b.origin === 'anvil' ? 'Anvil' : `by ${b.clanName ?? 'a clan'}`}
                </span>
                <span className="text-xs text-text-muted">
                  {b.mode} · {b.tiles.length} tiles · {b.audience} · used {b.useCount}× · v{b.version}
                  {b.status === 'hidden' ? ' · hidden' : ''}
                </span>
                {canEdit && (
                  <span className="ml-auto flex gap-3 text-xs">
                    {b.origin === 'community' && (
                      <button disabled={busy} onClick={() => act('/api/staff/library/boards', { method: 'POST', body: JSON.stringify({ fromBoardId: b.id }) }, 'Copied in as an Anvil board.')} className="text-gold">
                        Make an Anvil copy
                      </button>
                    )}
                    <button
                      disabled={busy}
                      onClick={() =>
                        act(`/api/staff/library/boards/${b.id}`, { method: 'PATCH', body: JSON.stringify({ status: b.status === 'hidden' ? 'published' : 'hidden' }) }, b.status === 'hidden' ? 'Shown again.' : 'Hidden.')
                      }
                      className="text-text-muted"
                    >
                      {b.status === 'hidden' ? 'Show' : 'Hide'}
                    </button>
                    {b.origin === 'community' && (
                      <button disabled={busy} onClick={() => act(`/api/staff/library/boards/${b.id}`, { method: 'DELETE' }, 'Deleted.')} className="text-red-400">
                        Delete
                      </button>
                    )}
                  </span>
                )}
              </div>
              {b.description && <p className="text-xs text-text-muted mt-1">{b.description}</p>}
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <AnvilTaskEditor
          title={editing.task ? `Edit: ${editing.task.label}` : 'New Anvil task'}
          task={editing.task}
          mode="staff"
          lookupApi="/api/library"
          categorySuggestions={[...new Set((tasks ?? []).map((t) => t.category).filter((c): c is string => !!c))]}
          onSubmit={(draft) => saveTask(draft, editing.task)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function kindLabel(p: LibraryProposal): string {
  return p.kind === 'task-new' ? 'New task' : p.kind === 'task-edit' ? 'Task fix' : 'Board change';
}

function titleOf(p: LibraryProposal): string {
  return p.targetTitle ?? (p.payload as AnvilTaskDraft).label ?? 'board';
}

function taskLine(t: { label: string; points: number; category?: string | null; config: TileCsvRow }): string {
  const badge = TILE_KIND_BADGES[tileKindKey(t.config as TileKindLike)]?.label;
  return [t.label, `${t.points} pts`, t.category, badge].filter(Boolean).join(' · ');
}

/** One waiting suggestion: what it changes, side by side with what's there now, and approve / reject. */
function ProposalCard({
  p,
  tasks,
  boards,
  canEdit,
  busy,
  act,
}: {
  p: LibraryProposal;
  tasks: AnvilTask[];
  boards: LibraryBoard[];
  canEdit: boolean;
  busy: boolean;
  act: (url: string, init: RequestInit, ok: string) => Promise<boolean>;
}) {
  const [note, setNote] = useState('');
  const current = p.targetTaskId ? tasks.find((t) => t.id === p.targetTaskId) : null;
  const board = p.targetBoardId ? boards.find((b) => b.id === p.targetBoardId) : null;
  const task = p.kind !== 'board-edit' ? (p.payload as AnvilTaskDraft) : null;
  const edit = p.kind === 'board-edit' ? (p.payload as BoardEditPayload) : null;
  const send = (action: 'approve' | 'reject') =>
    act(`/api/staff/library/proposals/${p.id}`, { method: 'POST', body: JSON.stringify({ action, note }) }, action === 'approve' ? 'Approved and applied.' : 'Rejected — they’ll see your note.');

  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-4 space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{kindLabel(p)}</span>
        <span>{titleOf(p)}</span>
        <span className="text-xs text-text-muted">
          from {p.proposerName}
          {p.clanName ? ` (${p.clanName})` : ''}
        </span>
        {p.stale && <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">changed since this was written</span>}
      </div>
      {p.note && <p className="text-text-muted">“{p.note}”</p>}

      {task && (
        <div className="grid gap-2 sm:grid-cols-2 text-xs">
          {current && (
            <div className="rounded-lg border border-card-border p-2">
              <p className="text-text-muted mb-1">Now</p>
              <p>{taskLine(current)}</p>
            </div>
          )}
          <div className="rounded-lg border border-gold/30 p-2">
            <p className="text-text-muted mb-1">{current ? 'Suggested' : 'New task'}</p>
            <p>{taskLine(task)}</p>
            <pre className="mt-1 whitespace-pre-wrap break-all text-[10px] text-text-muted max-h-32 overflow-auto">{JSON.stringify(task.config, null, 1)}</pre>
          </div>
        </div>
      )}

      {edit && board && (
        <div className="grid gap-2 sm:grid-cols-2 text-xs">
          <div className="rounded-lg border border-card-border p-2">
            <p className="text-text-muted mb-1">Now ({board.tiles.length} tiles)</p>
            <ol className="list-decimal ml-4 space-y-0.5">
              {board.tiles.map((t, i) => (
                <li key={i} className={edit.tiles && !edit.tiles.some((n) => n.label === t.label) ? 'text-red-400' : ''}>
                  {t.label}
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-lg border border-gold/30 p-2">
            <p className="text-text-muted mb-1">Suggested{edit.tiles ? ` (${edit.tiles.length} tiles)` : ''}</p>
            {edit.meta && <p className="mb-1">Details: {edit.meta.title}</p>}
            {edit.tiles && (
              <ol className="list-decimal ml-4 space-y-0.5">
                {edit.tiles.map((t, i) => (
                  <li key={i} className={!board.tiles.some((o) => o.label === t.label) ? 'text-accent-green-light' : ''}>
                    {t.label}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}

      {canEdit && (
        <div className="flex flex-wrap gap-2 items-center">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to them (needed to reject)" aria-label="Review note" className="flex-1 min-w-[14rem]" />
          <button disabled={busy} onClick={() => send('approve')} className="px-3 py-1.5 rounded-lg bg-gold text-brown-dark font-semibold disabled:opacity-50">
            Approve
          </button>
          <button disabled={busy || !note.trim()} onClick={() => send('reject')} className="px-3 py-1.5 rounded-lg border border-card-border disabled:opacity-50">
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
