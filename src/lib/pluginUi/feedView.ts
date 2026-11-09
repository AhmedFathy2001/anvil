import { and, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships, clans, eventParticipants, events, teams, users } from '@/db/schema';
import { completionAt } from '@/lib/panelRows';
import { normalizeRsn, pluginRsnHintOnly, pluginViewerRsn, resolvePluginClan, verifyPluginToken, verifyPluginTokenUser } from '@/lib/auth';
import { boardChatSlow, chatBlockOf, myChatNames, chatAccess, chatHistory, chatUnread, deleteChat, markChannelRead, mayRead, muteChat, pauseChat, sendChat, setOwnTeamChat, type ChatAccess, type ChatSeatPick, type ChatTarget, type SendResult } from '@/lib/eventChat';
import { canChooseOwnTeamChat, chatPaceHint, lockFor, parseChannel, type ChatChannel, type ChatLock } from '@/lib/eventChatRules';
import { NO_REACTIONS, isClanMember, reactionSummaries, reactorNames, tallyOf } from '@/lib/momentReactions';
import { modeMomentModesForClan, modeMomentsForClan, recentModeMomentCount, type MomentRow } from '@/lib/momentsStore';
import type { WithRun } from '@/lib/feedRuns';
import { homeBoardForUser } from '@/lib/pluginHomeBoard';
import { rateLimit } from '@/lib/rate-limit';
import { supporterForUser, supporterInksForRsns } from '@/lib/supporter';
import { inkForSurface } from '@/lib/supporterStyle';
import { isCreatorSpace } from '@/lib/creatorSpaces';
import { clanBoostLevels } from '@/lib/clanBoosts';

import { hasPanelImages, visibleClan } from './load';
import { boardCompletions, clanFeedList, eventFeedList, groupOf, KINDS_OF } from './feedLists';
import { chatFeedId, completionRow, feedTabUi, momentRow, reactRowAction, type ChatChan, type RowReactKind, type Scope } from './feedUi';
import type { FeedRow, View } from './nodes';
import { backRow, col, eventName, gap, message, text } from './nodes';
import { mediaRevision } from './mediaRevision';

// The Feed tab's data (view 'feed') and the event chat's actions. The look is lib/pluginUi/feedUi.

type Args = Record<string, string>;

const OK: View = { ui: gap(0) };
const err = (s: string): View => ({ ui: text(s, 'error', { wrap: true }) });

/** The scopes this viewer can switch between: their clan, and the board they're playing on. */
async function scopesFor(request: Request, userId: number | null): Promise<Scope[]> {
  const resolved = await resolvePluginClan(request);
  // The same visibility check every other clan view makes (load.visibleClan), not just the token's say-so.
  const clan = resolved ? await visibleClan(request, resolved.slug) : null;
  const out: Scope[] = [];
  // A creator space has no clan feed of its own (no members whose drops it collects): its boards
  // are the feed, added below as event scopes. Only an in-game clan gets a "Clan · X" scope.
  if (clan && !isCreatorSpace(clan)) out.push({ kind: 'clan', id: clan.id, slug: clan.slug, name: clan.name, banner: !!clan.bannerUrl, logo: !!clan.logoUrl, mediaRevision: mediaRevision(clan.logoUrl, clan.bannerUrl) });
  const seat = clan ? await verifyPluginToken(request, { hintOnly: pluginRsnHintOnly(request) }).catch(() => null) : null;
  let eventId = seat?.eventId ?? null;
  if (eventId == null && clan && userId != null) eventId = (await homeBoardForUser(clan.id, userId).catch(() => null))?.eventId ?? null;
  if (eventId != null) {
    // clan-scope: this clan -- by id; the board came from the viewer's own seat or home board
    const ev = await db.query.events.findFirst({ where: eq(events.id, eventId), columns: { id: true, name: true } });
    if (ev) out.push({ kind: 'event', id: ev.id, name: ev.name });
  }
  if (userId != null) await addEverythingElse(request, out, userId);
  // Two boards with one name ("Lab" twice): the picker and the header tell them apart by id.
  const boards = out.filter((s) => s.kind === 'event');
  return out.map((s) => (s.kind === 'event' ? { ...s, name: eventName(boards, s) } : s));
}

