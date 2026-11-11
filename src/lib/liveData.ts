// The website's Feed & chat page (app/events/[eventId]/live) and its API (api/events/[id]/live/*):
// the plugin panel's board Feed and chat, for players on a phone or away from the game.
//
// Nothing here is a second chat. Who's in is lib/eventChat chatAccess; the channel switch, unread
// counts and lock are the panel's own (lib/pluginUi/feedView chatPaneState); a line sent here goes
// through the same runChatAct → sendChat as the plugin's, so it is the same row and the same push to
// every open RuneLite panel. The Feed is the panel's list (lib/pluginUi/feedLists eventFeedList).
//
// IDENTITY. The page is signed in with the website's Discord session (lib/auth verifyUser), which
// names a login; chatAccess takes that login and, for someone with two characters seated on the
// board, which one is speaking (ChatSeatPick.participantId). The page offers a "Speaking as" pick
// among their own seats only; anything else falls back to their first seat, as the site always has.

import { and, count, eq, inArray, max } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, completions, eventChatMessages, eventChatMutes, eventParticipants, events, momentReactions, moments, teams, tiles, users } from '@/db/schema';
import { normalizeRsn } from '@/lib/auth';
import { chatAccess, markChannelRead, myChatNames, platformChatOn, type ChatAccess } from '@/lib/eventChat';
import { MAX_BODY, ownTeamChatLabel, parseChannel, type ChatLock } from '@/lib/eventChatRules';
import { completionAt } from '@/lib/panelRows';
import { eventFeedList } from '@/lib/pluginUi/feedLists';
import { feedFilterChips } from '@/lib/pluginUi/feedUi';
import { CHAT_ACT_LIMIT, chatBoxPrompt, chatPaceFor, chatPaneF, chatPaneState, runChatAct, type ChatActName } from '@/lib/pluginUi/feedView';
import { cachedPulseToken } from '@/lib/pulseCache';
import { rateLimit } from '@/lib/rate-limit';
import { siteReactions, type SiteReactions } from '@/lib/siteReactions';
import { standingsHidden } from '@/lib/standingsVisibility';
import { supporterInksForRsns } from '@/lib/supporter';
import { inkForSurface, type SupporterInk } from '@/lib/supporterStyle';
import { chanKey, feedCount, type LiveChanKey, type LiveChatLine, type LiveFeedRow } from '@/lib/liveView';
import { liveChatLine, liveEmptyLine, liveMomentRow, liveTileRow } from '@/lib/liveRows';
import { liveTicketScope } from '@/lib/liveTicket';
import { MAX_TICKET_TEAMS, type PushScope } from '@/lib/push/ticket';

// ── Who's asking ────────────────────────────────────────────────────────────────────────────────

/** One of the viewer's own seats on the board, for "Speaking as". */
export interface LiveSeat {
  id: number;
  name: string;
  team: string | null;
}

/** The viewer's seats on this board (any of their characters), first seat first. */
export async function mySeats(eventId: number, userId: number): Promise<LiveSeat[]> {
  // clan-scope: global -- the subject is the viewer's own seats on one board the caller already scoped.
  const rows = await db
    .select({ id: eventParticipants.id, name: eventParticipants.name, team: teams.name })
    .from(eventParticipants)
    .innerJoin(accounts, eq(accounts.id, eventParticipants.accountId))
    .innerJoin(users, eq(users.playerId, accounts.playerId))
    .leftJoin(teams, eq(teams.id, eventParticipants.teamId))
    .where(and(eq(eventParticipants.eventId, eventId), eq(users.id, userId)))
    .orderBy(eventParticipants.id);
  return rows.map((r) => ({ id: r.id, name: r.name, team: r.team ?? null }));
}

/**
 * chatAccess for a website visitor: their login, speaking as the seat they picked when it is one of
 * their own (else their first, as chatAccess does with no pick).
 */
export async function liveAccess(eventId: number, userId: number, seatRaw?: unknown): Promise<{ access: ChatAccess | null; seats: LiveSeat[]; seatId: number | null }> {
  const seats = await mySeats(eventId, userId);
  const wanted = Number(seatRaw);
  const seat = seats.find((s) => s.id === wanted) ?? seats[0] ?? null;
  const access = await chatAccess(eventId, userId, seat && seats.length > 1 ? { participantId: seat.id } : null);
  return { access, seats, seatId: seat?.id ?? null };
}

