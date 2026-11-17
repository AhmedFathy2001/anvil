// The competition page in the plugin's side panel: "Best drops" and "Latest" under the standings,
// and an item hunt shown as a competition (lib/pluginUi/highlightsUi, homeUi).
//
// Run: TESTS_OK=1 npx tsx --test tests/plugin-ui-highlights.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { ScheduleWeekly } from '../src/lib/pluginConfig';
import { type HomeConfig, type HomeData, eventUi, homeUi, weeklyKind } from '../src/lib/pluginUi/homeUi';
import { type PanelDrop, dropRow, highlightNodes, panelHighlights } from '../src/lib/pluginUi/highlightsUi';

const NOW = Date.parse('2026-11-17T12:00:00Z');

function walk(n: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (!n || typeof n !== 'object') return out;
  if (Array.isArray(n)) {
    n.forEach((x) => walk(x, out));
    return out;
  }
  const o = n as Record<string, unknown>;
  if (typeof o.t === 'string') out.push(o);
  Object.values(o).forEach((v) => walk(v, out));
  return out;
}
const texts = (n: unknown) => walk(n).flatMap((x) => (x.t === 'text' && typeof x.s === 'string' && x.s ? [x.s] : []));

const base = (cfg: HomeConfig, extra: Partial<HomeData> = {}): HomeData => ({
  cfg,
  live: false,
  inGame: true,
  feed: [],
  standings: [],
  weekly: new Map(),
  pins: [],
  chosen: false,
  ownClan: null,
  boardPath: null,
  clanPath: '/c/afk',
  now: NOW,
  ...extra,
});

const weekly = (over: Partial<ScheduleWeekly> = {}): ScheduleWeekly => ({
  id: 9,
  title: 'BOTW: Zulrah',
  type: 'boss',
  metric: 'zulrah',
  metricLabel: 'Zulrah',
  status: 'active',
  startDate: '2026-11-14T12:00:00.000Z',
  endDate: '2026-11-21T12:00:00.000Z',
  ...over,
});

const drop = (over: Partial<PanelDrop> = {}): PanelDrop => ({ rsn: 'Lcl Member', itemId: 12921, itemName: 'Pet snakeling', count: 1, rarity: 4000, kc: 1204, at: '2026-11-17T10:00:00.000Z', ...over });
const top = [{ rank: 1, rsn: 'Lcl Admin', gained: 40, self: false }, { rank: 2, rsn: 'Me', gained: 12, self: true }];

test('one row: the item picture, "Name · Item", and a dim line of rate, kill count and when', () => {
  assert.deepEqual(dropRow(drop({ count: 2 })), {
    t: 'row',
    l: { t: 'icon', item: 12921, w: 24, h: 22 },
    c: {
      t: 'col',
      c: [
        { t: 'row', l: { t: 'text', s: 'Lcl Member', color: 'white', who: 'Lcl Member', tip: 'Lcl Member' }, c: { t: 'text', s: '· Pet snakeling ×2', color: '#c8c8c8', tip: 'Pet snakeling' }, gap: 3 },
        { t: 'row', l: { t: 'text', s: '1 in 4,000 · 1,204 kc ·', color: 'muted', font: 'small' }, c: { t: 'text', s: '', color: 'muted', at: '2026-11-17T10:00:00.000Z', font: 'small' }, gap: 3 },
      ],
    },
    gap: 6,
  });
});

test('a row with no rate and no kill count is just the time; long names are cut for a narrow panel', () => {
  const r = dropRow(drop({ rsn: 'A Very Long Name', itemName: "Tumeken's shadow (uncharged)", rarity: null, kc: null }));
  const all = walk(r);
  assert.equal(all.filter((x) => x.t === 'text' && x.at).length, 1);
  assert.ok(!texts(r).some((s) => s.includes('1 in') || s.includes('kc')));
  for (const s of texts(r)) assert.ok(s.length <= 20, `"${s}" is too long for the panel`);
});

test('only node types the panel already draws', () => {
  const kinds = new Set(walk(highlightNodes({ best: [drop(), drop({ rsn: 'B' }), drop({ rsn: 'C' }), drop({ rsn: 'D' })], latest: [drop()] }, 'weekly:9')).map((x) => x.t));
  for (const k of kinds) assert.ok(['col', 'row', 'text', 'icon', 'toggle'].includes(k as string), `unexpected node ${k}`);
});

test('under the standings: Best drops, then Latest; more than three best drops fold behind "+N more"', () => {
  const highlights = { best: [drop(), drop({ rsn: 'B' }), drop({ rsn: 'C' }), drop({ rsn: 'D' }), drop({ rsn: 'E' })], latest: [drop({ rsn: 'Newest' })] };
  const ui = eventUi(base({ panel: { weeklies: [weekly()] } }, { weekly: new Map([[9, { total: 2, top, you: top[1], highlights }]]) }), 'weekly:9')!;
  const t = texts(ui);
  assert.ok(t.indexOf('Standings') >= 0 && t.indexOf('Standings') < t.indexOf('Best drops'));
  assert.ok(t.indexOf('Best drops') < t.indexOf('Latest'));
  assert.ok(t.includes('+2 more'));
  assert.ok(t.includes('Newest'));
});

