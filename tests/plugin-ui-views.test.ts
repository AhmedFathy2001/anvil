// The plugin's Lookup and You tabs are built by the site (lib/pluginUi/views) and only drawn by the
// plugin. This drives the views and the goal actions against a real database, as the route would.
//
// Run: npx tsx --test tests/plugin-ui-views.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
import type { Node } from '../src/lib/pluginUi/nodes.ts';

const DB = useTestDatabase('plugin-ui-views');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let V: typeof import('../src/lib/pluginUi/views.ts');

const TOKEN = 'ui-token';

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  V = await import('../src/lib/pluginUi/views.ts');

  const [me] = await db.insert(s.players).values({ displayName: 'Me' }).returning();
  await db.insert(s.users).values({ displayName: 'me', discordId: 'disc-me', pluginToken: TOKEN, playerId: me.id });
  const [mine] = await db.insert(s.accounts).values({ playerId: me.id, rsn: 'Ui Main', rsnNormalized: 'ui main', shared: false, claimedAt: new Date().toISOString() }).returning();
  await db.insert(s.memberClog).values({ accountId: mine.id, obtained: 1, total: 1600, pagesSynced: 1, pagesTotal: 1, syncedAt: new Date().toISOString() });
  await db.insert(s.memberClogItems).values({ accountId: mine.id, itemId: 12921, pageName: 'Zulrah', quantity: 1 });

  const [other] = await db.insert(s.players).values({ displayName: 'Other' }).returning();
  await db.insert(s.accounts).values({ playerId: other.id, rsn: 'Ui Shared', rsnNormalized: 'ui shared', shared: true, claimedAt: new Date().toISOString() });
  await db.insert(s.accounts).values({ playerId: other.id, rsn: 'Ui Hidden', rsnNormalized: 'ui hidden', shared: false });
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

const req = (headers: Record<string, string> = {}) => new Request('http://site/api/plugin/ui', { headers });
const asMe = () => req({ Authorization: `Bearer ${TOKEN}`, 'X-RSN': 'Ui Main' });

function texts(n: Node): string[] {
  const out: string[] = [];
  const walk = (x: unknown) => {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) return x.forEach(walk);
    const o = x as Record<string, unknown>;
    if (o.t === 'text' && typeof o.s === 'string') out.push(o.s);
    if (o.t === 'button' && typeof o.label === 'string') out.push(o.label);
    Object.values(o).forEach(walk);
  };
  walk(n);
  return out;
}

test('a shared character is anyone’s card; a private one reads as not on Anvil, except to its owner', async () => {
  const shared = await V.pluginView(req(), 'player', { rsn: 'Ui Shared' });
  assert.ok(texts(shared!.ui).includes('Ui Shared'));

  // The hiscores fallback would go to Jagex for a name it can't show; a private name must not leak
  // either way, so only the owner's own token turns it into a card.
  const mine = await V.pluginView(asMe(), 'player', { rsn: 'Ui Main' });
  assert.ok(texts(mine!.ui).includes('Ui Main'));
  assert.ok(!texts(mine!.ui).some((t) => t.startsWith('Not on Anvil')));
});

test('You: your own private card with goals; nobody logged in gets a line, not a card', async () => {
  const you = await V.pluginView(asMe(), 'you', {});
  assert.ok(texts(you!.ui).includes('Ui Main'));
  assert.ok(texts(you!.ui).includes('Goals'));
  assert.ok(!texts(you!.ui).some((t) => t.startsWith('Log in to a character that is yours')), 'it is yours, so goals are kept');
  const nobody = await V.pluginView(req({ Authorization: `Bearer ${TOKEN}` }), 'you', {});
  assert.deepEqual(texts(nobody!.ui), ['Log in to a character to see your card.']);
});

test('goals: add from the form, then remove; someone else’s character can’t keep goals', async () => {
  const form = await V.pluginView(asMe(), 'goal-new', { kind: 'clog' });
  assert.ok(texts(form!.ui).includes('Log page'), 'the log is synced, so pages are offered');

  const added = await V.pluginAct(asMe(), 'goal-add', { kind: 'skill' }, { metric: 'slayer', target: '99', due: '30' });
  assert.ok(texts(added!.ui).includes('99 Slayer'));
  const [goal] = await db.select().from(s.playerGoals);
  assert.match(goal.dueOn ?? '', /^\d{4}-\d{2}-\d{2}$/);

  const refused = await V.pluginAct(asMe(), 'goal-add', { kind: 'skill' }, { metric: 'notaskill', target: '99', due: '' });
  assert.ok(texts(refused!.ui).some((t) => t.length > 0 && !t.includes('Slayer') && t !== 'Goals' && t !== '+ Add goal'), 'the reason shows');

  const removed = await V.pluginAct(asMe(), 'goal-remove', { id: String(goal.id) }, {});
  assert.ok(!texts(removed!.ui).includes('99 Slayer'));

  const notMine = await V.pluginAct(req({ Authorization: `Bearer ${TOKEN}`, 'X-RSN': 'Ui Shared' }), 'goal-add', { kind: 'skill' }, { metric: 'slayer', target: '99' });
  assert.ok(texts(notMine!.ui).some((t) => t.startsWith('Log in to a character that is yours')));
});

