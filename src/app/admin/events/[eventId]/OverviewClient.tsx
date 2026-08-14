'use client';

import type { Event, Tile, Team, Completion, Submission } from '@/lib/types';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import EventBoard from '@/components/EventBoard';
import BoardFilters from '@/components/BoardFilters';
import TileDetailModal from '@/components/TileDetailModal';
import DateRangeField from '@/components/DateRangeField';
import { useEventStream, EventStreamData } from '@/hooks/useEventStream';
import { isTileRaceFormat, isLadderFormat, isPointsMode, eventModeLabel, eventNoun } from '@/lib/utils';
import { parseEventRules, hasRevealPolicy } from '@/lib/eventRules';
import RevealRulesPanel from './RevealRulesPanel';
import { DEFAULT_TIER_BANDS, type TierBand } from '@/lib/tileFilter';
import { EVENT_MODES, modeKeyFor, type EventMode } from '@/lib/eventModes';
import Input from '@/components/Input';
import MissionAdminPanel from '@/components/MissionAdminPanel';
import EventEditorsPanel from './EventEditorsPanel';
import NumberInput from '@/components/NumberInput';

interface Props {
  event: Event;
  tiles: Tile[];
  teams: Team[];
  completions: Completion[];
  tierBands?: TierBand[];
  /** Current user is an admin — gates the board-editor management panel. */
  canManageEditors?: boolean;
}