test('no drops: nothing is drawn, not an empty box', () => {
  assert.deepEqual(highlightNodes(null, 'k'), []);
  assert.deepEqual(highlightNodes({ best: [], latest: [] }, 'k'), []);
  const ui = eventUi(base({ panel: { weeklies: [weekly()] } }, { weekly: new Map([[9, { total: 2, top, you: top[1], highlights: null }]]) }), 'weekly:9')!;
  assert.ok(!texts(ui).includes('Best drops'));
  assert.ok(!texts(ui).includes('Latest'));
});

test('a new drop changes the page, so its ETag (a hash of the body) changes with it', () => {
  const page = (h: { best: PanelDrop[]; latest: PanelDrop[] }) => JSON.stringify(eventUi(base({ panel: { weeklies: [weekly()] } }, { weekly: new Map([[9, { total: 2, top, you: top[1], highlights: h }]]) }), 'weekly:9'));
  assert.notEqual(page({ best: [drop()], latest: [drop()] }), page({ best: [drop(), drop({ rsn: 'B' })], latest: [drop({ rsn: 'B' })] }));
});

test('ranked for the panel: pets first, people off the board left out, deaths never', () => {
  const m = (over: Record<string, unknown>) => ({ id: 1, rsn: 'On Board', kind: 'unique', itemId: 12922, itemName: 'Tanzanite fang', valueGp: 4_000_000, kc: 512, rarityDenominator: 1024, occurredAt: '2026-11-16T10:00:00.000Z', ...over });
  const h = panelHighlights(
    [
      m({ id: 1 }),
      m({ id: 2, rsn: 'Opted Out', kind: 'pet', itemId: 12921, itemName: 'Pet snakeling' }),
      m({ id: 3, kind: 'death', itemId: null, itemName: null, occurredAt: '2026-11-17T11:00:00.000Z' }),
      m({ id: 4, rsn: 'Also On', kind: 'pet', itemId: 13322, itemName: 'Beaver', rarityDenominator: null, kc: null, occurredAt: '2026-11-17T09:00:00.000Z' }),
    ],
    new Set(['on board', 'also on']),
  )!;
  assert.deepEqual(h.best.map((d) => d.rsn), ['Also On', 'On Board']);
  assert.deepEqual(h.latest.map((d) => d.rsn), ['Also On', 'On Board']);
  assert.equal(panelHighlights([m({ rsn: 'Nobody Here' })], new Set(['on board'])), null);
});

// ── An item hunt as a competition ────────────────────────────────────────────────────────────

const hunt = weekly({ id: 11, title: 'Item hunt: Tanzanite fang', type: 'hunt', metric: 'Tanzanite fang from Zulrah', metricLabel: 'Tanzanite fang from Zulrah · most by the end', iconItem: 12922 });
const huntTop = [
  { rank: 1, rsn: 'Lcl Admin', gained: 2, self: false, sub: '83 kills' },
  { rank: 2, rsn: 'Me', gained: 1, self: true, sub: '249 kills' },
  { rank: 3, rsn: 'Dry One', gained: 0, self: false, sub: '412 kills, no drop' },
];

test('an item hunt is named for what it is, not as a Boss of the Week', () => {
  assert.equal(weeklyKind('hunt'), 'Item hunt');
  assert.equal(weeklyKind('boss'), 'Boss of the Week');
});

test('an item hunt on the list: its targets and rule, the item picture, your place in drops', () => {
  const ui = homeUi(base({ panel: { weeklies: [hunt] } }, { weekly: new Map([[11, { total: 3, top: huntTop, you: huntTop[1] }]]) }));
  const t = texts(ui);
  // The list clips a title to the panel's width.
  assert.ok(t.some((s) => s.startsWith('Item hunt: Tanzanite')));
  assert.ok(t.some((s) => s.startsWith('Tanzanite fang')));
  assert.ok(t.includes('You: #2 · 1 drop'));
  assert.ok(walk(ui).some((x) => x.t === 'icon' && x.item === 12922));
});

test('an item hunt page: rank, name, count, and a dim line with the kills at the source', () => {
  const ui = eventUi(base({ panel: { weeklies: [hunt] } }, { weekly: new Map([[11, { total: 3, top: huntTop, you: huntTop[1] }]]) }), 'weekly:11')!;
  const t = texts(ui);
  assert.ok(t.includes('Item hunt'));
  assert.ok(t.includes('#2 · 1 drop'));
  assert.ok(t.includes('2 drops'));
  assert.ok(t.includes('412 kills, no drop'));
  assert.ok(!t.some((s) => s.includes('+2 drops') || s.endsWith(' kc')), 'drops are a count, never a gain in kc');
  const dim = walk(ui).find((x) => x.t === 'text' && x.s === '412 kills, no drop')!;
  assert.equal(dim.font, 'small');
});

test('an item hunt before anyone has a drop says so', () => {
  const none = huntTop.map((r) => ({ ...r, gained: 0 }));
  const ui = homeUi(base({ panel: { weeklies: [hunt] } }, { weekly: new Map([[11, { total: 3, top: none, you: none[1] }]]) }));
  assert.ok(texts(ui).includes('You: no drop yet'));
});
