import { NextResponse } from 'next/server';
import { verifyPluginTokenUser } from '@/lib/auth';
import { getNotificationWebhooks, type PluginWebhooks } from '@/lib/pluginConfig';
import { forwardPluginNotification } from '@/lib/discord';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

// The plugin POSTs clan notifications (death / kill / rare drop / CA) here instead of straight to
// Discord, so it never receives or calls a webhook URL itself — the server owns those (RuneLite
// plugin-hub rule). We resolve the channel's webhook, then forward. Clips do NOT come through here:
// a multi-MB video would blow the request-body limit, so the plugin uploads those directly to a
// webhook the user pastes into its own config.

// Screenshots are small PNGs. Cap well under the platform request-body limit so an oversized upload
// can't tie up the function.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const CHANNELS = ['rareDrops', 'deaths', 'combatAchievements', 'pvpKills'] as const;
type Channel = (typeof CHANNELS)[number];

function isChannel(value: unknown): value is Channel {
  return typeof value === 'string' && (CHANNELS as readonly string[]).includes(value);
}

function webhookFor(webhooks: PluginWebhooks, channel: Channel): string | null {
  return webhooks[channel];
}

export async function POST(request: Request) {
  const auth = await verifyPluginTokenUser(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized. Provide Authorization: Bearer <pluginToken>' }, { status: 401 });
  }

  // The plugin's spam floors (min drop value, dedup windows) all live client-side, so a tampered
  // client or raw API call could flood the clan's Discord through this endpoint. Cap per token holder.
  // 30/min is well above real play (a few drops/deaths/CAs a minute at most) but kills a flood.
  const limit = await rateLimit(request, `plugin-notify:${auth.userId}`, { limit: 30, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many notifications' }, { status: 429, headers: rateLimitHeaders(limit) });
  }

  let channel: unknown;
  let content: string | undefined;
  let embed: Record<string, unknown> | undefined;
  let image: { bytes: ArrayBuffer; filename: string } | null = null;

  const contentType = request.headers.get('content-type') || '';
  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const raw = form.get('payload_json');
      if (typeof raw === 'string') {
        const parsed = JSON.parse(raw) as { channel?: unknown; content?: string; embed?: Record<string, unknown> };
        channel = parsed.channel;
        content = parsed.content;
        embed = parsed.embed;
      }
      const file = form.get('file');
      if (file instanceof File) {
        if (file.size > MAX_IMAGE_BYTES) {
          return NextResponse.json({ error: 'Image too large' }, { status: 413 });
        }
        image = { bytes: await file.arrayBuffer(), filename: file.name || 'image.png' };
      }
    } else {
      const parsed = (await request.json()) as { channel?: unknown; content?: string; embed?: Record<string, unknown> };
      channel = parsed.channel;
      content = parsed.content;
      embed = parsed.embed;
    }
  } catch {
    return NextResponse.json({ error: 'Malformed body' }, { status: 400 });
  }

  if (!isChannel(channel)) {
    return NextResponse.json({ error: 'Unknown channel' }, { status: 400 });
  }

  const webhooks = await getNotificationWebhooks();
  const url = webhookFor(webhooks, channel);
  if (!url) {
    // No webhook configured for this channel — nothing to forward. Not an error; the plugin gates on
    // the notify flags from /api/plugin/config, but they can race a webhook being cleared on the site.
    return new NextResponse(null, { status: 204 });
  }

  const ok = await forwardPluginNotification(url, { content, embed: embed ?? null, image });
  return NextResponse.json({ ok });
}
