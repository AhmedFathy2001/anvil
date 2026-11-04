// Kick entry gates — the database half. The pure rules are lib/gates/kick, the HTTP calls lib/kick.
//
// What lives here: the host's connected channel (tokens encrypted, refreshed under a per-space lock),
// a viewer's Kick link and their one-time codes, the facts Kick's webhook tells us (follows, subs),
// the probe lib/entryGatesDb asks, and the one-Kick-account-per-event claim.

import crypto from 'crypto';
import { and, eq, inArray, isNull, lt, ne } from 'drizzle-orm';

import { db } from '@/db';
import { clanKickChannels, clans, kickChannelFacts, kickLinkCodes, kickWebhookSeen, userKickLinks } from '@/db/schema';
import { chatJoinAllowed, streamPlanId } from '@/lib/creatorPlans';
import { streamsEvents } from '@/lib/creatorSpaces';
import type { GateContext, KickGateOptions } from '@/lib/entryGates';
import {
  KICK_BADGE_SUB_MS,
  KICK_CODE_TTL_MS,
  factsSay,
  isKickCode,
  makeKickCode,
  subUntilFrom,
  type KickAnswer,
  type KickEvent,
  type KickPerson,
} from '@/lib/gates/kick';
import {
  KickAuthError,
  fetchOwnChannel,
  hasKickHostScopes,
  kickAppToken,
  kickConfig,
  refreshKickToken,
  subscribeChannelEvents,
  unsubscribeChannelEvents,
  type FetchLike,
  type KickConfig,
  type KickTokenSet,
} from '@/lib/kick';
import { decryptSecret, encryptSecret } from '@/lib/secretBox';
// Circular (entryGatesDb imports this module) but only used inside functions, never at load.
import { gateCache } from '@/lib/entryGatesDb';
import { log } from '@/lib/logger';

/** Swappable for tests, so no test ever reaches Kick. */
let fetchImpl: FetchLike = (input, init) => fetch(input, init);
export function setKickFetchForTests(f: FetchLike | null): void {
  fetchImpl = f ?? ((input, init) => fetch(input, init));
}
export function kickFetch(): FetchLike {
  return fetchImpl;
}

/** A viewer's Kick facts changed: a cached gate "no" must not be held against them. */
function onViewerChanged(userId: number): void {
  gateCache.forgetUser(userId);
}

const iso = (ms: number) => new Date(ms).toISOString();

// ── The host's channel ──────────────────────────────────────────────────────────────────────────

export interface HostKickChannel {
  slug: string;
  broken: boolean;
  followersOnlyChat: boolean;
  chatJoin: boolean;
}

/** What the host's settings may show. Never the tokens. */
export async function hostKickChannel(clanId: number): Promise<HostKickChannel | null> {
  const row = await db.query.clanKickChannels.findFirst({
    where: eq(clanKickChannels.clanId, clanId),
    columns: { kickSlug: true, brokenAt: true, followersOnlyChat: true, chatJoin: true },
  });
  if (!row) return null;
  return { slug: row.kickSlug, broken: row.brokenAt != null, followersOnlyChat: row.followersOnlyChat, chatJoin: row.chatJoin };
}

function expiresAtFor(set: KickTokenSet): string {
  return iso(Date.now() + Math.max(0, set.expiresIn - 60) * 1000);
}

/**
 * Store the host's channel after OAuth and subscribe it to Anvil's webhooks. Switching to a different
 * Kick channel starts its facts fresh (the old channel's are kept only if another space still has it).
 */
