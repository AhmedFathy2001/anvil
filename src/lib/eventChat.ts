// The event chat: one private channel per board, for its participants and the host's staff, shown in
// the plugin's Feed tab (view 'feed', pane 'chat'). Lines travel as panel rows (lib/panelRows) to the
// board's room on the push socket — one NOTIFY per message however many are listening.
//
// Three switches, any of which closes it: staff's platform switch (event_chat_enabled), the host's
// per-event `chat_enabled`, and the host's `chat_paused` (read-only at once). The rules for what may be
// said and how fast are pure, in lib/eventChatRules.

import { and, desc, eq, ilike, inArray, isNull, lt, or, sql } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanAuditLog, clanStaff, eventChatMessages, eventChatMutes, eventChatReads, eventParticipants, events, teams, users } from '@/db/schema';
import { normalizeRsn } from '@/lib/auth';
import { clanGrant, platformRoleOf } from '@/lib/clanGrants';
import { atLeast, hasPlatformRole, rankOf } from '@/lib/clanRoles';
import { parseStamp } from '@/lib/dbTime';
import {
  KEEP_DAYS,
  checkBody,
  cleanName,
  BURST_MAX,
  BURST_WINDOW_MS,
  isSlow,
  paceExempt,
  canSanction,
  chatRank,
  personGapMs,
  sanctionBlock,
  sanctionMessage,
  type ChatBlock,
  type ChatSanctionKind,
  type ChatStaffKind,
  newPace,
  recordSend,
  waitFor,
  type BoardPace,
  type ChatChannel,
  type ChatLock,
  canChooseOwnTeamChat,
  canPostChannel,
  canReadChannel,
  channelTeam,
  pausedFor,
  sanctionLock,
} from '@/lib/eventChatRules';
import { log } from '@/lib/logger';
import { eventStaffUserIds, notifyRows, teamUserIds, type RowsTarget } from '@/lib/panelRows';
import { getPlatformSetting, setPlatformSetting } from '@/lib/platformSettings';
import { chatFeedId, chatLockFeeds, chatRow, type ChatRowOptions } from '@/lib/pluginUi/feedUi';
import type { Action, Color, FeedRow } from '@/lib/pluginUi/nodes';
import { inkForSurface, supporterForUser, supporterForUsers, supporterInk } from '@/lib/supporter';

/**
 * Staff's switch for every event chat. OFF until staff turn it on ('true'): the chat needs the
 * plugin's Feed tab, so it stays out of sight until that plugin is live on the hub.
 */
export const EVENT_CHAT_PLATFORM_KEY = 'event_chat_enabled';

let platformCache: { on: boolean; at: number } | null = null;

/** `fresh`: skip the 30-second cache (the staff page, which must show what is stored). */
export async function platformChatOn(fresh = false): Promise<boolean> {
  const now = Date.now();
  if (!fresh && platformCache && now - platformCache.at < 30_000) return platformCache.on;
  const on = (await getPlatformSetting(EVENT_CHAT_PLATFORM_KEY)) === 'true';
  platformCache = { on, at: now };
  return on;
}

/** Is this board's chat open at all (Anvil-wide and for the event)? Who may use it is chatAccess's call. */
export async function boardChatOn(eventId: number): Promise<boolean> {
  const [platformOn, ev] = await Promise.all([
    platformChatOn(),
    // clan-scope: global -- a yes/no about one board by id; nothing of the clan's is returned
    db.query.events.findFirst({ where: eq(events.id, eventId), columns: { chatEnabled: true } }),
  ]);
  return platformOn && !!ev?.chatEnabled;
}

export async function setPlatformChat(on: boolean): Promise<void> {
  await setPlatformSetting(EVENT_CHAT_PLATFORM_KEY, on ? 'true' : 'false');
  platformCache = null;
  // Every board with chat on hears it at once: open chat boxes grey out (or reopen).
  // clan-scope: global -- the platform switch reaches every board with chat on, across clans
  const boards = await db.select({ id: events.id, paused: events.chatPaused }).from(events).where(eq(events.chatEnabled, true));
  for (const b of boards) {
    if (!on) await notifyRows({ e: b.id }, lockPush(chatLockFeeds(b.id, 'every'), { locked: 'Event chat is switched off on Anvil right now.' }));
    else await notifyRows({ e: b.id }, lockPush(chatLockFeeds(b.id, 'talk'), b.paused ? { locked: 'The host has paused chat.' } : null));
  }
}

/** A `rowslock` push: the box's line(s), or null to reopen it. */
function lockPush(feeds: string[], lock: ChatLock | null): Record<string, unknown> {
  return { t: 'rowslock', feeds, locked: lock?.locked ?? null, ...(lock?.sub ? { sub: lock.sub } : {}), ...(lock?.warn ? { warn: 1 } : {}) };
}

// ── Who's in ─────────────────────────────────────────────────────────────────────────────────────

export interface ChatAccess {
  eventId: number;
  /** The host clan: the one whose audit log a moderation action goes in. */
  clanId: number;
  /** The board has chat at all (platform + host), paused or not. */
  open: boolean;
  paused: boolean;
  /** Why it's closed, for the line under the list. */
  closedWhy: string | null;
  /** May read: a participant, or the host's staff. */
  member: boolean;
  staff: boolean;
  /** Which staff: the host clan's moderators and up ('event'), or Anvil staff with no job there. */
  staffKind: ChatStaffKind | null;
  /** Standing in this chat (lib/eventChatRules chatRank), read live: who they may time out or ban. */
  rank: number;
  role: 'host' | 'mod' | null;
  teamId: number | null;
  rsn: string | null;
  /** How many seats this person holds on the board: with more than one, "mine" is by character. */
  seats: number;
  /** A solo board (every player their own team): no team channels. */
  solo: boolean;
  /**
   * Event staff seated on a team who chose "Only my team's chat" (event_participants
   * own_team_chat_only): they read and post in their own team's channel only, like a player.
   */
  ownTeamOnly: boolean;
}

