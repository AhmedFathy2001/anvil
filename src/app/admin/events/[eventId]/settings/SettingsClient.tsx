'use client';

import type { Event, Tile } from '@/lib/types';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import DateRangeField from '@/components/DateRangeField';
import NumberInput from '@/components/NumberInput';
import RevealRulesPanel from '../RevealRulesPanel';
import EventEditorsPanel from '../EventEditorsPanel';
import { EVENT_MODES, modeKeyFor, type EventMode } from '@/lib/eventModes';
import { eventModeLabel, isTileRaceFormat, isPointsMode } from '@/lib/utils';
import { eventAxes } from '@/lib/eventAxes';

interface Props {
  event: Event;
  tiles: Tile[];
  canManageEditors?: boolean;
}

/**
 * The event's configuration, split out of the Overview.
 *
 * Deliberately does NOT carry the lifecycle actions (start, force-end, resume) — those belong on
 * the event's home, next to the state they change. What lives here is the stuff you set up front
 * and revisit rarely: shape, schedule, when tiles open, who can edit, and the dangerous corner.
 */
export default function SettingsClient({ event, tiles, canManageEditors = false }: Props) {
  const router = useRouter();
  const [currentEvent, setCurrentEvent] = useState(event);

  const [startDate, setStartDate] = useState(() => event.startDate ?? '');
  const [endDate, setEndDate] = useState(() => event.endDate ?? '');
  const [editDates, setEditDates] = useState(false);
  const [savingDates, setSavingDates] = useState(false);

  const [editType, setEditType] = useState(false);
  const [typeMode, setTypeMode] = useState<EventMode>(() => modeKeyFor(event.format, event.scoringMode, event.rules));
  const [typeSize, setTypeSize] = useState(event.boardSize);
  const [savingType, setSavingType] = useState(false);
  const [typeError, setTypeError] = useState('');

  const [savingReveal, setSavingReveal] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [recomputeMsg, setRecomputeMsg] = useState('');
  const [cloning, setCloning] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const now = new Date();
  const isForceEnded = !!currentEvent.forceEndedAt;
  const eventStarted = currentEvent.startDate ? new Date(currentEvent.startDate) <= now : false;
  const eventEnded = currentEvent.endDate ? new Date(currentEvent.endDate) <= now : false;
  const isActive = eventStarted && !eventEnded && !isForceEnded;
  const raceFormat = isTileRaceFormat(currentEvent.format);
  const ladderFormat = eventAxes(currentEvent).competitors === 'individuals';
  const pointsMode = isPointsMode(currentEvent.scoringMode);
  // Type can only change before the event goes live; delete is allowed before start or once it's
  // over — i.e. any time it isn't actively running. Mirrors the API gates.
  const canChangeType = !eventStarted && !isForceEnded;
  const canDelete = !isActive;

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
        setEditDates(false);
        router.refresh();
      }
    } finally {
      setSavingDates(false);
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
    if (
      !confirm(
        `Change this event to "${typeMeta.label}" (${tileCount} tiles)? This rebuilds the board — ` +
          `tile labels and icons are kept where positions overlap, but per-tile settings (points, type, goals) reset.`,
      )
    )
      return;
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

  async function toggleReveal() {
    setSavingReveal(true);
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tilesRevealed: !currentEvent.tilesRevealed }),
      });
      if (res.ok) {
        setCurrentEvent(await res.json());
        router.refresh();
      }
    } finally {
      setSavingReveal(false);
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

  async function cloneEvent() {
    if (
      !confirm(
        `Clone "${currentEvent.name}"? A new event is created with the same settings, tiles and survey questions — no teams, players or dates. You'll be taken to the copy.`,
      )
    )
      return;
    setCloning(true);
    try {
      const res = await fetch(`/api/events/${event.id}/clone`, { method: 'POST' });
      if (res.ok) {
        const { id } = await res.json();
        router.push(`/admin/events/${id}`);
      } else {
        alert('Could not clone this event.');
      }
    } finally {
      setCloning(false);
    }
  }

  async function deleteEvent() {
    if (
      !confirm(
        `Permanently delete "${currentEvent.name}"? This wipes its tiles, teams, completions and sign-ups. There is no undo.`,
      )
    )
      return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/events/${event.id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/admin/events');
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Could not delete this event.');
        setDeleting(false);
      }
    } catch {
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Shape */}
      <section className="border border-card-border rounded-xl p-5 bg-card-bg">
        <SectionTitle>Shape</SectionTitle>
        {editType ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
              {EVENT_MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => pickTypeMode(m.key)}
                  className={`px-3 py-2 text-sm rounded-lg border text-left transition-colors ${
                    typeMode === m.key
                      ? 'bg-gold/20 border-gold text-gold'
                      : 'border-card-border text-text-muted hover:border-gold/50'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">
              {typeMeta.sizeLabel}
            </label>
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
            <div className="flex gap-2 mt-3">
              <Button onClick={saveType} disabled={savingType} tone="gold">
                {savingType ? 'Saving…' : 'Save type'}
              </Button>
              <Button onClick={() => setEditType(false)} disabled={savingType}>
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Type">{eventModeLabel(currentEvent.format, currentEvent.scoringMode, currentEvent.rules)}</Field>
              <Field label={raceFormat ? 'Track length' : ladderFormat ? 'Tasks' : pointsMode ? 'Tiles' : 'Board size'}>
                {raceFormat || ladderFormat || pointsMode
                  ? `${currentEvent.boardSize} tiles`
                  : `${currentEvent.boardSize}×${currentEvent.boardSize}`}
              </Field>
            </div>
            {canChangeType ? (
              <div className="mt-3">
                <Button onClick={startEditType} tone="gold">
                  Change type
                </Button>
              </div>
            ) : (
              <p className="text-xs text-text-muted mt-3">
                The shape is fixed once a board goes live — changing it would rebuild the tiles underneath a
                running event.
              </p>
            )}
          </>
        )}
      </section>

      {/* Schedule */}
      <section className="border border-card-border rounded-xl p-5 bg-card-bg">
        <SectionTitle>Schedule</SectionTitle>
        {editDates ? (
          <>
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
            <div className="flex gap-2 mt-3">
              <Button onClick={saveDates} disabled={savingDates} tone="gold">
                {savingDates ? 'Saving…' : 'Save dates'}
              </Button>
              <Button
                onClick={() => {
                  setStartDate(currentEvent.startDate ?? '');
                  setEndDate(currentEvent.endDate ?? '');
                  setEditDates(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Starts">
                <span suppressHydrationWarning>
                  {currentEvent.startDate ? new Date(currentEvent.startDate).toLocaleString() : 'Not set'}
                </span>
              </Field>
              <Field label="Ends">
                <span suppressHydrationWarning>
                  {currentEvent.endDate ? new Date(currentEvent.endDate).toLocaleString() : 'Open-ended'}
                </span>
              </Field>
            </div>
            <div className="mt-3">
              <Button onClick={() => setEditDates(true)} tone="gold">
                Edit dates
              </Button>
            </div>
          </>
        )}
      </section>

      {/* Visibility */}
      <section className="border border-card-border rounded-xl p-5 bg-card-bg">
        <SectionTitle>Who can see the tiles</SectionTitle>
        <p className="text-sm text-text-muted mb-3">
          {currentEvent.tilesRevealed
            ? 'Members can see the board.'
            : 'Tiles are hidden — only staff can see the board until you reveal them.'}
        </p>
        {/* Revealing mid-event is fine; HIDING once the event has started would black out the live
            board for members, so the hide action drops away once the event begins. */}
        {(!currentEvent.tilesRevealed || !eventStarted) && (
          <Button onClick={toggleReveal} disabled={savingReveal} tone={currentEvent.tilesRevealed ? undefined : 'gold'}>
            {savingReveal ? 'Saving…' : currentEvent.tilesRevealed ? 'Hide tiles from members' : 'Reveal tiles to members'}
          </Button>
        )}
      </section>

      {/* Only renders on reveal-policy boards — a classic board has nothing to schedule. */}
      <RevealRulesPanel event={currentEvent} tiles={tiles} />

      {canManageEditors && <EventEditorsPanel eventId={event.id} />}

      {/* Maintenance + the dangerous corner */}
      <section className="border border-card-border rounded-xl p-5 bg-card-bg">
        <SectionTitle>Maintenance</SectionTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={recomputeCompletions}
            disabled={recomputing}
            title="Re-check every tile's completion — heals tiles that were already at their target before a completion-rule change (e.g. a full item set collected earlier). Only adds; never removes a completion."
          >
            {recomputing ? 'Recomputing…' : 'Recompute completions'}
          </Button>
          <Button
            onClick={cloneEvent}
            disabled={cloning}
            title="Create a new event with the same settings, tiles and survey questions — no teams, players or dates."
          >
            {cloning ? 'Cloning…' : 'Clone event'}
          </Button>
          {recomputeMsg && <span className="text-xs text-text-muted">{recomputeMsg}</span>}
        </div>

        {canDelete && (
          <div className="mt-4 pt-4 border-t border-card-border">
            <Button onClick={deleteEvent} disabled={deleting} tone="danger">
              {deleting ? 'Deleting…' : 'Delete event'}
            </Button>
            <p className="text-xs text-text-muted mt-2">
              Wipes the board, teams, completions and sign-ups. A finished event you want to keep the numbers
              from is better left alone.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
      <span className="w-1 h-5 bg-gold rounded-full" />
      {children}
    </h2>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">{label}</div>
      <p className="text-sm font-medium">{children}</p>
    </div>
  );
}

function Button({
  children,
  onClick,
  disabled,
  tone,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'gold' | 'danger';
  title?: string;
}) {
  const cls =
    tone === 'gold'
      ? 'border-gold/30 text-gold bg-gold/10 hover:bg-gold/20'
      : tone === 'danger'
        ? 'border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20'
        : 'border-card-border text-text-muted hover:text-foreground';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${cls}`}
    >
      {children}
    </button>
  );
}