export async function saveHostKickChannel(opts: {
  clanId: number;
  userId: number;
  cfg: KickConfig;
  tokens: KickTokenSet & { refreshToken: string };
  owner: { userId: string; slug: string };
}): Promise<'ok' | 'subscribe-failed'> {
  const prev = await db.query.clanKickChannels.findFirst({
    where: eq(clanKickChannels.clanId, opts.clanId),
    columns: { kickUserId: true },
  });
  const now = new Date().toISOString();
  const values = {
    kickUserId: opts.owner.userId,
    kickSlug: opts.owner.slug,
    accessToken: encryptSecret(opts.tokens.accessToken, opts.cfg.tokenKey),
    refreshToken: encryptSecret(opts.tokens.refreshToken, opts.cfg.tokenKey),
    expiresAt: expiresAtFor(opts.tokens),
    scope: opts.tokens.scope.join(' '),
    linkedByUserId: opts.userId,
    brokenAt: null,
    updatedAt: now,
  };
  await db
    .insert(clanKickChannels)
    .values({ clanId: opts.clanId, connectedAt: now, ...values })
    .onConflictDoUpdate({
      target: clanKickChannels.clanId,
      // A different channel: its "since you connected" starts now.
      set: prev && prev.kickUserId !== opts.owner.userId ? { ...values, connectedAt: now } : values,
    });
  if (prev && prev.kickUserId !== opts.owner.userId) await forgetChannelIfOrphaned(prev.kickUserId);

  const sub = await subscribeChannelEvents(opts.tokens.accessToken, fetchImpl);
  if (!sub.ok) {
    log.warn('kick.subscribe-failed', { clanId: opts.clanId, reason: sub.reason });
    return 'subscribe-failed';
  }
  return 'ok';
}

/** Re-subscribe a connected channel's webhooks (Kick drops them after a day of failed deliveries). */
export async function resubscribeHostKick(clanId: number): Promise<boolean> {
  const cfg = kickConfig();
  if (!cfg) return false;
  const host = await hostKickToken(clanId, cfg).catch(() => null);
  if (!host) return false;
  const r = await subscribeChannelEvents(host.token, fetchImpl);
  return r.ok;
}

export async function setHostKickFlags(clanId: number, flags: { followersOnlyChat?: boolean; chatJoin?: boolean }): Promise<boolean> {
  const set: Partial<typeof clanKickChannels.$inferInsert> = { updatedAt: new Date().toISOString() };
  if (typeof flags.followersOnlyChat === 'boolean') set.followersOnlyChat = flags.followersOnlyChat;
  if (typeof flags.chatJoin === 'boolean') set.chatJoin = flags.chatJoin;
  const r = await db.update(clanKickChannels).set(set).where(eq(clanKickChannels.clanId, clanId)).returning({ id: clanKickChannels.clanId });
  return r.length > 0;
}

/** Facts and webhooks for a Kick channel no space has connected any more are dropped. */
async function forgetChannelIfOrphaned(broadcasterId: string): Promise<void> {
  const still = await db.query.clanKickChannels.findFirst({
    where: eq(clanKickChannels.kickUserId, broadcasterId),
    columns: { clanId: true },
  });
  if (still) return;
  await db.delete(kickChannelFacts).where(eq(kickChannelFacts.broadcasterId, broadcasterId));
  const cfg = kickConfig();
  if (!cfg) return;
  // The Anvil channel's chat stays subscribed: it is where anybody links a Kick account.
  const { isAnvilKickChannel } = await import('@/lib/gates/kickAnvilChannel');
  if (await isAnvilKickChannel(broadcasterId)) return;
  try {
    const app = await kickAppToken(cfg, fetchImpl);
    await unsubscribeChannelEvents(app.accessToken, broadcasterId, fetchImpl);
  } catch (err) {
    log.warn('kick.unsubscribe-failed', { broadcasterId }, err);
  }
}

export async function disconnectHostKick(clanId: number): Promise<void> {
  const row = await db.query.clanKickChannels.findFirst({ where: eq(clanKickChannels.clanId, clanId), columns: { kickUserId: true } });
  await db.delete(clanKickChannels).where(eq(clanKickChannels.clanId, clanId));
  if (row) await forgetChannelIfOrphaned(row.kickUserId);
}

/** One refresh per space at a time — Kick rotates refresh tokens, so two racing would break the link. */
const refreshing = new Map<number, Promise<string | null>>();

/**
 * The host's live access token and channel id. Refreshes when expired (or when `force`, after a 401).
 * A refused refresh marks the channel broken and returns null — the host has to connect again.
 */
