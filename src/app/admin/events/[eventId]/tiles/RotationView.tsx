'use client';

import { useMemo, useState } from 'react';
import type { Tile } from '@/lib/types';
import type { EventRules } from '@/lib/eventRules';
import { tileKindBadge } from '@/lib/tileKinds';
import type { AuthoringModel } from '@/lib/tileAuthoring';
import { clanFetch } from '@/lib/clanFetch';

/**
 * The draw pool, in the order the engine will pull from it.
 *
 * On a Lucky draw, a Bounty hunt or a rotating ladder the host does not decide when anything opens
 * — the engine does. What the host owns is the POOL: what's in it, what order it's pulled in when
 * the draw isn't random, and the override when a draw needs forcing mid-event.
 *
 * None of that was authorable. The tiles page showed a row of counts ("6 open, 18 waiting") and
 * then the same flat card list as a classic bingo, which says nothing about what happens next. So
 * a host running a bounty board could not answer the only question that board raises: which one is
 * up after this?
 */

interface Props {
  eventId: number;
  tiles: Tile[];
  rules: EventRules;
  model: AuthoringModel;
  isAdmin: boolean;
  /** Reordering the pool is a pre-start edit — the server refuses it once the event is running. */
  eventStarted: boolean;
  reordering: boolean;
  editingTileId: number | null;
  onPick: (tileId: number) => void;
  onReorder: (ids: number[], describe: string) => void;
  /** An admin forced a tile open or pulled it back — carries the whole updated row. */
  onRevealStateChanged: (tile: Tile) => void;
}

