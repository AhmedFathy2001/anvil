import { mayPickRoad, pickRaceRoad } from '@/lib/raceRoutesDb';
import { and, eq, ilike, or } from 'drizzle-orm';

import { buildBoard, pluginBoardScope } from '@/app/api/plugin/board/route';
import { GET as configRoute } from '@/app/api/plugin/config/route';
import { GET as weeklyRoute } from '@/app/api/plugin/weekly-leaderboard/route';
import { db } from '@/db';
import { clans, events, memberClogItems, settings, tiles, users } from '@/db/schema';
import { challengesForAccount, respondToChallenge } from '@/lib/h2h';
import { h2hUi } from './h2hUi';
import { apexCharacter } from '@/lib/apexProfiles';
import { FEED_KINDS, loadClanCard } from '@/lib/clanCard';
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
import { pluginCharacterRefusal } from '@/lib/pluginForeign';
import { checkOwnershipClaim, myClaimOn, startOwnershipClaim } from '@/lib/ownershipClaims';
import { pluginClaimCaller } from '@/lib/pluginClaimCaller';
import { buildEnrolledConfig } from '@/lib/pluginConfigEnrolled';
import type { PanelTile } from '@/lib/pluginPanel';
import { pluginRoster } from '@/lib/pluginRoster';
import { rateLimit } from '@/lib/rate-limit';
import { claimTile, cleanNote, unclaimTile } from '@/lib/tileClaims';
import { normalizeRsn, pluginRsnHintOnly, resolvePluginClan, resolvePluginMember, verifyPluginToken, verifyPluginTokenUser } from '@/lib/auth';
import { type BoardSummary, liveBoardsForCharacter, summarizeBoards } from '@/lib/pluginBoards';
import { type SupporterInk, supporterForUser, supporterInksForRsns } from '@/lib/supporter';
import { inkForSurface } from '@/lib/supporterStyle';
import { momentsForClan } from '@/lib/momentsStore';
import { NO_REACTIONS, isClanMember, momentInClan, reactionSummaries, toggleReaction } from '@/lib/momentReactions';
import { emitReactionRows } from '@/lib/panelRows';
import { REACT_ERRORS, checkReaction } from '@/lib/reactionAccess';
import { FEED_MAX, FEED_STEP, type FeedItem, momentsFeedUi } from './momentsUi';
import { chatAct, chatCharacter, feedView } from './feedView';

import { type BoardContext, type BoardState, type BoardTile, STATUSES, type Status, boardRowsUi, boardUi, joinToClaimLine } from './boardUi';
import { clanCardUi, clanCompareUi, clanSearchUi } from './clanUi';
import { type HomeConfig, type HomeData, eventUi, homeUi } from './homeUi';
import { proofImagePath } from '@/lib/proofImage';
import { gatesForEvent } from '@/lib/entryGatesDb';
import { gatesShortLabel } from '@/lib/entryGates';
import { deleteTileProof, listTileProofs } from '@/lib/tileProofs';
import { PROOFS_MAX, PROOFS_STEP, type ProofRow, proofsUi } from './proofsUi';
import { boardChatOn } from '@/lib/eventChat';
import { hasFeedTab, hasPanelImages, hasTabArgs, hasTabLinks, loadPanelPlayerCard, lookupPlayerCard, pluginStaff, viewerPlayerId, visibleClan } from './load';
import { LAB_CLAN_SLUG } from '@/lib/lab';
import { isCreatorSpace } from '@/lib/creatorSpaces';
import { clanBoostLevels } from '@/lib/clanBoosts';
import { racePageUi } from './raceUi';
import { boardFeedLinks } from './feedUi';
import { type Action, type Node, type View, applyFlair, backRow, button, card, col, gap, message, muted, namesIn, text } from './nodes';
import { notFoundUi, playerCardUi } from './playerCardUi';
import { casUi, clogPageUi, compareUi, dueOnFrom, goalFormUi, goalsUi } from './playerMoreUi';
import { rosterUi, teamsUi } from './teamsUi';
import { standingsScopeForPlugin } from '@/lib/standingsAccess';
import { curtainInfo, standingsHiddenNotice } from '@/lib/standingsVisibility';

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
      return { ui: playerCardUi(found.card, { sectionKey: 'lookup', cas: true, me: playedCharacter(request)?.rsn ?? null, images: hasPanelImages(request) }) };
    case 'busy':
      return message('Hiscores busy — try again in a moment.', [gap(6), retry]);
    case 'limited':
      return message('That’s a lot of lookups — give it a minute.', [gap(6), retry]);
    default:
      return { ui: notFoundUi(rsn) };
  }
}

