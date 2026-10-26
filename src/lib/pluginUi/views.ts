import { and, eq, ilike, or } from 'drizzle-orm';

import { db } from '@/db';
import { clans, memberClogItems, settings } from '@/db/schema';
import { apexCharacter } from '@/lib/apexProfiles';
import { verifyPluginTokenUser } from '@/lib/auth';
import { loadClanCard } from '@/lib/clanCard';
import { listedClanWhere, showcaseJoinOn } from '@/lib/clanListing';
import { clogPageItems, clogPageNames } from '@/lib/clogDataset';
import { caLookup, combatTasks } from '@/lib/combatTasks';
import { deleteGoal, goalsWithProgress, saveGoal } from '@/lib/goals';
import { getMemberItems } from '@/lib/memberProgressRead';
import { loadPlayerCard } from '@/lib/playerCard';
import { accountForCharacter, accountStanding, playedCharacter } from '@/lib/pluginAccount';
import { rateLimit } from '@/lib/rate-limit';

import { clanCardUi, clanCompareUi, clanSearchUi } from './clanUi';
import { lookupPlayerCard, viewerPlayerId, visibleClan } from './load';
import { type View, button, col, gap, message } from './nodes';
import { notFoundUi, playerCardUi } from './playerCardUi';
import { casUi, clogPageUi, compareUi, dueOnFrom, goalFormUi, goalsUi } from './playerMoreUi';

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
    default:
      return null;
  }
}

/** An action from the panel: `args` as the view gave them, `fields` from its inputs. */
export async function pluginAct(request: Request, act: string, args: Args, fields: Args): Promise<View | null> {
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
