// The in-game chat feed's rules (lib/chatFeedRules): preferences, who gets an item, once each.
// Pure. Run: npx tsx --test tests/chat-feed-rules.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_PREFS,
  cleanPrefs,
  feedItemFromMoment,
  feedMessage,
  gp,
  parsePrefs,
  recipients,
  wants,
  type Candidate,
  type ChatFeedPrefs,
  type FeedItem,
} from '../src/lib/chatFeedRules.ts';

const drop = (valueGp: number): FeedItem => ({ kind: 'drop', who: 'Zezima', text: 'received a thing', valueGp });

test('stored prefs fall back field by field, and junk is cleaned', () => {
  assert.deepEqual(parsePrefs(null), DEFAULT_PREFS);
  assert.deepEqual(parsePrefs('not json'), DEFAULT_PREFS);
  const p = parsePrefs(JSON.stringify({ guests: true, minValue: 5_000_000, ca: 'nonsense', levels: 'all' }));
  assert.equal(p.guests, true);
  assert.equal(p.minValue, 5_000_000);
  assert.equal(p.ca, DEFAULT_PREFS.ca);
  assert.equal(p.levels, DEFAULT_PREFS.levels);
  assert.equal(cleanPrefs({ minValue: -5 }).minValue, 0);
});

test('defaults: boards on, guest bridge off, drops from 1m, pets and slots on, elite tasks up', () => {
  assert.equal(DEFAULT_PREFS.events, true);
  assert.equal(DEFAULT_PREFS.guests, false);
  assert.equal(wants(DEFAULT_PREFS, drop(999_999)), false);
  assert.equal(wants(DEFAULT_PREFS, drop(1_000_000)), true);
  assert.equal(wants(DEFAULT_PREFS, { kind: 'pet', who: 'a', text: '' }), true);
  assert.equal(wants(DEFAULT_PREFS, { kind: 'clog', who: 'a', text: '' }), true);
  assert.equal(wants(DEFAULT_PREFS, { kind: 'ca', who: 'a', text: '', caTier: 'hard' }), false);
  assert.equal(wants(DEFAULT_PREFS, { kind: 'ca', who: 'a', text: '', caTier: 'master' }), true);
  assert.equal(wants(DEFAULT_PREFS, { kind: 'level', who: 'a', text: '', major: false }), false);
  assert.equal(wants(DEFAULT_PREFS, { kind: 'level', who: 'a', text: '', major: true }), true);
  assert.equal(wants(DEFAULT_PREFS, { kind: 'quest', who: 'a', text: '', major: true }), false);
});

function route(item: FeedItem, candidates: Candidate[], opts: { prefs?: Record<number, Partial<ChatFeedPrefs>>; clans?: Record<number, number[]> } = {}) {
  const prefs = new Map(Object.entries(opts.prefs ?? {}).map(([id, p]) => [Number(id), { ...DEFAULT_PREFS, ...p }]));
  const memberClans = new Map(Object.entries(opts.clans ?? {}).map(([id, c]) => [Number(id), new Set(c)]));
  return recipients({ item, senderUserId: 1, candidates, prefs, memberClans });
}

test('one line per person, tagged by the board before the guest bridge; never the sender', () => {
  const out = route(drop(5_000_000), [
    { userId: 2, via: 'guest', tag: 'Some Clan' },
    { userId: 2, via: 'event', tag: 'Summer Bingo' },
    { userId: 3, via: 'guest', tag: 'Some Clan' },
    { userId: 1, via: 'event', tag: 'Summer Bingo' },
  ], { prefs: { 2: { guests: true }, 3: { guests: true } } });
  assert.deepEqual(out, [
    { userId: 2, tag: 'Summer Bingo' },
    { userId: 3, tag: 'Some Clan' },
  ]);
});

test('the guest bridge needs the person to have turned it on; boards can be turned off', () => {
  const out = route(drop(5_000_000), [
    { userId: 2, via: 'guest', tag: 'C' },
    { userId: 3, via: 'event', tag: 'B' },
  ], { prefs: { 3: { events: false } } });
  assert.deepEqual(out, []);
});

