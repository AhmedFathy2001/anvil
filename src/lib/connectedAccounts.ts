// Connected accounts — the database half (rules: lib/connectedAccountsRules, live badges:
// lib/connectedLive, Medal's API: lib/medal).
//
// Twitch, YouTube and Kick read and write the SAME identity-only link tables the entry gates use
// (user_twitch_links, user_youtube_links, user_kick_links). That is the gate fast path: an account
// linked here is the account a gated event checks, with nothing to link again —
//   Twitch  follow/sub are asked of the host's token about the linked Twitch id (lib/entryGatesDb);
//   Kick    follow/sub are what Kick's webhook told us about the linked Kick id (lib/gates/kickDb);
//   YouTube the member chat code only counts from the linked channel; a SUBSCRIBER check still needs
//           one Google sign-in, because YouTube only tells the viewer's own token who they subscribe
//           to and that token is never kept (lib/gates/youtube).

import { and, eq, inArray, isNull, ne } from 'drizzle-orm';

import { db } from '@/db';
import {
  eventGateClaims,
  eventTwitchClaims,
  events,
  kickLinkCodes,
  userConnectedPrefs,
  userKickLinks,
  userMedalLinks,
  userTwitchLinks,
  userYoutubeLinks,
  userYoutubeProofs,
  users,
} from '@/db/schema';
import { parseStamp } from '@/lib/dbTime';
import { gateCache } from '@/lib/entryGatesDb';
import {
  PLATFORMS,
  cleanHandle,
  creditsName,
  kickSlugFor,
  kickUrl,
  medalCode,
  medalUrl,
  parseMedalProfile,
  resolveShowOnProfile,
  titleHasCode,
  twitchUrl,
  visibleLinks,
  youtubeUrl,
  type ConnectedLink,
  type Platform,
} from '@/lib/connectedAccountsRules';
import { kickLive, twitchLive } from '@/lib/connectedLive';
import { latestClips, medalApiKey, type FetchLike } from '@/lib/medal';

export interface MedalState {
  medalUserId: string | null;
  medalUsername: string | null;
  verified: boolean;
  /** The code to put in a clip title — only when verification is possible (numeric id + API key). */
  code: string | null;
}

export interface ConnectedAccountsView {
  links: ConnectedLink[];
  medal: MedalState | null;
}

/** A link as shown, plus "live now" where the platform answers cheaply. */
export type LiveLink = ConnectedLink & { live: boolean };

/** The key the Medal code is derived from (any server secret will do; never sent anywhere). */
function medalCodeKey(): string {
  return process.env.MEDAL_CODE_KEY?.trim() || process.env.TWITCH_TOKEN_KEY?.trim() || process.env.SESSION_SECRET?.trim() || 'anvil-medal';
}

// ── Reading ─────────────────────────────────────────────────────────────────────────────────────

/** Everything one login has linked, in platform order, with their show-on-profile choices. */
export async function connectedAccountsForUser(userId: number): Promise<ConnectedAccountsView> {
  // clan-scope: global -- a person's own identity links; none of these tables belong to a clan.
  const [tw, yt, kick, medal, prefs] = await Promise.all([
    db.query.userTwitchLinks.findFirst({ where: eq(userTwitchLinks.userId, userId) }),
    db.query.userYoutubeLinks.findFirst({ where: eq(userYoutubeLinks.userId, userId) }),
    db.query.userKickLinks.findFirst({ where: eq(userKickLinks.userId, userId) }),
    db.query.userMedalLinks.findFirst({ where: eq(userMedalLinks.userId, userId) }),
    db.query.userConnectedPrefs.findMany({ where: eq(userConnectedPrefs.userId, userId) }),
  ]);
  const pref = new Map(prefs.map((p) => [p.platform, p.showOnProfile]));
  const links: ConnectedLink[] = [];
  if (tw) {
    links.push({
      platform: 'twitch',
      handle: cleanHandle(tw.twitchLogin, 25),
      url: twitchUrl(tw.twitchLogin),
      verified: true,
      showOnProfile: resolveShowOnProfile(pref.get('twitch'), true),
      platformId: tw.twitchUserId,
    });
  }
  if (yt) {
    links.push({
      platform: 'youtube',
      handle: cleanHandle(yt.youtubeTitle, 60) || 'YouTube channel',
      url: youtubeUrl(yt.youtubeChannelId),
      verified: true,
      showOnProfile: resolveShowOnProfile(pref.get('youtube'), true),
      platformId: yt.youtubeChannelId,
    });
  }
  if (kick) {
    links.push({
      platform: 'kick',
      handle: cleanHandle(kick.kickUsername, 40),
      url: kickUrl(kickSlugFor(kick.kickUsername)),
      verified: true,
      showOnProfile: resolveShowOnProfile(pref.get('kick'), true),
      platformId: kick.kickUserId,
    });
  }
  let medalState: MedalState | null = null;
  if (medal && (medal.medalUserId || medal.medalUsername)) {
    const verified = medal.verifiedAt != null;
    links.push({
      platform: 'medal',
      handle: cleanHandle(medal.medalUsername ?? `user ${medal.medalUserId}`, 40),
      url: medalUrl(medal),
      verified,
      showOnProfile: resolveShowOnProfile(pref.get('medal'), verified),
      platformId: medal.medalUserId,
    });
    medalState = {
      medalUserId: medal.medalUserId,
      medalUsername: medal.medalUsername,
      verified,
      code: !verified && medal.medalUserId && medalApiKey() ? medalCode(userId, medal.medalUserId, medalCodeKey()) : null,
    };
  }
  return { links, medal: medalState };
}

