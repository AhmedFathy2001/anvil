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
import GuideLink from '@/components/GuideLink';
import ItemSlot from '@/components/ItemSlot';
import { getClanFeatures } from '@/lib/clanFeatures';
import { FORMAT_CARDS, FORMAT_GROUP_BLURB, findFormat, type FormatCard } from '@/lib/formatCatalog';

export const dynamic = 'force-dynamic';

/**
 * New event, in two screens. First "What are you running?": every format as a card with how it plays
 * and what it suits. Picking one opens the form already on that format (?format=…), so the format is
 * chosen once and the form only asks what that format needs.
 */
export default async function NewEventPage({ searchParams }: { searchParams: Promise<{ format?: string }> }) {
  const clan = await requireClan();
  const features = await getClanFeatures(clan.id);
  const offered = FORMAT_CARDS.filter((f) => !f.feature || features.on(f.feature));
  const picked = findFormat((await searchParams).format);
  const chosen = picked && offered.includes(picked) ? picked : null;
  // Formats behind a switched-off feature used to just not be there, and the reason lived on a page the
  // admin had no cause to open. Name them, and where to turn them on.
  if (!chosen) return <FormatPicker cards={offered} hidden={FORMAT_CARDS.filter((f) => !offered.includes(f)).map((f) => f.name)} />;

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
        href="/admin/events/new"
        className="inline-flex items-center gap-1 text-text-muted text-sm hover:text-gold transition-colors mb-4"
      >
        &larr; Change format
      </ClanLink>

      <header className="mb-6 flex items-center gap-4">
        <ItemSlot name={chosen.sprite} size={56} />
        <div>
          <h1 className="display display-lg text-3xl sm:text-[40px] font-semibold leading-tight">New {chosen.name.toLowerCase()}</h1>
          <p className="text-text-muted mt-1">{chosen.how}</p>
        </div>
      </header>

      <div className="border border-card-border rounded-xl bg-card-bg p-6 shadow-lg shadow-black/20 max-w-4xl">
        {/* Weekly competitions are a format on this page now, so there's nothing to send people
            elsewhere for. */}
        <EventForm
          presets={presets.filter((p) => !chosen.choice.mode || p.mode === chosen.choice.mode)}
          suggestedName={suggestedName}
          choice={chosen.choice}
        />
      </div>
    </div>
  );
}

const GROUPS: FormatCard['group'][] = ['Team bingo', 'Surprise tasks', 'Solo & ongoing'];

/** "What are you running?" */
function FormatPicker({ cards, hidden }: { cards: FormatCard[]; hidden: string[] }) {
  return (
    <div className="max-w-5xl">
      <ClanLink
        href="/admin/events"
        className="inline-flex items-center gap-1 text-text-muted text-sm hover:text-gold transition-colors mb-4"
      >
        &larr; All events
      </ClanLink>
      <header className="mb-8">
        <h1 className="display display-lg text-4xl sm:text-[44px] font-semibold leading-tight">What are you running?</h1>
        <p className="text-text-muted mt-2 text-[15px] max-w-[62ch]">
          Pick one and we&rsquo;ll ask a few quick questions. Nothing is posted to Discord and members don&rsquo;t see
          the tiles until you start it. First time? Classic bingo is the easiest.
        </p>
        <p className="mt-2">
          <GuideLink href="/guide/formats#choose">Compare the formats</GuideLink>
        </p>
      </header>
      <div className="space-y-9">
        {GROUPS.map((group) => {
          const inGroup = cards.filter((c) => c.group === group);
          if (inGroup.length === 0) return null;
          return (
            <section key={group}>
              <h2 className="display text-2xl font-semibold">{group}</h2>
              <p className="text-text-muted mt-1 mb-4">{FORMAT_GROUP_BLURB[group]}</p>
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {inGroup.map((c) => (
                  <ClanLink
                    key={c.key}
                    href={`/admin/events/new?format=${c.key}`}
                    className={`relative overflow-hidden flex gap-4 items-start p-[18px] rounded-xl border transition-colors ${
                      c.tag
                        ? 'border-gold/45 bg-[radial-gradient(70%_90%_at_15%_20%,rgba(224,170,30,.14),transparent_70%)] bg-[#1a1411]'
                        : 'border-[#2e251d] bg-[#18130f] hover:border-gold/35'
                    }`}
                  >
                    {c.tag && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] molten" />}
                    <ItemSlot name={c.sprite} size={60} />
                    <span className="min-w-0 flex flex-col gap-1.5">
                      <span className="flex items-center gap-2">
                        <span className="display text-xl font-semibold text-foreground">{c.name}</span>
                        {c.tag && (
                          <span className="text-[11px] font-semibold text-brown-dark bg-gold rounded-full px-2 py-px">{c.tag}</span>
                        )}
                      </span>
                      <span className="text-[#d8cdb8] leading-snug">{c.how}</span>
                      <span className="text-sm text-[#8f8270]">Good for {c.goodFor}</span>
                    </span>
                  </ClanLink>
                ))}
              </div>
            </section>
          );
        })}
        <section>
          <h2 className="display text-2xl font-semibold">Custom events</h2>
          <p className="text-text-muted mt-1 mb-4">Nothing to track: a time, a place and who&rsquo;s going.</p>
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            <ClanLink
              href="/admin/clan-events"
              className="flex gap-4 items-start p-[18px] rounded-xl border border-[#2e251d] bg-[#18130f] hover:border-gold/35 transition-colors"
            >
              <ItemSlot name="teleport" size={60} />
              <span className="min-w-0 flex flex-col gap-1.5">
                <span className="display text-xl font-semibold text-foreground">Clan event</span>
                <span className="text-[#d8cdb8] leading-snug">
                  A boss mass, a hangout or a drop party, once or every week. Posted to Discord and reminded before it starts, with
                  optional sign-ups, entry fee, payouts and a survey.
                </span>
                <span className="text-sm text-[#8f8270]">Good for weekly masses and get-togethers</span>
              </span>
            </ClanLink>
          </div>
        </section>
      </div>
      {hidden.length > 0 && (
        <p className="mt-9 text-sm text-text-muted">
          Switched off for this clan: {hidden.join(', ')}.{' '}
          <ClanLink href="/admin/features" className="text-gold hover:underline">
            Turn them on in Features
          </ClanLink>
          .
        </p>
      )}
    </div>
  );
}
