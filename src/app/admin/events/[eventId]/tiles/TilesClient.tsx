'use client';

import type { Event, Tile } from '@/lib/types';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import TileTrackingConfig from '@/components/TileTrackingConfig';
import { useModalA11y } from '@/hooks/useModalA11y';
import { isPointsMode, isTileRaceFormat } from '@/lib/utils';
import { TILE_CSV_COLUMNS, parseTileCsv } from '@/lib/csvTiles';

interface Props {
  event: Event;
  tiles: Tile[];
}

export default function TilesClient({ event, tiles }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localTiles, setLocalTiles] = useState<Tile[]>([...tiles].sort((a, b) => a.position - b.position));
  const [editingTileId, setEditingTileId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [adding, setAdding] = useState(false);

  const pointsMode = isPointsMode(event.scoringMode);
  const eventStarted = !!event.startDate && new Date(event.startDate) <= new Date();
  const editingTile = editingTileId != null ? localTiles.find((t) => t.id === editingTileId) ?? null : null;
  // Leagues (bingo+points) and Tile-race boards are arbitrary-length task lists, so tiles can be
  // added/removed; a classic bingo grid is a fixed N×N square and stays locked to its size.
  const dynamicBoard = isTileRaceFormat(event.format) || pointsMode;
  const canEditTileSet = dynamicBoard && !eventStarted;

  async function handleAddTile() {
    setAdding(true);
    setImportMsg(null);
    try {
      const res = await fetch(`/api/events/${event.id}/tiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImportMsg({ type: 'error', text: data.error || 'Could not add tile.' });
        return;
      }
      setLocalTiles((prev) => [...prev, data as Tile]);
      // Clear filters so the freshly-added tile is visible once its drawer closes.
      setSearch('');
      setKindFilter('all');
      setEditingTileId(data.id);
      router.refresh();
    } finally {
      setAdding(false);
    }
  }

  async function handleDeleteTile(tileId: number) {
    const res = await fetch(`/api/events/${event.id}/tiles/${tileId}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setImportMsg({ type: 'error', text: data.error || 'Could not delete tile.' });
      return;
    }
    setLocalTiles((prev) => {
      const removed = prev.find((t) => t.id === tileId);
      const pos = removed?.position ?? Infinity;
      return prev
        .filter((t) => t.id !== tileId)
        .map((t) => (t.position > pos ? { ...t, position: t.position - 1 } : t));
    });
    setEditingTileId(null);
    router.refresh();
  }

  // Filter state — essential once a Leagues board imports hundreds of tiles.
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);

  const filteredTiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return localTiles.filter((t) => {
      if (kindFilter !== 'all' && tileKindKey(t) !== kindFilter) return false;
      if (!q) return true;
      return (
        t.label?.toLowerCase().includes(q) ||
        t.category?.toLowerCase().includes(q) ||
        t.trackedStat?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        String(t.position + 1) === q.replace(/^#/, '') ||
        false
      );
    });
  }, [localTiles, search, kindFilter]);

  // Collapse back to the first page whenever the result set changes.
  useEffect(() => setVisibleLimit(PAGE_SIZE), [search, kindFilter]);

  const visibleTiles = filteredTiles.slice(0, visibleLimit);

  function handleTileConfigSaved(
    tileId: number,
    updated: {
      label: string;
      description: string | null;
      tileType: string;
      requiredAmount: number | null;
      trackedStat: string | null;
      statType: string | null;
      statGoal: number | null;
      trackingMode: string;
      optional?: boolean;
      trackedItemIds?: number[] | null;
      itemRequirements?: { itemId: number; name: string; requiredAmount: number }[] | null;
      points?: number;
      category?: string | null;
      sourceNpcs?: string[] | null;
      targetNpcs?: string[] | null;
      timedActivity?: string | null;
      timeThresholdSeconds?: number | null;
    },
  ) {
    const { trackedItemIds, itemRequirements, sourceNpcs, targetNpcs, optional: updatedOptional, ...rest } = updated;
    setLocalTiles((prev) =>
      prev.map((t) =>
        t.id === tileId
          ? {
              ...t,
              ...rest,
              optional: updatedOptional ? 1 : 0,
              trackedItemIds:
                trackedItemIds === undefined ? t.trackedItemIds : trackedItemIds === null ? null : JSON.stringify(trackedItemIds),
              itemRequirements:
                itemRequirements === undefined ? t.itemRequirements : itemRequirements === null ? null : JSON.stringify(itemRequirements),
              sourceNpcs:
                sourceNpcs === undefined ? t.sourceNpcs : sourceNpcs === null ? null : JSON.stringify(sourceNpcs),
              targetNpcs:
                targetNpcs === undefined ? t.targetNpcs : targetNpcs === null ? null : JSON.stringify(targetNpcs),
            }
          : t,
      ),
    );
  }

  function downloadTemplate() {
    // Seed the template with the current tiles so the admin edits in-place. Emits every column
    // in TILE_CSV_COLUMNS order so a round-trip preserves kill/timed/collection config.
    const header = TILE_CSV_COLUMNS.join(',');
    const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const jsonNames = (v: string | null | undefined): string => {
      if (!v) return '';
      try {
        const arr = JSON.parse(v) as string[];
        return Array.isArray(arr) ? arr.join('|') : '';
      } catch {
        return '';
      }
    };
    // Lossless round-trip: collection items emit "Name#id:count" (id pins it even if the name
    // is an untradeable the importer couldn't resolve); simple-drop pools emit bare ids.
    const itemsCell = (t: Tile): string => {
      if (t.itemRequirements) {
        try {
          const reqs = JSON.parse(t.itemRequirements) as { itemId: number; name: string; requiredAmount: number }[];
          if (Array.isArray(reqs) && reqs.length) {
            return reqs
              .map((r) => {
                const labelled = r.name && !/^Item #\d+$/.test(r.name) ? `${r.name}#${r.itemId}` : `${r.itemId}`;
                return `${labelled}:${r.requiredAmount}`;
              })
              .join('; ');
          }
        } catch {
          /* ignore malformed JSON */
        }
      }
      if (t.trackedItemIds) {
        try {
          const ids = JSON.parse(t.trackedItemIds) as number[];
          if (Array.isArray(ids) && ids.length) return ids.map(String).join('; ');
        } catch {
          /* ignore malformed JSON */
        }
      }
      return '';
    };
    const lines = localTiles.map((t) =>
      [
        escape(t.label ?? ''),
        escape(t.description ?? ''),
        t.tileType ?? 'standard',
        String(t.points ?? 1),
        escape(t.category ?? ''),
        t.optional ? 'true' : 'false',
        t.requiredAmount != null ? String(t.requiredAmount) : '',
        escape(t.trackedStat ?? ''),
        escape(t.statType ?? ''),
        t.statGoal != null ? String(t.statGoal) : '',
        escape(jsonNames(t.targetNpcs)),
        escape(t.timedActivity ?? ''),
        t.timeThresholdSeconds != null ? String(t.timeThresholdSeconds) : '',
        escape(itemsCell(t)),
      ].join(','),
    );
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-tiles.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportMsg(null);
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = parseTileCsv(text);
      if (parsed.error) {
        setImportMsg({ type: 'error', text: parsed.error });
        return;
      }
      const rows = parsed.rows;

      const res = await fetch(`/api/events/${event.id}/tiles/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImportMsg({ type: 'error', text: data.error || 'Import failed' });
        return;
      }
      const bits: string[] = [];
      if (data.applied) bits.push(`updated ${data.applied}`);
      if (data.created) bits.push(`added ${data.created} new`);
      if (!bits.length) bits.push('no tiles changed');
      setImportMsg({
        type: 'success',
        text: `Import complete — ${bits.join(', ')}${data.ignored ? ` · ${data.ignored} extra row(s) ignored` : ''}.`,
      });
      // Pull the fresh tile set so both updated and newly-created tiles render immediately.
      try {
        const refreshed = await fetch(`/api/events/${event.id}/tiles`);
        if (refreshed.ok) {
          const fresh = (await refreshed.json()) as Tile[];
          setLocalTiles([...fresh].sort((a, b) => a.position - b.position));
          setSearch('');
          setKindFilter('all');
        }
      } catch {
        /* ignore — router.refresh below still re-syncs server data */
      }
      router.refresh();
    } catch {
      setImportMsg({ type: 'error', text: 'Could not read the CSV file.' });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* CSV import */}
      <div className="border border-card-border rounded-xl p-5 bg-card-bg">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span className="w-1 h-5 bg-gold rounded-full" />
            Bulk Import
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadTemplate}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-card-border text-text-muted hover:text-foreground hover:border-gold/40 transition-colors"
            >
              Download template CSV
            </button>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleImportFile} className="hidden" />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25 transition-colors disabled:opacity-50"
            >
              {importing ? 'Importing…' : 'Upload CSV'}
            </button>
          </div>
        </div>
        <p className="text-xs text-text-muted leading-relaxed">
          Configure many tiles at once — ideal for Leagues-style boards. Rows map onto tiles by order
          (row 1 → tile #1). Columns: <span className="text-gold">{TILE_CSV_COLUMNS.join(', ')}</span>.
          {dynamicBoard && !eventStarted
            ? ' Extra rows beyond the current tiles are added as new tiles (up to 1000).'
            : ' Extra rows beyond the board size are ignored.'}
          {eventStarted && ' Event has started — label, type and required amount are locked and will be skipped.'}
        </p>
        {importMsg && (
          <p className={`text-sm mt-3 ${importMsg.type === 'success' ? 'text-accent-green-light' : 'text-red-400'}`}>
            {importMsg.text}
          </p>
        )}
      </div>

      {/* Per-tile configuration */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span className="w-1 h-5 bg-gold rounded-full" />
            Tile Configuration
            <span className="text-xs text-text-muted font-normal">({localTiles.length})</span>
          </h2>
          {dynamicBoard && (
            <button
              onClick={handleAddTile}
              disabled={adding || eventStarted}
              title={eventStarted ? 'Tiles are locked after the event starts' : undefined}
              className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {adding ? 'Adding…' : '+ Add tile'}
            </button>
          )}
        </div>

        {/* Search + kind filter */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tiles by label, category, stat, or #position…"
              className="w-full pl-3 pr-8 py-2 bg-brown-dark border border-card-border rounded-lg text-sm text-foreground placeholder:text-text-muted/60 focus:border-gold/50 focus:outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 grid place-items-center rounded text-text-muted hover:text-foreground"
              >
                &times;
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            {KIND_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setKindFilter(f.key)}
                className={`shrink-0 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                  kindFilter === f.key
                    ? 'bg-gold/20 border-gold text-gold'
                    : 'border-card-border text-text-muted hover:border-gold/40'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-text-muted mb-3">
          {filteredTiles.length === localTiles.length
            ? `Showing all ${localTiles.length} tile${localTiles.length !== 1 ? 's' : ''}`
            : `${filteredTiles.length} of ${localTiles.length} tiles match`}
          {filteredTiles.length > visibleTiles.length && ` · displaying first ${visibleTiles.length}`}
        </p>

        {filteredTiles.length === 0 ? (
          <div className="border border-card-border rounded-xl p-8 bg-card-bg text-center text-sm text-text-muted">
            No tiles match your search.
          </div>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {visibleTiles.map((tile) => {
            const k = tileKind(tile);
            const isEditing = editingTileId === tile.id;
            return (
              <button
                key={tile.id}
                onClick={() => setEditingTileId(tile.id)}
                className={`text-left border rounded-xl p-3 bg-card-bg hover:bg-card-bg-hover transition-colors flex flex-col gap-1.5 ${
                  isEditing ? 'border-gold ring-1 ring-gold/40' : 'border-card-border hover:border-gold/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-text-muted shrink-0">#{tile.position + 1}</span>
                  <div className="flex items-center gap-1 flex-wrap justify-end">
                    {pointsMode && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-purple-500/20 text-purple-300">
                        {tile.points ?? 1} pt{(tile.points ?? 1) !== 1 ? 's' : ''}
                      </span>
                    )}
                    {tile.optional ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-yellow-500/20 text-yellow-400">
                        Optional
                      </span>
                    ) : null}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${k.cls}`}>{k.label}</span>
                  </div>
                </div>
                <span className="text-sm font-semibold text-foreground truncate">{tile.label}</span>
                <span className="text-xs text-text-muted truncate">{tileMeta(tile)}</span>
              </button>
            );
          })}
        </div>
        )}

        {filteredTiles.length > visibleTiles.length && (
          <div className="mt-4 text-center">
            <button
              onClick={() => setVisibleLimit((n) => n + PAGE_SIZE)}
              className="text-sm font-semibold px-4 py-2 rounded-lg bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25 transition-colors"
            >
              Show {Math.min(PAGE_SIZE, filteredTiles.length - visibleTiles.length)} more
            </button>
          </div>
        )}
      </div>

      {/* Configuration drawer */}
      {editingTile && (
        <TileConfigDrawer
          key={editingTile.id}
          tile={editingTile}
          eventId={event.id}
          eventStarted={eventStarted}
          pointsMode={pointsMode}
          canDelete={canEditTileSet}
          onClose={() => setEditingTileId(null)}
          onDelete={() => handleDeleteTile(editingTile.id)}
          onSaved={(updated) => {
            handleTileConfigSaved(editingTile.id, updated);
            setEditingTileId(null);
          }}
        />
      )}
    </div>
  );
}

