import { NextResponse } from 'next/server';

import { currentClan } from '@/lib/clanContext';
import { canSeeClan } from '@/lib/clanAccess';
import { verifyUser } from '@/lib/auth';
import { clanHallView, hallConfig, hallViewer } from '@/lib/clanHall';

export const dynamic = 'force-dynamic';

/**
 * The clan hall, for the card's own refresh (components/ClanHall). Names only for the clan's members
 * and staff, or for everyone when the clan chose that — the same rule the page used to render it.
 * A private clan answers only its insiders.
 */
export async function GET() {
  const clan = await currentClan();
  if (!clan) return NextResponse.json({ error: 'No clan' }, { status: 404 });
  const [config, viewer] = await Promise.all([hallConfig(clan.id), hallViewer(clan.id)]);
  // A clan that keeps to itself shows nothing to outsiders — the layout gates its pages with
  // ClanPrivate through this same check, and this endpoint must not be the way around that. Same answer as no clan at all.
  const session = await verifyUser();
  const readable = await canSeeClan({ clanId: clan.id, visibility: clan.visibility, playerId: session?.playerId, userId: session?.userId });
  if (!readable) {
    return NextResponse.json({ error: 'No clan' }, { status: 404 });
  }
  const view = await clanHallView(clan.id, {
    includeNames: viewer.insider || config.publicNames,
    viewerAccountIds: viewer.accountIds,
  });
  return NextResponse.json({ view }, { headers: { 'Cache-Control': 'private, no-store' } });
}