/**
 * Which character a request speaks as, when the person has more than one seat on the board: the
 * plugin's logged-in character (X-Account-Hash, then X-RSN or the launcher hint — see chatCharacter
 * in lib/pluginUi/feedView), or one seat by id (the tile lab plays a named player). With one seat
 * it never matters; with none given (the site, a staff tool) the first seat stands, as before.
 */
export interface ChatSeatPick {
  accountHash?: string | null;
  rsn?: string | null;
  participantId?: number;
}

interface Seat {
  id: number;
  teamId: number | null;
  name: string;
  accountHash: string | null;
  rsnNormalized: string | null;
  ownTeamChatOnly?: boolean;
}

/** The seat on a board this person speaks from: by the requesting character when they hold several. */
export function pickSeat(seats: Seat[], pick: ChatSeatPick | null | undefined): Seat | null {
  // No character named (the website, or an old client): the person's seat, as before.
  if (!pick || (pick.participantId == null && !pick.accountHash && !pick.rsn)) return seats[0] ?? null;
  if (pick.participantId != null) {
    const byId = seats.find((s) => s.id === pick.participantId);
    if (byId) return byId;
  }
  if (pick.accountHash) {
    const byHash = seats.find((s) => s.accountHash === pick.accountHash);
    if (byHash) return byHash;
  }
  const rsn = pick.rsn ? normalizeRsn(pick.rsn) : '';
  if (rsn) {
    const byName = seats.find((s) => s.rsnNormalized === rsn || normalizeRsn(s.name) === rsn);
    if (byName) return byName;
  }
  // The character asking isn't seated on this board (e.g. GIM Drenvox while Drenvox plays it): it
  // speaks as nobody here. Falling back to another seat put words in a character that didn't say them.
  return null;
}

/** A participant's team and name on a board, by the person's characters (and which one is asking). */
async function participantOf(
  eventId: number,
  userId: number,
  pick: ChatSeatPick | null | undefined,
): Promise<{ teamId: number | null; rsn: string; seats: number; ownTeamOnly: boolean } | null> {
  const seats = await db
    .select({
      id: eventParticipants.id,
      teamId: eventParticipants.teamId,
      name: eventParticipants.name,
      accountHash: accounts.accountHash,
      rsnNormalized: accounts.rsnNormalized,
      ownTeamChatOnly: eventParticipants.ownTeamChatOnly,
    })
    .from(eventParticipants)
    .innerJoin(accounts, eq(accounts.id, eventParticipants.accountId))
    .innerJoin(users, eq(users.playerId, accounts.playerId))
    .where(and(eq(eventParticipants.eventId, eventId), eq(users.id, userId)))
    .orderBy(eventParticipants.id);
  const seat = pickSeat(seats, pick);
  // The choice is the person's, on every seat they hold here: any seat set means it's on.
  return seat ? { teamId: seat.teamId, rsn: seat.name, seats: seats.length, ownTeamOnly: seats.some((s) => s.ownTeamChatOnly) } : null;
}

/**
 * `pick` names the character asking (see ChatSeatPick): a person with two characters seated on the
 * board, one per client, speaks — and reads their team's lines — as the one that sent the request.
 */
export async function chatAccess(eventId: number, userId: number, pick?: ChatSeatPick | null): Promise<ChatAccess | null> {
  const ev = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    columns: { id: true, clanId: true, chatEnabled: true, chatPaused: true, teamPlacement: true },
  });
  if (!ev) return null;
  const [platformOn, part, grant, platformRole] = await Promise.all([
    platformChatOn(),
    participantOf(eventId, userId, pick),
    clanGrant(ev.clanId, userId),
    platformRoleOf(userId),
  ]);
  const clanStaff = grant != null && atLeast(grant.role, 'moderator');
  const platformStaff = hasPlatformRole(platformRole, 'staff');
  const staff = clanStaff || platformStaff;
  const role = grant && atLeast(grant.role, 'admin') ? 'host' : clanStaff ? 'mod' : null;
  const open = platformOn && ev.chatEnabled;
  const staffKind: ChatStaffKind | null = clanStaff ? 'event' : platformStaff ? 'platform' : null;
  const solo = ev.teamPlacement === 'solo';
  const teamId = part?.teamId ?? null;
  return {
    eventId,
    clanId: ev.clanId,
    open,
    paused: ev.chatPaused,
    closedWhy: !platformOn ? 'Event chat is switched off on Anvil right now.' : !ev.chatEnabled ? 'The host hasn’t turned chat on for this event.' : null,
    member: part != null || staff,
    staff,
    staffKind,
    rank: chatRank(clanStaff ? rankOf(grant!.role) : 0, platformStaff),
    role,
    teamId,
    rsn: part?.rsn ?? null,
    seats: part?.seats ?? 0,
    solo,
    // Only where it was offered (canChooseOwnTeamChat): a flag left on a seat after the person lost
    // their staff job or their team narrows nothing.
    ownTeamOnly: !!part?.ownTeamOnly && canChooseOwnTeamChat({ staffKind, teamId, solo }),
  };
}

/**
 * Turn "Only my team's chat" on or off for this person on this board: every seat they hold on it.
 * Offered to the event's own staff who play on one of its teams (canChooseOwnTeamChat).
 */
export async function setOwnTeamChat(access: ChatAccess, userId: number, on: boolean): Promise<SendResult> {
  if (!canChooseOwnTeamChat(access)) return { ok: false, error: 'That’s for event staff who play on a team.' };
  const mine = db
    .select({ id: eventParticipants.id })
    .from(eventParticipants)
    .innerJoin(accounts, eq(accounts.id, eventParticipants.accountId))
    .innerJoin(users, eq(users.playerId, accounts.playerId))
    .where(and(eq(eventParticipants.eventId, access.eventId), eq(users.id, userId)));
  await db.update(eventParticipants).set({ ownTeamChatOnly: on }).where(inArray(eventParticipants.id, mine));
  return { ok: true };
}

