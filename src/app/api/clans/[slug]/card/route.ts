import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships, clans, users } from '@/db/schema';
import { apexClan } from '@/lib/apexProfiles';
import { verifyPluginTokenUser } from '@/lib/auth';
import { loadClanCard } from '@/lib/clanCard';
import { jsonWithEtag } from '@/lib/httpEtag';

/**
 * One clan as the plugin shows it: GET /api/clans/<slug>/card (`clan-card` capability).
 *
 * Any clan the platform lists publicly (apexClan — the same test the clan's public page uses), plus
 * the caller's OWN clan whatever its listing, read off the Account Token: a member sees their clan's
 * card in the Clan tab even when the clan keeps itself off the directory.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const slug = decodeURIComponent((await params).slug).trim().toLowerCase();
  if (!slug || slug.length > 64) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // clan-scope: global -- resolving a clan by slug is what this route is.
  const clan = await db.query.clans.findFirst({
    where: eq(clans.slug, slug),
    columns: { id: true, slug: true, name: true, logoUrl: true, status: true },
  });
  if (!clan || clan.status === 'suspended') return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let visible = (await apexClan(slug)) != null;
  if (!visible) {
    const viewer = await verifyPluginTokenUser(request);
    if (viewer) {
      const user = await db.query.users.findFirst({ where: eq(users.id, viewer.userId), columns: { playerId: true } });
      if (user?.playerId != null) {
        // clan-scope: global -- does this person hold a live seat in this one clan.
        const [seat] = await db
          .select({ id: clanMemberships.id })
          .from(clanMemberships)
          .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
          .where(and(eq(clanMemberships.clanId, clan.id), eq(accounts.playerId, user.playerId), isNull(clanMemberships.leftAt)))
          .limit(1);
        visible = !!seat;
      }
    }
  }
  if (!visible) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return jsonWithEtag(request, await loadClanCard(clan));
}
