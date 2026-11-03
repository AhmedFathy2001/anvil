// The in-game chat feed: gathers who could hear an item (lib/chatFeedRules decides who does) and
// sends it over the plugin's live socket (push/server.ts) by Postgres NOTIFY.
//
// Three places start an item: POST /api/plugin/moments (a player's drop, pet, slot, task, level,
// quest or diary), /api/plugin/mode-lines (game-mode unlocks) and a tile completing on a board
// (lib/discord notifyTileCompletion). Nobody listening is not an error: a NOTIFY to users with no
// socket open goes nowhere, and the plugin only opens one while its feed switch is on.

import { hasChatStar } from '@/lib/chatLook';
import { SUPPORTER_INK, supporterForUser } from '@/lib/supporter';
import { and, eq, gt, inArray, isNull, lt, sql } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships, clans, eventParticipants, events, feedItems, guestPresence, users } from '@/db/schema';
import { eventHasStarted } from '@/lib/completionGate';
import { parseStamp } from '@/lib/dbTime';
import { log } from '@/lib/logger';
import { getSetting } from '@/lib/settings';
import { standingsHidden } from '@/lib/standingsVisibility';
import {
  feedMessage,
  parsePrefs,
  recipients,
  type Candidate,
  type ChatFeedPrefs,
  type FeedItem,
  type Recipient,
} from '@/lib/chatFeedRules';

/** A guest-channel report older than this is nobody: the plugin refreshes it well inside. */
export const GUEST_PRESENCE_TTL_MS = 10 * 60_000;
/** Clan setting (Integrations → Webhooks → Whose activity): share members' items with the guests in its channel, and theirs with members. */
export const SHARE_GUESTS_KEY = 'chat_feed_share_guests';
/** NOTIFY payloads cap at 8000 bytes; this many ids stays far under with the message beside them. */
const IDS_PER_NOTIFY = 400;

export async function clanSharesWithGuests(clanId: number): Promise<boolean> {
  const raw = await getSetting(clanId, SHARE_GUESTS_KEY);
  return raw === 'true' || raw === '1';
}

// ── Prefs ────────────────────────────────────────────────────────────────────────────────────────

export async function getChatFeedPrefs(userId: number): Promise<ChatFeedPrefs> {
  const row = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { chatFeedPrefs: true } });
  return parsePrefs(row?.chatFeedPrefs);
}

export async function setChatFeedPrefs(userId: number, prefs: ChatFeedPrefs): Promise<void> {
  await db.update(users).set({ chatFeedPrefs: JSON.stringify(prefs) }).where(eq(users.id, userId));
}

async function prefsFor(userIds: number[]): Promise<Map<number, ChatFeedPrefs>> {
  if (!userIds.length) return new Map();
  const rows = await db.select({ id: users.id, prefs: users.chatFeedPrefs }).from(users).where(inArray(users.id, userIds));
  return new Map(rows.map((r) => [r.id, parsePrefs(r.prefs)]));
}

/** Each user's in-game clans: the clans holding a live MEMBER seat for any of their characters. */
async function memberClansOf(userIds: number[]): Promise<Map<number, Set<number>>> {
  const out = new Map<number, Set<number>>();
  if (!userIds.length) return out;
  const rows = await db
    .select({ userId: users.id, clanId: clanMemberships.clanId })
    .from(users)
    .innerJoin(accounts, eq(accounts.playerId, users.playerId))
    .innerJoin(clanMemberships, eq(clanMemberships.accountId, accounts.id))
    .where(and(inArray(users.id, userIds), eq(clanMemberships.kind, 'member'), isNull(clanMemberships.leftAt)));
  for (const r of rows) {
    let set = out.get(r.userId);
    if (!set) out.set(r.userId, (set = new Set()));
    set.add(r.clanId);
  }
  return out;
}

// ── Guest presence ───────────────────────────────────────────────────────────────────────────────

/**
 * Where this character sits as a guest right now, from the plugin's guest channel name (null = none).
 * Returns the Anvil clan it resolved to, or null when the name is no clan here (nothing is stored).
 */
export async function setGuestPresence(accountId: number, userId: number, guestChannel: string | null): Promise<{ clanId: number; name: string } | null> {
  const name = guestChannel?.trim();
  const clan = name
    ? await db.query.clans.findFirst({
        where: sql`lower(trim(${clans.inGameName})) = lower(${name})`,
        columns: { id: true, name: true },
      })
    : null;
  if (!clan) {
    await db.delete(guestPresence).where(eq(guestPresence.accountId, accountId));
    return null;
  }
  await db
    .insert(guestPresence)
    .values({ accountId, userId, clanId: clan.id, seenAt: new Date() })
    .onConflictDoUpdate({ target: guestPresence.accountId, set: { userId, clanId: clan.id, seenAt: new Date() } });
  return { clanId: clan.id, name: clan.name };
}

