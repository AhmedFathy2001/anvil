'use client';

import { useEffect, useState } from 'react';
import type { ItemRequirement } from '@/lib/types';
import { parseJsonArray } from '@/lib/tileKinds';

// Structural tile shape — the board clients each carry their own narrowed Tile interface.
export interface TileTargetsLike {
  id: number;
  tileType?: string | null;
  requiredAmount?: number | null;
  trackedItemIds?: string | number[] | null;
  itemRequirements?: string | null;
  sourceNpcs?: string | string[] | null;
  targetNpcs?: string | string[] | null;
  timedActivity?: string | null;
  timeThresholdSeconds?: number | null;
  partySize?: number | null;
}

// Member-facing, read-only summary of WHAT a tile tracks — the items/NPCs/raid/caps an admin
// configured. Members never search or edit here; this just renders what's stored on the tile
// row (drop/gain tiles store bare item IDs, resolved to names via /api/items/names).

function secondsToClock(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m}:${s.toString().padStart(2, '0')}`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 text-xs">
      <span className="text-text-muted shrink-0">{label}:</span>
      <span className="text-foreground min-w-0">{children}</span>
    </div>
  );
}

function NameChips({ names }: { names: string[] }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {names.map((n) => (
        <span key={n} className="px-1.5 py-0.5 rounded bg-brown-dark border border-card-border/60 text-foreground/90">
          {n}
        </span>
      ))}
    </span>
  );
}

interface Props {
  tile: TileTargetsLike;
  // Suppress the item list when the caller already renders per-item progress (team boards),
  // so items aren't listed twice. Source/party/raid rows still show.
  hideItems?: boolean;
}

export default function TileTargets({ tile, hideItems }: Props) {
  const trackedIds = parseJsonArray<number>(tile.trackedItemIds);
  const needsNames = !hideItems && trackedIds.length > 0 && (tile.tileType === 'drop' || tile.tileType === 'gain') && !tile.itemRequirements;
  const [itemNames, setItemNames] = useState<string[] | null>(null);

  useEffect(() => {
    if (!needsNames) return;
    let cancelled = false;
    fetch(`/api/items/names?ids=${trackedIds.join(',')}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: { id: number; name: string }[]) => {
        if (!cancelled) setItemNames(rows.map((r) => r.name));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tile.id]);

  const rows: React.ReactNode[] = [];
  const sourceNpcs = parseJsonArray<string>(tile.sourceNpcs);
  const targetNpcs = parseJsonArray<string>(tile.targetNpcs);
  const requirements: ItemRequirement[] = tile.itemRequirements
    ? (() => {
        try {
          const v = JSON.parse(tile.itemRequirements);
          return Array.isArray(v) ? v : [];
        } catch {
          return [];
        }
      })()
    : [];

  const kind = tile.tileType;

  if ((kind === 'drop' || kind === 'gain') && !hideItems) {
    if (requirements.length > 0) {
      // Collection: named per-item requirements, possibly grouped into "any one set" alternatives.
      const ungrouped = requirements.filter((r) => !r.group?.trim());
      const groups = new Map<string, ItemRequirement[]>();
      for (const r of requirements) {
        const g = r.group?.trim();
        if (!g) continue;
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g)!.push(r);
      }
      const fmt = (list: ItemRequirement[]) =>
        list.map((r) => (r.requiredAmount > 1 ? `${r.name} ×${r.requiredAmount}` : r.name));
      if (ungrouped.length > 0) {
        rows.push(<Row key="items" label={groups.size > 0 ? 'Always required' : 'Items'}><NameChips names={fmt(ungrouped)} /></Row>);
      }
      for (const [g, list] of groups) {
        rows.push(<Row key={`set-${g}`} label={`Set — ${g}`}><NameChips names={fmt(list)} /></Row>);
      }
    } else if (trackedIds.length > 0) {
      rows.push(
        <Row key="items" label={kind === 'gain' ? 'Counts gains of' : 'Any of'}>
          {itemNames ? <NameChips names={itemNames} /> : <span className="text-text-muted">Loading…</span>}
        </Row>,
      );
    }
  }

  if (kind === 'drop' || kind === 'value' || kind === 'valuetotal') {
    if (sourceNpcs.length > 0) rows.push(<Row key="src" label="Only from"><NameChips names={sourceNpcs} /></Row>);
  }
  if (kind === 'drop' && tile.timeThresholdSeconds) {
    rows.push(<Row key="party" label="Party size">exactly {tile.timeThresholdSeconds}</Row>);
  }

  if (kind === 'kill' && targetNpcs.length > 0) {
    rows.push(<Row key="npcs" label="Counts kills of"><NameChips names={targetNpcs} /></Row>);
  }
  if (kind === 'pvp' && targetNpcs.length > 0) {
    // Selectors: 'any' = any player, 'team:other' = any rival team member, 'rsn:<name>' = named bounty.
    const bounties = targetNpcs.filter((s) => s.startsWith('rsn:')).map((s) => s.slice(4));
    const anyone = targetNpcs.includes('any');
    rows.push(
      <Row key="pvp" label="Counts kills of">
        {anyone ? 'any player' : bounties.length > 0 ? <NameChips names={bounties} /> : 'any rival team member'}
      </Row>,
    );
  }
  if (kind === 'diary' && targetNpcs.length > 0) {
    rows.push(<Row key="diaries" label="Diaries"><NameChips names={targetNpcs} /></Row>);
  }
  if (kind === 'ca' && targetNpcs.length > 0) {
    rows.push(<Row key="tasks" label="Tasks"><NameChips names={targetNpcs} /></Row>);
  }

  if (kind === 'timed' && tile.timedActivity) {
    rows.push(
      <Row key="timed" label="Activity">
        {tile.timedActivity}
        {tile.timeThresholdSeconds ? ` — clear in ≤ ${secondsToClock(tile.timeThresholdSeconds)}` : ''}
      </Row>,
    );
    if (tile.partySize) {
      rows.push(<Row key="tparty" label="Party size">exactly {tile.partySize}</Row>);
    }
  }

  if (kind === 'deathless') {
    if (tile.timedActivity) rows.push(<Row key="raid" label="Raid">{tile.timedActivity} — zero party deaths</Row>);
    if (tile.timeThresholdSeconds) rows.push(<Row key="dparty" label="Party size">exactly {tile.timeThresholdSeconds}</Row>);
    if (tile.requiredAmount && tile.requiredAmount > 1) rows.push(<Row key="runs" label="Runs needed">{tile.requiredAmount}</Row>);
  }

  if (kind === 'lms') {
    if (tile.timeThresholdSeconds) rows.push(<Row key="lms" label="Placement">top {tile.timeThresholdSeconds}</Row>);
    if (tile.requiredAmount && tile.requiredAmount > 1) rows.push(<Row key="games" label="Games needed">{tile.requiredAmount}</Row>);
  }

  if ((kind === 'value' || kind === 'valuetotal') && tile.requiredAmount) {
    rows.push(
      <Row key="gp" label={kind === 'valuetotal' ? 'Total loot worth' : 'Single haul worth'}>
        ≥ {tile.requiredAmount.toLocaleString()} gp
      </Row>,
    );
  }

  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg border border-card-border/60 bg-brown-dark/40 px-3 py-2 space-y-1.5">
      <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">What counts</p>
      {rows}
    </div>
  );
}
