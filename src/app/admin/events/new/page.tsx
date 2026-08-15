import Link from 'next/link';
import { db } from '@/db';
import { eventPresets, events } from '@/db/schema';
import { count, desc } from 'drizzle-orm';
import EventForm from '@/components/EventForm';
import { BUILTIN_PRESETS, suggestEventName, type EventPreset } from '@/lib/eventPresets';
import { modeKeyFor } from '@/lib/eventModes';
import { parseTileCsv } from '@/lib/csvTiles';
import { getClanDisplayName } from '@/lib/pluginConfig';

export const dynamic = 'force-dynamic';

export default async function NewEventPage() {
  // Auto-name: "{Clan} Bingo #N" so the name field is never blank. Pull the clan name +
  // how many events exist so we can suggest the next number.
  const [clanName, [ec], savedRows] = await Promise.all([
    // Display name — the suggestion is prose ("{Clan} Bingo #3"), not an in-game match.
    getClanDisplayName(''),
    db.select({ c: count() }).from(events),
    db.select().from(eventPresets).orderBy(desc(eventPresets.createdAt)),
  ]);
  const suggestedName = suggestEventName(clanName, ec?.c ?? 0);

  // Turn saved templates into gallery presets. Their captured tile CSV is parsed back into
  // rows/labels here so applying one seeds the board through the same import pipeline a
  // manual CSV upload uses.
  const customPresets: EventPreset[] = savedRows.map((p) => {
    const parsed = p.tiles ? parseTileCsv(p.tiles) : null;
    const csv = parsed && !parsed.error ? { rows: parsed.rows, labels: parsed.labels } : null;
    return {
      key: `custom-${p.id}`,
      id: p.id,
      label: p.name,
      blurb: csv ? `Your saved template · ${csv.labels.length} tiles` : 'Your saved template',
      emoji: '⭐',
      mode: modeKeyFor(p.format, p.scoringMode),
      size: p.boardSize,
      custom: true,
      csv,
    };
  });
  const presets = [...customPresets, ...BUILTIN_PRESETS];

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
          Pick a template to get going fast, or tweak the details below. You&apos;ll land on the
          event&apos;s tabs to configure tiles, teams, sign-ups and stats.
        </p>
      </header>

      <div className="border border-card-border rounded-xl bg-card-bg p-6 shadow-lg shadow-black/20 max-w-4xl">
        {/* Weekly competitions are a format on this page now, so there's nothing to send people
            elsewhere for. */}
        <EventForm presets={presets} suggestedName={suggestedName} />
      </div>
    </div>
  );
}