/**
 * Every other clan the viewer is a member of, and every live board one of their characters is on,
 * after the clan and board the plugin is pointed at: someone in two clans, or on two boards at once,
 * can read (and chat in) any of them from the one dropdown. Each clan, and each board's clan, goes
 * through the same visibility gate as the plugin's own clan (load.visibleClan): a suspended or hidden
 * clan, or a board in one, never shows up here.
 */
async function addEverythingElse(request: Request, out: Scope[], userId: number): Promise<void> {
  const has = (k: 'clan' | 'event', id: number) => out.some((s) => s.kind === k && s.id === id);
  // clan-scope: global -- the subject is the viewer's own person; their seats span clans by design.
  const mine = await db
    .select({ accountId: accounts.id })
    .from(users)
    .innerJoin(accounts, eq(accounts.playerId, users.playerId))
    .where(eq(users.id, userId));
  const accountIds = mine.map((m) => m.accountId);
  if (!accountIds.length) return;
  // clan-scope: global -- the clans this viewer's own characters are members of.
  const clanRowsMine = await db
    .selectDistinct({ id: clans.id, slug: clans.slug, name: clans.name, bannerUrl: clans.bannerUrl, logoUrl: clans.logoUrl })
    .from(clanMemberships)
    .innerJoin(clans, eq(clans.id, clanMemberships.clanId))
    .where(and(inArray(clanMemberships.accountId, accountIds), eq(clanMemberships.kind, 'member'), isNull(clanMemberships.leftAt)));
  const seen = new Map<string, boolean>();
  const visible = async (slug: string) => {
    if (!seen.has(slug)) seen.set(slug, !!(await visibleClan(request, slug).catch(() => null)));
    return seen.get(slug)!;
  };
  for (const c of clanRowsMine) {
    if (!has('clan', c.id) && (await visible(c.slug))) out.push({ kind: 'clan', id: c.id, slug: c.slug, name: c.name, banner: !!c.bannerUrl, logo: !!c.logoUrl, mediaRevision: mediaRevision(c.logoUrl, c.bannerUrl) });
  }
  // clan-scope: global -- the boards this viewer's own characters are seated on, in any clan.
  const boards = await db
    .selectDistinct({
      id: events.id,
      name: events.name,
      startDate: events.startDate,
      endDate: events.endDate,
      forceEndedAt: events.forceEndedAt,
      clanSlug: clans.slug,
      clanStatus: clans.status,
      seatKind: clanMemberships.kind,
      seatEventId: clanMemberships.eventId,
    })
    .from(eventParticipants)
    .innerJoin(events, eq(events.id, eventParticipants.eventId))
    .innerJoin(clans, eq(clans.id, events.clanId))
    .leftJoin(clanMemberships, eq(clanMemberships.id, eventParticipants.clanMemberId))
    .where(inArray(eventParticipants.accountId, accountIds));
  const now = Date.now();
  const at = (s: string | null) => (s ? Date.parse(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`) : NaN);
  for (const b of boards) {
    const live = !b.forceEndedAt && !(at(b.startDate) > now) && !(at(b.endDate) <= now);
    // Entered on an event player's seat for THIS board: theirs to read even where the clan is hidden.
    const ownEventSeat = b.seatKind === 'event' && b.seatEventId === b.id && b.clanStatus !== 'suspended';
    if (live && !has('event', b.id) && (ownEventSeat || (await visible(b.clanSlug)))) out.push({ kind: 'event', id: b.id, name: b.name });
  }
}

function pick(scopes: Scope[], key: string | undefined): Scope | null {
  if (key) {
    const [kind, ref] = key.split(':');
    const hit = scopes.find((s) => (kind === 'clan' && s.kind === 'clan' && s.slug === ref) || (kind === 'event' && s.kind === 'event' && String(s.id) === ref));
    if (hit) return hit;
  }
  // A board you're on is the livelier place to land; else the clan.
  return scopes.find((s) => s.kind === 'event') ?? scopes[0] ?? null;
}

/** Rows the Feed draws at most; a collapsed run is one of them, so a run never eats the list. */
const ROW_CAP = 80;

async function clanRows(clan: Extract<Scope, { kind: 'clan' }>, filter: string, viewer: number | null): Promise<{ rows: FeedRow[]; floor: number }> {
  const { list: all, floor } = await clanFeedList(clan.id, filter);
  const list = all.slice(0, ROW_CAP);
  const member = viewer != null && (await isClanMember(viewer, clan.id));
  // Only a clanmate gets the chips, so only a clanmate is told who gave them. A collapsed run's
  // reactions are its newest moment's: that's the row's id.
  const [summaries, inks, who] = await Promise.all([
    reactionSummaries(list.map((m) => m.id), viewer),
    inksFor(list.map((m) => m.rsn)),
    member ? reactorNames(list.map((m) => m.id), { clanId: clan.id }) : Promise.resolve(null),
  ]);
  const rows = list.map((m) => {
    const s = summaries.get(m.id) ?? NO_REACTIONS;
    const reacts = member
      ? {
          tally: (k: RowReactKind) => tallyOf(s, k),
          act: (k: RowReactKind) => reactRowAction({ slug: clan.slug }, m.id, k),
          who: (k: RowReactKind) => who?.get(m.id)?.[k],
        }
      : undefined;
    return momentRow(asLike(m), { reacts, ink: inks.get(normalizeRsn(m.rsn)) });
  });
  return { rows, floor };
}

/** Supporters' name colours by normalised name; flair is decoration, so a failed read is none. */
async function inksFor(rsns: string[]) {
  if (!rsns.length) return new Map();
  const source = await supporterInksForRsns(rsns).catch(() => new Map());
  return new Map([...source].map(([name, ink]) => [name, inkForSurface(ink, 'dark')]));
}

function asLike(m: WithRun<MomentRow>) {
  return {
    id: m.id,
    rsn: m.rsn,
    kind: m.kind,
    itemId: m.itemId,
    itemName: m.itemName,
    quantity: m.quantity,
    valueGp: m.valueGp,
    source: m.source,
    teamId: m.teamId,
    occurredAt: m.occurredAt,
    tier: m.tier,
    sourceKind: m.sourceKind,
    worldMode: m.worldMode,
    worldModeLabel: m.worldModeLabel,
    ...(m.run ? { run: m.run } : {}),
  };
}

/** The separate-save list uses the same rows and reactions, but never the ordinary clan floor twice. */
async function clanModeRows(clan: Extract<Scope, { kind: 'clan' }>, filter: string, viewer: number | null, worldMode: string | null): Promise<FeedRow[]> {
  const g = groupOf(filter);
  const list = await modeMomentsForClan(clan.id, 80, g ? KINDS_OF[g] : undefined, worldMode);
  const member = viewer != null && (await isClanMember(viewer, clan.id));
  const [summaries, inks, who] = await Promise.all([
    reactionSummaries(list.map((m) => m.id), viewer),
    inksFor(list.map((m) => m.rsn)),
    member ? reactorNames(list.map((m) => m.id), { clanId: clan.id }) : Promise.resolve(null),
  ]);
  return list.map((m) => {
    const s = summaries.get(m.id) ?? NO_REACTIONS;
    const reacts = member
      ? {
          tally: (k: RowReactKind) => tallyOf(s, k),
          act: (k: RowReactKind) => reactRowAction({ slug: clan.slug }, m.id, k),
          who: (k: RowReactKind) => who?.get(m.id)?.[k],
        }
      : undefined;
    return momentRow(asLike(m), { reacts, ink: inks.get(normalizeRsn(m.rsn)) });
  });
}

/**
 * A board's feed. Everyone playing on it (`viewer` with `canReact`) can react to any row: a GZ on a
 * drop, pet or achievement, "Sad" / "Sit" on a death.
 */
async function eventRows(eventId: number, filter: string, teamId: number | null, viewer: number | null = null, canReact = false): Promise<{ rows: FeedRow[]; floor: number }> {
  const { items: all, floor, ev } = await eventFeedList(eventId, filter, teamId);
  const items = all.slice(0, ROW_CAP);
  const momentList = items.flatMap((i) => (i.m ? [i.m] : []));
  const own = (t: number | null) => teamId != null && t === teamId;
  // Names in a Supporter's colours, else their team's; the team under the name, as the live rows do.
  // A lab board's rows (negative ids) are no real moments: nothing to react to.
  const reactable = (m: MomentRow) => canReact && viewer != null && m.id > 0;
  const reactIds = momentList.filter(reactable).map((m) => m.id);
  const [inks, teamRows, summaries, who] = await Promise.all([
    inksFor(momentList.map((m) => m.rsn)),
    momentList.length ? db.select({ id: teams.id, name: teams.name, color: teams.color }).from(teams).where(eq(teams.eventId, eventId)) : Promise.resolve([]),
    reactionSummaries(reactIds, viewer),
    // Names as the reactors play on this board (else their seat in the host clan).
    ev && reactIds.length ? reactorNames(reactIds, { eventId, hostClanId: ev.clanId }) : Promise.resolve(null),
  ]);
  const teamById = new Map(teamRows.map((t) => [t.id, t]));
  const rows = items.map((i) => {
    if (i.c) {
      const c = i.c;
      return completionRow({ tileId: c.tileId, teamId: c.teamId, label: c.label, who: c.who, team: { name: c.teamName, color: c.teamColor }, at: completionAt(c.at), mine: own(c.teamId) });
    }
    const m = i.m;
    const team = m.teamId != null ? teamById.get(m.teamId) : undefined;
    const s = summaries.get(m.id) ?? NO_REACTIONS;
    const reacts = reactable(m)
      ? {
          tally: (k: RowReactKind) => tallyOf(s, k),
          act: (k: RowReactKind) => reactRowAction({ e: eventId }, m.id, k),
          who: (k: RowReactKind) => who?.get(m.id)?.[k],
        }
      : undefined;
    return momentRow(asLike(m), { mine: own(m.teamId), team: team ? { name: team.name, color: team.color } : null, ink: inks.get(normalizeRsn(m.rsn)), reacts });
  });
  return { rows, floor };
}

/** A board's finished tiles, newest first (now in pluginUi/feedLists, kept here for its importers). */
export { boardCompletions };

/**
 * The character this plugin request is from, for the chat's seat (lib/eventChat ChatSeatPick). One
 * person signed in on two clients, each a character seated on another team of the same board, must
 * speak and read as the character in front of them. It only ever chooses among the person's OWN
 * seats, so the launcher hint and an unverified hash may take part: nothing is claimed or linked.
 */
export function chatCharacter(request: Request): ChatSeatPick {
  return {
    rsn: pluginViewerRsn(request),
    accountHash: pluginRsnHintOnly(request) ? null : request.headers.get('X-Account-Hash')?.trim() || null,
  };
}

/** A board's Feed & chat page on the website, at its host clan's address. */
async function boardWebPath(eventId: number): Promise<string | null> {
  // clan-scope: global -- by the board id the viewer's chatAccess just admitted them to; only its host's slug.
  const [row] = await db.select({ slug: clans.slug }).from(events).innerJoin(clans, eq(clans.id, events.clanId)).where(eq(events.id, eventId)).limit(1);
  return row ? `/c/${encodeURIComponent(row.slug)}/events/${eventId}/live` : null;
}

/** Opened from a board page on the Clan tab ("Feed" / "Chat" there): a way back over the feed. */
function withBack(a: Args, view: View): View {
  if (!a.back) return view;
  return { ...view, ui: col([backRow(a.backLabel || 'Back', { a: 'load', v: 'home', args: { open: a.back } }), gap(8), view.ui]) };
}

export async function feedView(request: Request, a: Args): Promise<View> {
  return withBack(a, await feedViewInner(request, a));
}

async function feedViewInner(request: Request, a: Args): Promise<View> {
  const viewer = await verifyPluginTokenUser(request);
  const scopes = await scopesFor(request, viewer?.userId ?? null);
  const clanScopes = scopes.filter((s): s is Extract<Scope, { kind: 'clan' }> => s.kind === 'clan');
  if (clanScopes.length) {
    const levels = await clanBoostLevels(clanScopes.map((s) => s.id)).catch(() => new Map());
    for (const scope of clanScopes) {
      const boost = levels.get(scope.id);
      scope.boostLevel = boost?.level ?? 0;
      scope.boostNameStyle = boost?.nameStyle ?? null;
    }
  }
  const current = pick(scopes, a.s);
  if (!current) return message('Sign in with the plugin and join a clan or an event to see its feed.');

  const access: ChatAccess | null = current.kind === 'event' && viewer ? await chatAccess(current.id, viewer.userId, chatCharacter(request)) : null;
  const chatAvailable = !!access && access.member && access.open;
  // Say why there's no Chat chip rather than leave it missing: off for the board, or not a player on it.
  const chatClosed = !access || chatAvailable ? null : !access.open ? access.closedWhy : 'Chat is for the players on this board.';
  const pane = a.p === 'chat' && chatAvailable ? 'chat' : 'feed';
  const modeActive = pane === 'feed' && a.m === '1' && current.kind === 'clan';
  const requestedFilter = a.f || 'all';
  const filter = modeActive && requestedFilter !== 'all' && !groupOf(requestedFilter) ? 'all' : requestedFilter;
  const teamId = access?.teamId ?? null;
  // The board's Feed & chat page on the website, for its players: at the host's address.
  const webPath = current.kind === 'event' && access?.member ? await boardWebPath(current.id) : null;

  if (pane === 'chat' && access && viewer) {
    const chat = await chatPane(access, viewer.userId, current.id, a);
    return {
      ui: feedTabUi({
        scopes,
        current,
        pane,
        chatAvailable,
        chatClosed,
        filter: chat.channel,
        teamId,
        rows: chat.rows,
        images: hasPanelImages(request),
        mine: await myChatNames(viewer.userId),
        chans: chat.chans,
        teamPicks: chat.teamPicks,
        ownTeam: chat.ownTeam,
        feedId: chatFeedId(current.id, chat.channel),
        send: {
          act: 'chat-send',
          args: { e: String(current.id), to: chat.channel },
          // The viewer's own pace (Supporter tier) or the board's slow mode, so nobody is surprised by it.
          hint: `${chatBoxPrompt(chat.channel)} · ${await chatPaceFor(access, viewer.userId, current.id)}`,
        },
        // In place of the message box: their own timeout or ban (coral, with how long is left), a
        // read-only Announcements, or the board's pause.
        lock: chat.lock,
        staff: access.staff,
        paused: access.paused,
        webPath,
      }),
    };
  }

  const [modeCount, modeOptions] = current.kind === 'clan'
    ? await Promise.all([recentModeMomentCount(current.id), modeActive ? modeMomentModesForClan(current.id) : Promise.resolve([])])
    : [0, []];
  const requestedMode = a.wm?.trim() || 'all';
  const selectedMode = requestedMode !== 'all' && modeOptions.some((m) => m.key === requestedMode) ? requestedMode : 'all';
  const data = modeActive
    ? { rows: await clanModeRows(current, filter, viewer?.userId ?? null, selectedMode === 'all' ? null : selectedMode), floor: 0 }
    : current.kind === 'clan'
      ? await clanRows(current, filter, viewer?.userId ?? null)
      : await eventRows(current.id, filter, teamId, viewer?.userId ?? null, !!access?.member);
  const { rows } = data;
  return {
    ui: feedTabUi({
      scopes,
      current,
      pane,
      chatAvailable,
      chatClosed,
      filter,
      teamId,
      rows,
      images: hasPanelImages(request),
      // No "Drops 5m+" floor line: the floor differs per clan, per mode and per user, so a single
      // number under the list was wrong for most of them.
      mode: current.kind === 'clan' ? { active: modeActive, count: modeCount, selected: selectedMode, options: modeOptions } : null,
      webPath,
    }),
  };
}

// ── The chat pane: My team | All teams | Announcements ─────────────────────────────────────────

/** Where the chat pane is: which channel, which team a staff member reads, the channel just left. */
export interface ChatPaneArgs {
  f?: string;
  tm?: string;
  rd?: string;
}

/**
 * The chat pane as data, for the plugin (chatPane) and the website's Feed & chat page alike: the open
 * channel and its rows, the switch's channels with unread counts, staff's team chips, the box's lock
 * and whether "Only my team's chat" is offered.
 */
export interface ChatPaneState {
  channel: ChatChannel;
  rows: FeedRow[];
  /** The switch, in order: the team channel (when there is one), All teams, Announcements. */
  channels: { ch: ChatChannel; label: string; n: number }[];
  /** The team whose channel the switch's team segment opens (staff pick any; a player has theirs). */
  myTeam: number | null;
  /** Staff on a team channel with more than one team: which team's, as chips. */
  teamPicks: { id: number; name: string; on: boolean }[] | null;
  lock: ChatLock | null;
  /** Event staff seated on a team: "Only my team's chat" is theirs to flip. */
  ownTeamOffered: boolean;
}

/**
 * Which channel is open and what the switch over it says. `f`: 'team' | 'all' | 'announce' ('mods',
 * from before channels, is Announcements); `tm`: the team a staff member reads (they read every
 * team's); `rd`: the channel just left, marked read to its newest line (lines arrived live there).
 * A solo board, or a player with no team, has no team segment.
 */
export async function chatPaneState(access: ChatAccess, userId: number, eventId: number, a: ChatPaneArgs): Promise<ChatPaneState> {
  // Staff read every team's channel, unless they play on a team and chose "Only my team's chat".
  const everyTeam = access.staff && !access.ownTeamOnly;
  const teamList = access.solo
    ? []
    : everyTeam
      ? await db.select({ id: teams.id, name: teams.name }).from(teams).where(eq(teams.eventId, eventId)).orderBy(teams.name)
      : [];
  const pickedTeam = Number(a.tm) || null;
  const myTeam: number | null = access.solo
    ? null
    : everyTeam
      ? (teamList.find((t) => t.id === pickedTeam)?.id ?? (access.teamId != null && teamList.some((t) => t.id === access.teamId) ? access.teamId : (teamList[0]?.id ?? null)))
      : access.teamId;
  const teamCh: ChatChannel | null = myTeam != null ? `team:${myTeam}` : null;
  const want = a.f === 'mods' ? 'announce' : a.f;
  const channel: ChatChannel = want === 'team' && teamCh ? teamCh : want === 'announce' ? 'announce' : 'all';

  const left = parseChannel(a.rd);
  if (left && left !== channel && (await mayRead(access, left))) await markChannelRead(eventId, userId, left);

  const all: ChatChannel[] = [...(teamCh ? [teamCh] : []), 'all', 'announce'];
  const [rows, block, unread] = await Promise.all([
    chatHistory(access, userId, channel),
    chatBlockOf(eventId, userId),
    chatUnread(access, userId, all.filter((c) => c !== channel)),
  ]);
  const channels = all.map((c) => ({
    ch: c,
    label: c === 'all' ? 'All teams' : c === 'announce' ? 'Announcements' : everyTeam && access.teamId !== myTeam ? 'Teams' : 'My team',
    n: unread.get(c) ?? 0,
  }));
  const teamPicks =
    everyTeam && channel.startsWith('team:') && teamList.length > 1 ? teamList.map((t) => ({ id: t.id, name: t.name, on: t.id === myTeam })) : null;
  const lock = lockFor(channel, { block, paused: access.paused, staff: access.staff, rank: access.rank });
  return { channel, rows, channels, myTeam, teamPicks, lock, ownTeamOffered: canChooseOwnTeamChat(access) };
}

/** The switch's `f` for a channel: 'team' for any team's, else the channel itself. */
export const chatPaneF = (ch: ChatChannel): string => (ch.startsWith('team:') ? 'team' : ch);

/** The words in the message box before anything is typed: who the line goes to. */
export function chatBoxPrompt(channel: ChatChannel): string {
  return channel.startsWith('team:') ? 'Message your team' : channel === 'announce' ? 'Announce to everyone' : 'Message all teams';
}

/** The pace line for this person (their Supporter tier, or the board's slow mode, or staff's exemption). */
export async function chatPaceFor(access: ChatAccess, userId: number, eventId: number): Promise<string> {
  return chatPaceHint({
    tier: access.staffKind === 'platform' ? null : ((await supporterForUser(userId).catch(() => null))?.tier.id ?? null),
    slow: boardChatSlow(eventId),
    staff: access.staffKind ?? false,
  });
}

/** The plugin's chat pane: chatPaneState with the switch's segments and chips as panel actions. */
export async function chatPane(access: ChatAccess, userId: number, eventId: number, a: Args) {
  const st = await chatPaneState(access, userId, eventId, a);
  const { channel, myTeam } = st;
  const go = (f: string, extra: Record<string, string> = {}) => ({
    a: 'load' as const,
    v: 'feed',
    args: { s: `event:${eventId}`, p: 'chat', f, rd: channel, ...extra },
  });
  const chans: ChatChan[] = st.channels.map(({ ch: c, label, n }) => ({
    label,
    on: c === channel,
    act: go(chatPaneF(c), c.startsWith('team:') && myTeam != null ? { tm: String(myTeam) } : {}),
    feed: chatFeedId(eventId, c),
    n,
    // All teams is the busy one: its count reads as info, the others' as gold.
    ...(c === 'all' ? { blue: true } : {}),
  }));
  // Staff on a team channel: which team's, as chips under the switch.
  const teamPicks = st.teamPicks ? st.teamPicks.map((t) => ({ label: t.name, on: t.on, act: go('team', { tm: String(t.id) }) })) : null;
  // Event staff seated on a team: the "Only my team's chat" switch, near the team chips.
  const f = chatPaneF(channel);
  const ownTeam = st.ownTeamOffered
    ? { on: access.ownTeamOnly, act: { a: 'post' as const, act: 'chat-own-team', args: { e: String(eventId), on: access.ownTeamOnly ? '0' : '1', s: `event:${eventId}`, f } } }
    : null;
  return { channel, rows: st.rows, chans, teamPicks, lock: st.lock, ownTeam };
}

// ── Actions (no redraw: the plugin reads an error line, or nothing) ─────────────────────────────

async function accessFor(request: Request, a: Args): Promise<{ access: ChatAccess; userId: number } | View> {
  const viewer = await verifyPluginTokenUser(request);
  const e = Number(a.e);
  if (!viewer || !Number.isInteger(e) || e <= 0) return err('Sign in with the plugin first.');
  const access = await chatAccess(e, viewer.userId, chatCharacter(request));
  if (!access || !access.member) return err('Only this event’s players can use its chat.');
  return { access, userId: viewer.userId };
}

/** A send's `to`: a channel, or 'team' (the sender's own) from a box drawn before channels. */
function sendTarget(to: string | undefined): ChatTarget {
  return to === 'team' ? 'team' : (parseChannel(to) ?? 'all');
}

/** One person's chat actions per minute, whichever client they come from (the plugin or the website). */
export const CHAT_ACT_LIMIT = { limit: 40, windowMs: 60_000 };

export type ChatActName = 'chat-send' | 'chat-del' | 'chat-mute' | 'chat-pause' | 'chat-own-team';

/**
 * One chat action, after the caller has checked who they are and rate-limited them: the plugin's
 * chatAct and the website's Feed & chat page both come through here, so a line sent from either is
 * the same sendChat call (the same row, the same push to every open plugin).
 */
export async function runChatAct(access: ChatAccess, userId: number, act: ChatActName, a: Args, fields: Args): Promise<SendResult> {
  const id = Number(a.id);
  return act === 'chat-send'
    ? sendChat(access, userId, fields.msg ?? '', sendTarget(a.to))
    : act === 'chat-del'
      ? deleteChat(access, userId, id)
      : act === 'chat-mute'
        ? muteChat(access, userId, id)
        : act === 'chat-own-team'
          ? setOwnTeamChat(access, userId, a.on === '1')
          : pauseChat(access, a.on === '1', userId);
}

export async function chatAct(request: Request, act: string, a: Args, fields: Args): Promise<View | null> {
  if (!['chat-send', 'chat-del', 'chat-mute', 'chat-pause', 'chat-own-team'].includes(act)) return null;
  const got = await accessFor(request, a);
  if ('ui' in got) return got;
  const { access, userId } = got;
  const rl = await rateLimit(request, `event-chat:${userId}`, CHAT_ACT_LIMIT);
  if (!rl.ok) return err('Slow down a little.');
  const r = await runChatAct(access, userId, act as ChatActName, a, fields);
  if (!r.ok) return err(r.error);
  // Pausing and "Only my team's chat" redraw the tab so the switch flips; everything else changes
  // nothing on the sender's screen.
  if (act === 'chat-pause' || act === 'chat-own-team') return feedView(request, { s: a.s ?? `event:${access.eventId}`, p: 'chat', ...(a.f ? { f: a.f } : {}) });
  return OK;
}