test("someone in the sender's in-game clan is skipped — the game already told them — except for a tile", () => {
  const cands: Candidate[] = [
    { userId: 2, via: 'event', tag: 'B' },
    { userId: 3, via: 'event', tag: 'B' },
  ];
  const clans = { 1: [10], 2: [10], 3: [20] };
  assert.deepEqual(route(drop(5_000_000), cands, { clans }).map((r) => r.userId), [3]);
  const tile: FeedItem = { kind: 'tile', who: 'Blue', text: 'completed Barrows' };
  assert.deepEqual(recipients({ item: tile, senderUserId: null, candidates: cands, prefs: new Map(), memberClans: new Map(Object.entries(clans).map(([k, v]) => [Number(k), new Set(v)])) }).map((r) => r.userId), [2, 3]);
});

test("each person's own floor and kinds apply", () => {
  const cands: Candidate[] = [
    { userId: 2, via: 'event', tag: 'B' },
    { userId: 3, via: 'event', tag: 'B' },
  ];
  assert.deepEqual(route(drop(2_000_000), cands, { prefs: { 3: { minValue: 5_000_000 } } }).map((r) => r.userId), [2]);
  assert.deepEqual(route({ kind: 'pet', who: 'a', text: '' }, cands, { prefs: { 2: { pets: false } } }).map((r) => r.userId), [3]);
});

test('reported moments become lines; deaths and malformed ones do not', () => {
  const d = feedItemFromMoment({ kind: 'drop', itemName: 'Twisted bow', quantity: 1, valueGp: 1_200_000_000, source: 'Chambers of Xeric' }, 'Zezima');
  assert.equal(d?.text, 'received Twisted bow (1.2b) from Chambers of Xeric');
  assert.equal(d?.valueGp, 1_200_000_000);
  assert.equal(feedItemFromMoment({ kind: 'drop', itemName: 'x' }, 'Z'), null, 'no value');
  assert.equal(feedItemFromMoment({ kind: 'death', source: 'Zulrah' }, 'Z'), null);
  assert.equal(feedItemFromMoment({ kind: 'ca', taskName: 'x', tier: 'legendary' }, 'Z'), null);
  assert.equal(feedItemFromMoment({ kind: 'ca', taskName: 'Perfect Zulrah', tier: 'Elite' }, 'Z')?.caTier, 'elite');
  assert.equal(feedItemFromMoment({ kind: 'level', itemName: 'Slayer', quantity: 99, sourceKind: 'skill' }, 'Z')?.major, true);
  assert.equal(feedItemFromMoment({ kind: 'level', itemName: 'Slayer', quantity: 90, sourceKind: 'skill' }, 'Z')?.major, false);
  assert.equal(feedItemFromMoment({ kind: 'level', quantity: 2277, sourceKind: 'max' }, 'Z')?.major, true);
  assert.equal(feedItemFromMoment({ kind: 'diary', itemName: 'Ardougne', tier: 'Elite' }, 'Z')?.major, true);
  assert.equal(feedItemFromMoment({ kind: 'quest', itemName: 'Dragon Slayer II', sourceKind: 'cape' }, 'Z')?.major, true);
  assert.equal(feedItemFromMoment({ kind: 'wat' }, 'Z'), null);
  assert.equal(feedItemFromMoment({ kind: 'clog', itemName: '<col=ff0000>Abyssal whip</col>' }, 'Z')?.text, 'new collection log slot: Abyssal whip');
});

test('gp is short, and the message is capped for the chatbox', () => {
  assert.equal(gp(950), '950');
  assert.equal(gp(1_250_000), '1.25m');
  assert.equal(gp(45_600_000), '45.6m');
  assert.equal(gp(1_100_000_000), '1.1b');
  const m = feedMessage({ kind: 'drop', who: 'x'.repeat(80), text: 'y'.repeat(400) }, 't'.repeat(80));
  assert.equal(m.t, 'feed');
  assert.equal(m.who.length, 40);
  assert.equal(m.tag.length, 40);
  assert.equal(m.text.length, 160);
});

test('a gradient name rides along for plugins that draw it; the solid colour stays for the rest', () => {
  const item = { kind: 'drop', who: 'Zezima', text: 'Twisted bow' } as unknown as Parameters<typeof feedMessage>[0];
  const m = feedMessage(item, 'Clan', { color: '#e05ad0', star: false, grad: ['#ff9a5a', '#e05ad0', '#7a8cff', '#000000', '#ffffff'] });
  assert.equal(m.whoColor, '#e05ad0');
  assert.deepEqual(m.whoGrad, ['#ff9a5a', '#e05ad0', '#7a8cff', '#000000'], 'at most four stops');
  assert.equal(feedMessage(item, 'Clan', { color: '#ffd35c', star: false }).whoGrad, undefined, 'a solid name sends none');
});
