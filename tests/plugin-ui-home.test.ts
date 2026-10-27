import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { ActivityEntry } from '../src/lib/pluginActivity';
import type { ScheduleBingo } from '../src/lib/pluginConfig';
import {
  type HomeConfig,
  type HomeData,
  eventUi,
  feedLine,
  foldFeed,
  homeUi,
  liveValue,
  otherBoards,
  revealNote,
  sizeLabel,
  weeklyKind,
  workersLine,
} from '../src/lib/pluginUi/homeUi';
import type { Node } from '../src/lib/pluginUi/nodes';

// The plugin's Clan tab, built on the site (lib/pluginUi/homeUi). Several of these rules were the
// plugin's own tests before the tab moved here (SidebarEventsTest, RevealModeTest, ActiveTaskLabelTest).

const NOW = Date.parse('2026-10-26T12:00:00Z');

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
const texts = (n: Node) => walk(n).flatMap((x) => (x.t === 'text' && typeof x.s === 'string' ? [x.s] : x.t === 'button' ? [x.label as string] : []));

const tile = (id: number, current: number, goal: number, extra = {}) => ({ tileId: id, label: `Tile ${id}`, current, goal, points: 1, complete: current >= goal, position: id, description: null, ...extra });

const base = (cfg: HomeConfig, extra: Partial<HomeData> = {}): HomeData => ({
  cfg,
  live: true,
  inGame: true,
  feed: [],
  standings: [],
  weekly: new Map(),
  pins: [],
  chosen: false,
  ownClan: null,
  boardPath: '/c/afk/events/5',
  clanPath: '/c/afk',
  now: NOW,
  ...extra,
});

const liveCfg = (extra: Partial<HomeConfig> = {}): HomeConfig => ({
  clanName: 'The AFK Spot',
  activeClan: { slug: 'afk' },
  event: { id: 5, name: 'Summer Bingo', format: 'bingo', scoringMode: 'tiles' },
  board: { tilesComplete: 3, tilesTotal: 25, pointsScored: false },
  panel: { tiles: [tile(1, 40, 50), tile(2, 1, 100), tile(3, 5, 5)], activeNow: [], scheduled: [], weeklies: [] },
  ...extra,
});

test('the list: the board, a weekly and a scheduled bingo each drill in', () => {
  const ui = homeUi(
    base(liveCfg({
      panel: {
        tiles: [],
        weeklies: [{ id: 9, title: '', type: 'skill', metric: 'slayer', metricLabel: 'Slayer', status: 'active', startDate: '2026-10-20T00:00:00Z', endDate: '2026-10-27T00:00:00Z' }],
        scheduled: [{ id: 12, title: 'Winter Bingo', startDate: '2026-11-01T00:00:00Z', endDate: null, status: 'upcoming', boardSize: 5, tileCount: 25, format: 'bingo', scoringMode: 'tiles' }],
      },
    }), { weekly: new Map([[9, { total: 30, top: [{ rank: 4, rsn: 'Me', gained: 1_200_000, self: true }], you: { rank: 4, rsn: 'Me', gained: 1_200_000, self: true } }]]) }),
  );
  const all = texts(ui);
  assert.ok(all.includes('Summer Bingo'));
  assert.ok(all.includes('3 / 25 tiles · 12%'));
  assert.ok(all.includes('Skill of the Week'));
  assert.ok(all.includes('You: #4 · +1.2M xp'));
  assert.ok(all.includes('Winter Bingo'));
  assert.ok(all.includes('5×5 · 25 tiles'));
  const opens = walk(ui).flatMap((x) => (x.on && (x.on as { a: string }).a === 'load' ? [(x.on as { args?: { open?: string } }).args?.open] : []));
  assert.deepEqual(opens, ['board', 'weekly:9', 'event:12']);
});

