import { NextResponse } from 'next/server';

import { stampEmbeds } from '@/lib/discordEmbeds';
import { DISCORD_SAMPLES, sampleById } from '@/lib/discordSamples';
import { isDiscordWebhookUrl } from '@/lib/discordWebhookUrl';
import { CAN_WRITE, requirePlatformApi } from '@/lib/platformAccess';

// /api/staff/discord/samples — sample posts of every in-game post type (lib/discordSamples).
//   GET                         the list
//   POST { webhook, ids? }      send them (all, or the ids given) to that webhook, once each
// The webhook is used for this one send and never stored.

export async function GET() {
  const gate = await requirePlatformApi();
  if ('response' in gate) return gate.response;
  return NextResponse.json({ samples: DISCORD_SAMPLES.map(({ id, group, label }) => ({ id, group, label })) });
}

export async function POST(request: Request) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  const body = (await request.json().catch(() => null)) as { webhook?: unknown; ids?: unknown } | null;
  const webhook = typeof body?.webhook === 'string' ? body.webhook.trim() : '';
  if (!isDiscordWebhookUrl(webhook)) return NextResponse.json({ error: 'Paste a Discord webhook link for the channel.' }, { status: 400 });
  const ids = Array.isArray(body?.ids) ? body.ids.filter((x): x is string => typeof x === 'string') : DISCORD_SAMPLES.map((s) => s.id);
  const samples = ids.map(sampleById).filter((s) => s !== undefined);
  if (!samples.length) return NextResponse.json({ error: 'Pick at least one post.' }, { status: 400 });

  let sent = 0;
  const failed: string[] = [];
  for (const s of samples) {
    // Stamped like every real send (the "Powered by Anvil" footer), and never a ping.
    const payload = stampEmbeds({ embeds: [s.embed()], allowed_mentions: { parse: [] } });
    const res = await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => null);
    if (res?.ok) sent++;
    else failed.push(`${s.label}${res ? ` (${res.status})` : ''}`);
    // A webhook takes about five posts every two seconds.
    await new Promise((r) => setTimeout(r, 450));
  }
  return NextResponse.json({ ok: failed.length === 0, sent, failed });
}
