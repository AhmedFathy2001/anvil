import { NextResponse } from 'next/server';

import { requireClan } from '@/lib/clanContext';
import { verifyAdmin } from '@/lib/auth';
import { and, eq, gte, sql } from 'drizzle-orm';

import { db } from '@/db';
import { analyticsEvents } from '@/db/schema';
import { clanHallView, hallStatus } from '@/lib/clanHall';
import { inviteJoinCounts } from '@/lib/discordWidgetInvite';
import { getDiscordInviteUrl } from '@/lib/pluginConfig';

export const dynamic = 'force-dynamic';

/**
 * Is the clan's "who's around" card working, and if not, why — for the admin settings page.
 * Reads past the on/off switch, so an admin can see it working before turning it on.
 */
export async function GET() {
  const clan = await requireClan();
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { config, widget } = await hallStatus(clan.id);
  if (!config.guildId) return NextResponse.json({ state: 'no-server' });
  if (!widget || !widget.ok) return NextResponse.json({ state: widget?.reason ?? 'unreachable', guildId: config.guildId });

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().replace('T', ' ').slice(0, 19);
  const [hall, clicks, joins] = await Promise.all([
    clanHallView(clan.id, { includeNames: true, respectEnabled: false }),
    db
      .select({ src: sql<string>`coalesce(${analyticsEvents.props}->>'src', 'other')`, n: sql<number>`count(*)::int` })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.clanId, clan.id),
          eq(analyticsEvents.kind, 'action'),
          eq(analyticsEvents.name, 'discord.join'),
          gte(analyticsEvents.ts, since),
        ),
      )
      .groupBy(sql`coalesce(${analyticsEvents.props}->>'src', 'other')`),
    getDiscordInviteUrl(clan.id).then((own) => inviteJoinCounts(clan.id, own)).catch(() => []),
  ]);
  const onDiscord = hall?.people?.filter((p) => p.status) ?? [];
  return NextResponse.json({
    state: 'ok',
    guildId: config.guildId,
    name: widget.widget.name,
    online: hall?.counts.discord ?? widget.widget.presenceCount,
    inGame: hall?.counts.inGame ?? 0,
    matched: onDiscord.filter((p) => p.rsn).length,
    listed: onDiscord.length,
    hasDiscordInvite: !!widget.widget.instantInvite,
    hasInvite: !!hall?.guild?.inviteUrl,
    // Join-button clicks in the last 30 days, by surface, and Discord's count of joins per invite.
    clicks: Object.fromEntries(clicks.map((c) => [c.src, Number(c.n)])),
    joins,
  });
}
