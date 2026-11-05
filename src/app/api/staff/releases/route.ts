import { NextResponse } from 'next/server';

import { isDiscordWebhookUrl } from '@/lib/discordWebhookUrl';
import { CAN_WRITE, requirePlatformApi } from '@/lib/platformAccess';
import { ANNOUNCEMENTS_WEBHOOK_KEY, ANNOUNCE_NOW_KEY, getPlatformSetting, loadReleaseFiles, parseVersionList, setPlatformSetting } from '@/lib/releases';

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

// POST /api/staff/releases { announce: '1.18.1' } — announce a silent release now. The next
// lifecycle tick on production posts it (beta never announces). Only a silent release in this
// build can be asked for.
export async function POST(request: Request) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  const body = (await request.json().catch(() => null)) as { announce?: unknown } | null;
  const version = typeof body?.announce === 'string' ? body.announce.trim() : '';
  const note = (await loadReleaseFiles()).find((n) => n.version === version);
  if (!note || !note.silent) return NextResponse.json({ error: 'Not a silent release in this build.' }, { status: 400 });
  const list = new Set(parseVersionList(await getPlatformSetting(ANNOUNCE_NOW_KEY)));
  list.add(version);
  await setPlatformSetting(ANNOUNCE_NOW_KEY, JSON.stringify([...list]));
  return NextResponse.json({ ok: true });
}
