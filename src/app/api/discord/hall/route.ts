import { NextResponse } from 'next/server';

import { currentClan } from '@/lib/clanContext';
import { clanHallView, hallConfig, hallViewer } from '@/lib/clanHall';

export const dynamic = 'force-dynamic';

/**
 * The clan hall, for the card's own refresh (components/ClanHall). Names only for the clan's members
 * and staff, or for everyone when the clan chose that — the same rule the page used to render it.
 */
export async function GET() {
  const clan = await currentClan();
  if (!clan) return NextResponse.json({ error: 'No clan' }, { status: 404 });
  const [config, viewer] = await Promise.all([hallConfig(clan.id), hallViewer(clan.id)]);
  const view = await clanHallView(clan.id, {
    includeNames: viewer.insider || config.publicNames,
    viewerAccountIds: viewer.accountIds,
  });
  return NextResponse.json({ view }, { headers: { 'Cache-Control': 'private, no-store' } });
}
