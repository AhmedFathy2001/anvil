import { test } from 'node:test';
import assert from 'node:assert/strict';

import { NO_MODULES } from '../src/lib/clanEventModules';
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
  assert.ok(walk(ui).some((x) => (x.on as { open?: { pane: string } } | undefined)?.open?.pane === 't:1'), 'a row opens its tile on the tiles page');
  const warm = walk(ui).find((x) => x.t === 'warm') as { on: { a: string; v: string; args: Record<string, string> } } | undefined;
  assert.deepEqual(warm?.on.args, { event: '0', back: 'board', backLabel: 'Summer Bingo' }, 'the tiles page every row opens is fetched ahead');
  const live = walk(ui).filter((x) => x.live && (x.live as { tile: number }).tile === 1).map((x) => [x.t, (x.live as { fmt?: string }).fmt ?? '']);
  assert.deepEqual(live, [['text', 'of'], ['bar', ''], ['text', 'near'], ['bar', '']], 'its tracked row and its nearest row move in the plugin');
  assert.ok(!walk(ui).some((x) => x.live && (x.live as { tile: number }).tile === 3), 'a done tile has nothing to move');
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

test('the weekly page: past the 50 the route sends, your own row still closes the list', () => {
  const top = Array.from({ length: 50 }, (_, i) => ({ rank: i + 1, rsn: `P${i + 1}`, gained: 0, self: false }));
  const ui = eventUi(base(liveCfg({ panel: { weeklies: [{ id: 4, title: 'BOTW', type: 'boss', metric: 'phosanisNightmare', metricLabel: 'Phosani’s Nightmare', status: 'active', startDate: '2026-10-20T00:00:00Z', endDate: '2026-10-27T00:00:00Z' }] } }), {
    weekly: new Map([[4, { total: 171, top, you: { rank: 87, rsn: 'Drenvox', gained: 0, self: true } }]]),
  }), 'weekly:4')!;
  const all = texts(ui);
  assert.ok(all.includes('Drenvox'), 'your row, though you rank 87th');
  assert.ok(!all.some((t) => t.includes('not on the board')));
  assert.ok(all.some((t) => t.startsWith('You: +0') && t.endsWith('so far')), 'no rank among a tie on +0');
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

test('a clan event: a card under Events, and its page says "I\'m going" for the clan it was drawn for', () => {
  const ce = {
    id: 4, title: 'Nex mass', description: 'Bring a zcb', location: 'Ancient Prison', world: 330, icon: 'nex', imageUrl: null, channels: null, postChannel: null, host: 'Drenvox',
    repeat: 'weekly' as const, timezone: 'Europe/London', durationMin: 90, startsAt: '2026-10-27T20:00:00.000Z', repeatUntil: null, ping: true,
    occurrence: { start: '2026-10-27T20:00:00.000Z', end: '2026-10-27T21:30:00.000Z' }, phase: 'upcoming' as const, going: 2, goingNames: ['A', 'B'], mine: false,
    modules: NO_MODULES, signup: null, surveyOpen: false,
  };
  const d = base(liveCfg(), { clanEvents: [ce] });
  const list = homeUi(d);
  assert.ok(texts(list).includes('Clan event · weekly'));
  assert.ok(texts(list).includes('Ancient Prison · W330'));
  assert.ok(walk(list).some((x) => (x.on as { args?: { open?: string } } | undefined)?.args?.open === 'clan-event:4'));
  const page = eventUi(d, 'clan-event:4')!;
  assert.ok(texts(page).includes('Hosted by Drenvox'));
  const go = walk(page).find((x) => x.t === 'button' && x.label === 'I’m going') as { on: { act: string; args: Record<string, string> } };
  assert.equal(go.on.act, 'clan-event-going');
  assert.deepEqual(go.on.args, { id: '4', going: '1', open: 'clan-event:4', clan: 'afk' });
  assert.ok(walk(page).some((x) => x.t === 'icon' && x.boss === 'nex'), 'its picture is a game key');
});

test('every other live board the character is on gets its own card, opening that board', () => {
  const summary = (eventId: number, name: string, clan: string, done: number, total: number) => ({ eventId, name, clan, clanName: clan.toUpperCase(), teamId: eventId * 10, teamName: `Team ${eventId}`, tilesComplete: done, tilesTotal: total, pointsScored: false });
  const ui = homeUi(base(liveCfg(), {
    // Two more boards: one in this same clan, one in another; the active board (5) is not repeated.
    myBoards: [summary(5, 'Summer Bingo', 'afk', 3, 25), summary(7, 'Side Bingo', 'afk', 2, 9), summary(8, 'Clan Wars', 'rivals', 0, 16)],
  }));
  const all = texts(ui);
  assert.ok(all.includes('Your other boards'));
  assert.ok(all.includes('Side Bingo') && all.includes('Clan Wars'));
  assert.ok(all.includes('2 / 9 tiles') && all.includes('0 / 16 tiles'));
  const opens = walk(ui).flatMap((n) => {
    const on = n.on as { a?: string; v?: string; args?: { event?: string } } | undefined;
    return on?.a === 'load' && on.v === 'board' && on.args?.event && on.args.event !== '0' ? [on.args.event] : [];
  });
  assert.deepEqual(opens, ['7', '8']);
});

test('no extra boards: no "Your other boards" heading', () => {
  assert.ok(!texts(homeUi(base(liveCfg(), { myBoards: [] }))).includes('Your other boards'));
});

test('a clan board you are seated on shows once, under Events, with your team', () => {
  const ui = homeUi(base(liveCfg(), {
    cfg: { ...liveCfg(), panel: { ...liveCfg().panel, scheduled: [{ id: 12, title: 'Winter Bingo', startDate: '2026-11-01T00:00:00Z', endDate: null, status: 'active', boardSize: 5, tileCount: 25, format: 'bingo', scoringMode: 'tiles' }] } },
    myBoards: [{ eventId: 12, name: 'Winter Bingo', clan: 'afk', clanName: 'AFK', teamId: 3, teamName: 'Ruby', tilesComplete: 0, tilesTotal: 0, pointsScored: false }],
  } as never));
  const all = texts(ui);
  assert.ok(all.includes('On Ruby'));
  assert.ok(!all.some((t) => /not in it/.test(t)), 'not "you’re not in it" for a board you are on');
  assert.ok(!all.includes('Your other boards'), 'and not a second card for it');
});

test('a gated event says who may join, in a few words, on its card and its page — not once you are in', async () => {
  const { gateLine } = await import('../src/lib/pluginUi/homeUi');
  const { joinToClaimLine } = await import('../src/lib/pluginUi/boardUi');
  const gated: ScheduleBingo = { id: 12, title: 'Sub Night', startDate: '2026-11-01T00:00:00Z', endDate: null, status: 'upcoming', boardSize: 5, tileCount: 25, format: 'bingo', scoringMode: 'tiles', gate: 'Subs only (Twitch)' };
  const open: ScheduleBingo = { ...gated, id: 13, title: 'Open Night', gate: undefined };
  const cfg = liveCfg({ panel: { tiles: [], weeklies: [], scheduled: [gated, open] } });
  const list = texts(homeUi(base(cfg)));
  assert.equal(list.filter((s) => s === 'Subs only (Twitch)').length, 1, 'on the gated card only');
  assert.ok(texts(eventUi(base(cfg), 'event:12')!).includes('Subs only (Twitch)'), 'and on its page');
  assert.ok(!texts(eventUi(base(cfg), 'event:13')!).some((s) => s.includes('(Twitch)')));
  // Entered: the line has done its job.
  assert.deepEqual(gateLine({ ...gated, yourEntry: 'entered' }), []);
  assert.equal(gateLine({ ...gated, yourEntry: 'pending' }).length, 1);
  // A long role name is clipped to a panel line.
  const long = gateLine({ ...gated, gate: 'Discord role: Extremely Long Role Name Here' });
  assert.ok((long[0] as { s: string }).s.endsWith('…'));
  // A read-only board's claim block names it too.
  assert.equal(joinToClaimLine('Followers (Kick)'), 'Join this event to claim tiles · Followers (Kick)');
  assert.equal(joinToClaimLine(null), 'Join this event to claim tiles.');
});

test('a creator space: the card under the events is headed by the space, not "Your clan"', async () => {
  const { ownHeading } = await import('../src/lib/pluginUi/homeUi');
  const card: Node = { t: 'text', s: 'space card' } as Node;
  const space = texts(homeUi(base(liveCfg({ activeClan: { slug: 'cool', name: 'Cool Streamer', kind: 'creator' } }), { ownClan: card })));
  assert.ok(space.includes('Cool Streamer'), space.join(' | '));
  assert.ok(!space.includes('Your clan'));
  assert.equal(ownHeading({ activeClan: { slug: 'cool', name: '', kind: 'creator' } }), 'This space');
  // A clan keeps its heading; so does a config from before `kind` was sent.
  const clan = texts(homeUi(base(liveCfg({ activeClan: { slug: 'afk', name: 'The AFK Spot', kind: 'clan' } }), { ownClan: card })));
  assert.ok(clan.includes('Your clan'));
  assert.equal(ownHeading({ activeClan: { slug: 'afk' } }), 'Your clan');
});

test('a solo board: the cut standings, your lines picked out, and a way to every player', () => {
  const p = (rank: number, you = false) => ({ name: `P${rank}`, teamId: rank, teamName: `P${rank}`, teamColor: '#fff', rank, score: `${200 - rank} tiles`, captain: false, you });
  const ui = eventUi(
    base(liveCfg(), {
      soloStandings: {
        total: 170,
        complete: false,
        mineMore: 1,
        parts: [
          { kind: 'rows', rows: [p(1), p(2), p(3), p(4), p(5)] },
          { kind: 'gap', skipped: 42 },
          { kind: 'rows', rows: [p(48), p(49), p(50, true), p(51), p(52)] },
          { kind: 'gap', skipped: 118 },
        ],
      },
    }),
    'board',
  )!;
  const all = texts(ui);
  assert.ok(all.includes('170 players'));
  assert.ok(all.includes('50.') && all.includes('P50'), 'your line, ranked');
  assert.ok(all.includes('· · ·  42 more'));
  assert.ok(all.includes('+1 more of your accounts'));
  assert.ok(all.includes('View all 170 players'));
  assert.ok(!all.some((s) => /teams/i.test(s)), 'no "teams" copy on a players board');
  assert.ok(!all.includes('P6'), 'the default view never ships the whole field');
  const view = walk(ui).find((x) => x.t === 'button' && x.label === 'View all 170 players') as { on: { v: string } };
  assert.equal(view.on.v, 'teams', 'opens the paged, searchable list');
  // A ladder keeps its own standings line.
  const ladder = eventUi(base(liveCfg({ event: { id: 5, name: 'L', format: 'ladder' } }), { soloStandings: { total: 3, complete: true, mineMore: 0, parts: [{ kind: 'rows', rows: [p(1)] }] } }), 'board')!;
  assert.ok(!texts(ladder).includes('3 players'));
});

test('a board of many teams: the cut list worded as teams, your team picked out', () => {
  const t = (rank: number, yours = false) => ({ teamId: rank, name: `Team ${rank}`, color: '#ff0000', rank, score: `${100 - rank} tiles`, members: 3, yours });
  const ui = eventUi(
    base(liveCfg(), {
      teamStandings: {
        total: 30,
        complete: false,
        mineMore: 0,
        parts: [
          { kind: 'rows', rows: [t(1), t(2), t(3), t(4), t(5)] },
          { kind: 'gap', skipped: 10 },
          { kind: 'rows', rows: [t(16), t(17), t(18, true), t(19), t(20)] },
          { kind: 'gap', skipped: 10 },
        ],
      },
    }),
    'board',
  )!;
  const all = texts(ui);
  assert.ok(all.includes('30 teams'));
  assert.ok(all.includes('3 members · your team'));
  assert.ok(all.includes('View all 30 teams'));
  assert.ok(!all.includes('All teams & members'));
  assert.ok(!all.some((s) => /players/.test(s)));
  assert.ok(!all.includes('Team 6'));
  assert.ok(walk(ui).some((x) => (x.on as { args?: { team?: string } } | undefined)?.args?.team === '18'), 'a row opens that team');
});
