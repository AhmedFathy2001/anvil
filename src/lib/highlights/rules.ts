// Stream highlights — the rules. Pure: no database import (tests/pure-module-imports), so every
// decision below is tested without Postgres or Twitch (tests/highlights.test.ts).
//
// WHAT A HIGHLIGHT IS. A beat of a STREAMED event (lib/creatorSpaces streamedEvent) caught on a channel
// that is live at that moment: a Twitch clip made by the Anvil bot, and a link into the stream's VOD at
// the right second. Twitch first; a host streaming on YouTube gets the VOD link (YouTube has no clip
// API). Kick's public API has a live-status read but no VOD or clip endpoint, so Kick is skipped.
//
// WHOSE CHANNEL. Two kinds, never anybody else's:
//   host   — the space's connected channel (clan_twitch_channels / clan_youtube_channels), for the
//            event's own beats (it started, a team cleared the board, the winner) and for moments by
//            the host's OWN characters (the account that connected the channel). Only while the host's
//            "Auto-clip big moments on my stream" is on — default on once a channel is connected.
//   player — a player's own linked Twitch (user_twitch_links), for that player's own moments, only
//            when they turned on "Clip my stream when I hit a big moment". Default off.
// And only while the channel is LIVE: a clip of an offline channel is Twitch's 404 and a waste of the
// shared rate limit.

export type HighlightBeat = 'moment' | 'tile' | 'board' | 'start' | 'won' | 'h2h';
export type HighlightPlatform = 'twitch' | 'youtube';
export type ChannelOwner = 'host' | 'player';

/** Beats that belong to the EVENT (host channel only), as opposed to one player's. */
export const EVENT_BEATS: ReadonlySet<HighlightBeat> = new Set(['start', 'board', 'won']);

export interface HostChannels {
  /** "Auto-clip big moments on my stream" (clans.highlights_auto_clip). */
  autoClip: boolean;
  twitch: { broadcasterId: string; login: string; ownerPlayerId: number | null; broken: boolean } | null;
  youtube: { channelId: string; title: string; ownerPlayerId: number | null; broken: boolean } | null;
}

export interface BeatActor {
  playerId: number | null;
  userId: number | null;
  /** The actor's own linked Twitch, with their opt-in. */
  twitch: { id: string; login: string; clipOptIn: boolean } | null;
}

export interface HighlightTarget {
  platform: HighlightPlatform;
  owner: ChannelOwner;
  channelId: string;
  channelName: string;
  /** The player whose own channel it is (owner 'player'). */
  userId: number | null;
}

/**
 * Which channels a beat may be caught on. Liveness is checked afterwards (it needs the network);
 * this is everything that can be decided from rows.
 */
export function planTargets(opts: {
  streamed: boolean;
  beat: HighlightBeat;
  host: HostChannels;
  actor: BeatActor | null;
}): HighlightTarget[] {
  if (!opts.streamed) return [];
  const out: HighlightTarget[] = [];
  const { host, actor } = opts;
  const eventBeat = EVENT_BEATS.has(opts.beat);
  // The host's own characters: the account that connected the channel is the streamer.
  const hostsOwn = (ownerPlayerId: number | null) => actor?.playerId != null && ownerPlayerId != null && actor.playerId === ownerPlayerId;

  if (host.autoClip) {
    if (host.twitch && !host.twitch.broken && (eventBeat || hostsOwn(host.twitch.ownerPlayerId))) {
      out.push({ platform: 'twitch', owner: 'host', channelId: host.twitch.broadcasterId, channelName: host.twitch.login, userId: null });
    }
    if (host.youtube && !host.youtube.broken && (eventBeat || hostsOwn(host.youtube.ownerPlayerId))) {
      out.push({ platform: 'youtube', owner: 'host', channelId: host.youtube.channelId, channelName: host.youtube.title, userId: null });
    }
  }

  // A player's own stream: their own beats only, and only with their say-so.
  if (!eventBeat && actor?.twitch?.clipOptIn && actor.userId != null) {
    const already = out.some((t) => t.platform === 'twitch' && t.channelId === actor.twitch!.id);
    if (!already) {
      out.push({ platform: 'twitch', owner: 'player', channelId: actor.twitch.id, channelName: actor.twitch.login, userId: actor.userId });
    }
  }
  return out;
}

/**
 * Is a moment big enough to clip? Pets always; a drop when it clears the board's own Feed bar — the
 * floor its size sets (lib/moments eventFeedFloor / panelFeedWorthy), passed in as `feedWorthy` so
 * this stays free of the drop dataset. Deaths, levels and the rest are the feed's, not the stream's.
 */
