import { NextResponse } from 'next/server';

import { requireClan } from '@/lib/clanContext';
import { verifyAdmin } from '@/lib/auth';
import { clanHallView, hallStatus } from '@/lib/clanHall';

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

  const hall = await clanHallView(clan.id, { includeNames: true, respectEnabled: false });
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
  });
}