test('the board page: standings, pins with a way to drop them, active now, nearest tiles, all tiles', () => {
  const ui = eventUi(
    base(liveCfg({ panel: { tiles: [tile(1, 40, 50), tile(2, 1, 100), tile(3, 5, 5)], activeNow: [{ tileId: 1, workers: ['You', 'Mate'], self: true, gains: { You: 30, Mate: 10 } }] } }), {
      pins: [2],
      standings: [
        { teamId: 1, name: 'Red', color: '#ff0000', rank: 1, score: '9 tiles', members: 5, yours: false },
        { teamId: 2, name: 'Blue', color: '#0000ff', rank: 2, score: '7 tiles', members: 5, yours: false },
        { teamId: 3, name: 'Green', color: '#00ff00', rank: 3, score: '6 tiles', members: 5, yours: false },
        { teamId: 4, name: 'Mine', color: '#ffff00', rank: 4, score: '3 tiles', members: 5, yours: true },
        { teamId: 5, name: 'Last', color: '#ffffff', rank: 5, score: '1 tile', members: 5, yours: false },
      ],
    }),
    'board',
  )!;
  const all = texts(ui);
  assert.ok(all.includes('4. Mine'), 'your team shows even below the cut');
  assert.ok(all.includes('+1 more teams'));
  assert.ok(all.includes('Tracked on screen'));
  assert.ok(walk(ui).some((x) => x.on && (x.on as { a: string; tile?: number; on?: boolean }).a === 'pin' && (x.on as { tile: number }).tile === 2));
  assert.ok(all.includes('You 30 · Mate 10'));
  // Nearest: tile 1 (80%) before tile 2 (1%); the done tile isn't there.
  const nearest = all.slice(all.indexOf('Nearest tiles'));
  assert.ok(nearest.indexOf('Tile 1') < nearest.indexOf('Tile 2'));
  assert.ok(!nearest.includes('Tile 3'));
  assert.ok(all.includes('View all 25 tiles'));
  assert.ok(walk(ui).some((x) => (x.on as { args?: { tile?: string } } | undefined)?.args?.tile === '1'), 'a row opens its tile on the board page');
});

test('a starting shot owed puts the plugin’s own card in; an alt watching gets the board read-only', () => {
  const owed = eventUi(base(liveCfg({ startProof: { status: 'pending' } })), 'board')!;
  assert.ok(walk(owed).some((x) => x.t === 'native' && x.name === 'start-proof'));
  const alt = eventUi(base({ clanName: 'A', homeBoard: { eventId: 5, eventName: 'Summer Bingo', tilesComplete: 3, tilesTotal: 25, pointsScored: false } }, { live: false, inGame: true }), 'board')!;
  assert.ok(texts(alt).includes('This character isn’t on a team in this event.'));
  assert.ok(texts(alt).includes('View the board'));
});

test('a ladder: the countdown ticks in the plugin, and missions show their value now', () => {
  const ui = eventUi(base(liveCfg({
    event: { id: 5, name: 'Ladder', format: 'ladder', nextRevealAt: '2026-10-26T12:30:00Z', decay: { hours: 10, targetPct: 50 }, missions: [{ tileId: 1, label: 'Kill 5', points: 100, revealedAt: '2026-10-26T07:00:00Z', expiresAt: '2026-10-26T14:00:00Z' }], monthlyStandings: { yourRank: 2, yourPoints: 340 } },
  })), 'board')!;
  const countdowns = walk(ui).filter((x) => x.t === 'countdown');
  assert.deepEqual(countdowns.map((c) => c.prefix), ['Next mission in ', 'Expires in ']);
  assert.ok(texts(ui).includes('100 -> 75'), 'half way down a 50% decay over 10h');
  assert.equal(liveValue(100, '2026-10-26T12:00:00Z', null, NOW), 100);
  assert.ok(texts(ui).some((s) => s.startsWith('You: #2 this month · 340 pts')));
});

test('the weekly page: you below the cut still show, gains in the comp’s unit', () => {
  const top = Array.from({ length: 12 }, (_, i) => ({ rank: i + 1, rsn: `P${i + 1}`, gained: 5000 * (12 - i), self: i === 11 }));
  const ui = eventUi(base(liveCfg({ panel: { weeklies: [{ id: 3, title: 'EHB week', type: 'efficiency', metric: 'ehb', metricLabel: 'EHB', status: 'active', startDate: '2026-10-20T00:00:00Z', endDate: '2026-10-27T00:00:00Z' }] } }), {
    weekly: new Map([[3, { total: 12, top, you: top[11] }]]),
  }), 'weekly:3')!;
  const all = texts(ui);
  assert.ok(all.includes('P10') && !all.includes('P11') && all.includes('P12'));
  assert.ok(all.includes('+5.00 hrs'), 'efficiency comps travel in milli-hours');
  assert.equal(weeklyKind('efficiency'), 'Efficiency of the Week');
});