export async function hostKickToken(
  clanId: number,
  cfg: KickConfig,
  force = false,
): Promise<{ token: string; broadcasterId: string } | null> {
  const row = await db.query.clanKickChannels.findFirst({ where: eq(clanKickChannels.clanId, clanId) });
  if (!row || row.brokenAt) return null;
  try {
    if (!force && Date.parse(row.expiresAt) > Date.now()) {
      return { token: decryptSecret(row.accessToken, cfg.tokenKey), broadcasterId: row.kickUserId };
    }
  } catch (err) {
    log.warn('kick.decrypt-fail', { clanId }, err);
    return null;
  }
  let p = refreshing.get(clanId);
  if (!p) {
    p = (async () => {
      try {
        const set = await refreshKickToken(cfg, decryptSecret(row.refreshToken, cfg.tokenKey), fetchImpl);
        await db
          .update(clanKickChannels)
          .set({
            accessToken: encryptSecret(set.accessToken, cfg.tokenKey),
            ...(set.refreshToken ? { refreshToken: encryptSecret(set.refreshToken, cfg.tokenKey) } : {}),
            expiresAt: expiresAtFor(set),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(clanKickChannels.clanId, clanId));
        return set.accessToken;
      } catch (err) {
        if (err instanceof KickAuthError && err.refused) {
          log.warn('kick.refresh-refused', { clanId });
          await db.update(clanKickChannels).set({ brokenAt: new Date().toISOString() }).where(eq(clanKickChannels.clanId, clanId));
          return null;
        }
        throw err;
      }
    })().finally(() => refreshing.delete(clanId));
    refreshing.set(clanId, p);
  }
  const token = await p;
  return token ? { token, broadcasterId: row.kickUserId } : null;
}

// ── The OAuth callback's work ───────────────────────────────────────────────────────────────────

export type HostConnectOutcome =
  | 'connected'
  | 'scopes'
  | 'error'
  | 'subscribe-failed'
  /** Already connected to another place (lib/streamChannels): nothing was saved. */
  | { conflict: { outcome: 'elsewhere'; fromClanId: number } | { outcome: 'taken' } };

/** After the code exchange: check scopes, learn the channel, store, subscribe. */
export async function finishHostKickConnect(opts: {
  clanId: number;
  userId: number;
  cfg: KickConfig;
  tokens: KickTokenSet;
}): Promise<HostConnectOutcome> {
  if (!hasKickHostScopes(opts.tokens.scope) || !opts.tokens.refreshToken) return 'scopes';
  const owner = await fetchOwnChannel(opts.tokens.accessToken, fetchImpl);
  // One channel, one place: a channel connected elsewhere is asked about, never copied.
  const { connectConflict } = await import('@/lib/streamChannels');
  const conflict = await connectConflict('kick', owner.userId, opts.clanId, opts.userId);
  if (conflict) return { conflict };
  const r = await saveHostKickChannel({ ...opts, tokens: { ...opts.tokens, refreshToken: opts.tokens.refreshToken }, owner });
  return r === 'ok' ? 'connected' : 'subscribe-failed';
}

// ── The viewer's Kick link ──────────────────────────────────────────────────────────────────────

export async function viewerKick(userId: number): Promise<{ id: string; username: string } | null> {
  const row = await db.query.userKickLinks.findFirst({ where: eq(userKickLinks.userId, userId) });
  return row ? { id: row.kickUserId, username: row.kickUsername } : null;
}

export async function unlinkViewerKick(userId: number): Promise<void> {
  await db.delete(userKickLinks).where(eq(userKickLinks.userId, userId));
  onViewerChanged(userId);
}

/**
 * Link a Kick account to a login. 'taken' when that Kick account already belongs to a different
 * Anvil login. Re-linking your own (or switching yours to another Kick account) is fine.
 */
export async function linkViewerKick(userId: number, who: KickPerson): Promise<'ok' | 'taken'> {
  const other = await db.query.userKickLinks.findFirst({
    where: and(eq(userKickLinks.kickUserId, who.id), ne(userKickLinks.userId, userId)),
    columns: { userId: true },
  });
  if (other) return 'taken';
  const values = { kickUserId: who.id, kickUsername: who.name, linkedAt: new Date().toISOString() };
  try {
    await db.insert(userKickLinks).values({ userId, ...values }).onConflictDoUpdate({ target: userKickLinks.userId, set: values });
  } catch (err) {
    if ((err as { code?: string })?.code === '23505') return 'taken';
    throw err;
  }
  onViewerChanged(userId);
  return 'ok';
}

/** A fresh code for this login, replacing any unused one. */
export async function issueKickCode(userId: number, now = Date.now()): Promise<{ code: string; expiresAt: string }> {
  await db.delete(kickLinkCodes).where(and(eq(kickLinkCodes.userId, userId), isNull(kickLinkCodes.usedAt)));
  // Old used codes are only status history; keep a day of it.
  await db.delete(kickLinkCodes).where(lt(kickLinkCodes.expiresAt, iso(now - 24 * 60 * 60_000)));
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeKickCode((n) => crypto.randomBytes(n));
    const expiresAt = iso(now + KICK_CODE_TTL_MS);
    const r = await db
      .insert(kickLinkCodes)
      .values({ code, userId, createdAt: iso(now), expiresAt })
      .onConflictDoNothing({ target: kickLinkCodes.code })
      .returning({ code: kickLinkCodes.code });
    if (r.length > 0) return { code, expiresAt };
  }
  throw new Error('could not mint a unique Kick code');
}

