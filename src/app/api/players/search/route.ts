import { NextResponse } from 'next/server';
import { and, asc, desc, eq, isNull, like, sql } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships, clans } from '@/db/schema';

/**
 * Look a character up by name.
 *
 * The platform could rank players and could render one, and had no way to GET from a name to the
 * page — you could reach a profile by being in the top twenty-five of a table or by already knowing
 * the URL. For a page whose whole job is to be looked at, that is the missing half.
 *
 * SHARED ONLY, which is the same rule /p/ enforces and for the same reason: an unshared character is
 * indistinguishable from one that does not exist. A search that confirmed "this RSN is on Anvil but
 * you may not see it" would leak exactly what the sharing switch is for.
 *
 * Public on purpose — everything it can return is already public — and capped so it cannot be walked
 * as an enumeration of the platform.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get('q') ?? '').trim().toLowerCase();
  // Two characters, because one matches most of the platform and answering it is just a slow way of
  // printing a random page of names.
  if (q.length < 2) return NextResponse.json({ results: [] });

  const term = q.replace(/[\s_]+/g, ' ').replace(/[%_]/g, '');
  if (!term) return NextResponse.json({ results: [] });

  // clan-scope: global -- a character belongs to a person, not a clan; looking one up spans clans.
  const rows = await db
    .select({
      rsn: accounts.rsn,
      overallXp: accounts.statsOverallXp,
      clanName: clans.name,
    })
    .from(accounts)
    .leftJoin(
      clanMemberships,
      and(
        eq(clanMemberships.accountId, accounts.id),
        eq(clanMemberships.kind, 'member'),
        isNull(clanMemberships.leftAt),
      ),
    )
    .leftJoin(clans, eq(clans.id, clanMemberships.clanId))
    .where(and(eq(accounts.shared, true), like(accounts.rsnNormalized, `${term}%`)))
    // A name that STARTS with what was typed, best-known first — somebody typing three letters is
    // far more often after the account with numbers on it than the one nobody has seen.
    .orderBy(desc(sql`coalesce(${accounts.statsOverallXp}, 0)`), asc(accounts.rsnNormalized))
    .limit(8);

  return NextResponse.json({
    results: rows.map((r) => ({ rsn: r.rsn, overallXp: r.overallXp, clanName: r.clanName })),
  });
}
