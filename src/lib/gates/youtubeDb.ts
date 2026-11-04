// YouTube entry gates — the database and network half (the rules and API client are lib/gates/youtube).
//
//   the host's channel   clan_youtube_channels — tokens encrypted, refreshed, marked broken on refusal
//   proofs               user_youtube_proofs   — 'sub' (viewer OAuth) and 'member' (live-chat code),
//                                                trusted for PROOF_TTL_MS
//   claims               event_youtube_claims  — one YouTube channel, one player per event
//
// lib/entryGatesDb wires these into the shared verdict; nothing here knows about Twitch or Discord.

import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { clanYoutubeChannels, eventYoutubeClaims, userYoutubeProofs } from '@/db/schema';
import { parseStamp } from '@/lib/dbTime';
import type { GateKind, GateOptions } from '@/lib/entryGates';
import {
  YoutubeAuthError,
  activeLiveChatId,
  chatCode,
  fetchMyChannel,
  findCodeInChat,
  recentChat,
  subscribesTo,
  refreshToken,
  revokeToken,
  youtubeConfig,
  type ApiResult,
  type FetchLike,
  type YoutubeAnswer,
  type YoutubeChannel,
  type YoutubeConfig,
  type YoutubeTokenSet,
} from '@/lib/gates/youtube';
import { decryptSecret, encryptSecret } from '@/lib/secretBox';
import { log } from '@/lib/logger';

/** How long a proof is trusted: a day covers "check, then join", and a lapsed sub is noticed tomorrow. */
export const PROOF_TTL_MS = 24 * 60 * 60_000;

export type ProofKind = 'sub' | 'member';

const f: FetchLike = (input, init) => fetch(input, init);

// ── The host's channel ──────────────────────────────────────────────────────────────────────────

export interface HostYoutubeInfo {
  channelId: string;
  title: string;
  handle: string | null;
  broken: boolean;
}

/** What the host's settings may show. Never the tokens. */
export async function hostYoutubeChannel(clanId: number): Promise<HostYoutubeInfo | null> {
  // clan-scope: clanId is the caller's resolved creator space.
  const row = await db.query.clanYoutubeChannels.findFirst({
    where: eq(clanYoutubeChannels.clanId, clanId),
    columns: { youtubeChannelId: true, title: true, handle: true, brokenAt: true },
  });
  if (!row) return null;
  return { channelId: row.youtubeChannelId, title: row.title, handle: row.handle, broken: row.brokenAt != null };
}

function expiresAtFor(set: YoutubeTokenSet): string {
  return new Date(Date.now() + Math.max(0, set.expiresIn - 60) * 1000).toISOString();
}

export async function saveHostYoutubeChannel(opts: {
  clanId: number;
  userId: number;
  cfg: YoutubeConfig;
  tokens: YoutubeTokenSet & { refreshToken: string };
  channel: YoutubeChannel;
}): Promise<void> {
  const values = {
    youtubeChannelId: opts.channel.id,
    title: opts.channel.title,
    handle: opts.channel.handle,
    accessToken: encryptSecret(opts.tokens.accessToken, opts.cfg.tokenKey),
    refreshToken: encryptSecret(opts.tokens.refreshToken, opts.cfg.tokenKey),
    expiresAt: expiresAtFor(opts.tokens),
    scope: opts.tokens.scope.join(' '),
    linkedByUserId: opts.userId,
    brokenAt: null,
    updatedAt: new Date().toISOString(),
  };
  // clan-scope: clanId was re-checked as an admin's creator space at the OAuth callback.
  await db
    .insert(clanYoutubeChannels)
    .values({ clanId: opts.clanId, ...values })
    .onConflictDoUpdate({ target: clanYoutubeChannels.clanId, set: values });
  liveChatCache.delete(opts.clanId);
}

/** Forget the channel, revoking its grant at Google (best-effort) so nothing is left authorised. */
export async function disconnectHostYoutube(clanId: number): Promise<void> {
  const cfg = youtubeConfig();
  // clan-scope: clanId is the caller's resolved creator space.
  const row = await db.query.clanYoutubeChannels.findFirst({ where: eq(clanYoutubeChannels.clanId, clanId) });
  // clan-scope: same.
  await db.delete(clanYoutubeChannels).where(eq(clanYoutubeChannels.clanId, clanId));
  liveChatCache.delete(clanId);
  if (row && cfg) {
    try {
      // Revoking the refresh token revokes the whole grant.
      void revokeToken(decryptSecret(row.refreshToken, cfg.tokenKey), f);
    } catch {
      // a rotated key: nothing readable to revoke
    }
  }
}

const refreshing = new Map<number, Promise<string | null>>();

