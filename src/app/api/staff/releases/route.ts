import { NextResponse } from 'next/server';

import { isDiscordWebhookUrl } from '@/lib/discordWebhookUrl';
import { CAN_WRITE, requirePlatformApi } from '@/lib/platformAccess';
import { ANNOUNCEMENTS_WEBHOOK_KEY, setPlatformSetting } from '@/lib/releases';

export const dynamic = 'force-dynamic';

// PUT /api/staff/releases — the #anvil-announcements webhook releases are posted to (lib/releases).
export async function PUT(request: Request) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  const body = (await request.json().catch(() => null)) as { webhook?: unknown } | null;
  const raw = typeof body?.webhook === 'string' ? body.webhook.trim() : '';
  if (raw && !isDiscordWebhookUrl(raw)) {
    return NextResponse.json({ error: 'That is not a Discord webhook link.' }, { status: 400 });
  }
  await setPlatformSetting(ANNOUNCEMENTS_WEBHOOK_KEY, raw || null);
  return NextResponse.json({ ok: true, set: !!raw });
}