/**
 * The played character belongs to another Anvil player: say so, and offer "This is my account" (an
 * ownership claim, lib/ownershipClaims) — or show where an earlier claim stands, with "Check" while
 * its XP check is running. Never names the owner.
 */
async function ownershipCard(request: Request, note: string | null = null): Promise<Node | null> {
  const viewer = await verifyPluginTokenUser(request);
  const me = playedCharacter(request);
  if (!viewer || !me || (await accountStanding(viewer.userId, me)) !== 'other') return null;
  const claim = await myClaimOn(viewer.userId, me);
  const inFlight = claim && ['verifying', 'open', 'approved', 'transferring'].includes(claim.status);
  const withStaff = claim && (claim.status === 'staff' || claim.status === 'objected' || claim.status === 'declined');
  return card([
    text(`${me.rsn} belongs to another Anvil player`, 'brand'),
    gap(2),
    muted('Nothing is sent for it from this login: no drops, progress or proofs.', { wrap: true }),
    ...(claim ? [gap(4), text(claim.line, inFlight ? 'progress' : 'muted', { wrap: true })] : []),
    ...(note ? [gap(4), text(note, 'error', { wrap: true })] : []),
    ...(claim?.status === 'verifying'
      ? [gap(6), button('Check', { a: 'post', act: 'ownership-check', args: { id: String(claim.id) } }, 'Read the hiscores again')]
      : !inFlight && !withStaff
        ? [
            gap(6),
            button(
              'This is my account',
              { a: 'post', act: 'ownership-claim' },
              'Prove it with a quick XP check; then the current owner (or Anvil staff) is asked',
            ),
          ]
        : []),
  ]);
}

/** "This is my account" from the panel: the same claim as the account row's "It's mine". */
async function ownershipClaimAct(request: Request, act: string, args: Args): Promise<View> {
  const viewer = await verifyPluginTokenUser(request);
  const me = playedCharacter(request);
  if (!viewer || !me) return message('Log in to the character first.');
  const rl = await rateLimit(request, `plugin-ownership-claim:${viewer.userId}`, { limit: 20, windowMs: 10 * 60_000 });
  if (!rl.ok) return youView(request, 'Too many requests — try again in a few minutes.');
  if (act === 'ownership-check') {
    const id = Number(args.id);
    const out = Number.isInteger(id) && id > 0 ? await checkOwnershipClaim({ claimId: id, userId: viewer.userId }) : null;
    return youView(request, !out ? 'Couldn’t find that claim.' : out.ok ? (out.status === 'verifying' ? out.message : null) : out.error);
  }
  const out = await startOwnershipClaim({ userId: viewer.userId, character: me });
  return youView(request, out.ok ? null : out.error);
}

/** Your own card and goals: the character being played, private or not, if it's yours to see. */
async function youView(request: Request, note: string | null = null): Promise<View> {
  const me = playedCharacter(request);
  if (!me) return message('Log in to a character to see your card.');
  const ownership = await ownershipCard(request, note).catch(() => null);
  const character = await apexCharacter(me.rsn, await viewerPlayerId(request));
  const cardUi = character
    ? playerCardUi(await loadPanelPlayerCard(character), { sectionKey: 'you', cas: true, images: hasPanelImages(request) })
    : notFoundUi(me.rsn);
  // Head-to-head only when something is open: an empty card on everybody's tab is noise.
  const owner = await ownedAccount(request);
  const challenges = owner ? await challengesForAccount(owner.accountId).catch(() => []) : [];
  const h2h = challenges.length ? [h2hUi(challenges), gap(6)] : [];
  return { ui: col([...(ownership ? [ownership, gap(6)] : []), cardUi, gap(6), ...h2h, (await goalsView(request)).ui]) };
}

/** The played character's head-to-head challenges (lib/h2h), when it is yours. */
async function h2hView(request: Request, error: string | null = null): Promise<View> {
  const owner = await ownedAccount(request);
  if (!owner) return { ui: h2hUi([], error) };
  return { ui: h2hUi(await challengesForAccount(owner.accountId).catch(() => []), error) };
}

