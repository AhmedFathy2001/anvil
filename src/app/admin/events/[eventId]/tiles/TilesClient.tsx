'use client';

import { useLeaveGuard } from '@/components/UnsavedChanges';
import { isPlaceholderTile } from '@/lib/placeholderTile';
import DateTimePicker from '@/components/DateTimePicker';
import type { Event, Tile, ItemRequirement } from '@/lib/types';
import { useEffect, useMemo, useRef, useState, useDeferredValue } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import TileTrackingConfig from '@/components/TileTrackingConfig';
import TileCreator from '@/components/tile-creator/TileCreator';
import BulkQuickAdd from '@/components/tile-creator/BulkQuickAdd';
import { draftToTileConfig } from '@/lib/tileCreatorConfig';
import ClogGenerator from './ClogGenerator';
import BoardBalancePanel from './BoardBalancePanel';
import TileHistoryPanel from './TileHistoryPanel';
import TestInLabButton from '@/components/TestInLabButton';
import SkillTileGenerator from './SkillTileGenerator';
import BossTileGenerator from './BossTileGenerator';
import LibraryTileGenerator from './LibraryTileGenerator';
import ScheduleView from './ScheduleView';
import RotationView from './RotationView';
import ActionMenu from '@/components/ActionMenu';
import ManualOnlyBadge from '@/components/ManualOnlyBadge';
import { isManualOnlyDropTile } from '@/lib/clogManual';
import { tileMatchesSearch } from '@/lib/tileSearch';
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
  tileKindFilterKey,
  tileKindKey,
  type TileKindKey,
} from '@/lib/tileKinds';
import { authoringModel, unfinishedFormatJob, type AuthoringView } from '@/lib/tileAuthoring';
import { findBoardProblems } from '@/lib/boardMisconfig';
import { TILE_CSV_COLUMNS, parseTileCsv, tileToCsvCells, tileToCsvRow } from '@/lib/csvTiles';
import { tileTierKey, tileCategories, tileHasCategory, tierColor, DEFAULT_TIER_BANDS, type TierBand } from '@/lib/tileFilter';
import { clanFetch, clanUrl } from '@/lib/clanFetch';
import ClanLink from '@/components/ClanLink';
import { useDialog } from '@/components/Confirm';
import RaceRouteEditor from './RaceRouteEditor';
import GuideLink from '@/components/GuideLink';
import { parseTileEffortConfig } from '@/lib/tileEffortConfig';
import { parseComboRule } from '@/lib/combo';
import type { ComboPartConfig, TileConfig } from '@/lib/types';

// Map a stored Tile to TileTrackingConfig's `initial` shape (the tile panel's full form, behind
// "More options" on a new tile and the whole panel on a written one).
function tileToTrackingInitial(tile: Tile): TileConfig {
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
    lottery: !!tile.lottery,
    autoTrackDisabled: !!tile.autoTrackDisabled,
    trackedItemIds: tile.trackedItemIds ? (JSON.parse(tile.trackedItemIds) as number[]) : null,
    itemRequirements: tile.itemRequirements
      ? (JSON.parse(tile.itemRequirements) as ItemRequirement[])
      : null,
    // Without this the set controls reloaded on 'any' and the next save silently flipped an
    // "every set" collection back to any-one-set.
    groupMode: tile.groupMode ?? null,
    setsRequired: tile.setsRequired ?? null,
    countMode: tile.countMode ?? null,
    perKillCap: tile.perKillCap ?? null,
    capBy: tile.capBy ? (JSON.parse(tile.capBy) as string[]) : null,
    // A combo (lib/combo) opens with its rule and its parts, each in the same initial shape.
    comboRule: tile.tileType === 'combo' ? parseComboRule(tile.comboRule) : null,
    parts: tile.parts?.map((p): ComboPartConfig => ({ ...tileToTrackingInitial(p), id: p.id, comboWeight: p.comboWeight ?? null })) ?? null,
    comboWeight: tile.comboWeight ?? null,
    coopCredit: tile.coopCredit ?? null,
    coopMinMembers: tile.coopMinMembers ?? null,
    points: tile.points ?? 1,
    effortConfig: parseTileEffortConfig(tile.effortConfig),
    category: tile.category ?? null,
    sourceNpcs: tile.sourceNpcs ? (JSON.parse(tile.sourceNpcs) as string[]) : null,
    targetNpcs: tile.targetNpcs ? (JSON.parse(tile.targetNpcs) as string[]) : null,
    timedActivity: tile.timedActivity ?? null,
    timeThresholdSeconds: tile.timeThresholdSeconds ?? null,
    // Timed raids keep their party size in its own column (deathless/drop ride
    // timeThresholdSeconds). Without this the editor reloaded blank and the next save nulled it.
    partySize: tile.partySize ?? null,
    minRaidLevel: tile.minRaidLevel ?? null,
    partyTeamOnly: !!tile.partyTeamOnly,
    pvpMinLootValue: tile.pvpMinLootValue ?? null,
    mission: !!tile.mission,
    missionRules: tile.rules ? parseTileMissionRules(tile.rules) : null,
    updatedAt: tile.updatedAt ?? null,
  };
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
  /** Whether the host has actually switched missions on for this event. */
  missionsEnabled?: boolean;
  /** Coffer gp available for mission prizes, or null where the board pays none. */
  cofferAvailable?: number | null;
  /** Platform staff: offer "Test in lab" on each tile (lib/lab). The API re-checks the role live. */
  canLab?: boolean;
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

