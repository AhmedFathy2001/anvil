import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, clans } from '@/db/schema';
import { requireClan } from '@/lib/clanContext';
import { verifyAdmin, verifyUser } from '@/lib/auth';
import { getSettingMap, setSetting } from '@/lib/settings';
import { PUBLIC_SHOWCASE_KEY } from '@/lib/clanListing';
import { STREAM_LINK_KEYS, checkStreamLink, isCreatorSpace, showcaseOn, showcaseValueFor } from '@/lib/creatorSpaces';
import { forgetLinkCards } from '@/lib/ogKit';
import { linkedTwitchBroadcaster } from '@/lib/twitchBot/channels';
import { CHAT_JOIN_SETTING } from '@/lib/twitchBot/wire';

/**
 * A creator space's own settings: its name, its Twitch and Kick links, and "Advertise on Anvil"
 * (the `public_showcase` switch, which for a creator space is OFF until turned on — lib/creatorSpaces).
 * Admin only, and only on a creator space; a clan has its own pages for all of this.
 */
async function guard() {
  const clan = await requireClan();
  if (!(await verifyAdmin())) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!isCreatorSpace(clan)) return { error: NextResponse.json({ error: 'Not a creator space' }, { status: 404 }) };
  return { clan };
}

export async function GET() {
  const g = await guard();
  if ('error' in g) return g.error;
  const [map, twitch] = await Promise.all([
    getSettingMap(g.clan.id, [STREAM_LINK_KEYS.twitch, STREAM_LINK_KEYS.kick, PUBLIC_SHOWCASE_KEY, CHAT_JOIN_SETTING]),
    linkedTwitchBroadcaster(g.clan.id),
  ]);
  return NextResponse.json({
    name: g.clan.name,
    twitchUrl: map.get(STREAM_LINK_KEYS.twitch) ?? '',
    kickUrl: map.get(STREAM_LINK_KEYS.kick) ?? '',
    advertised: showcaseOn('creator', map.get(PUBLIC_SHOWCASE_KEY) ?? null),
    // `!join` in Twitch chat (lib/twitchBot): the switch, and whether a channel is proved to be theirs.
    chatJoin: map.get(CHAT_JOIN_SETTING) === 'on',
    twitchLinked: twitch ? { login: twitch.login } : null,
  });
}

export async function PATCH(request: Request) {
  const g = await guard();
  if ('error' in g) return g.error;
  const actor = await verifyUser();
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Bad body' }, { status: 400 });

  const changed: Record<string, unknown> = {};

  if ('name' in body) {
    const name = String(body.name ?? '').trim().slice(0, 64);
    if (!name) return NextResponse.json({ error: 'Give your space a name.' }, { status: 400 });
    changed.name = name;
  }
  const links: Partial<Record<'twitch' | 'kick', string | null>> = {};
  for (const platform of ['twitch', 'kick'] as const) {
    const key = `${platform}Url`;
    if (!(key in body)) continue;
    const r = checkStreamLink(platform, body[key] == null ? '' : String(body[key]));
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    links[platform] = r.url;
  }

  if (typeof changed.name === 'string') {
    await db.update(clans).set({ name: changed.name }).where(eq(clans.id, g.clan.id));
    // The settings mirror every older reader still consults (see api/admin/settings).
    await setSetting(g.clan.id, 'clan_name', changed.name);
  }
  for (const [platform, url] of Object.entries(links) as ['twitch' | 'kick', string | null][]) {
    await setSetting(g.clan.id, STREAM_LINK_KEYS[platform], url);
    changed[`${platform}Url`] = url;
  }
  if ('advertised' in body) {
    const advertise = body.advertised === true;
    await setSetting(g.clan.id, PUBLIC_SHOWCASE_KEY, showcaseValueFor(advertise));
    if (!advertise) forgetLinkCards();
    changed.advertised = advertise;
  }

  if ('chatJoin' in body) {
    // The opt-in alone. The bot still answers only in a channel the space has PROVED is its own
    // (lib/twitchBot/channels linkedTwitchBroadcaster), so switching this on names no channel.
    const on = body.chatJoin === true;
    await setSetting(g.clan.id, CHAT_JOIN_SETTING, on ? 'on' : null);
    changed.chatJoin = on;
  }

  if (Object.keys(changed).length > 0) {
    await db
      .insert(clanAuditLog)
      .values({
        clanId: g.clan.id,
        eventType: 'creator_settings_changed',
        actorUserId: actor?.userId ?? null,
        newValue: JSON.stringify(changed),
      })
      .catch(() => {});
  }
  return NextResponse.json({ success: true });
}
