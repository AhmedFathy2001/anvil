// Clan-wide achievements on the panel Feed: what the clan keeps with nothing running, what its feed
// shows, and how the rows read. Pure — no database (the DB half is feed-achievements-db.test.ts).
//
// Run: npx tsx --test tests/feed-achievements.test.ts

import assert from 'node:assert/strict';
import test from 'node:test';

import { DEFAULT_LEVEL_RULES } from '../src/lib/levelRules.ts';
import {
  DEFAULT_CLAN_SCOPE,
  achievementDedupKey,
  classifyObservation,
  clogItemIdByName,
  diaryTier,
  isAchievementKind,
  isClanWorthy,
  momentSentence,
  type ClanScope,
  type Observation,
} from '../src/lib/moments.ts';
import { feedTabUi, kindGroup, momentFeedIds, momentRow, momentTitle } from '../src/lib/pluginUi/feedUi.ts';

const AT = '2026-11-04T10:00:00.000Z';
const clan: ClanScope = { ...DEFAULT_CLAN_SCOPE, minCaTier: 'Elite', levelRules: DEFAULT_LEVEL_RULES };
const idle = { weeklies: [], event: null, clan };

function obs(kind: Observation['kind'], extra: Partial<Observation> = {}): Observation {
  return { kind, occurredAt: AT, dedupKey: `${kind}|k`, ...extra };
}

const kept = (o: Observation, scopes: Parameters<typeof classifyObservation>[1] = idle) =>
  classifyObservation(o, scopes).map((p) => [p.kind, p.dedupKey]);

test('the clan keeps a new log slot, with the log’s own icon', () => {
  const [row] = classifyObservation(obs('clog', { itemName: 'Dragon warhammer' }), idle);
  assert.equal(row.kind, 'clog');
  assert.equal(row.dedupKey, 'clog|k:clan');
  assert.equal(row.eventId, null);
  assert.equal(row.weeklyCompetitionId, null);
  assert.equal(row.itemId, clogItemIdByName('dragon WARHAMMER'));
  assert.ok(row.itemId != null, 'resolved by name');
  assert.deepEqual(kept(obs('clog')), [], 'a slot with no name is nothing');
});

test('diaries and quests are kept; a diary needs a real tier', () => {
  const [d] = classifyObservation(obs('diary', { itemName: 'Varrock', tier: 'hard' }), idle);
  assert.equal(d.kind, 'diary');
  assert.equal(d.tier, 'Hard');
  assert.deepEqual(kept(obs('diary', { itemName: 'Varrock', tier: 'Grandmaster' })), []);
  assert.deepEqual(kept(obs('quest', { itemName: 'Desert Treasure II' })), [['quest', 'quest|k:clan']]);
  assert.equal(diaryTier('ELITE'), 'Elite');
  assert.equal(diaryTier('none'), null);
});

test('levels follow the clan’s level rules', () => {
  const level = (n: number, sourceKind: string, itemName: string | null = 'Slayer') => obs('level', { quantity: n, sourceKind, itemName });
  assert.deepEqual(kept(level(99, 'skill')).map((r) => r[0]), ['level'], 'a 99');
  assert.deepEqual(kept(level(90, 'skill')), [], 'a 90 is not announced by default');
  assert.deepEqual(kept(level(2000, 'total', null)).map((r) => r[0]), ['level'], 'a round total from 1800');
  assert.deepEqual(kept(level(1500, 'total', null)), [], 'below the clan’s total floor');
  assert.deepEqual(kept(level(2277, 'max', null)).map((r) => r[0]), ['level'], 'max');
  const every10: ClanScope = { ...clan, levelRules: { ...DEFAULT_LEVEL_RULES, skillStep: 10, skillFrom: 50 } };
  assert.deepEqual(kept(level(90, 'skill'), { weeklies: [], event: null, clan: every10 }).map((r) => r[0]), ['level'], 'a clan announcing every 10 from 50');
  const noMax: ClanScope = { ...clan, levelRules: { ...DEFAULT_LEVEL_RULES, maxTotal: false } };
  assert.deepEqual(kept(level(2277, 'max', null), { weeklies: [], event: null, clan: noMax }), []);
});

