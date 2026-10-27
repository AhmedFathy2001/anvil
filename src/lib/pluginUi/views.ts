import { and, eq, ilike, or } from 'drizzle-orm';

import { buildBoard, pluginBoardScope } from '@/app/api/plugin/board/route';
import { GET as configRoute } from '@/app/api/plugin/config/route';
import { GET as weeklyRoute } from '@/app/api/plugin/weekly-leaderboard/route';
import { db } from '@/db';
import { clans, memberClogItems, settings } from '@/db/schema';
import { apexCharacter } from '@/lib/apexProfiles';
import { loadClanCard } from '@/lib/clanCard';
import { listedClanWhere, showcaseJoinOn } from '@/lib/clanListing';
import { clogPageItems, clogPageNames } from '@/lib/clogDataset';
import { caLookup, combatTasks } from '@/lib/combatTasks';
import { deleteGoal, goalsWithProgress, saveGoal } from '@/lib/goals';
import { getMemberItems } from '@/lib/memberProgressRead';
import { buildActivity } from '@/lib/pluginActivity';
import { canSeeClan } from '@/lib/clanAccess';
import { type ClanEventView, listClanEvents, setGoing } from '@/lib/clanEvents';
import { ttlMemo } from '@/lib/ttlMemo';
import { loadPlayerCard } from '@/lib/playerCard';
import { accountForCharacter, accountStanding, playedCharacter } from '@/lib/pluginAccount';
import { pluginClaimCaller } from '@/lib/pluginClaimCaller';
import { buildEnrolledConfig } from '@/lib/pluginConfigEnrolled';
import type { PanelTile } from '@/lib/pluginPanel';
import { pluginRoster } from '@/lib/pluginRoster';
import { rateLimit } from '@/lib/rate-limit';
import { claimTile, cleanNote, unclaimTile } from '@/lib/tileClaims';
import { resolvePluginClan, verifyPluginToken, verifyPluginTokenUser } from '@/lib/auth';

import { type BoardContext, type BoardState, type BoardTile, STATUSES, type Status, boardRowsUi, boardUi } from './boardUi';
import { clanCardUi, clanCompareUi, clanSearchUi } from './clanUi';
import { type HomeConfig, type HomeData, eventUi, homeUi } from './homeUi';
import { lookupPlayerCard, viewerPlayerId, visibleClan } from './load';
import { type Node, type View, backRow, button, col, gap, message, text } from './nodes';
import { notFoundUi, playerCardUi } from './playerCardUi';
import { casUi, clogPageUi, compareUi, dueOnFrom, goalFormUi, goalsUi } from './playerMoreUi';
import { rosterUi, teamsUi } from './teamsUi';

// Every view the panel can ask for, by name, and every action it can send. The plugin passes the
// view's args as query parameters, plus `clan` (the clan it is pointed at) on every call.

type Args = Record<string, string>;

/** The character being played (X-RSN), when the Account Token owns it: whose goals these are. */
async function ownedAccount(request: Request) {
  const viewer = await verifyPluginTokenUser(request);
  const character = playedCharacter(request);
  if (!viewer || !character) return null;
  if ((await accountStanding(viewer.userId, character)) !== 'yours') return null;
  const account = await accountForCharacter(character);
  return account ? { userId: viewer.userId, accountId: account.id, rsn: character.rsn } : null;
}

const NOT_YOURS = 'Log in to a character that is yours on Anvil to keep goals.';

async function goalsView(request: Request, error: string | null = null): Promise<View> {
  const owner = await ownedAccount(request);
  if (!owner) return { ui: goalsUi([], NOT_YOURS) };
  return { ui: goalsUi(await goalsWithProgress(owner.accountId, owner.rsn), error) };
}

async function playerView(request: Request, rsn: string): Promise<View> {
  const found = await lookupPlayerCard(request, rsn);
  const retry = button('Try again', { a: 'load', v: 'player', args: { rsn } });
  switch (found.kind) {
    case 'card':
      return { ui: playerCardUi(found.card, { sectionKey: 'lookup', cas: true, me: playedCharacter(request)?.rsn ?? null }) };
    case 'busy':
      return message('Hiscores busy — try again in a moment.', [gap(6), retry]);
    case 'limited':
      return message('That’s a lot of lookups — give it a minute.', [gap(6), retry]);
    default:
      return { ui: notFoundUi(rsn) };
  }
}

