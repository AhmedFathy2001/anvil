import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

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
  assert.ok(all.includes('3 / 25 tiles'));
  assert.ok(all.includes('Skill of the Week'));
  assert.ok(all.includes('You: #4 · +1.2M xp'));
  assert.ok(all.includes('Winter Bingo'));
  assert.ok(all.includes('Bingo · 5×5 · 25 tiles'));
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
  assert.ok(all.includes('4  Mine · you'), 'your team shows even below the cut');
  // Compact: the top three and yours; the rest open in place on "View all 5".
  assert.ok(all.includes('View all 5'));
  const tog = walk(ui).find((x) => x.t === 'toggle') as unknown as { off: Node; lit: Node };
  assert.ok(!texts(tog.off).includes('5  Last') && texts(tog.lit).includes('5  Last'));
  assert.ok(all.includes('Tracked on screen'));
  assert.ok(walk(ui).some((x) => x.on && (x.on as { a: string; tile?: number; on?: boolean }).a === 'pin' && (x.on as { tile: number }).tile === 2));
  assert.ok(all.includes('You 30 · Mate 10'));
  // Do this next: tile 1 (80%) before tile 2 (1%); the done tile isn't there.
  const nearest = all.slice(all.indexOf('Do this next'), all.indexOf('Feed'));
  assert.ok(nearest.indexOf('Tile 1') < nearest.indexOf('Tile 2'));
  assert.ok(!nearest.includes('Tile 3'));
  assert.ok(all.includes('View all 25 tiles'));
  assert.ok(walk(ui).some((x) => (x.on as { open?: { pane: string } } | undefined)?.open?.pane === 't:1'), 'a row opens its tile on the tiles page');
  const warm = walk(ui).find((x) => x.t === 'warm') as { on: { a: string; v: string; args: Record<string, string> } } | undefined;
  assert.deepEqual(warm?.on.args, { event: '0', back: 'board', backLabel: 'Summer Bingo' }, 'the tiles page every row opens is fetched ahead');
  const live = walk(ui).filter((x) => x.live && (x.live as { tile: number }).tile === 1).map((x) => [x.t, (x.live as { fmt?: string }).fmt ?? '']);
  assert.deepEqual(live, [['text', 'raw'], ['bar', ''], ['text', 'of'], ['bar', '']], 'its gold-card row and its active-now row move in the plugin');
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
  assert.deepEqual(countdowns.map((c) => c.prefix), ['Expires in ', 'Next in ', 'Live · 40/50 · ends in ']);
  assert.ok(texts(ui).includes('100 → 75'), 'half way down a 50% decay over 10h');
  assert.equal(liveValue(100, '2026-10-26T12:00:00Z', null, NOW), 100);
  assert.ok(texts(ui).includes('#2 this month') && texts(ui).includes('340 pts'));
});

