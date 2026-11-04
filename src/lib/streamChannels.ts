// One stream channel, one place.
//
// A Twitch, Kick or YouTube channel connects to ONE streaming space at a time — a creator space, or a
// clan with Streaming on. The gates, `!join` and the Kick webhooks all look a channel up by its
// platform id, and a channel claimed by two places answers for neither (lib/twitchBot/channels says
// so). So connecting a channel that is already connected somewhere else does not quietly make a
// second copy: the person is asked "This channel is connected to <X>. Move it here?", and the move
// happens only if they are an admin of BOTH places. The stored connection (its tokens and, for Kick,
// its webhook facts) moves with it; nobody has to sign in to the platform again.

import { and, eq, ne } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, clanKickChannels, clanTwitchChannels, clanYoutubeChannels, clans } from '@/db/schema';
import { streamsEvents } from '@/lib/creatorSpaces';
import { isAdminOfClan } from '@/lib/entryGatesDb';

export type StreamChannelPlatform = 'twitch' | 'kick' | 'youtube';

export function isStreamChannelPlatform(v: unknown): v is StreamChannelPlatform {
  return v === 'twitch' || v === 'kick' || v === 'youtube';
}

const PLATFORM_NAMES: Record<StreamChannelPlatform, string> = { twitch: 'Twitch', kick: 'Kick', youtube: 'YouTube' };

/** The connected channel of this platform in this place: its platform id and the name people know it by. */
async function channelOf(platform: StreamChannelPlatform, clanId: number): Promise<{ channelId: string; label: string } | null> {
  if (platform === 'twitch') {
    // clan-scope: this clan -- its own connected channel; tokens are not read.
    const r = await db.query.clanTwitchChannels.findFirst({ where: eq(clanTwitchChannels.clanId, clanId), columns: { twitchUserId: true, twitchLogin: true } });
    return r ? { channelId: r.twitchUserId, label: r.twitchLogin } : null;
  }
  if (platform === 'kick') {
    // clan-scope: this clan -- its own connected channel; tokens are not read.
    const r = await db.query.clanKickChannels.findFirst({ where: eq(clanKickChannels.clanId, clanId), columns: { kickUserId: true, kickSlug: true } });
    return r ? { channelId: r.kickUserId, label: r.kickSlug } : null;
  }
  // clan-scope: this clan -- its own connected channel; tokens are not read.
  const r = await db.query.clanYoutubeChannels.findFirst({ where: eq(clanYoutubeChannels.clanId, clanId), columns: { youtubeChannelId: true, title: true } });
  return r ? { channelId: r.youtubeChannelId, label: r.title } : null;
}

/** The OTHER place this channel is connected to, if any. */
export async function channelConnectedElsewhere(
  platform: StreamChannelPlatform,
  channelId: string,
  clanId: number,
): Promise<{ clanId: number; name: string } | null> {
  let other: number | undefined;
  // clan-scope: global -- "is this channel connected anywhere else" spans places by definition; only the id is read.
  if (platform === 'twitch') {
    other = (await db.query.clanTwitchChannels.findFirst({ where: and(eq(clanTwitchChannels.twitchUserId, channelId), ne(clanTwitchChannels.clanId, clanId)), columns: { clanId: true } }))?.clanId;
  } else if (platform === 'kick') {
    other = (await db.query.clanKickChannels.findFirst({ where: and(eq(clanKickChannels.kickUserId, channelId), ne(clanKickChannels.clanId, clanId)), columns: { clanId: true } }))?.clanId;
  } else {
    other = (await db.query.clanYoutubeChannels.findFirst({ where: and(eq(clanYoutubeChannels.youtubeChannelId, channelId), ne(clanYoutubeChannels.clanId, clanId)), columns: { clanId: true } }))?.clanId;
  }
  if (other == null) return null;
  // clan-scope: global -- the other place's name, to ask "move it from <X>?".
  const row = await db.query.clans.findFirst({ where: eq(clans.id, other), columns: { name: true } });
  return { clanId: other, name: row?.name ?? 'another space' };
}