/** People on this board who chose to read only their own team's chat (any of their seats). */
async function ownTeamOnlyUserIds(eventId: number): Promise<Set<number>> {
  const rows = await db
    .selectDistinct({ id: users.id })
    .from(eventParticipants)
    .innerJoin(accounts, eq(accounts.id, eventParticipants.accountId))
    .innerJoin(users, eq(users.playerId, accounts.playerId))
    .where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.ownTeamChatOnly, true)));
  return new Set(rows.map((r) => r.id));
}

// ── Pace (per process: one site process serves the plugin API) ─────────────────────────────────

const paces = new Map<number, BoardPace>();
const lastSent = new Map<string, number>();
/** Each person's recent sends per board, for the flood guard. */
const bursts = new Map<string, number[]>();

function paceOf(eventId: number): BoardPace {
  let p = paces.get(eventId);
  if (!p) paces.set(eventId, (p = newPace()));
  return p;
}

// ── Rows ─────────────────────────────────────────────────────────────────────────────────────────

interface StoredLine {
  id: number;
  userId: number;
  rsn: string;
  body: string;
  teamId: number | null;
  teamOnly: boolean;
  channel: string;
  fromStaff: boolean;
  createdAt: string;
}

const modAct = (eventId: number, id: number, act: 'chat-del' | 'chat-mute'): Action => ({
  a: 'post',
  act,
  args: { e: String(eventId), id: String(id) },
});

/**
 * `viewer.rsn`: set only when the viewer holds several seats on the board — then a line is "mine"
 * only when this character said it, not the same person's other character on another team.
 */
async function rowsFor(
  eventId: number,
  lines: StoredLine[],
  viewer: { userId: number; staff: boolean; rsn?: string | null; access?: ChatAccess } | null,
): Promise<FeedRow[]> {
  if (!lines.length) return [];
  const userIds = [...new Set(lines.map((l) => l.userId))];
  const teamIds = [...new Set(lines.map((l) => l.teamId).filter((t): t is number => t != null))];
  const [supporters, teamRows, hosts] = await Promise.all([
    supporterForUsers(userIds).catch(() => new Map()),
    teamIds.length ? db.select({ id: teams.id, name: teams.name, color: teams.color }).from(teams).where(inArray(teams.id, teamIds)) : Promise.resolve([]),
    staffRoles(eventId, userIds),
  ]);
  const teamById = new Map(teamRows.map((t) => [t.id, t]));
  // The right-click menu only on lines whose sender the viewer outranks (the same rule as the page).
  const ranks = viewer?.staff && viewer.access ? await ranksIn(viewer.access, userIds) : null;
  const canMod = (senderId: number) =>
    !!viewer?.staff && viewer.userId !== senderId && (!ranks || canSanction(viewer.access!.rank, ranks.get(senderId) ?? 0));
  return lines.map((l) => {
    const s = supporters.get(l.userId);
    // The panel is dark: their own dark look as-is when set, else the main look (the plugin adapts it).
    const ink = s ? inkForSurface(supporterInk(s.tier.id, s.style), 'dark', null) : null;
    const team = l.teamId != null ? teamById.get(l.teamId) : null;
    const o: ChatRowOptions = {
      // Per PERSON: every line they sent, as any of their characters or as host staff, is theirs.
      mine: viewer?.userId === l.userId,
      role: l.fromStaff ? (hosts.get(l.userId) ?? 'mod') : null,
      team: team ? { name: team.name, color: team.color } : null,
      ...(ink ? { whoColor: ink.color as Color, whoGlyph: s.tenure.glyph, ...(ink.grad ? { grad: ink.grad as `#${string}`[], ...(ink.move ? { move: true } : {}) } : {}) } : {}),
      modActions: canMod(l.userId) ? { del: modAct(eventId, l.id, 'chat-del'), mute: modAct(eventId, l.id, 'chat-mute') } : null,
    };
    return chatRow({ id: l.id, rsn: l.rsn, body: l.body, createdAt: l.createdAt }, o);
  });
}

/** Which of these people are the host (admin+) rather than a mod, on this board's clan. */
async function staffRoles(eventId: number, userIds: number[]): Promise<Map<number, 'host' | 'mod'>> {
  const out = new Map<number, 'host' | 'mod'>();
  const ev = await db.query.events.findFirst({ where: eq(events.id, eventId), columns: { clanId: true } });
  if (!ev) return out;
  for (const u of userIds) {
    const g = await clanGrant(ev.clanId, u).catch(() => null);
    if (g && atLeast(g.role, 'admin')) out.set(u, 'host');
    else if (g && atLeast(g.role, 'moderator')) out.set(u, 'mod');
  }
  return out;
}

const LINE_COLUMNS = {
  id: eventChatMessages.id,
  userId: eventChatMessages.userId,
  rsn: eventChatMessages.rsn,
  body: eventChatMessages.body,
  teamId: eventChatMessages.teamId,
  teamOnly: eventChatMessages.teamOnly,
  channel: eventChatMessages.channel,
  fromStaff: eventChatMessages.fromStaff,
  createdAt: eventChatMessages.createdAt,
};

/**
 * The latest lines in one channel, newest first, for someone allowed to read it (nothing otherwise),
 * and that channel counts as read up to the newest of them.
 */
