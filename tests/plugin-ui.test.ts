import { writeFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { CaLookup } from '../src/lib/combatTasks';
import type { GoalView } from '../src/lib/goalProgress';
import { shapePlayerCard, type PlayerCard, type PlayerCardInput } from '../src/lib/playerCardShape';
import { clanCardUi, clanSearchUi } from '../src/lib/pluginUi/clanUi';
import { type Action, type Node, col } from '../src/lib/pluginUi/nodes';
import { completionRow, feedTabUi, momentRow } from '../src/lib/pluginUi/feedUi';
import { h2hUi } from '../src/lib/pluginUi/h2hUi';
import { milestoneSubject, notFoundUi, playerCardUi, virtualLevel } from '../src/lib/pluginUi/playerCardUi';
import { casUi, compareUi, dueOnFrom, goalFormUi, goalsUi } from '../src/lib/pluginUi/playerMoreUi';

const input: PlayerCardInput = {
  rsn: 'Drenvox mdps',
  accountType: 'ironman',
  clan: { slug: 'theafkspot', name: 'The AFK Spot' },
  totalLevel: 2277,
  combatLevel: 126,
  overallXp: 512_000_000,
  ehp: 1210,
  ehb: 830,
  statsAt: '2026-10-12T09:00:00.000Z',
  bosses: [
    { key: 'zulrah', kc: 812 },
    { key: 'vorkath', kc: 1240 },
  ],
  skills: [
    { key: 'attack', level: 99, xp: 200_000_000 },
    { key: 'slayer', level: 87, xp: 4_000_000 },
  ],
  activities: [{ key: 'cluesHard', label: 'Clue Scrolls (hard)', shortLabel: 'Hard', group: 'clues', score: 41 }],
  bests: [{ activity: 'Zulrah', time: '0:58.20' }],
  clogHeader: { obtained: 600, total: 1600 },
  clogPages: [
    { name: 'Zulrah', obtained: 3, total: 8 },
    { name: 'Vorkath', obtained: 4, total: 4 },
  ],
  recentItems: [{ itemId: 12922, name: 'Tanzanite fang', at: '2026-10-11T12:00:00.000Z' }],
  milestones: [],
};
const card: PlayerCard = shapePlayerCard(input);

/** Every node in the tree, panes and toggle faces and tab bodies included. */
function walk(n: Node, out: Node[] = []): Node[] {
  out.push(n);
  for (const v of Object.values(n)) {
    if (v && typeof v === 'object') {
      for (const child of Array.isArray(v) ? v : Object.values(v).some((x) => x && typeof x === 'object' && 't' in x) && !('t' in v) ? Object.values(v) : [v]) {
        if (child && typeof child === 'object' && 't' in child) walk(child as Node, out);
        else if (child && typeof child === 'object' && 'c' in child && 'label' in child) walk((child as { c: Node }).c, out);
      }
    }
  }
  return out;
}

const actions = (n: Node) => walk(n).flatMap((x) => (x.on ? [x.on] : x.t === 'slot' && x.load ? [x.load] : []));
const texts = (n: Node) => walk(n).flatMap((x) => (x.t === 'text' && x.s ? [x.s] : []));

test('the hub rule: nothing in a view is a URL, and every link is a path on the site', () => {
  const ui = playerCardUi(card, { sectionKey: 'lookup', cas: true, me: 'Someone else' });
  assert.ok(!JSON.stringify(ui).includes('http'), 'no URL anywhere in the tree');
  const known = new Set(['site', 'lookup', 'clan', 'load', 'pane', 'flip', 'post']);
  for (const a of actions(ui)) {
    assert.ok(known.has(a.a), `unknown action ${a.a}`);
    if (a.a === 'site') assert.match(a.path, /^\/[^/]/);
  }
});

test('a card: identity, then Stats | Bosses | Collection log, the rest folded under them', () => {
  const ui = playerCardUi(card, { sectionKey: 'lookup', cas: true });
  const all = texts(ui);
  assert.ok(all.includes('Drenvox mdps'));
  assert.ok(all.includes('2,277 total · cb 126'));
  assert.ok(all.includes('600 / 1,600'), 'the log total heads its own tab');
  assert.ok(all.includes('Tanzanite fang'));
  const tabs = walk(ui).filter((x) => x.t === 'tabs') as Extract<Node, { t: 'tabs' }>[];
  assert.deepEqual(tabs[0].tabs.map((t) => t.label), ['Stats', 'Bosses', 'Log']);
  assert.equal(tabs[0].key, 'lookup');
  // Clues, Minigames & activities, Times and Combat tasks are an accordion: one toggle each, a raised
  // header (chevron, name, summary) with a flip action, and a body with real content.
  const acc = walk(ui).filter((x) => x.t === 'toggle') as Extract<Node, { t: 'toggle' }>[];
  const named = acc.filter((a) => a.key.startsWith('acc:lookup:'));
  assert.deepEqual(named.map((a) => a.key.slice('acc:lookup:'.length)), ['Clues', 'Times', 'Combat tasks']);
  for (const a of named) {
    assert.ok(walk(a.off).some((x) => x.on?.a === 'flip' && x.on.key === a.key), `${a.key} header flips`);
    assert.ok(walk(a.lit).some((x) => x.on?.a === 'flip' && x.on.key === a.key), `${a.key} header shuts it again`);
    assert.ok(walk(a.lit).length > walk(a.off).length, `${a.key} has a body`);
  }
  // Lookup keeps the log out of the top card; your own card carries its progress there.
  const own = texts(playerCardUi(card, { sectionKey: 'you', cas: false, own: true }));
  assert.ok(own.includes('Collection log'));
});

test('panel media, clan mark and this character’s display case are part of the player card', () => {
  const shown: PlayerCard = {
    ...card,
    clan: { slug: 'theafkspot', name: 'The AFK Spot', logoUrl: 'stored-but-never-sent-directly' },
    panelMedia: { avatar: true, avatarAnimated: true, banner: true, bannerAnimated: true },
    displayCase: [{ id: 1, kind: 'clog', itemId: 27277, statKey: null, headline: null, name: "Tumeken's shadow", source: 'Tombs of Amascut' }],
  };
  const ui = playerCardUi(shown, { sectionKey: 'lookup', cas: false, images: true });
  const images = walk(ui).filter((n): n is Extract<Node, { t: 'img' }> => n.t === 'img');
  assert.ok(images.some((n) => n.src.includes('kind=banner') && n.motion));
  assert.ok(images.some((n) => n.src.includes('kind=avatar') && n.motion && n.round));
  assert.ok(texts(ui).includes('Display case'));
  assert.ok(texts(ui).includes("Tumeken's shadow"));
  assert.ok(texts(ui).includes('The AFK Spot · Ironman · on Anvil'), 'the muted line');
  assert.ok(!JSON.stringify(ui).includes('stored-but-never-sent-directly'));
});

test('the log opens in place: categories, then pages, then a fetched page', () => {
  const ui = playerCardUi(card, { sectionKey: 'lookup', cas: false });
  const log = walk(ui).find((x) => x.t === 'slot' && x.id === 'log') as Extract<Node, { t: 'slot' }>;
  assert.ok(log.panes?.root && log.panes['cat:Bosses']);
  const loads = actions(log.panes['cat:Bosses']).filter((a): a is Extract<Action, { a: 'load' }> => a.a === 'load');
  assert.deepEqual(
    loads.map((a) => [a.v, a.args?.page, a.args?.back, a.args?.kc, a.into]),
    [
      ['clog-page', 'Vorkath', 'cat:Bosses', '1240', 'log'],
      ['clog-page', 'Zulrah', 'cat:Bosses', '812', 'log'],
    ],
  );
});

test('a boss cell opens its log page; a never-killed boss shows only while searching', () => {
  const ui = playerCardUi(card, { sectionKey: 'lookup', cas: false });
  const filter = walk(ui).find((x) => x.t === 'filter') as Extract<Node, { t: 'filter' }>;
  const cells = (filter.c[0] as Extract<Node, { t: 'grid' }>).c;
  const vork = cells.find((c) => c.k === 'Vorkath')!;
  assert.deepEqual(vork.on, { a: 'load', v: 'clog-page', args: { rsn: 'Drenvox mdps', page: 'Vorkath', back: 'root', kc: '1240' }, into: 'log' });
  const zero = cells.find((c) => c.k?.startsWith('Kraken'));
  assert.equal(zero?.q, true);
  assert.equal(filter.box, false, 'two bosses need no search box');
});

test('virtual levels are the lit face of a toggle', () => {
  const ui = playerCardUi(card, { sectionKey: 'you', cas: false });
  const t = walk(ui).find((x) => x.t === 'toggle') as Extract<Node, { t: 'toggle' }>;
  assert.ok(texts(t.off).includes('99'));
  assert.ok(!texts(t.off).includes('126'));
  assert.ok(texts(t.lit).includes('126'));
  assert.equal(virtualLevel(13_034_431), 99);
  assert.equal(virtualLevel(200_000_000), 126);
});

test('Compare with me: only for someone else, and never for a hiscores card', () => {
  const has = (ui: Node) => texts(ui).length > 0 && walk(ui).some((x) => x.t === 'button' && x.label === 'Compare with me');
  assert.ok(has(playerCardUi(card, { sectionKey: 'lookup', cas: true, me: 'Lynx Titan' })));
  assert.ok(!has(playerCardUi(card, { sectionKey: 'lookup', cas: true, me: 'drenvox MDPS ' })));
  const hiscores = { ...card, source: 'hiscores' as const, fetchedAt: '2026-10-12T09:00:00.000Z' };
  const ui = playerCardUi(hiscores, { sectionKey: 'lookup', cas: true, me: 'Lynx Titan' });
  assert.ok(!has(ui));
  assert.ok(!walk(ui).some((x) => x.t === 'slot'), 'no log and no CAs for a hiscores card');
  assert.ok(texts(notFoundUi('Nobody')).includes('Nobody'));
});

test('milestones wear their subject', () => {
  assert.equal(milestoneSubject('500 Zulrah KC'), 'Zulrah');
  assert.equal(milestoneSubject('50M Attack XP'), 'Attack');
  assert.equal(milestoneSubject('99 Attack'), 'Attack');
});

const cas: CaLookup = {
  tiers: ['Easy', 'Medium', 'Hard'],
  earned: 120,
  nextTier: 'Hard',
  nextAt: 200,
  perTier: [
    { done: 2, total: 2 },
    { done: 1, total: 2 },
    { done: 0, total: 1 },
  ],
  monsters: [
    {
      name: 'Vorkath',
      done: 1,
      total: 3,
      tasks: [
        { n: 'Dodge', t: 1, y: null, d: false, x: 'Dodge it' },
        { n: 'Speed', t: 2, y: 'Speed', d: false, x: null },
        { n: 'Kill', t: 1, y: null, d: true, x: null },
      ],
    },
    { name: 'Zulrah', done: 2, total: 2, tasks: [{ n: 'Snake', t: 0, y: null, d: true, x: null }, { n: 'Snake 2', t: 0, y: null, d: true, x: null }] },
  ],
};

test('CAs: the switches reload the view with their filter; a tier drops bosses without one', () => {
  const ui = casUi('Drenvox mdps', cas, { tier: 1, byTask: false, missingOnly: false });
  assert.ok(texts(ui).includes('Medium'), 'reached the tier before the next one');
  const folds = walk(ui).filter((x) => x.t === 'fold');
  assert.equal(folds.length, 1, 'Zulrah has no Medium task');
  const reloads = actions(ui).filter((a): a is Extract<Action, { a: 'load' }> => a.a === 'load');
  assert.ok(reloads.every((a) => a.v === 'cas' && a.into === 'cas'));
  assert.ok(reloads.some((a) => a.args?.tier === '-1'), 'clicking the picked tier clears it');
  assert.ok(reloads.some((a) => a.args?.mode === 'task'));

  const missing = casUi('Drenvox mdps', cas, { tier: -1, byTask: true, missingOnly: true });
  assert.deepEqual(
    texts(missing).filter((s) => /^[✗✓] /.test(s) && !s.endsWith('Missing only')),
    ['✗ Dodge', '✗ Speed'],
  );
});

test('compare: headline rows lead in orange, then the biggest gaps', () => {
  const them = shapePlayerCard({ ...input, rsn: 'Lynx Titan', totalLevel: 2376, bosses: [{ key: 'vorkath', kc: 10 }] });
  const ui = compareUi(card, them);
  const total = walk(ui).find((x) => x.t === 'grid' && texts(x)[0] === 'Total level') as Extract<Node, { t: 'grid' }>;
  assert.deepEqual(
    total.c.map((c) => (c.t === 'text' ? c.color : null)),
    ['muted', 'white', 'brand'],
  );
  assert.ok(walk(ui).some((x) => x.t === 'button' && x.on?.a === 'site' && x.on.path === '/compare?a=Drenvox%20mdps&b=Lynx%20Titan'));
});

test('goals: remove posts the id, and the form only offers log pages once the log is synced', () => {
  const goals: GoalView[] = [
    { id: 4, kind: 'skill', metric: 'slayer', target: 99, label: '99 Slayer', current: 4_000_000, of: 13_034_431, text: 'Lv 87 / 99', done: false, due: null },
  ];
  const ui = goalsUi(goals, null);
  const menus = walk(ui).flatMap((n) => (n as { menu?: { on: Action }[] }).menu ?? []);
  assert.ok(menus.some((m) => m.on.a === 'post' && m.on.act === 'goal-remove' && m.on.args?.id === '4'), 'remove is on the row menu');
  assert.ok(JSON.stringify(ui).includes('+ New goal'));
  const kinds = (pages: string[]) =>
    texts(goalFormUi('skill', pages)).filter((s) => ['Skill level', 'Boss kills', 'Log page'].includes(s));
  assert.deepEqual(kinds([]), ['Skill level', 'Boss kills']);
  assert.deepEqual(kinds(['Zulrah']), ['Skill level', 'Boss kills', 'Log page']);
  const clog = goalFormUi('clog', ['Zulrah']);
  assert.ok(!walk(clog).some((x) => x.t === 'input' && x.name === 'target'), 'a log page has no target');
  assert.equal(dueOnFrom('30', new Date('2026-10-01T10:00:00Z')), '2026-10-31');
  assert.equal(dueOnFrom(''), null);
});

test('clans: members open in Lookup, compare only when offered, search rows open the clan', () => {
  const ui = clanCardUi(
    {
      slug: 'theafkspot',
      name: 'The AFK Spot',
      logoUrl: 'https://example.com/logo.png',
      members: 144,
      activeThisWeek: 60,
      weekHours: 512.4,
      totalEhp: 9000,
      totalEhb: 4000,
      topWeek: [{ rsn: 'Zezima', hours: 20.5 }],
      topPlayers: [{ rsn: 'Zezima', overallXp: 4_600_000_000 }],
      clog: null,
      highlights: [],
      competitions: [{ type: 'boss', metric: 'vorkath', label: 'Vorkath' }],
    },
    false, false, false, true,
  );
  assert.ok(!JSON.stringify(ui).includes('http'), 'the clan logo URL never reaches the plugin');
  assert.ok(actions(ui).some((a) => a.a === 'lookup' && a.rsn === 'Zezima'));
  assert.ok(!walk(ui).some((x) => x.t === 'button'));
  assert.ok(texts(ui).includes('Running:') && texts(ui).includes('BOTW Vorkath'));
  const mark = walk(ui).find((n) => n.t === 'img' && n.src.includes('kind=logo')) as Extract<Node, { t: 'img' }>;
  assert.equal(mark.round, true);
  assert.equal(mark.motion, true, 'an uploaded clan logo may animate without the banner boost gate');
  assert.ok(actions(clanSearchUi('afk', [{ slug: 'theafkspot', name: 'The AFK Spot' }])).some((a) => a.a === 'load' && a.v === 'clan'));
});

test('a creator space in the panel: its name and page, never members, a week or "Compare with my clan"', () => {
  const card = {
    slug: 'cool-streamer',
    name: 'Cool Streamer',
    kind: 'creator' as const,
    logoUrl: null,
    members: 0,
    activeThisWeek: 0,
    weekHours: 0,
    totalEhp: 0,
    totalEhb: 0,
    topWeek: [],
    topPlayers: [],
    clog: null,
    highlights: [],
    competitions: [],
  };
  // Even asked to offer the compare button, a space's card has none.
  const ui = clanCardUi(card, true);
  const all = texts(ui).join(' | ');
  assert.ok(all.includes('Cool Streamer'));
  assert.ok(all.includes('Events by Cool Streamer on Anvil'));
  assert.ok(!/member|clan|this week/i.test(all), all);
  assert.ok(!walk(ui).some((x) => x.t === 'button'), 'no compare button');
  assert.ok(actions(ui).some((a) => a.a === 'site' && a.path === '/c/cool-streamer'));
  // An ordinary clan's card is unchanged: members line and the compare button when offered.
  const clan = clanCardUi({ ...card, kind: 'clan', slug: 'afk', name: 'The AFK Spot', members: 12 }, true);
  assert.ok(texts(clan).some((t) => t.startsWith('12 members')));
  assert.ok(walk(clan).some((x) => x.t === 'button' && x.label === 'Compare with my clan'));
});

test('recent drops point at the Feed tab: a link for a plugin that can open it, a hint for an older one', () => {
  const card = {
    slug: 'afk', name: 'The AFK Spot', kind: 'clan' as const, logoUrl: null, members: 3, activeThisWeek: 0,
    weekHours: 0, totalEhp: 0, totalEhb: 0, topWeek: [], topPlayers: [], clog: null, competitions: [],
    highlights: [{ itemId: 26235, label: 'Masori mask', kind: 'drop', at: '2026-11-04T10:00:00Z', rsn: 'Titoo' }],
  } as unknown as Parameters<typeof clanCardUi>[0];
  const link = clanCardUi(card, false, true, true);
  assert.ok(actions(link).some((a) => a.a === 'tab' && a.tab === 'feed'));
  const hint = clanCardUi(card, false, true, false);
  assert.ok(!actions(hint).some((a) => a.a === 'tab'));
  assert.ok(texts(hint).includes('The full list, live, is in the Feed tab.'));
});

// ---- The board's tiles page and the Teams page ------------------------------------------------

import { type BoardContext, type BoardTile, boardRowsUi, boardUi, claimLine, filterTiles, tileDetailUi, trackingLines } from '../src/lib/pluginUi/boardUi';
import { rosterUi, teamLine } from '../src/lib/pluginUi/teamsUi';

const tileOf = (id: number, extra: Partial<BoardTile> = {}): BoardTile =>
  ({
    tileId: id,
    position: id,
    label: `Tile ${id}`,
    description: null,
    points: 10,
    tier: null,
    tierKey: null,
    category: null,
    tileType: 'drop',
    statType: null,
    statName: null,
    statLabel: null,
    itemIds: [1],
    trackedItems: [{ itemId: 1, name: 'Thing' }],
    requiredAmount: 1,
    requirement: null,
    howItCounts: null,
    sources: [],
    autoTrackDisabled: 0,
    complete: false,
    ...extra,
  }) as BoardTile;

const boardOf = (tiles: BoardTile[], readOnly = false) =>
  ({ eventId: 7, name: 'Bingo', readOnly, tilesRevealed: true, tiles, teams: [{ teamId: 1, name: 'Red', color: '#ff0000', completedTileIds: [2] }] }) as never;
const ctxOf = (extra: Partial<BoardContext> = {}): BoardContext => ({ eventId: 7, claimBlock: null, pins: [], progress: new Map(), boardPath: '/c/afk/events/7', ...extra });
const state = { event: 0, pre: false, q: '', status: 'all' as const, page: 0 };

test('board search: a category name brings its tiles first; nicknames find bosses; statuses split open tiles', () => {
  const tiles = [
    tileOf(1, { label: 'Big hilt energy', sources: ['General Graardor'], category: 'GWD' }),
    tileOf(2, { label: 'Tombs of Amascut purple', complete: true }),
    tileOf(3, { label: 'Zulrah scales', category: 'PvM' }),
    tileOf(4, { label: 'Barrows set', tileType: 'drop', itemRequirements: [{ itemId: 5, name: 'Ahrim hood', requiredAmount: 1, currentAmount: 0, group: 'Ahrim', groupRequire: 0 }] }),
  ];
  const progress = new Map([[3, { current: 20, goal: 100 }]]);
  assert.deepEqual(filterTiles(tiles, 'graardor', 'all', false, progress).map((t) => t.tileId), [1]);
  assert.deepEqual(filterTiles(tiles, 'toa', 'all', false, progress).map((t) => t.tileId), [2]);
  assert.deepEqual(filterTiles(tiles, 'pvm', 'all', false, progress).map((t) => t.tileId), [3]);
  assert.deepEqual(filterTiles(tiles, 'set', 'all', false, progress).map((t) => t.tileId), [4]);
  assert.deepEqual(filterTiles(tiles, '', 'open', false, progress).map((t) => t.tileId), [1, 3, 4]);
  assert.deepEqual(filterTiles(tiles, '', 'progress', false, progress).map((t) => t.tileId), [3]);
  assert.deepEqual(filterTiles(tiles, '', 'new', false, progress).map((t) => t.tileId), [1, 4]);
  assert.deepEqual(filterTiles(tiles, '', 'closest', false, progress)[0].tileId, 3);
  assert.deepEqual(filterTiles(tiles, '', 'done', true, progress), [], 'nothing is done before the start');
});

test('board rows: fifteen a page, every page and detail carried as a pane, and the menu claims or says why not', () => {
  const tiles = Array.from({ length: 20 }, (_, i) => tileOf(i + 1));
  const first = boardRowsUi(boardOf(tiles), state, ctxOf());
  assert.ok(texts(first).includes('1–15 of 20'));
  const rows = walk((first as Extract<Node, { t: 'slot' }>).c).filter((x) => x.menu);
  assert.equal(rows.length, 15);
  assert.deepEqual(rows[0].on, { a: 'pane', into: 'tile', pane: 't:1' });
  const panes = (first as Extract<Node, { t: 'slot' }>).panes!;
  assert.deepEqual(Object.keys(panes).length, 2 + 20, 'two pages and a detail per tile');
  const next = walk(first).find((x) => x.t === 'button' && x.label === 'Next ›') as Extract<Node, { t: 'button' }>;
  assert.deepEqual(next.on, { a: 'pane', into: 'tile', pane: 'p1' });
  const back = (id: number) => (walk(panes[`t:${id}`]).find((x) => x.tip === 'Return to the searchable tile list') as { on: unknown }).on;
  assert.deepEqual(back(17), { a: 'pane', into: 'tile', pane: 'p1' }, 'a tile goes back to its own page');
  const opened = boardRowsUi(boardOf(tiles), state, ctxOf(), tiles[16]);
  const shown = walk((opened as Extract<Node, { t: 'slot' }>).c);
  const backRow = shown.find((x) => x.tip === 'Return to the searchable tile list') as { on: unknown } | undefined;
  assert.ok(backRow, 'opened on a tile, the detail shows first');
  assert.deepEqual(back(17), backRow.on);
  assert.deepEqual(rows[0].menu!.map((m) => m.label), ['I’m going for this', 'I’m going for this, with a note…', 'Track on screen']);
  const prev = walk(first).find((x) => x.t === 'button' && x.label === '‹ Previous') as Extract<Node, { t: 'button' }>;
  assert.equal(prev.off, true);

  const readOnly = boardRowsUi(boardOf(tiles, true), state, ctxOf({ claimBlock: 'Join this event to claim tiles.', pins: null }));
  assert.deepEqual(walk(readOnly).find((x) => x.menu)!.menu, [{ label: 'Join this event to claim tiles.' }]);
  const page = boardUi(boardOf(tiles, true), state, ctxOf({ claimBlock: 'Join this event to claim tiles.' }), readOnly);
  assert.ok(texts(page).includes('Click for details · join this event to claim tiles.'));
});

test('tile detail: claim buttons, the pin (and its limit), the site link, and an error from the claim', () => {
  const t = tileOf(5, { claims: [{ name: 'Alice', note: 'tonight', mine: false }] });
  const ui = tileDetailUi(boardOf([t]), t, state, ctxOf({ pins: [1, 2] }), 'Slow down a moment and try again.');
  const all = texts(ui);
  assert.ok(all.includes('Slow down a moment and try again.'));
  assert.ok(all.includes('Alice (tonight)'));
  const pin = walk(ui).find((x) => x.t === 'button' && x.label === 'Track on screen')!;
  assert.deepEqual(pin.on, { a: 'pin', event: 7, tile: 5, on: true, then: { a: 'load', v: 'board', args: { event: '0', pre: '', q: '', status: 'all', page: '0', part: 'rows', tile: '5' }, into: 'tiles' } });
  const claim = walk(ui).find((x) => x.t === 'button' && x.label === 'Add note…')!;
  assert.equal(claim.on?.a === 'post' && claim.on.ask?.startsWith('Note for your team'), true);
  assert.ok(walk(ui).some((x) => x.on?.a === 'site' && x.on.path === '/c/afk/events/7?tile=5'));

  const full = tileDetailUi(boardOf([t]), t, state, ctxOf({ pins: [1, 2, 3] }));
  assert.ok(texts(full).some((s) => s.startsWith('You\'re already tracking 3 tiles')));
  assert.equal(claimLine([{ name: 'Bob', note: null, mine: false }, { name: 'Me', note: null, mine: true }]), 'Planning: You, Bob');
});

test('tracking lines: sets say how much of each is needed and what is done', () => {
  const t = tileOf(9, {
    itemRequirements: [
      { itemId: 1, name: 'Hood', requiredAmount: 1, currentAmount: 1, group: 'Ahrim', groupRequire: 0 },
      { itemId: 2, name: 'Top', requiredAmount: 1, currentAmount: 1, group: 'Ahrim', groupRequire: 0 },
      { itemId: 3, name: 'Skirt', requiredAmount: 1, currentAmount: 0, group: 'Karil', groupRequire: 0 },
    ],
  });
  assert.deepEqual(trackingLines(t), ['Ahrim set — all 2 · done:', '  ✓ Hood', '  ✓ Top', 'Karil set — all 1:', '  1× Skirt']);
});

test('teams: the ranked list opens a team; a team page goes back; search rows open the player', () => {
  const team = { teamId: 3, name: 'Red', color: '#ff0000', rank: 1, score: '9 tiles', members: 12, yours: true };
  assert.equal(teamLine(team), '#1 · 9 tiles · 12 members');
  const overview = rosterUi({ mode: 'teams', page: 1, pageSize: 25, total: 1, pages: 1, teams: [team], yourTeam: null, unplaced: 0 }, { event: 7, team: 0, page: 1, back: 1 });
  assert.ok(actions(overview).some((a) => a.a === 'load' && a.args?.team === '3'));
  const members = rosterUi(
    { mode: 'members', page: 1, pageSize: 25, total: 1, pages: 1, team, players: [{ name: 'Cap', teamId: 3, teamName: 'Red', teamColor: '#ff0000', rank: null, score: null, captain: true, you: false }] },
    { event: 7, team: 3, page: 1, back: 2 },
  );
  assert.ok(actions(members).some((a) => a.a === 'load' && a.args?.team === '0' && a.args?.page === '2'), 'back lands on the overview page it came from');
  assert.ok(actions(members).some((a) => a.a === 'lookup' && a.rsn === 'Cap'));
  assert.ok(texts(members).includes('Captain'));
});

test('players board: your accounts off the page show (three, then +N), and search hits carry their rank', () => {
  const pl = (name: string, rank: number, you = false) => ({ name, teamId: rank, teamName: name, teamColor: '#fff', rank, score: `${rank} tiles`, captain: false, you });
  const yours = [pl('Alt1', 40, true), pl('Alt2', 41, true), pl('Alt3', 90, true), pl('Alt4', 99, true)];
  const page = rosterUi(
    { mode: 'players', page: 1, pageSize: 25, total: 170, pages: 7, players: [pl('Top', 1)], you: yours[0], yours },
    { event: 7, team: 0, page: 1, back: 1 },
  );
  const t = texts(page);
  assert.ok(t.includes('Your accounts'));
  assert.ok(t.includes('Alt3') && !t.includes('Alt4'));
  assert.ok(t.includes('+1 more'));
  assert.ok(t.includes('170 players'));
  const search = rosterUi(
    { mode: 'search', query: 'zez', page: 1, pageSize: 25, total: 1, pages: 1, ranked: true, players: [pl('Zezima', 12)] },
    { event: 7, team: 0, page: 1, back: 1 },
  );
  assert.ok(texts(search).includes('#12'), 'ranked on a players board');
  assert.ok(!texts(search).some((s) => s.includes('Not on a team')));
});

test('clan search: a boosted name wears its own dark look as-is on the panel, else the adapted main look', () => {
  const textOf = (n: Node): Record<string, unknown> | null => {
    const found = JSON.stringify(n).match(/\{"t":"text","s":"Dim Clan"[^}]*\}/);
    return found ? (JSON.parse(found[0]) as Record<string, unknown>) : null;
  };
  const style = { stops: ['#101010', '#202020'] as `#${string}`[] };
  const adapted = textOf(clanSearchUi('dim', [{ slug: 'dim', name: 'Dim Clan', boostLevel: 1, boostNameStyle: style }]));
  assert.ok(adapted && adapted.color !== '#101010', 'too dark for the panel: lifted');
  const own = textOf(clanSearchUi('dim', [{ slug: 'dim', name: 'Dim Clan', boostLevel: 1, boostNameStyle: { ...style, dark: { stops: ['#303030', '#404040'] } } }]));
  assert.equal(own?.color, '#303030');
  assert.deepEqual(own?.grad, ['#303030', '#404040']);
});

