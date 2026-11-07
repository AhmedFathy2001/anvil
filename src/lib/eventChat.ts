// The event chat: one private channel per board, for its participants and the host's staff, shown in
// the plugin's Feed tab (view 'feed', pane 'chat'). Lines travel as panel rows (lib/panelRows) to the
// board's room on the push socket — one NOTIFY per message however many are listening.
//
// Three switches, any of which closes it: staff's platform switch (event_chat_enabled), the host's
// per-event `chat_enabled`, and the host's `chat_paused` (read-only at once). The rules for what may be
// said and how fast are pure, in lib/eventChatRules.

import { and, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, eventChatMessages, eventChatMutes, eventParticipants, events, teams, users } from '@/db/schema';
import { normalizeRsn } from '@/lib/auth';
import { clanGrant, platformRoleOf } from '@/lib/clanGrants';
import { atLeast, hasPlatformRole } from '@/lib/clanRoles';
import { parseStamp } from '@/lib/dbTime';
import {
  KEEP_DAYS,
  checkBody,
  cleanName,
  BURST_MAX,
  BURST_WINDOW_MS,
  isSlow,
  muteActive,
  personGapMs,
  newPace,
  recordSend,
  waitFor,
  type BoardPace,
} from '@/lib/eventChatRules';
import { log } from '@/lib/logger';
import { notifyRows, teamUserIds } from '@/lib/panelRows';
import { getPlatformSetting, setPlatformSetting } from '@/lib/platformSettings';
import { chatFeedIds, chatRow, type ChatRowOptions } from '@/lib/pluginUi/feedUi';
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

export async function setPlatformChat(on: boolean): Promise<void> {
  await setPlatformSetting(EVENT_CHAT_PLATFORM_KEY, on ? 'true' : 'false');
  platformCache = null;
  // Every board with chat on hears it at once: open chat boxes grey out (or reopen).
  // clan-scope: global -- the platform switch reaches every board with chat on, across clans
  const boards = await db.select({ id: events.id, paused: events.chatPaused }).from(events).where(eq(events.chatEnabled, true));
  for (const b of boards) {
    const locked = !on ? 'Event chat is switched off on Anvil right now.' : b.paused ? 'The host has paused chat.' : null;
    await notifyRows({ e: b.id }, { t: 'rowslock', feeds: [`chat:${b.id}`], locked });
  }
}

// ── Who's in ─────────────────────────────────────────────────────────────────────────────────────

export interface ChatAccess {
  eventId: number;
  /** The board has chat at all (platform + host), paused or not. */
  open: boolean;
  paused: boolean;
  /** Why it's closed, for the line under the list. */
  closedWhy: string | null;
  /** May read: a participant, or the host's staff. */
  member: boolean;
  staff: boolean;
  role: 'host' | 'mod' | null;
  teamId: number | null;
  rsn: string | null;
  /** How many seats this person holds on the board: with more than one, "mine" is by character. */
  seats: number;
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
): Promise<{ teamId: number | null; rsn: string; seats: number } | null> {
  const seats = await db
    .select({
      id: eventParticipants.id,
      teamId: eventParticipants.teamId,
      name: eventParticipants.name,
      accountHash: accounts.accountHash,
      rsnNormalized: accounts.rsnNormalized,
    })
    .from(eventParticipants)
    .innerJoin(accounts, eq(accounts.id, eventParticipants.accountId))
    .innerJoin(users, eq(users.playerId, accounts.playerId))
    .where(and(eq(eventParticipants.eventId, eventId), eq(users.id, userId)))
    .orderBy(eventParticipants.id);
  const seat = pickSeat(seats, pick);
  return seat ? { teamId: seat.teamId, rsn: seat.name, seats: seats.length } : null;
}

/**
 * `pick` names the character asking (see ChatSeatPick): a person with two characters seated on the
 * board, one per client, speaks — and reads their team's lines — as the one that sent the request.
 */