export async function chatHistory(access: ChatAccess, viewerUserId: number, channel: ChatChannel, limit = 100): Promise<FeedRow[]> {
  if (!(await mayRead(access, channel))) return [];
  const lines = await db
    .select(LINE_COLUMNS)
    .from(eventChatMessages)
    .where(and(eq(eventChatMessages.eventId, access.eventId), ...channelWhere(channel), isNull(eventChatMessages.deletedAt)))
    .orderBy(desc(eventChatMessages.id))
    .limit(limit);
  if (lines.length) await markChannelRead(access.eventId, viewerUserId, channel, lines[0].id);
  return rowsFor(access.eventId, lines, { userId: viewerUserId, staff: access.staff, rsn: access.seats > 1 ? access.rsn : null, access });
}

/** A team channel names one of THIS board's teams (staff read any team's, but only on their board). */
async function teamOnBoard(eventId: number, teamId: number): Promise<boolean> {
  const [t] = await db.select({ id: teams.id }).from(teams).where(and(eq(teams.id, teamId), eq(teams.eventId, eventId))).limit(1);
  return !!t;
}

/** canReadChannel, and a team channel is one of this board's teams. */
export async function mayRead(access: ChatAccess, channel: ChatChannel): Promise<boolean> {
  if (!canReadChannel(access, channel)) return false;
  const team = channelTeam(channel);
  return team == null || team === access.teamId || (await teamOnBoard(access.eventId, team));
}

/**
 * The rows of one channel. 'all' and 'announce' also never hold a team-only line, whatever its
 * channel says (belt and braces over the 0241 backfill, which sent team-less team-only lines to 'team:0').
 */
function channelWhere(channel: ChatChannel) {
  const by = eq(eventChatMessages.channel, channel);
  return channelTeam(channel) == null ? [by, eq(eventChatMessages.teamOnly, false)] : [by];
}

/**
 * Move someone's read marker on a channel forward (never back): to `lastId`, or with none to the
 * channel's newest line (leaving a channel whose lines arrived live while it was open).
 */
export async function markChannelRead(eventId: number, userId: number, channel: ChatChannel, lastId?: number): Promise<void> {
  let upTo = lastId;
  if (upTo == null) {
    const [top] = await db
      .select({ id: sql<number>`max(${eventChatMessages.id})` })
      .from(eventChatMessages)
      .where(and(eq(eventChatMessages.eventId, eventId), eq(eventChatMessages.channel, channel)));
    upTo = top?.id ?? 0;
  }
  if (!upTo) return;
  await db
    .insert(eventChatReads)
    .values({ eventId, userId, channel, lastId: upTo })
    .onConflictDoUpdate({
      target: [eventChatReads.eventId, eventChatReads.userId, eventChatReads.channel],
      set: { lastId: sql`excluded.last_id` },
      // Only when it moves forward: an already-current marker writes nothing (the web page marks
      // its open channel on every load, lib/liveData liveChat).
      setWhere: lt(eventChatReads.lastId, upTo),
    });
}

/**
 * Unread lines per channel for one person: lines after their marker, not their own, not removed.
 * Channels they may not read count nothing. One grouped read over the board's recent chat.
 */
export async function chatUnread(access: ChatAccess, userId: number, channels: ChatChannel[]): Promise<Map<ChatChannel, number>> {
  const out = new Map<ChatChannel, number>(channels.map((c) => [c, 0]));
  const readable: ChatChannel[] = [];
  for (const c of channels) if (await mayRead(access, c)) readable.push(c);
  if (!readable.length) return out;
  const rows = await db
    .select({ channel: eventChatMessages.channel, n: sql<number>`count(*)::int` })
    .from(eventChatMessages)
    .leftJoin(
      eventChatReads,
      and(eq(eventChatReads.eventId, eventChatMessages.eventId), eq(eventChatReads.userId, userId), eq(eventChatReads.channel, eventChatMessages.channel)),
    )
    .where(
      and(
        eq(eventChatMessages.eventId, access.eventId),
        inArray(eventChatMessages.channel, readable),
        or(sql`${eventChatMessages.channel} like 'team:%'`, eq(eventChatMessages.teamOnly, false)),
        isNull(eventChatMessages.deletedAt),
        sql`${eventChatMessages.userId} <> ${userId}`,
        sql`${eventChatMessages.id} > coalesce(${eventChatReads.lastId}, 0)`,
      ),
    )
    .groupBy(eventChatMessages.channel);
  for (const r of rows) out.set(r.channel as ChatChannel, Number(r.n));
  return out;
}

/**
 * Who a channel's lines are pushed to: a team's channel to that team's players and the host's staff
 * by name (never the board's room, which also holds watchers); 'all' and 'announce' to the board.
 */
export async function channelTarget(eventId: number, channel: ChatChannel): Promise<RowsTarget> {
  const team = channelTeam(channel);
  if (team == null) return { e: eventId };
  const [players, staff, narrowed] = await Promise.all([teamUserIds(team, eventId), eventStaffUserIds(eventId), ownTeamOnlyUserIds(eventId)]);
  // Staff who chose "Only my team's chat" hear other teams' lines no more than a player does; their
  // own team's still reach them as one of its players.
  return { u: [...new Set([...players, ...staff.filter((u) => !narrowed.has(u))])] };
}

/**
 * The names this person's own lines carry (their characters' names and the display name they post
 * under as host staff), for the plugin to tell its live lines apart: sent only to that viewer.
 */
export async function myChatNames(userId: number): Promise<string[]> {
  const me = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { displayName: true, playerId: true } });
  if (!me) return [];
  const chars = me.playerId != null
    ? await db.select({ rsn: accounts.rsn }).from(accounts).where(eq(accounts.playerId, me.playerId))
    : [];
  const names = new Set(chars.map((c) => cleanName(c.rsn)).filter(Boolean));
  if (me.displayName) names.add(cleanName(me.displayName));
  return [...names].slice(0, 50);
}

