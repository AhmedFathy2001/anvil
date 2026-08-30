import { requireClan } from '@/lib/clanContext';
import { db } from '@/db';
import { eventPresets, events } from '@/db/schema';
import { count, desc, eq } from 'drizzle-orm';
import EventForm from '@/components/EventForm';
import { BUILTIN_PRESETS, suggestEventName, type EventPreset } from '@/lib/eventPresets';
import { modeKeyFor } from '@/lib/eventModes';
import { parseTileCsv } from '@/lib/csvTiles';
import { getClanDisplayName } from '@/lib/pluginConfig';
import ClanLink from '@/components/ClanLink';

export const dynamic = 'force-dynamic';

export default async function NewEventPage() {
  const clan = await requireClan();
  // Auto-name: "{Clan} Bingo #N" so the name field is never blank. Pull the clan name +
  // how many events exist so we can suggest the next number.
  const [clanName, [ec], savedRows] = await Promise.all([
    // Display name — the suggestion is prose ("{Clan} Bingo #3"), not an in-game match.
    getClanDisplayName(clan.id, ''),
    // THIS CLAN'S events. Unscoped, the suggestion counted every clan's boards on the deployment, so
    // a new clan's first event was proposed as "MyClan Bingo #4823". Exactly the read-side bug the
    // clan-scope lint rule exists to catch — it was reporting this one, in a list of 163 warnings.
    db.select({ c: count() }).from(events).where(eq(events.clanId, clan.id)),
    // Likewise: a saved template belongs to the clan that saved it. Unscoped, every clan's template
    // gallery listed every other clan's — and applying one seeds a board through the tile importer,
    // so this leaked their tile design too.
    db.select().from(eventPresets).where(eq(eventPresets.clanId, clan.id)).orderBy(desc(eventPresets.createdAt)),
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
      <ClanLink
        href="/admin/events"
        className="inline-flex items-center gap-1 text-text-muted text-sm hover:text-gold transition-colors mb-4"
      >
        &larr; All events
      </ClanLink>

      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gold mb-1">Create Event</h1>
        {/* Both kinds of thing are made here — a board you author, and a whole-clan competition
            that scores itself — so the blurb can't promise tiles and teams. The panel on the right
            says what the CHOSEN one actually needs. */}
        <p className="text-text-muted text-sm">
          A board to author, or a whole-clan competition that scores itself. Pick one below — the
          panel on the right says what it will need from you.
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