/** Your own card and goals: the character being played, private or not, if it's yours to see. */
async function youView(request: Request): Promise<View> {
  const me = playedCharacter(request);
  if (!me) return message('Log in to a character to see your card.');
  const character = await apexCharacter(me.rsn, await viewerPlayerId(request));
  const cardUi = character
    ? playerCardUi(await loadPlayerCard(character), { sectionKey: 'you', cas: true })
    : notFoundUi(me.rsn);
  return { ui: col([cardUi, gap(6), (await goalsView(request)).ui]) };
}

async function casView(request: Request, a: Args): Promise<View> {
  const character = await apexCharacter(a.rsn ?? '', await viewerPlayerId(request));
  const items = character ? await getMemberItems(character.accountId, 'ca') : null;
  if (!items) return message('No combat achievements synced yet.');
  const tier = Number(a.tier);
  return {
    ui: casUi(character!.rsn, caLookup(combatTasks(items.items)), {
      tier: Number.isInteger(tier) && tier >= 0 ? tier : -1,
      byTask: a.mode === 'task',
      missingOnly: a.missing === '1',
    }),
  };
}

async function clogPageView(request: Request, a: Args): Promise<View> {
  const wanted = (a.page ?? '').trim().toLowerCase();
  const page = clogPageNames().find((p) => p.toLowerCase() === wanted);
  const character = page ? await apexCharacter(a.rsn ?? '', await viewerPlayerId(request)) : null;
  if (!page || !character) return message('Couldn’t load this page — try again in a moment.');
  // Owned is by ITEM, not by the page it was stored under: an item shows on every page it belongs to.
  // clan-scope: global -- an OSRS account is one account however many clans roster it.
  const owned = await db
    .select({ itemId: memberClogItems.itemId, quantity: memberClogItems.quantity })
    .from(memberClogItems)
    .where(eq(memberClogItems.accountId, character.accountId));
  const qty = new Map(owned.map((o) => [o.itemId, o.quantity]));
  const items = clogPageItems(page).map((i) => ({ id: i.id, name: i.name, owned: qty.has(i.id), quantity: qty.get(i.id) ?? 0 }));
  const kc = Number(a.kc);
  return {
    ui: clogPageUi(character.rsn, { page, obtained: items.filter((i) => i.owned).length, total: items.length, items }, a.back || 'root', kc > 0 ? kc : null),
  };
}

async function compareView(request: Request, rsn: string): Promise<View> {
  const me = playedCharacter(request);
  const [mine, theirs] = await Promise.all([me ? lookupPlayerCard(request, me.rsn) : null, lookupPlayerCard(request, rsn)]);
  if (theirs.kind !== 'card') return playerView(request, rsn);
  if (mine?.kind !== 'card') return message('Couldn’t load your card — try again in a moment.');
  return { ui: compareUi(mine.card, theirs.card) };
}

async function clanView(request: Request, a: Args): Promise<View> {
  const clan = await visibleClan(request, a.slug ?? '');
  if (!clan) return message('That clan isn’t listed on Anvil.');
  const mine = (a.clan ?? '').trim().toLowerCase();
  return { ui: clanCardUi(await loadClanCard(clan), !!mine && mine !== clan.slug && a.own !== '1') };
}

async function clanCompareView(request: Request, a: Args): Promise<View> {
  const [theirs, mine] = await Promise.all([visibleClan(request, a.slug ?? ''), visibleClan(request, a.clan ?? '')]);
  if (!theirs) return message('That clan isn’t listed on Anvil.');
  if (!mine) return message('Couldn’t load your clan — try again in a moment.');
  const [x, y] = await Promise.all([loadClanCard(mine), loadClanCard(theirs)]);
  return { ui: clanCompareUi(x, y) };
}

/** Public, listed clans only (the directory's own rule) — an unlisted clan is not something to search for. */
async function clansView(q: string): Promise<View> {
  const query = q.trim().slice(0, 60);
  if (query.length < 2) return message('Search a clan by name.');
  const like = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  // clan-scope: global -- searching the public directory is a platform question.
  const found = await db
    .select({ slug: clans.slug, name: clans.name })
    .from(clans)
    .leftJoin(settings, showcaseJoinOn())
    .where(and(listedClanWhere(), or(ilike(clans.name, like), ilike(clans.slug, like))))
    .orderBy(clans.name)
    .limit(8);
  return { ui: clanSearchUi(query, found) };
}

