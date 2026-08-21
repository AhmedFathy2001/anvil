'use client';

import type { Event, Tile, ItemRequirement } from '@/lib/types';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import TileTrackingConfig from '@/components/TileTrackingConfig';
import ClogGenerator from './ClogGenerator';
import BoardBalancePanel from './BoardBalancePanel';
import TileHistoryPanel from './TileHistoryPanel';
import SkillTileGenerator from './SkillTileGenerator';
import BossTileGenerator from './BossTileGenerator';
import LibraryTileGenerator from './LibraryTileGenerator';
import ScheduleView from './ScheduleView';
import RotationView from './RotationView';
import ActionMenu from '@/components/ActionMenu';
import Link from 'next/link';
import ManualOnlyBadge from '@/components/ManualOnlyBadge';
import { isManualOnlyDropTile } from '@/lib/clogManual';
import Select from '@/components/Select';
import Input from '@/components/Input';
import { useModalA11y } from '@/hooks/useModalA11y';
import { isPointsMode, isTileRaceFormat } from '@/lib/utils';
import { parseEventRules, hasRevealPolicy, boardTiles, missionTiles, parseTileMissionRules } from '@/lib/eventRules';
import EventBoard from '@/components/EventBoard';
import {
  TILE_KIND_FILTERS,
  tileConfigSummary,
  tileKindBadge,
  tileKindKey,
  type TileKindKey,
} from '@/lib/tileKinds';
import { authoringModel, unfinishedFormatJob, type AuthoringView } from '@/lib/tileAuthoring';
import { findBoardProblems } from '@/lib/boardMisconfig';
import { TILE_CSV_COLUMNS, parseTileCsv, tileToCsvCells, tileToCsvRow } from '@/lib/csvTiles';
import { tileTierKey, tileCategories, tileHasCategory, tierColor, DEFAULT_TIER_BANDS, type TierBand } from '@/lib/tileFilter';

// Map a stored Tile to TileTrackingConfig's `initial` shape. Shared by the drawer (Cards view)
// and the Quick Build two-pane editor so both drive the exact same complete config form.
function tileToTrackingInitial(tile: Tile) {
  return {
    label: tile.label,
    description: tile.description ?? null,
    tileType: tile.tileType || 'standard',
    requiredAmount: tile.requiredAmount ?? null,
    trackedStat: tile.trackedStat ?? null,
    statType: tile.statType ?? null,
    statGoal: tile.statGoal ?? null,
    statBasis: tile.statBasis ?? 'gain',
    trackingMode: tile.trackingMode || 'team',
    optional: !!tile.optional,
    autoTrackDisabled: !!tile.autoTrackDisabled,
    trackedItemIds: tile.trackedItemIds ? (JSON.parse(tile.trackedItemIds) as number[]) : null,
    itemRequirements: tile.itemRequirements
      ? (JSON.parse(tile.itemRequirements) as ItemRequirement[])
      : null,
    // Without this the set controls reloaded on 'any' and the next save silently flipped an
    // "every set" collection back to any-one-set.
    groupMode: tile.groupMode ?? null,
    perKillCap: tile.perKillCap ?? null,
    coopCredit: tile.coopCredit ?? null,
    coopMinMembers: tile.coopMinMembers ?? null,
    points: tile.points ?? 1,
    category: tile.category ?? null,
    sourceNpcs: tile.sourceNpcs ? (JSON.parse(tile.sourceNpcs) as string[]) : null,
    targetNpcs: tile.targetNpcs ? (JSON.parse(tile.targetNpcs) as string[]) : null,
    timedActivity: tile.timedActivity ?? null,
    timeThresholdSeconds: tile.timeThresholdSeconds ?? null,
    // Timed raids keep their party size in its own column (deathless/drop ride
    // timeThresholdSeconds). Without this the editor reloaded blank and the next save nulled it.
    partySize: tile.partySize ?? null,
    pvpMinLootValue: tile.pvpMinLootValue ?? null,
    mission: !!tile.mission,
    missionRules: tile.rules ? parseTileMissionRules(tile.rules) : null,
    updatedAt: tile.updatedAt ?? null,
  };
}

// Text match for the tile search box — label, category, stat, description, or exact #position.
// Shared by the Cards filter and the Quick Build left-pane search so both behave identically.
// `q` is expected already trimmed + lowercased by the caller.
function tileMatchesQuery(t: Tile, q: string): boolean {
  if (!q) return true;
  return (
    !!t.label?.toLowerCase().includes(q) ||
    !!t.category?.toLowerCase().includes(q) ||
    !!t.trackedStat?.toLowerCase().includes(q) ||
    !!t.description?.toLowerCase().includes(q) ||
    String(t.position + 1) === q.replace(/^#/, '')
  );
}

interface Props {
  event: Event;
  tiles: Tile[];
  tierBands?: TierBand[];
  /** Current user is an admin — gates the admin-only live-event tile override. */
  isAdmin?: boolean;
  /** Event has real multi-person teams — false on an individual ladder (see the tiles page). */
  teamPlay?: boolean;
  /** Missions are enabled for this event and meaningful on this format (see the tiles page). */
  missionsAllowed?: boolean;
  // Finished event, not unlocked (lib/eventLock): the API refuses tile mutations, so the whole
  // authoring surface renders disabled.
  editLocked?: boolean;
}

/**
 * True on screens wide enough to keep the tile list AND its editor on screen at once.
 * SSR renders false, so the first paint is the phone layout and never a mismatched desktop one.
 */
function useHasRoomForInspector(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)');
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return wide;
}