/**
 * A PERSON's links for a public page that knows the person (players.id). A person may hold more than
 * one login; for each platform the lowest user id that linked one wins. The caller decides whether
 * the page may show them at all (lib/apexProfiles: only a person shown as one person).
 */
export async function connectedAccountsForPlayer(playerId: number): Promise<ConnectedLink[]> {
  try {
    // clan-scope: global -- a person's logins, not a clan's.
    const logins = await db.select({ id: users.id }).from(users).where(eq(users.playerId, playerId)).orderBy(users.id);
    const seen = new Set<Platform>();
    const out: ConnectedLink[] = [];
    for (const u of logins.slice(0, 5)) {
      for (const l of (await connectedAccountsForUser(u.id)).links) {
        if (seen.has(l.platform)) continue;
        seen.add(l.platform);
        out.push(l);
      }
    }
    return PLATFORMS.flatMap((p) => out.filter((l) => l.platform === p));
  } catch {
    // Decoration: a failed read is no chips, never a broken profile.
    return [];
  }
}

/** Add "live now" (Twitch, Kick) and Kick's real slug. Batched + cached in lib/connectedLive. */
export async function withLive(links: ConnectedLink[]): Promise<LiveLink[]> {
  const tw = links.filter((l) => l.platform === 'twitch' && l.platformId).map((l) => l.platformId!);
  const kk = links.filter((l) => l.platform === 'kick' && l.platformId).map((l) => l.platformId!);
  const [twl, kkl] = await Promise.all([
    tw.length ? twitchLive(tw).catch(() => new Map<string, boolean>()) : new Map<string, boolean>(),
    kk.length ? kickLive(kk).catch(() => new Map()) : new Map(),
  ]);
  return links.map((l) => {
    if (l.platform === 'twitch') return { ...l, live: twl.get(l.platformId ?? '') ?? false };
    if (l.platform === 'kick') {
      const k = kkl.get(l.platformId ?? '') as { live: boolean; slug?: string | null } | undefined;
      return { ...l, live: k?.live ?? false, url: (k?.slug && kickUrl(k.slug)) || l.url };
    }
    return { ...l, live: false };
  });
}

// ── Choices ─────────────────────────────────────────────────────────────────────────────────────

/** Show or hide one linked platform on their profile. False when nothing is linked there. */
export async function setShowOnProfile(userId: number, platform: Platform, show: boolean): Promise<boolean> {
  const view = await connectedAccountsForUser(userId);
  if (!view.links.some((l) => l.platform === platform)) return false;
  const values = { showOnProfile: show, updatedAt: new Date().toISOString() };
  // clan-scope: global -- per-person preference.
  await db
    .insert(userConnectedPrefs)
    .values({ userId, platform, ...values })
    .onConflictDoUpdate({ target: [userConnectedPrefs.userId, userConnectedPrefs.platform], set: values });
  return true;
}

// ── Unlinking ───────────────────────────────────────────────────────────────────────────────────

