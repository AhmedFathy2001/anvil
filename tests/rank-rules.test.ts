// Rank rules (lib/rankRules): roles that add up as people climb the clan's rank ladder.
//
// Run: node --experimental-strip-types --test tests/rank-rules.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applyRankRules, effectiveRankOrder, highestRank, parseRankRules, ruleMatches } from '../src/lib/rankRules.ts';

const order = ['owner', 'deputy owner', 'administrator', 'moderator', 'general', 'sergeant', 'recruit'];
const rules = parseRankRules([
  { id: 'a', rank: 'Deputy Owner', mode: 'up', roleId: '1000001', staff: 'admin' },
  { id: 'b', rank: 'moderator', mode: 'up', roleId: '1000002', staff: 'moderator' },
  { id: 'c', rank: 'sergeant', mode: 'up', roleId: '1000003', keep: true },
  { id: 'd', rank: 'general', mode: 'eq', roleId: '1000004' },
]);

test('roles add up as people climb', () => {
  assert.deepEqual([...applyRankRules(rules, order, 'recruit').give], []);
  assert.deepEqual([...applyRankRules(rules, order, 'sergeant').give], ['1000003']);
  assert.deepEqual([...applyRankRules(rules, order, 'moderator').give].sort(), ['1000002', '1000003']);
  assert.deepEqual([...applyRankRules(rules, order, 'Owner').give].sort(), ['1000001', '1000002', '1000003']);
});

test('"exactly" matches only its rank', () => {
  assert.equal(ruleMatches(rules[3], 'general', order), true);
  assert.equal(ruleMatches(rules[3], 'moderator', order), false);
});

test('kept roles are never managed (never taken back); the rest are', () => {
  const out = applyRankRules(rules, order, 'recruit');
  assert.equal(out.managed.has('1000003'), false);
  assert.equal(out.managed.has('1000002'), true);
  assert.equal(applyRankRules(rules, order, 'recruit', false).managed.size, 0);
});

test('site access suggestion is the highest a matching rule names', () => {
  assert.equal(applyRankRules(rules, order, 'administrator').staff, 'moderator');
  assert.equal(applyRankRules(rules, order, 'deputy owner').staff, 'admin');
  assert.equal(applyRankRules(rules, order, 'sergeant').staff, 'none');
});

test('a custom rank nobody placed matches only exact rules', () => {
  assert.equal(ruleMatches(rules[1], 'marshal', order), false);
});

test('the ladder fills in roster ranks: standard ones in place, custom by Discord position, else rarest first', () => {
  const o = effectiveRankOrder(['owner', 'recruit'], [
    { rank: 'Sergeant', count: 20 },
    { rank: 'Marshal', count: 2 },
    { rank: 'Pawn', count: 40 },
    { rank: 'Friend', count: 5 },
  ]);
  assert.deepEqual(o, ['owner', 'sergeant', 'recruit', 'marshal', 'pawn']);
  assert.equal(highestRank(['recruit', 'Sergeant', null], o), 'sergeant');
});