// ── The chat ────────────────────────────────────────────────────────────────────────────────────

export interface LiveChatState {
  open: boolean;
  closedWhy: string | null;
  paused: boolean;
  staff: boolean;
  /** The open channel ('all' | 'announce' | 'team:<id>'). */
  channel: string;
  channels: { key: LiveChanKey; channel: string; label: string; n: number; on: boolean }[];
  /** The team a staff member's team segment opens. */
  team: number | null;
  teamPicks: { id: number; name: string; on: boolean }[] | null;
  /** "Only my team's chat", for event staff who play on a team: what pressing it does. */
  ownTeam: { on: boolean; label: string; tip: string } | null;
  /** In place of the message box: a timeout or ban (warn), a read-only channel, the pause. */
  lock: ChatLock | null;
  /** The box's placeholder, and the pace line under it (chatPaceHint). */
  prompt: string;
  pace: string;
  max: number;
  /** Newest first, as the chat engine reads them. */
  lines: LiveChatLine[];
  /** What the channel says while it's empty (the panel's words). */
  empty: string;
  /** The names the viewer's own lines carry. */
  mine: string[];
}

/** The chat pane for the website: the plugin's chatPaneState, as plain data. Marks the open channel read. */
export async function liveChat(access: ChatAccess, userId: number, args: { f?: string; tm?: string; rd?: string }): Promise<LiveChatState> {
  const base = { open: access.open, closedWhy: access.closedWhy, paused: access.paused, staff: access.staff, max: MAX_BODY };
  if (!access.open) {
    return { ...base, channel: 'all', channels: [], team: null, teamPicks: null, ownTeam: null, lock: null, prompt: '', pace: '', lines: [], empty: '', mine: [] };
  }
  const st = await chatPaneState(access, userId, access.eventId, args);
  // The open channel counts as read: what's on screen shouldn't light the event page's unread dot.
  const [pace, mine] = await Promise.all([
    chatPaceFor(access, userId, access.eventId),
    myChatNames(userId),
    markChannelRead(access.eventId, userId, st.channel),
  ]);
  return {
    ...base,
    channel: st.channel,
    channels: st.channels.map((c) => ({ key: chanKey(c.ch), channel: c.ch, label: c.label, n: c.n, on: c.ch === st.channel })),
    team: st.myTeam,
    teamPicks: st.teamPicks,
    ownTeam: st.ownTeamOffered ? { on: access.ownTeamOnly, ...ownTeamChatLabel(access.ownTeamOnly) } : null,
    lock: st.lock,
    prompt: chatBoxPrompt(st.channel),
    pace,
    lines: st.rows.map(liveChatLine).filter((l): l is LiveChatLine => l != null),
    empty: liveEmptyLine('chat', chatPaneF(st.channel)),
    mine,
  };
}

export type LiveActResult = { ok: true } | { ok: false; error: string; status: number };

/**
 * A chat action from the website: send, delete, mute, "Only my team's chat", pause. The same rate
 * limit as the plugin (one budget per person across both), then the plugin's own runChatAct.
 */
export async function liveChatAct(request: Request, access: ChatAccess, userId: number, body: Record<string, unknown> | null): Promise<LiveActResult> {
  const action = body?.action;
  const acts: Record<string, ChatActName> = { send: 'chat-send', delete: 'chat-del', mute: 'chat-mute', 'own-team': 'chat-own-team', pause: 'chat-pause' };
  const act = typeof action === 'string' ? acts[action] : undefined;
  if (!act) return { ok: false, error: 'Unknown action', status: 400 };
  if (!access.member) return { ok: false, error: 'Only this event’s players can use its chat.', status: 403 };
  const rl = await rateLimit(request, `event-chat:${userId}`, CHAT_ACT_LIMIT);
  if (!rl.ok) return { ok: false, error: 'Slow down a little.', status: 429 };
  const to = typeof body?.to === 'string' ? body.to : '';
  const a: Record<string, string> = {
    e: String(access.eventId),
    // 'team' (their own) or a channel; anything else is All teams, as the plugin reads it.
    to: to === 'team' ? 'team' : (parseChannel(to) ?? 'all'),
    id: String(Number(body?.id) || 0),
    on: body?.on === true ? '1' : '0',
  };
  const r = await runChatAct(access, userId, act, a, { msg: typeof body?.msg === 'string' ? body.msg : '' });
  return r.ok ? { ok: true } : { ok: false, error: r.error, status: 400 };
}

