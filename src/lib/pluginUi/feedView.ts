import { and, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships, clans, eventParticipants, events, teams, users } from '@/db/schema';
import { completionAt } from '@/lib/panelRows';
import { normalizeRsn, pluginRsnHintOnly, pluginViewerRsn, resolvePluginClan, verifyPluginToken, verifyPluginTokenUser } from '@/lib/auth';
import { boardChatSlow, myChatNames, chatAccess, chatHistory, deleteChat, muteChat, pauseChat, sendChat, type ChatAccess, type ChatSeatPick } from '@/lib/eventChat';
import { chatPaceHint } from '@/lib/eventChatRules';
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
import { completionRow, feedTabUi, momentRow, reactRowAction, type RowReactKind, type Scope } from './feedUi';
import type { FeedRow, View } from './nodes';
import { backRow, col, gap, message, text } from './nodes';
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
  return out;
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
  const pane = a.p === 'chat' && chatAvailable ? 'chat' : 'feed';
  const modeActive = pane === 'feed' && a.m === '1' && current.kind === 'clan';
  const requestedFilter = a.f || 'all';
  const filter = modeActive && requestedFilter !== 'all' && !groupOf(requestedFilter) ? 'all' : requestedFilter;
  const teamId = access?.teamId ?? null;

  if (pane === 'chat' && access && viewer) {
    const f = filter === 'team' ? 'team' : filter === 'mods' && access.staff ? 'mods' : 'all';
    const rows = await chatHistory(access, viewer.userId, f);
    return {
      ui: feedTabUi({
        scopes,
        current,
        pane,
        chatAvailable,
        filter: f,
        teamId,
        rows,
        images: hasPanelImages(request),
        mine: await myChatNames(viewer.userId),
        send: {
          act: 'chat-send',
          args: { e: String(current.id), to: f === 'team' ? 'team' : 'all' },
          // The viewer's own pace (Supporter tier) or the board's slow mode, so nobody is surprised by it.
          hint: `${f === 'team' ? 'Message your team' : 'Message the event'} · ${chatPaceHint({
            tier: access.staff ? null : ((await supporterForUser(viewer.userId).catch(() => null))?.tier.id ?? null),
            slow: boardChatSlow(current.id),
            staff: access.staff,
          })}`,
        },
        locked: access.paused && !access.staff ? 'The host has paused chat.' : null,
        staff: access.staff,
        paused: access.paused,
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
      filter,
      teamId,
      rows,
      images: hasPanelImages(request),
      // No "Drops 5m+" floor line: the floor differs per clan, per mode and per user, so a single
      // number under the list was wrong for most of them.
      mode: current.kind === 'clan' ? { active: modeActive, count: modeCount, selected: selectedMode, options: modeOptions } : null,
    }),
  };
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

export async function chatAct(request: Request, act: string, a: Args, fields: Args): Promise<View | null> {
  if (!['chat-send', 'chat-del', 'chat-mute', 'chat-pause'].includes(act)) return null;
  const got = await accessFor(request, a);
  if ('ui' in got) return got;
  const { access, userId } = got;
  const rl = await rateLimit(request, `event-chat:${userId}`, { limit: 40, windowMs: 60_000 });
  if (!rl.ok) return err('Slow down a little.');
  const id = Number(a.id);
  const r =
    act === 'chat-send'
      ? await sendChat(access, userId, fields.msg ?? '', a.to === 'team')
      : act === 'chat-del'
        ? await deleteChat(access, userId, id)
        : act === 'chat-mute'
          ? await muteChat(access, userId, id)
          : await pauseChat(access, a.on === '1');
  if (!r.ok) return err(r.error);
  // Pausing redraws the tab so the switch flips; everything else changes nothing on the sender's screen.
  if (act === 'chat-pause') return feedView(request, { s: a.s ?? `event:${access.eventId}`, p: 'chat' });
  return OK;
}