export default function RotationView({
  eventId,
  tiles,
  rules,
  model,
  isAdmin,
  eventStarted,
  reordering,
  editingTileId,
  onPick,
  onReorder,
  onRevealStateChanged,
}: Props) {
  const [busyTileId, setBusyTileId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  const sequential = rules.revealOrder === 'sequential';
  const { open, waiting, claimed } = useMemo(
    () => ({
      open: tiles.filter((t) => t.revealedAt && !t.closedAt).sort((a, b) => a.position - b.position),
      waiting: tiles.filter((t) => !t.revealedAt).sort((a, b) => a.position - b.position),
      claimed: tiles.filter((t) => t.closedAt).sort((a, b) => a.position - b.position),
    }),
    [tiles],
  );

  async function setRevealState(tile: Tile, next: 'live' | 'hidden') {
    if (
      next === 'hidden' &&
      !confirm(`Pull this ${model.noun} back out of the board? The rotation can draw it again later.`)
    ) {
      return;
    }
    setBusyTileId(tile.id);
    setError('');
    try {
      const res = await clanFetch(`/api/events/${eventId}/tiles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tileId: tile.id, revealState: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `Could not change that ${model.noun}.`);
        return;
      }
      onRevealStateChanged(data as Tile);
    } catch {
      setError(`Could not change that ${model.noun}.`);
    } finally {
      setBusyTileId(null);
    }
  }

  function drop(targetId: number) {
    const dragged = dragId;
    setDragId(null);
    setDragOverId(null);
    if (dragged == null || dragged === targetId) return;
    const ids = [...tiles].sort((a, b) => a.position - b.position).map((t) => t.id);
    const from = ids.indexOf(dragged);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, dragged);
    onReorder(ids, 'Draw order updated.');
  }

  function shufflePool() {
    if (!confirm('Shuffle the pool into a new random order?')) return;
    const ids = [...tiles].sort((a, b) => a.position - b.position).map((t) => t.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    onReorder(ids, 'Pool shuffled.');
  }

  const canOrder = sequential && !eventStarted;

  return (
    <div className="space-y-4">
      {/* What the engine is going to do, in a sentence — the thing the counts alone never said. */}
      <div className="rounded-xl border border-gold/25 bg-gold/[0.05] p-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">How the draw runs</h3>
          {canOrder && (
            <button
              type="button"
              onClick={shufflePool}
              disabled={reordering || tiles.length < 2}
              className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-card-border text-text-muted hover:text-foreground hover:border-gold/40 transition-colors disabled:opacity-50"
            >
              🎲 Shuffle the pool
            </button>
          )}
        </div>
        <p className="text-xs text-text-muted leading-relaxed">{engineSentence(rules, model)}</p>
        <p className="text-[11px] text-text-muted">
          {sequential
            ? eventStarted
              ? 'Drawn in the order below. The order is fixed once the event starts.'
              : 'Drawn in the order below — drag to change what comes next.'
            : `Drawn at random, so the order below is just how the ${model.nounPlural} were added.`}{' '}
          Change any of this on the event&rsquo;s <span className="text-foreground/70">Rules &amp; dates</span>.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <PoolGroup
        title={rules.revealPolicy === 'bounty' ? 'The open bounty' : 'Open now'}
        tone="green"
        empty={
          eventStarted
            ? 'Nothing is open — the next draw will fix that.'
            : `Nothing has been drawn yet. The first draw fires when the event starts.`
        }
        tiles={open}
        {...{ model, isAdmin, busyTileId, editingTileId, onPick, setRevealState, canOrder: false }}
      />

      <PoolGroup
        title={sequential ? 'Up next, in order' : 'Waiting in the pool'}
        tone="neutral"
        empty={`Every ${model.noun} has been drawn.`}
        tiles={waiting}
        markFirstAsNext={sequential}
        canOrder={canOrder}
        dragId={dragId}
        dragOverId={dragOverId}
        onDragStart={setDragId}
        onDragOver={setDragOverId}
        onDrop={drop}
        {...{ model, isAdmin, busyTileId, editingTileId, onPick, setRevealState }}
      />

      {claimed.length > 0 && (
        <PoolGroup
          title="Closed"
          tone="muted"
          empty=""
          tiles={claimed}
          {...{ model, isAdmin, busyTileId, editingTileId, onPick, setRevealState, canOrder: false }}
        />
      )}

      {tiles.length === 0 && (
        <div className="border border-card-border rounded-xl p-8 bg-card-bg text-center text-sm text-text-muted">
          The pool is empty — add some {model.nounPlural} first.
        </div>
      )}
    </div>
  );
}

/** The engine's behaviour, stated the way a host would say it out loud. */
function engineSentence(rules: EventRules, model: AuthoringModel): string {
  const every =
    rules.revealIntervalMinutes % 60 === 0
      ? `${rules.revealIntervalMinutes / 60} hour${rules.revealIntervalMinutes === 60 ? '' : 's'}`
      : `${rules.revealIntervalMinutes} minutes`;
  const batch =
    rules.revealBatchSize === 1 ? `one ${model.noun}` : `${rules.revealBatchSize} ${model.nounPlural}`;
  switch (rules.revealPolicy) {
    case 'bounty':
      return `One ${model.noun} is open at a time. The moment a team claims it, the next is drawn — no timer involved.`;
    case 'rotating':
      return `${rules.revealWindowSize} ${
        rules.revealWindowSize === 1 ? model.noun : model.nounPlural
      } stay open at once. Every ${every} the engine draws ${batch} and expires the oldest to keep the window that size.`;
    default:
      return `Every ${every} the engine draws ${batch}, starting the moment the event begins. Everything drawn stays open.`;
  }
}

function PoolGroup({
  title,
  tone,
  empty,
  tiles,
  model,
  isAdmin,
  busyTileId,
  editingTileId,
  onPick,
  setRevealState,
  markFirstAsNext = false,
  canOrder = false,
  dragId = null,
  dragOverId = null,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  title: string;
  tone: 'green' | 'neutral' | 'muted';
  empty: string;
  tiles: Tile[];
  model: AuthoringModel;
  isAdmin: boolean;
  busyTileId: number | null;
  editingTileId: number | null;
  onPick: (tileId: number) => void;
  setRevealState: (tile: Tile, next: 'live' | 'hidden') => void;
  markFirstAsNext?: boolean;
  canOrder?: boolean;
  dragId?: number | null;
  dragOverId?: number | null;
  onDragStart?: (id: number | null) => void;
  onDragOver?: (id: number | null) => void;
  onDrop?: (id: number) => void;
}) {
  const ring =
    tone === 'green'
      ? 'border-accent-green/30 bg-accent-green/[0.05]'
      : tone === 'muted'
        ? 'border-card-border bg-card-bg/60'
        : 'border-card-border bg-card-bg';

  return (
    <div className={`rounded-xl border overflow-hidden ${ring}`}>
      <div className="px-4 py-2.5 border-b border-card-border/70 flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="text-xs text-text-muted">{tiles.length}</span>
      </div>
      {tiles.length === 0 ? (
        empty ? <p className="px-4 py-4 text-xs text-text-muted">{empty}</p> : null
      ) : (
        <ul className="divide-y divide-card-border/60">
          {tiles.map((tile, i) => {
            const badge = tileKindBadge(tile);
            const isNext = markFirstAsNext && i === 0;
            return (
              <li
                key={tile.id}
                draggable={canOrder}
                onDragStart={() => onDragStart?.(tile.id)}
                onDragEnd={() => {
                  onDragStart?.(null);
                  onDragOver?.(null);
                }}
                onDragOver={(e) => {
                  if (!canOrder) return;
                  e.preventDefault();
                  onDragOver?.(tile.id);
                }}
                onDrop={(e) => {
                  if (!canOrder) return;
                  e.preventDefault();
                  onDrop?.(tile.id);
                }}
                className={`flex flex-wrap items-center gap-3 px-4 py-2.5 ${
                  editingTileId === tile.id ? 'bg-gold/[0.07]' : ''
                } ${dragOverId === tile.id && dragId !== tile.id ? 'border-t-2 border-t-gold' : ''} ${
                  dragId === tile.id ? 'opacity-40' : ''
                } ${canOrder ? 'cursor-grab active:cursor-grabbing' : ''}`}
              >
                {canOrder && <span aria-hidden className="text-text-muted/60 text-xs shrink-0">⠿</span>}
                <span className="text-xs font-mono text-text-muted w-8 shrink-0">#{tile.position + 1}</span>
                {isNext && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-gold/20 text-gold shrink-0">
                    Next up
                  </span>
                )}
                <button type="button" onClick={() => onPick(tile.id)} className="flex-1 min-w-[10rem] text-left group">
                  <span className="block text-sm font-medium text-foreground truncate group-hover:text-gold transition-colors">
                    {tile.label}
                  </span>
                  <span className="block text-[11px] text-text-muted truncate">
                    {badge.label}
                    {tile.revealedAt && !tile.closedAt && ` · open since ${new Date(tile.revealedAt).toLocaleString()}`}
                    {tile.closedAt && ` · closed ${new Date(tile.closedAt).toLocaleString()}`}
                  </span>
                </button>
                {model.axes.scoring === 'points' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-purple-500/20 text-purple-300 shrink-0">
                    {tile.points ?? 1} pt{(tile.points ?? 1) !== 1 ? 's' : ''}
                  </span>
                )}
                {/* The override. The engine normally decides this, which is exactly why the manual
                    lever has to be somewhere a host can find it mid-event. */}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setRevealState(tile, tile.revealedAt && !tile.closedAt ? 'hidden' : 'live')}
                    disabled={busyTileId === tile.id}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-50 shrink-0 ${
                      tile.revealedAt && !tile.closedAt
                        ? 'border-card-border text-text-muted hover:text-foreground'
                        : 'border-accent-green/30 text-accent-green-light hover:bg-accent-green/10'
                    }`}
                  >
                    {busyTileId === tile.id
                      ? '…'
                      : tile.revealedAt && !tile.closedAt
                        ? 'Hide'
                        : tile.closedAt
                          ? 'Re-open'
                          : 'Open now'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
