'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import EventForm from '@/components/EventForm';
import LocalTime from '@/components/LocalTime';

export interface EventRow {
  id: number;
  name: string;
  boardSize: number;
  startDate: string | null;
  endDate: string | null;
  forceEndedAt: string | null;
  createdAt: string;
}

interface Props {
  active: EventRow[];
  past: EventRow[];
  teamCounts: Record<number, number>;
}

export default function EventsClient({ active, past, teamCounts }: Props) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const total = active.length + past.length;

  async function deleteEvent(event: EventRow) {
    if (!confirm(`Permanently delete "${event.name}"? This wipes its tiles, teams, completions, and signups.`)) {
      return;
    }
    setDeletingId(event.id);
    try {
      const res = await fetch(`/api/events/${event.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Could not delete event');
        return;
      }
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <header className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gold mb-1">Events</h1>
          <p className="text-text-muted text-sm">
            {total} total · {active.length} active · {past.length} past
          </p>
        </div>
        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 text-sm font-semibold bg-gold hover:bg-gold-light text-brown-dark rounded-lg transition-colors shadow-sm shadow-gold/20"
          >
            + New event
          </button>
        )}
      </header>

      {showCreate && (
        <div className="border border-card-border rounded-xl bg-card-bg p-6 mb-8 shadow-lg shadow-black/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-1 h-5 bg-gold rounded-full" />
              <h2 className="font-semibold">Create Event</h2>
            </div>
            <button
              onClick={() => setShowCreate(false)}
              className="text-sm text-text-muted hover:text-foreground underline-offset-2 hover:underline"
            >
              Cancel
            </button>
          </div>
          <EventForm />
        </div>
      )}

      <section className="mb-8">
        <h2 className="font-semibold flex items-center gap-2 mb-3">
          <span className="w-1 h-5 bg-accent-green rounded-full" />
          Active
        </h2>
        {active.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-card-border rounded-xl text-sm text-text-muted">
            No active events.{' '}
            {!showCreate && (
              <button
                onClick={() => setShowCreate(true)}
                className="text-gold hover:underline"
              >
                Create one →
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {active.map((e) => (
              <EventCard
                key={e.id}
                event={e}
                teamCount={teamCounts[e.id] ?? 0}
                active
                onDelete={() => deleteEvent(e)}
                deleting={deletingId === e.id}
              />
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="font-semibold flex items-center gap-2 mb-3">
            <span className="w-1 h-5 bg-text-muted rounded-full" />
            Past
            <span className="text-xs text-text-muted/60 font-normal">({past.length})</span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {past.map((e) => (
              <EventCard
                key={e.id}
                event={e}
                teamCount={teamCounts[e.id] ?? 0}
                onDelete={() => deleteEvent(e)}
                deleting={deletingId === e.id}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function EventCard({
  event,
  teamCount,
  active,
  onDelete,
  deleting,
}: {
  event: EventRow;
  teamCount: number;
  active?: boolean;
  onDelete: () => void;
  deleting: boolean;
}) {
  const isDraft = !event.startDate && !event.forceEndedAt;
  const canDelete = !active || isDraft;

  return (
    <div
      className={`group relative border rounded-xl transition-all ${
        active
          ? 'border-card-border bg-card-bg hover:border-gold/40 hover:bg-card-bg-hover'
          : 'border-card-border/60 bg-card-bg/50 hover:border-gold/30'
      }`}
    >
      <Link href={`/admin/events/${event.id}`} className="block p-4">
        <div className="flex items-start justify-between mb-2 gap-2 pr-8">
          <h3
            className={`font-semibold group-hover:text-gold transition-colors ${
              active ? 'text-foreground' : 'text-text-muted'
            }`}
          >
            {event.name}
          </h3>
          <div className="flex items-center gap-1 shrink-0">
            {event.forceEndedAt ? (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400">
                Force-ended
              </span>
            ) : !active ? (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-text-muted/15 text-text-muted">
                Done
              </span>
            ) : null}
            <span className="text-xs bg-gold/15 text-gold/90 px-2 py-0.5 rounded-full font-medium">
              {event.boardSize}×{event.boardSize}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span>
            {teamCount} team{teamCount !== 1 ? 's' : ''}
          </span>
          <span>·</span>
          <span>{event.boardSize * event.boardSize} tiles</span>
        </div>
        {event.startDate && event.endDate && (
          <p className="text-[10px] text-text-muted/70 mt-2">
            <LocalTime date={event.startDate} format="date" /> — <LocalTime date={event.endDate} format="date" />
          </p>
        )}
      </Link>
      {canDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }}
          disabled={deleting}
          aria-label={`Delete event ${event.name}`}
          title="Delete event"
          className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
        >
          {deleting ? (
            <span className="text-[10px]">…</span>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