test('the weekly page: you below the cut still show, gains in the comp’s unit', () => {
  const top = Array.from({ length: 12 }, (_, i) => ({ rank: i + 1, rsn: `P${i + 1}`, gained: 5000 * (12 - i), self: i === 11 }));
  const ui = eventUi(base(liveCfg({ panel: { weeklies: [{ id: 3, title: 'EHB week', type: 'efficiency', metric: 'ehb', metricLabel: 'EHB', status: 'active', startDate: '2026-10-20T00:00:00Z', endDate: '2026-10-27T00:00:00Z' }] } }), {
    weekly: new Map([[3, { total: 12, top, you: top[11] }]]),
  }), 'weekly:3')!;
  const all = texts(ui);
  // Compact: the top three, · · ·, and you; the rest open in place.
  const tog = walk(ui).find((x) => x.t === 'toggle') as unknown as { off: Node; lit: Node };
  const off = texts(tog.off);
  assert.ok(off.includes('P3') && !off.includes('P10') && off.includes('P12') && off.includes('· · ·'));
  assert.ok(texts(tog.lit).includes('P11'));
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
  assert.ok(all.some((t) => t.startsWith('+0') && t.endsWith('so far')), 'no rank among a tie on +0');
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
  assert.ok(texts(list).includes('Ancient Prison · W330 · 2 going'));
  // Its CTA right on the list row: the same act, answering with the list.
  const tap = walk(list).find((x) => x.t === 'text' && x.s === 'I’m going') as { on: { act: string; args: Record<string, string> } };
  assert.deepEqual(tap.on.args, { id: '4', going: '1', open: '', clan: 'afk' });
  assert.ok(walk(list).some((x) => (x.on as { args?: { open?: string } } | undefined)?.args?.open === 'clan-event:4'));
  const page = eventUi(d, 'clan-event:4')!;
  assert.ok(texts(page).includes('Hosted by Drenvox'));
  const go = walk(page).find((x) => x.t === 'button' && x.label === 'I’m going') as { on: { act: string; args: Record<string, string> } };
  assert.equal(go.on.act, 'clan-event-going');
  assert.deepEqual(go.on.args, { id: '4', going: '1', open: 'clan-event:4', clan: 'afk' });
  assert.ok(walk(page).some((x) => x.t === 'icon' && x.boss === 'nex'), 'its picture is a game key');
});

test('every live board the character is on sits in one card with its own progress, each opening that board', () => {
  const summary = (eventId: number, name: string, clan: string, done: number, total: number) => ({ eventId, name, clan, clanName: clan.toUpperCase(), teamId: eventId * 10, teamName: `Team ${eventId}`, tilesComplete: done, tilesTotal: total, pointsScored: false });
  const ui = homeUi(base(liveCfg(), {
    // Two more boards: one in this same clan, one in another; the active board (5) is not repeated.
    myBoards: [summary(5, 'Summer Bingo', 'afk', 3, 25), summary(7, 'Side Bingo', 'afk', 2, 9), summary(8, 'Clan Wars', 'rivals', 0, 16)],
  }));
  const all = texts(ui);
  assert.ok(all.some((t) => t.startsWith('Your live boards')));
  assert.ok(!all.includes('Your live board'), 'no single “the” board');
  assert.ok(all.includes('Side Bingo') && all.includes('Clan Wars'));
  assert.ok(all.includes('2 / 9 tiles') && all.includes('0 / 16 tiles'));
  const opens = walk(ui).flatMap((n) => {
    const on = n.on as { a?: string; v?: string; args?: { event?: string } } | undefined;
    return on?.a === 'load' && on.v === 'board' && on.args?.event && on.args.event !== '0' ? [on.args.event] : [];
  });
  assert.deepEqual(opens, ['7', '8']);
});

test('one live board: the card is singular', () => {
  const all = texts(homeUi(base(liveCfg(), { myBoards: [] })));
  assert.ok(all.includes('Your live board') && !all.includes('Your live boards'));
});

test('a board’s page offers the character’s other live boards (the board switcher)', () => {
  const summary = (eventId: number, name: string, done: number, total: number) => ({ eventId, name, clan: 'afk', clanName: 'AFK', teamId: 1, teamName: 'T', tilesComplete: done, tilesTotal: total, pointsScored: false });
  const d = base(liveCfg({ boards: [summary(5, 'Summer Bingo', 3, 25), summary(8, 'Clan Wars', 4, 16)] }));
  const page = eventUi(d, 'board')!;
  assert.ok(texts(page).includes('Your other live boards'));
  assert.ok(texts(page).includes('Clan Wars · 4 / 16'));
  const opens = walk(page).flatMap((n) => {
    const on = n.on as { v?: string; args?: { event?: string } } | undefined;
    return on?.v === 'board' && on.args?.event && on.args.event !== '0' ? [on.args.event] : [];
  });
  assert.deepEqual(opens, ['8'], 'not the board already open');
  assert.ok(!texts(eventUi(base(liveCfg({ boards: [summary(5, 'Summer Bingo', 3, 25)] })), 'board')!).includes('Your other live boards'));
});