// ── The Feed ────────────────────────────────────────────────────────────────────────────────────

export interface LiveFeedState {
  filter: string;
  filters: { id: string; label: string }[];
  rows: LiveFeedRow[];
  /** What the list says while it's empty for this filter (the panel's words). */
  empty: string;
  more: boolean;
  reactions: SiteReactions | null;
}

/** A filter this viewer may ask for on this board, else 'all'. */
export function liveFilter(raw: unknown, teamId: number | null): string {
  const f = typeof raw === 'string' ? raw : 'all';
  return feedFilterChips('event', teamId).some(([id]) => id === f) ? f : 'all';
}

/**
 * A board's Feed for the website: the panel's list for the filter (newest first, runs collapsed,
 * hidden standings showing only the viewer's team), the first `n` rows, and their reactions.
 */
export async function liveFeed(access: ChatAccess, userId: number, rawFilter: unknown, rawCount: unknown): Promise<LiveFeedState> {
  const filter = liveFilter(rawFilter, access.teamId);
  const n = feedCount(rawCount);
  const { items, ev } = await eventFeedList(access.eventId, filter, access.teamId);
  const shown = items.slice(0, n);
  const list = shown.flatMap((i) => (i.m ? [i.m] : []));
  const own = (t: number | null) => access.teamId != null && t === access.teamId;
  const [inkSource, teamRows] = await Promise.all([
    list.length ? supporterInksForRsns(list.map((m) => m.rsn)).catch(() => new Map<string, SupporterInk>()) : Promise.resolve(new Map<string, SupporterInk>()),
    list.length ? db.select({ id: teams.id, name: teams.name, color: teams.color }).from(teams).where(eq(teams.eventId, access.eventId)) : Promise.resolve([]),
  ]);
  const teamById = new Map(teamRows.map((t) => [t.id, t]));
  const rows = shown.map((i) => {
    if (i.c) {
      const c = i.c;
      return liveTileRow({ tileId: c.tileId, teamId: c.teamId, label: c.label, who: c.who, team: { name: c.teamName, color: c.teamColor }, at: completionAt(c.at), mine: own(c.teamId) });
    }
    const m = i.m;
    const team = m.teamId != null ? teamById.get(m.teamId) : undefined;
    const source = inkSource.get(normalizeRsn(m.rsn));
    return liveMomentRow(
      { ...m, run: m.run ?? null },
      {
        mine: own(m.teamId),
        team: team ? { name: team.name, color: team.color } : null,
        ink: source ? { ...inkForSurface(source, 'dark'), glyph: 'glyph' in source ? (source.glyph as string) : null } : null,
      },
    );
  });
  // GZ / Sad / Sit: the site's own reactions (lib/siteReactions), the same rule as the panel's.
  const reactable = list.filter((m) => m.id > 0).map((m) => ({ id: m.id, kind: m.kind }));
  const reactions = ev && reactable.length ? await siteReactions(reactable, { eventId: access.eventId, hostClanId: ev.clanId }, userId) : null;
  return {
    filter,
    filters: feedFilterChips('event', access.teamId).map(([id, label]) => ({ id, label })),
    rows,
    empty: liveEmptyLine('feed', filter),
    more: items.length > n,
    reactions,
  };
}

// ── "Anything new?" ────────────────────────────────────────────────────────────────────────────
//
// The page polls this every few seconds while it's in view (304 when nothing moved, lib/httpEtag)
// and fetches the chat or the Feed only when its half changes. Both halves are made per board and
// shared by every viewer for a few seconds (lib/pulseCache), so a busy board costs one read per tick.

