import { NextResponse } from 'next/server';

import { verifyAdmin, verifyAdminOrModerator } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { eventChannelUrls } from '@/lib/discord';
import { getBotCredentials } from '@/lib/discord-roles';
import { createMoreAnvilWebhooks, lookupWebhookChannel } from '@/lib/discord-webhooks';
import { MAX_EXTRA_EVENT_WEBHOOKS } from '@/lib/discordPostPolicy';
import { normalizeDiscordWebhookUrl } from '@/lib/discordWebhookUrl';
import { channelChoices } from '@/lib/eventDiscordChannel';
import { readEventDiscordPrefs, saveEventDiscordPrefs } from '@/lib/eventDiscordPrefs';
import { eventInClan } from '@/lib/eventScope';
import { log } from '@/lib/logger';
import { setSetting } from '@/lib/settings';
import { noteWebhookSave, refuseBlockedWebhooks } from '@/lib/sharedWebhooks';
import { clanEventPool, eventWebhookCapacity, poolView } from '@/lib/webhookCapacity';
import { MAX_RECOMMENDED_WEBHOOKS, webhookIdOf } from '@/lib/webhookPool';

/**
 * The webhook pool behind one event's posts (lib/webhookPool): several webhooks for the SAME channel,
 * so a busy event never waits on one webhook's rate limit.
 *
 *   { action: 'add', webhookUrl }  a pasted webhook, refused unless it posts to the same channel
 *   { action: 'create', count }    the bot makes `count` more ("Anvil 2", "Anvil 3"…) in that channel
 *   { action: 'remove', webhookId } drop one from the event's own channel
 *
 * The pool is the event's own channel when it has one, else the clan's bingo (or main) channel, which
 * only a clan admin may change. Answers carry masked ids, never a URL.
 */

type Body = { action?: unknown; webhookUrl?: unknown; webhookId?: unknown; count?: unknown };

/** The event channel pool is capped by its main webhook plus MAX_EXTRA_EVENT_WEBHOOKS. */
const MAX_POOL = MAX_EXTRA_EVENT_WEBHOOKS + 1;

