import { count, eq } from 'drizzle-orm';

import { db } from '@/db';
import { events as eventsTable, teams as teamsTable, tiles as tilesTable } from '@/db/schema';
import { resolveClanById } from '@/lib/clanContext';
import { clanVisibilityOf } from '@/lib/clanVisibility';
import { eventStage } from '@/lib/eventStage';
import { visibilityOf } from '@/lib/eventVisibility';
import { ogCard, type OgStat } from '@/lib/ogCard';
import { getClanDisplayName } from '@/lib/pluginConfig';
import { DEFAULT_DESCRIPTION } from '@/lib/seo';

export const dynamic = 'force-dynamic';

const FORMAT_LABEL: Record<string, string> = {
  bingo: 'Bingo',
  ladder: 'Ladder',
  sotw: 'Skill of the Week',
  botw: 'Boss of the Week',
};

/**
 * An event's social card — the link people actually paste, since a board is the thing a clan wants
 * looked at.
 *
 * The gate is the READ gate, not the play gate: an `invited` event is not for strangers, and neither
 * is any event belonging to a clan that keeps to itself. Both fall back to the plain Anvil card for
 * the same reason the clan route does — a 404 here would answer questions about which private events
 * exist. A `clan`-visibility event on a public clan IS shown, because that is precisely what a
 * stranger following the link from Discord already sees on the page.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const generic = () =>
    ogCard({ eyebrow: 'OSRS Clan Events', title: 'Anvil', subtitle: DEFAULT_DESCRIPTION });

  const id = Number((await params).eventId);
  if (!Number.isInteger(id) || id <= 0) return generic();

  // clan-scope: global -- reads the very event named in the URL, by its own id; its clanId is
  // then resolved and access-checked on the next two lines, exactly as lib/eventAccess does.
  const event = await db.query.events.findFirst({ where: eq(eventsTable.id, id) });
  if (!event || visibilityOf(event.visibility) === 'invited') return generic();

  const clan = await resolveClanById(event.clanId);
  if (!clan || clanVisibilityOf(clan.visibility) !== 'public') return generic();

  const [[teamRows], [tileRows], clanName] = await Promise.all([
    db.select({ n: count() }).from(teamsTable).where(eq(teamsTable.eventId, event.id)),
    db.select({ n: count() }).from(tilesTable).where(eq(tilesTable.eventId, event.id)),
    getClanDisplayName(clan.id, clan.name),
  ]);

  const stage = eventStage(event);
  const eyebrow =
    stage === 'run' ? 'Live now' : stage === 'wrap' ? 'Finished' : 'Upcoming';

  const teamCount = Number(teamRows?.n ?? 0);
  // A board whose tiles are still hidden must not have them counted on a public card — the count is
  // the one thing `tilesRevealed` is holding back, and a card is the most public place there is.
  const tileCount = event.tilesRevealed ? Number(tileRows?.n ?? 0) : 0;

  const stats: OgStat[] = [
    ...(teamCount > 0 ? [{ label: 'Teams', value: String(teamCount) }] : []),
    ...(tileCount > 0 ? [{ label: 'Tiles', value: String(tileCount) }] : []),
  ];

  const format = FORMAT_LABEL[event.format] ?? 'Event';
  return ogCard({
    eyebrow: `${eyebrow} · ${format}`,
    title: event.name,
    subtitle: clanName || clan.name,
    stats,
  });
}
