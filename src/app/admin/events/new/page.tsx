import Link from 'next/link';
import EventForm from '@/components/EventForm';

export const dynamic = 'force-dynamic';

export default function NewEventPage() {
  return (
    <div>
      <Link
        href="/admin/events"
        className="inline-flex items-center gap-1 text-text-muted text-sm hover:text-gold transition-colors mb-4"
      >
        &larr; All events
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gold mb-1">Create Event</h1>
        <p className="text-text-muted text-sm">
          Spin up a bingo grid or a tile race. You&apos;ll land on the event&apos;s tabs to configure
          tiles, teams, sign-ups and stats.
        </p>
      </header>

      <div className="border border-card-border rounded-xl bg-card-bg p-6 shadow-lg shadow-black/20 max-w-2xl">
        <EventForm />
        <p className="text-xs text-text-muted/70 mt-4 pt-4 border-t border-card-border">
          Looking to start a Skill/Boss of the Week instead?{' '}
          <Link href="/admin/weekly" className="text-gold hover:underline">
            Manage weekly competitions →
          </Link>
        </p>
      </div>
    </div>
  );
}