export async function chatAccess(eventId: number, userId: number, pick?: ChatSeatPick | null): Promise<ChatAccess | null> {
  const ev = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    columns: { id: true, clanId: true, chatEnabled: true, chatPaused: true },
  });
  if (!ev) return null;
  const [platformOn, part, grant, platformRole] = await Promise.all([
    platformChatOn(),
    participantOf(eventId, userId, pick),
    clanGrant(ev.clanId, userId),
    platformRoleOf(userId),
  ]);
  const clanStaff = grant != null && atLeast(grant.role, 'moderator');
  const staff = clanStaff || hasPlatformRole(platformRole, 'staff');
  const role = grant && atLeast(grant.role, 'admin') ? 'host' : clanStaff ? 'mod' : null;
  const open = platformOn && ev.chatEnabled;
  return {
    eventId,
    open,
    paused: ev.chatPaused,
    closedWhy: !platformOn ? 'Event chat is switched off on Anvil right now.' : !ev.chatEnabled ? 'The host hasn’t turned chat on for this event.' : null,
    member: part != null || staff,
    staff,
    role,
    teamId: part?.teamId ?? null,
    rsn: part?.rsn ?? null,
    seats: part?.seats ?? 0,
  };
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
  viewer: { userId: number; staff: boolean; rsn?: string | null } | null,
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
      ...(ink ? { whoColor: ink.color as Color, ...(ink.grad ? { grad: ink.grad as `#${string}`[], ...(ink.move ? { move: true } : {}) } : {}) } : {}),
      modActions: viewer?.staff && viewer.userId !== l.userId ? { del: modAct(eventId, l.id, 'chat-del'), mute: modAct(eventId, l.id, 'chat-mute') } : null,
    };
    return chatRow({ id: l.id, rsn: l.rsn, body: l.body, teamOnly: l.teamOnly, createdAt: l.createdAt }, o);
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
  fromStaff: eventChatMessages.fromStaff,
  createdAt: eventChatMessages.createdAt,
};