/** Whether a board's chat is in slow mode right now (it turns itself on after a rush). */
export function boardChatSlow(eventId: number, now = Date.now()): boolean {
  return isSlow(paceOf(eventId), now);
}

// ── Saying something ─────────────────────────────────────────────────────────────────────────────

export type SendResult = { ok: true } | { ok: false; error: string };

/** Where a send goes: a channel, or 'team' for the sender's own team. */
export type ChatTarget = ChatChannel | 'team';

export async function sendChat(access: ChatAccess, userId: number, raw: string, target: ChatTarget, now = Date.now()): Promise<SendResult> {
  if (!access.member) return { ok: false, error: 'Only this event’s players can chat here.' };
  if (!access.open) return { ok: false, error: access.closedWhy ?? 'Chat is off.' };
  // A timeout or ban binds whoever it's on, staff included (only higher staff can impose one), on every channel.
  const block = await chatBlockOf(access.eventId, userId, now);
  if (block) return { ok: false, error: sanctionMessage(block) };
  if (target === 'team' && access.teamId == null) return { ok: false, error: 'You’re not on a team yet.' };
  const channel: ChatChannel = target === 'team' ? `team:${access.teamId!}` : target;
  if (!canPostChannel(access, channel) || !(await mayRead(access, channel))) {
    return { ok: false, error: channel === 'announce' ? 'Only the host and mods post here.' : 'That’s another team’s channel.' };
  }
  if (pausedFor(channel, access.paused, access.staff)) return { ok: false, error: 'The host has paused chat.' };

  const checked = checkBody(raw, { staff: access.staff });
  if (!checked.ok) return { ok: false, error: checked.reason };

  const pace = paceOf(access.eventId);
  const key = `${access.eventId}:${userId}`;
  // Their own pace follows their Supporter tier (lib/eventChatRules personGapMs); Anvil staff and
  // event staff who are Supporters never wait (paceExempt).
  const tier = access.staffKind === 'platform' ? null : ((await supporterForUser(userId).catch(() => null))?.tier.id ?? null);
  const exempt = paceExempt(access.staffKind, tier);
  const wait = waitFor(lastSent.get(key), now, isSlow(pace, now), exempt, personGapMs(tier));
  if (wait > 0) return { ok: false, error: `Slow mode — wait ${Math.ceil(wait / 1000)}s.` };
  // A flood guard for everyone, Patrons included: no more than BURST_MAX lines in BURST_WINDOW_MS.
  if (!exempt) {
    const recent = (bursts.get(key) ?? []).filter((t) => t > now - BURST_WINDOW_MS);
    if (recent.length >= BURST_MAX) return { ok: false, error: 'Slow down a little.' };
    recent.push(now);
    bursts.set(key, recent);
  }
  lastSent.set(key, now);
  recordSend(pace, now);

  // The name is the sender's too (a participant name, or staff's Discord name): cleaned like the line.
  const rsn = cleanName(access.rsn ?? (await db.query.users.findFirst({ where: eq(users.id, userId), columns: { displayName: true } }))?.displayName ?? 'Staff');
  const [line] = await db
    .insert(eventChatMessages)
    .values({ eventId: access.eventId, teamId: access.teamId, teamOnly: channelTeam(channel) != null, channel, userId, fromStaff: access.staff, rsn, body: checked.body })
    .returning(LINE_COLUMNS);
  // Pushed rows carry no "mine" and no mod menu: those are per viewer, and the same text goes to all.
  const [row] = await rowsFor(access.eventId, [line], null);
  await notifyRows(await channelTarget(access.eventId, channel), { t: 'rows', feeds: [chatFeedId(access.eventId, channel)], rows: [row] });
  return { ok: true };
}

// ── The host's staff ─────────────────────────────────────────────────────────────────────────────

async function lineOf(eventId: number, id: number) {
  return db.query.eventChatMessages.findFirst({ where: and(eq(eventChatMessages.id, id), eq(eventChatMessages.eventId, eventId)) });
}

/** One moderation action in the host clan's audit log. Never fails the action itself. */
async function audit(access: ChatAccess, byUserId: number, eventType: string, value: { old?: unknown; new?: unknown }, notes?: string): Promise<void> {
  await db
    .insert(clanAuditLog)
    .values({
      clanId: access.clanId,
      eventType,
      actorUserId: byUserId,
      oldValue: value.old === undefined ? null : JSON.stringify(value.old),
      newValue: value.new === undefined ? null : JSON.stringify(value.new),
      notes: notes ?? null,
    })
    .catch((err) => log.warn('event-chat.audit-failed', { eventType, message: (err as Error).message }));
}

/**
 * Remove a line (the plugin's right-click "Delete message" and the moderation page's Delete). The row
 * stays for a report; every open feed drops it at once (a `rowsdel` push), and history stops serving it.
 */
