import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { CaLookup } from '../src/lib/combatTasks';
import type { GoalView } from '../src/lib/goalProgress';
import { shapePlayerCard, type PlayerCard, type PlayerCardInput } from '../src/lib/playerCardShape';
import { clanCardUi, clanSearchUi } from '../src/lib/pluginUi/clanUi';
import type { Action, Node } from '../src/lib/pluginUi/nodes';
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

test('a card: identity, log, latest, then the profile sections', () => {
  const ui = playerCardUi(card, { sectionKey: 'lookup', cas: true });
  const all = texts(ui);
  assert.ok(all.includes('Drenvox mdps'));
  assert.ok(all.includes('2,277 total · cb 126 · Ironman'));
  assert.ok(all.includes('600 / 1,600'));
  assert.ok(all.includes('Tanzanite fang'));
  const tabs = walk(ui).find((x) => x.t === 'tabs') as Extract<Node, { t: 'tabs' }>;
  assert.deepEqual(tabs.tabs.map((t) => t.label), ['Skills', 'Bosses', 'Clues', 'Times', 'CAs']);
  assert.equal(tabs.key, 'lookup');
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
  assert.ok(actions(ui).some((a) => a.a === 'post' && a.act === 'goal-remove' && a.args?.id === '4'));
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
    false,
  );
  assert.ok(!JSON.stringify(ui).includes('http'), 'the clan logo URL never reaches the plugin');
  assert.ok(actions(ui).some((a) => a.a === 'lookup' && a.rsn === 'Zezima'));
  assert.ok(!walk(ui).some((x) => x.t === 'button'));
  assert.ok(texts(ui).includes('Running: BOTW Vorkath'));
  assert.ok(actions(clanSearchUi('afk', [{ slug: 'theafkspot', name: 'The AFK Spot' }])).some((a) => a.a === 'load' && a.v === 'clan'));
});