// RACE_FIXTURES=<dir> also writes the Feed, You and Lookup views for the plugin's offscreen render
// test (RacePanelRenderTest), beside the race and Clan-tab ones.
if (process.env.RACE_FIXTURES) {
  const dir = process.env.RACE_FIXTURES;
  const write = (name: string, ui: Node) => writeFileSync(`${dir}/${name}.json`, JSON.stringify({ ui }));
  const ago = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
  const later = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

  const m = (id: number, rsn: string, kind: string, extra: Partial<Parameters<typeof momentRow>[0]>) =>
    momentRow({ id, rsn, kind, itemId: null, itemName: null, quantity: 1, valueGp: null, source: null, teamId: null, occurredAt: ago(id * 3), ...extra }, {
      team: { name: id % 2 ? 'Jade' : 'Ruby', color: id % 2 ? '#5fd35f' : '#ff8f8f' },
      reacts: { tally: () => ({ n: id + 3, mine: false }), act: () => ({ a: 'post', act: 'react-row' }) },
    });
  const scopes = [
    { kind: 'clan' as const, id: 1, slug: 'iron-forge', name: 'Iron Forge' },
    { kind: 'event' as const, id: 5, name: 'Autumn Bingo' },
  ];
  write('feed', feedTabUi({
    scopes, current: scopes[1], pane: 'feed', chatAvailable: true, filter: 'all', teamId: 2,
    rows: [
      m(1, 'Lab~Field4', 'drop', { itemId: 20997, itemName: 'Twisted bow', valueGp: 1_400_000_000 }),
      completionRow({ tileId: 3, teamId: 1, label: 'Kill 5 bosses', who: 'Lab~Field9', team: { name: 'Iron Lads', color: '#4aa3ff' }, at: ago(5) }),
      m(4, 'Drenvox', 'pet', { itemId: 21992, itemName: 'Vorki' }),
      m(5, 'Lab~Field7', 'drop', { itemId: 21907, itemName: "Vorkath's head", valueGp: 900_000, run: { n: 12 } }),
      m(6, 'Lab~Field24', 'level', { itemName: 'Slayer', quantity: 99 }),
      m(7, 'Lab~Field88', 'death', { source: 'Vorkath' }),
    ],
    floorNote: '+214 smaller drops in the last minute',
  }));

  const rich: PlayerCard = {
    ...card,
    rsn: 'Drenvox',
    displayCase: [
      { id: 1, kind: 'kc', itemId: 0, statKey: 'vorkath', headline: '1,204 KC', name: 'Vorkath', source: null },
      { id: 2, kind: 'pb', itemId: 0, statKey: '4:theatre_of_blood', headline: '17:42.6', name: 'ToB · 4 players', source: null },
      { id: 3, kind: 'drop', itemId: 20997, statKey: null, headline: null, name: 'Twisted bow', source: 'Chambers of Xeric' },
      { id: 4, kind: 'clog', itemId: 21992, statKey: null, headline: null, name: 'Vorki', source: 'Vorkath' },
    ],
  };
  const h2h = (id: number, status: 'pending' | 'active', side: 'challenger' | 'opponent', them: string, me: number, they: number) => ({
    id, kind: 'kc' as const, label: 'Vorkath kills', sentence: `${status === 'pending' ? 'Vorkath' : 'Zulrah'} kills · 7 days`, status, durationMin: 10_080, side,
    me: { rsn: 'Drenvox', score: me, hitAt: null }, them: { rsn: them, playerId: id, score: they, hitAt: null },
    createdAt: ago(60), respondBy: later(20 * 60), startedAt: ago(60), endsAt: later(2 * 24 * 60), finishedAt: null, outcome: null, resultLine: null,
    myPublic: true, isPublic: true, cancelAsked: null, itemIds: [], statKey: status === 'pending' ? 'vorkath' : 'zulrah',
  });
  const goals: GoalView[] = [
    { id: 1, kind: 'skill', metric: 'slayer', target: 99, label: '99 Slayer', current: 10_200_000, of: 13_034_431, text: '96 · 4.2m xp left', done: false, due: null },
    { id: 2, kind: 'boss', metric: 'vorkath', target: 500, label: '500 Vorkath', current: 312, of: 500, text: '312 / 500', done: false, due: null },
    { id: 3, kind: 'clog', metric: 'Barrows', target: 25, label: 'Barrows log', current: 22, of: 25, text: '22 / 25', done: false, due: { text: 'due in 2d', pace: null, tone: 'behind', days: 2, when: '14 Nov 2026' } },
    { id: 4, kind: 'clog', metric: 'Fight Caves', target: 1, label: 'Fire cape', current: 1, of: 1, text: '1 / 1', done: true, due: null },
  ] as GoalView[];
  write('you', col([
    playerCardUi(rich, { sectionKey: 'you', cas: true, own: true, slots: 4, afterTop: [h2hUi([h2h(1, 'pending', 'opponent', 'Lab~Field88', 0, 0), h2h(2, 'active', 'challenger', 'Lab~Field4', 41, 36)])] }),
    goalsUi(goals, null),
  ], { gap: 8 }));

  const them: PlayerCard = { ...card, rsn: 'Lab~Field146' };
  write('lookup-player', playerCardUi(them, { sectionKey: 'lookup', cas: true, me: 'Drenvox' }));
  const clog = playerCardUi(them, { sectionKey: 'lookup-clog', cas: true, me: 'Drenvox' });
  const tabs = walk(clog).find((x) => x.t === 'tabs') as Extract<Node, { t: 'tabs' }>;
  tabs.open = 'Log';
  write('lookup-clog', clog);
  write('lookup-clan', col([
    clanSearchUi('iron', [{ slug: 'iron-lads', name: 'Iron Lads', boostLevel: 2 }, { slug: 'iron-forge', name: 'Iron Forge' }, { slug: 'ironside', name: 'Ironside' }]),
    clanCardUi({
      slug: 'iron-lads', name: 'Iron Lads', logoUrl: null, members: 212, activeThisWeek: 97, weekHours: 2010, totalEhp: 9000, totalEhb: 4000,
      topWeek: [{ rsn: 'Lab~Field9', hours: 52.1 }, { rsn: 'Lab~Field57', hours: 40.4 }, { rsn: 'Lab~Field24', hours: 38.8 }],
      topPlayers: [], clog: { average: 612, synced: 120 }, highlights: [],
      competitions: [{ type: 'boss', metric: 'vorkath', label: 'Vorkath' }],
    } as unknown as Parameters<typeof clanCardUi>[0], true),
  ], { gap: 8 }));
}

