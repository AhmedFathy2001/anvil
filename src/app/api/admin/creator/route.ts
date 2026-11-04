import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, clans } from '@/db/schema';
import { requireClan } from '@/lib/clanContext';
import { verifyAdmin, verifyUser } from '@/lib/auth';
import { getSettingMap, setSetting } from '@/lib/settings';
import { PUBLIC_SHOWCASE_KEY } from '@/lib/clanListing';
import { isCreatorSpace, showcaseOn, showcaseValueFor } from '@/lib/creatorSpaces';
import { forgetLinkCards } from '@/lib/ogKit';
import { linkedTwitchBroadcaster } from '@/lib/twitchBot/channels';
import { CHAT_JOIN_SETTING } from '@/lib/twitchBot/wire';
import { chatJoinAllowed } from '@/lib/creatorPlans';
import { OVERLAY_HIDE_MARK_SETTING } from '@/lib/creatorPlansDb';
import { creatorCan, creatorMinPlanNameFor } from '@/lib/creatorCatalog';

/**
 * A creator space's own settings: its name and "Advertise on Anvil"
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
    getSettingMap(g.clan.id, [PUBLIC_SHOWCASE_KEY, CHAT_JOIN_SETTING, OVERLAY_HIDE_MARK_SETTING]),
    linkedTwitchBroadcaster(g.clan.id),
  ]);
  return NextResponse.json({
    name: g.clan.name,
    advertised: showcaseOn('creator', map.get(PUBLIC_SHOWCASE_KEY) ?? null),
    // `!join` in Twitch chat (lib/twitchBot): the switch, and whether a channel is proved to be theirs.
    chatJoin: map.get(CHAT_JOIN_SETTING) === 'on',
    twitchLinked: twitch ? { login: twitch.login } : null,
    // What the plan allows (lib/creatorPlans). Both true while FREEMIUM_ENFORCED is off; the plan name
    // is for the "a Silver feature" line when one is not.
    chatJoinPlan: chatJoinAllowed(g.clan.plan) ? null : creatorMinPlanNameFor('chat-join-bot'),
    overlayHideMark: map.get(OVERLAY_HIDE_MARK_SETTING) === 'on',
    overlayHidePlan: creatorCan(g.clan.plan, 'overlay-unbranded') ? null : creatorMinPlanNameFor('overlay-unbranded'),
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
  // Typed stream links (`twitchUrl` / `kickUrl`) are no longer accepted: a creator page links only
  // to channels connected through that platform's sign-in (lib/creatorSpaces verifiedStreamLinks).
  // An old client sending them is ignored rather than refused.

  if (typeof changed.name === 'string') {
    await db.update(clans).set({ name: changed.name }).where(eq(clans.id, g.clan.id));
    // The settings mirror every older reader still consults (see api/admin/settings).
    await setSetting(g.clan.id, 'clan_name', changed.name);
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
    if (on && !chatJoinAllowed(g.clan.plan)) {
      return NextResponse.json({ error: `!join in Twitch chat is a ${creatorMinPlanNameFor('chat-join-bot')} feature.` }, { status: 403 });
    }
    await setSetting(g.clan.id, CHAT_JOIN_SETTING, on ? 'on' : null);
    changed.chatJoin = on;
  }

  if ('overlayHideMark' in body) {
    // "Hide the Anvil mark" on the OBS overlay (lib/overlay/overlayData overlayMark). Switching it
    // OFF is always allowed; ON needs the plan once plans are enforced.
    const hide = body.overlayHideMark === true;
    if (hide && !creatorCan(g.clan.plan, 'overlay-unbranded')) {
      return NextResponse.json({ error: `Hiding the Anvil mark is a ${creatorMinPlanNameFor('overlay-unbranded')} feature.` }, { status: 403 });
    }
    await setSetting(g.clan.id, OVERLAY_HIDE_MARK_SETTING, hide ? 'on' : null);
    changed.overlayHideMark = hide;
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
