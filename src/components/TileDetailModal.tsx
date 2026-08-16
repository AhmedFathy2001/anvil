'use client';

import { useState, useEffect } from 'react';
import ImageUpload from './ImageUpload';
import LocalTime from '@/components/LocalTime';
import Select from '@/components/Select';
import Input from '@/components/Input';
import NumberInput from '@/components/NumberInput';
import Textarea from '@/components/Textarea';
import { formatNumber } from '@/lib/utils';
import type { Tile, Submission, ItemRequirementProgress } from '@/lib/types';
import ManualOnlyBadge from './ManualOnlyBadge';
import TileTargets from './TileTargets';
import { statLabel, parseJsonArray } from '@/lib/tileKinds';
import { lapUnitNoun } from '@/lib/constants';
import { isIndividualMode } from '@/lib/statTracking';
import { evaluateCollection, groupModeHint } from '@/lib/collectionSets';
import { submissionHasProof } from '@/lib/submissionProof';
import ProofGallery, { type ProofShot } from './ProofGallery';
import { isManualOnlyDropTile } from '@/lib/clogManual';
import { useModalA11y } from '@/hooks/useModalA11y';

// mm:ss / h:mm:ss / bare-seconds → seconds. Returns null for unparseable input.
function clockToSeconds(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  if (/^\d+$/.test(v)) return parseInt(v, 10);
  const parts = v.split(':').map((p) => p.trim());
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const nums = parts.map((p) => parseInt(p, 10));
  return parts.length === 2 ? nums[0] * 60 + nums[1] : nums[0] * 3600 + nums[1] * 60 + nums[2];
}

