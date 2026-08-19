// The clan directory, shared by the apex home and /clans.
//
// Lifted out of app/page.tsx so both surfaces read it the same way. They existed as one before only
// because there was one of them; a second copy of a counting query is how two pages start
// disagreeing about how many members a clan has.

import { and, count, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { clanMemberships, clans, events as eventsTable } from '@/db/schema';
import { apexDomain } from '@/lib/clanContext';
import type { DirectoryClan } from '@/components/ApexDirectory';

/**
 * Every clan a stranger may browse.
 *
 * Counted in SQL rather than per clan in a loop: the per-clan version measured 509ms for a handful,
 * which does not survive a hundred.
 */
export async function directoryClans(): Promise<DirectoryClan[]> {
  // clan-scope: global -- the directory IS the list of every clan.
  const rows = await db
    .select({
      id: clans.id,
      slug: clans.slug,
      name: clans.name,
      customDomain: clans.customDomain,
      members: count(clanMemberships.id),
    })
    .from(clans)
    .leftJoin(
      clanMemberships,
      and(
        eq(clanMemberships.clanId, clans.id),
        isNull(clanMemberships.leftAt),
        eq(clanMemberships.kind, 'member'),
      ),
    )
    .where(eq(clans.status, 'active'))
    .groupBy(clans.id, clans.slug, clans.name, clans.customDomain)
    .orderBy(clans.name);

  const eventCounts = await db
    .select({ clanId: eventsTable.clanId, n: count() })
    .from(eventsTable)
    .groupBy(eventsTable.clanId);
  const eventsByClan = new Map(eventCounts.map((e) => [e.clanId, Number(e.n)]));

  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    host: r.customDomain || `${r.slug}.${apexDomain()}`,
    members: Number(r.members ?? 0),
    events: eventsByClan.get(r.id) ?? 0,
  }));
}
