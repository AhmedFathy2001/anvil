// Creator entry gates — the database and network half. The rules live in lib/entryGates (pure);
// the Twitch calls in lib/twitch. This module wires them to rows: the event's gates, the viewer's
// linked Twitch account, the host's channel token, and the host's Discord server through the bot.
//
// Checked in two places, both server-side: entering a creator-space event (lib/eventEntry) and
// signing up for one (api/events/[eventId]/signup) — the second because somebody already seated in
// the space through another event skips entry and goes straight to the sign-up.

import { and, eq, isNull, ne } from 'drizzle-orm';

import { db } from '@/db';
import {
  accounts,
  clanMemberships,
  clanStaff,
  clanTwitchChannels,
  clans,
  eventSignups,
  eventTwitchClaims,
  events,
  userTwitchLinks,
  users,
} from '@/db/schema';
import { parseStamp } from '@/lib/dbTime';
import {
  GateCache,
  checkGates,
  discordMemberFacts,
  gatesApply,
  gatesSummary,
  isKickRule,
  isTwitchRule,
  parseGates,
  twitchAlreadyUsed,
  twitchTierOf,
  type DiscordAnswer,
  type EntryGates,
  type GateContext,
  type GateOptions,
  type HostChannelInfo,
  type GateProbe,
  type GateVerdict,
  type SubTier,
  type TwitchAnswer,
} from '@/lib/entryGates';
import {
  TwitchAuthError,
  canHaveSubs,
  followsChannel,
  refreshToken,
  subscriptionTier,
  twitchConfig,
  type FetchLike,
  type HelixResult,
  type TwitchConfig,
  type TwitchTokenSet,
  type TwitchUser,
} from '@/lib/twitch';
import { decryptSecret, encryptSecret } from '@/lib/secretBox';
import { discordRest, fetchGuildRoles, getBotCredentials } from '@/lib/discord-roles';
import { isRealDiscordId } from '@/lib/anvilDiscordRoles';
import { invitedToEvent, staffOfClan } from '@/lib/eventAccess';
import { atLeast } from '@/lib/clanRoles';
import { log } from '@/lib/logger';
import { usesYoutube } from '@/lib/gates/youtube';
import {
  YOUTUBE_ALREADY_USED,
  hostYoutubeChannel,
  youtubePassChannel,
  youtubeGateOptions,
  youtubeJoinInfo,
  youtubeProbe,
  type YoutubeJoinInfo,
} from '@/lib/gates/youtubeDb';
import { KICK_ALREADY_USED } from '@/lib/gates/kick';
import { kickContext, kickGateInfo, kickGateOptions, kickProbe, viewerKick } from '@/lib/gates/kickDb';
import { claimGateAccount } from '@/lib/gates/claims';

/** Shared across requests in this process. See GateCache for the TTLs. */
export const gateCache = new GateCache();

/** Swappable for tests, so no test ever reaches Twitch or Discord. */
let fetchImpl: FetchLike = (input, init) => fetch(input, init);
export function setGateFetchForTests(f: FetchLike | null): void {
  fetchImpl = f ?? ((input, init) => fetch(input, init));
}

// ── The viewer's Twitch link ────────────────────────────────────────────────────────────────────

export async function viewerTwitch(userId: number): Promise<{ id: string; login: string } | null> {
  const row = await db.query.userTwitchLinks.findFirst({ where: eq(userTwitchLinks.userId, userId) });
  return row ? { id: row.twitchUserId, login: row.twitchLogin } : null;
}

/**
 * Link a Twitch account to a login. 'taken' when that Twitch account already belongs to a different
 * Anvil login — one subscription must not let a crowd of alts in. Re-linking your own is fine.
 */