export type KickCodeStatus =
  | { state: 'pending'; expiresAt: string }
  | { state: 'linked'; username: string }
  | { state: 'taken' }
  | { state: 'expired' };

/** How the viewer's own code went. Somebody else's code reads as expired. */
export async function kickCodeStatus(userId: number, code: string, now = Date.now()): Promise<KickCodeStatus> {
  if (!isKickCode(code)) return { state: 'expired' };
  const row = await db.query.kickLinkCodes.findFirst({ where: and(eq(kickLinkCodes.code, code), eq(kickLinkCodes.userId, userId)) });
  if (!row) return { state: 'expired' };
  if (row.result === 'linked') return { state: 'linked', username: row.kickUsername ?? '' };
  if (row.result === 'taken') return { state: 'taken' };
  if (Date.parse(row.expiresAt) <= now) return { state: 'expired' };
  return { state: 'pending', expiresAt: row.expiresAt };
}

/**
 * A chat line carried this code: spend it (atomically — only the first delivery wins) and link the
 * sender to the code's login. Null when the code is unknown, used or expired.
 */
async function redeemKickCode(code: string, sender: KickPerson, now: number): Promise<{ userId: number; result: 'linked' | 'taken' } | null> {
  const spent = await db
    .update(kickLinkCodes)
    .set({ usedAt: iso(now) })
    .where(and(eq(kickLinkCodes.code, code), isNull(kickLinkCodes.usedAt)))
    .returning({ userId: kickLinkCodes.userId, expiresAt: kickLinkCodes.expiresAt });
  const row = spent[0];
  if (!row) return null;
  if (Date.parse(row.expiresAt) <= now) {
    await db.update(kickLinkCodes).set({ result: 'expired' }).where(eq(kickLinkCodes.code, code));
    return null;
  }
  const result = (await linkViewerKick(row.userId, sender)) === 'ok' ? 'linked' : 'taken';
  await db.update(kickLinkCodes).set({ result, kickUsername: sender.name }).where(eq(kickLinkCodes.code, code));
  return { userId: row.userId, result };
}

// ── Facts ───────────────────────────────────────────────────────────────────────────────────────

/** Is this broadcaster connected to any space? Facts are only kept for connected channels. */
async function channelsFor(broadcasterId: string) {
  // clan-scope: global -- a webhook names a Kick channel, which may be connected to any space.
  return db
    .select({ clanId: clanKickChannels.clanId, followersOnlyChat: clanKickChannels.followersOnlyChat, chatJoin: clanKickChannels.chatJoin })
    .from(clanKickChannels)
    .where(eq(clanKickChannels.kickUserId, broadcasterId));
}