function presenceFresh() {
  return gt(guestPresence.seenAt, new Date(Date.now() - GUEST_PRESENCE_TTL_MS));
}

// ── Audiences ────────────────────────────────────────────────────────────────────────────────────

interface LiveBoard {
  id: number;
  name: string;
  hidden: boolean;
}

/** Boards with the chat feed on that this character plays on right now, with its team on each. */
async function liveFeedBoards(accountId: number): Promise<(LiveBoard & { teamId: number | null })[]> {
  // clan-scope: global -- a character's boards across every clan; a board's feed is for its players, whoever hosts it.
  const rows = await db
    .select({
      id: events.id,
      name: events.name,
      teamId: eventParticipants.teamId,
      startDate: events.startDate,
      endDate: events.endDate,
      forceEndedAt: events.forceEndedAt,
      rules: events.rules,
    })
    .from(eventParticipants)
    .innerJoin(events, eq(events.id, eventParticipants.eventId))
    .where(and(eq(eventParticipants.accountId, accountId), eq(events.chatFeed, true)));
  const now = Date.now();
  return rows
    .filter((r) => isLive(r, now))
    .map((r) => ({ id: r.id, name: r.name, teamId: r.teamId, hidden: standingsHidden(r, now) }));
}

function isLive(e: { startDate: string | null; endDate: string | null; forceEndedAt: string | null }, now: number): boolean {
  return !e.forceEndedAt && eventHasStarted(e, now) && (!e.endDate || (parseStamp(e.endDate) ?? 0) > now);
}

/** The users playing on a board, with their team. */
async function boardUsers(eventId: number): Promise<{ userId: number; teamId: number | null }[]> {
  return db
    .selectDistinct({ userId: users.id, teamId: eventParticipants.teamId })
    .from(eventParticipants)
    .innerJoin(accounts, eq(accounts.id, eventParticipants.accountId))
    .innerJoin(users, eq(users.playerId, accounts.playerId))
    .where(eq(eventParticipants.eventId, eventId));
}

/** Users with a live member seat in a clan. */
async function clanMemberUsers(clanId: number): Promise<number[]> {
  const rows = await db
    .selectDistinct({ userId: users.id })
    .from(clanMemberships)
    .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
    .innerJoin(users, eq(users.playerId, accounts.playerId))
    .where(and(eq(clanMemberships.clanId, clanId), eq(clanMemberships.kind, 'member'), isNull(clanMemberships.leftAt)));
  return rows.map((r) => r.userId);
}

/** Who might hear a player's own item, before anyone's preferences. */
async function personalCandidates(sender: { accountId: number; userId: number }): Promise<Candidate[]> {
  const out: Candidate[] = [];

  // Boards. While a board hides its standings, only the player's own team hears it.
  for (const board of await liveFeedBoards(sender.accountId)) {
    for (const u of await boardUsers(board.id)) {
      if (board.hidden && (u.teamId == null || u.teamId !== board.teamId)) continue;
      out.push({ userId: u.userId, via: 'event', tag: board.name });
    }
  }

  // Guest bridge, outward: the sender is guesting in a clan right now → that clan's members.
  const [here, senderRow] = await Promise.all([
    db
      .select({ clanId: guestPresence.clanId })
      .from(guestPresence)
      .where(and(eq(guestPresence.accountId, sender.accountId), presenceFresh())),
    db.query.users.findFirst({ where: eq(users.id, sender.userId), columns: { blockGuestEmissions: true } }),
  ]);
  if (here[0] && !senderRow?.blockGuestEmissions && (await clanSharesWithGuests(here[0].clanId))) {
    for (const userId of await clanMemberUsers(here[0].clanId)) out.push({ userId, via: 'guest', tag: 'Guest' });
  }

  // Guest bridge, inward: the sender's own clans → whoever is guesting in them right now.
  const own = await db
    .select({ clanId: clanMemberships.clanId, name: clans.name })
    .from(clanMemberships)
    .innerJoin(clans, eq(clans.id, clanMemberships.clanId))
    .where(and(eq(clanMemberships.accountId, sender.accountId), eq(clanMemberships.kind, 'member'), isNull(clanMemberships.leftAt)));
  for (const clan of own) {
    if (!(await clanSharesWithGuests(clan.clanId))) continue;
    const guests = await db
      .selectDistinct({ userId: guestPresence.userId })
      .from(guestPresence)
      .where(and(eq(guestPresence.clanId, clan.clanId), presenceFresh()));
    for (const g of guests) out.push({ userId: g.userId, via: 'guest', tag: clan.name });
  }
  return out;
}

