import { and, count, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { clanRoster, events as eventsTable } from '@/db/schema';
import { resolveClanBySlug } from '@/lib/clanContext';
import { clanVisibilityOf } from '@/lib/clanVisibility';
import { ogCard } from '@/lib/ogCard';
import { getClanDisplayName } from '@/lib/pluginConfig';
import { DEFAULT_DESCRIPTION } from '@/lib/seo';

export const dynamic = 'force-dynamic';

/**
 * A clan's social card.
 *
 * A CLAN THAT KEEPS TO ITSELF GETS THE GENERIC CARD, not a 404 — the same rule the rest of the app
 * follows for a private clan. An image endpoint that 404s for exactly the private clans would answer
 * "does this clan exist and is it private?" to anybody who can spell a slug, which is the question
 * the setting exists to refuse. A plain Anvil card answers nothing.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const clan = await resolveClanBySlug(slug);

  if (!clan || clanVisibilityOf(clan.visibility) !== 'public') {
    return ogCard({ eyebrow: 'OSRS Clan Events', title: 'Anvil', subtitle: DEFAULT_DESCRIPTION });
  }

  const [[members], [eventRows], name] = await Promise.all([
    db
      .select({ n: count() })
      .from(clanRoster)
      .where(and(eq(clanRoster.clanId, clan.id), isNull(clanRoster.leftAt), eq(clanRoster.kind, 'member'))),
    db.select({ n: count() }).from(eventsTable).where(eq(eventsTable.clanId, clan.id)),
    getClanDisplayName(clan.id, clan.name),
  ]);

  const memberCount = Number(members?.n ?? 0);
  const eventCount = Number(eventRows?.n ?? 0);

  return ogCard({
    eyebrow: 'Clan on Anvil',
    title: name || clan.name,
    subtitle: 'Bingos, competitions and the roster.',
    // A brand-new clan has zeroes for both, and "0 EVENTS" on a card reads as a dead site. Show a
    // counter only once it counts something.
    stats: [
      ...(memberCount > 0 ? [{ label: 'Members', value: memberCount.toLocaleString() }] : []),
      ...(eventCount > 0 ? [{ label: 'Events', value: eventCount.toLocaleString() }] : []),
    ],
  });
}