function secondsToClock(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Parse a loot-value entry: "5m", "500k", "2.5m", or plain gp (commas ok). Null if unparseable.
function parseGp(raw: string): number | null {
  const v = raw.trim().toLowerCase().replace(/,/g, '');
  const m = v.match(/^(\d+(?:\.\d+)?)\s*([kmb])?$/);
  if (!m) return null;
  const mult = m[2] === 'b' ? 1_000_000_000 : m[2] === 'm' ? 1_000_000 : m[2] === 'k' ? 1_000 : 1;
  const n = Math.round(parseFloat(m[1]) * mult);
  return Number.isFinite(n) && n >= 1 && n <= 2_147_483_647 ? n : null;
}

interface CompletedByTeam {
  teamId: number;
  teamName: string;
  color: string;
}

interface TeamPlayer {
  id: number;
  name: string;
}

interface PlayerStatProgress {
  playerId: number;
  playerName: string;
  current: number;
  gained: number;
}

// Per-team stat gains toward a tile's goal — used on the public scoreboard, which has no single-team
// context and instead compares every team on one stat tile (the per-player `statProgress` above is
// for a single team's board). Additive/optional: surfaces that don't pass it render exactly as before.
interface TeamStatProgress {
  teamId: number;
  teamName: string;
  color: string;
  gained: number;
}

interface Props {
  tile: Tile;
  submissions: Submission[];
  /** Proof is being fetched — show a placeholder rather than "no submissions" while it lands. */
  submissionsLoading?: boolean;
  completedBy: CompletedByTeam[];
  canSubmit: boolean;
  canManage: boolean;
  canToggle: boolean;
  onSubmit?: (data: { tileId: number; teamId: number; amount: number; imageUrl: string; note: string; creditPlayerId: number | null; durationSeconds?: number; itemId?: number }) => Promise<void>;
  onDelete?: (submissionId: number, reason: string) => Promise<void>;
  onToggle?: (tileId: number) => Promise<void>;
  onClose: () => void;
  eventId: number;
  teamId?: number;
  dropProgress?: { current: number; required: number };
  perItemProgress?: ItemRequirementProgress[];
  teamPlayers?: TeamPlayer[];
  currentPlayerId?: number;
  statProgress?: PlayerStatProgress[];
  // Public scoreboard only: per-team gains toward this stat tile's goal (all teams compared).
  teamStatProgress?: TeamStatProgress[];
  pointsMode?: boolean;
  // Admin all-teams view: label each submission with its team (submissions can span teams here).
  teamNameById?: Record<number, string>;
}

/** Contributor rows shown before "Show all" — enough to see the shape of a board without a wall. */
const CONTRIBUTOR_PREVIEW = 8;

export default function TileDetailModal({
  tile,
  submissions,
  submissionsLoading = false,
  completedBy,
  canSubmit,
  canManage,
  canToggle,
  onSubmit,
  onDelete,
  onToggle,
  onClose,
  eventId,
  teamId,
  dropProgress,
  perItemProgress,
  teamPlayers,
  currentPlayerId,
  statProgress,
  teamStatProgress,
  pointsMode,
  teamNameById,
}: Props) {
  const [amount, setAmount] = useState('1');
  const [imageUrls, setImageUrls] = useState<string[]>(['']);
  const [note, setNote] = useState('');
  // Timed-tile clear time entered as mm:ss.
  const [clearTime, setClearTime] = useState('');
  // Loot-value tile: haul value entered as gp (accepts 5m / 500k / raw).
  const [valueGp, setValueGp] = useState('');
  const [creditPlayerId, setCreditPlayerId] = useState<string>(currentPlayerId ? String(currentPlayerId) : '');
  // Which item in the set a collection submission is for. Required by the API for per-item tiles, so
  // without a picker the submission was rejected 400 and silently dropped.
  const [itemId, setItemId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [toggling, setToggling] = useState(false);
  // Which proof is open full-size, and the set to arrow through (one contributor's shots).
  const [viewer, setViewer] = useState<{ shots: ProofShot[]; index: number } | null>(null);
  const [showAllContributors, setShowAllContributors] = useState(false);
  const [error, setError] = useState('');
  // Delete confirmation modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteSubmissionId, setDeleteSubmissionId] = useState<number | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  const parsedAmount = parseInt(amount, 10) || 1;

  // Screenshot slots follow the amount ONLY for real item drops (each drop is a distinct loot event
  // you can capture). Kills / gains / completions can't be screenshotted one-by-one, so they keep a
  // single proof screenshot for the whole entered amount.
  useEffect(() => {
    const targetLength = tile.tileType === 'drop' ? Math.max(1, parsedAmount) : 1;
    setImageUrls((prev) => {
      if (prev.length === targetLength) return prev;
      if (prev.length < targetLength) {
        return [...prev, ...Array(targetLength - prev.length).fill('')];
      }
      return prev.slice(0, targetLength);
    });
  }, [parsedAmount, tile.tileType]);

  // Reset form when tile changes or modal opens
  useEffect(() => {
    setAmount('1');
    setImageUrls(['']);
    setNote('');
    setClearTime('');
    setCreditPlayerId(currentPlayerId ? String(currentPlayerId) : '');
    setError('');
  }, [tile.id, currentPlayerId]);

  const isCompleted = completedBy.length > 0;
  const isDrop = tile.tileType === 'drop';
  const isKill = tile.tileType === 'kill';
  const isLap = tile.tileType === 'lap';
  const isPvp = tile.tileType === 'pvp';
  const isTimed = tile.tileType === 'timed';
  const isDiary = tile.tileType === 'diary';
  const isCa = tile.tileType === 'ca';
  const isGain = tile.tileType === 'gain';
  const isDeathless = tile.tileType === 'deathless';
  const isLms = tile.tileType === 'lms';
  const isValue = tile.tileType === 'value' || tile.tileType === 'valuetotal';
  const manualOnly = isManualOnlyDropTile(tile);
  // Count-based tiles share the amount+proof "Add Submission" form. Value tiles use a gp-value form
  // (below); timed uses its own clear-time form; stat/standard have no manual submit.
  const isCount = isDrop || isKill || isLap || isPvp || isGain || isDiary || isCa || isDeathless || isLms;
  // Only real item drops ask for one screenshot per unit; every other count tile takes a SINGLE proof
  // screenshot for the whole entered amount (you can't screenshot 170 kills individually).
  const perUnitProof = isDrop;
  // Collection tile = a drop tile with per-item requirements. Its submissions must name WHICH item in
  // the set (itemId), so the count form gets an item picker and handleSubmit requires a selection.
  const itemReqs: { itemId: number; name: string }[] = (() => {
    if (!tile.itemRequirements) return [];
    try {
      const parsed = JSON.parse(tile.itemRequirements);
      return Array.isArray(parsed)
        ? parsed.filter((r) => r && typeof r.itemId === 'number').map((r) => ({ itemId: r.itemId, name: r.name ?? `Item ${r.itemId}` }))
        : [];
    } catch {
      return [];
    }
  })();
  const isCollection = isDrop && itemReqs.length > 0;
  const isStatTile = !!tile.trackedStat;
  // Noun used in the count-based submission form copy ("drop" vs "kill" vs "completion" vs "item").
  const countNoun = isKill || isPvp ? 'kill' : isLap ? lapUnitNoun(parseJsonArray<string>(tile.targetNpcs)) : isDiary || isCa ? 'completion' : isGain ? 'item' : isDeathless ? 'run' : isLms ? 'game' : 'drop';
  const kindLabel = isDrop ? 'Drop' : isKill ? 'Kill' : isLap ? (countNoun === 'lap' ? 'Agility laps' : 'Hallowed Sepulchre') : isPvp ? 'PvP kill' : isGain ? 'Item gain' : isDiary ? 'Diary' : isCa ? 'Combat task' : isDeathless ? 'Deathless' : isLms ? 'LMS' : isValue ? 'Loot value' : isTimed ? 'Timed' : isStatTile ? (tile.statType === 'boss' ? 'Boss KC' : 'XP') : 'Standard';

  // Kill/count tiles land one auto submission per kill (no screenshot), so a 500-kill tile is 500
  // identical rows. List only submissions with real proof (a screenshot or a human note) and roll
  // the bare auto logs up per player into one line. Timed tiles stay individual — each run is a
  // distinct clear time and there are never many.
  const proofSubs = submissions.filter(submissionHasProof);
  const individualSubs = isTimed ? submissions : proofSubs;

  // Proof rows carry only what the gallery needs, so the delete gate looks the original submission
  // back up rather than duplicating (or weakening) canDeleteSubmission's rule.
  const submissionById = new Map(submissions.map((sub) => [sub.id, sub]));
  const canDeleteShot = (id: number) => {
    const sub = submissionById.get(id);
    return sub ? canDeleteSubmission(sub) : false;
  };

  // ONE row per contributor, not one card per submission.
  //
  // A tile on a 40-person clan collects hundreds of submissions, and rendering each as a card with a
  // full-width screenshot made the panel unreadable at about six. The thing a reader actually wants
  // is who contributed and how much; the screenshots are evidence you open when you doubt a number.
  //
  // Auto-logs and proof submissions are merged here for the same reason they were separate before —
  // a kill tile lands one bare log per kill — but split across two lists a player who had both
  // appeared twice with two partial totals. Keyed exactly as the old bare-log rollup was, so the
  // halves can't disagree about who is who.
  const contributors = (() => {
    if (isTimed) return [];
    type Row = {
      key: string;
      teamId: number | null;
      playerName: string | null;
      amount: number;
      autoLogs: number;
      /** Credits that landed without a starting shot on file (lib/startProof) — staff should look. */
      flagged: number;
      shots: ProofShot[];
    };
    const m = new Map<string, Row>();
    for (const sub of submissions) {
      const key = `${sub.teamId ?? ''}|${sub.creditPlayerId ?? sub.creditPlayerName ?? ''}`;
      const row = m.get(key) ?? {
        key,
        teamId: sub.teamId ?? null,
        playerName: sub.creditPlayerName ?? null,
        amount: 0,
        autoLogs: 0,
        flagged: 0,
        shots: [],
      };
      row.amount += sub.amount;
      if (sub.flaggedReason) row.flagged += 1;
      if (submissionHasProof(sub)) {
        if (sub.imageUrl) {
          row.shots.push({
            id: sub.id,
            imageUrl: sub.imageUrl,
            credit: sub.creditPlayerName ?? sub.uploaderName ?? null,
            note: sub.note ?? null,
            createdAt: sub.createdAt,
            amountLabel: isValue
              ? `${sub.amount.toLocaleString()} gp`
              : `${sub.amount} ${countNoun}${sub.amount !== 1 ? 's' : ''}`,
          });
        }
      } else {
        row.autoLogs += 1;
      }
      m.set(key, row);
    }
    for (const row of m.values()) {
      // Newest proof first — the most recent evidence is the one being questioned.
      row.shots.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    return [...m.values()].sort((a, b) => b.amount - a.amount);
  })();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!onSubmit || !teamId) return;

    // Timed tiles: one screenshot + a clear time. The plugin normally bakes & submits this;
    // the web form is a manual fallback.
    if (isTimed) {
      const img = imageUrls.find((url) => url && url.trim());
      if (!img) {
        setError('Please upload a screenshot of the clear.');
        return;
      }
      const secs = clockToSeconds(clearTime);
      if (secs == null || secs < 1 || secs > 86400) {
        setError('Enter the clear time as mm:ss (e.g. 28:30).');
        return;
      }
      setError('');
      setSubmitting(true);
      try {
        await onSubmit({
          tileId: tile.id,
          teamId,
          amount: 1,
          imageUrl: img,
          note,
          creditPlayerId: creditPlayerId ? parseInt(creditPlayerId, 10) : null,
          durationSeconds: secs,
        });
        setImageUrls(['']);
        setNote('');
        setClearTime('');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Validate all images are uploaded
    const validImages = imageUrls.filter((url) => url && url.trim());
    if (validImages.length === 0) {
      setError('Please upload at least one image as evidence');
      return;
    }

    // Real drops want one screenshot per unit; other count tiles take a single proof for the amount.
    if (perUnitProof && parsedAmount > 1 && validImages.length < parsedAmount) {
      setError(`Please upload ${parsedAmount} images (one for each drop)`);
      return;
    }

    // Validate credit player selection
    if (!creditPlayerId) {
      setError(`Please select who got this ${countNoun}`);
      return;
    }

    // Collection tiles track each item in the set separately, so a submission must say which one.
    if (isCollection && !itemId) {
      setError('Please choose which item in the set this is for');
      return;
    }
    const submittedItemId = isCollection ? parseInt(itemId, 10) : undefined;

    setError('');
    setSubmitting(true);
    try {
      // Submit each image as a separate submission with amount=1
      // Or if only 1 image, submit with the full amount
      if (validImages.length === 1) {
        await onSubmit({
          tileId: tile.id,
          teamId,
          amount: parsedAmount,
          imageUrl: validImages[0],
          note,
          creditPlayerId: parseInt(creditPlayerId, 10),
          itemId: submittedItemId,
        });
      } else {
        // Multiple images = multiple submissions
        for (const url of validImages) {
          await onSubmit({
            tileId: tile.id,
            teamId,
            amount: 1,
            imageUrl: url,
            note,
            creditPlayerId: parseInt(creditPlayerId, 10),
            itemId: submittedItemId,
          });
        }
      }
      setAmount('1');
      setImageUrls(['']);
      setNote('');
      setCreditPlayerId('');
      setItemId('');
    } catch (err) {
      // Surface a rejected submission instead of silently clearing the form (the old behaviour made a
      // 400 look like success — the collection-tile "submitted but not recorded" bug).
      setError(err instanceof Error ? err.message : 'Could not submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function openDeleteModal(submissionId: number) {
    setDeleteSubmissionId(submissionId);
    setDeleteReason('');
    setDeleteModalOpen(true);
  }

  async function confirmDelete() {
    if (!onDelete || !deleteSubmissionId) return;
    if (!deleteReason.trim()) return;
    setDeletingId(deleteSubmissionId);
    try {
      await onDelete(deleteSubmissionId, deleteReason.trim());
      setDeleteModalOpen(false);
      setDeleteSubmissionId(null);
      setDeleteReason('');
    } finally {
      setDeletingId(null);
    }
  }

  function cancelDelete() {
    setDeleteModalOpen(false);
    setDeleteSubmissionId(null);
    setDeleteReason('');
  }

  // Check if user can delete a specific submission
  function canDeleteSubmission(submission: Submission): boolean {
    // If canManage is true (captain/admin), can delete any team submission
    if (canManage) return true;
    // Otherwise, players can only delete their own submissions (where they uploaded it)
    if (currentPlayerId && submission.playerId === currentPlayerId) return true;
    return false;
  }

  // Loot-value tile submit: one gp-valued haul + a proof screenshot. The server decides completion
  // (single-haul: a submission ≥ threshold; total: the sum reaches it), so we just submit the amount.
  async function handleValueSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!onSubmit || !teamId) return;
    const gp = parseGp(valueGp);
    if (gp == null) {
      setError('Enter a haul value like 5m, 500k, or 5000000.');
      return;
    }
    const img = imageUrls.find((url) => url && url.trim());
    if (!img) {
      setError('Please upload a screenshot of the loot as evidence.');
      return;
    }
    if (!creditPlayerId) {
      setError('Please select who got this loot.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onSubmit({
        tileId: tile.id,
        teamId,
        amount: gp,
        imageUrl: img,
        note,
        creditPlayerId: parseInt(creditPlayerId, 10),
      });
      setValueGp('');
      setImageUrls(['']);
      setNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle() {
    if (!onToggle) return;
    setToggling(true);
    try {
      await onToggle(tile.id);
    } finally {
      setToggling(false);
    }
  }

  const modalRef = useModalA11y<HTMLDivElement>({ onClose });
  const titleId = `tile-modal-title-${tile.id}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative bg-card-bg border border-card-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl focus:outline-none"
      >
        {/* Header */}
        <div className="sticky top-0 bg-card-bg border-b border-card-border p-4 rounded-t-2xl flex items-start justify-between">
          <div className="flex items-start gap-3 min-w-0">
            {tile.icon && (
              <div className="w-10 h-10 flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={tile.icon} alt="" className="w-full h-full object-contain" />
              </div>
            )}
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-bold text-foreground truncate">{tile.label}</h2>
              {tile.description && (
                <p className="text-sm text-text-muted mt-0.5">{tile.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  isCount
                    ? 'bg-accent-green/20 text-accent-green-light'
                    : isStatTile
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-gold/20 text-gold'
                }`}>
                  {kindLabel}
                </span>
                {manualOnly && <ManualOnlyBadge />}
                {isStatTile && tile.statGoal && (
                  <span className="text-xs text-text-muted">
                    Goal: {tile.statGoal.toLocaleString()} {tile.statType === 'boss' ? 'KC' : 'XP'}
                  </span>
                )}
                {(isKill || isLap || isPvp) && tile.requiredAmount && (
                  <span className="text-xs text-text-muted">
                    Goal: {tile.requiredAmount.toLocaleString()} kill{tile.requiredAmount !== 1 ? 's' : ''}
                  </span>
                )}
                {isTimed && tile.timeThresholdSeconds && (
                  <span className="text-xs text-text-muted">
                    Cap: ≤ {secondsToClock(tile.timeThresholdSeconds)}
                    {tile.timedActivity ? ` · ${tile.timedActivity}` : ''}
                  </span>
                )}
                {pointsMode && !tile.optional && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-medium">
                    {tile.points ?? 1} pt{(tile.points ?? 1) !== 1 ? 's' : ''}
                  </span>
                )}
                {isCompleted && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-accent-green/20 text-accent-green-light font-medium">
                    Completed
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="text-text-muted hover:text-foreground text-xl leading-none flex-shrink-0 ml-2 -mr-1 -mt-1 p-2"
          >
            &times;
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* What the tile tracks — the admin-configured items/NPCs/raid. Item lists are
              suppressed when the per-item progress section below already names them. */}
          <TileTargets tile={tile} hideItems={!!perItemProgress?.length} />

          {/* Completion status */}
          {completedBy.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {completedBy.map((team) => (
                <span
                  key={team.teamId}
                  className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border"
                  style={{ borderColor: team.color, color: team.color }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: team.color }} />
                  {team.teamName}
                </span>
              ))}
            </div>
          )}

          {/* Drop / kill tile progress */}
          {isCount && dropProgress && (
            <div>
              <div className="flex justify-between text-sm mb-1">
                {/* A Solo tile completes on one member's own count, so its bar is the best single
                    member's — labelled, or "12/10" on a tile nobody has finished reads as a bug. */}
                <span className="text-text-muted">
                  Progress
                  {isIndividualMode(tile.trackingMode) && (
                    <span className="text-text-muted/60 ml-1">(best member — solo tile)</span>
                  )}
                </span>
                <span className="font-medium text-accent-green-light">
                  {dropProgress.current}/{dropProgress.required}
                </span>
              </div>
              <div className="w-full bg-brown-dark rounded-full h-3 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (dropProgress.current / dropProgress.required) * 100)}%`,
                    background: dropProgress.current >= dropProgress.required
                      ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                      : 'linear-gradient(90deg, #eab308cc, #eab308)',
                  }}
                />
              </div>

              {/* Per-item breakdown. Items carrying a `group` form sets; the tile's groupMode decides
                  whether satisfying ONE of them finishes the tile or every one must be satisfied,
                  and a set can need only some of its items. Without groups: the classic flat list. */}
              {perItemProgress && perItemProgress.length > 0 && (() => {
                const row = (item: (typeof perItemProgress)[number]) => {
                  const itemComplete = item.currentAmount >= item.requiredAmount;
                  return (
                    <div key={item.itemId} className="flex items-center gap-2 text-xs">
                      <span className={`flex-shrink-0 w-4 text-center ${itemComplete ? 'text-accent-green-light' : 'text-text-muted'}`}>
                        {itemComplete ? '\u2713' : ''}
                      </span>
                      <span className={`flex-1 min-w-0 truncate ${itemComplete ? 'text-accent-green-light' : 'text-foreground'}`}>
                        {item.name}
                      </span>
                      <span className={`font-medium ${itemComplete ? 'text-accent-green-light' : 'text-gold'}`}>
                        {item.currentAmount}/{item.requiredAmount}
                      </span>
                    </div>
                  );
                };
                // Sets and what they mean come from lib/collectionSets, the same rule the server
                // completes on \u2014 including 'all' mode ("one from each source"), where a set can need
                // just some of its items.
                const state = evaluateCollection(perItemProgress, tile.groupMode);
                if (state.groups.length === 0) {
                  return <div className="mt-3 space-y-1.5">{perItemProgress.map(row)}</div>;
                }
                return (
                  <div className="mt-3 space-y-2.5">
                    <p className="text-[11px] text-text-muted">{groupModeHint(state)}</p>
                    {state.ungrouped.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-text-muted mb-1">Always required</p>
                        <div className="space-y-1.5">{state.ungrouped.map(row)}</div>
                      </div>
                    )}
                    {state.groups.map((set) => (
                      <div key={set.name.toLowerCase()} className={`rounded-lg border px-2.5 py-2 ${set.satisfied ? 'border-accent-green/40 bg-accent-green/10' : 'border-card-border/60'}`}>
                        <p className={`text-[11px] font-semibold mb-1 flex justify-between gap-2 ${set.satisfied ? 'text-accent-green-light' : 'text-foreground/80'}`}>
                          <span>{set.name}{set.satisfied ? ' \u2713' : ''}</span>
                          {/* Only worth saying when the set doesn't need all of its items. */}
                          {set.require < set.items.length && (
                            <span className="text-text-muted font-normal">any {set.require} \u00b7 {set.met}/{set.require}</span>
                          )}
                        </p>
                        <div className="space-y-1.5">{set.items.map(row)}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Stat tile progress */}
          {isStatTile && statProgress && statProgress.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                Player Progress ({statLabel(tile.trackedStat, tile.statType)})
              </h3>
              {/* Team total */}
              {tile.statGoal && (
                <div className="mb-3 p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-text-muted">Team Total</span>
                    <span className="font-medium text-blue-400">
                      {formatNumber(statProgress.reduce((sum, p) => sum + p.gained, 0))} / {formatNumber(tile.statGoal)}
                    </span>
                  </div>
                  <div className="w-full bg-brown-dark rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, (statProgress.reduce((sum, p) => sum + p.gained, 0) / tile.statGoal) * 100)}%`,
                        background: statProgress.reduce((sum, p) => sum + p.gained, 0) >= tile.statGoal
                          ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                          : 'linear-gradient(90deg, #3b82f6cc, #3b82f6)',
                      }}
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {statProgress.sort((a, b) => b.gained - a.gained).map((p) => {
                  const goal = tile.statGoal || 0;
                  const percentage = goal > 0 ? Math.min(100, (p.gained / goal) * 100) : 0;
                  const isGoalMet = goal > 0 && p.gained >= goal;
                  return (
                    <div
                      key={p.playerId}
                      className="border border-card-border rounded-lg p-2.5 bg-brown-dark/50"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-foreground">{p.playerName}</span>
                        <span className={`text-xs font-medium ${isGoalMet ? 'text-accent-green-light' : 'text-blue-400'}`}>
                          +{formatNumber(p.gained)} {tile.statType === 'boss' ? 'KC' : 'XP'}
                        </span>
                      </div>
                      {goal > 0 && (
                        <div className="w-full bg-brown-dark rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${percentage}%`,
                              background: isGoalMet
                                ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                                : 'linear-gradient(90deg, #3b82f6cc, #3b82f6)',
                            }}
                          />
                        </div>
                      )}
                      <div className="text-xs text-text-muted mt-1">
                        Current: {formatNumber(p.current)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Per-team stat comparison (public scoreboard) — every team's gain toward the goal. */}
          {isStatTile && teamStatProgress && teamStatProgress.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                Team Progress ({statLabel(tile.trackedStat, tile.statType)})
              </h3>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {[...teamStatProgress].sort((a, b) => b.gained - a.gained).map((t) => {
                  const goal = tile.statGoal || 0;
                  const percentage = goal > 0 ? Math.min(100, (t.gained / goal) * 100) : 0;
                  const isGoalMet = goal > 0 && t.gained >= goal;
                  return (
                    <div key={t.teamId} className="border border-card-border rounded-lg p-2.5 bg-brown-dark/50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                          {t.teamName}
                        </span>
                        <span className={`text-xs font-medium ${isGoalMet ? 'text-accent-green-light' : 'text-blue-400'}`}>
                          {formatNumber(t.gained)}{goal > 0 ? ` / ${formatNumber(goal)}` : ''} {tile.statType === 'boss' ? 'KC' : 'XP'}
                        </span>
                      </div>
                      {goal > 0 && (
                        <div className="w-full bg-brown-dark rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${percentage}%`,
                              background: isGoalMet
                                ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                                : 'linear-gradient(90deg, #3b82f6cc, #3b82f6)',
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {isStatTile
            && (!statProgress || statProgress.length === 0)
            && (!teamStatProgress || teamStatProgress.length === 0) && (
            <div className="text-center py-4 text-text-muted text-sm">
              No stat progress data available yet.
            </div>
          )}

          {/* Timed tile status */}
          {isTimed && (
            <div className={`rounded-lg border p-3 text-sm ${isCompleted ? 'border-accent-green/30 bg-accent-green/10 text-accent-green-light' : 'border-card-border bg-brown-dark/30 text-text-muted'}`}>
              {isCompleted
                ? `Cleared in time — at or under ${tile.timeThresholdSeconds ? secondsToClock(tile.timeThresholdSeconds) : 'the cap'}.`
                : `Clear ${tile.timedActivity || 'the activity'} in ${tile.timeThresholdSeconds ? `≤ ${secondsToClock(tile.timeThresholdSeconds)}` : 'time'} and submit the baked screenshot.`}
            </div>
          )}

          {/* Standard manual toggle (count- and time-based tiles complete via submissions) */}
          {!isCount && !isTimed && canToggle && onToggle && (
            <button
              onClick={handleToggle}
              disabled={toggling}
              className={`w-full py-2 text-sm font-semibold rounded border transition-colors disabled:opacity-50 ${
                isCompleted
                  ? 'bg-red-400/10 border-red-400/30 text-red-400 hover:bg-red-400/20'
                  : 'bg-accent-green/10 border-accent-green/30 text-accent-green-light hover:bg-accent-green/20'
              }`}
            >
              {toggling ? '...' : isCompleted ? 'Mark Incomplete' : 'Mark Complete'}
            </button>
          )}

          {/* Stat tiles auto-complete from hiscores, so there's no manual "Mark Complete" — but a
              manager can REOPEN a completed one that finished off a bad/inflated gain. This deletes the
              completion and its frozen per-member split (the drop-tile equivalent of deleting the
              progress that completed it); the next hiscores sweep re-completes it only if the real team
              total still qualifies. One-way: only shown while completed. */}
          {isStatTile && isCompleted && canManage && onToggle && (
            <button
              onClick={handleToggle}
              disabled={toggling}
              className="w-full py-2 text-sm font-semibold rounded border transition-colors disabled:opacity-50 bg-red-400/10 border-red-400/30 text-red-400 hover:bg-red-400/20"
            >
              {toggling ? '...' : 'Reopen tile (clear completion)'}
            </button>
          )}

          {/* Proof still in flight — say so, so an empty modal doesn't read as "no proof exists". */}
          {submissionsLoading && submissions.length === 0 && (
            <p className="text-xs text-text-muted">Loading proof…</p>
          )}

          {/* Proof, grouped by who earned it. Timed tiles keep the per-run list — each run is a
              distinct clear time and there are never many of them. */}
          {(isCount || isTimed || isValue) && submissions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                {isTimed ? `Runs (${submissions.length})` : `Contributors (${contributors.length})`}
              </h3>

              {isTimed ? (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {individualSubs.map((s) => (
                    <div key={s.id} className="border border-card-border rounded-lg p-2.5 bg-brown-dark/50">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                        {s.creditPlayerName && (
                          <span className="font-medium text-accent-green-light">{s.creditPlayerName}</span>
                        )}
                        <span className="text-gold font-medium">
                          {s.durationSeconds != null ? secondsToClock(s.durationSeconds) : '—'}
                        </span>
                        <span className="text-text-muted">
                          <LocalTime date={s.createdAt} format="date" />
                        </span>
                        {s.flaggedReason === 'no_start_proof' && (
                          <span
                            title="Landed before this player filed their starting shot"
                            className="px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-300 font-medium"
                          >
                            no starting shot
                          </span>
                        )}
                        {canDeleteSubmission(s) && onDelete && (
                          <button
                            onClick={() => openDeleteModal(s.id)}
                            disabled={deletingId === s.id}
                            className="ml-auto text-red-400 hover:text-red-300 transition-colors"
                          >
                            {deletingId === s.id ? '...' : 'Delete'}
                          </button>
                        )}
                      </div>
                      {s.note && <p className="text-xs text-text-muted mt-1">{s.note}</p>}
                      {s.imageUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            setViewer({
                              shots: [{
                                id: s.id,
                                imageUrl: s.imageUrl!,
                                credit: s.creditPlayerName ?? null,
                                note: s.note ?? null,
                                createdAt: s.createdAt,
                                amountLabel: null,
                              }],
                              index: 0,
                            })
                          }
                          className="mt-2 block w-full"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={s.imageUrl}
                            alt="Proof"
                            className="w-full max-h-40 object-cover rounded border border-card-border"
                          />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {contributors.slice(0, showAllContributors ? undefined : CONTRIBUTOR_PREVIEW).map((g) => (
                      <div key={g.key} className="border border-card-border rounded-lg p-2.5 bg-brown-dark/50">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                          {teamNameById && g.teamId != null && teamNameById[g.teamId] && (
                            <span className="font-semibold px-1.5 py-0.5 rounded bg-brown-light text-foreground/80">
                              {teamNameById[g.teamId]}
                            </span>
                          )}
                          <span className="font-medium text-accent-green-light">
                            {g.playerName ?? 'Unattributed'}
                          </span>
                          <span className="text-gold font-medium">
                            {isValue
                              ? `${g.amount.toLocaleString()} gp`
                              : `${g.amount} ${countNoun}${g.amount !== 1 ? 's' : ''}`}
                          </span>
                          {g.autoLogs > 0 && (
                            <span className="text-text-muted">
                              · {g.autoLogs} auto log{g.autoLogs !== 1 ? 's' : ''}
                            </span>
                          )}
                          {g.flagged > 0 && (
                            <span
                              title="Landed before this player filed their starting shot"
                              className="px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-300 font-medium"
                            >
                              {g.flagged} no starting shot
                            </span>
                          )}
                        </div>

                        {/* Contact sheet: proof is evidence you open, not a feed you scroll. */}
                        {g.shots.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {g.shots.map((shot, i) => (
                              <button
                                key={shot.id}
                                type="button"
                                onClick={() => setViewer({ shots: g.shots, index: i })}
                                title={shot.note || 'View proof'}
                                className="rounded border border-card-border overflow-hidden hover:border-gold/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold transition-colors"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={shot.imageUrl} alt="" className="w-14 h-14 object-cover" />
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Deleting is per-submission, so it lives with the proof it removes — and
                            stays gated by the same rule as before: staff can remove anyone's, a
                            player only their own. */}
                        {onDelete && g.shots.some((shot) => canDeleteShot(shot.id)) && (
                          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                            {g.shots.filter((shot) => canDeleteShot(shot.id)).map((shot) => (
                              <button
                                key={`del-${shot.id}`}
                                onClick={() => openDeleteModal(shot.id)}
                                disabled={deletingId === shot.id}
                                className="text-[10px] text-red-400/80 hover:text-red-300 transition-colors"
                              >
                                {deletingId === shot.id ? '...' : `Delete ${shot.amountLabel ?? 'proof'}`}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {contributors.length > CONTRIBUTOR_PREVIEW && (
                    <button
                      type="button"
                      onClick={() => setShowAllContributors((v) => !v)}
                      className="mt-2 text-xs text-gold hover:underline"
                    >
                      {showAllContributors ? 'Show fewer' : `Show all ${contributors.length} contributors`}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Submit form for drop / kill tiles */}
          {isCount && canSubmit && onSubmit && teamId && (() => {
            const remaining = dropProgress ? Math.max(0, dropProgress.required - dropProgress.current) : undefined;
            const maxAmount = remaining ?? 99;
            const isComplete = remaining === 0;

            if (isComplete) {
              return (
                <div className="border border-accent-green/30 rounded-lg p-3 bg-accent-green/10 text-center">
                  <p className="text-sm text-accent-green-light font-medium">Tile Complete!</p>
                  <p className="text-xs text-text-muted mt-1">All required {countNoun}s have been submitted.</p>
                </div>
              );
            }

            return (
            <form onSubmit={handleSubmit} className="border border-card-border rounded-lg p-3 bg-brown-dark/30 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Add Submission</h3>
              {remaining !== undefined && (
                <p className="text-xs text-yellow-400">
                  {remaining} more {countNoun}{remaining !== 1 ? 's' : ''} needed to complete this tile
                </p>
              )}

              {/* Collection tiles: which item in the set this submission counts toward (required). */}
              {isCollection && (
                <div>
                  <label className="block text-xs text-text-muted mb-1">Which item in the set? *</label>
                  <Select
                    value={itemId}
                    onChange={setItemId}
                    required
                    placeholder="Select the item..."
                    ariaLabel="Which item in the set"
                    options={itemReqs.map((it) => ({ value: String(it.itemId), label: it.name }))}
                  />
                </div>
              )}

              {/* Who got this drop/kill */}
              <div>
                <label className="block text-xs text-text-muted mb-1">Who got this {countNoun}? *</label>
                <Select
                  value={creditPlayerId}
                  onChange={setCreditPlayerId}
                  required
                  placeholder="Select team member..."
                  ariaLabel="Who got this drop"
                  options={(teamPlayers ?? []).map((p) => ({ value: String(p.id), label: p.name }))}
                />
              </div>

              {/* Amount is only entered by hand for non-per-unit count tiles. For real drops the
                  count follows the number of screenshots you attach (one submission per shot), so
                  there's no separate amount field to keep in sync. */}
              {!perUnitProof && (
                <div>
                  <label className="block text-xs text-text-muted mb-1">
                    Amount {remaining !== undefined && <span className="text-yellow-400">(max: {maxAmount})</span>}
                  </label>
                  <NumberInput
                    value={Number(amount) || 1}
                    onChange={(n) => setAmount(String(n))}
                    min={1}
                    max={maxAmount}
                    fallback={1}
                    className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs text-text-muted mb-1">
                  Evidence Screenshot{perUnitProof ? 's' : ''} *
                  {perUnitProof && (
                    <span className="text-yellow-400 ml-1">
                      ({imageUrls.filter((u) => u).length}/{maxAmount})
                    </span>
                  )}
                  {!perUnitProof && parsedAmount > 1 && (
                    <span className="text-text-muted ml-1">(one screenshot is enough)</span>
                  )}
                </label>
                {!perUnitProof ? (
                  <ImageUpload
                    onImageSelected={(url) => setImageUrls([url])}
                    currentUrl={imageUrls[0] || undefined}
                  />
                ) : (
                  <div className="space-y-2">
                    {/* Bulk: pick every drop screenshot in one go — the count follows the images. */}
                    <ImageUpload
                      multiple
                      onImageSelected={() => {}}
                      onImagesSelected={(urls) => {
                        const merged = [...imageUrls.filter(Boolean), ...urls].slice(0, maxAmount);
                        setImageUrls(merged.length ? merged : ['']);
                        setAmount(String(Math.max(1, merged.length)));
                      }}
                    />
                    {imageUrls.filter(Boolean).length > 0 && (
                      <>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {imageUrls.filter(Boolean).map((url, i) => (
                            <div key={i} className="relative">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt={`Drop ${i + 1}`} className="w-full aspect-square object-cover rounded border border-card-border" />
                              <button
                                type="button"
                                onClick={() => {
                                  const next = imageUrls.filter(Boolean).filter((_, idx) => idx !== i);
                                  setImageUrls(next.length ? next : ['']);
                                  setAmount(String(Math.max(1, next.length)));
                                }}
                                className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-400"
                                aria-label={`Remove drop ${i + 1}`}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-text-muted">
                          {imageUrls.filter(Boolean).length} screenshot{imageUrls.filter(Boolean).length !== 1 ? 's' : ''} — one {countNoun} each.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1">Note (optional)</label>
                <Input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional note..."
                  className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
                />
              </div>

              {error && (
                <p className="text-xs text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2 text-sm font-semibold rounded bg-accent-green/20 border border-accent-green text-accent-green-light hover:bg-accent-green/30 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </form>
            );
          })()}

          {/* Submit form for timed tiles */}
          {isTimed && canSubmit && onSubmit && teamId && !isCompleted && (
            <form onSubmit={handleSubmit} className="border border-card-border rounded-lg p-3 bg-brown-dark/30 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Submit a Clear</h3>
              <p className="text-xs text-text-muted">
                Normally the plugin bakes &amp; submits this automatically. Use this only as a manual fallback.
              </p>

              <div>
                <label className="block text-xs text-text-muted mb-1">
                  Clear Time *{tile.timeThresholdSeconds ? <span className="text-yellow-400 ml-1">(must be ≤ {secondsToClock(tile.timeThresholdSeconds)})</span> : null}
                </label>
                <Input
                  type="text"
                  value={clearTime}
                  onChange={(e) => setClearTime(e.target.value)}
                  placeholder="mm:ss — e.g. 28:30"
                  className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
                />
              </div>

              {/* Optional credit player */}
              {teamPlayers && teamPlayers.length > 0 && (
                <div>
                  <label className="block text-xs text-text-muted mb-1">Who cleared it? (optional)</label>
                  <Select
                    value={creditPlayerId}
                    onChange={setCreditPlayerId}
                    ariaLabel="Who cleared it"
                    options={[
                      { value: '', label: 'Team clear / unattributed' },
                      ...teamPlayers.map((p) => ({ value: String(p.id), label: p.name })),
                    ]}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs text-text-muted mb-1">Evidence Screenshot *</label>
                <ImageUpload
                  onImageSelected={(url) => setImageUrls([url])}
                  currentUrl={imageUrls[0] || undefined}
                />
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1">Note (optional)</label>
                <Input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional note..."
                  className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
                />
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2 text-sm font-semibold rounded bg-gold/20 border border-gold text-gold hover:bg-gold/30 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Submitting...' : 'Submit Clear'}
              </button>
            </form>
          )}

          {/* Submit form for loot-value tiles — a gp-valued haul + one proof screenshot. */}
          {isValue && canSubmit && onSubmit && teamId && !isCompleted && (
            <form onSubmit={handleValueSubmit} className="border border-card-border rounded-lg p-3 bg-brown-dark/30 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Submit Loot Value</h3>
              <p className="text-xs text-text-muted">
                Normally the plugin prices &amp; submits hauls automatically. Use this only as a manual fallback.
              </p>

              <div>
                <label className="block text-xs text-text-muted mb-1">
                  Haul value (gp) *
                  {tile.requiredAmount ? (
                    <span className="text-yellow-400 ml-1">
                      ({tile.tileType === 'valuetotal' ? 'target ' : 'need '}{tile.requiredAmount.toLocaleString()} gp)
                    </span>
                  ) : null}
                </label>
                <Input
                  type="text"
                  value={valueGp}
                  onChange={(e) => setValueGp(e.target.value)}
                  placeholder="e.g. 5m, 500k, 5000000"
                  className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
                />
                <p className="text-[10px] text-text-muted mt-0.5">
                  {tile.tileType === 'valuetotal'
                    ? 'Every submitted haul adds toward the target.'
                    : 'A single haul must meet the target to complete the tile.'}
                </p>
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1">Who got this loot? *</label>
                <Select
                  value={creditPlayerId}
                  onChange={setCreditPlayerId}
                  required
                  placeholder="Select team member..."
                  ariaLabel="Who got this loot"
                  options={(teamPlayers ?? []).map((p) => ({ value: String(p.id), label: p.name }))}
                />
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1">Evidence Screenshot *</label>
                <ImageUpload
                  onImageSelected={(url) => setImageUrls([url])}
                  currentUrl={imageUrls[0] || undefined}
                />
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1">Note (optional)</label>
                <Input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional note..."
                  className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
                />
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2 text-sm font-semibold rounded bg-gold/20 border border-gold text-gold hover:bg-gold/30 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Submitting...' : 'Submit Loot Value'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={cancelDelete} />
          <div className="relative bg-card-bg border border-card-border rounded-xl w-full max-w-sm p-4 shadow-2xl">
            <h3 className="text-lg font-bold text-foreground mb-3">Confirm Deletion</h3>
            <p className="text-sm text-text-muted mb-4">
              Are you sure you want to delete this submission? This action will be announced in Discord.
            </p>
            <div className="mb-4">
              <label className="block text-xs text-text-muted mb-1">Reason for deletion *</label>
              <Textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="e.g., Duplicate submission, Wrong tile, etc."
                className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground resize-none"
                rows={2}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={cancelDelete}
                className="flex-1 py-2 text-sm font-medium rounded border border-card-border text-text-muted hover:bg-brown-dark transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={!deleteReason.trim() || deletingId !== null}
                className="flex-1 py-2 text-sm font-semibold rounded bg-red-500/20 border border-red-500 text-red-400 hover:bg-red-500/30 disabled:opacity-50 transition-colors"
              >
                {deletingId !== null ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      {viewer && (
        <ProofGallery
          shots={viewer.shots}
          index={viewer.index}
          onIndex={(next) => setViewer((v) => (v ? { ...v, index: next } : v))}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}
