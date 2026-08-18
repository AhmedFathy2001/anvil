import { NextResponse } from 'next/server';
import { requireClan } from '@/lib/clanContext';
import { verifyPluginTokenUser } from '@/lib/auth';
import { getNotificationWebhooks } from '@/lib/pluginConfig';
import { forwardPluginNotification, pickWebhookUrl } from '@/lib/discord';
import { clipEmbed } from '@/lib/discordEmbeds';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { db } from '@/db';
import { clanMembers } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';

/**
 * Clip relay — the clan's clips channel, without every member pasting a webhook.
 *
 * Clips used to be the one thing the plugin posted to Discord itself, uploading to a webhook URL
 * each user pasted into their own plugin config. That was a deliberate choice (a multi-MB video
 * through /api/plugin/notify would blow its request-body limit, and the hub forbids the plugin
 * calling a URL a server response handed it) but it meant the `webhook_clips` setting an admin can
 * already configure had no consumer at all, and clips only worked for members who had done manual
 * setup.
 *
 * This is the middle path: the plugin uploads to the site it's already authenticated against — its
 * own configured Site URL, not a URL we hand it — and the server resolves the clips webhook and
 * posts. Size is the reason this is a separate route from /notify rather than another channel on
 * it: the cap here is video-sized and its own concern.
 *
 * The plugin keeps both fallbacks: a user-pasted webhook when a site doesn't advertise
 * 'clip-relay', and local-only when there's neither.
 */

// Discord's own webhook upload ceiling for a non-boosted guild is 10MB (boosts raise it, but a
// clan can't rely on that). Anything bigger cannot be posted no matter what we do, so reject it
// here rather than spending the upload — the plugin then tells the player it stayed local.
const MAX_CLIP_BYTES = 10 * 1024 * 1024;

const ALLOWED_TYPES = new Set(['video/mp4', 'video/x-matroska', 'video/quicktime', 'video/webm']);

/** Display RSN for the post's author line. Mirrors /api/plugin/notify — read-only, proves nothing. */
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
  const headerRsn = request.headers.get('X-RSN')?.trim();
  return headerRsn ? headerRsn.slice(0, 12) : null;
}

export async function POST(request: Request) {
  const clan = await requireClan();
  const auth = await verifyPluginTokenUser(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized. Provide Authorization: Bearer <pluginToken>' }, { status: 401 });
  }

  // Far tighter than /notify's 30/min: a clip is a deliberate act (a hotkey press or an OBS
  // trigger), each one is megabytes, and nobody legitimately saves six a minute.
  const limit = await rateLimit(request, `plugin-clip:${auth.userId}`, { limit: 6, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many clips' }, { status: 429, headers: rateLimitHeaders(limit) });
  }

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'Send the clip as multipart/form-data' }, { status: 400 });
  }

  // Cheap pre-check on the declared length so an oversized upload is refused before its body is
  // read into memory. The post-read size check below is the one that actually enforces it.
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_CLIP_BYTES + 64 * 1024) {
    return NextResponse.json({ error: 'Clip too large', maxBytes: MAX_CLIP_BYTES }, { status: 413 });
  }

  let file: File | null = null;
  let moment: string | null = null;
  let eventName: string | null = null;
  let seconds: number | null = null;
  // Where the clipper stands, as the plugin already computed it for its own sidebar — cheaper and
  // more consistent than re-deriving the board here on the upload path.
  let standing: { rank: number; points: number; monthly: boolean } | null = null;
  try {
    const form = await request.formData();
    const raw = form.get('payload_json');
    if (typeof raw === 'string') {
      const parsed = JSON.parse(raw) as {
        moment?: unknown;
        eventName?: unknown;
        seconds?: unknown;
        rank?: unknown;
        points?: unknown;
      };
      if (typeof parsed.rank === 'number' && parsed.rank > 0 && typeof parsed.points === 'number') {
        standing = {
          rank: Math.min(100000, Math.round(parsed.rank)),
          points: Math.max(0, Math.round(parsed.points)),
          monthly: true,
        };
      }
      // Plugin-supplied strings reach Discord, so clamp them here as well as in the embed builder.
      if (typeof parsed.moment === 'string') moment = parsed.moment.slice(0, 500);
      if (typeof parsed.eventName === 'string') eventName = parsed.eventName.slice(0, 200);
      if (typeof parsed.seconds === 'number' && Number.isFinite(parsed.seconds)) {
        seconds = Math.max(0, Math.min(600, Math.round(parsed.seconds)));
      }
    }
    const f = form.get('file');
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ error: 'Malformed body' }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ error: 'No clip file in the request' }, { status: 400 });
  }
  if (file.size > MAX_CLIP_BYTES) {
    return NextResponse.json({ error: 'Clip too large', maxBytes: MAX_CLIP_BYTES }, { status: 413 });
  }
  if (file.type && !ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Unsupported clip format' }, { status: 415 });
  }

  const webhooks = await getNotificationWebhooks(clan.id);
  const url = pickWebhookUrl(webhooks.clips, 'plugin:clips');
  if (!url) {
    // No clips channel configured. A distinct code (not 204) so the plugin can say "your clan has
    // no clips channel" rather than silently claiming it posted.
    return NextResponse.json({ error: 'No clips channel is configured for this clan' }, { status: 501 });
  }

  const embed = clipEmbed({
    rsn: await posterRsn(request, auth.userId),
    moment,
    eventName,
    seconds,
    standing,
  });
  const ok = await forwardPluginNotification(url, {
    embed: embed as unknown as Record<string, unknown>,
    attachment: { bytes: await file.arrayBuffer(), filename: file.name || 'clip.mp4' },
  });
  if (!ok) {
    return NextResponse.json({ error: 'Discord rejected the clip' }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