test('combat tasks at or above the clan’s tier', () => {
  assert.deepEqual(kept(obs('ca', { taskName: 'Some new task', tier: 'Elite' })).map((r) => r[0]), ['ca']);
  assert.deepEqual(kept(obs('ca', { taskName: 'Some new task', tier: 'Hard' })), []);
});

test('a board or week never claims a log slot, diary or quest — only the clan keeps them', () => {
  const event = { id: 5, teamId: 2, sources: ['Vorkath'], itemIds: [], minLootGp: 1_000_000 };
  const weekly = { id: 7, type: 'boss' as const, metric: 'vorkath' };
  for (const o of [obs('clog', { itemName: 'Draconic visage', source: 'Vorkath' }), obs('diary', { itemName: 'Varrock', tier: 'Hard' }), obs('quest', { itemName: 'Dragon Slayer II' })]) {
    const rows = classifyObservation(o, { weeklies: [weekly], event, clan });
    assert.deepEqual(rows.map((r) => [r.eventId, r.weeklyCompetitionId]), [[null, null]], o.kind);
  }
  // A level the board keeps is not stored again for the clan (the backstop only catches leftovers).
  const level = classifyObservation(obs('level', { quantity: 99, sourceKind: 'skill', itemName: 'Slayer' }), { weeklies: [], event, clan });
  assert.deepEqual(level.map((r) => r.dedupKey), ['level|k:e5']);
});

test('the clan feed shows achievements by the clan’s own bar, whatever scope kept them', () => {
  assert.equal(isClanWorthy({ kind: 'clog', itemName: 'Dragon warhammer' }, clan), true);
  assert.equal(isClanWorthy({ kind: 'diary', itemName: 'Varrock', tier: 'Hard' }, clan), true);
  assert.equal(isClanWorthy({ kind: 'quest', itemName: 'Cook’s Assistant' }, clan), true);
  assert.equal(isClanWorthy({ kind: 'level', sourceKind: 'skill', quantity: 99 }, clan), true);
  assert.equal(isClanWorthy({ kind: 'level', sourceKind: 'skill', quantity: 75 }, clan), false, 'a board’s 75 stays on the board');
  assert.equal(isClanWorthy({ kind: 'level', sourceKind: 'max', quantity: 2277 }, clan), true);
  assert.equal(isClanWorthy({ kind: 'ca', tier: 'Master' }, clan), true);
  assert.equal(isClanWorthy({ kind: 'ca', tier: 'Medium' }, clan), false);
  assert.ok(['ca', 'level', 'clog', 'diary', 'quest'].every(isAchievementKind));
  assert.ok(!['pet', 'unique', 'loot', 'death'].some(isAchievementKind));
});

const like = (extra: Record<string, unknown>) => ({
  id: 9,
  rsn: 'Rikkert',
  kind: 'clog',
  itemId: null,
  itemName: null,
  quantity: 1,
  valueGp: null,
  source: null,
  teamId: null,
  occurredAt: AT,
  ...extra,
});

