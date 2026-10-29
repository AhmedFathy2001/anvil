import { NextResponse } from 'next/server';

import { verifyAdmin } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { parseClanPostDefaults } from '@/lib/discordPostPolicy';
import {
  loadClanEventRoleDefaults,
  loadClanPostDefaults,
  saveClanEventRoleDefaults,
  saveClanPostDefaults,
} from '@/lib/eventDiscordPrefs';

/**
 * What every event of this clan starts from (lib/discordPostPolicy): each event post on or off and
 * who it pings, and the player-role and cleanup timing. Each event can change them on its own tab.
 * Admins only, like the rest of the clan's Discord settings.
 */

async function view(clanId: number) {
  const [posts, roles] = await Promise.all([loadClanPostDefaults(clanId), loadClanEventRoleDefaults(clanId)]);
  return { ...posts, roles };
}

export async function GET() {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const clan = await requireClan();
  return NextResponse.json(await view(clan.id));
}

export async function PUT(request: Request) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const clan = await requireClan();
  const body = (await request.json().catch(() => ({}))) as { posts?: unknown; pings?: unknown; roles?: unknown };
  if (body.posts !== undefined || body.pings !== undefined) {
    const current = await loadClanPostDefaults(clan.id);
    const next = parseClanPostDefaults({ posts: body.posts ?? current.posts, pings: body.pings ?? current.pings });
    await saveClanPostDefaults(clan.id, next);
  }
  if (body.roles !== undefined) await saveClanEventRoleDefaults(clan.id, body.roles);
  return NextResponse.json(await view(clan.id));
}
