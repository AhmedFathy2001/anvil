// Connected accounts — the database half (rules: lib/connectedAccountsRules, live badges:
// lib/connectedLive). Medal is a plain pasted link: never verified, never trusted by gates.
//
// Twitch, YouTube and Kick read and write the SAME identity-only link tables the entry gates use
// (user_twitch_links, user_youtube_links, user_kick_links). That is the gate fast path: an account
// linked here is the account a gated event checks, with nothing to link again —
//   Twitch  follow/sub are asked of the host's token about the linked Twitch id (lib/entryGatesDb);
//   Kick    follow/sub are what Kick's webhook told us about the linked Kick id (lib/gates/kickDb);
//   YouTube the member chat code only counts from the linked channel; a SUBSCRIBER check still needs
//           one Google sign-in, because YouTube only tells the viewer's own token who they subscribe
//           to and that token is never kept (lib/gates/youtube).

import { and, eq, inArray, isNull } from 'drizzle-orm';

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
  kickSlugFor,
  kickUrl,
  medalUrl,
  parseMedalProfile,
  resolveShowOnProfile,
  twitchUrl,
  visibleLinks,
  youtubeUrl,
  type ConnectedLink,
  type Platform,
} from '@/lib/connectedAccountsRules';
import { kickLive, twitchLive } from '@/lib/connectedLive';

export interface MedalState {
  medalUserId: string | null;
  medalUsername: string | null;
}

export interface ConnectedAccountsView {
  links: ConnectedLink[];
  medal: MedalState | null;
}

/** A link as shown, plus "live now" where the platform answers cheaply. */
export type LiveLink = ConnectedLink & { live: boolean };

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
      selfReported: false,
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
      selfReported: false,
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
      selfReported: false,
      showOnProfile: resolveShowOnProfile(pref.get('kick'), true),
      platformId: kick.kickUserId,
    });
  }
  let medalState: MedalState | null = null;
  if (medal && (medal.medalUserId || medal.medalUsername)) {
    links.push({
      platform: 'medal',
      handle: cleanHandle(medal.medalUsername ?? `user ${medal.medalUserId}`, 40),
      url: medalUrl(medal),
      verified: false,
      selfReported: true,
      showOnProfile: resolveShowOnProfile(pref.get('medal'), true),
      platformId: medal.medalUserId,
    });
    medalState = {
      medalUserId: medal.medalUserId,
      medalUsername: medal.medalUsername,
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

export type MedalSetResult = { ok: true } | { ok: false; reason: 'invalid' };

/**
 * Save what they pasted as their Medal profile. A plain link, like a social handle they typed: no
 * verification, no uniqueness (two logins may paste the same profile), and the show-on-profile choice
 * they already made is kept.
 */
export async function setMedalProfile(userId: number, input: unknown): Promise<MedalSetResult> {
  const p = parseMedalProfile(input);
  if (!p) return { ok: false, reason: 'invalid' };
  // verifiedAt stays null: the column (and its verified-only unique index) is legacy, never set now.
  const values = { medalUserId: p.userId, medalUsername: p.username, verifiedAt: null, linkedAt: new Date().toISOString() };
  // clan-scope: global -- identity links are per person.
  await db.insert(userMedalLinks).values({ userId, ...values }).onConflictDoUpdate({ target: userMedalLinks.userId, set: values });
  return { ok: true };
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
