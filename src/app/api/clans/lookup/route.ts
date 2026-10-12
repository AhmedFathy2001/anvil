import { NextResponse } from 'next/server';
import { and, ilike, or } from 'drizzle-orm';

import { db } from '@/db';
import { clans, settings } from '@/db/schema';
import { listedClanWhere, showcaseJoinOn } from '@/lib/clanListing';

/**
 * Find a clan by name, for the plugin's Lookup tab: GET /api/clans/lookup?q=afk. Public, listed clans
 * only (the directory's own rule, lib/clanListing) — an unlisted clan is not something to search for.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get('q') ?? '').trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ clans: [] });
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  // clan-scope: global -- searching the public directory is a platform question.
  const found = await db
    .select({ slug: clans.slug, name: clans.name, logoUrl: clans.logoUrl })
    .from(clans)
    .leftJoin(settings, showcaseJoinOn())
    .where(and(listedClanWhere(), or(ilike(clans.name, like), ilike(clans.slug, like))))
    .orderBy(clans.name)
    .limit(8);
  return NextResponse.json({ clans: found });
}