export async function linkViewerTwitch(userId: number, user: TwitchUser): Promise<'ok' | 'taken'> {
  const other = await db.query.userTwitchLinks.findFirst({
    where: and(eq(userTwitchLinks.twitchUserId, user.id), ne(userTwitchLinks.userId, userId)),
    columns: { userId: true },
  });
  if (other) return 'taken';
  const values = { twitchUserId: user.id, twitchLogin: user.login, linkedAt: new Date().toISOString() };
  try {
    await db
      .insert(userTwitchLinks)
      .values({ userId, ...values })
      .onConflictDoUpdate({ target: userTwitchLinks.userId, set: values });
  } catch (err) {
    // The unique index on twitch_user_id lost a race to another login.
    if ((err as { code?: string })?.code === '23505') return 'taken';
    throw err;
  }
  gateCache.forgetUser(userId);
  return 'ok';
}

export async function unlinkViewerTwitch(userId: number): Promise<void> {
  await db.delete(userTwitchLinks).where(eq(userTwitchLinks.userId, userId));
  gateCache.forgetUser(userId);
}

// ── The host's channel ──────────────────────────────────────────────────────────────────────────

/** What the host's settings may show. Never the tokens. */
export async function hostTwitchChannel(clanId: number): Promise<HostChannelInfo | null> {
  const row = await db.query.clanTwitchChannels.findFirst({
    where: eq(clanTwitchChannels.clanId, clanId),
    columns: { twitchLogin: true, broadcasterType: true, brokenAt: true },
  });
  if (!row) return null;
  return { login: row.twitchLogin, canHaveSubs: canHaveSubs(row.broadcasterType), broken: row.brokenAt != null };
}

function expiresAtFor(set: TwitchTokenSet): string {
  return new Date(Date.now() + Math.max(0, set.expiresIn - 60) * 1000).toISOString();
}

export async function saveHostTwitchChannel(opts: {
  clanId: number;
  userId: number;
  cfg: TwitchConfig;
  tokens: TwitchTokenSet & { refreshToken: string };
  user: TwitchUser;
}): Promise<void> {
  const values = {
    twitchUserId: opts.user.id,
    twitchLogin: opts.user.login,
    broadcasterType: opts.user.broadcasterType,
    accessToken: encryptSecret(opts.tokens.accessToken, opts.cfg.tokenKey),
    refreshToken: encryptSecret(opts.tokens.refreshToken, opts.cfg.tokenKey),
    expiresAt: expiresAtFor(opts.tokens),
    scope: opts.tokens.scope.join(' '),
    linkedByUserId: opts.userId,
    brokenAt: null,
    updatedAt: new Date().toISOString(),
  };
  await db
    .insert(clanTwitchChannels)
    .values({ clanId: opts.clanId, ...values })
    .onConflictDoUpdate({ target: clanTwitchChannels.clanId, set: values });
}

export async function disconnectHostTwitch(clanId: number): Promise<void> {
  await db.delete(clanTwitchChannels).where(eq(clanTwitchChannels.clanId, clanId));
}

/** One refresh per clan at a time, so a burst of joins does not race Twitch with the same refresh token. */
const refreshing = new Map<number, Promise<string | null>>();

/**
 * The host's live access token and channel id. Refreshes when expired (or when `force`, after a 401).
 * A refused refresh marks the channel broken and returns null — the host has to connect again.
 */
