import { NextResponse } from 'next/server';

import { db } from '@/db';
import { clanAuditLog } from '@/db/schema';
import { requireClan } from '@/lib/clanContext';
import { verifyAdmin, verifyUser } from '@/lib/auth';
import { streamsEvents } from '@/lib/creatorSpaces';
import { disconnectHostKick, hostKickChannel, resubscribeHostKick, setHostKickFlags } from '@/lib/gates/kickDb';
import { kickConfigured } from '@/lib/kick';
import { chatJoinAllowed } from '@/lib/creatorPlans';
import { minPlanNameFor } from '@/lib/entitlements';

/**
 * A creator space's connected Kick channel — what "Kick followers" / "Kick subs" check against, and
 * where `!join` answers. Status, the two switches, reconnecting webhooks, and disconnect here;
 * connecting is the OAuth round trip at /api/auth/kick/start. Tokens never leave the server.
 */
async function guard() {
  const clan = await requireClan();
  if (!(await verifyAdmin())) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!streamsEvents(clan)) return { error: NextResponse.json({ error: 'Turn on Streaming first' }, { status: 404 }) };
  return { clan };
}

export async function GET() {
  const g = await guard();
  if ('error' in g) return g.error;
  const configured = kickConfigured();
  return NextResponse.json({
    configured,
    channel: configured ? await hostKickChannel(g.clan.id) : null,
    // The client appends &return=<its own path>.
    connectUrl: configured ? `/api/auth/kick/start?space=${g.clan.id}` : null,
    // `!join` is Silver+ once plans are enforced (lib/creatorPlans); null = allowed.
    chatJoinPlan: chatJoinAllowed(g.clan.plan) ? null : minPlanNameFor('chat-join-bot'),
  });
}

/** { followersOnlyChat?: boolean, chatJoin?: boolean, resubscribe?: true } */
export async function PATCH(request: Request) {
  const g = await guard();
  if ('error' in g) return g.error;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Bad body' }, { status: 400 });
  if (body.resubscribe === true) {
    const ok = await resubscribeHostKick(g.clan.id);
    return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Kick refused. Reconnect your channel.' }, { status: 502 });
  }
  const flags: { followersOnlyChat?: boolean; chatJoin?: boolean } = {};
  if (typeof body.followersOnlyChat === 'boolean') flags.followersOnlyChat = body.followersOnlyChat;
  if (typeof body.chatJoin === 'boolean') flags.chatJoin = body.chatJoin;
  if (flags.chatJoin === true && !chatJoinAllowed(g.clan.plan)) {
    return NextResponse.json({ error: `!join in Kick chat is a ${minPlanNameFor('chat-join-bot')} feature.` }, { status: 403 });
  }
  if (Object.keys(flags).length === 0) return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });
  if (!(await setHostKickFlags(g.clan.id, flags))) return NextResponse.json({ error: 'Connect your Kick channel first.' }, { status: 409 });
  const actor = await verifyUser();
  await db
    .insert(clanAuditLog)
    .values({ clanId: g.clan.id, eventType: 'creator_kick_settings', actorUserId: actor?.userId ?? null, newValue: JSON.stringify(flags) })
    .catch(() => {});
  return NextResponse.json({ ok: true, channel: await hostKickChannel(g.clan.id) });
}

export async function DELETE() {
  const g = await guard();
  if ('error' in g) return g.error;
  const actor = await verifyUser();
  await disconnectHostKick(g.clan.id);
  await db
    .insert(clanAuditLog)
    .values({ clanId: g.clan.id, eventType: 'creator_kick_disconnected', actorUserId: actor?.userId ?? null })
    .catch(() => {});
  return NextResponse.json({ ok: true });
}