export async function deleteChat(access: ChatAccess, byUserId: number, id: number): Promise<SendResult> {
  if (!access.staff) return { ok: false, error: 'Only the host and mods can do that.' };
  const line = await lineOf(access.eventId, id);
  if (!line || line.deletedAt || !(await mayRead(access, (line.channel as ChatChannel) ?? 'all'))) return { ok: false, error: 'That message is gone.' };
  // Their own line, or one from someone they strictly outrank: a mod can't remove an admin's words.
  if (line.userId !== byUserId && !canSanction(access.rank, await rankIn(access, line.userId))) {
    return { ok: false, error: 'Only someone above them on staff can remove that.' };
  }
  await db
    .update(eventChatMessages)
    .set({ deletedAt: sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`, deletedBy: byUserId })
    .where(eq(eventChatMessages.id, id));
  const channel = (line.channel as ChatChannel) ?? 'all';
  await notifyRows(await channelTarget(access.eventId, channel), { t: 'rowsdel', feeds: [chatFeedId(access.eventId, channel)], ids: [`c${id}`] });
  await audit(access, byUserId, 'event_chat_message_deleted', {
    old: { eventId: access.eventId, messageId: id, userId: line.userId, rsn: line.rsn, body: line.body },
  });
  return { ok: true };
}

// ── Timeouts and bans (one model: lib/eventChatRules sanctionBlock, canSanction) ────────────────

const stampOf = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');

/** What, if anything, stops this person talking on this board right now. */
export async function chatBlockOf(eventId: number, userId: number, now = Date.now()): Promise<ChatBlock | null> {
  const row = await db.query.eventChatMutes.findFirst({
    where: and(eq(eventChatMutes.eventId, eventId), eq(eventChatMutes.userId, userId)),
    columns: { kind: true, until: true },
  });
  return sanctionBlock(row, now, parseStamp);
}

/** Someone's standing in this board's chat, read live (their clan job on the host and platform role). */
async function rankIn(access: ChatAccess, userId: number): Promise<number> {
  const [grant, platformRole] = await Promise.all([clanGrant(access.clanId, userId), platformRoleOf(userId)]);
  return chatRank(grant && atLeast(grant.role, 'moderator') ? rankOf(grant.role) : 0, hasPlatformRole(platformRole, 'staff'));
}

/** rankIn for many people at once (the moderation page's rows): two reads, not two per person. */
async function ranksIn(access: ChatAccess, userIds: number[]): Promise<Map<number, number>> {
  const ids = [...new Set(userIds)];
  const out = new Map<number, number>(ids.map((u) => [u, 0]));
  if (!ids.length) return out;
  const [grants, people] = await Promise.all([
    db.select({ userId: clanStaff.userId, role: clanStaff.role }).from(clanStaff).where(and(eq(clanStaff.clanId, access.clanId), inArray(clanStaff.userId, ids))),
    db.select({ id: users.id, platformRole: users.platformRole }).from(users).where(inArray(users.id, ids)),
  ]);
  const roleOf = new Map(grants.map((g) => [g.userId, g.role]));
  for (const p of people) {
    const role = roleOf.get(p.id);
    out.set(p.id, chatRank(role && atLeast(role, 'moderator') ? rankOf(role) : 0, hasPlatformRole(p.platformRole, 'staff')));
  }
  return out;
}

/** Is this person on this board's chat at all: seated on it, or has said something in it. */
async function knownOnBoard(eventId: number, userId: number): Promise<boolean> {
  const [said] = await db
    .select({ id: eventChatMessages.id })
    .from(eventChatMessages)
    .where(and(eq(eventChatMessages.eventId, eventId), eq(eventChatMessages.userId, userId)))
    .limit(1);
  if (said) return true;
  const [seat] = await db
    .select({ id: eventParticipants.id })
    .from(eventParticipants)
    .innerJoin(accounts, eq(accounts.id, eventParticipants.accountId))
    .innerJoin(users, eq(users.playerId, accounts.playerId))
    .where(and(eq(eventParticipants.eventId, eventId), eq(users.id, userId)))
    .limit(1);
  return !!seat;
}

/**
 * A sanction ended: the person's boxes reopen, or show the board's pause. Staff's Announcements box
 * reopens too; a player's keeps its read-only line (it's left out of the push).
 */
async function notifyReopen(eventId: number, userId: number, paused: boolean, staff: boolean): Promise<void> {
  await notifyRows({ u: [userId] }, lockPush(chatLockFeeds(eventId, 'talk'), pausedFor('all', paused, staff) ? { locked: 'The host has paused chat.' } : null));
  if (staff) await notifyRows({ u: [userId] }, lockPush([chatFeedId(eventId, 'announce')], null));
}

export interface SanctionInput {
  kind: ChatSanctionKind;
  /** A timeout's length (lib/eventChatRules timeoutMinutes). */
  minutes?: number;
  reason?: string | null;
}

/**
 * Time out or ban someone from this board's chat. Replaces whatever sanction they had (a ban over a
 * timeout, a fresh timeout over an old one). Their open chat boxes lock at once with the reason.
 */
export async function sanctionChat(access: ChatAccess, byUserId: number, targetUserId: number, input: SanctionInput, now = Date.now()): Promise<SendResult> {
  if (!access.staff) return { ok: false, error: 'Only the host and mods can do that.' };
  if (targetUserId === byUserId) return { ok: false, error: 'You can’t do that to yourself.' };
  if (input.kind === 'timeout' && !(input.minutes && input.minutes > 0)) return { ok: false, error: 'Pick how long the timeout lasts.' };
  if (!(await knownOnBoard(access.eventId, targetUserId))) return { ok: false, error: 'They aren’t on this event’s chat.' };
  const targetRank = await rankIn(access, targetUserId);
  if (!canSanction(access.rank, targetRank)) return { ok: false, error: 'Only someone above them on staff can do that.' };

  const until = input.kind === 'timeout' ? stampOf(now + input.minutes! * 60_000) : null;
  const reason = input.reason ?? null;
  const set = { kind: input.kind, until, reason, byUserId, createdAt: stampOf(now) };
  await db
    .insert(eventChatMutes)
    .values({ eventId: access.eventId, userId: targetUserId, ...set })
    .onConflictDoUpdate({ target: [eventChatMutes.eventId, eventChatMutes.userId], set });

  const block = sanctionBlock({ kind: input.kind, until }, now, parseStamp);
  // Every channel's box, Announcements too: a timeout or ban closes them all.
  if (block) await notifyRows({ u: [targetUserId] }, lockPush(chatLockFeeds(access.eventId, 'every'), sanctionLock(block)));
  await audit(access, byUserId, input.kind === 'ban' ? 'event_chat_banned' : 'event_chat_timed_out', {
    new: { eventId: access.eventId, userId: targetUserId, until, minutes: input.minutes ?? null, reason },
  });
  return { ok: true };
}

/** Lift someone's timeout or ban. Their chat boxes reopen (unless the board is paused). */
export async function liftChatSanction(access: ChatAccess, byUserId: number, targetUserId: number): Promise<SendResult> {
  if (!access.staff) return { ok: false, error: 'Only the host and mods can do that.' };
  const row = await db.query.eventChatMutes.findFirst({
    where: and(eq(eventChatMutes.eventId, access.eventId), eq(eventChatMutes.userId, targetUserId)),
  });
  if (!row) return { ok: false, error: 'They aren’t timed out or banned.' };
  const targetRank = await rankIn(access, targetUserId);
  if (targetUserId === byUserId || !canSanction(access.rank, targetRank)) {
    return { ok: false, error: 'Only someone above them on staff can do that.' };
  }
  await db.delete(eventChatMutes).where(and(eq(eventChatMutes.eventId, access.eventId), eq(eventChatMutes.userId, targetUserId)));
  await notifyReopen(access.eventId, targetUserId, access.paused, targetRank >= 1);
  await audit(access, byUserId, 'event_chat_sanction_lifted', {
    old: { eventId: access.eventId, userId: targetUserId, kind: row.kind, until: row.until, reason: row.reason, byUserId: row.byUserId },
  });
  return { ok: true };
}

// ── The moderation page (app/events/[eventId]/chat) ─────────────────────────────────────────────

export interface ModLine {
  id: number;
  userId: number;
  rsn: string;
  body: string;
  teamId: number | null;
  teamOnly: boolean;
  channel: string;
  fromStaff: boolean;
  createdAt: string;
}

export interface ModSanction {
  userId: number;
  name: string;
  kind: ChatSanctionKind;
  until: string | null;
  reason: string | null;
  byName: string | null;
  createdAt: string;
  /** Whether the viewer may lift it (they outrank the person). */
  canLift: boolean;
}

/** `%` and `_` typed into the search box are text, not wildcards. */
const likeText = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/**
 * Every recent line on the board for its staff, every channel (teams' included), removed ones not.
 * `filter`: one channel, 'staff' (said by the host's staff, any channel), or 'every' (the default).
 * `q` searches the text and name. `ownTeam`: a moderator who chose "Only my team's chat" — of the
 * teams' channels, only that team's.
 */
export async function chatModLines(
  eventId: number,
  opts: { filter?: 'every' | 'staff' | ChatChannel; q?: string; limit?: number; ownTeam?: number | null } = {},
): Promise<ModLine[]> {
  const where = [eq(eventChatMessages.eventId, eventId), isNull(eventChatMessages.deletedAt)];
  if (opts.ownTeam != null) {
    where.push(or(sql`${eventChatMessages.channel} not like 'team:%'`, eq(eventChatMessages.channel, `team:${opts.ownTeam}`))!);
  }
  if (opts.filter === 'staff') where.push(eq(eventChatMessages.fromStaff, true));
  else if (opts.filter && opts.filter !== 'every') where.push(...channelWhere(opts.filter));
  const q = opts.q?.trim().slice(0, 100);
  if (q) where.push(or(ilike(eventChatMessages.body, likeText(q)), ilike(eventChatMessages.rsn, likeText(q)))!);
  return db
    .select(LINE_COLUMNS)
    .from(eventChatMessages)
    .where(and(...where))
    .orderBy(desc(eventChatMessages.id))
    .limit(Math.min(Math.max(opts.limit ?? 200, 1), 500));
}

/** The timeouts still running and the bans not yet lifted, newest first. */
export async function chatSanctions(access: ChatAccess, viewerUserId: number, now = Date.now()): Promise<ModSanction[]> {
  const rows = await db
    .select({
      userId: eventChatMutes.userId,
      kind: eventChatMutes.kind,
      until: eventChatMutes.until,
      reason: eventChatMutes.reason,
      byUserId: eventChatMutes.byUserId,
      createdAt: eventChatMutes.createdAt,
      displayName: users.displayName,
    })
    .from(eventChatMutes)
    .innerJoin(users, eq(users.id, eventChatMutes.userId))
    .where(eq(eventChatMutes.eventId, access.eventId))
    .orderBy(desc(eventChatMutes.createdAt));
  const live = rows.filter((r) => sanctionBlock(r, now, parseStamp));
  if (!live.length) return [];
  const ids = [...new Set(live.flatMap((r) => [r.userId, r.byUserId]).filter((x): x is number => x != null))];
  const [names, lastSaid] = await Promise.all([
    db.select({ id: users.id, name: users.displayName }).from(users).where(inArray(users.id, ids)),
    // The name they talk under on this board, which is what a moderator saw.
    db
      .select({ userId: eventChatMessages.userId, rsn: sql<string>`max(${eventChatMessages.rsn})` })
      .from(eventChatMessages)
      .where(and(eq(eventChatMessages.eventId, access.eventId), inArray(eventChatMessages.userId, live.map((r) => r.userId))))
      .groupBy(eventChatMessages.userId),
  ]);
  const nameOf = new Map(names.map((n) => [n.id, n.name]));
  const rsnOf = new Map(lastSaid.map((l) => [l.userId, l.rsn]));
  const ranks = await ranksIn(access, live.map((r) => r.userId));
  return live.map((r) => {
    const block = sanctionBlock(r, now, parseStamp)!;
    return {
      userId: r.userId,
      name: rsnOf.get(r.userId) ?? r.displayName ?? 'Player',
      kind: block.kind,
      until: block.kind === 'timeout' ? r.until : null,
      reason: r.reason,
      byName: r.byUserId != null ? (nameOf.get(r.byUserId) ?? null) : null,
      createdAt: r.createdAt,
      canLift: r.userId !== viewerUserId && canSanction(access.rank, ranks.get(r.userId) ?? 0),
    };
  });
}

/**
 * Of these people, the ones this viewer may time out or ban (they outrank them). Deleting follows the
 * same rule, plus the viewer's own lines.
 */
export async function sanctionableUsers(access: ChatAccess, viewerUserId: number, userIds: number[]): Promise<Set<number>> {
  const ranks = await ranksIn(access, userIds);
  return new Set([...ranks].filter(([u, r]) => u !== viewerUserId && canSanction(access.rank, r)).map(([u]) => u));
}

/** The plugin's right-click on a line: ban its sender from this board's chat until lifted. */
export async function muteChat(access: ChatAccess, byUserId: number, id: number): Promise<SendResult> {
  if (!access.staff) return { ok: false, error: 'Only the host and mods can do that.' };
  const line = await lineOf(access.eventId, id);
  if (!line || !(await mayRead(access, (line.channel as ChatChannel) ?? 'all'))) return { ok: false, error: 'That message is gone.' };
  return sanctionChat(access, byUserId, line.userId, { kind: 'ban' });
}

export async function pauseChat(access: ChatAccess, paused: boolean, byUserId?: number): Promise<SendResult> {
  if (!access.staff) return { ok: false, error: 'Only the host and mods can do that.' };
  await setEventChatPaused(access.eventId, paused, byUserId != null ? { clanId: access.clanId, byUserId } : undefined);
  return { ok: true };
}

/**
 * Pause or resume: every open chat box on the board greys out (or reopens) at once. `by`: who did it,
 * for the host clan's audit log. A timed-out or banned person's box keeps its own lock on resume:
 * the board-wide unlock reaches them too, but sendChat still refuses them with the reason, and their
 * pane redraws locked on the next load.
 */
export async function setEventChatPaused(eventId: number, paused: boolean, by?: { clanId: number; byUserId: number }): Promise<void> {
  await db.update(events).set({ chatPaused: paused }).where(eq(events.id, eventId));
  await notifyRows({ e: eventId }, lockPush(chatLockFeeds(eventId, 'talk'), paused ? { locked: 'The host has paused chat.' } : null));
  // The board's room took the pause, staff included; they keep talking, so their boxes reopen after it.
  if (paused) {
    const staff = await eventStaffUserIds(eventId);
    if (staff.length) await notifyRows({ u: staff }, lockPush(chatLockFeeds(eventId, 'talk'), null));
  }
  if (by) {
    await db
      .insert(clanAuditLog)
      .values({ clanId: by.clanId, eventType: paused ? 'event_chat_paused' : 'event_chat_resumed', actorUserId: by.byUserId, newValue: JSON.stringify({ eventId }) })
      .catch(() => {});
  }
}

/** The host's switch (admin events page). Turning it off closes every open chat pane at once. */
export async function setEventChat(eventId: number, enabled: boolean): Promise<void> {
  await db.update(events).set({ chatEnabled: enabled, ...(enabled ? {} : { chatPaused: false }) }).where(eq(events.id, eventId));
  if (!enabled) await notifyRows({ e: eventId }, lockPush(chatLockFeeds(eventId, 'every'), { locked: 'The host turned chat off.' }));
}

/**
 * Timeouts that have run out: the row goes and the person's open chat boxes unlock (or show the
 * board's pause), so nobody sits behind a stale "timed out" line. Runs every minute with the event
 * lifecycle tick; the delete names the expiry it read, so a fresh timeout set meanwhile survives.
 */
export async function sweepExpiredChatTimeouts(now = Date.now()): Promise<number> {
  try {
    const due = await db
      .select({ eventId: eventChatMutes.eventId, userId: eventChatMutes.userId, until: eventChatMutes.until, paused: events.chatPaused, clanId: events.clanId })
      .from(eventChatMutes)
      .innerJoin(events, eq(events.id, eventChatMutes.eventId))
      // clan-scope: global -- expiry housekeeping across every clan's boards
      .where(and(eq(eventChatMutes.kind, 'timeout'), lt(eventChatMutes.until, stampOf(now + 1_000))))
      .limit(500);
    let done = 0;
    for (const d of due) {
      const gone = await db
        .delete(eventChatMutes)
        .where(and(eq(eventChatMutes.eventId, d.eventId), eq(eventChatMutes.userId, d.userId), eq(eventChatMutes.kind, 'timeout'), eq(eventChatMutes.until, d.until!)))
        .returning({ userId: eventChatMutes.userId });
      if (!gone.length) continue;
      const grant = await clanGrant(d.clanId, d.userId).catch(() => null);
      const staff = !!grant && atLeast(grant.role, 'moderator');
      await notifyReopen(d.eventId, d.userId, d.paused, staff);
      done++;
    }
    return done;
  } catch (err) {
    log.warn('event-chat.timeout-sweep-failed', { message: (err as Error).message });
    return 0;
  }
}

/** Drop chat from events that ended more than KEEP_DAYS ago. Runs with the event lifecycle sweep. */
export async function sweepEventChat(now = Date.now()): Promise<void> {
  const cutoff = new Date(now - KEEP_DAYS * 86_400_000).toISOString().slice(0, 19).replace('T', ' ');
  try {
    await db.execute(sql`
      delete from ${eventChatMessages} m using ${events} e
      where m.event_id = e.id and e.end_date is not null and replace(e.end_date, 'T', ' ') < ${cutoff}`);
    await db.delete(eventChatMutes).where(
      // clan-scope: global -- retention spans every clan's finished boards
      inArray(eventChatMutes.eventId, db.select({ id: events.id }).from(events).where(lt(sql`replace(${events.endDate}, 'T', ' ')`, cutoff))),
    );
  } catch (err) {
    log.warn('event-chat.sweep-failed', { message: (err as Error).message });
  }
}