export function momentClippable(kind: string, feedWorthy: boolean): boolean {
  if (kind === 'pet') return true;
  if (kind === 'unique' || kind === 'loot') return feedWorthy;
  return false;
}

/** How stale a beat may be and still be worth clipping: a clip is the last ~30 s of the stream. */
export const CLIP_FRESH_MS = 2 * 60_000;

export function freshEnough(occurredAtMs: number, now: number): boolean {
  return Number.isFinite(occurredAtMs) && now - occurredAtMs <= CLIP_FRESH_MS && occurredAtMs - now <= 60_000;
}

// ── Titles ───────────────────────────────────────────────────────────────────────────────────────

export const TITLE_MAX = 100;

/**
 * A highlight's title as Anvil shows it. Built from names players chose (RSNs, tile labels, team and
 * event names), so: no control or bidi characters, no angle brackets, one line, bounded. React escapes
 * on render anyway; this keeps the stored value clean for every other reader (the staff list, exports).
 */
export function cleanTitle(raw: string): string {
  const s = String(raw ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length <= TITLE_MAX) return s;
  return `${s.slice(0, TITLE_MAX - 1).trimEnd()}…`;
}

// ── Rate limits ──────────────────────────────────────────────────────────────────────────────────

/** A token bucket: `burst` at once, then one more every `refillMs`. */
export class TokenBucket {
  private tokens: number;
  private at: number;
  constructor(
    readonly burst: number,
    readonly refillMs: number,
    now = Date.now(),
  ) {
    this.tokens = burst;
    this.at = now;
  }

  private refill(now: number): void {
    if (now <= this.at) return;
    this.tokens = Math.min(this.burst, this.tokens + (now - this.at) / this.refillMs);
    this.at = now;
  }

  /** Would a take succeed now? Spends nothing. */
  peek(now = Date.now()): boolean {
    this.refill(now);
    return this.tokens >= 1;
  }