test('display case: every pin kind shows its value, items keep a full-size icon', () => {
  const shown: PlayerCard = {
    ...card,
    displayCase: [
      { id: 1, kind: 'kc', itemId: 0, statKey: 'vorkath', headline: '1,204 KC', name: 'Vorkath', source: null },
      { id: 2, kind: 'pb', itemId: 0, statKey: '1:tob', headline: '17:42.6', name: 'ToB · 4 players', source: null },
      { id: 3, kind: 'drop', itemId: 20997, statKey: null, headline: null, name: 'Twisted bow', source: 'CoX', kc: 312, when: null },
      { id: 4, kind: 'clog', itemId: 21992, statKey: null, headline: null, name: 'Vorki', source: 'Vorkath', kc: null, when: '2026-11-01T10:00:00Z' },
    ],
  };
  const t = texts(playerCardUi(shown, { sectionKey: 'you', cas: false }));
  for (const want of ['1,204 KC', '17:42.6', 'ToB · 4 players', 'at 312 KC', 'Twisted bow', 'Obtained · 1 Nov 2026', 'Vorki']) assert.ok(t.includes(want), want);
  const ui = playerCardUi(shown, { sectionKey: 'you', cas: false });
  assert.ok(walk(ui).some((n) => n.t === 'icon' && n.item === 20997 && n.w === 36 && n.h === 32));
});

test('goals: name on its own line, progress and due muted, days left only when close', () => {
  const g = (id: number, label: string, days: number): GoalView => ({
    id, kind: 'skill', metric: 'slayer', target: 99, label, current: 2, of: 11, text: '2 / 11', done: false,
    due: { text: 'x', pace: null, tone: 'ok', days, when: '12 Nov 2027' },
  }) as GoalView;
  const runsOf = (ui: Node) => walk(ui).flatMap((n) => (n.t === 'text' && n.runs ? n.runs.map((r) => r.s) : []));
  const far = goalsUi([g(1, '99 Slayer', 369)], null);
  assert.ok(texts(far).includes('99 Slayer'));
  assert.ok(runsOf(far).join('').includes('2 / 11 · due 12 Nov 2027') && !runsOf(far).join('').includes('days left'));
  assert.ok(runsOf(goalsUi([g(2, 'Barrows', 3)], null)).join('').includes('3 days left'));
  const done = goalsUi([{ ...g(3, 'Fire cape', 0), done: true } as GoalView], null);
  assert.ok(walk(done).some((n) => n.t === 'text' && n.s === 'Done' && n.chip));
});