test('a clan board you are seated on shows once, under Events, with your team', () => {
  const ui = homeUi(base(liveCfg(), {
    cfg: { ...liveCfg(), panel: { ...liveCfg().panel, scheduled: [{ id: 12, title: 'Winter Bingo', startDate: '2026-11-01T00:00:00Z', endDate: null, status: 'active', boardSize: 5, tileCount: 25, format: 'bingo', scoringMode: 'tiles' }] } },
    myBoards: [{ eventId: 12, name: 'Winter Bingo', clan: 'afk', clanName: 'AFK', teamId: 3, teamName: 'Ruby', tilesComplete: 0, tilesTotal: 0, pointsScored: false }],
  } as never));
  const all = texts(ui);
  assert.ok(all.includes('On Ruby'));
  assert.ok(!all.some((t) => /not in it/.test(t)), 'not "you’re not in it" for a board you are on');
  assert.ok(!all.includes('Your live boards'), 'and not a second card for it');
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
  assert.ok(all.includes('50') && all.includes('P50') && all.includes('50th of 170'), 'your line, ranked');
  assert.ok(all.includes('· · ·'));
  assert.ok(!all.includes('P4') && !all.includes('P49'), 'compact: the top three and you, no neighbours');
  assert.ok(all.includes('+1 more of your accounts'));
  assert.ok(all.includes('View all 170 players'));
  assert.ok(!all.some((s) => /teams/i.test(s)), 'no "teams" copy on a players board');
  assert.ok(!all.includes('P6'), 'the default view never ships the whole field');
  const view = walk(ui).find((x) => x.t === 'text' && x.s === 'View all 170 players') as { on: { v: string } };
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
  assert.ok(all.includes('18  Team 18 · 3 members'));
  assert.ok(all.includes('View all 30 teams'));
  assert.ok(!all.includes('All teams & members'));
  assert.ok(!all.some((s) => /players/.test(s)));
  assert.ok(!all.includes('Team 6'));
  assert.ok(walk(ui).some((x) => (x.on as { args?: { team?: string } } | undefined)?.args?.team === '18'), 'a row opens that team');
});

test('two live boards with one name: each card says its #id and opens by id, with a way back to the list', () => {
  const lab = { id: 31, title: 'Summer Bingo', startDate: '2026-10-20T00:00:00Z', endDate: null, status: 'active', boardSize: 5, tileCount: 25, format: 'bingo', scoringMode: 'tiles' };
  const d = base(liveCfg(), {
    cfg: { ...liveCfg(), panel: { ...liveCfg().panel, scheduled: [lab as ScheduleBingo] } },
    myBoards: [{ eventId: 31, name: 'Summer Bingo', clan: 'afk', clanName: 'AFK', teamId: 3, teamName: 'Ruby', tilesComplete: 1, tilesTotal: 9, pointsScored: false }],
  } as never);
  const all = texts(homeUi(d));
  assert.ok(all.includes('Summer Bingo #5') && all.includes('Summer Bingo #31'));
  const open = walk(homeUi(d)).map((n) => n.on as { a?: string; v?: string; args?: Record<string, string> } | undefined).find((on) => on?.v === 'board');
  assert.deepEqual(open?.args, { event: '31', back: 'events', backLabel: 'All events', title: 'Summer Bingo #31' });
  assert.ok(eventUi(d, 'events') === null, 'the Back lands on the list');
  assert.ok(texts(eventUi(d, 'board')!).includes('Summer Bingo #5'), 'the live board’s own page says which one it is');
  assert.ok(!texts(homeUi(base(liveCfg()))).some((t) => t.includes('#')), 'no tag while names differ');
});