// ── Sending ──────────────────────────────────────────────────────────────────────────────────────

/** Claim a sender's item key; false when it was already sent (a retry, or the same thing twice). */
export async function claimFeedItem(accountId: number, dedupKey: string): Promise<boolean> {
  const rows = await db
    .insert(feedItems)
    .values({ accountId, dedupKey: dedupKey.slice(0, 64) })
    .onConflictDoNothing()
    .returning({ id: feedItems.id });
  return rows.length > 0;
}

/** A sender's name colour (Supporter) and star (Patron), for the line other people see. */
async function flairOf(userId: number | null): Promise<{ color: string; star: boolean } | null> {
  if (userId == null) return null;
  const s = await supporterForUser(userId).catch(() => null);
  if (!s) return null;
  return { color: SUPPORTER_INK[s.tier.id].color, star: hasChatStar(s.tier.id) };
}

async function deliver(item: FeedItem, to: Recipient[], flair: { color: string; star: boolean } | null = null): Promise<number> {
  const byTag = new Map<string, number[]>();
  for (const r of to) {
    const list = byTag.get(r.tag) ?? [];
    list.push(r.userId);
    byTag.set(r.tag, list);
  }
  for (const [tag, ids] of byTag) {
    const m = feedMessage(item, tag, flair);
    for (let i = 0; i < ids.length; i += IDS_PER_NOTIFY) {
      await db.execute(sql`select pg_notify('anvil_push', ${JSON.stringify({ k: 'feed', u: ids.slice(i, i + IDS_PER_NOTIFY), m })})`);
    }
  }
  return to.length;
}

async function route(item: FeedItem, senderUserId: number | null, candidates: Candidate[]): Promise<number> {
  if (!candidates.length) return 0;
  const ids = [...new Set([...candidates.map((c) => c.userId), ...(senderUserId != null ? [senderUserId] : [])])];
  const [prefs, memberClans] = await Promise.all([prefsFor(ids), memberClansOf(ids)]);
  const to = recipients({ item, senderUserId, candidates, prefs, memberClans });
  if (!to.length) return 0;
  // A tile is a team's, not a person's: no one's flair on it.
  return deliver(item, to, item.kind === 'tile' ? null : await flairOf(senderUserId));
}

/** A player's own item (drop, pet, slot, task, level, quest, game-mode unlock). How many it reached. */
export async function emitPersonalItem(sender: { accountId: number; userId: number }, item: FeedItem): Promise<number> {
  try {
    return await route(item, sender.userId, await personalCandidates(sender));
  } catch (err) {
    log.warn('chat-feed.emit-failed', { kind: item.kind, message: (err as Error).message });
    return 0;
  }
}

/**
 * A team finished a tile: the OTHER teams on a board with the feed on hear it (the team's own players
 * already get their own announcement). Never while the board hides its standings.
 */
export async function emitTileCompletion(args: {
  eventId: number;
  teamId: number | null | undefined;
  teamName: string;
  tileLabel: string;
  finisher?: string | null;
}): Promise<void> {
  try {
    // clan-scope: global -- keyed by the event id the completion belongs to.
    const board = await db.query.events.findFirst({
      where: eq(events.id, args.eventId),
      columns: { name: true, chatFeed: true, rules: true, startDate: true, endDate: true, forceEndedAt: true },
    });
    if (!board?.chatFeed) return;
    const now = Date.now();
    if (!isLive(board, now) || standingsHidden(board, now)) return;
    const people = await boardUsers(args.eventId);
    const candidates: Candidate[] = people
      .filter((p) => args.teamId == null || p.teamId !== args.teamId)
      .map((p) => ({ userId: p.userId, via: 'event', tag: board.name }));
    const item: FeedItem = {
      kind: 'tile',
      who: args.teamName,
      text: `completed ${args.tileLabel}${args.finisher ? ` (${args.finisher})` : ''}`,
    };
    await route(item, null, candidates);
  } catch (err) {
    log.warn('chat-feed.tile-failed', { eventId: args.eventId, message: (err as Error).message });
  }
}

/** Old dedup keys and stale presence rows. Run from the daily sweep. */
export async function sweepChatFeed(): Promise<void> {
  await db.delete(feedItems).where(lt(feedItems.createdAt, new Date(Date.now() - 2 * 86_400_000)));
  await db.delete(guestPresence).where(lt(guestPresence.seenAt, new Date(Date.now() - GUEST_PRESENCE_TTL_MS)));
}
