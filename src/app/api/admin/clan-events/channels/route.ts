import { NextResponse } from 'next/server';

import { verifyAdminOrModerator } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { listLinkableChannels } from '@/lib/discord-broadcast';

// The clan's Discord channels, for pointing a clan event at its chat, guide and voice channel.

export async function GET() {
  const user = await verifyAdminOrModerator();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clan = await requireClan();
  return NextResponse.json(await listLinkableChannels(clan.id));
}