// How many tiles to render per page — Leagues boards can import 500-1000 tiles, so the
// grid is paginated to keep the DOM light. Search/filter narrows before this cap applies.
const PAGE_SIZE = 120;

type TileKindKey = 'standard' | 'skill' | 'boss' | 'drop' | 'collection' | 'kill' | 'timed';
type KindFilter = 'all' | TileKindKey;

// Derive the single canonical "kind" from the stored columns (mirrors TileTrackingConfig).
function tileKindKey(tile: Tile): TileKindKey {
  if (tile.tileType === 'kill') return 'kill';
  if (tile.tileType === 'timed') return 'timed';
  if (tile.tileType === 'drop') {
    const isCollection = !!tile.itemRequirements && tile.itemRequirements !== '[]' && tile.itemRequirements !== 'null';
    return isCollection ? 'collection' : 'drop';
  }
  if (tile.statType === 'skill') return 'skill';
  if (tile.statType === 'boss') return 'boss';
  return 'standard';
}

const KIND_META: Record<TileKindKey, { label: string; cls: string }> = {
  standard: { label: 'Standard', cls: 'bg-gold/15 text-gold' },
  skill: { label: 'Skill', cls: 'bg-blue-500/20 text-blue-300' },
  boss: { label: 'Boss KC', cls: 'bg-purple-500/20 text-purple-300' },
  drop: { label: 'Drop', cls: 'bg-accent-green/20 text-accent-green-light' },
  collection: { label: 'Collection', cls: 'bg-accent-green/20 text-accent-green-light' },
  kill: { label: 'Kill count', cls: 'bg-red-500/20 text-red-300' },
  timed: { label: 'Timed', cls: 'bg-cyan-500/20 text-cyan-300' },
};