test('achievement rows read well', () => {
  assert.equal(momentTitle(like({ kind: 'clog', itemName: 'Dragon warhammer' })), 'New log slot: Dragon warhammer');
  assert.equal(momentTitle(like({ kind: 'level', itemName: 'Slayer', quantity: 99, sourceKind: 'skill' })), '99 Slayer');
  assert.equal(momentTitle(like({ kind: 'level', quantity: 2000, sourceKind: 'total' })), '2,000 total level');
  assert.equal(momentTitle(like({ kind: 'level', quantity: 2277, sourceKind: 'max' })), 'Maxed: 2,277 total level');
  assert.equal(momentTitle(like({ kind: 'ca', itemName: 'Vault of Death', tier: 'Elite' })), 'Elite combat task: Vault of Death');
  assert.equal(momentTitle(like({ kind: 'diary', itemName: 'Varrock', tier: 'Hard' })), 'Completed the Hard Varrock Diary');
  assert.equal(momentTitle(like({ kind: 'quest', itemName: 'Desert Treasure II' })), 'Quest: Desert Treasure II');
  assert.equal(momentSentence(like({ kind: 'diary', itemName: 'Varrock', tier: 'Hard' })), 'completed the Hard Varrock Diary');
  assert.equal(momentSentence(like({ kind: 'clog', itemName: 'Dragon warhammer' })), 'filled a new collection log slot: Dragon warhammer');
});

test('an item icon where there is one, else a gold tick', () => {
  const withIcon = momentRow(like({ kind: 'clog', itemId: 13576, itemName: 'Dragon warhammer' }));
  assert.equal(withIcon.item, 13576);
  assert.equal(withIcon.glyph, undefined);
  const glyph = momentRow(like({ kind: 'diary', itemName: 'Varrock', tier: 'Hard' }));
  assert.equal(glyph.item, undefined);
  assert.equal(glyph.glyph, 'check');
  assert.equal(glyph.glyphColor, '#ffd35c');
  assert.equal(glyph.title, 'Completed the Hard Varrock Diary');
});

test('achievements have their own list, and are in All', () => {
  for (const k of ['ca', 'level', 'clog', 'diary', 'quest']) assert.equal(kindGroup(k), 'achievements', k);
  assert.deepEqual(momentFeedIds({ kind: 'clan', id: 3 }, 'diary', null), ['moments:clan:3', 'moments:clan:3:achievements']);
  assert.deepEqual(momentFeedIds({ kind: 'event', id: 9 }, 'level', 4), ['moments:event:9', 'moments:event:9:achievements', 'moments:event:9:team:4']);
});

test('the Feed tab has an Achievements chip and an empty line for it', () => {
  const scope = { kind: 'clan' as const, id: 3, slug: 'c', name: 'Clan' };
  const ui = JSON.stringify(feedTabUi({ scopes: [scope], current: scope, pane: 'feed', chatAvailable: false, filter: 'achievements', teamId: null, rows: [] }));
  assert.match(ui, /"s":"Achievements"/);
  assert.match(ui, /"id":"moments:clan:3:achievements"/);
  assert.match(ui, /No achievements yet/);
  const all = JSON.stringify(feedTabUi({ scopes: [scope], current: scope, pane: 'feed', chatAvailable: false, filter: 'all', teamId: null, rows: [] }));
  assert.match(all, /"id":"moments:clan:3"/);
  const board = { kind: 'event' as const, id: 9, name: 'Bingo' };
  assert.match(JSON.stringify(feedTabUi({ scopes: [board], current: board, pane: 'feed', chatAvailable: false, filter: 'all', teamId: 4, rows: [] })), /"s":"Achievements"/, 'on a board too');
});

test('an achievement is keyed by what it is, not by the client', () => {
  assert.equal(achievementDedupKey('clog', { itemName: ' Dragon Warhammer ' }), 'clog|dragon warhammer');
  assert.equal(achievementDedupKey('diary', { itemName: 'Varrock', tier: 'HARD' }), 'diary|varrock|hard');
  assert.equal(achievementDedupKey('diary', { itemName: 'Varrock', tier: 'nope' }), null);
  assert.equal(achievementDedupKey('quest', { itemName: 'Desert Treasure II' }), 'quest|desert treasure ii');
  assert.equal(achievementDedupKey('ca', { taskName: 'Vault of Death' }), 'ca|vault of death');
  assert.equal(achievementDedupKey('level', { itemName: 'Slayer' }), null, 'levels keep the client’s key');
  assert.equal(achievementDedupKey('drop', { itemName: 'Whip' }), null);
});