/** An event that is over: force-ended, or past its end date. Its claims are history, not a lock. */
function eventOver(ev: { endDate: string | null; forceEndedAt: string | null }, now: number): boolean {
  if (ev.forceEndedAt) return true;
  const end = parseStamp(ev.endDate);
  return end != null && end < now;
}

/**
 * Remove one platform link and everything cached about it for this login:
 *   - the link row and the show-on-profile choice;
 *   - YouTube: the subscriber/member proofs; Kick: their unused link codes;
 *   - the gate verdict cache;
 *   - their one-account-per-event claims on events that are OVER. Claims on running or upcoming events
 *     stay, so unlinking and relinking the same account on another login still cannot let two people
 *     into one event (lib/entryGatesDb claimTwitchForEvent, lib/gates/claims).
 */
export async function unlinkConnectedAccount(userId: number, platform: Platform, now = Date.now()): Promise<void> {
  // clan-scope: global -- every statement below is keyed on this login's own rows.
  if (platform === 'twitch') {
    await db.delete(userTwitchLinks).where(eq(userTwitchLinks.userId, userId));
    await dropEndedClaims(userId, 'twitch', now);
  } else if (platform === 'youtube') {
    await db.delete(userYoutubeLinks).where(eq(userYoutubeLinks.userId, userId));
    await db.delete(userYoutubeProofs).where(eq(userYoutubeProofs.userId, userId));
    await dropEndedClaims(userId, 'youtube', now);
  } else if (platform === 'kick') {
    await db.delete(userKickLinks).where(eq(userKickLinks.userId, userId));
    await db.delete(kickLinkCodes).where(and(eq(kickLinkCodes.userId, userId), isNull(kickLinkCodes.usedAt)));
    await dropEndedClaims(userId, 'kick', now);
  } else {
    await db.delete(userMedalLinks).where(eq(userMedalLinks.userId, userId));
  }
  await db.delete(userConnectedPrefs).where(and(eq(userConnectedPrefs.userId, userId), eq(userConnectedPrefs.platform, platform)));
  gateCache.forgetUser(userId);
}

async function dropEndedClaims(userId: number, platform: 'twitch' | 'youtube' | 'kick', now: number): Promise<void> {
  if (platform === 'twitch') {
    // clan-scope: global -- this login's claims across every event, filtered to finished ones below.
    const rows = await db
      .select({ eventId: eventTwitchClaims.eventId, endDate: events.endDate, forceEndedAt: events.forceEndedAt })
      .from(eventTwitchClaims)
      .innerJoin(events, eq(events.id, eventTwitchClaims.eventId))
      .where(eq(eventTwitchClaims.userId, userId));
    const over = rows.filter((r) => eventOver(r, now)).map((r) => r.eventId);
    if (over.length) {
      await db.delete(eventTwitchClaims).where(and(eq(eventTwitchClaims.userId, userId), inArray(eventTwitchClaims.eventId, over)));
    }
    return;
  }
  // clan-scope: global -- as above, for event_gate_claims.
  const rows = await db
    .select({ eventId: eventGateClaims.eventId, endDate: events.endDate, forceEndedAt: events.forceEndedAt })
    .from(eventGateClaims)
    .innerJoin(events, eq(events.id, eventGateClaims.eventId))
    .where(and(eq(eventGateClaims.userId, userId), eq(eventGateClaims.platform, platform)));
  const over = rows.filter((r) => eventOver(r, now)).map((r) => r.eventId);
  if (over.length) {
    await db
      .delete(eventGateClaims)
      .where(and(eq(eventGateClaims.userId, userId), eq(eventGateClaims.platform, platform), inArray(eventGateClaims.eventId, over)));
  }
}

// ── Medal ───────────────────────────────────────────────────────────────────────────────────────

export type MedalSetResult = { ok: true } | { ok: false; reason: 'invalid' | 'taken' };

/**
 * Save what they typed as their Medal profile — UNVERIFIED (hidden from their profile by default).
 * Re-saving the same verified account keeps it verified; anything else starts over. 'taken' when that
 * Medal id is already VERIFIED on another login.
 */