/** Accept or decline an invitation from the panel. Only the invited person's own character may. */
async function h2hAct(request: Request, act: string, args: Args): Promise<View> {
  const owner = await ownedAccount(request);
  if (!owner) return h2hView(request, 'Log in to a character that is yours on Anvil.');
  const rl = await rateLimit(request, `plugin-h2h:${owner.userId}`, { limit: 20, windowMs: 60_000 });
  if (!rl.ok) return h2hView(request, 'Too many changes — give it a minute.');
  const id = Number(args.id);
  // clan-scope: global -- a person's login, by id, to find whose answer this is.
  const login = await db.query.users.findFirst({ where: eq(users.id, owner.userId), columns: { playerId: true } });
  if (!login?.playerId || !Number.isInteger(id) || id <= 0) return h2hView(request, 'Couldn’t find that challenge.');
  const out = await respondToChallenge({ id, playerId: login.playerId, accept: act === 'h2h-accept' });
  return h2hView(request, out.ok ? null : out.error);
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
  // "Compare with my clan" only between two clans: a creator space has no members to compare.
  const compare = !!mine && mine !== clan.slug && a.own !== '1' && !isCreatorSpace(clan) && !(await mineIsSpace(request, mine));
  return { ui: clanCardUi(await loadClanCard(clan), compare, hasFeedTab(request), hasTabLinks(request), hasPanelImages(request)) };
}

/** Is the place the plugin is pointed at a creator space? */
async function mineIsSpace(request: Request, slug: string): Promise<boolean> {
  return isCreatorSpace(await visibleClan(request, slug).catch(() => null));
}

async function clanCompareView(request: Request, a: Args): Promise<View> {
  const [theirs, mine] = await Promise.all([visibleClan(request, a.slug ?? ''), visibleClan(request, a.clan ?? '')]);
  if (!theirs) return message('That clan isn’t listed on Anvil.');
  if (!mine) return message('Couldn’t load your clan — try again in a moment.');
  if (isCreatorSpace(theirs) || isCreatorSpace(mine)) return message('A creator space has no members to compare.');
  const [x, y] = await Promise.all([loadClanCard(mine), loadClanCard(theirs)]);
  return { ui: clanCompareUi(x, y) };
}

/** Public, listed clans only (the directory's own rule) — an unlisted clan is not something to search for. */
async function clansView(request: Request, q: string): Promise<View> {
  const query = q.trim().slice(0, 60);
  if (query.length < 2) return message('Search a clan by name.');
  const like = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  // clan-scope: global -- searching the public directory is a platform question.
  const found = await db
    .select({ id: clans.id, slug: clans.slug, name: clans.name })
    .from(clans)
    .leftJoin(settings, showcaseJoinOn())
    .where(and(listedClanWhere(), or(ilike(clans.name, like), ilike(clans.slug, like))))
    .orderBy(clans.name)
    .limit(8);
  // Staff can find the hidden lab clan (its test drops, /staff/lab/supporter); nobody else ever sees it.
  if ('anvil tile lab'.includes(query.toLowerCase()) || LAB_CLAN_SLUG.includes(query.toLowerCase())) {
    if (await pluginStaff(request)) found.unshift({ id: -1, slug: LAB_CLAN_SLUG, name: 'Anvil Tile Lab (staff)' });
  }
  const levels = await clanBoostLevels(found.filter((c) => c.id > 0).map((c) => c.id)).catch(() => new Map());
  return { ui: clanSearchUi(query, found.map((c) => ({
    ...c,
    boostLevel: levels.get(c.id)?.level ?? 0,
    boostNameStyle: levels.get(c.id)?.nameStyle ?? null,
  }))) };
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
  const nav = Object.fromEntries((['back', 'backLabel', 'title'] as const).flatMap((k) => (a[k] ? [[k, a[k]]] : [])));
  return { event: positive(a.event) ?? 0, pre: a.pre === '1', q: (a.q ?? '').slice(0, 80), status, page: Math.max(0, Number(a.page) || 0), nav };
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
  for (const t of (built.body as { panel?: { tiles?: PanelTile[] } }).panel?.tiles ?? []) out.set(t.tileId, { current: t.current, goal: t.goal, ...(t.sets ? { sets: t.sets } : {}) });
  return out;
}

/** "Join this event to claim tiles", saying who may join when the host gates entry (lib/entryGates). */
async function joinToClaim(eventId: number): Promise<string> {
  const gated = await gatesForEvent(eventId).catch(() => null);
  return joinToClaimLine(gated ? gatesShortLabel(gated.gates) : null);
}

