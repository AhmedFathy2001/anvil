import { NextResponse } from 'next/server';
import { requireClan } from '@/lib/clanContext';
import { verifyPluginTokenUser } from '@/lib/auth';
import { getNotificationWebhooks, type PluginWebhooks } from '@/lib/pluginConfig';
import { forwardPluginNotification, pickWebhookUrl } from '@/lib/discord';
import { playerEventEmbed } from '@/lib/discordEmbeds';
import { leaguesIconUrl, markSeasonal } from '@/lib/leagues';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { db } from '@/db';
import { clanMembers } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';

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
  // A channel setting may hold multiple webhook URLs — cycle across them to spread load and dodge
  // Discord's per-webhook rate limit on busy clans.
  return pickWebhookUrl(webhooks[channel], `plugin:${channel}`);
}

/**
 * Where a SEASONAL (Leagues) post goes.
 *
 * League drops are absurd by main-game standards and their kill counts mean nothing next to them,
 * so mixing the two makes both channels useless to read — a clan can point them at their own
 * channel. Falls back to the normal channel when they haven't: routing is an improvement, not a
 * precondition, and a post should never be lost because a webhook is unset.
 *
 * The plugin only reports that the player is ON a seasonal world; which channel that means is
 * decided here, so a clan can change it without waiting for a plugin release.
 */
function seasonalWebhookFor(webhooks: PluginWebhooks, channel: Channel): string | null {
  return pickWebhookUrl(webhooks.leagues, 'plugin:leagues') ?? webhookFor(webhooks, channel);
}

// A player-facing RSN for the embed's author line. Every plugin request already carries the account
// hash and current RSN (BingoApiClient.authedRequest sets them on every call), so the poster is
// identifiable without any plugin change: the hash is the reliable anchor (survives renames), the
// header is the fallback for accounts that never completed a handshake.
//
// Read-only on purpose — the auto-link/verify machinery belongs on the gameplay routes, not on a
// fire-and-forget notification.
async function posterRsn(request: Request, userId: number): Promise<string | null> {
  const accountHash = request.headers.get('X-Account-Hash')?.trim() || null;
  if (accountHash) {
    const owned = await db.query.clanMembers.findFirst({
      where: and(
        eq(clanMembers.accountHash, accountHash),
        eq(clanMembers.userId, userId),
        isNull(clanMembers.leftAt),
      ),
    });
    if (owned?.rsn) return owned.rsn;
  }
  // RSN header: self-reported, so it names the account the poster is logged into but proves
  // nothing. Fine for a display line — the token already established who is posting.
  const headerRsn = request.headers.get('X-RSN')?.trim();
  return headerRsn ? headerRsn.slice(0, 12) : null;
}

export async function POST(request: Request) {
  const clan = await requireClan();
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
  // Player is on a Leagues world — the plugin reports the fact, this route decides what it means.
  let seasonal = false;

  const contentType = request.headers.get('content-type') || '';
  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const raw = form.get('payload_json');
      if (typeof raw === 'string') {
        const parsed = JSON.parse(raw) as { channel?: unknown; content?: string; embed?: Record<string, unknown>; seasonal?: unknown };
        channel = parsed.channel;
        content = parsed.content;
        embed = parsed.embed;
        seasonal = parsed.seasonal === true;
      }
      const file = form.get('file');
      if (file instanceof File) {
        if (file.size > MAX_IMAGE_BYTES) {
          return NextResponse.json({ error: 'Image too large' }, { status: 413 });
        }
        image = { bytes: await file.arrayBuffer(), filename: file.name || 'image.png' };
      }
    } else {
      const parsed = (await request.json()) as { channel?: unknown; content?: string; embed?: Record<string, unknown>; seasonal?: unknown };
      channel = parsed.channel;
      content = parsed.content;
      embed = parsed.embed;
      seasonal = parsed.seasonal === true;
    }
  } catch {
    return NextResponse.json({ error: 'Malformed body' }, { status: 400 });
  }

  if (!isChannel(channel)) {
    return NextResponse.json({ error: 'Unknown channel' }, { status: 400 });
  }

  const webhooks = await getNotificationWebhooks(clan.id);
  const url = seasonal ? seasonalWebhookFor(webhooks, channel) : webhookFor(webhooks, channel);
  if (!url) {
    // No webhook configured for this channel — nothing to forward. Not an error; the plugin gates on
    // the notify flags from /api/plugin/config, but they can race a webhook being cleared on the site.
    return new NextResponse(null, { status: 204 });
  }

  // Deaths and PvP kills arrive as plain text + a screenshot; give them the same embed treatment as
  // everything else. Skipped the moment the plugin sends its own embed for these channels.
  let finalEmbed: Record<string, unknown> | null = embed ?? null;
  let finalContent = content;
  if (!finalEmbed && content && (channel === 'deaths' || channel === 'pvpKills')) {
    finalEmbed = playerEventEmbed({
      kind: channel === 'deaths' ? 'death' : 'pvp_kill',
      rsn: await posterRsn(request, auth.userId),
      message: content,
      imageFilename: image?.filename ?? null,
    }) as unknown as Record<string, unknown>;
    // The message moves into the embed's description, so don't also post it as content.
    finalContent = undefined;
  }

  // Marked server-side, after the embed is composed, so EVERY notification kind gets it without the
  // plugin knowing about each one — and clients already in the wild get it on deploy.
  if (seasonal) {
    finalEmbed = markSeasonal(finalEmbed, await leaguesIconUrl(clan.id));
  }

  const ok = await forwardPluginNotification(url, { content: finalContent, embed: finalEmbed, attachment: image });
  return NextResponse.json({ ok });
}