/**
 * The host's live access token. Refreshes when expired (or `force`, after a 401). A refused refresh
 * marks the channel broken and returns null — the host has to connect again. Throws on an outage.
 */
async function hostToken(clanId: number, cfg: YoutubeConfig, force = false): Promise<string | null> {
  // clan-scope: clanId is the event's own host, read back from the event.
  const row = await db.query.clanYoutubeChannels.findFirst({ where: eq(clanYoutubeChannels.clanId, clanId) });
  if (!row || row.brokenAt) return null;
  try {
    if (!force && Date.parse(row.expiresAt) > Date.now()) return decryptSecret(row.accessToken, cfg.tokenKey);
  } catch (err) {
    log.warn('entry-gates.youtube-decrypt-fail', { clanId }, err);
    return null;
  }
  let p = refreshing.get(clanId);
  if (!p) {
    p = (async () => {
      try {
        const set = await refreshToken(cfg, decryptSecret(row.refreshToken, cfg.tokenKey), f);
        // clan-scope: same row as above.
        await db
          .update(clanYoutubeChannels)
          .set({
            accessToken: encryptSecret(set.accessToken, cfg.tokenKey),
            ...(set.refreshToken ? { refreshToken: encryptSecret(set.refreshToken, cfg.tokenKey) } : {}),
            expiresAt: expiresAtFor(set),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(clanYoutubeChannels.clanId, clanId));
        return set.accessToken;
      } catch (err) {
        if (err instanceof YoutubeAuthError && err.refused) {
          log.warn('entry-gates.youtube-refresh-refused', { clanId });
          // clan-scope: same row as above.
          await db
            .update(clanYoutubeChannels)
            .set({ brokenAt: new Date().toISOString() })
            .where(eq(clanYoutubeChannels.clanId, clanId));
          return null;
        }
        throw err;
      }
    })().finally(() => refreshing.delete(clanId));
    refreshing.set(clanId, p);
  }
  return p;
}

/** Run a host-token read, refreshing once on a 401. null = the host's connection is gone/broken. */
async function viaHost<T>(clanId: number, cfg: YoutubeConfig, read: (token: string) => Promise<ApiResult<T>>): Promise<ApiResult<T> | null> {
  let token = await hostToken(clanId, cfg);
  if (!token) return null;
  let r = await read(token);
  if (!r.ok && r.reason === 'unauthorized') {
    token = await hostToken(clanId, cfg, true);
    if (!token) return null;
    r = await read(token);
    if (!r.ok && r.reason === 'unauthorized') return null;
  }
  return r;
}

// ── Proofs ──────────────────────────────────────────────────────────────────────────────────────

export async function recordProof(opts: {
  userId: number;
  hostChannelId: string;
  kind: ProofKind;
  channel: { id: string; title: string };
  ok: boolean;
}): Promise<void> {
  const values = {
    youtubeChannelId: opts.channel.id,
    youtubeTitle: opts.channel.title,
    ok: opts.ok,
    checkedAt: new Date().toISOString(),
  };
  // clan-scope: global -- a proof belongs to a user and a YouTube channel, not to a clan.
  await db
    .insert(userYoutubeProofs)
    .values({ userId: opts.userId, hostChannelId: opts.hostChannelId, kind: opts.kind, ...values })
    .onConflictDoUpdate({
      target: [userYoutubeProofs.userId, userYoutubeProofs.hostChannelId, userYoutubeProofs.kind],
      set: values,
    });
}

/** The proof on file, if it is younger than PROOF_TTL_MS. */
export async function freshProof(userId: number, hostChannelId: string, kind: ProofKind) {
  // clan-scope: global -- per user and YouTube channel.
  const row = await db.query.userYoutubeProofs.findFirst({
    where: and(
      eq(userYoutubeProofs.userId, userId),
      eq(userYoutubeProofs.hostChannelId, hostChannelId),
      eq(userYoutubeProofs.kind, kind),
    ),
  });
  if (!row) return null;
  const at = parseStamp(row.checkedAt);
  return at != null && Date.now() - at < PROOF_TTL_MS ? row : null;
}

export type SubProof = 'subscribed' | 'notsub' | 'private' | 'nochannel' | 'error';

/**
 * The viewer's subscriber check, on THEIR token (fresh from the OAuth callback): which channel they
 * are, and whether it subscribes to the host. Records the answer; the caller revokes the token.
 */
export async function proveSubscription(opts: { userId: number; hostChannelId: string; token: string }): Promise<SubProof> {
  const me = await fetchMyChannel(opts.token, f);
  if (!me.ok) return 'error';
  if (!me.value) return 'nochannel';
  const sub = await subscribesTo(opts.token, opts.hostChannelId, f);
  if (!sub.ok) {
    if (sub.reason === 'forbidden') return 'private';
    if (sub.reason === 'not-found') return 'nochannel';
    return 'error';
  }
  await recordProof({ userId: opts.userId, hostChannelId: opts.hostChannelId, kind: 'sub', channel: me.value, ok: sub.value });
  return sub.value ? 'subscribed' : 'notsub';
}

/** The probe half lib/entryGates asks: answers from proofs on file only, never the network. */
export function youtubeProbe(clanId: number, userId: number): { youtubeSub(): Promise<YoutubeAnswer>; youtubeMember(): Promise<YoutubeAnswer> } {
  const ask = async (kind: ProofKind): Promise<YoutubeAnswer> => {
    if (!youtubeConfig()) return { state: 'off' };
    const host = await hostYoutubeChannel(clanId);
    // A subscriber proof needs only the host's channel id; the member check reads live chat on the
    // host's token, so a broken connection means no NEW member proofs — old ones still stand.
    if (!host) return { state: 'host-missing' };
    const proof = await freshProof(userId, host.channelId, kind);
    if (!proof) return host.broken && kind === 'member' ? { state: 'host-missing' } : { state: 'unchecked' };
    return { state: 'ok', value: proof.ok };
  };
  return { youtubeSub: () => ask('sub'), youtubeMember: () => ask('member') };
}

// ── What the host and the join card see ─────────────────────────────────────────────────────────

export async function youtubeGateOptions(clanId: number): Promise<NonNullable<GateOptions['youtube']>> {
  const configured = youtubeConfig() !== null;
  const ch = configured ? await hostYoutubeChannel(clanId) : null;
  return {
    configured,
    channel: ch ? { title: ch.title, broken: ch.broken } : null,
    connectUrl: configured ? `/api/auth/youtube/start?as=host&space=${clanId}` : null,
  };
}

export interface YoutubeJoinInfo {
  available: boolean;
  /** The viewer's YouTube channel title from a fresh subscriber check, if any. */
  checked: string | null;
  /** Their member-check chat code for this host (only when a member rule applies). */
  chatCode: string | null;
}

/** For the join card before anyone presses Join. No external calls. */
export async function youtubeJoinInfo(clanId: number, userId: number | null, wantsCode: boolean): Promise<YoutubeJoinInfo> {
  const cfg = youtubeConfig();
  const host = cfg ? await hostYoutubeChannel(clanId) : null;
  if (!cfg || !host) return { available: false, checked: null, chatCode: null };
  const proof = userId != null ? await freshProof(userId, host.channelId, 'sub') : null;
  return {
    available: !host.broken || !wantsCode,
    checked: proof?.youtubeTitle ?? null,
    chatCode: wantsCode && userId != null ? chatCode(userId, host.channelId, cfg.tokenKey) : null,
  };
}

// ── The live-chat member check ──────────────────────────────────────────────────────────────────

export type ChatCheck =
  | 'member'
  | 'not-member'
  /** No message with their code in the recent chat. */
  | 'not-seen'
  /** The host is not live on YouTube right now. */
  | 'offline'
  | 'host-missing'
  | 'off'
  /** Google did not answer, or the daily quota is spent. */
  | 'error';

/** The host's active chat id, held a minute (1 unit a look). Null = not live. */
const liveChatCache = new Map<number, { until: number; id: string | null }>();
/** One chat read shared by everyone checking the same chat within a few seconds (5 units a read). */
const chatReads = new Map<string, { until: number; p: Promise<ApiResult<unknown[]> | null> }>();
const LIVE_TTL_MS = 60_000;
const CHAT_TTL_MS = 5_000;

export function clearYoutubeCachesForTests(): void {
  liveChatCache.clear();
  chatReads.clear();
}

/**
 * Look for the viewer's code in the host's live chat and record what it says. Quota: at most one
 * liveBroadcasts.list (1) per host per minute and one liveChatMessages.list (5) per chat per 5s,
 * whoever presses Check — the route also rate-limits each viewer.
 */
export async function checkChatCode(opts: { clanId: number; userId: number }): Promise<ChatCheck> {
  const cfg = youtubeConfig();
  if (!cfg) return 'off';
  const host = await hostYoutubeChannel(opts.clanId);
  if (!host || host.broken) return 'host-missing';

  try {
    const now = Date.now();
    let live = liveChatCache.get(opts.clanId);
    if (!live || live.until <= now) {
      const r = await viaHost(opts.clanId, cfg, (t) => activeLiveChatId(t, f));
      if (r === null) return 'host-missing';
      if (!r.ok) return 'error';
      live = { until: now + LIVE_TTL_MS, id: r.value };
      liveChatCache.set(opts.clanId, live);
    }
    if (!live.id) return 'offline';
    const chatId = live.id;

    let read = chatReads.get(chatId);
    if (!read || read.until <= now) {
      read = { until: now + CHAT_TTL_MS, p: viaHost(opts.clanId, cfg, (t) => recentChat(t, chatId, f)) };
      chatReads.set(chatId, read);
      if (chatReads.size > 500) chatReads.delete(chatReads.keys().next().value!);
    }
    const r = await read.p;
    if (r === null) return 'host-missing';
    if (!r.ok) {
      chatReads.delete(chatId);
      // The chat ended or was disabled since we looked: re-look next time.
      if (r.reason === 'forbidden' || r.reason === 'not-found') {
        liveChatCache.delete(opts.clanId);
        return 'offline';
      }
      return 'error';
    }

    const seen = findCodeInChat(r.value, chatCode(opts.userId, host.channelId, cfg.tokenKey));
    if (!seen) return 'not-seen';
    await recordProof({
      userId: opts.userId,
      hostChannelId: host.channelId,
      kind: 'member',
      channel: { id: seen.channelId, title: seen.displayName || seen.channelId },
      ok: seen.member,
    });
    return seen.member ? 'member' : 'not-member';
  } catch (err) {
    log.warn('entry-gates.youtube-chat-fail', { clanId: opts.clanId }, err);
    return 'error';
  }
}

// ── One YouTube channel, one player per event ──────────────────────────────────────────────────

/**
 * After a YouTube pass: spend the YouTube channel behind it on this event for this player. Same rules
 * as claimTwitchForEvent (lib/entryGatesDb), whose liveness check and hold time are passed in so the
 * two stay one policy. 'missing' = the proof vanished in between (fail closed).
 */
export async function youtubeClaimAfterPass(opts: {
  eventId: number;
  clanId: number;
  userId: number;
  via: GateKind;
  holdMs: number;
  liveInEvent: (eventId: number, clanId: number, userId: number) => Promise<boolean>;
}): Promise<'ok' | 'taken' | 'missing'> {
  const host = await hostYoutubeChannel(opts.clanId);
  if (!host) return 'missing';
  const proof = await freshProof(opts.userId, host.channelId, opts.via === 'youtube-member' ? 'member' : 'sub');
  if (!proof?.ok) return 'missing';
  return claimYoutubeForEvent({ ...opts, youtubeChannelId: proof.youtubeChannelId });
}

export async function claimYoutubeForEvent(opts: {
  eventId: number;
  clanId: number;
  youtubeChannelId: string;
  userId: number;
  holdMs: number;
  liveInEvent: (eventId: number, clanId: number, userId: number) => Promise<boolean>;
}): Promise<'ok' | 'taken'> {
  const where = and(eq(eventYoutubeClaims.eventId, opts.eventId), eq(eventYoutubeClaims.youtubeChannelId, opts.youtubeChannelId));
  for (let attempt = 0; attempt < 3; attempt++) {
    const now = new Date().toISOString();
    // clan-scope: global -- keyed by event id, whose host the caller already resolved.
    const inserted = await db
      .insert(eventYoutubeClaims)
      .values({ eventId: opts.eventId, youtubeChannelId: opts.youtubeChannelId, userId: opts.userId, claimedAt: now })
      .onConflictDoNothing({ target: [eventYoutubeClaims.eventId, eventYoutubeClaims.youtubeChannelId] })
      .returning({ userId: eventYoutubeClaims.userId });
    if (inserted.length > 0) return 'ok';

    // clan-scope: global -- as above.
    const row = await db.query.eventYoutubeClaims.findFirst({ where });
    if (!row) continue;
    if (row.userId === opts.userId) return 'ok';

    const claimedMs = parseStamp(row.claimedAt);
    const fresh = claimedMs != null && Date.now() - claimedMs < opts.holdMs;
    if (fresh || (await opts.liveInEvent(opts.eventId, opts.clanId, row.userId))) return 'taken';

    // clan-scope: global -- as above; conditional on the old holder so only one racer wins.
    const moved = await db
      .update(eventYoutubeClaims)
      .set({ userId: opts.userId, claimedAt: now })
      .where(and(where, eq(eventYoutubeClaims.userId, row.userId)))
      .returning({ userId: eventYoutubeClaims.userId });
    if (moved.length > 0) return 'ok';
  }
  return 'taken';
}

/** The YouTube twin of TWITCH_ALREADY_USED. */
export const YOUTUBE_ALREADY_USED = 'That YouTube channel was already used to join this event by another player.';
