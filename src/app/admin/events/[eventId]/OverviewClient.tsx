'use client';

import type { Event, Tile, Team, Completion } from '@/lib/types';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import EventBoard from '@/components/EventBoard';
import DateRangeField from '@/components/DateRangeField';
import { useEventStream, EventStreamData } from '@/hooks/useEventStream';
import { isTileRaceFormat, isPointsMode } from '@/lib/utils';

interface Props {
  event: Event;
  tiles: Tile[];
  teams: Team[];
  completions: Completion[];
}

export default function OverviewClient({ event, tiles, teams, completions }: Props) {
  const router = useRouter();
  const [currentEvent, setCurrentEvent] = useState(event);
  const [startDate, setStartDate] = useState(() => event.startDate ?? '');
  const [endDate, setEndDate] = useState(() => event.endDate ?? '');
  const [editMode, setEditMode] = useState(false);
  const [savingDates, setSavingDates] = useState(false);
  const [forceEnding, setForceEnding] = useState(false);
  const [resuming, setResuming] = useState(false);

  const [localTiles, setLocalTiles] = useState<Tile[]>(tiles);
  const [liveCompletions, setLiveCompletions] = useState<Completion[]>(completions);

  const { connected: streamConnected } = useEventStream(event.id, {
    onUpdate: useCallback((data: EventStreamData) => {
      setLiveCompletions(data.completions);
      setLocalTiles(data.tiles);
    }, []),
  });

  const now = new Date();
  const isForceEnded = !!currentEvent.forceEndedAt;
  const eventStarted = currentEvent.startDate ? new Date(currentEvent.startDate) <= now : false;
  const eventEnded = currentEvent.endDate ? new Date(currentEvent.endDate) <= now : false;
  const isActive = eventStarted && !eventEnded;
  const raceFormat = isTileRaceFormat(currentEvent.format);
  const pointsMode = isPointsMode(currentEvent.scoringMode);

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
      {/* Event Details */}
      <div className="border border-card-border rounded-xl p-5 bg-card-bg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span className="w-1 h-5 bg-gold rounded-full" />
            Event Details
          </h2>
          <span
            className={`flex items-center gap-1.5 text-xs ${streamConnected ? 'text-accent-green-light' : 'text-text-muted'}`}
            title={streamConnected ? 'Real-time updates connected' : 'Connecting to live updates…'}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${streamConnected ? 'bg-accent-green animate-pulse' : 'bg-text-muted'}`} />
            {streamConnected ? 'Live' : 'Connecting…'}
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 mb-4">
          <div>
            <label className="block text-xs text-text-muted mb-1">Type</label>
            <p className="text-sm font-medium">
              {raceFormat ? 'Tile race' : pointsMode ? 'Leagues bingo' : 'Classic bingo'}
            </p>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">
              {raceFormat ? 'Track Length' : pointsMode ? 'Tiles' : 'Board Size'}
            </label>
            <p className="text-sm font-medium">
              {raceFormat || pointsMode
                ? `${currentEvent.boardSize} tiles`
                : `${currentEvent.boardSize}×${currentEvent.boardSize}`}
            </p>
          </div>
        </div>

        {editMode ? (
          <div className="mb-3">
            <DateRangeField
              startIso={startDate}
              endIso={endDate}
              onChange={({ startIso, endIso }) => {
                setStartDate(startIso);
                setEndDate(endIso);
              }}
            />
            <p className="text-xs text-text-muted mt-2">
              Times are in your local timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 mb-4">
            <div>
              <label className="block text-xs text-text-muted mb-1">Start Date</label>
              <p className="text-sm font-medium">
                <span suppressHydrationWarning>
                  {currentEvent.startDate ? new Date(currentEvent.startDate).toLocaleString() : 'Not set'}
                </span>
              </p>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">End Date</label>
              <p className="text-sm font-medium">
                <span suppressHydrationWarning>
                  {currentEvent.endDate ? new Date(currentEvent.endDate).toLocaleString() : 'Not set'}
                </span>
              </p>
            </div>
          </div>
        )}

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
      </div>

      {/* Board Preview */}
      <div>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <span className="w-1 h-5 bg-gold rounded-full" />
          Board Preview
        </h2>
        <EventBoard
          format={currentEvent.format}
          tiles={localTiles}
          boardSize={currentEvent.boardSize}
          completions={liveCompletions}
          teams={teams}
          pointsMode={pointsMode}
        />
      </div>
    </div>
  );
}