/** The latest lines for one filter, newest first: everyone's, one team's, or the host's staff's. */
export async function chatHistory(
  access: ChatAccess,
  viewerUserId: number,
  filter: 'all' | 'team' | 'mods',
  limit = 100,
): Promise<FeedRow[]> {
  const where = [eq(eventChatMessages.eventId, access.eventId), isNull(eventChatMessages.deletedAt)];
  if (filter === 'team' && access.teamId != null) where.push(eq(eventChatMessages.teamId, access.teamId));
  else if (filter === 'mods') where.push(eq(eventChatMessages.fromStaff, true), eq(eventChatMessages.teamOnly, false));
  else where.push(eq(eventChatMessages.teamOnly, false));
  const lines = await db.select(LINE_COLUMNS).from(eventChatMessages).where(and(...where)).orderBy(desc(eventChatMessages.id)).limit(limit);
  return rowsFor(access.eventId, lines, { userId: viewerUserId, staff: access.staff, rsn: access.seats > 1 ? access.rsn : null });
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

export async function sendChat(access: ChatAccess, userId: number, raw: string, teamOnly: boolean, now = Date.now()): Promise<SendResult> {
  if (!access.member) return { ok: false, error: 'Only this event’s players can chat here.' };
  if (!access.open) return { ok: false, error: access.closedWhy ?? 'Chat is off.' };
  if (access.paused && !access.staff) return { ok: false, error: 'The host has paused chat.' };
  if (teamOnly && access.teamId == null) return { ok: false, error: 'You’re not on a team yet.' };

  const checked = checkBody(raw, { staff: access.staff });
  if (!checked.ok) return { ok: false, error: checked.reason };

  const mute = await db.query.eventChatMutes.findFirst({
    where: and(eq(eventChatMutes.eventId, access.eventId), eq(eventChatMutes.userId, userId)),
  });
  if (mute && muteActive(mute.until, now, parseStamp)) return { ok: false, error: 'You’re muted in this event’s chat.' };

  const pace = paceOf(access.eventId);
  const key = `${access.eventId}:${userId}`;
  // Their own pace follows their Supporter tier (lib/eventChatRules personGapMs); staff never wait.
  const tier = access.staff ? null : ((await supporterForUser(userId).catch(() => null))?.tier.id ?? null);
  const wait = waitFor(lastSent.get(key), now, isSlow(pace, now), access.staff, personGapMs(tier));
  if (wait > 0) return { ok: false, error: `Slow mode — wait ${Math.ceil(wait / 1000)}s.` };
  // A flood guard for everyone, Patrons included: no more than BURST_MAX lines in BURST_WINDOW_MS.
  if (!access.staff) {
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
    .values({ eventId: access.eventId, teamId: access.teamId, teamOnly, userId, fromStaff: access.staff, rsn, body: checked.body })
    .returning(LINE_COLUMNS);
  // Pushed rows carry no "mine" and no mod menu: those are per viewer, and the same text goes to all.
  const [row] = await rowsFor(access.eventId, [line], null);
  const feeds = chatFeedIds(access.eventId, { teamId: line.teamId, teamOnly, staff: line.fromStaff });
  await notifyRows(teamOnly ? { u: await teamUserIds(line.teamId!) } : { e: access.eventId }, { t: 'rows', feeds, rows: [row] });
  return { ok: true };
}

// ── The host's staff ─────────────────────────────────────────────────────────────────────────────

async function lineOf(eventId: number, id: number) {
  return db.query.eventChatMessages.findFirst({ where: and(eq(eventChatMessages.id, id), eq(eventChatMessages.eventId, eventId)) });
}

export async function deleteChat(access: ChatAccess, byUserId: number, id: number): Promise<SendResult> {
  if (!access.staff) return { ok: false, error: 'Only the host and mods can do that.' };
  const line = await lineOf(access.eventId, id);
  if (!line) return { ok: false, error: 'That message is gone.' };
  await db
    .update(eventChatMessages)
    .set({ deletedAt: sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`, deletedBy: byUserId })
    .where(eq(eventChatMessages.id, id));
  const feeds = chatFeedIds(access.eventId, { teamId: line.teamId, teamOnly: line.teamOnly, staff: line.fromStaff });
  await notifyRows({ e: access.eventId }, { t: 'rowsdel', feeds, ids: [`c${id}`] });
  return { ok: true };
}

/** Mute a line's sender for the rest of the event (staff can't be muted). */
export async function muteChat(access: ChatAccess, byUserId: number, id: number): Promise<SendResult> {
  if (!access.staff) return { ok: false, error: 'Only the host and mods can do that.' };
  const line = await lineOf(access.eventId, id);
  if (!line) return { ok: false, error: 'That message is gone.' };
  if (line.fromStaff) return { ok: false, error: 'Staff can’t be muted here.' };
  await db
    .insert(eventChatMutes)
    .values({ eventId: access.eventId, userId: line.userId, byUserId, until: null })
    .onConflictDoUpdate({ target: [eventChatMutes.eventId, eventChatMutes.userId], set: { until: null, byUserId } });
  return { ok: true };
}

export async function pauseChat(access: ChatAccess, paused: boolean): Promise<SendResult> {
  if (!access.staff) return { ok: false, error: 'Only the host and mods can do that.' };
  await setEventChatPaused(access.eventId, paused);
  return { ok: true };
}

/** Pause or resume: every open chat box on the board greys out (or reopens) at once. */
export async function setEventChatPaused(eventId: number, paused: boolean): Promise<void> {
  await db.update(events).set({ chatPaused: paused }).where(eq(events.id, eventId));
  await notifyRows({ e: eventId }, { t: 'rowslock', feeds: [`chat:${eventId}`], locked: paused ? 'The host has paused chat.' : null });
}

/** The host's switch (admin events page). Turning it off closes every open chat pane at once. */
export async function setEventChat(eventId: number, enabled: boolean): Promise<void> {
  await db.update(events).set({ chatEnabled: enabled, ...(enabled ? {} : { chatPaused: false }) }).where(eq(events.id, eventId));
  if (!enabled) await notifyRows({ e: eventId }, { t: 'rowslock', feeds: [`chat:${eventId}`], locked: 'The host turned chat off.' });
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