async function goalFormView(request: Request, kind: string): Promise<View> {
  const owner = await ownedAccount(request);
  if (!owner) return { ui: goalsUi([], NOT_YOURS) };
  // Log pages are offered once the log is synced.
  const character = await apexCharacter(owner.rsn, await viewerPlayerId(request));
  const pages = character ? (await loadPlayerCard(character)).clogPages.map((p) => p.name) : [];
  return { ui: goalFormUi(kind, pages) };
}

// ---- The board and its teams -----------------------------------------------------------------------

const positive = (v: string | undefined) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

function boardState(a: Args): BoardState {
  const status = STATUSES.some((x) => x.v === a.status) ? (a.status as Status) : 'all';
  return { event: positive(a.event) ?? 0, pre: a.pre === '1', q: (a.q ?? '').slice(0, 80), status, page: Math.max(0, Number(a.page) || 0) };
}

/**
 * The team's count per tile, as the side panel's rows read it (the config builder, with the caller as
 * the viewer so per-member tiles are theirs). The live board only: a preview has no team counts.
 */
async function teamProgress(request: Request): Promise<BoardContext['progress']> {
  const out: BoardContext['progress'] = new Map();
  const auth = await verifyPluginToken(request);
  const user = auth?.userId != null ? { userId: auth.userId } : await verifyPluginTokenUser(request);
  const clan = auth && user ? await resolvePluginClan(request, user.userId) : null;
  if (!auth || !clan) return out;
  const built = await buildEnrolledConfig({
    eventId: auth.eventId,
    teamId: auth.teamId,
    clan,
    viewer: { playerId: auth.playerId, userId: auth.userId, rsn: auth.rsn, request },
  });
  if (!built.ok) return out;
  for (const t of (built.body as { panel?: { tiles?: PanelTile[] } }).panel?.tiles ?? []) out.set(t.tileId, { current: t.current, goal: t.goal });
  return out;
}

async function boardView(request: Request, a: Args, error: string | null = null): Promise<View> {
  const state = boardState(a);
  const scope = await pluginBoardScope(request, state.event || null);
  if (!scope) return message('Couldn’t load the board.', [gap(5), button('Retry', { a: 'load', v: 'board', args: a })]);
  const [board, progress] = await Promise.all([
    buildBoard(scope.event, scope.teamId, scope.userId),
    !state.event && !state.pre && scope.teamId != null ? teamProgress(request) : Promise.resolve(new Map()),
  ]);
  const clan = (a.clan ?? '').trim();
  const ctx: BoardContext = {
    eventId: scope.event.id,
    claimBlock: board.readOnly ? 'Join this event to claim tiles.' : playedCharacter(request) ? null : 'Log in to claim tiles.',
    // The plugin says which tiles it has pinned, and whether it can pin here at all (in game, tracker on).
    pins: a.track === '1' ? (a.pins ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0) : null,
    progress,
    boardPath: `${clan ? `/c/${encodeURIComponent(clan)}` : ''}/events/${scope.event.id}`,
  };
  const tile = positive(a.tile) && a.list !== '1' ? (board.tiles as BoardTile[]).find((t) => t.tileId === Number(a.tile)) : undefined;
  const inner = boardRowsUi(board, state, ctx, tile, error);
  return { ui: a.part === 'rows' ? inner : withBack(a, 'All tiles', boardUi(board, state, ctx, inner)) };
}

async function claimAct(request: Request, act: 'claim' | 'unclaim', a: Args, note: string | undefined): Promise<View> {
  const event = positive(a.event);
  const tileId = positive(a.tile);
  const c = await pluginClaimCaller(request, event ?? undefined);
  let error: string | null = c.ok ? null : c.error;
  if (c.ok && tileId) {
    if (act === 'unclaim') await unclaimTile(c.auth.teamId, tileId, c.userId);
    else {
      const r = await claimTile({ eventId: c.auth.eventId, teamId: c.auth.teamId, tileId, userId: c.userId, participantId: c.auth.playerId, note: cleanNote(note) });
      if (!r.ok) error = r.error;
    }
  }
  return boardView(request, a, error);
}