async function recordFacts(broadcasterId: string, kickUserIds: string[], f: { follow?: boolean; subUntilMs?: number }, now: number): Promise<void> {
  if (kickUserIds.length === 0) return;
  const existing = await db.query.kickChannelFacts.findMany({
    where: and(eq(kickChannelFacts.broadcasterId, broadcasterId), inArray(kickChannelFacts.kickUserId, kickUserIds)),
  });
  const byId = new Map(existing.map((r) => [r.kickUserId, r]));
  for (const id of kickUserIds) {
    const prev = byId.get(id);
    const followedAt = prev?.followedAt ?? (f.follow ? iso(now) : null);
    const prevSub = prev?.subUntil ? Date.parse(prev.subUntil) : NaN;
    const subUntil =
      f.subUntilMs != null ? iso(Number.isFinite(prevSub) ? Math.max(prevSub, f.subUntilMs) : f.subUntilMs) : (prev?.subUntil ?? null);
    const values = { followedAt, subUntil, updatedAt: iso(now) };
    await db
      .insert(kickChannelFacts)
      .values({ broadcasterId, kickUserId: id, ...values })
      .onConflictDoUpdate({ target: [kickChannelFacts.broadcasterId, kickChannelFacts.kickUserId], set: values });
  }
  // The viewers these facts belong to may have a cached "no".
  const linked = await db.query.userKickLinks.findMany({ where: inArray(userKickLinks.kickUserId, kickUserIds), columns: { userId: true } });
  for (const l of linked) onViewerChanged(l.userId);
}

export async function kickFactsFor(broadcasterId: string, kickUserId: string) {
  return (
    (await db.query.kickChannelFacts.findFirst({
      where: and(eq(kickChannelFacts.broadcasterId, broadcasterId), eq(kickChannelFacts.kickUserId, kickUserId)),
      columns: { followedAt: true, subUntil: true },
    })) ?? null
  );
}

// ── Webhook events ──────────────────────────────────────────────────────────────────────────────

/** First delivery of this Kick message id? Records it. Replays and redeliveries get false. */
export async function markKickMessageSeen(messageId: string, now = Date.now()): Promise<boolean> {
  const r = await db
    .insert(kickWebhookSeen)
    .values({ messageId, seenAt: iso(now) })
    .onConflictDoNothing({ target: kickWebhookSeen.messageId })
    .returning({ id: kickWebhookSeen.messageId });
  // Prune now and then — no cron needed for a table this small.
  if (Math.random() < 0.01) await db.delete(kickWebhookSeen).where(lt(kickWebhookSeen.seenAt, iso(now - 24 * 60 * 60_000)));
  return r.length > 0;
}

/** Undo markKickMessageSeen when handling failed, so Kick's retry is not dropped as a replay. */
export async function unmarkKickMessageSeen(messageId: string): Promise<void> {
  await db.delete(kickWebhookSeen).where(eq(kickWebhookSeen.messageId, messageId));
}

export type KickEventOutcome =
  | { kind: 'ignored' }
  | { kind: 'recorded' }
  | { kind: 'code'; result: 'linked' | 'taken' | 'invalid' }
  | { kind: 'join'; clanId: number; broadcasterId: string; replyTo: string | null };

/**
 * Apply one verified, first-seen webhook event. Chat lines matter only when they carry a link code
 * (link + facts) or are `!join` (the caller replies, after the response); everything else in chat is
 * ignored without touching the database.
 */