test('sizes: a list is never a grid, a grid keeps its shape, an old site is judged on geometry', () => {
  const b = (tileCount: number, boardSize: number, format: string, scoringMode = 'tiles') =>
    ({ id: 1, title: 'x', startDate: '', endDate: null, status: 'upcoming', tileCount, boardSize, format, scoringMode }) as ScheduleBingo;
  assert.equal(sizeLabel(b(240, 240, 'bingo', 'points')), '240 tiles');
  assert.equal(sizeLabel(b(0, 240, 'bingo', 'points')), '240 tiles');
  assert.equal(sizeLabel(b(8, 8, 'tilerace')), '8 tiles');
  assert.equal(sizeLabel(b(1, 1, 'bingo', 'points')), '1 tile');
  assert.equal(sizeLabel(b(12, 5, 'bingo')), '5×5 · 12 tiles');
  assert.equal(sizeLabel(b(0, 5, 'bingo')), '5×5');
  assert.equal(sizeLabel(b(25, 5, '')), '5×5 · 25 tiles');
  assert.equal(sizeLabel(b(240, 240, '')), '240 tiles');
});

test('also live: other clans’ boards, a co-hosted board once, never the board on screen', () => {
  const ref = (slug: string, eventId: number, kind = 'bingo') => ({ slug, name: slug, live: { kind, eventId, eventName: `${slug} event`, tilesComplete: 1, tilesTotal: 9, pointsScored: false } });
  const slugs = (cfg: HomeConfig) => otherBoards(cfg).map((c) => c.slug);
  assert.deepEqual(slugs({ activeClan: { slug: 'a' }, clans: [ref('a', 1), ref('b', 2), ref('c', 3)] }), ['b', 'c']);
  assert.deepEqual(slugs({ activeClan: { slug: 'a' }, clans: [ref('a', 7), ref('b', 7)] }), [], 'the same co-hosted board');
  assert.deepEqual(slugs({ activeClan: { slug: 'a' }, clans: [ref('a', 1), ref('b', 7), ref('c', 7)] }), ['b'], 'listed once');
  assert.deepEqual(slugs({ activeClan: { slug: 'a' }, event: { id: 7, name: 'Cup' }, clans: [ref('a', 3, 'weekly'), ref('b', 7)] }), [], 'the board on screen');
  assert.deepEqual(slugs({ activeClan: { slug: 'a' }, event: { id: 7, name: 'Cup' }, clans: [ref('b', 7, 'weekly')] }), ['b'], 'a weekly sharing the id is elsewhere');
  assert.deepEqual(slugs({ activeClan: { slug: 'A' }, clans: [ref('a', 1), ref('b', 2)] }), ['b']);
  assert.deepEqual(slugs({ clans: [ref('a', 1), ref('b', 2)] }), ['a', 'b'], 'nothing addressed yet');
  const chosen = homeUi(base({ activeClan: { slug: 'a' }, clans: [ref('a', 1), ref('b', 2)] }, { live: false, chosen: true }));
  assert.ok(!texts(chosen).includes('Also live'), 'a picked clan is a filter');
});

test('words: reveal notes, who is on a tile, and the feed', () => {
  assert.equal(revealNote({ id: 1, name: 'x' }, NOW), null);
  assert.equal(revealNote({ id: 1, name: 'x', revealPolicy: 'bounty', hiddenTileCount: 1 }, NOW), '1 bounty left · next on claim');
  assert.equal(revealNote({ id: 1, name: 'x', revealPolicy: 'interval', hiddenTileCount: 4, nextRevealAt: '2026-10-26T15:10:00Z' }, NOW), '4 tiles hidden · next in 3h 10m');
  assert.equal(workersLine({ tileId: 1, workers: ['A', 'B', 'C', 'D'], self: false, gains: { A: 12_000, B: 3 } }), 'A 12K · B 3 · C · +1');
  assert.equal(workersLine({ tileId: 1, workers: ['A', 'B', 'C'], self: false }), 'A + 2 others');
  const e = (id: string, kind: ActivityEntry['kind'], player: string | null, amount: number, extra: Partial<ActivityEntry> = {}): ActivityEntry => ({ id, ts: '', player, tileId: 1, tileLabel: 'Zulrah', kind, amount, isSelf: false, ...extra });
  const folded = foldFeed([e('s1', 'progress', 'Bob', 1), e('s2', 'progress', 'Bob', 2), e('c1', 'complete', null, 0, { participants: ['Ann', 'Cy'] })]);
  assert.deepEqual(folded.map(feedLine), ['Ann & 1 more completed Zulrah', 'Bob +3 · Zulrah']);
  assert.equal(feedLine(e('r1', 'reveal', null, 0)), 'New tile revealed: Zulrah');
});