/** The chat's fingerprint: newest line, removals, sanctions, the switches. */
async function chatToken(eventId: number): Promise<string> {
  // clan-scope: global -- by the board id the caller scoped to this clan and admitted the viewer to.
  const [[lines], [mutes], ev, platformOn] = await Promise.all([
    db
      .select({ top: max(eventChatMessages.id), gone: count(eventChatMessages.deletedAt) })
      .from(eventChatMessages)
      .where(eq(eventChatMessages.eventId, eventId)),
    // clan-scope: global -- the same board's sanctions.
    db.select({ n: count(), last: max(eventChatMutes.createdAt) }).from(eventChatMutes).where(eq(eventChatMutes.eventId, eventId)),
    // clan-scope: global -- the same board's chat switches.
    db.query.events.findFirst({ where: eq(events.id, eventId), columns: { chatEnabled: true, chatPaused: true } }),
    platformChatOn(),
  ]);
  return [lines?.top ?? 0, lines?.gone ?? 0, mutes?.n ?? 0, mutes?.last ?? '', ev?.chatEnabled ? 1 : 0, ev?.chatPaused ? 1 : 0, platformOn ? 1 : 0].join('.');
}

/**
 * The Feed's fingerprint: moments, finished tiles and reactions. Behind hidden standings it counts
 * only the viewer's own team (`team`), so the page never learns when another team did something.
 */
async function feedToken(eventId: number, team: number | null): Promise<string> {
  const momentWhere = team != null ? and(eq(moments.eventId, eventId), eq(moments.teamId, team)) : eq(moments.eventId, eventId);
  const tileWhere = team != null ? and(eq(tiles.eventId, eventId), eq(completions.teamId, team)) : eq(tiles.eventId, eventId);
  const [[m], [c], [r], ev] = await Promise.all([
    // clan-scope: global -- by the board id the caller scoped to this clan and admitted the viewer to.
    db.select({ top: max(moments.id), n: count() }).from(moments).where(momentWhere),
    db.select({ n: count(), last: max(completions.completedAt) }).from(completions).innerJoin(tiles, eq(tiles.id, completions.tileId)).where(tileWhere),
    db
      .select({ top: max(momentReactions.id), n: count() })
      .from(momentReactions)
      .where(inArray(momentReactions.momentId, db.select({ id: moments.id }).from(moments).where(momentWhere))),
    // clan-scope: global -- the same board's reveal switch.
    db.query.events.findFirst({ where: eq(events.id, eventId), columns: { tilesRevealed: true } }),
  ]);
  return [m?.top ?? 0, m?.n ?? 0, c?.n ?? 0, c?.last ?? '', r?.top ?? 0, r?.n ?? 0, ev?.tilesRevealed ? 1 : 0].join('.');
}

/** Both halves for this viewer: `c` the chat, `f` the Feed. */
export async function livePulse(access: ChatAccess): Promise<{ c: string; f: string }> {
  const eventId = access.eventId;
  // clan-scope: global -- the board chatAccess just admitted the viewer to.
  const ev = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  const hidden = ev ? standingsHidden(ev) : false;
  const [c, f] = await Promise.all([
    cachedPulseToken(`live-chat:${eventId}`, () => chatToken(eventId)),
    !hidden
      ? cachedPulseToken(`live-feed:${eventId}`, () => feedToken(eventId, null))
      : access.teamId != null
        ? cachedPulseToken(`live-feed:${eventId}:team:${access.teamId}`, () => feedToken(eventId, access.teamId))
        : // No team behind the curtain: the panel's list shows them nothing, so nothing moves.
          Promise.resolve('none'),
  ]);
  // The curtain lifting changes the token by itself, and every open page refetches the full list.
  return { c, f: `${hidden ? 'h' : 'o'}|${f}` };
}

// ── The push socket ────────────────────────────────────────────────────────────────────────────

/** What this viewer's push ticket grants (lib/liveTicket), or null when they may not read the board. */
export async function liveTicket(access: ChatAccess | null, userId: number): Promise<PushScope | null> {
  if (!access?.member) return null;
  // clan-scope: global -- the board chatAccess just admitted the viewer to.
  const [ev, teamRows] = await Promise.all([
    db.query.events.findFirst({ where: eq(events.id, access.eventId) }),
    db.select({ id: teams.id }).from(teams).where(eq(teams.eventId, access.eventId)).orderBy(teams.id).limit(MAX_TICKET_TEAMS + 1),
  ]);
  if (!ev) return null;
  return liveTicketScope(access, userId, { teamIds: teamRows.map((t) => t.id), hidden: standingsHidden(ev) });
}
