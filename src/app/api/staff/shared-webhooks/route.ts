import { NextResponse } from 'next/server';

import { CAN_WRITE, requirePlatformApi } from '@/lib/platformAccess';
import { actOnSharedWebhook, listSharedWebhooks, type StaffWebhookAction } from '@/lib/sharedWebhooks';

/** The same Discord webhook set up by more than one clan (lib/sharedWebhooks). Support may read. */
export async function GET(request: Request) {
  const gate = await requirePlatformApi('support');
  if ('response' in gate) return gate.response;
  const status = new URL(request.url).searchParams.get('status') === 'all' ? 'all' : 'open';
  return NextResponse.json({ items: await listSharedWebhooks(status) });
}

const ACTIONS = new Set<StaffWebhookAction>(['block', 'unblock', 'dismiss']);

/**
 * POST { webhookId, action: 'block' | 'unblock' | 'dismiss', reason? }. Block refuses the id for every
 * clan, on send and on save, and tells the clans' admins; each is a `platform_*` audit row per clan.
 */
export async function POST(request: Request) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  const body = (await request.json().catch(() => null)) as { webhookId?: unknown; action?: unknown; reason?: unknown } | null;
  const webhookId = typeof body?.webhookId === 'string' ? body.webhookId : '';
  const action = body?.action as StaffWebhookAction;
  if (!webhookId || !ACTIONS.has(action)) {
    return NextResponse.json({ error: "webhookId and action ('block' | 'unblock' | 'dismiss') are required" }, { status: 400 });
  }
  const res = await actOnSharedWebhook({
    webhookId,
    action,
    actorUserId: gate.actor.user.userId,
    reason: typeof body?.reason === 'string' ? body.reason : undefined,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true });
}