const tileKind = (tile: Tile) => KIND_META[tileKindKey(tile)];

const KIND_FILTERS: { key: KindFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'standard', label: 'Standard' },
  { key: 'skill', label: 'Skill' },
  { key: 'boss', label: 'Boss' },
  { key: 'drop', label: 'Drop' },
  { key: 'collection', label: 'Collection' },
  { key: 'kill', label: 'Kill' },
  { key: 'timed', label: 'Timed' },
];

/** One-line summary of a tile's current configuration, shown under the label on each card. */
function tileMeta(tile: Tile): string {
  switch (tileKindKey(tile)) {
    case 'collection': {
      let count = 0;
      try {
        count = (JSON.parse(tile.itemRequirements || '[]') as unknown[]).length;
      } catch {
        /* ignore */
      }
      return `Collection · ${count} item${count !== 1 ? 's' : ''}`;
    }
    case 'drop':
      return tile.requiredAmount ? `Required: ${tile.requiredAmount}` : 'Item drop';
    case 'skill':
    case 'boss': {
      const goal = tile.statGoal ? ` · goal ${tile.statGoal.toLocaleString()}` : '';
      return `${tile.trackedStat}${goal} · ${tile.trackingMode}`;
    }
    case 'kill':
      return tile.requiredAmount ? `Kill count · ${tile.requiredAmount}` : 'Kill count';
    case 'timed':
      return tile.timeThresholdSeconds ? `Timed · under ${tile.timeThresholdSeconds}s` : 'Timed clear';
    default:
      return 'Manual tile — no auto-tracking';
  }
}