export async function setMedalProfile(userId: number, input: unknown): Promise<MedalSetResult> {
  const p = parseMedalProfile(input);
  if (!p) return { ok: false, reason: 'invalid' };
  // clan-scope: global -- identity links are per person.
  if (p.userId) {
    const other = await db.query.userMedalLinks.findFirst({
      where: and(eq(userMedalLinks.medalUserId, p.userId), ne(userMedalLinks.userId, userId)),
      columns: { verifiedAt: true },
    });
    if (other?.verifiedAt) return { ok: false, reason: 'taken' };
  }
  const mine = await db.query.userMedalLinks.findFirst({ where: eq(userMedalLinks.userId, userId) });
  const same = !!mine?.verifiedAt && !!p.userId && mine.medalUserId === p.userId;
  const values = same
    ? { medalUserId: mine!.medalUserId, medalUsername: mine!.medalUsername, verifiedAt: mine!.verifiedAt, linkedAt: mine!.linkedAt }
    : { medalUserId: p.userId, medalUsername: p.username, verifiedAt: null, linkedAt: new Date().toISOString() };
  await db.insert(userMedalLinks).values({ userId, ...values }).onConflictDoUpdate({ target: userMedalLinks.userId, set: values });
  if (!same) {
    // A changed (so unverified) Medal link goes back to hidden unless they choose otherwise again.
    await db.delete(userConnectedPrefs).where(and(eq(userConnectedPrefs.userId, userId), eq(userConnectedPrefs.platform, 'medal')));
  }
  return { ok: true };
}

export type MedalVerifyResult =
  | { ok: true; username: string | null }
  | { ok: false; reason: 'off' | 'none' | 'needs-id' | 'not-found' | 'no-code' | 'taken' | 'error' };

let medalFetch: FetchLike = (input, init) => fetch(input, init);
export function setMedalFetchForTests(f: FetchLike | null): void {
  medalFetch = f ?? ((input, init) => fetch(input, init));
}

/** Look for their code in their latest public clip titles; verify the link when it is there. */
export async function verifyMedal(userId: number): Promise<MedalVerifyResult> {
  const key = medalApiKey();
  if (!key) return { ok: false, reason: 'off' };
  // clan-scope: global -- identity links are per person.
  const mine = await db.query.userMedalLinks.findFirst({ where: eq(userMedalLinks.userId, userId) });
  if (!mine) return { ok: false, reason: 'none' };
  if (!mine.medalUserId) return { ok: false, reason: 'needs-id' };
  if (mine.verifiedAt) return { ok: true, username: mine.medalUsername };
  const clips = await latestClips(key, mine.medalUserId, 10, medalFetch);
  if (!clips.ok) return { ok: false, reason: clips.reason === 'not-found' ? 'not-found' : 'error' };
  const code = medalCode(userId, mine.medalUserId, medalCodeKey());
  const hit = clips.value.find((c) => titleHasCode(c.title, code));
  if (!hit) return { ok: false, reason: 'no-code' };
  const username = clips.value.map((c) => creditsName(c.credits, mine.medalUserId!)).find((n): n is string => !!n) ?? mine.medalUsername;
  try {
    await db
      .update(userMedalLinks)
      .set({ verifiedAt: new Date().toISOString(), medalUsername: username })
      .where(eq(userMedalLinks.userId, userId));
  } catch (err) {
    if ((err as { code?: string })?.code === '23505') return { ok: false, reason: 'taken' };
    throw err;
  }
  // Unverified claims of the same Medal account by other logins are now simply wrong: drop them.
  await db
    .delete(userMedalLinks)
    .where(and(eq(userMedalLinks.medalUserId, mine.medalUserId), ne(userMedalLinks.userId, userId), isNull(userMedalLinks.verifiedAt)));
  return { ok: true, username };
}

/** Test helper: the Medal code for a login + Medal id, with the server's key. */
export function medalCodeFor(userId: number, medalUserId: string): string {
  return medalCode(userId, medalUserId, medalCodeKey());
}

/**
 * What a profile page shows for a person: their links as the viewer may see them, with live badges.
 * PRIVACY is the caller's: only call this where the page may already say who the person is — /u/<id>
 * (they show their characters as one person) or /p/<rsn> when personPublic or the viewer owns it —
 * because a Twitch handle on two character pages would otherwise tie them together (the same rule as
 * profile pictures, lib/profileMedia).
 */
export async function profileConnectedAccounts(playerId: number, viewerIsOwner: boolean): Promise<LiveLink[]> {
  const links = visibleLinks(await connectedAccountsForPlayer(playerId), viewerIsOwner);
  return links.length ? withLive(links).catch(() => links.map((l) => ({ ...l, live: false }))) : [];
}