async function boardView(request: Request, a: Args, error: string | null = null): Promise<View> {
  const state = boardState(a);
  const scope = await pluginBoardScope(request, state.event || null);
  if (!scope) return message('Couldn’t load the board.', [gap(5), button('Retry', { a: 'load', v: 'board', args: a })]);
  const [board, progress] = await Promise.all([
    buildBoard(scope.event, scope.teamId, scope.userId, scope.curtainUserId ?? scope.userId),
    !state.event && !state.pre && scope.teamId != null ? teamProgress(request) : Promise.resolve(new Map()),
  ]);
  const clan = (a.clan ?? '').trim();
  const ctx: BoardContext = {
    eventId: scope.event.id,
    claimBlock: board.readOnly ? await joinToClaim(scope.event.id) : playedCharacter(request) ? null : 'Log in to claim tiles.',
    // The plugin says which tiles it has pinned, and whether it can pin here at all (in game, tracker on).
    pins: a.track === '1' ? (a.pins ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0) : null,
    progress,
    boardPath: `${clan ? `/c/${encodeURIComponent(clan)}` : ''}/events/${scope.event.id}`,
    // The feed opens in this tab: it needs the same way back this page has.
    feedBack: { open: a.back || 'board', label: a.backLabel || 'Back' },
    feedTab: hasTabArgs(request),
    chatOn: await boardChatOn(scope.event.id).catch(() => true),
  };
  const tile = positive(a.tile) && a.list !== '1' ? (board.tiles as BoardTile[]).find((t) => t.tileId === Number(a.tile)) : undefined;
  // A tile race opened from the event list is its race page (lib/pluginUi/raceUi); its "View all
  // tiles", and the home board page's tile links (back 'board'), keep the searchable list.
  if (!error && a.part !== 'rows' && a.tiles !== '1' && a.back !== 'board' && !tile) {
    const back: Action = { a: 'load', v: 'home', args: a.back ? { open: a.back } : {} };
    const nav = { back: a.back ?? '', backLabel: a.backLabel ?? '' };
    const page = racePageUi(board, {
      title: a.title || scope.event.name,
      back,
      backLabel: a.backLabel || 'All events',
      rest: [
        boardFeedLinks(ctx.eventId, ctx.feedBack, ctx.feedTab, ctx.chatOn ?? true),
        gap(12),
        button(`View all ${board.tiles.length} tiles`, { a: 'load', v: 'board', args: { ...a, tiles: '1', title: 'All tiles' } }, 'Every tile on the route, with search'),
      ],
      ctx,
      teams: { a: 'load', v: 'teams', args: { event: String(scope.event.id), ...nav } },
      reload: { a: 'load', v: 'board', args: { ...a, tile: '' } },
      pick: { ...a, tile: '' },
    });
    if (page) return { ui: page };
  }
  const inner = boardRowsUi(board, state, ctx, tile, error);
  return { ui: a.part === 'rows' ? inner : withBack(a, a.title || 'All tiles', boardUi(board, state, ctx, inner)) };
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

/** "Pick your road" at a fork on a "Choose and lock in" race (lib/raceRoutesDb). */
async function racePickAct(request: Request, a: Args): Promise<View> {
  const event = positive(a.event);
  const tileId = positive(a.tile);
  const c = await pluginClaimCaller(request, event ?? undefined);
  let error: string | null = c.ok ? null : c.error;
  if (c.ok && tileId) {
    const ev = await db.query.events.findFirst({ where: eq(events.id, c.auth.eventId) });
    if (!ev) error = 'Event not found';
    else if (!(await mayPickRoad(c.auth.teamId, c.userId, true))) error = 'Your team’s captain picks the road.';
    else {
      const r = await pickRaceRoad(ev, c.auth.teamId, tileId, c.userId);
      if (!r.ok) error = r.error;
    }
  }
  // Picked from the race page on the Clan tab: back to that page (its pick is drawn there).
  if (a.home && !error) return homeView(request, { open: a.home });
  return boardView(request, { ...a, tile: '' }, error);
}

/**
 * A tile race's page needs the whole board (every road, who's done what): gathered only when the race
 * is the page being opened. Best effort: without it the plain board page shows.
 */
async function raceBoardFor(request: Request, a: Args, boardPath: string | null): Promise<HomeData['raceBoard']> {
  try {
    const scope = await pluginBoardScope(request, null);
    if (!scope || scope.teamId == null) return null;
    const [board, progress] = await Promise.all([buildBoard(scope.event, scope.teamId, scope.userId, scope.curtainUserId ?? scope.userId), teamProgress(request)]);
    if (board.readOnly || !('race' in board) || !board.race) return null;
    const ctx: BoardContext = {
      eventId: scope.event.id,
      claimBlock: playedCharacter(request) ? null : 'Log in to claim tiles.',
      pins: a.track === '1' ? (a.pins ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0) : null,
      progress,
      boardPath,
    };
    return { board, ctx };
  } catch {
    return null;
  }
}

// ---- A tile's proofs ------------------------------------------------------------------------------

/** Who is looking at proofs on board `ev`: the token's seat there, or just its login (staff, spectators). */
async function proofScope(request: Request, ev: number | null) {
  const scope = ev ? await pluginBoardScope(request, ev) : null;
  if (!scope) return null;
  const userId = scope.userId ?? (await verifyPluginTokenUser(request))?.userId ?? null;
  return { event: scope.event, viewer: { userId, playerId: scope.playerId, teamId: scope.teamId } };
}

const unitFor = (t: { statType: string | null; tileType: string | null }) =>
  t.statType === 'skill' ? ' XP' : t.statType === 'boss' || t.statType === 'kc' || t.tileType === 'kill' ? ' KC' : t.tileType === 'value' || t.tileType === 'valuetotal' ? ' gp' : '';

async function proofsView(request: Request, a: Args): Promise<View> {
  const ps = await proofScope(request, positive(a.ev));
  const tileId = positive(a.tile);
  if (!ps || !tileId) return { ui: gap(0) };
  const n = Math.min(PROOFS_MAX, Math.max(PROOFS_STEP, positive(a.n) ?? PROOFS_STEP));
  const [list, tile] = await Promise.all([
    listTileProofs(ps.event, tileId, ps.viewer, n),
    // clan-scope: global -- listTileProofs only answers for a tile on this event.
    db.query.tiles.findFirst({ where: eq(tiles.id, tileId), columns: { statType: true, tileType: true } }),
  ]);
  const images = hasPanelImages(request);
  const rows: ProofRow[] = list.proofs.map((p) => ({
    id: p.id,
    who: p.who,
    credit: p.credit,
    team: p.teamName,
    at: p.at,
    amount: p.amount,
    thumb: p.imageUrl ? proofImagePath(p.id, p.imageUrl) : null,
    full: p.imageUrl ? proofImagePath(p.id, p.imageUrl, true) : null,
    canDelete: p.canDelete,
  }));
  const empty = ps.viewer.teamId == null && !list.allTeams ? 'Proofs show for your own team.' : 'No proofs yet.';
  const ui = proofsUi(rows, { args: a, n, more: list.more, images, unit: tile ? unitFor(tile) : '', teams: list.allTeams }, empty);
  // An older plugin skips an answer equal to the last one in this slot, even into a new tile's empty
  // slot — so reopening a tile would sit on "Loading proofs…". A plugin that draws images doesn't.
  if (!images && ui.t === 'col') ui.k = `proofs:${tileId}:${Date.now()}`;
  return { ui };
}

async function proofDeleteAct(request: Request, a: Args, reason: string | undefined): Promise<View> {
  const ps = await proofScope(request, positive(a.ev));
  const id = positive(a.id);
  let error: string | null = null;
  if (!ps || !id || ps.viewer.userId == null) error = 'Sign in to the plugin to remove proofs.';
  else if (!(await rateLimit(request, `plugin-proof-delete:${ps.viewer.userId}`, { limit: 20, windowMs: 60_000 })).ok) error = 'Slow down a moment and try again.';
  else error = await deleteTileProof(ps.event, id, ps.viewer, reason?.trim().slice(0, 300) || 'Removed from the RuneLite panel');
  return boardView(request, a, error);
}

async function teamsView(request: Request, a: Args): Promise<View> {
  const scope = positive(a.event) ? null : await pluginBoardScope(request, null);
  const event = positive(a.event) ?? scope?.event.id ?? 0;
  const state = { event, team: positive(a.team) ?? 0, page: positive(a.page) ?? 1, back: positive(a.back) ?? 1 };
  const q = (a.q ?? '').trim().slice(0, 40);
  const data = event ? await pluginRoster(request, event, { query: q, team: state.team || null, page: state.page, pageSize: 25 }) : null;
  const players = !!data && (data.mode === 'players' || (data.mode === 'search' && !!data.ranked));
  return { ui: a.part === 'list' ? rosterUi(data, state) : withBack(a, players ? 'Players' : 'Teams', teamsUi(data, state, q)) };
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
  const noClan = 'You’re not in a clan or an event on Anvil yet — join one on the site and it shows here.';
  if (!res.ok) {
    return message(res.status === 404 ? noClan : 'Couldn’t reach Anvil — try again in a moment.');
  }
  const cfg = (await res.json()) as HomeConfig & { clanless?: boolean; event?: { startDate: string | null; endDate: string | null; forceEndedAt?: string | null } | null };
  // In no clan, but in a head-to-head drop race: the config answered only to carry the race's items
  // (lib/pluginConfigClanless). The Clan tab still has no clan to show.
  if (cfg.clanless) return message(noClan);
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
  const [feed, roster, boards, ownClan, clanEvents, myBoards] = await Promise.all([
    auth
      ? buildActivity({ teamId: auth.teamId, eventId: auth.eventId, selfPlayerId: auth.playerId, selfRsn: auth.rsn, since: { sub: 0, comp: 0, rev: 0 } }).then((p) => p.activity)
      : Promise.resolve([]),
    live && cfg.event ? pluginRoster(request, cfg.event.id, { query: '', team: null, page: 1, pageSize: 50, window: true }) : Promise.resolve(null),
    Promise.all(
      liveWeeklies.map(async (w) => {
        const url = new URL(request.url);
        url.search = `?id=${w.id}${me ? `&rsn=${encodeURIComponent(me.rsn)}` : ''}`;
        const r = await weeklyRoute(new Request(url, { headers: request.headers }));
        type Row = { rank: number; rsn: string; gained: number };
        return [w.id, r.ok ? ((await r.json()) as { total: number; entries: Row[]; you?: Row | null }) : null] as const;
      }),
    ),
    !open && slug ? ownClanCard(request, slug) : Promise.resolve(null),
    // A creator space has no in-game clan events (lib/creatorSpaces).
    slug && cfg.activeClan?.kind !== 'creator' ? clanEventsFor(request, slug) : Promise.resolve([] as ClanEventView[]),
    !open ? otherLiveBoards(request, cfg.event?.id ?? cfg.homeBoard?.eventId ?? null) : Promise.resolve([] as BoardSummary[]),
  ]);
  // Hidden standings: the roster above came back unranked; say why where the table would be.
  // clan-scope: global -- the board this caller's own config just named.
  const curtainEvent = live && cfg.event ? await db.query.events.findFirst({ where: eq(events.id, cfg.event.id) }) : null;
  const curtain = curtainEvent
    ? curtainInfo(await standingsScopeForPlugin(curtainEvent, { userId: auth?.userId ?? null, teamId: auth?.teamId ?? null }))
    : null;
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  const weekly: HomeData['weekly'] = new Map();
  for (const [id, b] of boards) {
    if (!b) continue;
    const top = (b.entries ?? []).map((e) => ({ ...e, self: !!me && norm(e.rsn) === norm(me.rsn) }));
    // Past the top 50 the route still names your own row.
    weekly.set(id, { total: b.total, top, you: top.find((e) => e.self) ?? (b.you ? { ...b.you, self: true } : null) });
  }
  // Cheap and best effort: the support line is a nudge, never a reason the panel fails.
  const viewer = await verifyPluginTokenUser(request).catch(() => null);
  const supportCta = !(viewer && (await supporterForUser(viewer.userId).catch(() => null)));
  const chatEventId = cfg.event?.id ?? null;
  const data: HomeData = {
    feedTab: hasTabArgs(request),
    chatOn: chatEventId ? await boardChatOn(chatEventId).catch(() => true) : false,
    cfg,
    supportCta,
    live,
    inGame: !!me,
    feed,
    standings: roster && roster.mode === 'teams' ? roster.teams.filter((t) => t.rank != null).sort((x, y) => x.rank! - y.rank!) : [],
    // A players board: the cut list, once anyone is ranked (hidden standings come back unranked).
    soloStandings: roster && roster.mode === 'players' && roster.window && roster.players.some((p) => p.rank != null) ? roster.window : null,
    // 12+ teams of any size: the cut list worded as teams, once anyone is ranked.
    teamStandings: roster && roster.mode === 'teams' && roster.window && roster.teams.some((t) => t.rank != null) ? roster.window : null,
    // Plain UTC: the panel has no browser locale to format with.
    standingsNotice: curtain
      ? standingsHiddenNotice(curtain, (iso) => new Date(iso).toUTCString().replace(':00 GMT', ' UTC'))
      : null,
    weekly,
    pins: a.track === '1' ? (a.pins ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0) : null,
    chosen: a.chosen === '1',
    ownClan,
    boardPath: cfg.event ? `${clanPath}/events/${cfg.event.id}` : null,
    clanPath,
    now,
    clanEvents,
    myBoards,
    raceBoard: open === 'board' && live && cfg.event?.race ? await raceBoardFor(request, a, cfg.event ? `${clanPath}/events/${cfg.event.id}` : null) : null,
  };
  return { ui: (open && eventUi(data, open)) || homeUi(data) };
}

/**
 * Every other live board the played character is on, in any clan it may see (lib/pluginBoards) —
 * display only, so it works for a plugin that tracks one board as much as for one that tracks all.
 * Best effort: a failure here never takes the tab down.
 */
async function otherLiveBoards(request: Request, shown: number | null): Promise<BoardSummary[]> {
  try {
    const member = await resolvePluginMember(request, { hintOnly: pluginRsnHintOnly(request) });
    if (!member) return [];
    return await summarizeBoards(await liveBoardsForCharacter(request, member.accountId, { except: shown, preferClanId: member.clanId }));
  } catch {
    return [];
  }
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
  const playerId = await viewerPlayerId(request);
  const member = await canSeeClan({ clanId: clan.id, visibility: 'private', playerId, userId: user.userId });
  if (!member) return message('Only members of this clan can say they’re going.');
  if (!(await rateLimit(request, `plugin-clan-event-going:${user.userId}`, { limit: 20, windowMs: 60_000 })).ok) return back();
  const r = await setGoing(clan.id, Number(a.id), { userId: user.userId, playerId: playerId ?? null, displayName: null }, a.going === '1');
  return r.ok ? back() : message(r.error);
}

/** Your clan's card under its events; the same answer for a few minutes, the clan doesn't change by the second. */
async function ownClanCard(request: Request, slug: string): Promise<Node | null> {
  const clan = await visibleClan(request, slug);
  if (!clan) return null;
  return clanCardUi(await ttlMemo(`plugin-ui-clan-card:${clan.id}`, () => loadClanCard(clan), 5 * 60_000), false, hasFeedTab(request), hasTabLinks(request), hasPanelImages(request));
}

/** Supporters' names in a finished view get their flair: one lookup for every name it shows. */
async function flaired(view: View | null): Promise<View | null> {
  if (!view) return view;
  const names = namesIn(view.ui);
  // Each name in its owner's own colours (a Champion's preset, a Patron's custom stops).
  const inks = names.length ? await supporterInksForRsns(names).catch(() => new Map<string, SupporterInk>()) : new Map<string, SupporterInk>();
  applyFlair(view.ui, (name) => {
    const ink = inks.get(normalizeRsn(name));
    return ink ? inkForSurface(ink, 'dark') : null;
  });
  return view;
}

/** Clanmates react; in the lab clan, so does staff testing it. */
async function canReactIn(request: Request, userId: number, clan: { id: number; slug: string }): Promise<boolean> {
  if (await isClanMember(userId, clan.id)) return true;
  return clan.slug === LAB_CLAN_SLUG && (await pluginStaff(request));
}

/** The clan's Recent drops with their reactions: never cached, the counts are the point. */
async function momentsView(request: Request, a: Args, note?: string): Promise<View> {
  const clan = await visibleClan(request, a.slug ?? '');
  if (!clan) return message('That clan isn’t listed on Anvil.');
  const n = Math.min(FEED_MAX, Math.max(FEED_STEP, positive(a.n) ?? FEED_STEP));
  const viewer = await verifyPluginTokenUser(request);
  const rows = (await momentsForClan(clan.id, n + 12)).filter((m) => FEED_KINDS.has(m.kind));
  const shown = rows.slice(0, n);
  const [summaries, supporter, member] = await Promise.all([
    reactionSummaries(shown.map((m) => m.id), viewer?.userId ?? null),
    viewer ? supporterForUser(viewer.userId) : Promise.resolve(null),
    viewer ? canReactIn(request, viewer.userId, clan) : Promise.resolve(false),
  ]);
  const items: FeedItem[] = shown.map((m) => ({
    id: m.id,
    rsn: m.rsn,
    label: m.itemName ?? m.source ?? m.kind,
    itemId: m.itemId,
    kind: m.kind,
    at: m.occurredAt,
    ...(summaries.get(m.id) ?? NO_REACTIONS),
  }));
  const feed = momentsFeedUi(items, { slug: clan.slug, n, more: rows.length > n, canGold: !!supporter, canReact: member });
  return { ui: note ? col([text(note, 'error', { wrap: true }), gap(4), feed]) : feed };
}

async function reactAct(request: Request, a: Args): Promise<View> {
  const viewer = await verifyPluginTokenUser(request);
  const clan = await visibleClan(request, a.slug ?? '');
  const id = positive(a.id);
  // The old Recent drops list: its drops take a GZ or a gold one, never a death's Sad / Sit.
  const kind = (['gz', 'gold'] as const).find((k) => k === a.kind);
  if (!viewer || !clan || !id || !kind) return momentsView(request, a, 'Couldn’t react to that.');
  const rl = await rateLimit(request, `plugin-react:${viewer.userId}`, { limit: 40, windowMs: 60_000 });
  if (!rl.ok) return momentsView(request, a, 'Slow down a little — try again in a minute.');
  if (!(await canReactIn(request, viewer.userId, clan))) return momentsView(request, a, 'Only clanmates can GZ these drops.');
  if (kind === 'gold' && !(await supporterForUser(viewer.userId))) {
    return momentsView(request, a, 'Gold GZs are an Anvil Supporter reaction.');
  }
  if (!(await momentInClan(id, clan.id))) return momentsView(request, a, 'That drop isn’t in this clan’s feed.');
  await toggleReaction(id, viewer.userId, kind);
  emitReactionRows(id, viewer.userId);
  return momentsView(request, a);
}

/**
 * A reaction from a live Feed row: the plugin has already flipped it on screen, so the answer is just
 * whether it stuck (an error line) — nothing is redrawn. A clan's row (`slug`) takes a GZ, or a
 * death's Sad / Sit, from a clanmate; a board's death (`e`) takes Sad / Sit from anyone playing on it.
 */
async function reactRowAct(request: Request, a: Args): Promise<View> {
  const viewer = await verifyPluginTokenUser(request);
  const id = positive(a.id);
  const eventId = a.e ? positive(a.e) : null;
  const clan = a.e ? null : await visibleClan(request, a.slug ?? '');
  if (!viewer || !id || !(eventId || clan)) return { ui: text(REACT_ERRORS.bad, 'error') };
  const rl = await rateLimit(request, `plugin-react:${viewer.userId}`, { limit: 40, windowMs: 60_000 });
  if (!rl.ok) return { ui: text('Slow down a little.', 'error') };
  // The rule is shared with the site's reactions (lib/reactionAccess), so the two can't drift.
  const verdict = eventId
    ? await checkReaction(viewer.userId, { eventId }, id, a.kind, { seat: chatCharacter(request) })
    : await checkReaction(viewer.userId, { clanId: clan!.id }, id, a.kind, {
        labStaff: clan!.slug === LAB_CLAN_SLUG && (await pluginStaff(request)),
      });
  if (!verdict.ok) return { ui: text(verdict.error, 'error') };
  await toggleReaction(id, viewer.userId, verdict.kind);
  // Everyone else's open Feed (and this person's other clients) follows live.
  emitReactionRows(id, viewer.userId);
  return { ui: gap(0) };
}

export async function pluginView(request: Request, v: string, a: Args): Promise<View | null> {
  return flaired(await viewFor(request, v, a));
}

async function viewFor(request: Request, v: string, a: Args): Promise<View | null> {
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
      return clansView(request, a.q ?? '');
    case 'goals':
      return goalsView(request);
    case 'h2h':
      return h2hView(request);
    case 'goal-new':
      return goalFormView(request, a.kind ?? 'skill');
    case 'board':
      return boardView(request, a);
    case 'teams':
      return teamsView(request, a);
    case 'proofs':
      return proofsView(request, a);
    case 'home':
      return homeView(request, a);
    case 'moments':
      return momentsView(request, a);
    case 'feed':
      return feedView(request, a);
    default:
      return null;
  }
}