async function hostToken(
  clanId: number,
  cfg: TwitchConfig,
  force = false,
): Promise<{ token: string; broadcasterId: string } | null> {
  const row = await db.query.clanTwitchChannels.findFirst({ where: eq(clanTwitchChannels.clanId, clanId) });
  if (!row || row.brokenAt) return null;
  try {
    if (!force && Date.parse(row.expiresAt) > Date.now()) {
      return { token: decryptSecret(row.accessToken, cfg.tokenKey), broadcasterId: row.twitchUserId };
    }
  } catch (err) {
    // Wrong or rotated TWITCH_TOKEN_KEY: nothing stored can be read until the host connects again.
    log.warn('entry-gates.twitch-decrypt-fail', { clanId }, err);
    return null;
  }

  let p = refreshing.get(clanId);
  if (!p) {
    p = (async () => {
      try {
        const set = await refreshToken(cfg, decryptSecret(row.refreshToken, cfg.tokenKey), fetchImpl);
        await db
          .update(clanTwitchChannels)
          .set({
            accessToken: encryptSecret(set.accessToken, cfg.tokenKey),
            // Twitch may rotate the refresh token; keep whichever is current.
            ...(set.refreshToken ? { refreshToken: encryptSecret(set.refreshToken, cfg.tokenKey) } : {}),
            expiresAt: expiresAtFor(set),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(clanTwitchChannels.clanId, clanId));
        return set.accessToken;
      } catch (err) {
        if (err instanceof TwitchAuthError && err.refused) {
          log.warn('entry-gates.twitch-refresh-refused', { clanId });
          await db
            .update(clanTwitchChannels)
            .set({ brokenAt: new Date().toISOString() })
            .where(eq(clanTwitchChannels.clanId, clanId));
          return null;
        }
        throw err;
      }
    })().finally(() => refreshing.delete(clanId));
    refreshing.set(clanId, p);
  }
  const token = await p;
  return token ? { token, broadcasterId: row.twitchUserId } : null;
}

// ── The check ───────────────────────────────────────────────────────────────────────────────────

function makeProbe(opts: { clanId: number; userId: number }): GateProbe {
  const cfg = twitchConfig();

  /** Run a broadcaster-token read, refreshing once on a 401. */
  async function viaHost<T>(
    read: (c: TwitchConfig, token: string, broadcasterId: string, viewerId: string) => Promise<HelixResult<T>>,
  ): Promise<TwitchAnswer<T>> {
    if (!cfg) return { state: 'off' };
    const viewer = await viewerTwitch(opts.userId);
    if (!viewer) return { state: 'viewer-unlinked' };
    let host = await hostToken(opts.clanId, cfg).catch(() => undefined);
    if (host === undefined) return { state: 'error' };
    if (!host) return { state: 'host-missing' };
    let r = await read(cfg, host.token, host.broadcasterId, viewer.id);
    if (!r.ok && r.reason === 'unauthorized') {
      host = await hostToken(opts.clanId, cfg, true).catch(() => undefined);
      if (host === undefined) return { state: 'error' };
      if (!host) return { state: 'host-missing' };
      r = await read(cfg, host.token, host.broadcasterId, viewer.id);
    }
    if (r.ok) return { state: 'ok', value: r.value };
    return { state: r.reason === 'unauthorized' ? 'host-missing' : 'error' };
  }

  return {
    ...youtubeProbe(opts.clanId, opts.userId),
    twitchFollows: () => viaHost((c, t, b, v) => followsChannel(c, t, b, v, fetchImpl)),
    twitchSubTier: async () => {
      const a = await viaHost((c, t, b, v) => subscriptionTier(c, t, b, v, fetchImpl));
      return a.state === 'ok' ? { state: 'ok', value: twitchTierOf(a.value) as 0 | SubTier } : a;
    },
    discordMember: async (): Promise<DiscordAnswer> => {
      const u = await db.query.users.findFirst({ where: eq(users.id, opts.userId), columns: { discordId: true } });
      if (!isRealDiscordId(u?.discordId)) return { state: 'no-discord' };
      const creds = await getBotCredentials(opts.clanId);
      if (!creds) return { state: 'no-server' };
      // Works without the privileged members intent: that gates the gateway and the list endpoint,
      // not reading one member by id.
      const res = await discordRest(creds.botToken, `/guilds/${creds.guildId}/members/${u!.discordId}`);
      if (res.ok) return { state: 'ok', member: true, ...discordMemberFacts(await res.json()) };
      if (res.status === 404) {
        const body = (await res.json().catch(() => null)) as { code?: number } | null;
        // 10007 Unknown Member is the ordinary "not in the server". 10004 Unknown Guild is the bot
        // having been removed — the host's problem, not the viewer's.
        return body?.code === 10004 ? { state: 'no-server' } : { state: 'ok', member: false };
      }
      if (res.status === 403) return { state: 'no-server' };
      return { state: 'error' };
    },
    kickFacts: kickProbe(opts.clanId, opts.userId),
  };
}

async function gateContext(clanId: number, hostName: string): Promise<GateContext> {
  const [ch, yt, kick] = await Promise.all([hostTwitchChannel(clanId), hostYoutubeChannel(clanId), kickContext(clanId)]);
  return { twitchLogin: ch?.login ?? null, hostName, youtubeTitle: yt?.title ?? null, ...kick };
}

/** The event's gates when they apply (a creator space with gates set), with the host's name. */
export async function gatesForEvent(
  eventId: number,
): Promise<{ gates: EntryGates; clanId: number; hostName: string } | null> {
  // clan-scope: global -- the event is named by id and its own clanId is read back to check against.
  const ev = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    columns: { clanId: true, entryGates: true },
  });
  if (!ev) return null;
  const host = await db.query.clans.findFirst({ where: eq(clans.id, ev.clanId), columns: { kind: true, name: true } });
  const gates = parseGates(ev.entryGates);
  if (!gatesApply(host?.kind, gates)) return null;
  return { gates, clanId: ev.clanId, hostName: host?.name ?? 'the host' };
}