test('rank moves: a green ▲ or coral ▼ by a rank that changed today, nothing by one that didn’t', () => {
  const team = (teamId: number, rank: number, move: number | null, yours = false) => ({ teamId, name: `T${teamId}`, color: '#ff0000', rank, score: `${10 - rank} tiles`, members: 2, yours, move });
  const ui = eventUi(base(liveCfg(), { standings: [team(1, 1, 2), team(2, 2, -1, true), team(3, 3, null)] }), 'board')!;
  const marks = walk(ui).filter((x) => x.t === 'text' && (x.icon as { glyph?: string } | undefined)?.glyph && ['up', 'down'].includes((x.icon as { glyph: string }).glyph));
  // Standings rows (T1 ▲2, T2 ▼1) and your top card's place (▼1); T3 unchanged shows nothing.
  assert.deepEqual(marks.map((m) => [m.s, (m.icon as { glyph: string }).glyph, m.color]), [['1', 'down', '#ff7a6b'], ['2', 'up', '#5fd35f'], ['1', 'down', '#ff7a6b']]);
  const none = eventUi(base(liveCfg(), { standings: [team(1, 1, null), team(2, 2, null, true)] }), 'board')!;
  assert.ok(!walk(none).some((x) => (x.icon as { glyph?: string } | undefined)?.glyph === 'up' || (x.icon as { glyph?: string } | undefined)?.glyph === 'down'), 'no baseline: no marks');
});

