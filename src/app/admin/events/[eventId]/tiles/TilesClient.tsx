'use client';

import type { Event, Tile } from '@/lib/types';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import TileTrackingConfig from '@/components/TileTrackingConfig';
import { isPointsMode } from '@/lib/utils';
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

  const pointsMode = isPointsMode(event.scoringMode);
  const eventStarted = !!event.startDate && new Date(event.startDate) <= new Date();

  // Derive the single "kind" badge from the stored columns (mirrors TileTrackingConfig).
  function tileKind(tile: Tile): { label: string; cls: string } {
    if (tile.tileType === 'drop') {
      const isCollection = !!tile.itemRequirements && tile.itemRequirements !== '[]' && tile.itemRequirements !== 'null';
      return isCollection
        ? { label: 'Collection', cls: 'bg-accent-green/20 text-accent-green-light' }
        : { label: 'Drop', cls: 'bg-accent-green/20 text-accent-green-light' };
    }
    if (tile.statType === 'skill') return { label: 'Skill', cls: 'bg-blue-500/20 text-blue-300' };
    if (tile.statType === 'boss') return { label: 'Boss KC', cls: 'bg-purple-500/20 text-purple-300' };
    return { label: 'Standard', cls: 'bg-gold/15 text-gold' };
  }

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
    },
  ) {
    const { trackedItemIds, itemRequirements, sourceNpcs, optional: updatedOptional, ...rest } = updated;
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
            }
          : t,
      ),
    );
  }

  function downloadTemplate() {
    // Seed the template with the current tile labels so the admin edits in-place.
    const header = TILE_CSV_COLUMNS.join(',');
    const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
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
      setImportMsg({
        type: 'success',
        text: `Imported ${data.applied} tile${data.applied !== 1 ? 's' : ''}${data.ignored ? ` · ${data.ignored} extra row(s) ignored` : ''}.`,
      });
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
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
          <span className="w-1 h-5 bg-gold rounded-full" />
          Tile Configuration
          <span className="text-xs text-text-muted font-normal">({localTiles.length})</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {localTiles.map((tile) => (
            <div key={tile.id} className="border border-card-border rounded-xl p-3 bg-card-bg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold truncate">{tile.label}</span>
                <div className="flex items-center gap-1.5">
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
                  {(() => {
                    const k = tileKind(tile);
                    return <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${k.cls}`}>{k.label}</span>;
                  })()}
                  <span className="text-xs text-text-muted">#{tile.position + 1}</span>
                </div>
              </div>
              {tile.description && <p className="text-xs text-text-muted mb-1 line-clamp-2">{tile.description}</p>}
              {tile.tileType === 'drop' && tile.requiredAmount && (
                <p className="text-xs text-accent-green-light mb-1">Required: {tile.requiredAmount}</p>
              )}
              {tile.trackedStat ? (
                <div className="text-xs text-text-muted mb-2">
                  <span className="text-gold">{tile.trackedStat}</span>
                  {tile.statGoal && <span className="ml-1">(goal: {tile.statGoal.toLocaleString()})</span>}
                  <span className="ml-1">[{tile.trackingMode}]</span>
                </div>
              ) : (
                <p className="text-xs text-text-muted mb-2">No stat tracked</p>
              )}
              <button
                onClick={() => setEditingTileId(editingTileId === tile.id ? null : tile.id)}
                className="text-xs text-gold hover:text-gold-light transition-colors underline decoration-gold/30 underline-offset-2"
              >
                {editingTileId === tile.id ? 'Close' : 'Configure'}
              </button>
              {editingTileId === tile.id && (
                <div className="mt-3 pt-3 border-t border-card-border">
                  <TileTrackingConfig
                    tileId={tile.id}
                    eventId={event.id}
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
                    }}
                    onSaved={(updated) => handleTileConfigSaved(tile.id, updated)}
                    eventStarted={eventStarted}
                    pointsMode={pointsMode}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