export default function TilesClient({ event, tiles, tierBands = DEFAULT_TIER_BANDS, isAdmin = false, editLocked = false, teamPlay = true, missionsAllowed = true, missionsEnabled = true, cofferAvailable = null, canLab = false }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  // The board itself.
  const boardRef = useRef<HTMLDivElement>(null);
  const [localTiles, setLocalTiles] = useState<Tile[]>([...tiles].sort((a, b) => a.position - b.position));
  const [editingTileId, setEditingTileId] = useState<number | null>(null);
  // Opening another tile or closing the editor throws away an open tile's unsaved edits: ask first.
  const leaveGuard = useLeaveGuard();
  const openTileGuarded = (id: number | null) => leaveGuard(() => setEditingTileId(id));
  const [importing, setImporting] = useState(false);
  const [savingToLibrary, setSavingToLibrary] = useState(false);
  // Which generator dialog the Add tiles menu has open, if any.
  const [generator, setGenerator] = useState<'clog' | 'skill' | 'boss' | 'library' | null>(null);
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [adding, setAdding] = useState(false);
  const { confirm, ask, notify } = useDialog();
  const [reordering, setReordering] = useState(false);
  // What authoring THIS board involves — which views it offers, what its entries are called, and
  // what its format still needs from you (lib/tileAuthoring). Everything below asks the model
  // rather than re-deriving "is this a bingo?" from the columns.
  const model = useMemo(() => authoringModel(event), [event]);
  // views[0] is the format's home: a square and a track carry their meaning in their layout, so
  // editing them as a vertical list hides the one thing that makes them what they are. A pool has
  // no geometry to show, so it opens on the list.
  // ?view=map|list|board opens on that view (the event home's "Lay out roads" links to the map).
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<AuthoringView>(() => {
    const asked = VIEW_PARAM[searchParams.get('view') ?? ''];
    return asked && model.views.includes(asked) ? asked : model.views[0];
  });
  // "Quick add: paste your list" — the matcher-backed bulk add (components/tile-creator).
  const [bulkOpen, setBulkOpen] = useState(false);

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
  // Missions dropping "at set times" are planned the same way on ANY board — a classic bingo has no
  // reveal policy, and gating the editor on one left those missions with nowhere to set their time.
  const missionTimes = eventRules.mission?.announceMode === 'scheduled';
  const timedTile = (tile: Tile) => scheduledMode || (missionTimes && !!tile.mission);
  const showsReveal = (tile: Tile) => revealMode || (missionTimes && !!tile.mission);

  function revealChip(tile: Tile): { label: string; cls: string; title?: string } | null {
    if (!showsReveal(tile)) return null;
    if (tile.closedAt) return { label: '🎯 Claimed', cls: 'bg-red-500/20 text-red-300', title: `Claimed ${new Date(tile.closedAt).toLocaleString()}` };
    if (tile.revealedAt) return { label: '🔓 Live', cls: 'bg-accent-green/20 text-accent-green-light', title: `Revealed ${new Date(tile.revealedAt).toLocaleString()}` };
    if (timedTile(tile) && tile.revealAt) {
      return {
        label: `📅 ${new Date(tile.revealAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
        cls: 'bg-blue-500/20 text-blue-300',
        title: 'Scheduled reveal time',
      };
    }
    return {
      label: '🙈 Hidden',
      cls: 'bg-gray-500/20 text-gray-300',
      title: timedTile(tile) ? 'No reveal time set — this tile stays hidden until one is' : 'Waiting to be drawn',
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

  // Effort-model refetch trigger + the balance panel's reviewed, all-at-once "apply suggested points".
  // There is no single-tile apply: suggestions split ONE budget, so applying one moves the total and
  // every other suggestion with it — repeated single applies inflated the board.
  const [tilesVersion, setTilesVersion] = useState(0);
  useEffect(() => setTilesVersion((v) => v + 1), [localTiles]);
  async function applyAllSuggestedPoints(
    changes: Array<{ tileId: number; points: number }>,
    revision: string,
  ): Promise<boolean> {
    const res = await clanFetch(`/api/events/${event.id}/tiles/bulk`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changes, revision }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message = data.error || 'Could not apply the point suggestions.';
      setImportMsg({ type: 'error', text: message });
      notify(message, 'error');
      return false;
    }

    const data = (await res.json()) as {
      updated: number;
      changes: Array<{ tileId: number; points: number }>;
      updatedAt: string;
    };
    const pointByTile = new Map(data.changes.map((change) => [change.tileId, change.points]));
    setLocalTiles((prev) =>
      prev.map((tile) => {
        const points = pointByTile.get(tile.id);
        return points == null ? tile : { ...tile, points, updatedAt: data.updatedAt };
      }),
    );
    notify(`Applied ${data.updated} point suggestion${data.updated === 1 ? '' : 's'}.`);
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
        clanFetch(`/api/events/${event.id}/tiles/${editingTileId}`),
        clanFetch(lockUrl, { method: 'POST' }),
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
        clanFetch(lockUrl, { method: 'POST' })
          .then((r) => r.json())
          .then(applyLock)
          .catch(() => {});
      }, 30_000);
    })();
    return () => {
      cancelled = true;
      if (heartbeat) clearInterval(heartbeat);
      clanFetch(lockUrl, { method: 'DELETE', keepalive: true }).catch(() => {});
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
      const res = await clanFetch(`/api/events/${event.id}/tiles/bulk`, {
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
  // The add-tiles tools fill blank "Tile N" placeholders before they grow anything (api tiles/import),
  // so a fixed grid can use them too while it has blanks left.
  const blankCount = useMemo(() => localTiles.filter(isPlaceholderTile).length, [localTiles]);
  const canAddTiles = !eventStarted && (dynamicBoard || blankCount > 0);

  async function handleAddTile() {
    setAdding(true);
    setImportMsg(null);
    try {
      const res = await clanFetch(`/api/events/${event.id}/tiles`, {
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
      const res = await clanFetch(`/api/events/${event.id}/tiles`, {
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

  // The tile creator filled a blank tile. "Add & another" goes straight to the next blank: a new one
  // on a list board, the next placeholder on a fixed grid.
  function handleCreatorSaved(updated: Tile, another: boolean) {
    setLocalTiles((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
    setEditingFresh((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
    router.refresh();
    if (!another) {
      setEditingTileId(null);
      return;
    }
    const nextBlank = localTiles.find((t) => t.id !== updated.id && isPlaceholderTile(t) && !t.mission);
    if (nextBlank) setEditingTileId(nextBlank.id);
    else if (dynamicBoard && !eventStarted) void handleAddTile();
    else setEditingTileId(null);
  }

  // Copy a configured tile, whole (the tile panel's "Duplicate"). Building a board's actual rhythm is "set one up properly, then make
  // four more like it" — without this that means re-picking the kind, the item, the source list and
  // the points every time. The copy is made server-side from the stored row (see the tiles POST), so
  // it can't quietly miss a field this component doesn't know about.
  async function duplicateTile(tileId: number) {
    setAdding(true);
    setImportMsg(null);
    try {
      const res = await clanFetch(`/api/events/${event.id}/tiles`, {
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
      if (!(await confirm({
        title: `Delete "${tile.label}"?`,
        body: `It carries configuration${summary ? ` — ${summary}` : ''} that goes with it.`,
        confirmLabel: 'Delete',
      }))) {
        return;
      }
    }
    const res = await clanFetch(`/api/events/${event.id}/tiles/${tileId}`, { method: 'DELETE' });
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
  // The box stays instant; the filtered list (hundreds of cards on a Leagues board) follows at low priority.
  const deferredSearch = useDeferredValue(search);
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
    const q = deferredSearch.trim().toLowerCase();
    return boardOnly.filter((t) => {
      if (kindFilter !== 'all' && tileKindFilterKey(t) !== kindFilter) return false;
      if (categoryFilter !== 'all' && !tileHasCategory(t.category, categoryFilter)) return false;
      if (tierFilter !== 'all' && tileTierKey(t.points, tierBands) !== tierFilter) return false;
      return tileMatchesSearch(t, q);
    });
  }, [boardOnly, deferredSearch, kindFilter, categoryFilter, tierFilter, tierBands]);

  const listFiltered = search.trim().length > 0 || kindFilter !== 'all' || categoryFilter !== 'all' || tierFilter !== 'all';

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
      lottery?: boolean;
      trackedItemIds?: number[] | null;
      itemRequirements?: { itemId: number; name: string; requiredAmount: number }[] | null;
      points?: number;
      category?: string | null;
      sourceNpcs?: string[] | null;
      targetNpcs?: string[] | null;
      timedActivity?: string | null;
      timeThresholdSeconds?: number | null;
      partySize?: number | null;
      minRaidLevel?: number | null;
      partyTeamOnly?: boolean | null;
    },
  ) {
    const { trackedItemIds, itemRequirements, sourceNpcs, targetNpcs, optional: updatedOptional, partyTeamOnly, ...rest } = updated;
    setLocalTiles((prev) =>
      prev.map((t) =>
        t.id === tileId
          ? {
              ...t,
              ...rest,
              optional: updatedOptional ? 1 : 0,
              partyTeamOnly: partyTeamOnly === undefined ? t.partyTeamOnly : partyTeamOnly ? 1 : null,
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
      const res = await clanFetch(`/api/events/${event.id}/tiles/reorder`, {
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

  // The list's drag-and-drop: the dragged tile takes the drop target's slot. Optimistic
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

  async function handleShuffle() {
    if (!(await confirm({
      title: 'Shuffle the board?',
      body: 'Every tile keeps its configuration; only the positions move.',
      confirmLabel: 'Shuffle',
      tone: 'gold',
    }))) return;
    const ids = localTiles.map((t) => t.id);
    // Fisher–Yates
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    void applyOrder(ids, 'Board shuffled into a random order.');
  }

  async function handleSortByDifficulty() {
    if (!(await confirm({
      title: 'Sort the board by difficulty?',
      body: 'Tiles are grouped by tier, lowest point value first. Configuration is untouched.',
      confirmLabel: 'Sort',
      tone: 'gold',
    }))) return;
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
        res = await clanFetch(`/api/events/${event.id}/tiles/import`, { method: 'POST', body: form });
      } else {
        const text = await file.text();
        const parsed = parseTileCsv(text);
        if (parsed.error) {
          setImportMsg({ type: 'error', text: parsed.error });
          return;
        }
        res = await clanFetch(`/api/events/${event.id}/tiles/import`, {
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
      const refreshed = await clanFetch(`/api/events/${event.id}/tiles`);
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
      text: `Added ${summary.created} tile${summary.created === 1 ? '' : 's'} from ${summary.activity}${summary.ignored ? ` · ${summary.ignored} skipped (no room left on the board)` : ''}.`,
    });
    await syncTilesFromServer();
  }

  async function handleSkillsCreated(summary: { created: number; ignored: number; label: string }) {
    setImportMsg({
      type: 'success',
      text: `Added ${summary.created} tile${summary.created === 1 ? '' : 's'} (${summary.label})${summary.ignored ? ` · ${summary.ignored} skipped (no room left on the board)` : ''}.`,
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
    if (!(await confirm({
      title: `Add ${usable.length} task${usable.length === 1 ? '' : 's'} to the library?`,
      body: 'Later boards can draw from them. Placeholder tiles are skipped, and nothing here is deduplicated against what the library already holds.',
      confirmLabel: 'Add them',
      tone: 'gold',
    }))) return;
    setSavingToLibrary(true);
    try {
      const res = await clanFetch('/api/admin/tile-library', {
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
    missionsEnabled={missionsEnabled}
    cofferAvailable={cofferAvailable}
    canDelete={canEditTileSet}
    canLab={canLab}
    revealEditor={
      showsReveal(editingTile) ? (
        <RevealAtEditor
          tile={editingTile}
          eventId={event.id}
          scheduled={timedTile(editingTile)}
          isAdmin={isAdmin}
          onSaved={(revealAt) => handleRevealAtSaved(editingTile.id, revealAt)}
          onStateChanged={handleRevealStateChanged}
        />
      ) : null
    }
    onClose={() => openTileGuarded(null)}
    onCreated={handleCreatorSaved}
    onOpenBulk={canAddTiles ? () => leaveGuard(() => { setEditingTileId(null); setBulkOpen(true); }) : undefined}
    canAddAnother={(dynamicBoard && !eventStarted) || localTiles.filter((t) => isPlaceholderTile(t) && !t.mission).length > 1}
    onDuplicate={canEditTileSet && dynamicBoard && !eventStarted ? () => void duplicateTile(editingTile.id) : undefined}
    onDelete={() => handleDeleteTile(editingTile.id, true)}
    onSaved={(updated) => {
      handleTileConfigSaved(editingTile.id, updated);
      setEditingTileId(null);
    }}
        />
  ) : null;

  // The board (map, grid or list) on the left and the tile panel beside it, on a wide screen.
  const dock = (content: React.ReactNode) => (
    <div className={editingTile && inspectorDocked ? DOCKED_GRID : ''}>
      <div className="min-w-0">{content}</div>
      {editingTile && inspectorDocked && <div className="hidden xl:block">{renderInspector(true)}</div>}
    </div>
  );

  return (
    // Disabled fieldset natively disables every control inside — the locked (finished) event's
    // tile authoring goes read-only in one place. min-w-0 defeats fieldset's min-content default.
    // data-wide-page: the site's main column widens for this page on big screens (app/layout).
    <fieldset disabled={editLocked} data-wide-page className="space-y-8 block min-w-0 border-0 p-0 m-0">
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
            <p className="mt-1.5">
              <GuideLink href="/guide/board#kinds">What each tile kind tracks</GuideLink>
            </p>
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
            {/* Every way to add tiles in bulk lives in one menu: generators first (what people reach
                for), then the file and library round-trips. */}
            <ActionMenu
              label={`＋ Add ${model.nounPlural}`}
              items={[
                { label: 'Quick add: paste your list…', onClick: () => setBulkOpen(true), disabled: !canAddTiles, variant: 'gold' },
                { label: 'Draw from task library…', onClick: () => setGenerator('library'), disabled: !canAddTiles },
                { label: 'From a collection log page…', onClick: () => setGenerator('clog'), disabled: !canAddTiles },
                { label: 'Skill XP tiles…', onClick: () => setGenerator('skill'), disabled: !canAddTiles },
                { label: 'Boss KC / kill tiles…', onClick: () => setGenerator('boss'), disabled: !canAddTiles },
                {
                  label: importing ? 'Importing…' : 'Upload CSV / Excel…',
                  onClick: () => fileInputRef.current?.click(),
                  disabled: importing,
                  separatorBefore: true,
                },
                {
                  label: 'Download spreadsheet',
                  onClick: () => { window.location.href = clanUrl(`/api/events/${event.id}/tiles/spreadsheet`); },
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
                  label: 'Export as task pack',
                  onClick: () => { window.location.href = clanUrl(`/api/admin/tile-library/export?eventId=${event.id}`); },
                },
              ]}
            />
            {/* Dialogs only — the menu is their trigger. */}
            <ClogGenerator
              eventId={event.id}
              canGrow={canAddTiles}
              pointsMode={pointsMode}
              onCreated={handleClogCreated}
              onError={(text) => setImportMsg({ type: 'error', text })}
              hideTrigger
              open={generator === 'clog'}
              onOpenChange={(v) => setGenerator(v ? 'clog' : null)}
            />
            <SkillTileGenerator
              eventId={event.id}
              canGrow={canAddTiles}
              pointsMode={pointsMode}
              onCreated={handleSkillsCreated}
              onError={(text) => setImportMsg({ type: 'error', text })}
              hideTrigger
              open={generator === 'skill'}
              onOpenChange={(v) => setGenerator(v ? 'skill' : null)}
            />
            <BossTileGenerator
              eventId={event.id}
              canGrow={canAddTiles}
              pointsMode={pointsMode}
              onCreated={handleSkillsCreated}
              onError={(text) => setImportMsg({ type: 'error', text })}
              hideTrigger
              open={generator === 'boss'}
              onOpenChange={(v) => setGenerator(v ? 'boss' : null)}
            />
            <LibraryTileGenerator
              eventId={event.id}
              canGrow={canAddTiles}
              target={dynamicBoard ? undefined : blankCount}
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
            onPick={(id) => openTileGuarded(id)}
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
            onPick={(id) => openTileGuarded(id)}
            onReorder={(ids, describe) => {
              setLocalTiles((prev) => {
                const byId = new Map(prev.map((t) => [t.id, t]));
                return ids.map((id, i) => ({ ...byId.get(id)!, position: i }));
              });
              void applyOrder(ids, describe);
            }}
            onRevealStateChanged={handleRevealStateChanged}
          />
        ) : viewMode === 'routes' ? (
          dock(
          <RaceRouteEditor
            eventId={event.id}
            tiles={localTiles}
            eventStarted={eventStarted}
            isAdmin={isAdmin}
            raceBank={eventRules.raceBank}
            raceRoad={eventRules.raceRoad}
            onTileCreated={(tile) => setLocalTiles((prev) => [...prev, tile])}
            onSaved={(update) => {
              setLocalTiles((prev) =>
                prev
                  .map((t) => {
                    const u = update.get(t.id);
                    if (!u) return t;
                    return { ...t, raceStep: u.raceStep, raceNext: u.raceNext, ...(u.position != null && u.position >= 0 ? { position: u.position } : {}) };
                  })
                  .sort((a, b) => a.position - b.position),
              );
              router.refresh();
            }}
            onRaceBankChanged={() => router.refresh()}
            openTileId={editingTileId}
            onOpenTile={(id) => openTileGuarded(id)}
            panelBeside={inspectorDocked}
            onDeleteTile={canEditTileSet ? (id) => void handleDeleteTile(id) : undefined}
          />
          )
        ) : viewMode === 'board' ? (
          dock(
          <div className="min-w-0">
            <p className="text-xs text-text-muted mb-3">
              Click any square to write that {model.noun}. This is exactly the board members will see.
            </p>
            <EventBoard
              format={event.format}
              tiles={localTiles}
              boardSize={event.boardSize}
              completions={[]}
              teams={[]}
              pointsMode={pointsMode}
              onTileClick={(tileId) => openTileGuarded(tileId)}
              showStatusFilter={false}
              staffOnlyTileIds={hiddenTileIds}
            />
          </div>
          )
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
          className={editingTile && inspectorDocked ? DOCKED_GRID : ''}
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
                onClick={async () => {
                  const raw = await ask({
                    title: `Points for ${selectedIds.size} ${model.nounPlural}`,
                    label: 'Point value',
                    placeholder: '10',
                    required: true,
                  });
                  if (raw === null) return;
                  const points = parseInt(raw, 10);
                  if (!Number.isInteger(points) || points < 0) {
                    setBulkMsg('That did not read as a point value — whole numbers only.');
                    return;
                  }
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
              onClick={async () => {
                const category = await ask({
                  title: `Category for ${selectedIds.size} ${model.nounPlural}`,
                  body: 'Leave it blank to clear the category instead.',
                  label: 'Category',
                  placeholder: 'Skilling',
                });
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
                onClick={async () => {
                  const raw = await ask({
                    title: `Open all ${selectedIds.size} at the same moment`,
                    body: 'Leave it blank to clear the reveal time and let the schedule decide.',
                    label: 'Date and time',
                    placeholder: '2026-08-16 20:00',
                  });
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
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Hide ${selectedIds.size} from members again?`,
                      body: 'Progress already made on them stays, but they stop being playable until they open again.',
                      confirmLabel: 'Hide them',
                    });
                    if (!ok) return;
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
            // Drag a card onto another to move it there. Off while a filter shows only some tiles
            // (a drop would move tiles by slots you can't see) and once the event has started.
            const draggable = !eventStarted && !reordering && !listFiltered;
            return (
              <button
                key={tile.id}
                onClick={(e) => pickTile(tile.id, e)}
                draggable={draggable}
                title={draggable ? 'Click to edit · drag to move' : undefined}
                onDragStart={(e) => {
                  setDragTileId(tile.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  if (dragTileId == null) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setDragOverTileId(tile.id);
                }}
                onDragLeave={() => setDragOverTileId((cur) => (cur === tile.id ? null : cur))}
                onDrop={(e) => {
                  e.preventDefault();
                  handleTileDrop(tile.id);
                }}
                onDragEnd={() => {
                  setDragTileId(null);
                  setDragOverTileId(null);
                }}
                className={`group/tile relative text-left border rounded-xl bg-card-bg hover:bg-card-bg-hover transition-colors overflow-hidden ${dragTileId === tile.id ? 'opacity-40' : ''} ${dragOverTileId === tile.id && dragTileId !== tile.id ? 'ring-2 ring-gold' : ''} ${
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
        {(missionsEnabled || missionPool.length > 0) && (
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
                      onClick={() => openTileGuarded(isEditing ? null : tile.id)}
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
        onApplyAllPoints={applyAllSuggestedPoints}
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
            <ClanLink href="/admin/tile-library" className="text-gold hover:text-gold-light">your task library</ClanLink>.
          </p>
        </div>
      </details>

      {/* The covering drawer: narrow screens (no room for two panes) and the views with no column to
          dock into (schedule, rotation). */}
      {editingTile && (!inspectorDocked || !DOCKING_VIEWS.has(viewMode)) && renderInspector(false)}

      {/* "Quick add: paste your list" */}
      {bulkOpen && (
        <BulkQuickAdd
          eventId={event.id}
          pointsMode={pointsMode}
          tierBands={tierBands}
          teamPlay={teamPlay}
          onClose={() => setBulkOpen(false)}
          onUploadFile={() => { setBulkOpen(false); fileInputRef.current?.click(); }}
          onCreated={async (summary) => {
            setBulkOpen(false);
            setImportMsg({
              type: 'success',
              text: `Added ${summary.created + summary.applied} tile${summary.created + summary.applied === 1 ? '' : 's'} from your list${summary.ignored ? ` · ${summary.ignored} skipped (no room left on the board)` : ''}.`,
            });
            await syncTilesFromServer();
          }}
        />
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
  board: () => ({ label: 'Board', title: 'The board as members see it: click a square to write it' }),
  routes: () => ({ label: 'Map', title: 'The race map: lay out the roads and click a tile to write it' }),
  cards: () => ({ label: 'List', title: 'Every tile in a list: search, drag to reorder, edit several at once' }),
  schedule: () => ({ label: '🕑 Schedule', title: 'The reveal plan: when each one opens' }),
  rotation: () => ({ label: '🎲 Rotation', title: 'The draw pool, in the order the engine pulls from it' }),
};

/** ?view= words, as the event home links to them. */
const VIEW_PARAM: Record<string, AuthoringView> = { map: 'routes', list: 'cards', board: 'board', schedule: 'schedule', rotation: 'rotation' };

/** Board + tile panel columns. The panel gets real room (it is where tiles are written): 26rem on a
 *  1280px screen, 34rem once the page has widened past 1536px. */
const DOCKED_GRID = 'xl:grid xl:grid-cols-[minmax(0,1fr)_26rem] 2xl:grid-cols-[minmax(0,1fr)_34rem] xl:gap-5';

/** The views with room for the tile panel beside them on a wide screen. */
const DOCKING_VIEWS = new Set<AuthoringView>(['board', 'routes', 'cards']);

// The kind badge, its one-line config summary and the kind filter's options all live in
// lib/tileKinds, next to the kind derivation they read — every authoring view needs the same
// answers about the same tile, and a second copy here would be a second copy to drift.
type KindFilter = 'all' | TileKindKey;

// ISO → a local wall-clock string (YYYY-MM-DDTHH:MM), the form the reveal field keeps its state in.
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
  const { confirm } = useDialog();
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function setRevealState(next: 'live' | 'hidden') {
    if (
      next === 'hidden' &&
      !(await confirm({
        title: 'Hide this tile from members again?',
        body: 'Any progress on it stays, but it stops being playable until it opens again.',
        confirmLabel: 'Hide it',
      }))
    )
      return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await clanFetch(`/api/events/${eventId}/tiles`, {
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
      const res = await clanFetch(`/api/events/${eventId}/tiles`, {
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
            <div className="w-56">
              <DateTimePicker
                value={value ? new Date(value).toISOString() : ''}
                onChange={(iso) => setValue(toLocalInputValue(iso))}
                ariaLabel="Reveal time"
              />
            </div>
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
  missionsEnabled?: boolean;
  /** Coffer gp available for mission prizes, or null where the board pays none. */
  cofferAvailable?: number | null;
  /** Reveal-policy events: the reveal status/schedule panel rendered above the tracking config. */
  revealEditor?: React.ReactNode;
  /** What one entry on this board is called — a ladder's are tasks (lib/tileAuthoring). */
  noun?: string;
  canLab?: boolean;
  /** A blank tile was filled through the tile creator (the flow a NEW tile opens on). */
  onCreated?: (updated: Tile, another: boolean) => void;
  onOpenBulk?: () => void;
  canAddAnother?: boolean;
  /** Copy this tile, whole, and open the copy. */
  onDuplicate?: () => void;
}

function TileConfigDrawer({ tile, docked = false, noun = 'Tile', eventId, eventStarted, isAdmin, pointsMode, canDelete, onClose, onDelete, onSaved, tierBands, lockHolder, categorySuggestions, teamPlay, missionsAllowed, missionsEnabled, cofferAvailable, revealEditor, canLab = false, onCreated, onOpenBulk, canAddAnother, onDuplicate }: DrawerProps) {
  // A blank placeholder before the start is a NEW tile: it opens on the tile creator ("what should
  // players do?") instead of the full editor, which stays one tap away under "More options".
  const creating = !eventStarted && isPlaceholderTile(tile) && !tile.mission && !!onCreated;
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
            : 'relative w-full sm:max-w-xl h-full bg-card-bg sm:border-l border-card-border shadow-2xl flex flex-col focus:outline-none animate-drawer-slide'
        }
      >
        {/* Header */}
        <div className="shrink-0 bg-card-bg border-b border-card-border px-5 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-text-muted">{noun} {tile.position + 1}</p>
            <h3 id={titleId} className="text-lg font-bold text-foreground leading-snug line-clamp-2 break-words">
              {creating ? `New ${noun.toLowerCase()}` : tile.label}
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
        <div ref={bodyRef} className="flex-1 min-h-0 px-5 sm:px-6 pt-5 pb-6 overflow-y-auto">
          {lockHolder && (
            <p className="mb-3 text-xs px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-200">
              🔒 <span className="font-semibold">{lockHolder}</span> is editing this tile right now — if you both
              save, the second save is rejected instead of overwriting.
            </p>
          )}
          {revealEditor}
          {creating ? (
            <TileCreator
              tile={tile}
              eventId={eventId}
              pointsMode={pointsMode}
              tierBands={tierBands ?? DEFAULT_TIER_BANDS}
              teamPlay={teamPlay ?? true}
              canAddAnother={canAddAnother}
              onSaved={onCreated}
              onOpenBulk={onOpenBulk}
              renderFullEditor={(draft) => (
                <TileTrackingConfig
                  tileId={tile.id}
                  eventId={eventId}
                  initial={draftToTileConfig(tileToTrackingInitial(tile), draft)}
                  onSaved={onSaved}
                  eventStarted={eventStarted}
                  isAdmin={isAdmin}
                  pointsMode={pointsMode}
                  tierBands={tierBands}
                  categorySuggestions={categorySuggestions}
                  teamPlay={teamPlay}
                  missionsAllowed={missionsAllowed}
                  missionsEnabled={missionsEnabled}
                  cofferAvailable={cofferAvailable}
                  hideTaskFinder
                />
              )}
            />
          ) : (
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
            missionsEnabled={missionsEnabled}
            cofferAvailable={cofferAvailable}
          />
          )}

          {/* The quiet things, below the task: copy it, try it in the lab, delete it. */}
          {(onDuplicate || (canDelete && onDelete)) && (
            <div className="mt-8 pt-4 border-t border-card-border/60 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
              {onDuplicate && !creating && (
                <button type="button" onClick={onDuplicate} className="min-h-9 text-text-muted hover:text-gold transition-colors">
                  Duplicate this {noun.toLowerCase()}
                </button>
              )}
              {canDelete && onDelete && (
                confirmingDelete ? (
                  <span className="ml-auto flex items-center gap-2">
                    <span className="text-text-muted">Delete it for good?</span>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      disabled={deleting}
                      className="px-3 py-1.5 rounded-lg border border-card-border text-text-muted hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleting(true);
                        onDelete();
                      }}
                      disabled={deleting}
                      className="font-semibold px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/40 text-red-300 hover:bg-red-500/25 transition-colors disabled:opacity-50"
                    >
                      {deleting ? 'Deleting…' : 'Delete'}
                    </button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirmingDelete(true)} className="ml-auto min-h-9 text-red-400/80 hover:text-red-300 transition-colors">
                    Delete this {noun.toLowerCase()}
                  </button>
                )
              )}
            </div>
          )}
          {canLab && (
            <details className="mt-3 group/lab">
              <summary className="cursor-pointer list-none text-xs text-text-muted hover:text-foreground">
                <span className="inline-block transition-transform group-open/lab:rotate-90" aria-hidden>▸</span> Test it in the lab
              </summary>
              <TestInLabButton tileId={tile.id} mission={!!tile.mission} />
            </details>
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