async function teamsView(request: Request, a: Args): Promise<View> {
  const scope = positive(a.event) ? null : await pluginBoardScope(request, null);
  const event = positive(a.event) ?? scope?.event.id ?? 0;
  const state = { event, team: positive(a.team) ?? 0, page: positive(a.page) ?? 1, back: positive(a.back) ?? 1 };
  const q = (a.q ?? '').trim().slice(0, 40);
  const data = event ? await pluginRoster(request, event, { query: q, team: state.team || null, page: state.page, pageSize: 25 }) : null;
  return { ui: a.part === 'list' ? rosterUi(data, state) : withBack(a, 'Teams', teamsUi(data, state, q)) };
}

/** A page opened from the Clan tab: "‹ <event>" back to it, then the page's title over it. */
function withBack(a: Args, title: string, page: Node): Node {
  if (!a.back) return page;
  return col([backRow(a.backLabel || 'Back', { a: 'load', v: 'home', args: { open: a.back } }), gap(8), text(title, 'brand'), gap(6), page]);
}

// ---- The Clan tab -----------------------------------------------------------------------------------

/**
 * The Clan tab: the clan's events, or one of them. Built from the answer /api/plugin/config gives this
 * same caller — the route itself, so the tab can never show a board the plugin isn't tracking — plus
 * the team feed, the standings, the live weeklies' boards and the clan's card.
 */
async function homeView(request: Request, a: Args): Promise<View> {
  const res = await configRoute(request);
  if (!res.ok) {
    return message(res.status === 404 ? 'You’re not in a clan on Anvil yet — join one on the site and it shows here.' : 'Couldn’t reach Anvil — try again in a moment.');
  }
  const cfg = (await res.json()) as HomeConfig & { event?: { startDate: string | null; endDate: string | null; forceEndedAt?: string | null } | null };
  const now = Date.now();
  // Running: started, not force-ended, and not past an end — an open-ended event (no end date) runs
  // until the host ends it, as the plugin's tracking reads it (eventTimeState calls that 'none').
  const ev = cfg.event;
  const at = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);
  const live = !!ev && !ev.forceEndedAt && !(at(ev.startDate) > now) && !(at(ev.endDate) <= now);
  const slug = cfg.activeClan?.slug ?? (a.clan ?? '').trim();
  const clanPath = slug ? `/c/${encodeURIComponent(slug)}` : '';
  const me = playedCharacter(request);
  const open = a.open ?? '';

  const auth = live ? await verifyPluginToken(request) : null;
  const liveWeeklies = (cfg.panel?.weeklies ?? []).filter((w) => w.status === 'active');
  const [feed, roster, boards, ownClan, clanEvents] = await Promise.all([
    auth
      ? buildActivity({ teamId: auth.teamId, eventId: auth.eventId, selfPlayerId: auth.playerId, selfRsn: auth.rsn, since: { sub: 0, comp: 0, rev: 0 } }).then((p) => p.activity)
      : Promise.resolve([]),
    live && cfg.event ? pluginRoster(request, cfg.event.id, { query: '', team: null, page: 1, pageSize: 50 }) : Promise.resolve(null),
    Promise.all(
      liveWeeklies.map(async (w) => {
        const url = new URL(request.url);
        url.search = `?id=${w.id}`;
        const r = await weeklyRoute(new Request(url, { headers: request.headers }));
        return [w.id, r.ok ? ((await r.json()) as { total: number; entries: { rank: number; rsn: string; gained: number }[] }) : null] as const;
      }),
    ),
    !open && slug ? ownClanCard(request, slug) : Promise.resolve(null),
    slug ? clanEventsFor(request, slug) : Promise.resolve([] as ClanEventView[]),
  ]);
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  const weekly: HomeData['weekly'] = new Map();
  for (const [id, b] of boards) {
    if (!b) continue;
    const top = (b.entries ?? []).map((e) => ({ ...e, self: !!me && norm(e.rsn) === norm(me.rsn) }));
    weekly.set(id, { total: b.total, top, you: top.find((e) => e.self) ?? null });
  }
  const data: HomeData = {
    cfg,
    live,
    inGame: !!me,
    feed,
    standings: roster && roster.mode === 'teams' ? roster.teams.filter((t) => t.rank != null).sort((x, y) => x.rank! - y.rank!) : [],
    weekly,
    pins: a.track === '1' ? (a.pins ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0) : null,
    chosen: a.chosen === '1',
    ownClan,
    boardPath: cfg.event ? `${clanPath}/events/${cfg.event.id}` : null,
    clanPath,
    now,
    clanEvents,
  };
  return { ui: (open && eventUi(data, open)) || homeUi(data) };
}

