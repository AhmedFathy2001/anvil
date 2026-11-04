import { NextResponse } from 'next/server';

import {
  ANVIL_GUILD_KEY,
  ANVIL_ROLES_ENABLED_KEY,
  ANVIL_SUPPORTERS_WEBHOOK_KEY,
  ANVIL_SUPPORTERS_BACKFILL_KEY,
  announceCurrentSupporters,
  anvilBotStatus,
  ensureAnvilRoles,
  newSupporterEmbed,
  requestAnvilRoleSweep,
} from '@/lib/anvilDiscord';
import { isDiscordWebhookUrl } from '@/lib/discordWebhookUrl';
import { ANVIL_RECRUITMENT_WEBHOOK_KEY } from '@/lib/clanBoosts';
import { CAN_WRITE, requirePlatformApi } from '@/lib/platformAccess';
import { getPlatformSetting, isPreview, setPlatformSetting } from '@/lib/platformSettings';
import { apexOrigin } from '@/lib/seo';

export const dynamic = 'force-dynamic';

// The Anvil Discord (lib/anvilDiscord): the owner's own server, its "new supporters" webhook and the
// supporter roles the platform bot hands out there.

// GET /api/staff/discord — the bot's standing in the Anvil server, for the staff page's Recheck.
export async function GET() {
  const gate = await requirePlatformApi();
  if ('response' in gate) return gate.response;
  return NextResponse.json(await anvilBotStatus());
}

// PUT /api/staff/discord — { guildId?, webhook?, recruitWebhook?, rolesEnabled? }; only the fields sent
// change. recruitWebhook is the channel Level 3 boosted clans' monthly recruitment posts go to.
export async function PUT(request: Request) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  const body = (await request.json().catch(() => null)) as { guildId?: unknown; webhook?: unknown; recruitWebhook?: unknown; rolesEnabled?: unknown } | null;
  if (!body) return NextResponse.json({ error: 'Bad body' }, { status: 400 });
  if (typeof body.guildId === 'string') {
    const id = body.guildId.trim();
    if (id && !/^\d{15,22}$/.test(id)) return NextResponse.json({ error: 'A server id is a long number (Copy Server ID in Discord).' }, { status: 400 });
    await setPlatformSetting(ANVIL_GUILD_KEY, id || null);
  }
  if (typeof body.webhook === 'string') {
    const hook = body.webhook.trim();
    if (hook && !isDiscordWebhookUrl(hook)) return NextResponse.json({ error: 'That is not a Discord webhook link.' }, { status: 400 });
    await setPlatformSetting(ANVIL_SUPPORTERS_WEBHOOK_KEY, hook || null);
  }
  if (typeof body.recruitWebhook === 'string') {
    const hook = body.recruitWebhook.trim();
    if (hook && !isDiscordWebhookUrl(hook)) return NextResponse.json({ error: 'That is not a Discord webhook link.' }, { status: 400 });
    await setPlatformSetting(ANVIL_RECRUITMENT_WEBHOOK_KEY, hook || null);
  }
  if (typeof body.rolesEnabled === 'boolean') {
    await setPlatformSetting(ANVIL_ROLES_ENABLED_KEY, body.rolesEnabled ? '1' : null);
    // Turning it on catches everyone up on the next tick rather than within the hour.
    if (body.rolesEnabled) await requestAnvilRoleSweep();
  }
  return NextResponse.json({
    ok: true,
    webhookSet: !!(await getPlatformSetting(ANVIL_SUPPORTERS_WEBHOOK_KEY)),
    recruitWebhookSet: !!(await getPlatformSetting(ANVIL_RECRUITMENT_WEBHOOK_KEY)),
  });
}

// POST /api/staff/discord — { action: 'create-roles', includeSubscriber } | { action: 'sweep' } | { action: 'test-post' }
export async function POST(request: Request) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  const body = (await request.json().catch(() => null)) as { action?: unknown; includeSubscriber?: unknown } | null;
  switch (body?.action) {
    case 'create-roles': {
      const res = await ensureAnvilRoles(body.includeSubscriber !== false);
      if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
      return NextResponse.json({ ok: true, status: await anvilBotStatus() });
    }
    case 'announce-current': {
      // Once: everyone it posts is marked announced, so a second run would post nobody new anyway.
      if (isPreview()) return NextResponse.json({ error: 'Beta never posts to the Anvil Discord.' }, { status: 400 });
      if (await getPlatformSetting(ANVIL_SUPPORTERS_BACKFILL_KEY)) {
        return NextResponse.json({ error: 'Current supporters were already announced.' }, { status: 409 });
      }
      if (!(await getPlatformSetting(ANVIL_SUPPORTERS_WEBHOOK_KEY))) return NextResponse.json({ error: 'Set the webhook first.' }, { status: 400 });
      return NextResponse.json({ ok: true, ...(await announceCurrentSupporters()) });
    }
    case 'sweep': {
      await requestAnvilRoleSweep();
      return NextResponse.json({ ok: true });
    }
    case 'test-post': {
      if (isPreview()) return NextResponse.json({ error: 'Beta never posts to the Anvil Discord.' }, { status: 400 });
      const hook = await getPlatformSetting(ANVIL_SUPPORTERS_WEBHOOK_KEY);
      if (!hook || !isDiscordWebhookUrl(hook)) return NextResponse.json({ error: 'Set the webhook first.' }, { status: 400 });
      const embed = { ...newSupporterEmbed('Anvil test', 'patron', apexOrigin()), footer: { text: 'Test post from /staff/discord' } };
      const res = await fetch(hook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed], allowed_mentions: { parse: [] } }),
      }).catch(() => null);
      if (!res?.ok) return NextResponse.json({ error: `Discord refused the post${res ? ` (${res.status})` : ''}.` }, { status: 502 });
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