export default function OverviewClient({ event, tiles, teams, completions, tierBands = DEFAULT_TIER_BANDS, canManageEditors = false }: Props) {
  const router = useRouter();
  const [currentEvent, setCurrentEvent] = useState(event);
  const [startDate, setStartDate] = useState(() => event.startDate ?? '');
  const [endDate, setEndDate] = useState(() => event.endDate ?? '');
  const [editMode, setEditMode] = useState(false);
  const [savingDates, setSavingDates] = useState(false);
  const [forceEnding, setForceEnding] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [savingReveal, setSavingReveal] = useState(false);
  const [startingBingo, setStartingBingo] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [recomputeMsg, setRecomputeMsg] = useState('');

  const [editType, setEditType] = useState(false);
  const [typeMode, setTypeMode] = useState<EventMode>(() => modeKeyFor(event.format, event.scoringMode, event.rules));
  const [typeSize, setTypeSize] = useState(event.boardSize);
  const [savingType, setSavingType] = useState(false);
  const [typeError, setTypeError] = useState('');

  const [localTiles, setLocalTiles] = useState<Tile[]>(tiles);
  const [liveCompletions, setLiveCompletions] = useState<Completion[]>(completions);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [matchedTileIds, setMatchedTileIds] = useState<Set<number> | null>(null);
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null);

  const { connected: streamConnected } = useEventStream(event.id, {
    onUpdate: useCallback((data: EventStreamData) => {
      setLiveCompletions(data.completions);
      setLocalTiles(data.tiles);
    }, []),
  });

  // All teams' submissions (full rows incl. proof images) for the click-through management modal.
  // Fetched directly — the event stream carries a lighter projection without imageUrl.
  const fetchSubmissions = useCallback(async () => {
    const res = await fetch(`/api/events/${event.id}/submissions`);
    if (res.ok) setSubmissions(await res.json());
  }, [event.id]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount fetch
    void fetchSubmissions();
  }, [fetchSubmissions]);

  const now = new Date();
  const isForceEnded = !!currentEvent.forceEndedAt;
  const eventStarted = currentEvent.startDate ? new Date(currentEvent.startDate) <= now : false;
  const eventEnded = currentEvent.endDate ? new Date(currentEvent.endDate) <= now : false;
  const isActive = eventStarted && !eventEnded;
  const raceFormat = isTileRaceFormat(currentEvent.format);
  const ladderFormat = isLadderFormat(currentEvent.format);
  const pointsMode = isPointsMode(currentEvent.scoringMode);
  const noun = eventNoun(currentEvent.format);
  const eventRules = useMemo(() => parseEventRules(currentEvent.rules), [currentEvent.rules]);
  const revealPolicyMode = hasRevealPolicy(eventRules);
  // Type can only change before the event goes live; delete is allowed before start or
  // once it's over — i.e. any time it isn't actively running. Mirrors the API gates.
  const canChangeType = !eventStarted && !isForceEnded;
  const canDelete = !isActive;

  // Where the event sits in its lifecycle, in words. The header badge says the same thing in one
  // token — this spells out what it means for members, next to the buttons that change it.
  const lifecycle = isForceEnded
    ? { tone: 'muted' as const, text: `Force-ended — no further completions count towards this ${noun}.` }
    : eventEnded
      ? { tone: 'muted' as const, text: 'Ended — the board is read-only for members.' }
      : !currentEvent.startDate
        ? { tone: 'warn' as const, text: `Not started — set a start date, or start the ${noun} now.` }
        : !eventStarted
          ? { tone: 'info' as const, text: `Starts ${new Date(currentEvent.startDate).toLocaleString()} — not running yet.` }
          : {
              tone: 'good' as const,
              text: currentEvent.endDate
                ? `Running until ${new Date(currentEvent.endDate).toLocaleString()}.`
                : 'Running with no end date — it keeps going until you end it.',
            };
  const lifecycleCls = {
    good: 'border-accent-green/30 text-accent-green-light bg-accent-green/10',
    warn: 'border-gold/30 text-gold bg-gold/10',
    info: 'border-blue-500/30 text-blue-300 bg-blue-500/10',
    muted: 'border-card-border text-text-muted bg-brown-dark/30',
  }[lifecycle.tone];
  const lifecycleDot = {
    good: 'bg-accent-green',
    warn: 'bg-gold',
    info: 'bg-blue-400',
    muted: 'bg-text-muted',
  }[lifecycle.tone];

  // All-teams submission management from the board: click a tile to see/manage every team's proofs.
  const teamNameById = useMemo(() => Object.fromEntries(teams.map((t) => [t.id, t.name])), [teams]);
  const selectedTile = localTiles.find((t) => t.id === selectedTileId) ?? null;
  const selectedTileSubmissions = selectedTileId ? submissions.filter((s) => s.tileId === selectedTileId) : [];
  const selectedTileCompletedBy = selectedTileId
    ? liveCompletions
        .filter((c) => c.tileId === selectedTileId)
        .map((c) => {
          const t = teams.find((tm) => tm.id === c.teamId);
          return { teamId: c.teamId, teamName: t?.name ?? 'Team', color: t?.color ?? '#888' };
        })
    : [];

  async function deleteSubmission(submissionId: number, reason: string) {
    await fetch(
      `/api/events/${event.id}/submissions?submissionId=${submissionId}&reason=${encodeURIComponent(reason)}`,
      { method: 'DELETE' },
    );
    setSubmissions((list) => list.filter((s) => s.id !== submissionId));
  }

  const typeMeta = EVENT_MODES.find((m) => m.key === typeMode)!;

  async function saveDates() {
    setSavingDates(true);
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: startDate || null, endDate: endDate || null }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCurrentEvent(updated);
        setStartDate(updated.startDate ?? '');
        setEndDate(updated.endDate ?? '');
        setEditMode(false);
        router.refresh();
      }
    } finally {
      setSavingDates(false);
    }
  }

  async function forceEndEvent() {
    if (!confirm('Force-end this event? It ends immediately and notifies Discord.')) return;
    setForceEnding(true);
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'force-end' }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCurrentEvent(updated);
        setEndDate(updated.endDate ?? '');
        router.refresh();
      }
    } finally {
      setForceEnding(false);
    }
  }

  async function recomputeCompletions() {
    setRecomputing(true);
    setRecomputeMsg('');
    try {
      const res = await fetch(`/api/events/${event.id}/recompute-completions`, { method: 'POST' });
      if (res.ok) {
        const { healed } = await res.json();
        setRecomputeMsg(healed > 0 ? `Healed ${healed} tile${healed === 1 ? '' : 's'}.` : 'All up to date.');
        router.refresh();
      } else {
        setRecomputeMsg('Failed — try again.');
      }
    } catch {
      setRecomputeMsg('Failed — try again.');
    } finally {
      setRecomputing(false);
    }
  }

  function startEditType() {
    setTypeMode(modeKeyFor(currentEvent.format, currentEvent.scoringMode, currentEvent.rules));
    setTypeSize(currentEvent.boardSize);
    setTypeError('');
    setEditType(true);
  }

  function pickTypeMode(next: EventMode) {
    const m = EVENT_MODES.find((x) => x.key === next)!;
    setTypeMode(next);
    setTypeSize(m.default);
    setTypeError('');
  }

  async function saveType() {
    if (typeSize < typeMeta.min || typeSize > typeMeta.max) {
      setTypeError(`${typeMeta.label} supports ${typeMeta.min}–${typeMeta.max}.`);
      return;
    }
    const tileCount = typeMeta.square ? typeSize * typeSize : typeSize;
    if (!confirm(
      `Change this event to "${typeMeta.label}" (${tileCount} tiles)? This rebuilds the board — ` +
      `tile labels and icons are kept where positions overlap, but per-tile settings (points, type, goals) reset.`,
    )) return;
    setSavingType(true);
    setTypeError('');
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change-mode',
          format: typeMeta.format,
          scoringMode: typeMeta.scoringMode,
          boardSize: typeSize,
          // Reveal-policy modes carry their rules preset; classic modes clear any previous rules.
          rules: typeMeta.revealPolicy ? { revealPolicy: typeMeta.revealPolicy } : null,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCurrentEvent(updated);
        setEditType(false);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setTypeError(data.error || 'Could not change the event type.');
      }
    } finally {
      setSavingType(false);
    }
  }

  async function cloneEvent() {
    if (!confirm(
      `Clone "${currentEvent.name}"? A new event is created with the same settings, tiles and survey questions — no teams, players or dates. You'll be taken to the copy.`,
    )) return;
    setCloning(true);
    try {
      const res = await fetch(`/api/events/${event.id}/clone`, { method: 'POST' });
      if (res.ok) {
        const { id } = await res.json();
        router.push(`/admin/events/${id}`);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Could not clone event');
        setCloning(false);
      }
    } catch {
      alert('Could not clone event');
      setCloning(false);
    }
  }

  async function deleteEvent() {
    if (!confirm(
      `Permanently delete "${currentEvent.name}"? This wipes its tiles, teams, completions and signups. This cannot be undone.`,
    )) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/events/${event.id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/admin/events');
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Could not delete event');
        setDeleting(false);
      }
    } catch {
      alert('Could not delete event');
      setDeleting(false);
    }
  }

  async function toggleReveal() {
    const next = currentEvent.tilesRevealed ? 0 : 1;
    if (next === 0 && !confirm('Hide the tiles from members again? They\'ll see a "tiles not revealed yet" placeholder on the board and in the plugin until you re-reveal.')) return;
    setSavingReveal(true);
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tilesRevealed: next }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCurrentEvent(updated);
        router.refresh();
      }
    } finally {
      setSavingReveal(false);
    }
  }

  async function startBingoNow(force = false) {
    // A reveal-policy board doesn't show everything on start — it arms the engine and the first
    // draw fires. Promising "reveals all tiles" there would be a lie.
    if (!force && !confirm(
      `Start the ${noun} now? This marks the event live, announces the start in Discord, and ` +
      (revealPolicyMode
        ? 'arms the board — tiles then open on the rotation you configured.'
        : 'reveals all tiles to members.'),
    )) return;
    setStartingBingo(true);
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(force ? { action: 'start-now', force: true } : { action: 'start-now' }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCurrentEvent(updated);
        setStartDate(updated.startDate ?? '');
        setEndDate(updated.endDate ?? '');
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        // Start safeguard (409 + blockers): offer the explicit override once, re-confirmed.
        if (res.status === 409 && Array.isArray(data.blockers) && !force) {
          if (confirm(`${data.error}\n\nStart anyway?`)) {
            await startBingoNow(true);
            return;
          }
        } else {
          alert(data.error || `Could not start the ${noun}.`);
        }
      }
    } finally {
      setStartingBingo(false);
    }
  }

  async function resumeEvent() {
    const originalEnd = currentEvent.originalEndDate;
    const originalPassed = originalEnd && new Date(originalEnd) < new Date();
    const msg = originalPassed
      ? 'The original end date has already passed. The event will resume with that expired end date. Continue?'
      : 'Resume this event?';
    if (!confirm(msg)) return;
    setResuming(true);
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume' }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCurrentEvent(updated);
        setEndDate(updated.endDate ?? '');
        router.refresh();
      }
    } finally {
      setResuming(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] items-start">
      {/* Left column: event details + (admin) board-editor management, so both sit near the top
          instead of below the whole board. */}
      <div className="min-w-0 space-y-8">
      {/* Event Details */}
      <div className="border border-card-border rounded-xl p-5 bg-card-bg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span className="w-1 h-5 bg-gold rounded-full" />
            Event Details
          </h2>
          {/* This is the DATA connection, not the event's state — it used to just say "Live", which
              read as "the event is live" right next to a Draft badge and a Start button. */}
          <span
            className="flex items-center gap-1.5 text-xs text-text-muted"
            title={
              streamConnected
                ? 'This page is streaming updates — completions appear without a refresh.'
                : 'Reconnecting to the update stream. This says nothing about whether the event is running.'
            }
          >
            <span className={`w-1.5 h-1.5 rounded-full ${streamConnected ? 'bg-accent-green animate-pulse' : 'bg-text-muted'}`} />
            {streamConnected ? 'Auto-updating' : 'Reconnecting…'}
          </span>
        </div>

        {editType ? (
          <div className="mb-4 rounded-lg border border-card-border bg-brown-dark/30 p-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
              {EVENT_MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => pickTypeMode(m.key)}
                  className={`px-3 py-2 text-sm rounded-lg border text-left transition-colors ${
                    typeMode === m.key ? 'bg-gold/20 border-gold text-gold' : 'border-card-border text-text-muted hover:border-gold/50'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">{typeMeta.sizeLabel}</label>
            <div className="flex items-center gap-2 mb-1">
              <NumberInput
                value={typeSize}
                onChange={(n) => setTypeSize(n)}
                min={typeMeta.min}
                max={typeMeta.max}
                fallback={typeMeta.default}
                className="w-28 bg-brown-light border border-card-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-gold"
              />
              <span className="text-xs text-text-muted">{typeMeta.sizeHelp(typeSize)}</span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">{typeMeta.blurb}</p>
            {typeError && <p className="text-red-400 text-xs mt-1">{typeError}</p>}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 mb-4">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">Type</label>
              <p className="text-sm font-medium">
                {eventModeLabel(currentEvent.format, currentEvent.scoringMode, currentEvent.rules)}
              </p>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                {raceFormat ? 'Track Length' : ladderFormat ? 'Tasks' : pointsMode ? 'Tiles' : 'Board Size'}
              </label>
              <p className="text-sm font-medium">
                {raceFormat || ladderFormat || pointsMode
                  ? `${currentEvent.boardSize} tiles`
                  : `${currentEvent.boardSize}×${currentEvent.boardSize}`}
              </p>
            </div>
          </div>
        )}

        {editMode ? (
          <div className="mb-3">
            <DateRangeField
              startIso={startDate}
              endIso={endDate}
              onChange={({ startIso, endIso }) => {
                setStartDate(startIso);
                setEndDate(endIso);
              }}
              allowOpenEnded
            />
            <p className="text-xs text-text-muted mt-2">
              Times are in your local timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 mb-4">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">Start Date</label>
              <p className="text-sm font-medium">
                <span suppressHydrationWarning>
                  {currentEvent.startDate ? new Date(currentEvent.startDate).toLocaleString() : 'Not set'}
                </span>
              </p>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">End Date</label>
              <p className="text-sm font-medium">
                <span suppressHydrationWarning>
                  {currentEvent.endDate ? new Date(currentEvent.endDate).toLocaleString() : 'Not set'}
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Two separate facts that used to be conflated: is the EVENT running, and can members see
            the TILES. A reveal-policy board can be armed and still be showing almost nothing. */}
        <div className="mb-3 space-y-2">
          <div className={`flex items-center gap-2 text-xs rounded-lg border px-3 py-2 ${lifecycleCls}`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${lifecycleDot}`} />
            {lifecycle.text}
          </div>
          <div className={`flex items-center gap-2 text-xs rounded-lg border px-3 py-2 ${
            currentEvent.tilesRevealed
              ? 'border-accent-green/30 text-accent-green-light bg-accent-green/10'
              : 'border-gold/30 text-gold bg-gold/10'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${currentEvent.tilesRevealed ? 'bg-accent-green' : 'bg-gold'}`} />
            {!currentEvent.tilesRevealed
              ? 'Tiles are hidden — only staff can see the board until you reveal them.'
              : revealPolicyMode
                ? 'Board is armed — tiles open on the schedule below, not all at once.'
                : 'Tiles are revealed — members can see the board.'}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              if (editMode) {
                saveDates();
              } else {
                setStartDate(currentEvent.startDate ?? '');
                setEndDate(currentEvent.endDate ?? '');
                setEditMode(true);
              }
            }}
            disabled={savingDates}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gold/20 text-gold bg-gold/10 hover:bg-gold/20 transition-colors disabled:opacity-50"
          >
            {editMode ? (savingDates ? 'Saving...' : 'Save Dates') : 'Edit Dates'}
          </button>
          {editMode && (
            <button
              onClick={() => {
                setStartDate(currentEvent.startDate ?? '');
                setEndDate(currentEvent.endDate ?? '');
                setEditMode(false);
              }}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-card-border text-text-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          )}
          {!eventStarted && !isForceEnded && !editMode && (
            <button
              onClick={() => startBingoNow()}
              disabled={startingBingo}
              className="text-xs font-bold px-3 py-1.5 rounded-lg border border-accent-green/30 text-accent-green-light bg-accent-green/10 hover:bg-accent-green/20 transition-colors disabled:opacity-50"
            >
              {startingBingo ? 'Starting...' : `Start ${noun === 'bingo' ? 'Bingo' : noun === 'race' ? 'Race' : 'Ladder'} Now`}
            </button>
          )}
          {isActive && !isForceEnded && (
            <button
              onClick={forceEndEvent}
              disabled={forceEnding}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              {forceEnding ? 'Ending...' : 'Force End Event'}
            </button>
          )}
          {isForceEnded && (
            <button
              onClick={resumeEvent}
              disabled={resuming}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-accent-green/30 text-accent-green-light bg-accent-green/10 hover:bg-accent-green/20 transition-colors disabled:opacity-50"
            >
              {resuming ? 'Resuming...' : 'Resume Event'}
            </button>
          )}
        </div>

        {/* Secondary utilities — grouped apart from the lifecycle actions above. */}
        <div className="mt-3 flex items-center gap-2 flex-wrap border-t border-card-border pt-3">
          {/* Revealing mid-event is fine; HIDING once the event has started would black out the live
              board for members, so the hide action drops away once the event begins. */}
          {(!currentEvent.tilesRevealed || !eventStarted) && (
          <button
            onClick={toggleReveal}
            disabled={savingReveal}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
              currentEvent.tilesRevealed
                ? 'border-card-border text-text-muted hover:text-foreground'
                : 'border-gold/30 text-gold bg-gold/10 hover:bg-gold/20'
            }`}
          >
            {savingReveal
              ? 'Saving...'
              : currentEvent.tilesRevealed
                ? 'Hide Tiles from Members'
                : 'Reveal Tiles to Members'}
          </button>
          )}
          <button
            onClick={recomputeCompletions}
            disabled={recomputing}
            title="Re-check every tile's completion — heals tiles that were already at their target before a completion-rule change (e.g. a full item set collected earlier). Only adds; never removes a completion."
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-card-border text-text-muted hover:text-foreground transition-colors disabled:opacity-50"
          >
            {recomputing ? 'Recomputing...' : 'Recompute Completions'}
          </button>
          {recomputeMsg && <span className="text-xs text-text-muted self-center">{recomputeMsg}</span>}
          {canChangeType && !editMode && (
            editType ? (
              <>
                <button
                  onClick={saveType}
                  disabled={savingType}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gold/20 text-gold bg-gold/10 hover:bg-gold/20 transition-colors disabled:opacity-50"
                >
                  {savingType ? 'Saving...' : 'Save Type'}
                </button>
                <button
                  onClick={() => setEditType(false)}
                  disabled={savingType}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-card-border text-text-muted hover:text-foreground transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={startEditType}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gold/20 text-gold bg-gold/10 hover:bg-gold/20 transition-colors"
              >
                Change Type
              </button>
            )
          )}
          {!editMode && !editType && (
            <button
              onClick={cloneEvent}
              disabled={cloning}
              title="Create a new event with the same settings, tiles and survey questions — no teams, players or dates. Handy for running the same board again."
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-card-border text-text-muted hover:text-foreground transition-colors disabled:opacity-50"
            >
              {cloning ? 'Cloning...' : 'Clone Event'}
            </button>
          )}
          {canDelete && !editMode && !editType && (
            <button
              onClick={deleteEvent}
              disabled={deleting}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete Event'}
            </button>
          )}
        </div>
      </div>

        {/* Only renders on reveal-policy boards — a classic board has nothing to schedule. */}
        <RevealRulesPanel event={currentEvent} tiles={localTiles} />

        {canManageEditors && <EventEditorsPanel eventId={event.id} />}
      </div>

      {/* Missions — mid-event hidden-objective controls. Hidden on a ladder, whose whole board is
          already a pool of announced objectives. */}
      <MissionAdminPanel event={currentEvent} tiles={localTiles} allowed={!ladderFormat} />

      {/* Board — search, filter, and click any tile to manage every team's submissions in one place. */}
      <div className="min-w-0">
        <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
          <span className="w-1 h-5 bg-gold rounded-full" />
          Board
        </h2>
        <p className="text-sm text-text-muted mb-3">Click any tile to see and manage submissions from every team.</p>
        <BoardFilters tiles={localTiles} tierBands={tierBands} pointsMode={pointsMode} onMatched={setMatchedTileIds} />
        <EventBoard
          format={currentEvent.format}
          tiles={localTiles}
          boardSize={currentEvent.boardSize}
          completions={liveCompletions}
          teams={teams}
          pointsMode={pointsMode}
          onTileClick={setSelectedTileId}
          matchedTileIds={matchedTileIds}
        />
      </div>

      {selectedTile && (
        <TileDetailModal
          tile={selectedTile}
          submissions={selectedTileSubmissions}
          completedBy={selectedTileCompletedBy}
          canSubmit={false}
          canManage={true}
          canToggle={false}
          onDelete={deleteSubmission}
          onClose={() => setSelectedTileId(null)}
          eventId={event.id}
          teamNameById={teamNameById}
          pointsMode={pointsMode}
        />
      )}
    </div>
  );
}
