import { NextResponse } from 'next/server';

import { loadClanCard } from '@/lib/clanCard';
import { jsonWithEtag } from '@/lib/httpEtag';
import { visibleClan } from '@/lib/pluginUi/load';

/**
 * One clan as the plugin shows it: GET /api/clans/<slug>/card (`clan-card` capability).
 *
 * Any clan the platform lists publicly (apexClan — the same test the clan's public page uses), plus
 * the caller's OWN clan whatever its listing, read off the Account Token: a member sees their clan's
 * card in the Clan tab even when the clan keeps itself off the directory.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const clan = await visibleClan(request, decodeURIComponent((await params).slug));
  if (!clan) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return jsonWithEtag(request, await loadClanCard(clan));
}