const SAME_CHANNEL =
  'That webhook posts to a different channel. Extra webhooks have to be in the same channel as the first one: they share its posts, they don’t add a second channel.';

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const eventId = Number((await params).eventId);
  if (!Number.isInteger(eventId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!(await verifyAdminOrModerator())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const clan = await requireClan();
  if (!(await eventInClan(clan.id, eventId))) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = ((await request.json().catch(() => ({}))) ?? {}) as Body;
  const prefs = await readEventDiscordPrefs(eventId);
  const own = eventChannelUrls(prefs);
  const target = own.length ? 'event' : 'clan';

  // The clan's channel is shared by every event: changing it is a clan admin's call.
  const clanPool = target === 'clan' ? await clanEventPool(clan.id) : null;
  if (target === 'clan') {
    if (!clanPool) return NextResponse.json({ error: 'Set a Discord channel first (Admin → Discord), then add more webhooks to it.' }, { status: 400 });
    if (!(await verifyAdmin())) {
      return NextResponse.json({ error: 'This event posts to your clan’s bingo channel. Ask a clan admin to add webhooks there.' }, { status: 403 });
    }
  }
  const urls = target === 'event' ? own : clanPool!.urls;

  async function save(next: string[]): Promise<void> {
    noteWebhookSave(next);
    if (target === 'event') {
      const [main, ...extra] = next;
      await saveEventDiscordPrefs(eventId, { ...prefs, webhookUrl: main, extraWebhookUrls: extra });
    } else {
      await setSetting(clan.id, clanPool!.key, next.join(' '));
    }
  }

  async function reply(next: string[], message: string) {
    const fresh = await readEventDiscordPrefs(eventId);
    return NextResponse.json({
      message,
      pool: target === 'event' ? poolView(next) : [],
      capacity: await eventWebhookCapacity(eventId, clan.id, fresh),
    });
  }

  /** The channel the pool posts to: the picked one, else asked of Discord via the first webhook. */
  async function poolChannel(): Promise<string | null> {
    if (target === 'event' && prefs.channelId) return prefs.channelId;
    return (await lookupWebhookChannel(urls[0]))?.channelId ?? null;
  }

  if (body.action === 'add') {
    const url = normalizeDiscordWebhookUrl(typeof body.webhookUrl === 'string' ? body.webhookUrl : '') ?? '';
    if (!url) {
      return NextResponse.json({ error: 'That is not a Discord webhook URL (https://discord.com/api/webhooks/…).' }, { status: 400 });
    }
    if (urls.includes(url)) return reply(urls, 'That webhook is already in the list.');
    const blocked = await refuseBlockedWebhooks([url]);
    if (blocked) return NextResponse.json({ error: blocked }, { status: 400 });
    if (urls.length >= MAX_POOL) return NextResponse.json({ error: `That’s the most Anvil uses for one channel (${MAX_POOL}).` }, { status: 400 });
    const [channel, added] = await Promise.all([poolChannel(), lookupWebhookChannel(url)]);
    if (!added) return NextResponse.json({ error: 'Discord doesn’t know that webhook. Copy its URL again from the channel’s Integrations.' }, { status: 400 });
    if (!channel) return NextResponse.json({ error: 'Couldn’t check which channel the current webhook posts to. Try again in a minute.' }, { status: 400 });
    if (added.channelId !== channel) return NextResponse.json({ error: SAME_CHANNEL }, { status: 400 });
    const next = [...urls, url];
    await save(next);
    return reply(next, `Added. Posts now share ${next.length} webhooks.`);
  }

  if (body.action === 'create') {
    const want = Math.max(1, Math.min(MAX_RECOMMENDED_WEBHOOKS, Math.floor(Number(body.count) || 1)));
    const room = target === 'event' ? MAX_POOL - urls.length : MAX_RECOMMENDED_WEBHOOKS - urls.length;
    const count = Math.min(want, room);
    if (count <= 0) return NextResponse.json({ error: 'This channel already has as many webhooks as Anvil uses.' }, { status: 400 });
    const creds = await getBotCredentials(clan.id).catch(() => null);
    if (!creds) return NextResponse.json({ error: 'Connect your Discord bot first, or add webhooks by hand.' }, { status: 400 });
    const channelId = await poolChannel();
    if (!channelId) return NextResponse.json({ error: 'Couldn’t tell which channel this posts to. Pick the channel again, then retry.' }, { status: 400 });
    // Only a channel in THIS clan's server: the shared bot sits in many guilds.
    const { channels } = await channelChoices(clan.id);
    if (!channels.some((c) => c.id === channelId)) {
      return NextResponse.json({ error: 'That channel isn’t in your server, so the bot can’t add webhooks to it. Add them by hand instead.' }, { status: 400 });
    }
    try {
      const { created, capped } = await createMoreAnvilWebhooks(creds.botToken, channelId, count);
      const next = [...urls, ...created.map((c) => c.url)];
      await save(next);
      log.info('discord.pool-created', { eventId, target, created: created.length, webhooks: next.length });
      return reply(
        next,
        `Added ${created.length} webhook${created.length === 1 ? '' : 's'}. Posts now share ${next.length}.` +
          (capped ? ' Discord allows 15 webhooks per channel, so that’s all there was room for.' : ''),
      );
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message || 'Discord wouldn’t make the webhooks. The bot needs Manage Webhooks on that channel.' }, { status: 400 });
    }
  }

  if (body.action === 'remove') {
    if (target !== 'event') return NextResponse.json({ error: 'Remove clan webhooks under Admin → Discord.' }, { status: 400 });
    const id = typeof body.webhookId === 'string' ? body.webhookId : '';
    const next = urls.filter((u) => webhookIdOf(u) !== id);
    if (next.length === urls.length) return reply(urls, 'Already removed.');
    if (next.length === 0) {
      return NextResponse.json({ error: 'That’s the last one. To stop using this channel, switch back to your clan’s bingo channel.' }, { status: 400 });
    }
    await save(next);
    return reply(next, 'Removed.');
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
