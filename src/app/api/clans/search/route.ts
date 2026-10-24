import { NextResponse } from 'next/server';
import { and, eq, ilike, ne, or } from 'drizzle-orm';

import { db } from '@/db';
import { clans, settings } from '@/db/schema';
import { verifyAdminOrModerator } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { listedClanWhere, showcaseJoinOn, isClanListed, PUBLIC_SHOWCASE_KEY } from '@/lib/clanListing';

/**
 * Find a clan to invite (an event invite, a co-host seat) by name or address, instead of making the
 * host know its exact slug.
 *
 * Staff only, and only clans that may be NAMED to a stranger (lib/clanListing): a clan that keeps
 * itself out of the directory must not be findable by typing "a". The one exception is an exact
 * address match — typing the whole slug proves you already know it, which is what the old
 * slug-only box asked for anyway, so an unlisted clan can still be invited by its address.
 */
export async function GET(request: Request) {
  if (!(await verifyAdminOrModerator())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const own = await requireClan();
  const q = (new URL(request.url).searchParams.get('q') ?? '').trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ clans: [] });

  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  // clan-scope: global -- finding ANOTHER clan is the point; listedClanWhere is the public-naming rule.
  const listed = await db
    .select({ id: clans.id, slug: clans.slug, name: clans.name, logoUrl: clans.logoUrl })
    .from(clans)
    .leftJoin(settings, showcaseJoinOn())
    .where(and(listedClanWhere(), ne(clans.id, own.id), or(ilike(clans.name, like), ilike(clans.slug, like))))
    .orderBy(clans.name)
    .limit(8);

  const slug = q.toLowerCase();
  if (!listed.some((c) => c.slug === slug)) {
    // clan-scope: global -- exact address lookup, see the note above.
    const exact = await db.query.clans.findFirst({
      where: and(eq(clans.slug, slug), ne(clans.id, own.id)),
      columns: { id: true, slug: true, name: true, logoUrl: true, status: true, visibility: true, platformHidden: true },
    });
    if (exact && exact.status === 'active') {
      const showcase = await db.query.settings.findFirst({
        where: and(eq(settings.clanId, exact.id), eq(settings.key, PUBLIC_SHOWCASE_KEY)),
        columns: { value: true },
      });
      // Unlisted clans come back by address only — no name, so nothing new is revealed.
      const named = isClanListed(exact, showcase?.value ?? null);
      listed.unshift({ id: exact.id, slug: exact.slug, name: named ? exact.name : exact.slug, logoUrl: named ? exact.logoUrl : null });
    }
  }
  return NextResponse.json({ clans: listed.map(({ slug, name, logoUrl }) => ({ slug, name, logoUrl })) });
}