export default function TilesClient({ event, tiles, tierBands = DEFAULT_TIER_BANDS, isAdmin = false, editLocked = false, teamPlay = true, missionsAllowed = true }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  // The board itself, so the header's Quick build shortcut can jump straight to it.
  const boardRef = useRef<HTMLDivElement>(null);
  const [localTiles, setLocalTiles] = useState<Tile[]>([...tiles].sort((a, b) => a.position - b.position));
  const [editingTileId, setEditingTileId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [savingToLibrary, setSavingToLibrary] = useState(false);
  // Which generator dialog the Add tiles menu has open, if any.
  const [generator, setGenerator] = useState<'clog' | 'skill' | 'boss' | 'library' | null>(null);
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [adding, setAdding] = useState(false);
  const [reordering, setReordering] = useState(false);
  // What authoring THIS board involves — which views it offers, what its entries are called, and
  // what its format still needs from you (lib/tileAuthoring). Everything below asks the model
  // rather than re-deriving "is this a bingo?" from the columns.
  const model = useMemo(() => authoringModel(event), [event]);
  // views[0] is the format's home: a square and a track carry their meaning in their layout, so
  // editing them as a vertical list hides the one thing that makes them what they are. A pool has
  // no geometry to show, so it opens on the list.
  const [viewMode, setViewMode] = useState<AuthoringView>(() => model.views[0]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  // Multi-select for bulk edits. Shift-click extends from the last tile you touched, so "these
  // twenty are all worth 5" is one gesture rather than twenty drawers. Only the fields that are
  // safe to change on a live board are offered (see the bulk route).
  const inspectorDocked = useHasRoomForInspector();
  // What can't credit as configured (lib/boardMisconfig) — the same check the live board's
  // "fix something" panel runs, surfaced here while you're still authoring.
  const problemTileIds = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of findBoardProblems(localTiles, { pointsMode: isPointsMode(event.scoringMode) })) {
      if (p.severity === 'broken' && !map.has(p.tileId)) map.set(p.tileId, p.problem);
    }
    return map;
  }, [localTiles, event.scoringMode]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [lastPickedId, setLastPickedId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState('');

  // ?tile=<id> opens straight into that tile's editor. It's how the live board's "fix something"
  // panel hands you the misconfigured tile — landing on a 150-tile list and hunting for #48 is the
  // difference between fixing it now and fixing it later.
  const searchParams = useSearchParams();
  const requestedTileId = searchParams.get('tile');
  const openedFromUrl = useRef(false);
  useEffect(() => {
    if (openedFromUrl.current || !requestedTileId) return;
    const id = parseInt(requestedTileId, 10);
    if (!Number.isFinite(id)) return;
    openedFromUrl.current = true;
    setViewMode('cards');
    setEditingTileId(id);
  }, [requestedTileId]);

  const pointsMode = isPointsMode(event.scoringMode);
  const eventStarted = !!event.startDate && new Date(event.startDate) <= new Date();

  // Reveal-policy events (lib/eventRules): tiles carry a hidden/scheduled/live/claimed state the
  // host needs to see at a glance; 'scheduled' events additionally edit each tile's reveal time.
  const eventRules = useMemo(() => parseEventRules(event.rules), [event.rules]);
  const revealMode = hasRevealPolicy(eventRules);
  const scheduledMode = eventRules.revealPolicy === 'scheduled';

  function revealChip(tile: Tile): { label: string; cls: string; title?: string } | null {
    if (!revealMode) return null;
    if (tile.closedAt) return { label: '🎯 Claimed', cls: 'bg-red-500/20 text-red-300', title: `Claimed ${new Date(tile.closedAt).toLocaleString()}` };
    if (tile.revealedAt) return { label: '🔓 Live', cls: 'bg-accent-green/20 text-accent-green-light', title: `Revealed ${new Date(tile.revealedAt).toLocaleString()}` };
    if (scheduledMode && tile.revealAt) {
      return {
        label: `📅 ${new Date(tile.revealAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
        cls: 'bg-blue-500/20 text-blue-300',
        title: 'Scheduled reveal time',
      };
    }
    return {
      label: '🙈 Hidden',
      cls: 'bg-gray-500/20 text-gray-300',
      title: scheduledMode ? 'No reveal time set — this tile stays hidden until one is' : 'Waiting to be drawn',
    };
  }

  // Patch a tile's reveal schedule into local state after a RevealAtEditor save (this path writes
  // the PLAN only — the engine still owns when it actually flips).
  function handleRevealAtSaved(tileId: number, revealAt: string | null) {
    setLocalTiles((prev) => prev.map((t) => (t.id === tileId ? { ...t, revealAt } : t)));
    setEditingFresh((prev) => (prev && prev.id === tileId ? { ...prev, revealAt } : prev));
  }

  // An admin forced this tile open (or hid it again) — the server returns the whole row, so take
  // revealedAt/closedAt straight from it rather than guessing at the new state.
  function handleRevealStateChanged(updated: Tile) {
    const patch = { revealedAt: updated.revealedAt ?? null, closedAt: updated.closedAt ?? null };
    setLocalTiles((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...patch } : t)));
    setEditingFresh((prev) => (prev && prev.id === updated.id ? { ...prev, ...patch } : prev));
  }

  // Effort-model refetch trigger + the balance panel's one-click "apply suggested points".
  const [tilesVersion, setTilesVersion] = useState(0);
  useEffect(() => setTilesVersion((v) => v + 1), [localTiles]);
  async function applySuggestedPoints(tileId: number, points: number): Promise<boolean> {
    const res = await fetch(`/api/events/${event.id}/tiles`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tileId, points }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setImportMsg({ type: 'error', text: data.error || 'Could not update points.' });
      return false;
    }
    const updated = await res.json();
    setLocalTiles((prev) => prev.map((t) => (t.id === tileId ? { ...t, points: updated.points, updatedAt: updated.updatedAt } : t)));
    return true;
  }

  // Concurrent-edit protection. Opening a tile re-fetches it (a save then starts from the
  // latest state, not the page-load list) and takes an advisory lock so a second admin sees
  // who's already editing. A heartbeat keeps the lock alive while the editor stays open;
  // closing releases it. The lock only warns — the hard guard is the updatedAt check the
  // tiles PUT enforces, which 409s a stale save instead of clobbering.
  const [editingFresh, setEditingFresh] = useState<Tile | null>(null);
  const [lockHolder, setLockHolder] = useState<string | null>(null);
  useEffect(() => {
    if (editingTileId == null) return;
    let cancelled = false;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    setEditingFresh(null);
    setLockHolder(null);
    const lockUrl = `/api/events/${event.id}/tiles/${editingTileId}/lock`;
    const applyLock = (lock: { mine?: boolean; holder?: string } | null) => {
      if (cancelled || !lock) return;
      setLockHolder(lock.mine === false ? lock.holder ?? 'another editor' : null);
    };
    (async () => {
      const [tileRes, lockRes] = await Promise.all([
        fetch(`/api/events/${event.id}/tiles/${editingTileId}`),
        fetch(lockUrl, { method: 'POST' }),
      ]);
      if (cancelled) return;
      if (tileRes.ok) {
        const fresh = (await tileRes.json()) as Tile;
        if (cancelled) return;
        setEditingFresh(fresh);
        // Keep the list row in step so card meta/labels reflect the other admin's edits too.
        setLocalTiles((prev) => prev.map((t) => (t.id === fresh.id ? fresh : t)));
      }
      applyLock(await lockRes.json().catch(() => null));
      heartbeat = setInterval(() => {
        fetch(lockUrl, { method: 'POST' })
          .then((r) => r.json())
          .then(applyLock)
          .catch(() => {});
      }, 30_000);
    })();
    return () => {
      cancelled = true;
      if (heartbeat) clearInterval(heartbeat);
      fetch(lockUrl, { method: 'DELETE', keepalive: true }).catch(() => {});
    };
  }, [editingTileId, event.id]);

  // Only hand the editor the freshly-fetched row — the page-load list may be stale.
  /**
   * Click opens a tile; ctrl/cmd-click adds it to a selection; shift-click takes the run between
   * the last one you touched and this one. Once anything is selected, a plain click keeps
   * selecting — otherwise every attempt to add a fifth tile would slam the drawer open instead.
   */
  function pickTile(tileId: number, e: React.MouseEvent) {
    const additive = e.metaKey || e.ctrlKey;
    const ranged = e.shiftKey;

    if (ranged && lastPickedId != null) {
      const order = filteredTiles.map((t) => t.id);
      const from = order.indexOf(lastPickedId);
      const to = order.indexOf(tileId);
      if (from !== -1 && to !== -1) {
        const run = order.slice(Math.min(from, to), Math.max(from, to) + 1);
        setSelectedIds((prev) => new Set([...prev, ...run]));
        setLastPickedId(tileId);
        return;
      }
    }

    if (additive || selectedIds.size > 0) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(tileId)) next.delete(tileId);
        else next.add(tileId);
        return next;
      });
      setLastPickedId(tileId);
      return;
    }

    setLastPickedId(tileId);
    setEditingTileId(tileId);
  }

  /** Apply one field to every selected tile (points, category, optional, auto-credit, reveal). */
  async function bulkSet(set: Record<string, unknown>, describe: string) {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkBusy(true);
    setBulkMsg('');
    try {
      const res = await fetch(`/api/events/${event.id}/tiles/bulk`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tileIds: ids, set }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBulkMsg(data.error || 'That did not save.');
        return;
      }
      // revealState is a verb, not a column — the server turns it into revealedAt/closedAt, so the
      // local patch has to as well or the cards keep showing the old state until a refresh lands.
      const { revealState, ...columns } = set;
      const stateColumns =
        revealState === 'live'
          ? { revealedAt: data.updatedAt as string, closedAt: null }
          : revealState === 'hidden'
            ? { revealedAt: null, closedAt: null }
            : {};
      setLocalTiles((prev) =>
        prev.map((t) =>
          selectedIds.has(t.id)
            ? ({ ...t, ...columns, ...stateColumns, updatedAt: data.updatedAt } as Tile)
            : t,
        ),
      );
      setBulkMsg(`${describe} on ${data.updated} tile${data.updated === 1 ? '' : 's'}.`);
      router.refresh();
    } catch {
      setBulkMsg('That did not save.');
    } finally {
      setBulkBusy(false);
    }
  }

  const editingTile = editingTileId != null && editingFresh?.id === editingTileId ? editingFresh : null;
  const editingLoading = editingTileId != null && editingTile == null;
  // Leagues (bingo+points) and Tile-race boards are arbitrary-length task lists, so tiles can be
  // added/removed; a classic bingo grid is a fixed N×N square and stays locked to its size.
  const boardShape = model.axes.shape;
  // Which tiles members can't see yet, so the authoring board marks them the same way the public one
  // does — a host editing an armed board should see what is and isn't out there.
  const hiddenTileIds = useMemo(
    () => (revealMode ? new Set(localTiles.filter((t) => !t.revealedAt).map((t) => t.id)) : null),
    [revealMode, localTiles],
  );
  // The format's own unfinished business — distinct from lib/boardMisconfig, which asks whether a
  // tile can credit at all. This asks whether the board will behave the way its format promises.
  const formatJob = useMemo(() => unfinishedFormatJob(model, localTiles), [model, localTiles]);
  const poolCounts = useMemo(() => ({
    open: localTiles.filter((t) => t.revealedAt && !t.closedAt).length,
    waiting: localTiles.filter((t) => !t.revealedAt).length,
    closed: localTiles.filter((t) => t.closedAt).length,
  }), [localTiles]);
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
      setCategoryFilter('all');
      setTierFilter('all');
      setEditingTileId(data.id);
      router.refresh();
    } finally {
      setAdding(false);
    }
  }

  // Add a MISSION rather than a board tile. Same endpoint with `mission: true`, which server-side
  // skips the "a classic grid is a fixed N×N board" guard (a mission is not a cell on the grid) and
  // leaves boardSize alone, so a 5×5 stays a 5×5.
  async function handleAddMission() {
    setAdding(true);
    setImportMsg(null);
    try {
      const res = await fetch(`/api/events/${event.id}/tiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mission: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImportMsg({ type: 'error', text: data.error || 'Could not add mission.' });
        return;
      }
      setLocalTiles((prev) => [...prev, data as Tile]);
      setEditingTileId(data.id);
      router.refresh();
    } finally {
      setAdding(false);
    }
  }

  // Bulk-create N blank tiles (or one per pasted label) for the Quick Build list. Sequential so
  // each POST computes the next board position server-side without racing. Selects the first new
  // tile so the editor lands on it.
  async function bulkCreate(labels: (string | null)[]) {
    setAdding(true);
    setImportMsg(null);
    try {
      const created: Tile[] = [];
      for (const label of labels) {
        const res = await fetch(`/api/events/${event.id}/tiles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(label ? { label } : {}),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setImportMsg({ type: 'error', text: data.error || 'Could not add tiles.' });
          break;
        }
        created.push(data as Tile);
      }
      if (created.length) {
        setLocalTiles((prev) => [...prev, ...created]);
        setEditingTileId(created[0].id);
        // Freshly added "Tile N" rows won't match an active search — clear it so they show up.
        setSearch('');
      }
      router.refresh();
    } finally {
      setAdding(false);
    }
  }

  // Copy a configured tile, whole. Quick Build's actual rhythm is "set one up properly, then make
  // four more like it" — without this that means re-picking the kind, the item, the source list and
  // the points every time. The copy is made server-side from the stored row (see the tiles POST), so
  // it can't quietly miss a field this component doesn't know about.
  async function duplicateTile(tileId: number) {
    setAdding(true);
    setImportMsg(null);
    try {
      const res = await fetch(`/api/events/${event.id}/tiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duplicateOf: tileId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImportMsg({ type: 'error', text: data.error || 'Could not duplicate that tile.' });
        return;
      }
      const created = data as Tile;
      setLocalTiles((prev) => [...prev, created]);
      // Land on the copy: the next thing anyone does is edit the one difference.
      setEditingTileId(created.id);
      setSearch('');
      router.refresh();
    } finally {
      setAdding(false);
    }
  }

  function applyPasteLabels() {
    const labels = pasteText.split('\n').map((s) => s.trim()).filter(Boolean);
    setPasteOpen(false);
    setPasteText('');
    if (labels.length) void bulkCreate(labels);
  }

  // True when a tile carries anything beyond what a freshly-added blank row gets ("Tile N",
  // standard kind, 1 point, no tracking config). Deleting a blank row is friction-free;
  // deleting a configured tile deserves a warning — hours of item/set setup can hide behind
  // an innocent-looking label.
  function tileHasCustomConfig(tile: Tile): boolean {
    return !!(
      !/^Tile \d+$/.test(tile.label ?? '') ||
      tile.description ||
      (tile.tileType && tile.tileType !== 'standard') ||
      tile.requiredAmount ||
      tile.trackedStat ||
      tile.statGoal ||
      tile.trackedItemIds ||
      tile.itemRequirements ||
      tile.category ||
      tile.sourceNpcs ||
      tile.targetNpcs ||
      tile.timedActivity ||
      tile.timeThresholdSeconds ||
      (tile.points != null && tile.points !== 1) ||
      tile.optional
    );
  }

  async function handleDeleteTile(tileId: number, skipConfirm = false) {
    // Configured tiles get a confirm; blank never-touched rows delete silently. The Cards
    // drawer passes skipConfirm — it runs its own two-step confirm before calling this.
    const tile = localTiles.find((t) => t.id === tileId);
    if (!skipConfirm && tile && tileHasCustomConfig(tile)) {
      const summary = [
        tileKindKey(tile) !== 'standard' ? tileKindKey(tile) : null,
        tile.points != null && tile.points !== 1 ? `${tile.points} pts` : null,
        tile.itemRequirements || tile.trackedItemIds ? 'tracked items' : null,
        tile.category ? `tagged ${tile.category}` : null,
      ].filter(Boolean).join(', ');
      if (!confirm(`"${tile.label}" has configuration${summary ? ` (${summary})` : ''} — delete it anyway?`)) {
        return;
      }
    }
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
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);

  // Categories present on the board, for the category dropdown.
  const categories = useMemo(() => tileCategories(localTiles), [localTiles]);
  // Tiers only matter on points boards (the tier band is derived from a tile's point value).
  const showTierFilter = pointsMode && tierBands.length > 0;

  // The board and its missions are two different lists (lib/eventRules.boardTiles). A mission isn't
  // a cell on the grid: it's announced mid-event, scores as a bonus outside the board total
  // (lib/boardScoring) and can expire unclaimed. Leaving them in the main list made a mission "tile
  // #259" — buried behind the filters, counted in "259 tiles", and authored by finding a checkbox
  // under Advanced.
  const boardOnly = useMemo(() => boardTiles(localTiles), [localTiles]);
  const missionPool = useMemo(() => missionTiles(localTiles), [localTiles]);
  const announcedMissions = useMemo(() => missionPool.filter((t) => t.revealedAt).length, [missionPool]);

  const filteredTiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return boardOnly.filter((t) => {
      if (kindFilter !== 'all' && tileKindKey(t) !== kindFilter) return false;
      if (categoryFilter !== 'all' && !tileHasCategory(t.category, categoryFilter)) return false;
      if (tierFilter !== 'all' && tileTierKey(t.points, tierBands) !== tierFilter) return false;
      return tileMatchesQuery(t, q);
    });
  }, [boardOnly, search, kindFilter, categoryFilter, tierFilter, tierBands]);

  // Quick Build left-pane list honors the same search box, text-only — the kind/category/tier
  // chips live in Cards view, so applying them here would be a hidden filter. Sharing `search`
  // keeps the query alive across the Cards ⇄ Quick build toggle.
  const gridFiltering = search.trim().length > 0;
  const gridTiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? boardOnly.filter((t) => tileMatchesQuery(t, q)) : boardOnly;
  }, [boardOnly, search]);

  // Collapse back to the first page whenever the result set changes.
  useEffect(() => setVisibleLimit(PAGE_SIZE), [search, kindFilter, categoryFilter, tierFilter]);

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
      statBasis?: string | null;
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
      partySize?: number | null;
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

  // Rewrite the whole board order (positions = array index). Pre-start only, enforced
  // server-side too; feedback lands in the shared importMsg slot.
  async function applyOrder(ids: number[], successText: string) {
    setReordering(true);
    setImportMsg(null);
    try {
      const res = await fetch(`/api/events/${event.id}/tiles/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImportMsg({ type: 'error', text: data.error || 'Could not reorder tiles.' });
        return;
      }
      setImportMsg({ type: 'success', text: successText });
      await syncTilesFromServer();
      router.refresh();
    } finally {
      setReordering(false);
    }
  }

  // Quick-build drag-and-drop: the dragged tile takes the drop target's slot. Optimistic
  // local reorder for instant feedback, then the same reorder POST Shuffle uses (pre-start
  // only, enforced server-side; applyOrder re-syncs so positions always match the server).
  const [dragTileId, setDragTileId] = useState<number | null>(null);
  const [dragOverTileId, setDragOverTileId] = useState<number | null>(null);

  function handleTileDrop(targetId: number) {
    const dragged = dragTileId;
    setDragTileId(null);
    setDragOverTileId(null);
    if (dragged == null || dragged === targetId) return;
    const ids = localTiles.map((t) => t.id);
    const from = ids.indexOf(dragged);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, dragged);
    setLocalTiles((prev) => {
      const byId = new Map(prev.map((t) => [t.id, t]));
      return ids.map((id, i) => ({ ...byId.get(id)!, position: i }));
    });
    void applyOrder(ids, 'Tile order updated.');
  }

  function handleShuffle() {
    if (!confirm('Shuffle the board into a random order?')) return;
    const ids = localTiles.map((t) => t.id);
    // Fisher–Yates
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    void applyOrder(ids, 'Board shuffled into a random order.');
  }

  function handleSortByDifficulty() {
    if (!confirm('Reorder the board by difficulty — lowest point value (easiest tier) first?')) return;
    const ids = [...localTiles]
      .sort((a, b) => (a.points ?? 1) - (b.points ?? 1) || a.position - b.position)
      .map((t) => t.id);
    void applyOrder(ids, 'Board sorted by difficulty — easiest tier first.');
  }

  function downloadTemplate() {
    // Seed the template with the current tiles so the admin edits in-place. tileToCsvCells emits
    // every column in TILE_CSV_COLUMNS order so a round-trip preserves kill/timed/collection config.
    const header = TILE_CSV_COLUMNS.join(',');
    const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = localTiles.map((t) => tileToCsvCells(t).map(escape).join(','));
    // Empty board → ship worked examples showing the friendly formats (skill/boss by name,
    // "10m" numbers, "30:00" times, comma- or pipe-separated NPCs). Delete/replace before import.
    if (lines.length === 0) {
      const examples: string[][] = [
        ['10M Mining XP', '', 'standard', '10', 'Skilling', 'false', '', 'Mining', '', '10m', '', '', '', ''],
        ['50 Zulrah KC', '', 'standard', '8', 'Zulrah', 'false', '', 'Zulrah', '', '50', '', '', '', ''],
        ['Any Bandos unique', '', 'drop', '15', 'GWD', 'false', '3', '', '', '', '', '', '', 'Bandos chestplate; Bandos tassets; Bandos boots'],
        ['Kill 100 cows', '', 'kill', '3', 'Skilling', 'false', '100', '', '', '', 'Cow, Cow calf', '', '', ''],
        ['Sub-30 Inferno', '', 'timed', '50', 'Inferno', 'false', '', '', '', '', '', 'Inferno', '30:00', ''],
      ];
      lines.push(...examples.map((cells) => cells.map(escape).join(',')));
    }
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
      // The downloaded .xlsx workbook uploads as-is (its Tiles sheet is parsed server-side,
      // where exceljs lives); CSVs parse right here. Both feed the same import rows.
      let res: Response;
      if (/\.xlsx$/i.test(file.name)) {
        const form = new FormData();
        form.append('file', file);
        res = await fetch(`/api/events/${event.id}/tiles/import`, { method: 'POST', body: form });
      } else {
        const text = await file.text();
        const parsed = parseTileCsv(text);
        if (parsed.error) {
          setImportMsg({ type: 'error', text: parsed.error });
          return;
        }
        res = await fetch(`/api/events/${event.id}/tiles/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: parsed.rows }),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImportMsg({ type: 'error', text: data.error || 'Import failed' });
        return;
      }
      const bits: string[] = [];
      if (data.applied) bits.push(`updated ${data.applied}`);
      if (data.created) bits.push(`added ${data.created} new`);
      if (!bits.length) bits.push(data.unchanged ? 'board already matches the sheet — nothing to change' : 'no tiles changed');
      setImportMsg({
        type: 'success',
        text: `Import complete — ${bits.join(', ')}${data.ignored ? ` · ${data.ignored} extra row(s) ignored` : ''}.`,
      });
      // Pull the fresh tile set so both updated and newly-created tiles render immediately.
      await syncTilesFromServer();
    } catch {
      setImportMsg({ type: 'error', text: 'Could not read the file.' });
    } finally {
      setImporting(false);
    }
  }

  // Re-fetch the whole tile set after a bulk operation (CSV import, clog generation) that returns
  // counts rather than the created rows, so both updated and new tiles render immediately. Clears
  // filters so freshly-added tiles aren't hidden. router.refresh() re-syncs the server component too.
  async function syncTilesFromServer() {
    try {
      const refreshed = await fetch(`/api/events/${event.id}/tiles`);
      if (refreshed.ok) {
        const fresh = (await refreshed.json()) as Tile[];
        setLocalTiles([...fresh].sort((a, b) => a.position - b.position));
        setSearch('');
        setKindFilter('all');
        setCategoryFilter('all');
        setTierFilter('all');
      }
    } catch {
      /* ignore — router.refresh below still re-syncs server data */
    }
    router.refresh();
  }

  async function handleClogCreated(summary: { created: number; ignored: number; activity: string }) {
    setImportMsg({
      type: 'success',
      text: `Added ${summary.created} tile${summary.created === 1 ? '' : 's'} from ${summary.activity}${summary.ignored ? ` · ${summary.ignored} skipped (board cap)` : ''}.`,
    });
    await syncTilesFromServer();
  }

  async function handleSkillsCreated(summary: { created: number; ignored: number; label: string }) {
    setImportMsg({
      type: 'success',
      text: `Added ${summary.created} tile${summary.created === 1 ? '' : 's'} (${summary.label})${summary.ignored ? ` · ${summary.ignored} skipped (board cap)` : ''}.`,
    });
    await syncTilesFromServer();
  }

  /**
   * Harvest: copy this board's configured tiles into the clan's task library so later boards can
   * draw from them. Placeholder tiles ("Tile 7") are skipped — they carry no task. Deliberately
   * additive and not deduped against what's already in the library: two boards can want the same
   * chase at different point values, and the library page is where duplicates get pruned.
   */
  async function addBoardToLibrary() {
    const usable = localTiles.filter((t) => t.label && !/^Tile \d+$/.test(t.label));
    if (usable.length === 0) {
      setImportMsg({ type: 'error', text: 'Nothing to add yet — this board only has placeholder tiles.' });
      return;
    }
    if (!confirm(`Add ${usable.length} tile${usable.length === 1 ? '' : 's'} from this board to the task library?`)) return;
    setSavingToLibrary(true);
    try {
      const res = await fetch('/api/admin/tile-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          sourceEventId: event.id,
          tasks: usable.map((t) => ({
            label: t.label,
            points: t.points ?? 0,
            category: t.category ?? null,
            description: t.description ?? null,
            tileType: t.tileType ?? 'standard',
            config: tileToCsvRow(t),
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImportMsg({ type: 'error', text: data.error || 'Could not add these tiles to the library.' });
        return;
      }
      setImportMsg({
        type: 'success',
        text: `Added ${data.added ?? usable.length} task${(data.added ?? usable.length) === 1 ? '' : 's'} to the library.`,
      });
    } catch {
      setImportMsg({ type: 'error', text: 'Could not add these tiles to the library.' });
    } finally {
      setSavingToLibrary(false);
    }
  }

  // One editor, rendered in one of two places: a column beside the cards when there's room, a
  // covering drawer everywhere else. Every view opens it — the grid, the track, the schedule and
  // the rotation all pick tiles, and until now only Cards rendered anything when they did.
  const renderInspector = (docked: boolean) => editingTile ? (
    <TileConfigDrawer
    docked={docked}
    noun={model.Noun}
    key={editingTile.id}
    tile={editingTile}
    eventId={event.id}
    eventStarted={eventStarted}
    isAdmin={isAdmin}
    pointsMode={pointsMode}
    tierBands={tierBands}
    lockHolder={lockHolder}
    categorySuggestions={categories}
    teamPlay={teamPlay}
    missionsAllowed={missionsAllowed}
    canDelete={canEditTileSet}
    revealEditor={
      revealMode ? (
        <RevealAtEditor
          tile={editingTile}
          eventId={event.id}
          scheduled={scheduledMode}
          isAdmin={isAdmin}
          onSaved={(revealAt) => handleRevealAtSaved(editingTile.id, revealAt)}
          onStateChanged={handleRevealStateChanged}
        />
      ) : null
    }
    onClose={() => setEditingTileId(null)}
    onDelete={() => handleDeleteTile(editingTile.id, true)}
    onSaved={(updated) => {
      handleTileConfigSaved(editingTile.id, updated);
      setEditingTileId(null);
    }}
        />
  ) : null;

  return (
    // Disabled fieldset natively disables every control inside — the locked (finished) event's
    // tile authoring goes read-only in one place. min-w-0 defeats fieldset's min-content default.
    <fieldset disabled={editLocked} className="space-y-8 block min-w-0 border-0 p-0 m-0">
      {/* Per-tile configuration */}
      <div ref={boardRef}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <span className="w-1 h-5 bg-gold rounded-full" />
              {model.NounPlural}
              <span className="text-xs text-text-muted font-normal">({localTiles.length})</span>
            </h2>
            {/* What this format wants from you, said once, at the top. */}
            <p className="text-xs text-text-muted mt-1 max-w-2xl">{model.brief}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!eventStarted && localTiles.length > 1 && (
              <>
                <button
                  onClick={handleShuffle}
                  disabled={reordering}
                  title={model.ordering === 'draw-order' ? 'Randomize the order the pool is drawn in' : 'Randomize the board order'}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-card-border text-text-muted hover:text-foreground hover:border-gold/40 transition-colors disabled:opacity-50"
                >
                  🎲 Shuffle
                </button>
                {pointsMode && (
                  <button
                    onClick={handleSortByDifficulty}
                    disabled={reordering}
                    title="Group tiles by difficulty tier — lowest point value first"
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-card-border text-text-muted hover:text-foreground hover:border-gold/40 transition-colors disabled:opacity-50"
                  >
                    Sort by difficulty
                  </button>
                )}
              </>
            )}
            {/* The views this board actually has, in the model's order — a Showdown gets Schedule,
                a draw board gets Rotation, and neither shows up where it would mean nothing. */}
            <div className="flex items-center rounded-lg border border-card-border overflow-hidden">
              {model.views.map((v) => {
                const meta = VIEW_LABELS[v](boardShape);
                return (
                  <button
                    key={v}
                    onClick={() => setViewMode(v)}
                    title={meta.title}
                    className={`text-xs px-3 py-1.5 transition-colors ${viewMode === v ? 'bg-gold/20 text-gold' : 'text-text-muted hover:text-foreground'}`}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>
            {dynamicBoard && viewMode === 'cards' && (
              <button
                onClick={handleAddTile}
                disabled={adding || eventStarted}
                title={eventStarted ? 'Tiles are locked after the event starts' : undefined}
                className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {adding ? 'Adding…' : `+ Add ${model.noun}`}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleImportFile}
              className="hidden"
            />
            {/* Everything that isn't Quick build lives in one menu: generators first (what people
                reach for), then the file and library round-trips. */}
            <ActionMenu
              label={`＋ Add ${model.nounPlural}`}
              items={[
                { label: 'Draw from task library…', onClick: () => setGenerator('library'), disabled: !canEditTileSet, variant: 'gold' },
                { label: 'From a collection log page…', onClick: () => setGenerator('clog'), disabled: !canEditTileSet },
                { label: 'Skill XP tiles…', onClick: () => setGenerator('skill'), disabled: !canEditTileSet },
                { label: 'Boss KC / kill tiles…', onClick: () => setGenerator('boss'), disabled: !canEditTileSet },
                {
                  label: importing ? 'Importing…' : 'Upload CSV / Excel…',
                  onClick: () => fileInputRef.current?.click(),
                  disabled: importing,
                  separatorBefore: true,
                },
                {
                  label: 'Download spreadsheet',
                  onClick: () => { window.location.href = `/api/events/${event.id}/tiles/spreadsheet`; },
                  title: 'Excel workbook with the current tiles, dropdowns, the item list and instructions',
                },
                { label: 'Template CSV', onClick: downloadTemplate },
                {
                  label: savingToLibrary ? 'Adding…' : 'Add this board to the library',
                  onClick: addBoardToLibrary,
                  disabled: savingToLibrary,
                  separatorBefore: true,
                },
                {
                  label: 'Export as seed pack',
                  onClick: () => { window.location.href = `/api/admin/tile-library/export?eventId=${event.id}`; },
                },
              ]}
            />
            {/* Dialogs only — the menu is their trigger. */}
            <ClogGenerator
              eventId={event.id}
              canGrow={canEditTileSet}
              pointsMode={pointsMode}
              onCreated={handleClogCreated}
              onError={(text) => setImportMsg({ type: 'error', text })}
              hideTrigger
              open={generator === 'clog'}
              onOpenChange={(v) => setGenerator(v ? 'clog' : null)}
            />
            <SkillTileGenerator
              eventId={event.id}
              canGrow={canEditTileSet}
              pointsMode={pointsMode}
              onCreated={handleSkillsCreated}
              onError={(text) => setImportMsg({ type: 'error', text })}
              hideTrigger
              open={generator === 'skill'}
              onOpenChange={(v) => setGenerator(v ? 'skill' : null)}
            />
            <BossTileGenerator
              eventId={event.id}
              canGrow={canEditTileSet}
              pointsMode={pointsMode}
              onCreated={handleSkillsCreated}
              onError={(text) => setImportMsg({ type: 'error', text })}
              hideTrigger
              open={generator === 'boss'}
              onOpenChange={(v) => setGenerator(v ? 'boss' : null)}
            />
            <LibraryTileGenerator
              eventId={event.id}
              canGrow={canEditTileSet}
              onCreated={handleSkillsCreated}
              onError={(text) => setImportMsg({ type: 'error', text })}
              hideTrigger
              open={generator === 'library'}
              onOpenChange={(v) => setGenerator(v ? 'library' : null)}
            />
          </div>
        </div>

        {importMsg && (
          <p className={`text-sm mb-3 ${importMsg.type === 'success' ? 'text-accent-green-light' : 'text-red-400'}`}>
            {importMsg.text}
          </p>
        )}

        {revealMode && (
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-text-muted">Pool:</span>
            <span className="rounded-full border border-accent-green/30 bg-accent-green/10 text-accent-green-light px-2.5 py-1">
              {poolCounts.open} open
            </span>
            <span className="rounded-full border border-gold/30 bg-gold/10 text-gold px-2.5 py-1">
              {poolCounts.waiting} waiting to be drawn
            </span>
            {poolCounts.closed > 0 && (
              <span className="rounded-full border border-card-border text-text-muted px-2.5 py-1">
                {poolCounts.closed} closed
              </span>
            )}
          </div>
        )}

        {/* The format's own unfinished business — an unscheduled Showdown tile is a tile that never
            opens, which is invisible on a card list and fatal on the night. */}
        {formatJob && viewMode !== formatJob.view && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-400/40 bg-amber-400/[0.08] px-3 py-2.5">
            <span className="text-sm text-amber-100">{formatJob.message}</span>
            <button
              type="button"
              onClick={() => setViewMode(formatJob.view)}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-amber-400/50 text-amber-100 hover:bg-amber-400/15 transition-colors"
            >
              {VIEW_LABELS[formatJob.view](boardShape).label} →
            </button>
          </div>
        )}

        {viewMode === 'schedule' ? (
          <ScheduleView
            eventId={event.id}
            tiles={localTiles}
            model={model}
            eventStartDate={event.startDate}
            editingTileId={editingTileId}
            onPick={(id) => setEditingTileId(id)}
            onRevealAtSaved={handleRevealAtSaved}
            onScheduled={(schedule) => {
              const byId = new Map(schedule.map((s) => [s.tileId, s.revealAt]));
              setLocalTiles((prev) =>
                prev.map((t) => (byId.has(t.id) ? { ...t, revealAt: byId.get(t.id)! } : t)),
              );
              router.refresh();
            }}
          />
        ) : viewMode === 'rotation' ? (
          <RotationView
            eventId={event.id}
            tiles={localTiles}
            rules={eventRules}
            model={model}
            isAdmin={isAdmin}
            eventStarted={eventStarted}
            reordering={reordering}
            editingTileId={editingTileId}
            onPick={(id) => setEditingTileId(id)}
            onReorder={(ids, describe) => {
              setLocalTiles((prev) => {
                const byId = new Map(prev.map((t) => [t.id, t]));
                return ids.map((id, i) => ({ ...byId.get(id)!, position: i }));
              });
              void applyOrder(ids, describe);
            }}
            onRevealStateChanged={handleRevealStateChanged}
          />
        ) : viewMode === 'board' ? (
          <div className="min-w-0">
            <p className="text-xs text-text-muted mb-3">
              {boardShape === 'grid'
                ? `Click any square to configure that ${model.noun}. This is exactly the board members will see.`
                : `Click any ${model.noun} to configure it. They are reached in this order — drag to change it from Cards.`}
            </p>
            <EventBoard
              format={event.format}
              tiles={localTiles}
              boardSize={event.boardSize}
              completions={[]}
              teams={[]}
              pointsMode={pointsMode}
              onTileClick={(tileId) => setEditingTileId(tileId)}
              showStatusFilter={false}
              staffOnlyTileIds={hiddenTileIds}
            />
          </div>
        ) : viewMode === 'grid' ? (
          <div className="flex flex-col lg:flex-row gap-4 items-start">
            {/* Left: tile list + bulk create */}
            <div className="w-full lg:w-72 shrink-0 flex flex-col border border-card-border rounded-xl bg-card-bg overflow-hidden">
              <div className="p-2.5 border-b border-card-border flex items-center gap-1.5 flex-wrap">
                {canEditTileSet ? (
                  <>
                    <button onClick={() => bulkCreate([null])} disabled={adding} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25 transition-colors disabled:opacity-50">+ Row</button>
                    <button onClick={() => bulkCreate(Array(10).fill(null))} disabled={adding} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25 transition-colors disabled:opacity-50">+ 10</button>
                    <button onClick={() => setPasteOpen(true)} disabled={adding} className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-card-border text-text-muted hover:text-foreground hover:border-gold/40 transition-colors disabled:opacity-50">Paste labels…</button>
                  </>
                ) : (
                  <span className="text-[11px] text-text-muted px-1">{eventStarted ? 'Board locked — event started' : 'Fixed board'}</span>
                )}
                {adding && <span className="text-[11px] text-text-muted">working…</span>}
              </div>
              {localTiles.length > 0 && (
                <div className="p-2.5 border-b border-card-border">
                  <div className="relative">
                    <Input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={`Search ${model.nounPlural}…`}
                      className="w-full pl-3 pr-8 py-1.5 text-sm"
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
                </div>
              )}
              <ul className="overflow-y-auto max-h-[72vh]">
                {gridTiles.map((t) => {
                  const k = tileKindBadge(t);
                  const sel = editingTileId === t.id;
                  // Reordering a filtered list would move tiles by absolute slot while showing a
                  // non-contiguous subset — confusing. Disable drag while a search is active.
                  const draggable = !eventStarted && !reordering && !gridFiltering;
                  const isDragging = dragTileId === t.id;
                  const isDragOver = dragOverTileId === t.id && dragTileId !== t.id;
                  return (
                    <li
                      key={t.id}
                      draggable={draggable}
                      onDragStart={(e) => {
                        setDragTileId(t.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => {
                        if (dragTileId == null) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        setDragOverTileId(t.id);
                      }}
                      onDragLeave={() => setDragOverTileId((cur) => (cur === t.id ? null : cur))}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleTileDrop(t.id);
                      }}
                      onDragEnd={() => {
                        setDragTileId(null);
                        setDragOverTileId(null);
                      }}
                      className={`${isDragging ? 'opacity-40' : ''} ${isDragOver ? 'border-t-2 border-t-gold' : ''}`}
                    >
                      <button
                        onClick={() => setEditingTileId(t.id)}
                        className={`w-full text-left px-2.5 py-2 flex items-center gap-2 border-b border-card-border/40 transition-colors ${sel ? 'bg-gold/10' : 'hover:bg-card-bg-hover'}`}
                      >
                        {draggable && (
                          <span className="text-text-muted/50 cursor-grab select-none shrink-0" title="Drag to reorder" aria-hidden>
                            ⠿
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-text-muted w-7 shrink-0">#{t.position + 1}</span>
                        <span className={`flex-1 truncate text-sm ${sel ? 'text-gold font-medium' : 'text-foreground'}`}>{t.label}</span>
                        {(() => {
                          const rc = revealChip(t);
                          return rc ? (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 ${rc.cls}`} title={rc.title}>
                              {rc.label}
                            </span>
                          ) : null;
                        })()}
                        {isManualOnlyDropTile(t) && <ManualOnlyBadge compact className="shrink-0" />}
                        <span title={k.blurb} className={`text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 ${k.cls}`}>{k.label}</span>
                      </button>
                    </li>
                  );
                })}
                {localTiles.length === 0 && (
                  <li className="px-3 py-8 text-center text-xs text-text-muted">No {model.nounPlural} yet. {canEditTileSet ? 'Use “+ Row” or “Paste labels”.' : ''}</li>
                )}
                {localTiles.length > 0 && gridTiles.length === 0 && (
                  <li className="px-3 py-8 text-center text-xs text-text-muted">No {model.nounPlural} match your search.</li>
                )}
              </ul>
            </div>

            {/* Right: the full tile editor for the selected tile */}
            <div className="flex-1 min-w-0 w-full border border-card-border rounded-xl bg-card-bg">
              {editingTile ? (
                <div className="p-5">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h3 className="text-sm font-bold text-foreground">
                      <span className="text-text-muted font-mono mr-1.5">#{editingTile.position + 1}</span>
                      {editingTile.label}
                    </h3>
                    {canEditTileSet && (
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          onClick={() => duplicateTile(editingTile.id)}
                          disabled={adding}
                          title="Create a copy of this tile with the same configuration"
                          className="text-xs text-text-muted hover:text-gold transition-colors disabled:opacity-50"
                        >
                          {adding ? 'Duplicating…' : 'Duplicate'}
                        </button>
                        <button onClick={() => handleDeleteTile(editingTile.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors">Delete {model.noun}</button>
                      </div>
                    )}
                  </div>
                  {lockHolder && (
                    <p className="mb-3 text-xs px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-200">
                      🔒 <span className="font-semibold">{lockHolder}</span> is editing this {model.noun} right now — if you both
                      save, the second save is rejected instead of overwriting.
                    </p>
                  )}
                  {revealMode && (
                    <RevealAtEditor
                      key={`reveal-${editingTile.id}`}
                      tile={editingTile}
                      eventId={event.id}
                      scheduled={scheduledMode}
                      isAdmin={isAdmin}
                      onSaved={(revealAt) => handleRevealAtSaved(editingTile.id, revealAt)}
                      onStateChanged={handleRevealStateChanged}
                    />
                  )}
                  <TileTrackingConfig
                    key={editingTile.id}
                    tileId={editingTile.id}
                    eventId={event.id}
                    initial={tileToTrackingInitial(editingTile)}
                    onSaved={(updated) => {
                      handleTileConfigSaved(editingTile.id, updated);
                      router.refresh();
                    }}
                    eventStarted={eventStarted}
                    isAdmin={isAdmin}
                    pointsMode={pointsMode}
                    tierBands={tierBands}
                    categorySuggestions={categories}
                    teamPlay={teamPlay}
                    missionsAllowed={missionsAllowed}
                  />
                </div>
              ) : editingLoading ? (
                <div className="grid place-items-center text-sm text-text-muted py-24 px-6 text-center">
                  Loading {model.noun}…
                </div>
              ) : (
                <div className="grid place-items-center text-sm text-text-muted py-24 px-6 text-center">
                  Select a {model.noun} on the left to edit it — full config with item &amp; NPC autocomplete.
                </div>
              )}
            </div>
          </div>
        ) : (
          <>

        {/* One filter bar: a search you can actually see, and the three narrowings behind it.
            The kind filter used to be fourteen chips in a horizontal scroller beside a small box —
            a wall to read every time you wanted to type a tile's name. */}
        <div className="mb-3 space-y-2">
          <div className="relative">
            <span aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted/70">⌕</span>
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${model.nounPlural} — name, category, stat, or #position`}
              className="w-full pl-9 pr-9 py-2.5 bg-brown-dark border border-card-border rounded-lg text-sm text-foreground placeholder:text-text-muted/60 focus:border-gold/50 focus:outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 grid place-items-center rounded text-text-muted hover:text-foreground"
              >
                &times;
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={kindFilter}
              onChange={(v) => setKindFilter(v as KindFilter)}
              options={TILE_KIND_FILTERS.map((f) => ({ value: f.key, label: f.key === 'all' ? 'All kinds' : f.label }))}
              ariaLabel="Filter by tile kind"
              className="w-40"
            />
            {categories.length > 0 && (
              <Select
                value={categoryFilter}
                onChange={setCategoryFilter}
                options={[{ value: 'all', label: 'All categories' }, ...categories.map((c) => ({ value: c, label: c }))]}
                ariaLabel="Filter by category"
                className="w-44"
              />
            )}
            {showTierFilter && (
              <div className="flex items-center gap-1 flex-wrap">
                {[{ key: 'all', label: 'All tiers' }, ...tierBands.map((t) => ({ key: t.key, label: t.label }))].map(
                  (t, i) => (
                    <button
                      key={t.key}
                      onClick={() => setTierFilter(t.key)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors inline-flex items-center gap-1.5 ${
                        tierFilter === t.key
                          ? 'bg-gold/20 border-gold text-gold'
                          : 'border-card-border text-text-muted hover:border-gold/40'
                      }`}
                    >
                      {t.key !== 'all' && (
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: tierColor(i - 1, tierBands.length) }}
                          aria-hidden
                        />
                      )}
                      {t.label}
                    </button>
                  ),
                )}
              </div>
            )}

            <span className="ml-auto text-xs text-text-muted whitespace-nowrap">
              {filteredTiles.length === boardOnly.length
                ? `${boardOnly.length} ${boardOnly.length === 1 ? model.noun : model.nounPlural}`
                : `${filteredTiles.length} of ${boardOnly.length} match`}
              {filteredTiles.length > visibleTiles.length && ` · showing ${visibleTiles.length}`}
            </span>
            {(search || kindFilter !== 'all' || categoryFilter !== 'all' || tierFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearch('');
                  setKindFilter('all');
                  setCategoryFilter('all');
                  setTierFilter('all');
                }}
                className="text-xs px-2.5 py-1.5 rounded-lg text-text-muted hover:text-foreground transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Two real columns: the board on the left, its editor on the right. Not an overlay —
            the thing you're editing stays visible, and picking another tile just moves the pane.
            NO `items-start` here: it shrink-wraps the editor's column to the editor's own height,
            which leaves its `sticky top-4` nothing to travel inside. On a 261-tile board that meant
            scrolling down to a tile, clicking it, and then scrolling all the way back up to edit it.
            Stretching the column (the grid default) is what lets the editor follow the list. */}
        <div
          className={
            editingTile && inspectorDocked
              ? 'xl:grid xl:grid-cols-[minmax(0,1fr)_23rem] xl:gap-5'
              : ''
          }
        >
        <div className="min-w-0">

        {selectedIds.size > 0 && (
          <div className="sticky top-[4.5rem] z-20 mb-2.5 flex flex-wrap items-center gap-2 rounded-lg border border-gold/40 bg-gold/[0.12] backdrop-blur px-3 py-2">
            <span className="text-sm font-semibold text-gold-light">
              {selectedIds.size} selected
            </span>
            <span className="text-xs text-text-muted hidden sm:inline">shift-click for a run</span>

            {pointsMode && (
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => {
                  const raw = prompt(`Points for ${selectedIds.size} tiles?`);
                  if (raw === null) return;
                  const points = parseInt(raw, 10);
                  if (!Number.isInteger(points) || points < 0) return;
                  void bulkSet({ points }, `Set ${points} pt${points === 1 ? '' : 's'}`);
                }}
                className="text-xs px-2.5 py-1 rounded-lg border border-card-border bg-card-bg hover:border-gold/50 hover:text-gold transition-colors disabled:opacity-50"
              >
                Set points
              </button>
            )}
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => {
                const category = prompt(`Category for ${selectedIds.size} tiles? (blank clears it)`);
                if (category === null) return;
                void bulkSet({ category: category.trim() || null }, category.trim() ? `Set “${category.trim()}”` : 'Cleared the category');
              }}
              className="text-xs px-2.5 py-1 rounded-lg border border-card-border bg-card-bg hover:border-gold/50 hover:text-gold transition-colors disabled:opacity-50"
            >
              Set category
            </button>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => void bulkSet({ optional: true }, 'Marked optional')}
              className="text-xs px-2.5 py-1 rounded-lg border border-card-border bg-card-bg hover:border-gold/50 hover:text-gold transition-colors disabled:opacity-50"
            >
              Mark optional
            </button>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => void bulkSet({ optional: false }, 'Marked required')}
              className="text-xs px-2.5 py-1 rounded-lg border border-card-border bg-card-bg hover:border-gold/50 hover:text-gold transition-colors disabled:opacity-50"
            >
              Mark required
            </button>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => void bulkSet({ autoTrackDisabled: true }, 'Switched to complete-by-hand')}
              title="Stop these tiles crediting themselves — a captain or admin completes them by hand. The escape hatch when tracking is unreliable mid-event."
              className="text-xs px-2.5 py-1 rounded-lg border border-card-border bg-card-bg hover:border-gold/50 hover:text-gold transition-colors disabled:opacity-50"
            >
              Complete by hand
            </button>

            {/* Reveal is a bulk edit on any staggered board — the API has taken it since the bulk
                route was written, and nothing had ever offered it. On a scheduled board the whole
                selection shares one time ("this wave opens at 8"); the Schedule view is where a
                spread-out run gets laid out. */}
            {scheduledMode && (
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => {
                  const raw = prompt(
                    `Reveal all ${selectedIds.size} at the same moment. Date and time (YYYY-MM-DD HH:MM), or blank to clear:`,
                  );
                  if (raw === null) return;
                  const trimmed = raw.trim();
                  if (!trimmed) {
                    void bulkSet({ revealAt: null }, 'Cleared the reveal time');
                    return;
                  }
                  const when = new Date(trimmed.replace(' ', 'T'));
                  if (Number.isNaN(when.getTime())) {
                    setBulkMsg("That didn't read as a date — try 2026-08-16 20:00.");
                    return;
                  }
                  void bulkSet({ revealAt: when.toISOString() }, `Set to open ${when.toLocaleString()}`);
                }}
                className="text-xs px-2.5 py-1 rounded-lg border border-blue-400/40 bg-blue-500/10 text-blue-200 hover:border-blue-300 transition-colors disabled:opacity-50"
              >
                Set reveal time
              </button>
            )}
            {revealMode && isAdmin && (
              <>
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => void bulkSet({ revealState: 'live' }, 'Opened to members')}
                  title="Open all of these to members right now, ahead of the schedule or rotation"
                  className="text-xs px-2.5 py-1 rounded-lg border border-accent-green/40 bg-accent-green/10 text-accent-green-light hover:border-accent-green transition-colors disabled:opacity-50"
                >
                  Open now
                </button>
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => {
                    if (!confirm(`Hide ${selectedIds.size} from members again? Progress stays, but they stop being playable.`)) return;
                    void bulkSet({ revealState: 'hidden' }, 'Hidden again');
                  }}
                  className="text-xs px-2.5 py-1 rounded-lg border border-card-border bg-card-bg hover:border-gold/50 hover:text-gold transition-colors disabled:opacity-50"
                >
                  Hide again
                </button>
              </>
            )}

            <span className="flex-1" />
            {bulkMsg && <span className="text-xs text-text-muted">{bulkMsg}</span>}
            <button
              type="button"
              onClick={() => {
                setSelectedIds(new Set());
                setBulkMsg('');
              }}
              className="text-xs px-2.5 py-1 rounded-lg text-text-muted hover:text-foreground transition-colors"
            >
              Clear
            </button>
          </div>
        )}

        {filteredTiles.length === 0 ? (
          <div className="border border-card-border rounded-xl p-8 bg-card-bg text-center text-sm text-text-muted">
            No {model.nounPlural} match your search.
          </div>
        ) : (
        <div
          // Fewer, wider cards when the editor is open beside them — a tile clipped to "Til e…" is
          // no use for finding the one you want.
          className={`grid gap-2.5 ${
            editingTile && inspectorDocked
              ? 'grid-cols-1 sm:grid-cols-2'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
          }`}
        >
          {visibleTiles.map((tile) => {
            const k = tileKindBadge(tile);
            const isEditing = editingTileId === tile.id;
            const isSelected = selectedIds.has(tile.id);
            return (
              <button
                key={tile.id}
                onClick={(e) => pickTile(tile.id, e)}
                className={`group/tile relative text-left border rounded-xl bg-card-bg hover:bg-card-bg-hover transition-colors overflow-hidden ${
                  isEditing
                    ? 'border-gold ring-1 ring-gold/40'
                    : isSelected
                      ? 'border-gold/60 bg-gold/[0.07]'
                      : 'border-card-border hover:border-gold/40'
                }`}
              >
                {/* A stripe down the side, so a half-built board reads without stopping to read:
                    amber = can't credit as set up, violet = still hidden, grey = nothing special. */}
                <span
                  aria-hidden
                  className={`absolute inset-y-0 left-0 w-1 ${
                    problemTileIds.has(tile.id)
                      ? 'bg-amber-400/80'
                      : tile.revealedAt
                        ? 'bg-accent-green/60'
                        : revealMode
                          ? 'bg-violet-400/60'
                          : 'bg-transparent'
                  }`}
                />
                <span className="block pl-4 pr-3 py-3 flex flex-col gap-1.5">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono shrink-0 flex items-center gap-1.5">
                      {isSelected && <span className="text-gold" aria-hidden>✓</span>}
                      <span className="text-text-muted">#{tile.position + 1}</span>
                    </span>
                    <span className="flex items-center gap-1 flex-wrap justify-end">
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
                        const rc = revealChip(tile);
                        return rc ? (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${rc.cls}`} title={rc.title}>
                            {rc.label}
                          </span>
                        ) : null;
                      })()}
                      {isManualOnlyDropTile(tile) && <ManualOnlyBadge compact />}
                      <span title={k.blurb} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${k.cls}`}>{k.label}</span>
                    </span>
                  </span>
                  <span className="text-sm font-semibold text-foreground line-clamp-2 break-words" title={tile.label}>
                    {tile.label}
                  </span>
                  <span className={`text-xs truncate ${problemTileIds.has(tile.id) ? 'text-amber-300/90' : 'text-text-muted'}`}>
                    {problemTileIds.get(tile.id) ?? tileConfigSummary(tile, model.noun)}
                  </span>
                </span>
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

        {/* MISSIONS — their own lane, below the board and outside it. Deliberately not part of the
            list above: a mission is announced mid-event, scores as a bonus on top of a board total
            it never moves, and can expire unclaimed. It also ignores the board's filters, because
            with four of them the filters are furniture. */}
        {missionsAllowed && (
          <div className="mt-6 pt-5 border-t border-card-border">
            <div className="flex items-center gap-2.5 mb-3 flex-wrap">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <span className="w-1 h-4 bg-purple-400 rounded-full" />
                <span aria-hidden>⚡</span>
                Missions
              </h3>
              <span className="text-xs text-text-muted">
                {missionPool.length === 0
                  ? 'hidden bonus objectives, dropped mid-event'
                  : `${missionPool.length} · ${announcedMissions} announced`}
              </span>
              <button
                onClick={handleAddMission}
                disabled={adding || editLocked}
                className="ml-auto text-xs font-semibold px-3 py-1.5 rounded-lg bg-purple-500/15 border border-purple-400/30 text-purple-200 hover:bg-purple-500/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                + Add mission
              </button>
            </div>

            {missionPool.length === 0 ? (
              <p className="text-xs text-text-muted">
                A mission stays hidden until you announce it, then scores as a bonus on top of the
                board total — so adding one never changes what the board is out of.
              </p>
            ) : (
              <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {missionPool.map((tile) => {
                  const isEditing = editingTileId === tile.id;
                  return (
                    <button
                      key={tile.id}
                      onClick={() => setEditingTileId(isEditing ? null : tile.id)}
                      className={`text-left rounded-xl border p-3 transition-colors ${
                        isEditing
                          ? 'border-purple-400/60 bg-purple-500/10'
                          : 'border-card-border bg-card-bg hover:border-purple-400/40'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-purple-500/20 text-purple-200">
                          {tile.revealedAt ? 'Announced' : 'Hidden'}
                        </span>
                        {tile.closedAt && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-white/10 text-text-muted">
                            Closed
                          </span>
                        )}
                        {pointsMode && tile.points != null && (
                          <span className="ml-auto text-[10px] text-purple-200/80">+{tile.points} bonus</span>
                        )}
                      </span>
                      <span className="block text-sm font-semibold text-foreground line-clamp-2 break-words" title={tile.label}>
                        {tile.label}
                      </span>
                      <span className="block text-xs text-text-muted truncate">
                        {tileConfigSummary(tile, 'mission')}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        </div>

        {editingTile && inspectorDocked && (
          <div className="hidden xl:block">{renderInspector(true)}</div>
        )}
        </div>
          </>
        )}
      </div>

      {/* Reference material, under the board rather than stacked on top of it: you come to this
          page to see tiles, not to read three panels first. */}
      {/* Live balance read — structural checks recompute client-side; the effort model
          refetches (debounced) whenever the tile set changes */}
      <BoardBalancePanel
        eventId={event.id}
        tiles={localTiles}
        tilesVersion={tilesVersion}
        pointsMode={pointsMode}
        tierBands={tierBands}
        onApplyPoints={applySuggestedPoints}
      />

      <TileHistoryPanel eventId={event.id} />

      <details className="border border-card-border rounded-xl bg-card-bg px-5 py-3 group">
        <summary className="text-sm font-semibold cursor-pointer hover:text-gold select-none">
          Spreadsheet round-trip
          <span className="text-xs text-text-muted font-normal"> — draft the board in Excel or Sheets</span>
        </summary>
        <div className="text-xs text-text-muted leading-relaxed mt-3 space-y-2">
          <p>
            Rows map onto tiles by order (row 1 → tile #1). Columns:{' '}
            <span className="text-gold">{TILE_CSV_COLUMNS.join(', ')}</span>.
            {dynamicBoard && !eventStarted
              ? ' Extra rows beyond the current tiles are added as new tiles (up to 1000).'
              : ' Extra rows beyond the board size are ignored.'}
            {eventStarted && ' Event has started — label, type and required amount are locked and will be skipped.'}
          </p>
          <p>
            <span className="text-gold">Download spreadsheet</span> gives an Excel file with the current
            tiles, dropdowns, the full item list and instructions baked in — draft it, then upload the same
            file (or a CSV of the <em>Tiles</em> tab) straight back. The round trip is 1:1: re-uploading an
            unchanged sheet changes nothing.
          </p>
          <p>
            Everything above is also reachable from{' '}
            <Link href="/admin/tile-library" className="text-gold hover:text-gold-light">your task library</Link>.
          </p>
        </div>
      </details>

      {/* The covering drawer: narrow screens (no room for two panes) and every view that isn't the
          card list, which is the only one with a column to dock into. */}
      {editingTile && (viewMode !== 'cards' ? viewMode !== 'grid' : !inspectorDocked) && renderInspector(false)}

      {/* Paste-labels bulk create (Quick Build) */}
      {pasteOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setPasteOpen(false)}>
          <div className="w-full max-w-md bg-card-bg border border-card-border rounded-xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-foreground">Paste labels</h3>
            <p className="text-xs text-text-muted">One per line. Each becomes a new {model.noun} you can configure on the right.</p>
            <textarea
              autoFocus
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={8}
              className="w-full bg-brown-dark border border-card-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-gold/50 focus:outline-none"
              placeholder={'Cluck Norris\nBeefcake\nRat King'}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setPasteOpen(false)} className="text-xs px-3 py-1.5 rounded-lg border border-card-border text-text-muted hover:text-foreground">Cancel</button>
              <button onClick={applyPasteLabels} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25">Add tiles</button>
            </div>
          </div>
        </div>
      )}
    </fieldset>
  );
}

// How many tiles to render per page — Leagues boards can import 500-1000 tiles, so the
// grid is paginated to keep the DOM light. Search/filter narrows before this cap applies.
const PAGE_SIZE = 120;

// What each view is called on the tab strip. The board tab renames itself after the shape it's
// showing, because "Board" is not what anyone calls a 5×5 square or a race track.
const VIEW_LABELS: Record<AuthoringView, (shape: 'grid' | 'track' | 'list') => { label: string; title: string }> = {
  board: (shape) =>
    shape === 'grid'
      ? { label: 'Grid', title: 'Edit tiles on the grid itself' }
      : { label: 'Track', title: 'Edit tiles along the track, in running order' },
  cards: () => ({ label: 'Cards', title: 'Every task as a card — search, filter and bulk edits' }),
  schedule: () => ({ label: '🕑 Schedule', title: 'The reveal plan: when each one opens' }),
  rotation: () => ({ label: '🎲 Rotation', title: 'The draw pool, in the order the engine pulls from it' }),
  grid: () => ({ label: '⚡ Quick build', title: 'Spreadsheet-style bulk authoring' }),
};

// The kind badge, its one-line config summary and the kind filter's options all live in
// lib/tileKinds, next to the kind derivation they read — every authoring view needs the same
// answers about the same tile, and a second copy here would be a second copy to drift.
type KindFilter = 'all' | TileKindKey;

// ISO → the local wall-clock string a <input type="datetime-local"> wants.
function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Per-tile reveal state on a reveal-policy board.
 *
 * Two different mechanisms, because the policies work differently:
 *   • 'scheduled' — the host owns the PLAN (tiles.revealAt) and the engine flips the tile when its
 *     time passes, so the datetime field is the primary control.
 *   • interval / rotating / bounty — the ENGINE picks which tile is next, so there's no plan to
 *     edit. Instead an admin can force this specific tile open now, or pull it back to hidden
 *     (`revealState`, admin-only). Without these the only per-tile control on those boards was a
 *     status line you couldn't act on.
 */
function RevealAtEditor({
  tile,
  eventId,
  scheduled,
  isAdmin = false,
  onSaved,
  onStateChanged,
}: {
  tile: Tile;
  eventId: number;
  scheduled: boolean;
  isAdmin?: boolean;
  onSaved: (revealAt: string | null) => void;
  /** Force-reveal / re-hide landed — carries the whole tile back so revealedAt/closedAt refresh. */
  onStateChanged?: (tile: Tile) => void;
}) {
  const [value, setValue] = useState(() => toLocalInputValue(tile.revealAt));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function setRevealState(next: 'live' | 'hidden') {
    if (next === 'hidden' && !confirm('Hide this tile from members again? Any progress on it stays, but it stops being playable until it opens again.')) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/events/${eventId}/tiles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tileId: tile.id, revealState: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ type: 'error', text: data.error || 'Could not change this tile’s reveal state.' });
        return;
      }
      onStateChanged?.(data as Tile);
      setMsg({
        type: 'success',
        text: next === 'live' ? 'Tile is open to members now.' : 'Tile is hidden again.',
      });
    } catch {
      setMsg({ type: 'error', text: 'Could not change this tile’s reveal state.' });
    } finally {
      setSaving(false);
    }
  }

  async function save(revealAt: string | null) {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/events/${eventId}/tiles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tileId: tile.id, revealAt }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ type: 'error', text: data.error || 'Could not save the reveal time.' });
        return;
      }
      setValue(toLocalInputValue(data.revealAt));
      onSaved(data.revealAt ?? null);
      setMsg({ type: 'success', text: revealAt ? 'Reveal time saved.' : 'Reveal time cleared.' });
    } catch {
      setMsg({ type: 'error', text: 'Could not save the reveal time.' });
    } finally {
      setSaving(false);
    }
  }

  const status = tile.closedAt
    ? { text: `🎯 Claimed ${new Date(tile.closedAt).toLocaleString()}`, cls: 'text-red-300' }
    : tile.revealedAt
      ? { text: `🔓 Live since ${new Date(tile.revealedAt).toLocaleString()}`, cls: 'text-accent-green-light' }
      : { text: '🙈 Hidden from members', cls: 'text-text-muted' };

  return (
    <div className="mb-4 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground/80">Reveal</span>
        <span className={`text-xs ${status.cls}`}>{status.text}</span>
      </div>
      {scheduled && !tile.revealedAt && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="datetime-local"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="bg-brown-dark border border-card-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:border-gold/50 focus:outline-none"
            />
            <button
              onClick={() => save(value ? new Date(value).toISOString() : null)}
              disabled={saving || !value}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save time'}
            </button>
            {tile.revealAt && (
              <button
                onClick={() => save(null)}
                disabled={saving}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-card-border text-text-muted hover:text-foreground transition-colors disabled:opacity-50"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => save(new Date().toISOString())}
              disabled={saving}
              title="Sets the reveal time to now — the tile goes live on the next minute tick"
              className="text-xs px-2.5 py-1.5 rounded-lg border border-accent-green/30 text-accent-green-light hover:bg-accent-green/10 transition-colors disabled:opacity-50"
            >
              Reveal now
            </button>
          </div>
          <p className="text-[11px] text-text-muted leading-relaxed">
            The tile flips live within a minute of its reveal time. No time set = stays hidden.
          </p>
        </>
      )}
      {/* Manual override. On a scheduled board the datetime field above is the normal route, so this
          only offers the reverse (pull a live tile back); on engine-drawn boards it's the only
          per-tile control that exists. */}
      {isAdmin && (
        <div className="flex items-center gap-2 flex-wrap">
          {!tile.revealedAt || tile.closedAt ? (
            <button
              onClick={() => setRevealState('live')}
              disabled={saving}
              title="Open this exact tile to members right now, ahead of the rotation"
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-accent-green/30 text-accent-green-light hover:bg-accent-green/10 transition-colors disabled:opacity-50"
            >
              {saving ? 'Working…' : tile.closedAt ? 'Re-open now' : 'Open now'}
            </button>
          ) : (
            <button
              onClick={() => setRevealState('hidden')}
              disabled={saving}
              title="Pull this tile back out of the board — the rotation can draw it again later"
              className="text-xs px-2.5 py-1.5 rounded-lg border border-card-border text-text-muted hover:text-foreground transition-colors disabled:opacity-50"
            >
              {saving ? 'Working…' : 'Hide again'}
            </button>
          )}
          <span className="text-[11px] text-text-muted">
            {scheduled
              ? 'Overrides the scheduled time for this tile only.'
              : 'The rotation normally picks tiles for you — this overrides it for this tile.'}
          </span>
        </div>
      )}
      {msg && (
        <p className={`text-[11px] ${msg.type === 'success' ? 'text-accent-green-light' : 'text-red-400'}`}>{msg.text}</p>
      )}
    </div>
  );
}

interface DrawerProps {
  tile: Tile;
  /** Wide screens dock the editor beside the board instead of covering it. */
  docked?: boolean;
  eventId: number;
  eventStarted: boolean;
  isAdmin?: boolean;
  pointsMode: boolean;
  canDelete?: boolean;
  onClose: () => void;
  onDelete?: () => void;
  onSaved: Parameters<typeof TileTrackingConfig>[0]['onSaved'];  tierBands?: TierBand[];
  /** Advisory lock holder (someone else editing right now), for the warning banner. */
  lockHolder?: string | null;
  /** Categories used elsewhere on the board, for the category tag typeahead. */
  categorySuggestions?: string[];
  /** Event has real multi-person teams — false on an individual ladder. */
  teamPlay?: boolean;
  /** Missions are enabled for this event and meaningful on this format. */
  missionsAllowed?: boolean;
  /** Reveal-policy events: the reveal status/schedule panel rendered above the tracking config. */
  revealEditor?: React.ReactNode;
  /** What one entry on this board is called — a ladder's are tasks (lib/tileAuthoring). */
  noun?: string;
}

function TileConfigDrawer({ tile, docked = false, noun = 'Tile', eventId, eventStarted, isAdmin, pointsMode, canDelete, onClose, onDelete, onSaved, tierBands, lockHolder, categorySuggestions, teamPlay, missionsAllowed, revealEditor }: DrawerProps) {
  // Docked, this is a column in the page, not a dialog over it — so it must not take the page's
  // scroll or swallow Tab. Undocked it really is a drawer, and stays one.
  const ref = useModalA11y<HTMLDivElement>({ onClose, modal: !docked });

  // Scroll the form back to the top when a DIFFERENT tile is opened. The panel persists across
  // selections (that's the point of the docked editor — picking another tile just moves the pane),
  // and so did its scroll position: open a tile after scrolling down in the previous one and the
  // form started halfway through the Tile Kind grid, looking cut off.
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [tile.id]);
  const titleId = `tile-config-title-${tile.id}`;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // The editor itself. Docked it's an ordinary sticky column in the page; narrow, it's a modal
  // drawer over a backdrop. Same panel either way — only the wrapper differs.
  const panel = (
      <div
        ref={ref}
        role={docked ? undefined : 'dialog'}
        aria-modal={docked ? undefined : 'true'}
        aria-labelledby={titleId}
        tabIndex={-1}
        className={
          docked
            ? 'sticky top-[4.5rem] max-h-[calc(100vh-6rem)] flex flex-col rounded-xl border border-card-border bg-card-bg overflow-hidden focus:outline-none'
            : 'relative w-full max-w-md h-full bg-card-bg border-l border-card-border shadow-2xl flex flex-col focus:outline-none animate-drawer-slide'
        }
      >
        {/* Header */}
        <div className="shrink-0 bg-card-bg border-b border-card-border px-5 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-text-muted">{noun} #{tile.position + 1}</p>
            <h3 id={titleId} className="text-base font-bold text-foreground line-clamp-2 break-words">
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
        <div ref={bodyRef} className="flex-1 min-h-0 p-5 overflow-y-auto">
          {lockHolder && (
            <p className="mb-3 text-xs px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-200">
              🔒 <span className="font-semibold">{lockHolder}</span> is editing this tile right now — if you both
              save, the second save is rejected instead of overwriting.
            </p>
          )}
          {revealEditor}
          <TileTrackingConfig
            tileId={tile.id}
            eventId={eventId}
            initial={tileToTrackingInitial(tile)}
            onSaved={onSaved}
            eventStarted={eventStarted}
            isAdmin={isAdmin}
            pointsMode={pointsMode}
            tierBands={tierBands}
            categorySuggestions={categorySuggestions}
            teamPlay={teamPlay}
            missionsAllowed={missionsAllowed}
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
  );

  if (docked) return panel;

  return (
    // Above the site nav (z-50), not under it — the drawer's own header and close button live in
    // that top strip, and a modal the page's chrome overlaps is a modal you can't close.
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-drawer-fade"
        onClick={onClose}
        aria-hidden="true"
      />
      {panel}
    </div>
  );
}
