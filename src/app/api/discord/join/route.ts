import { NextResponse } from 'next/server';

import { track } from '@/lib/analytics';
import { currentClan } from '@/lib/clanContext';
import { hallJoinUrl } from '@/lib/clanHall';
import { SITE } from '@/lib/site';

export const dynamic = 'force-dynamic';

/**
 * Every Join button on a Discord card comes through here: count the click, then send them on.
 *
 * `/c/<slug>/api/discord/join?src=home` for a clan, `/api/discord/join?src=footer` for Anvil's own
 * server. `src` says which surface was pressed (home, public, embed, badge, footer) and lands in
 * platform analytics as a `discord.join` action, which the clan's admin page and /staff/analytics read.
 * Discord's own count of who actually joined lives on the invite (lib/discordWidgetInvite).
 */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('src') ?? '';
  const src = /^[a-z]{1,12}$/.test(raw) ? raw : 'other';
  const clan = await currentClan();

  const dest = clan ? await hallJoinUrl(clan.id) : SITE.supportDiscord;
  // https only. The clan's own invite setting is an admin's choice of link (a vanity URL, a
  // discord.com/invite/… form), so the host is not pinned — but nothing else is followed.
  if (!dest || !/^https:\/\//.test(dest)) {
    return NextResponse.json({ error: 'No Discord to join' }, { status: 404 });
  }
  track('discord.join', { clanId: clan?.id ?? null, props: { src } });
  return NextResponse.redirect(dest, { status: 302, headers: { 'Cache-Control': 'no-store' } });
}