/**
 * May this person past the event's gates? Null when no gate applies to them: no gates, not a creator
 * space, or they are the space's staff or invited to this event by the host (who has already said
 * yes to them by name). Otherwise the verdict, cached briefly per (user, event, gates).
 */
export async function entryGateVerdict(opts: {
  eventId: number;
  userId: number | null;
  playerId: number;
}): Promise<GateVerdict | null> {
  const g = await gatesForEvent(opts.eventId);
  if (!g) return null;
  if (await staffOfClan(g.clanId, opts.playerId)) return null;
  if (await invitedToEvent(opts.eventId, opts.playerId)) return null;

  const ctx = await gateContext(g.clanId, g.hostName);
  if (opts.userId == null) {
    return { pass: false, transient: false, summary: gatesSummary(g.gates, ctx), steps: ['Sign in with Discord'], linkTwitch: false };
  }
  const key = GateCache.key(opts.userId, opts.eventId, g.gates);
  let verdict = gateCache.get(key);
  if (!verdict) {
    verdict = await checkGates(g.gates, makeProbe({ clanId: g.clanId, userId: opts.userId }), ctx);
    gateCache.set(key, verdict);
  }
  if (verdict.pass && (verdict.via === 'youtube-sub' || verdict.via === 'youtube-member')) {
    // The YouTube channel behind the pass is spent on this event (lib/gates/youtubeDb), as Twitch's is.
    const ytChannel = await youtubePassChannel(g.clanId, opts.userId, verdict.via);
    if (!ytChannel) {
      gateCache.forgetUser(opts.userId);
      return { pass: false, transient: true, summary: gatesSummary(g.gates, ctx), steps: ['Try again in a moment'], linkTwitch: false };
    }
    const yc = await claimGateAccount({ eventId: opts.eventId, clanId: g.clanId, platform: 'youtube', platformUserId: ytChannel, userId: opts.userId });
    return yc === 'ok' ? verdict : { pass: false, transient: false, summary: gatesSummary(g.gates, ctx), steps: [YOUTUBE_ALREADY_USED], linkTwitch: false, blocked: true };
  }
  if (verdict.pass && (verdict.via === 'kick-follow' || verdict.via === 'kick-sub')) {
    // The same one-account-per-event rule as Twitch, for the Kick account that passed.
    const kick = await viewerKick(opts.userId);
    if (!kick) {
      gateCache.forgetUser(opts.userId);
      return { pass: false, transient: true, summary: gatesSummary(g.gates, ctx), steps: ['Try again in a moment'], linkTwitch: false };
    }
    const kc = await claimGateAccount({ eventId: opts.eventId, clanId: g.clanId, platform: 'kick', platformUserId: kick.id, userId: opts.userId });
    return kc === 'ok' ? verdict : { pass: false, transient: false, summary: gatesSummary(g.gates, ctx), steps: [KICK_ALREADY_USED], linkTwitch: false, blocked: true };
  }
  if (!verdict.pass || (verdict.via !== 'twitch-follow' && verdict.via !== 'twitch-sub')) return verdict;

  // Passed on TWITCH: the Twitch account is spent on this event for this player (see
  // eventTwitchClaims). Checked on every join, cache or not — the cache is per Anvil login, the
  // abuse is one Twitch account across several.
  const link = await viewerTwitch(opts.userId);
  if (!link) {
    // Unlinked since the pass was cached (unlink clears the cache, so this is a race). Fail closed:
    // re-checking here could pass on a Twitch account relinked in between without claiming it.
    // The next press starts clean.
    gateCache.forgetUser(opts.userId);
    return { pass: false, transient: true, summary: gatesSummary(g.gates, ctx), steps: ['Try again in a moment'], linkTwitch: true };
  }
  const claim = await claimTwitchForEvent({
    eventId: opts.eventId,
    clanId: g.clanId,
    twitchUserId: link.id,
    userId: opts.userId,
  });
  // Discord gates need no claim: the Discord id they check IS the login (users.discord_id is
  // unique and comes from Discord OAuth), so a role or boost cannot be moved to another Anvil login.
  return claim === 'ok' ? verdict : twitchAlreadyUsed(gatesSummary(g.gates, ctx));
}