interface DrawerProps {
  tile: Tile;
  eventId: number;
  eventStarted: boolean;
  pointsMode: boolean;
  canDelete?: boolean;
  onClose: () => void;
  onDelete?: () => void;
  onSaved: Parameters<typeof TileTrackingConfig>[0]['onSaved'];
}

function TileConfigDrawer({ tile, eventId, eventStarted, pointsMode, canDelete, onClose, onDelete, onSaved }: DrawerProps) {
  const ref = useModalA11y<HTMLDivElement>({ onClose });
  const titleId = `tile-config-title-${tile.id}`;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-drawer-fade"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative h-full w-full max-w-md bg-card-bg border-l border-card-border shadow-2xl flex flex-col focus:outline-none animate-drawer-slide"
      >
        {/* Header */}
        <div className="shrink-0 bg-card-bg border-b border-card-border px-5 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-text-muted">Tile #{tile.position + 1}</p>
            <h3 id={titleId} className="text-base font-bold text-foreground truncate">
              {tile.label}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close configuration"
            className="shrink-0 w-8 h-8 grid place-items-center rounded-lg border border-card-border text-text-muted hover:text-foreground hover:border-gold/40 transition-colors text-lg leading-none"
          >
            &times;
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 min-h-0 p-5 overflow-y-auto">
          <TileTrackingConfig
            tileId={tile.id}
            eventId={eventId}
            initial={{
              label: tile.label,
              description: tile.description ?? null,
              tileType: tile.tileType || 'standard',
              requiredAmount: tile.requiredAmount ?? null,
              trackedStat: tile.trackedStat ?? null,
              statType: tile.statType ?? null,
              statGoal: tile.statGoal ?? null,
              trackingMode: tile.trackingMode || 'team',
              optional: !!tile.optional,
              trackedItemIds: tile.trackedItemIds ? JSON.parse(tile.trackedItemIds) : null,
              itemRequirements: tile.itemRequirements ? JSON.parse(tile.itemRequirements) : null,
              points: tile.points ?? 1,
              category: tile.category ?? null,
              sourceNpcs: tile.sourceNpcs ? JSON.parse(tile.sourceNpcs) : null,
              targetNpcs: tile.targetNpcs ? JSON.parse(tile.targetNpcs) : null,
              timedActivity: tile.timedActivity ?? null,
              timeThresholdSeconds: tile.timeThresholdSeconds ?? null,
            }}
            onSaved={onSaved}
            eventStarted={eventStarted}
            pointsMode={pointsMode}
          />

          {canDelete && onDelete && (
            <div className="mt-5 pt-4 border-t border-card-border">
              {confirmingDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted flex-1">Delete this tile permanently?</span>
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    disabled={deleting}
                    className="text-xs px-3 py-1.5 rounded-lg border border-card-border text-text-muted hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setDeleting(true);
                      onDelete();
                    }}
                    disabled={deleting}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/40 text-red-300 hover:bg-red-500/25 transition-colors disabled:opacity-50"
                  >
                    {deleting ? 'Deleting…' : 'Delete tile'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingDelete(true)}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Delete this tile
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