  take(now = Date.now()): boolean {
    this.refill(now);
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

/**
 * Clip creation limits: per channel (max one a minute, a burst of three — a pet and a tile in the same
 * breath both get theirs), and across Anvil (Twitch's limits are per bot token). A channel's bucket is
 * only spent once the global one agreed, so a refusal costs the channel nothing.
 */
export class ClipLimiter {
  private channels = new Map<string, TokenBucket>();
  private global: TokenBucket;
  constructor(
    private opts: { channelBurst: number; channelRefillMs: number; globalBurst: number; globalRefillMs: number } = {
      channelBurst: 3,
      channelRefillMs: 60_000,
      globalBurst: 30,
      globalRefillMs: 2_000,
    },
    now = Date.now(),
  ) {
    this.global = new TokenBucket(opts.globalBurst, opts.globalRefillMs, now);
  }

  allow(channelId: string, now = Date.now()): boolean {
    let ch = this.channels.get(channelId);
    if (!ch) {
      ch = new TokenBucket(this.opts.channelBurst, this.opts.channelRefillMs, now);
      this.channels.set(channelId, ch);
      if (this.channels.size > 5000) this.channels.delete(this.channels.keys().next().value as string);
    }
    // The channel is asked first, so a busy channel doesn't drain the global bucket for nothing.
    if (!ch.peek(now)) return false;
    if (!this.global.take(now)) return false;
    return ch.take(now);
  }
}

// ── VOD offsets ──────────────────────────────────────────────────────────────────────────────────

/** Seconds of lead-in before the beat, so the link opens on the build-up, not the aftermath. */
export const VOD_LEAD_S = 15;

/** Twitch's video duration ("3h8m33s", "45m2s", "59s") in seconds, or null. */
export function parseTwitchDuration(s: unknown): number | null {
  if (typeof s !== 'string') return null;
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(s.trim());
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

/** Twitch's `t=` value: "1h2m3s", "4m5s", "6s" (zero → "0s"). */
export function twitchTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h${m}m${s}s`;
  if (m > 0) return `${m}m${s}s`;
  return `${s}s`;
}

const TWITCH_VIDEO_ID = /^\d{1,20}$/;
const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{6,20}$/;

export function twitchVodUrl(videoId: string, offsetS: number): string | null {
  if (!TWITCH_VIDEO_ID.test(videoId)) return null;
  return `https://www.twitch.tv/videos/${videoId}?t=${twitchTimestamp(offsetS)}`;
}

export function youtubeVodUrl(videoId: string, offsetS: number): string | null {
  if (!YOUTUBE_VIDEO_ID.test(videoId)) return null;
  return `https://youtu.be/${videoId}?t=${Math.max(0, Math.floor(offsetS))}`;
}

export interface TwitchArchive {
  id: string;
  /** ISO — when the broadcast (and so the archive) started. */
  createdAt: string;
  /** "3h8m33s". While still live, how much has been recorded so far. */
  duration: string;
}

/**
 * The archive covering `atMs`, and the offset into it (lead-in subtracted, never below zero). A live
 * stream's archive grows; `slackS` lets a beat a little past the recorded length still match.
 */
export function pickTwitchVod(videos: TwitchArchive[], atMs: number, slackS = 180): { url: string; offsetS: number } | null {
  for (const v of videos) {
    const start = Date.parse(v.createdAt);
    const len = parseTwitchDuration(v.duration);
    if (!Number.isFinite(start) || len == null) continue;
    const off = (atMs - start) / 1000;
    if (off < 0 || off > len + slackS) continue;
    const offsetS = Math.max(0, Math.floor(off) - VOD_LEAD_S);
    const url = twitchVodUrl(v.id, offsetS);
    if (url) return { url, offsetS };
  }
  return null;
}

export interface YoutubeBroadcast {
  id: string;
  /** ISO, null until it went live. */
  actualStartTime: string | null;
  /** ISO, null while still live. */
  actualEndTime: string | null;
}

/** The broadcast that was live at `atMs`, and the offset into it. */
export function pickYoutubeVod(list: YoutubeBroadcast[], atMs: number, now = Date.now()): { url: string; offsetS: number } | null {
  for (const b of list) {
    if (!b.actualStartTime) continue;
    const start = Date.parse(b.actualStartTime);
    const end = b.actualEndTime ? Date.parse(b.actualEndTime) : now;
    if (!Number.isFinite(start) || !Number.isFinite(end) || atMs < start || atMs > end) continue;
    const offsetS = Math.max(0, Math.floor((atMs - start) / 1000) - VOD_LEAD_S);
    const url = youtubeVodUrl(b.id, offsetS);
    if (url) return { url, offsetS };
  }
  return null;
}

/** Is any of these broadcasts live right now (started, not ended)? */
export function youtubeLiveNow(list: YoutubeBroadcast[]): boolean {
  return list.some((b) => !!b.actualStartTime && !b.actualEndTime);
}

/** When to look for a VOD again after `attempts` misses: 2, 4, 8 … minutes, capped at two hours. */
export const VOD_MAX_ATTEMPTS = 14;
export function vodRetryDelayMs(attempts: number): number {
  return Math.min(2 * 60_000 * 2 ** Math.max(0, attempts), 2 * 60 * 60_000);
}

// ── What Twitch sends back ───────────────────────────────────────────────────────────────────────

/** Twitch's own hosts only: a clip page, and a thumbnail on its CDN. Anything else is dropped. */
export function safeClipUrl(v: unknown): string | null {
  return safeHttps(v, (h) => h === 'clips.twitch.tv' || h === 'www.twitch.tv' || h === 'twitch.tv');
}

export function safeThumbnailUrl(v: unknown): string | null {
  return safeHttps(v, (h) => h.endsWith('.jtvnw.net') || h === 'clips-media-assets2.twitch.tv' || h.endsWith('.twitchcdn.net'));
}

function safeHttps(v: unknown, hostOk: (host: string) => boolean): string | null {
  if (typeof v !== 'string' || v.length > 500) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
    return hostOk(u.hostname.toLowerCase()) ? u.toString() : null;
  } catch {
    return null;
  }
}

// ── Showing them ─────────────────────────────────────────────────────────────────────────────────

export interface ShownHighlight {
  id: number;
  beat: HighlightBeat;
  platform: HighlightPlatform;
  channelName: string;
  title: string;
  occurredAt: string;
  clipUrl: string | null;
  thumbnailUrl: string | null;
  durationS: number | null;
  vodUrl: string | null;
  teamId: number | null;
  tileId: number | null;
  momentId: number | null;
}

/** A row worth a card: it has a clip or a VOD link. */
export function showable(h: { clipUrl: string | null; vodUrl: string | null }): boolean {
  return !!h.clipUrl || !!h.vodUrl;
}

/**
 * Hidden standings: a highlight is its team's secret until the curtain lifts, the same rule as the
 * board's feed (lib/standingsVisibility canSeeTeamProgress — which also holds back a row it cannot
 * place on a team). The start is the one beat that names no side and gives nothing away.
 */
export function visibleToScope<T extends { beat: string; teamId: number | null }>(
  rows: T[],
  canSeeTeam: (teamId: number | null) => boolean,
): T[] {
  return rows.filter((r) => r.beat === 'start' || canSeeTeam(r.teamId));
}
