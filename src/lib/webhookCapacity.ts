// Is an event's Discord destination big enough for it? The facts behind the "add more webhooks"
// advice (lib/webhookPool webhookAdvice), read by the event's Discord tab and the admin dashboard.
//
// Where an event posts: its own channel's pool when it has one (events.discord_prefs webhookUrl +
// extraWebhookUrls), else the clan's bingo channel, else its main one, each of which may hold
// several URLs (a clan setting is a space-separated list). Activity and 429s come from the in-memory
// meter the send path feeds (lib/discord webhookActivity).

import { count, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { eventParticipants } from '@/db/schema';
import { eventActivityKey, eventChannelUrls, eventPoolKey, parseWebhookUrls, webhookActivity } from '@/lib/discord';
import { lookupWebhookChannel } from '@/lib/discord-webhooks';
import type { EventDiscordPrefs } from '@/lib/discordPostPolicy';
import { getSettingText } from '@/lib/settings';
import { maskedWebhookId, webhookAdvice, webhookIdOf, type WebhookAdvice } from '@/lib/webhookPool';

/** The clan keys an event without its own channel posts to, in fallback order (as lib/discord does). */
export const CLAN_EVENT_KEYS = ['discord_webhook_bingo', 'discord_webhook_url'] as const;

/** The clan setting an event's posts land in, and its URLs. Null when neither is set. */
export async function clanEventPool(clanId: number): Promise<{ key: string; urls: string[] } | null> {
  for (const key of CLAN_EVENT_KEYS) {
    const urls = parseWebhookUrls(await getSettingText(clanId, key).catch(() => null));
    if (urls.length) return { key, urls };
  }
  return null;
}

/** Players on each event (event_participants rows), by event id. */
export async function eventParticipantCounts(eventIds: number[]): Promise<Map<number, number>> {
  if (eventIds.length === 0) return new Map();
  const rows = await db
    .select({ eventId: eventParticipants.eventId, n: count() })
    .from(eventParticipants)
    .where(inArray(eventParticipants.eventId, eventIds))
    .groupBy(eventParticipants.eventId);
  return new Map(rows.map((r) => [r.eventId, Number(r.n)]));
}

/** One pooled webhook as the browser may see it: an id to remove it by and a masked label. Never the token. */
export interface PoolHookView {
  id: string;
  label: string;
}

export function poolView(urls: string[]): PoolHookView[] {
  return urls.map((u) => ({ id: webhookIdOf(u) ?? '', label: maskedWebhookId(u) })).filter((h) => h.id);
}

export interface EventWebhookCapacity {
  /** 'event' = the event's own channel pool, 'clan' = the clan's bingo/main channel, 'none' = nowhere. */
  destination: 'event' | 'clan' | 'none';
  /** The clan setting behind a 'clan' destination. */
  clanKey: string | null;
  webhooks: number;
  participants: number;
  postsPerMinute: number;
  recentRateLimits: number;
  advice: WebhookAdvice | null;
}

/** The capacity facts for one event, given its prefs (pass them when already loaded). */
export function capacityFrom(input: {
  eventId: number;
  clanId: number;
  prefs: EventDiscordPrefs;
  participants: number;
  clanPool: { key: string; urls: string[] } | null;
  now?: number;
}): EventWebhookCapacity {
  const own = eventChannelUrls(input.prefs);
  const destination = own.length ? 'event' : input.clanPool ? 'clan' : 'none';
  const webhooks = own.length || input.clanPool?.urls.length || 0;
  // The pool's own cursor key is what the send path counts its 429s under.
  const poolKey = own.length ? eventPoolKey(input.eventId) : input.clanPool ? `${input.clanId}:${input.clanPool.key}` : null;
  const postsPerMinute = webhookActivity.postsPerMinute(eventActivityKey(input.eventId), input.now);
  const recentRateLimits = poolKey ? webhookActivity.recentRateLimits(poolKey, input.now) : 0;
  return {
    destination,
    clanKey: destination === 'clan' ? input.clanPool!.key : null,
    webhooks,
    participants: input.participants,
    postsPerMinute,
    recentRateLimits,
    advice: destination === 'none' ? null : webhookAdvice({ participants: input.participants, postsPerMinute, recentRateLimits, webhooks }),
  };
}

export async function eventWebhookCapacity(eventId: number, clanId: number, prefs: EventDiscordPrefs): Promise<EventWebhookCapacity> {
  const [counts, clanPool] = await Promise.all([eventParticipantCounts([eventId]), clanEventPool(clanId)]);
  return capacityFrom({ eventId, clanId, prefs, participants: counts.get(eventId) ?? 0, clanPool });
}

/**
 * Do these webhooks all post to one channel? Pooling is for ONE channel: webhooks in different
 * channels would scatter an event's posts. `channelId` is the shared channel when they agree;
 * `unknown` counts webhooks Discord couldn't tell us about (deleted, or Discord unreachable).
 */
export async function poolChannels(urls: string[]): Promise<{ channelId: string | null; mixed: boolean; unknown: number }> {
  const found = await Promise.all(urls.map((u) => lookupWebhookChannel(u)));
  const ids = new Set(found.filter((f) => f).map((f) => f!.channelId));
  return {
    channelId: ids.size === 1 ? [...ids][0] : null,
    mixed: ids.size > 1,
    unknown: found.filter((f) => !f).length,
  };
}