/**
 * What a just-finished channel connect should say when the channel is already connected elsewhere:
 * `elsewhere` (with the other place) when this person may move it — an admin of both — else `taken`.
 * Null when the channel is free to connect here.
 */
export async function connectConflict(
  platform: StreamChannelPlatform,
  channelId: string,
  clanId: number,
  userId: number,
): Promise<{ outcome: 'elsewhere'; fromClanId: number } | { outcome: 'taken' } | null> {
  const other = await channelConnectedElsewhere(platform, channelId, clanId);
  if (!other) return null;
  return (await isAdminOfClan(other.clanId, userId)) ? { outcome: 'elsewhere', fromClanId: other.clanId } : { outcome: 'taken' };
}

export interface MoveOffer {
  platform: StreamChannelPlatform;
  platformName: string;
  fromClanId: number;
  fromName: string;
  channel: string;
}

/** The move this person could make — the prompt's words — or null when they may not make it. */
export async function moveOffer(platform: StreamChannelPlatform, fromClanId: number, toClanId: number, userId: number): Promise<MoveOffer | null> {
  if (fromClanId === toClanId) return null;
  if (!(await isAdminOfClan(fromClanId, userId)) || !(await isAdminOfClan(toClanId, userId))) return null;
  // clan-scope: this clan -- the destination must stream.
  const to = await db.query.clans.findFirst({ where: eq(clans.id, toClanId), columns: { kind: true, streaming: true } });
  if (!streamsEvents(to)) return null;
  const ch = await channelOf(platform, fromClanId);
  if (!ch) return null;
  // clan-scope: global -- the place it is moving from; the admin check above covers it.
  const from = await db.query.clans.findFirst({ where: eq(clans.id, fromClanId), columns: { name: true } });
  return { platform, platformName: PLATFORM_NAMES[platform], fromClanId, fromName: from?.name ?? 'another space', channel: ch.label };
}

export type MoveResult = { ok: true; channel: string } | { ok: false; error: string };

/**
 * Move this platform's channel from one place to another. Admin of both, the destination streaming.
 * The destination's own channel of that platform, if it had one, is replaced.
 */
export async function moveStreamChannel(opts: {
  platform: StreamChannelPlatform;
  fromClanId: number;
  toClanId: number;
  userId: number;
}): Promise<MoveResult> {
  const offer = await moveOffer(opts.platform, opts.fromClanId, opts.toClanId, opts.userId);
  if (!offer) return { ok: false, error: 'You can only move a channel between places you are an admin of.' };
  const { fromClanId, toClanId } = opts;
  await db.transaction(async (tx) => {
    if (opts.platform === 'twitch') {
      await tx.delete(clanTwitchChannels).where(eq(clanTwitchChannels.clanId, toClanId));
      await tx.update(clanTwitchChannels).set({ clanId: toClanId, updatedAt: new Date().toISOString() }).where(eq(clanTwitchChannels.clanId, fromClanId));
    } else if (opts.platform === 'kick') {
      await tx.delete(clanKickChannels).where(eq(clanKickChannels.clanId, toClanId));
      await tx.update(clanKickChannels).set({ clanId: toClanId, updatedAt: new Date().toISOString() }).where(eq(clanKickChannels.clanId, fromClanId));
    } else {
      await tx.delete(clanYoutubeChannels).where(eq(clanYoutubeChannels.clanId, toClanId));
      await tx.update(clanYoutubeChannels).set({ clanId: toClanId, updatedAt: new Date().toISOString() }).where(eq(clanYoutubeChannels.clanId, fromClanId));
    }
  });
  const line = JSON.stringify({ platform: opts.platform, channel: offer.channel, from: fromClanId, to: toClanId });
  await db
    .insert(clanAuditLog)
    .values([
      { clanId: fromClanId, eventType: 'stream_channel_moved_out', actorUserId: opts.userId, newValue: line },
      { clanId: toClanId, eventType: 'stream_channel_moved_in', actorUserId: opts.userId, newValue: line },
    ])
    .catch(() => {});
  return { ok: true, channel: offer.channel };
}
