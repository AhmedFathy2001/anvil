import { NextResponse } from 'next/server';

import { track } from '@/lib/analytics';
import { verifyUser } from '@/lib/auth';
import { canSeeClan } from '@/lib/clanAccess';
import { currentClan } from '@/lib/clanContext';
import { clanVisibilityOf } from '@/lib/clanVisibility';
import { hallConfig, hallJoinUrl } from '@/lib/clanHall';
import { SITE } from '@/lib/site';

export const dynamic = 'force-dynamic';

const OFF_SITE = new Set(['embed', 'badge']);

/**
 * Every Join button on a Discord card comes through here: count the click, then send them on.
 *
 * `/c/<slug>/api/discord/join?src=home` for a clan, `/api/discord/join?src=footer` for Anvil's own
 * server. `src` says which surface was pressed (home, public, embed, badge, footer) and lands in
 * platform analytics as a `discord.join` action, which the clan's admin page and /staff/analytics read.
 * Discord's own count of who actually joined lives on the invite (lib/discordWidgetInvite).
 *
 * THE SAME GATES AS THE CARD THAT SHOWED THE BUTTON. This hands out an invite — and may have the bot
 * mint one — so it answers only where that card would render: a clan the visitor may read, with the
 * card switched on; for the off-site surfaces, a public clan with its embed allowed.
 */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('src') ?? '';
  const src = /^[a-z]{1,12}$/.test(raw) ? raw : 'other';
  const clan = await currentClan();

  let dest: string | null;
  if (!clan) {
    dest = SITE.supportDiscord;
  } else {
    const config = await hallConfig(clan.id);
    const offSite = OFF_SITE.has(src);
    const session = await verifyUser();
    const allowed = offSite
      ? clanVisibilityOf(clan.visibility) === 'public' && config.embed
      : config.enabled &&
        (await canSeeClan({ clanId: clan.id, visibility: clan.visibility, playerId: session?.playerId, userId: session?.userId }));
    dest = allowed ? await hallJoinUrl(clan.id) : null;
  }

  // https only. The clan's own invite setting is an admin's choice of link (a vanity URL, a
  // discord.com/invite/… form), so the host is not pinned — but nothing else is followed.
  if (!dest || !/^https:\/\//.test(dest)) {
    return NextResponse.json({ error: 'No Discord to join' }, { status: 404 });
  }
  track('discord.join', { clanId: clan?.id ?? null, props: { src } });
  return NextResponse.redirect(dest, { status: 302, headers: { 'Cache-Control': 'no-store' } });
}
