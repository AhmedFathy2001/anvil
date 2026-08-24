import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { and, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clans, events, weeklyCompetitions } from '@/db/schema';
import { directoryClans } from '@/lib/apexDirectory';
import { isApexHost } from '@/lib/clanContext';
import { verifyUser } from '@/lib/auth';
import { clansOfPerson } from '@/lib/myClans';
import ClanLookup, { type LookupClan } from '@/components/ClanLookup';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Find a clan — Anvil',
  description: 'Clans running bingos, weekly competitions and rosters on Anvil.',
};

/**
 * The clan lookup.
 *
 * It used to be the same component the apex home rendered, which is why the apex was a directory.
 * The apex is now marketing or your own clans depending on whether you are signed in, and this is
 * where the list lives — a page you open with an intent, not one you land on.
 *
 * The viewer's own seats are joined in so a clan they are already in offers no way to apply to it.
 */
export default async function ClansPage() {
  if (!isApexHost((await headers()).get('host'))) notFound();

  const session = await verifyUser();
  const [rows, mine] = await Promise.all([
    // One query, still shared: two copies of a counting query is how two pages start disagreeing
    // about how many members a clan has.
    directoryClans(),
    session ? clansOfPerson(session.playerId, session.userId) : Promise.resolve([]),
  ]);

  const seatBySlug = new Map(mine.map((c) => [c.slug, c.seat]));

  // What each clan is running, in two queries rather than two per clan.
  const slugs = rows.map((r) => r.slug);
  const doing = slugs.length > 0 ? await liveBySlug(slugs) : new Map<string, string>();

  const clans: LookupClan[] = rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    members: r.members,
    doing: doing.get(r.slug) ?? null,
    seat: seatBySlug.get(r.slug) ?? null,
    verified: r.verified,
    guestPolicy: r.guestPolicy,
    activeThisWeek: r.activeThisWeek,
    xpThisWeek: r.xpThisWeek,
  }));

  return <ClanLookup clans={clans} />;
}

/** The name of one live thing per clan, preferring a competition over a board. */
async function liveBySlug(slugs: string[]): Promise<Map<string, string>> {
  const nowIso = new Date().toISOString();
  const out = new Map<string, string>();

  // clan-scope: global -- the lookup lists every clan by definition; there is no single clan here.
  const [evs, weeks] = await Promise.all([
    db
      .select({ slug: clans.slug, name: events.name })
      .from(events)
      .innerJoin(clans, eq(clans.id, events.clanId))
      .where(
        and(
          inArray(clans.slug, slugs),
          isNull(events.forceEndedAt),
          sql`${events.startDate} is not null and ${events.startDate} <= ${nowIso}`,
          or(isNull(events.endDate), gt(events.endDate, nowIso)),
        ),
      ),
    db
      .select({ slug: clans.slug, name: weeklyCompetitions.title })
      .from(weeklyCompetitions)
      .innerJoin(clans, eq(clans.id, weeklyCompetitions.clanId))
      .where(and(inArray(clans.slug, slugs), eq(weeklyCompetitions.status, 'active'))),
  ]);

  for (const e of evs) out.set(e.slug, e.name);
  // Weeklies win: a skill or boss week is the thing most people are actually in right now.
  for (const w of weeks) out.set(w.slug, w.name);
  return out;
}
