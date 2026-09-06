import type { MetadataRoute } from 'next';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clans, events as eventsTable, settings } from '@/db/schema';
import { DEFAULT_LOCALE } from '@/app/guide/_i18n';
import { allGuideHrefs } from '@/app/guide/_i18n/meta';
import { listedClanWhere, showcaseJoinOn } from '@/lib/clanListing';
import { absoluteUrl, clanCanonicalPath } from '@/lib/seo';

// Built on request, never at build time: this reads the database, and the Docker image is built
// without one. A prerendered sitemap would fail the build, and a stale one would list clans that
// have since gone private.
export const dynamic = 'force-dynamic';

/** Clan pages beyond the home worth pointing a crawler at. Everything else is gated or personal. */
const CLAN_SUBPAGES = ['/events', '/members'];

/** Most-recent events per clan. A four-year-old clan has hundreds and the old ones earn nothing. */
const EVENTS_PER_CLAN = 40;

/**
 * The map of everything a stranger may read.
 *
 * TWO GATES ON A CLAN, and they are different questions. `visibility = 'public'` is "anyone may read
 * this clan", which is what makes indexing it legitimate at all. `public_showcase` is "list me" —
 * default on, an explicit 'off' opts out — and a clan that asked not to be listed on the operator's
 * own directory has clearly not agreed to be handed to Google either. Requiring both is the reading
 * that cannot embarrass anybody.
 *
 * Events are included at `clan` visibility as well as `public`, because 'clan' means "this clan's
 * event", not "members only" — on a public clan a stranger following the link already sees the
 * board. `invited` is the one that is genuinely not for strangers.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const statics: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/clans'), lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: absoluteUrl('/leaderboard'), lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: absoluteUrl('/about'), changeFrequency: 'monthly', priority: 0.5 },
    { url: absoluteUrl('/pricing'), changeFrequency: 'monthly', priority: 0.6 },
    { url: absoluteUrl('/legal/terms'), changeFrequency: 'yearly', priority: 0.2 },
    { url: absoluteUrl('/legal/privacy'), changeFrequency: 'yearly', priority: 0.2 },
    { url: absoluteUrl('/legal/refunds'), changeFrequency: 'yearly', priority: 0.2 },
  ];

  // Twelve guides in sixteen languages. They were written and then left unreachable by search:
  // no sitemap listed them and nothing declared them translations of each other.
  const guides: MetadataRoute.Sitemap = allGuideHrefs().map(({ href, locale }) => ({
    url: absoluteUrl(href),
    changeFrequency: 'monthly' as const,
    // English is the one that ranks; the translations are for readers who arrive already knowing
    // what they want.
    priority: locale === DEFAULT_LOCALE ? 0.6 : 0.4,
  }));

  // clan-scope: global -- the sitemap IS the list of every publicly readable clan.
  const listed = await db
    .select({ id: clans.id, slug: clans.slug })
    .from(clans)
    .leftJoin(settings, showcaseJoinOn())
    .where(listedClanWhere())
    .orderBy(clans.slug);

  const clanUrls: MetadataRoute.Sitemap = listed.flatMap((c) => [
    { url: absoluteUrl(clanCanonicalPath(c.slug)), lastModified: now, changeFrequency: 'daily' as const, priority: 0.8 },
    ...CLAN_SUBPAGES.map((p) => ({
      url: absoluteUrl(clanCanonicalPath(c.slug, p)),
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.6,
    })),
  ]);

  const slugById = new Map(listed.map((c) => [c.id, c.slug]));
  const eventUrls: MetadataRoute.Sitemap = [];

  if (slugById.size > 0) {
    // clan-scope: global -- scoped to the listed clans resolved directly above, by id.
    const rows = await db
      .select({
        id: eventsTable.id,
        clanId: eventsTable.clanId,
        endDate: eventsTable.endDate,
        createdAt: eventsTable.createdAt,
        rank: sql<number>`row_number() over (partition by ${eventsTable.clanId} order by coalesce(${eventsTable.startDate}, ${eventsTable.createdAt}) desc)`,
      })
      .from(eventsTable)
      .where(
        and(
          inArray(eventsTable.clanId, [...slugById.keys()]),
          inArray(eventsTable.visibility, ['public', 'clan']),
        ),
      )
      .orderBy(desc(eventsTable.createdAt));

    for (const row of rows) {
      if (Number(row.rank) > EVENTS_PER_CLAN) continue;
      const slug = slugById.get(row.clanId);
      if (!slug) continue;
      // `endDate` and `createdAt` are stored two ways in these columns (see lib/dbTime); an
      // unparseable one is left off rather than sent as Invalid Date, which serialises to null and
      // makes the whole entry unusable.
      const stamp = new Date((row.endDate ?? row.createdAt ?? '').replace(' ', 'T'));
      eventUrls.push({
        url: absoluteUrl(clanCanonicalPath(slug, `/events/${row.id}`)),
        ...(Number.isNaN(stamp.getTime()) ? {} : { lastModified: stamp }),
        changeFrequency: 'daily',
        priority: 0.7,
      });
    }
  }

  return [...statics, ...guides, ...clanUrls, ...eventUrls];
}