/**
 * How long a fresh claim holds even before its holder is seated. A Twitch pass is checked BEFORE the
 * seat is taken, so without this a claim made a moment ago would look abandoned to a second login
 * racing in with the same (relinked) Twitch account.
 */
export const CLAIM_HOLD_MS = 10 * 60_000;

/** Does this user still hold a place in this event: an active sign-up, or a live seat in its host? */
export async function liveInEvent(eventId: number, clanId: number, userId: number): Promise<boolean> {
  const signup = await db.query.eventSignups.findFirst({
    where: and(eq(eventSignups.eventId, eventId), eq(eventSignups.userId, userId), ne(eventSignups.status, 'withdrawn')),
    columns: { id: true },
  });
  if (signup) return true;
  const u = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { playerId: true } });
  if (u?.playerId == null) return false;
  const seat = await db
    .select({ id: clanMemberships.id })
    .from(clanMemberships)
    .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
    .where(and(eq(clanMemberships.clanId, clanId), eq(accounts.playerId, u.playerId), isNull(clanMemberships.leftAt)))
    .limit(1);
  return seat.length > 0;
}

/**
 * Spend a Twitch account on an event for one player. Atomic on UNIQUE(event_id, twitch_user_id):
 *
 *   no claim yet                         → insert, ok
 *   claimed by this same player          → ok (re-entering, signing up after entering)
 *   claimed by another who is still in   → 'taken' (live seat/sign-up, or claimed < CLAIM_HOLD_MS ago)
 *   claimed by another who has left      → moved to this player, but only if it is STILL theirs —
 *                                           a conditional update, so of two racers only one wins
 */
export async function claimTwitchForEvent(opts: {
  eventId: number;
  clanId: number;
  twitchUserId: string;
  userId: number;
}): Promise<'ok' | 'taken'> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const now = new Date().toISOString();
    const inserted = await db
      .insert(eventTwitchClaims)
      .values({ eventId: opts.eventId, twitchUserId: opts.twitchUserId, userId: opts.userId, claimedAt: now })
      .onConflictDoNothing({ target: [eventTwitchClaims.eventId, eventTwitchClaims.twitchUserId] })
      .returning({ userId: eventTwitchClaims.userId });
    if (inserted.length > 0) return 'ok';

    const row = await db.query.eventTwitchClaims.findFirst({
      where: and(eq(eventTwitchClaims.eventId, opts.eventId), eq(eventTwitchClaims.twitchUserId, opts.twitchUserId)),
    });
    if (!row) continue; // deleted in between (event or user removed) — try the insert again
    if (row.userId === opts.userId) return 'ok';

    const claimedMs = parseStamp(row.claimedAt);
    const fresh = claimedMs != null && Date.now() - claimedMs < CLAIM_HOLD_MS;
    if (fresh || (await liveInEvent(opts.eventId, opts.clanId, row.userId))) return 'taken';

    const moved = await db
      .update(eventTwitchClaims)
      .set({ userId: opts.userId, claimedAt: now })
      .where(
        and(
          eq(eventTwitchClaims.eventId, opts.eventId),
          eq(eventTwitchClaims.twitchUserId, opts.twitchUserId),
          eq(eventTwitchClaims.userId, row.userId),
        ),
      )
      .returning({ userId: eventTwitchClaims.userId });
    if (moved.length > 0) return 'ok';
  }
  return 'taken';
}