test('a log page marks what is owned, faint for the rest', async () => {
  const page = await V.pluginView(asMe(), 'clog-page', { rsn: 'Ui Main', page: 'zulrah', back: 'cat:Bosses' });
  const icons: { item?: number; dim?: boolean }[] = [];
  const walk = (x: unknown) => {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) return x.forEach(walk);
    const o = x as Record<string, unknown>;
    if (o.t === 'icon' && typeof o.item === 'number') icons.push(o as { item: number; dim?: boolean });
    Object.values(o).forEach(walk);
  };
  walk(page!.ui);
  assert.equal(icons.find((i) => i.item === 12921)?.dim, false);
  assert.ok(icons.some((i) => i.dim === true));
});

test('unknown views and actions are refused, so the plugin can only ask for what is listed', async () => {
  assert.equal(await V.pluginView(req(), 'admin', {}), null);
  assert.equal(await V.pluginAct(asMe(), 'delete-everything', {}, {}), null);
});

test('the board page: an enrolled player claims a tile from it, and the Teams page lists the team', async () => {
  const [clan] = await db.insert(s.clans).values({ slug: 'uiboard', name: 'UI Board' }).returning();
  const [ev] = await db
    .insert(s.events)
    .values({ clanId: clan.id, name: 'Live Bingo', boardSize: 5, tilesRevealed: 1, startDate: new Date(Date.now() - 864e5).toISOString() })
    .returning();
  const [team] = await db.insert(s.teams).values({ eventId: ev.id, name: 'Red', color: '#ff0000' }).returning();
  const [fire] = await db.insert(s.tiles).values({ eventId: ev.id, position: 0, label: 'Fire cape', tileType: 'drop', trackedItemIds: '[6570]' }).returning();
  const [person] = await db.insert(s.players).values({ displayName: 'Board Player' }).returning();
  await db.insert(s.users).values({ playerId: person.id, displayName: 'Board Player', discordId: 'ui-board', pluginToken: 'ui-board-token' });
  const [acct] = await db.insert(s.accounts).values({ playerId: person.id, rsn: 'Board Main', rsnNormalized: 'board main' }).returning();
  const [seat] = await db.insert(s.clanMemberships).values({ clanId: clan.id, accountId: acct.id, kind: 'member', source: 'roster' }).returning();
  await db.insert(s.eventParticipants).values({ eventId: ev.id, teamId: team.id, clanMemberId: seat.id, accountId: acct.id, name: 'Board Main' });
  const asPlayer = () =>
    new Request('https://example.test/api/plugin/ui', { headers: { Authorization: 'Bearer ui-board-token', 'X-RSN': 'Board Main', 'x-anvil-clan-slug': 'uiboard' } });

  const page = await V.pluginView(asPlayer(), 'board', { event: '0', clan: 'uiboard', track: '1', pins: '' });
  assert.ok(texts(page!.ui).includes('1 visible tile'));
  assert.ok(texts(page!.ui).includes('Fire cape'));
  assert.ok(texts(page!.ui).includes('Click for details · right-click to claim.'));

  const claimed = await V.pluginAct(asPlayer(), 'claim', { event: '0', tile: String(fire.id), part: 'rows', clan: 'uiboard' }, { note: 'tonight' });
  assert.ok(texts(claimed!.ui).includes('You (tonight)'), JSON.stringify(texts(claimed!.ui)));
  assert.ok(texts(claimed!.ui).includes('Change note…'));
  const dropped = await V.pluginAct(asPlayer(), 'unclaim', { event: '0', tile: String(fire.id), part: 'rows' }, {});
  assert.ok(texts(dropped!.ui).includes('Claim tile'));

  // Someone not on the board reads it, but can't claim on it.
  const outsider = await V.pluginView(req({ 'x-anvil-clan-slug': 'uiboard' }), 'board', { event: String(ev.id) });
  assert.ok(texts(outsider!.ui).includes('Click for details · join this event to claim tiles.'));

  const teamsPage = await V.pluginView(asPlayer(), 'teams', { event: '0' });
  // One person a team: the roster ranks the players.
  assert.ok(texts(teamsPage!.ui).includes('Board Main'));
  const members = await V.pluginView(asPlayer(), 'teams', { event: String(ev.id), team: String(team.id), part: 'list' });
  assert.ok(texts(members!.ui).includes('Board Main'));

  // The Clan tab, off the same config the plugin polls: the board on the list, then its page.
  // An open-ended event (no end date) is running: the Clan tab reads it the way tracking does.
  const home = await V.pluginView(asPlayer(), 'home', { track: '1', pins: '' });
  assert.ok(texts(home!.ui).includes('Live Bingo'), JSON.stringify(texts(home!.ui)));
  const boardHome = await V.pluginView(asPlayer(), 'home', { open: 'board' });
  assert.ok(texts(boardHome!.ui).includes('All events'));
  assert.ok(texts(boardHome!.ui).includes('Nearest tiles'), JSON.stringify(texts(boardHome!.ui)));
  // From the page, "All tiles" comes back with a way home.
  const tilesPage = await V.pluginView(asPlayer(), 'board', { event: '0', back: 'board', backLabel: 'Live Bingo' });
  assert.ok(texts(tilesPage!.ui).includes('Live Bingo') && texts(tilesPage!.ui).includes('All tiles'));
});