/** An action from the panel: `args` as the view gave them, `fields` from its inputs. */
export async function pluginAct(request: Request, act: string, args: Args, fields: Args): Promise<View | null> {
  return flaired(await actFor(request, act, args, fields));
}

async function actFor(request: Request, act: string, args: Args, fields: Args): Promise<View | null> {
  // The one thing a character that isn't this login's may do: ask for it (and run its XP check).
  if (act === 'ownership-claim' || act === 'ownership-check') return ownershipClaimAct(request, act, args);
  // Every other action is refused for somebody else's character (lib/pluginForeign) — even the ones
  // that are the login's own (a reaction, "I'm going", chat), so nothing is done while on it.
  const foreign = await pluginCharacterRefusal(request, { allowUnclaimed: true }).catch(() => null);
  if (foreign) return message(foreign.error);
  if (act === 'claim' || act === 'unclaim') return claimAct(request, act, args, fields.note);
  if (act === 'race-pick') return racePickAct(request, args);
  if (act === 'proof-delete') return proofDeleteAct(request, args, fields.note);
  if (act === 'clan-event-going') return clanEventGoingAct(request, args);
  if (act === 'react') return reactAct(request, args);
  if (act === 'react-row') return reactRowAct(request, args);
  if (act === 'h2h-accept' || act === 'h2h-decline') return h2hAct(request, act, args);
  const chat = await chatAct(request, act, args, fields);
  if (chat) return chat;
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