/** What the join card shows BEFORE anyone presses anything. No external calls. */
export async function entryGateInfo(eventId: number, userId: number | null): Promise<{
  summary: string;
  usesTwitch: boolean;
  twitchLinked: string | null;
  twitchAvailable: boolean;
  /** Present only when a YouTube rule applies (lib/gates/youtubeDb). */
  youtube?: YoutubeJoinInfo & { usesSub: boolean; usesMember: boolean };
  kick?: { slug: string | null; linked: string | null; available: boolean };
} | null> {
  const g = await gatesForEvent(eventId);
  if (!g) return null;
  const ctx = await gateContext(g.clanId, g.hostName);
  const usesTwitch = g.gates.anyOf.some(isTwitchRule);
  const linked = usesTwitch && userId != null ? await viewerTwitch(userId) : null;
  const usesKick = g.gates.anyOf.some(isKickRule);
  return {
    summary: gatesSummary(g.gates, ctx),
    usesTwitch,
    twitchLinked: linked?.login ?? null,
    twitchAvailable: twitchConfig() !== null,
    ...(usesYoutube(g.gates)
      ? {
          youtube: {
            ...(await youtubeJoinInfo(g.clanId, userId, g.gates.anyOf.some((r) => r.kind === 'youtube-member'))),
            usesSub: g.gates.anyOf.some((r) => r.kind === 'youtube-sub'),
            usesMember: g.gates.anyOf.some((r) => r.kind === 'youtube-member'),
          },
        }
      : {}),
    ...(usesKick ? { kick: await kickGateInfo(g.clanId, userId) } : {}),
  };
}

// ── The host's choices ──────────────────────────────────────────────────────────────────────────

export async function gateOptions(clanId: number): Promise<GateOptions> {
  const configured = twitchConfig() !== null;
  const [channel, creds, youtube] = await Promise.all([
    configured ? hostTwitchChannel(clanId) : null,
    getBotCredentials(clanId),
    youtubeGateOptions(clanId),
  ]);
  const roles = creds
    ? (await fetchGuildRoles(clanId))
        // Every role but @everyone (whose id is the server's). Unlike the role pickers that ASSIGN
        // roles, managed and powerful roles stay: a gate only reads, and the Twitch integration's own
        // "Twitch Subscriber" role is managed — and exactly the one a streamer is likely to pick.
        .filter((r) => r.id !== creds.guildId && r.name !== '@everyone')
        .sort((a, b) => b.position - a.position)
        .map((r) => ({ id: r.id, name: r.name }))
    : [];
  return {
    twitch: { configured, channel, connectUrl: configured ? `/api/auth/twitch/start?as=host&space=${clanId}` : null },
    discord: { connected: !!creds, roles },
    youtube,
    ...(await kickOptionsField(clanId)),
  };
}

/** May this user change a creator space's Twitch connection? Admin or owner of THAT space. */
export async function isAdminOfCreatorSpace(clanId: number, userId: number): Promise<boolean> {
  const clan = await db.query.clans.findFirst({ where: eq(clans.id, clanId), columns: { kind: true } });
  if (clan?.kind !== 'creator') return false;
  const staff = await db.query.clanStaff.findFirst({
    where: and(eq(clanStaff.clanId, clanId), eq(clanStaff.userId, userId)),
    columns: { role: true },
  });
  return !!staff && atLeast(staff.role, 'admin');
}

async function kickOptionsField(clanId: number): Promise<{ kick?: GateOptions['kick'] }> {
  const kick = await kickGateOptions(clanId);
  return kick ? { kick } : {};
}