// RACE_FIXTURES=<dir> also writes the Clan tab's pages as views for the plugin's offscreen render test.
if (process.env.RACE_FIXTURES) {
  const dir = process.env.RACE_FIXTURES;
  const write = (name: string, ui: Node | null) => writeFileSync(`${dir}/${name}.json`, JSON.stringify({ ui }));
  // Relative to when the render runs: the plugin's countdowns tick against its own clock.
  const at0 = Date.now();
  const iso = (mins: number) => new Date(at0 + mins * 60_000).toISOString();
  const ce = (id: number, title: string, mins: number, extra: Record<string, unknown> = {}) => ({
    id, title, description: 'Bring warm clothing and a tinderbox. Crates split by the host at the end.', location: 'Wintertodt', world: 309, icon: 'wintertodt', imageUrl: null, channels: null, postChannel: null, host: 'Lab~Field146',
    repeat: 'weekly' as const, timezone: 'UTC', durationMin: 60, startsAt: iso(mins), repeatUntil: null, ping: false,
    occurrence: { start: iso(mins), end: iso(mins + 60) }, phase: 'upcoming' as const, going: 9, goingNames: ['Lab~Field4', 'Lab~Field7', 'Lab~Field9', 'Lab~Field10', 'Lab~Field17'], mine: false,
    modules: NO_MODULES, signup: null, surveyOpen: false, ...extra,
  });
  const signups = { ...NO_MODULES, signups: { ...NO_MODULES.signups, on: true, cap: 10 }, fee: { on: true, amount: 50_000 } };
  const events = [
    ce(1, 'Wintertodt mass', 320, { mine: true }),
    ce(2, 'GE drop party', 1620, { location: 'Grand Exchange', world: 302, going: 14 }),
    ce(3, 'Barrows boat trip', 2940, { location: 'Barrows', world: 416, going: 6, modules: signups, signup: { open: true, reason: null, cap: 10, hasForm: false, myStatus: null, myFee: null } }),
  ];
  const team = (teamId: number, name: string, color: string, rank: number, score: number, move: number | null, yours = false) => ({ teamId, name, color, rank, score: `${score} tiles`, members: 5, yours, move });
  const tiles25 = Array.from({ length: 25 }, (_, i) => ({ ...tile(i + 1, i < 14 ? 1 : 0, 1), label: ['Kill 5 bosses', 'Raid or Zulrah unique ×3', 'Log 10 Wintertodt crates', 'Vorkath under 2:00', 'Hard Ardougne diary'][i % 5] + (i >= 5 ? ` ${i}` : '') }));
  tiles25[14] = { ...tiles25[14], label: 'Kill 5 bosses', current: 4, goal: 5, complete: false };
  tiles25[15] = { ...tiles25[15], label: 'Raid or Zulrah unique ×3', current: 1, goal: 3, complete: false };
  tiles25[16] = { ...tiles25[16], label: 'Log 10 Wintertodt crates', current: 6, goal: 10, complete: false };
  const bingoCfg = liveCfg({
    clanName: 'Iron Forge',
    activeClan: { slug: 'iron-forge', name: 'Iron Forge' },
    event: { id: 5, name: 'Autumn Bingo', format: 'bingo', scoringMode: 'tiles', endDate: iso(3120) },
    board: { tilesComplete: 14, tilesTotal: 25, pointsScored: false },
    panel: {
      tiles: tiles25,
      activeNow: [{ tileId: 17, workers: ['Lab~Field4', 'You'], self: false, gains: { 'Lab~Field4': 4, You: 2 } }],
      scheduled: [{ id: 12, title: 'Spooky Leagues', startDate: iso(4440), endDate: null, status: 'upcoming', boardSize: 60, tileCount: 60, format: 'bingo', scoringMode: 'points', yourEntry: 'entered' }],
      weeklies: [{ id: 9, title: 'Skill of the Week', type: 'skill', metric: 'runecraft', metricLabel: 'Runecraft', status: 'active', startDate: iso(-7000), endDate: iso(3120) }],
    },
  });
  const weekTop = [
    { rank: 1, rsn: 'Lab~Field146', gained: 1_200_000, self: false, move: null },
    { rank: 2, rsn: 'Lab~Field4', gained: 904_000, self: false, move: 1 },
    { rank: 3, rsn: 'Lab~Field88', gained: 611_000, self: false, move: -1 },
    ...Array.from({ length: 5 }, (_, i) => ({ rank: i + 4, rsn: `Lab~Field${20 + i}`, gained: 500_000 - i * 50_000, self: false, move: null })),
    { rank: 9, rsn: 'Drenvox', gained: 182_000, self: true, move: 3 },
  ];
  const data = base(bingoCfg, {
    now: at0,
    standings: [team(1, 'Iron Lads', '#4aa3ff', 1, 16, null), team(2, 'Jade', '#5fd35f', 2, 15, 1), team(3, 'Ruby', '#e05a5a', 3, 14, -1, true), team(4, 'Amethyst', '#b38cff', 4, 11, null)],
    feed: [
      { id: 'c1', ts: iso(-5), player: 'Lab~Field4', tileId: 3, tileLabel: 'Barrows set', kind: 'complete', amount: 0, isSelf: false },
      { id: 's1', ts: iso(-10), player: 'Drenvox', tileId: 16, tileLabel: 'Raid or Zulrah unique ×3', kind: 'progress', amount: 1, isSelf: true },
      { id: 's2', ts: iso(-20), player: 'Lab~Field7', tileId: 15, tileLabel: 'Kill 5 bosses', kind: 'progress', amount: 2, isSelf: false },
    ] as ActivityEntry[],
    weekly: new Map([[9, { total: 37, top: weekTop, you: weekTop[8] }]]),
    clanEvents: events,
    boardPath: '/c/iron-forge/events/5',
    clanPath: '/c/iron-forge',
    chatOn: true,
    supportCta: true,
  });
  write('clan-list', homeUi(data));
  write('clan-bingo', eventUi(data, 'board'));
  write('clan-weekly', eventUi(data, 'weekly:9'));
  write('clan-event', eventUi({ ...data, clanEvents: [events[2], events[0]] }, 'clan-event:3'));
  write('clan-event-going', eventUi(data, 'clan-event:1'));
  const registered = { ...events[2], mine: true, going: 7, signup: { open: true, reason: null, cap: 10, hasForm: false, myStatus: 'pending', myFee: 'pending' } };
  write('clan-event-registered', eventUi({ ...data, clanEvents: [registered] }, 'clan-event:3'));
  const quiet = base({ clanName: 'Iron Forge', activeClan: { slug: 'iron-forge', name: 'Iron Forge' }, panel: { tiles: [], scheduled: [], weeklies: [] } }, { live: false, now: at0, clanEvents: events, clanPath: '/c/iron-forge', supportCta: true });
  write('clan-home', homeUi(quiet));
}