export async function applyKickEvent(ev: KickEvent, opts: { code: string | null; join: boolean }, now = Date.now()): Promise<KickEventOutcome> {
  const channels = await channelsFor(ev.broadcasterId);
  if (channels.length === 0) {
    // The official Anvil channel (lib/gates/kickAnvilChannel): a code typed there links the account,
    // with no host and so no follow/sub facts. Anything else from it is ignored.
    if (ev.type === 'chat' && opts.code) {
      const { isAnvilKickChannel } = await import('@/lib/gates/kickAnvilChannel');
      if (await isAnvilKickChannel(ev.broadcasterId)) {
        const r = await redeemKickCode(opts.code, ev.sender, now);
        return { kind: 'code', result: r ? r.result : 'invalid' };
      }
    }
    return { kind: 'ignored' };
  }

  if (ev.type === 'follow') {
    await recordFacts(ev.broadcasterId, [ev.follower.id], { follow: true }, now);
    return { kind: 'recorded' };
  }
  if (ev.type === 'sub') {
    await recordFacts(ev.broadcasterId, ev.subscribers.map((s) => s.id), { subUntilMs: subUntilFrom(ev.expiresAt, now) }, now);
    return { kind: 'recorded' };
  }

  if (opts.code) {
    const r = await redeemKickCode(opts.code, ev.sender, now);
    if (!r) return { kind: 'code', result: 'invalid' };
    if (r.result === 'linked') {
      // Only followers can type in a followers-only chat; the badge says subscribed right now.
      const follow = channels.some((c) => c.followersOnlyChat);
      if (follow || ev.subscriber) {
        await recordFacts(ev.broadcasterId, [ev.sender.id], { follow, ...(ev.subscriber ? { subUntilMs: now + KICK_BADGE_SUB_MS } : {}) }, now);
      }
    }
    return { kind: 'code', result: r.result };
  }

  if (opts.join) {
    // One channel answers for one space: a channel two spaces both claim is answered by neither.
    if (channels.length !== 1 || !channels[0].chatJoin) return { kind: 'ignored' };
    // clan-scope: this clan -- the one space that connected this channel.
    const clan = await db.query.clans.findFirst({ where: eq(clans.id, channels[0].clanId), columns: { kind: true, status: true, plan: true, streaming: true } });
    // A creator space, or a clan with Streaming on (lib/creatorSpaces streamsEvents).
    if (!clan || !streamsEvents(clan) || clan.status !== 'active') return { kind: 'ignored' };
    // The plan (lib/creatorPlans): `!join` is Silver+ once FREEMIUM_ENFORCED is on — the same rule
    // the Twitch bot's chatBotChannels applies. Generous phase: everyone.
    if (!chatJoinAllowed(streamPlanId(clan))) return { kind: 'ignored' };
    return { kind: 'join', clanId: channels[0].clanId, broadcasterId: ev.broadcasterId, replyTo: ev.messageId };
  }
  return { kind: 'ignored' };
}

// ── The gate ────────────────────────────────────────────────────────────────────────────────────

/** What a Kick rule asks: has Kick told us this viewer follows / subs to the host's channel? */
export function kickProbe(clanId: number, userId: number): () => Promise<KickAnswer> {
  return async () => {
    if (!kickConfig()) return { state: 'off' };
    const ch = await db.query.clanKickChannels.findFirst({
      where: eq(clanKickChannels.clanId, clanId),
      columns: { kickUserId: true, followersOnlyChat: true },
    });
    if (!ch) return { state: 'host-missing' };
    const viewer = await viewerKick(userId);
    if (!viewer) return { state: 'viewer-unlinked' };
    // Facts arrive by webhook, so a broken token (no refresh) does not stop checks: it only stops
    // `!join` replies. Kick drops webhooks it cannot deliver for a day — that is the host's to fix.
    const said = factsSay(await kickFactsFor(ch.kickUserId, viewer.id), Date.now());
    return { state: 'ok', ...said, followersOnlyChat: ch.followersOnlyChat };
  };
}

export async function kickContext(clanId: number): Promise<Pick<GateContext, 'kickSlug'>> {
  if (!kickConfig()) return {};
  const ch = await hostKickChannel(clanId);
  return { kickSlug: ch?.slug ?? null };
}

export async function kickGateOptions(clanId: number): Promise<KickGateOptions | undefined> {
  if (!kickConfig()) return undefined;
  const ch = await hostKickChannel(clanId);
  return {
    configured: true,
    channel: ch ? { slug: ch.slug, broken: ch.broken, followersOnlyChat: ch.followersOnlyChat } : null,
    connectUrl: `/api/auth/kick/start?space=${clanId}`,
  };
}

/** For the join card, before anyone presses anything. */
export async function kickGateInfo(clanId: number, userId: number | null): Promise<{ slug: string | null; linked: string | null; available: boolean }> {
  if (!kickConfig()) return { slug: null, linked: null, available: false };
  const ch = await hostKickChannel(clanId);
  const linked = userId != null ? await viewerKick(userId) : null;
  return { slug: ch?.slug ?? null, linked: linked?.username ?? null, available: true };
}