/** The clan's events in the next fortnight, with the caller's own "going" marked. */
async function clanEventsFor(request: Request, slug: string): Promise<ClanEventView[]> {
  const clan = await visibleClan(request, slug);
  if (!clan) return [];
  const user = await verifyPluginTokenUser(request);
  return listClanEvents(clan.id, { userId: user?.userId ?? null, withinDays: 14 });
}

/** "I'm going" from the panel: a member of the event's clan (a seat or a staff grant), signed in to the plugin. */
async function clanEventGoingAct(request: Request, a: Args): Promise<View> {
  // A post carries no ?clan=; the answer is the Clan tab of the clan the button was drawn for.
  const url = new URL(request.url);
  url.search = new URLSearchParams({ clan: a.clan ?? '' }).toString();
  const asGet = new Request(url, { headers: request.headers });
  const back = () => homeView(asGet, { clan: a.clan ?? '', open: a.open ?? '' });
  const user = await verifyPluginTokenUser(request);
  const clan = await visibleClan(request, a.clan ?? '');
  if (!user || !clan) return message('Sign in to the plugin to say you’re going.');
  const member = await canSeeClan({ clanId: clan.id, visibility: 'private', playerId: await viewerPlayerId(request), userId: user.userId });
  if (!member) return message('Only members of this clan can say they’re going.');
  if (!(await rateLimit(request, `plugin-clan-event-going:${user.userId}`, { limit: 20, windowMs: 60_000 })).ok) return back();
  await setGoing(clan.id, Number(a.id), user.userId, a.going === '1');
  return back();
}

/** Your clan's card under its events; the same answer for a few minutes, the clan doesn't change by the second. */
async function ownClanCard(request: Request, slug: string): Promise<Node | null> {
  const clan = await visibleClan(request, slug);
  if (!clan) return null;
  return clanCardUi(await ttlMemo(`plugin-ui-clan-card:${clan.id}`, () => loadClanCard(clan), 5 * 60_000), false);
}

export async function pluginView(request: Request, v: string, a: Args): Promise<View | null> {
  switch (v) {
    case 'player':
      return playerView(request, (a.rsn ?? '').trim());
    case 'you':
      return youView(request);
    case 'cas':
      return casView(request, a);
    case 'clog-page':
      return clogPageView(request, a);
    case 'compare':
      return compareView(request, (a.rsn ?? '').trim());
    case 'clan':
      return clanView(request, a);
    case 'clan-compare':
      return clanCompareView(request, a);
    case 'clans':
      return clansView(a.q ?? '');
    case 'goals':
      return goalsView(request);
    case 'goal-new':
      return goalFormView(request, a.kind ?? 'skill');
    case 'board':
      return boardView(request, a);
    case 'teams':
      return teamsView(request, a);
    case 'home':
      return homeView(request, a);
    default:
      return null;
  }
}

/** An action from the panel: `args` as the view gave them, `fields` from its inputs. */
export async function pluginAct(request: Request, act: string, args: Args, fields: Args): Promise<View | null> {
  if (act === 'claim' || act === 'unclaim') return claimAct(request, act, args, fields.note);
  if (act === 'clan-event-going') return clanEventGoingAct(request, args);
  if (act !== 'goal-add' && act !== 'goal-remove') return null;
  const owner = await ownedAccount(request);
  if (!owner) return { ui: goalsUi([], NOT_YOURS) };
  const rl = await rateLimit(request, `plugin-goals:${owner.userId}`, { limit: 30, windowMs: 60_000 });
  if (!rl.ok) return goalsView(request, 'Too many changes — give it a minute.');

  if (act === 'goal-remove') {
    const id = Number(args.id);
    if (Number.isInteger(id) && id > 0) await deleteGoal(owner.accountId, id);
    return goalsView(request);
  }
  const target = Number(fields.target);
  const refused = await saveGoal(owner.accountId, {
    kind: args.kind,
    metric: fields.metric,
    target: args.kind === 'clog' ? 0 : target,
    dueOn: dueOnFrom(fields.due ?? ''),
  });
  return goalsView(request, refused);
}
