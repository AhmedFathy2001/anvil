import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, clans } from '@/db/schema';
import { requireClan } from '@/lib/clanContext';
import { verifyAdmin, verifyUser } from '@/lib/auth';
import { getSettingMap, setSetting } from '@/lib/settings';
import { isCreatorSpace, streamsEvents } from '@/lib/creatorSpaces';
import { linkedTwitchBroadcaster } from '@/lib/twitchBot/channels';
import { CHAT_JOIN_SETTING } from '@/lib/twitchBot/wire';
import { chatJoinAllowed } from '@/lib/creatorPlans';
import { OVERLAY_HIDE_MARK_SETTING } from '@/lib/creatorPlansDb';
import { clanCan, minPlanNameFor } from '@/lib/entitlements';

/**
 * A clan's "Streaming" switch (clans.streaming, lib/creatorSpaces streamsEvents) and the two streamer
 * switches that go with it: `!join` in Twitch chat and hiding the Anvil mark on the OBS overlay.
 *
 * Any admin of the clan. A creator space always streams and keeps these on its own settings page
 * (api/admin/creator), so it is refused here.
 *
 *   GET   → { streaming, chatJoin, twitchLinked, chatJoinPlan, overlayHideMark, overlayHidePlan }
 *   PATCH { streaming?: boolean, chatJoin?: boolean, overlayHideMark?: boolean }
 */
async function guard() {
  const clan = await requireClan();
  if (!(await verifyAdmin())) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (isCreatorSpace(clan)) return { error: NextResponse.json({ error: 'A creator space always streams.' }, { status: 400 }) };
  return { clan };
}

export async function GET() {
  const g = await guard();
  if ('error' in g) return g.error;
  const [map, twitch] = await Promise.all([
    getSettingMap(g.clan.id, [CHAT_JOIN_SETTING, OVERLAY_HIDE_MARK_SETTING]),
    linkedTwitchBroadcaster(g.clan.id),
  ]);
  return NextResponse.json({
    streaming: streamsEvents(g.clan),
    chatJoin: map.get(CHAT_JOIN_SETTING) === 'on',
    twitchLinked: twitch ? { login: twitch.login } : null,
    chatJoinPlan: chatJoinAllowed(g.clan.plan) ? null : minPlanNameFor('chat-join-bot'),
    overlayHideMark: map.get(OVERLAY_HIDE_MARK_SETTING) === 'on',
    overlayHidePlan: clanCan(g.clan.plan, 'overlay-unbranded') ? null : minPlanNameFor('overlay-unbranded'),
  });
}

export async function PATCH(request: Request) {
  const g = await guard();
  if ('error' in g) return g.error;
  const actor = await verifyUser();
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Bad body' }, { status: 400 });
  const b = body as Record<string, unknown>;
  const changed: Record<string, boolean> = {};

  if (typeof b.streaming === 'boolean') {
    // clan-scope: this clan -- its own switch.
    await db.update(clans).set({ streaming: b.streaming }).where(eq(clans.id, g.clan.id));
    changed.streaming = b.streaming;
  }
  // The streamer switches only mean something while Streaming is on (or being turned on now).
  const streaming = typeof b.streaming === 'boolean' ? b.streaming : streamsEvents(g.clan);

  if (typeof b.chatJoin === 'boolean') {
    if (b.chatJoin && !streaming) return NextResponse.json({ error: 'Turn on Streaming first.' }, { status: 400 });
    if (b.chatJoin && !chatJoinAllowed(g.clan.plan)) {
      return NextResponse.json({ error: `!join in Twitch chat is a ${minPlanNameFor('chat-join-bot')} feature.` }, { status: 403 });
    }
    await setSetting(g.clan.id, CHAT_JOIN_SETTING, b.chatJoin ? 'on' : null);
    changed.chatJoin = b.chatJoin;
  }

  if (typeof b.overlayHideMark === 'boolean') {
    if (b.overlayHideMark && !streaming) return NextResponse.json({ error: 'Turn on Streaming first.' }, { status: 400 });
    if (b.overlayHideMark && !clanCan(g.clan.plan, 'overlay-unbranded')) {
      return NextResponse.json({ error: `Hiding the Anvil mark is a ${minPlanNameFor('overlay-unbranded')} feature.` }, { status: 403 });
    }
    await setSetting(g.clan.id, OVERLAY_HIDE_MARK_SETTING, b.overlayHideMark ? 'on' : null);
    changed.overlayHideMark = b.overlayHideMark;
  }

  if (Object.keys(changed).length > 0) {
    await db
      .insert(clanAuditLog)
      .values({
        clanId: g.clan.id,
        eventType: 'streaming_settings_changed',
        actorUserId: actor?.userId ?? null,
        newValue: JSON.stringify(changed),
      })
      .catch(() => {});
  }
  return NextResponse.json({ ok: true, ...changed });
}
