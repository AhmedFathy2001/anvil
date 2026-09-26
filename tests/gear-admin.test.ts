// Platform edits to the gear calculator: custom effect rules and override validation. No database.
//
// Run: npx tsx --test tests/gear-admin.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { calculate, type GearItem, type Monster } from '../src/lib/dps/engine.ts';
import { ruleApplies, sanitizeRule, type EffectRule } from '../src/lib/dps/effects.ts';
import { sanitizeItemPatch, sanitizeMonsterPatch } from '../src/lib/dps/overrides.ts';

const SWORD: GearItem = { id: 1, n: 'Test sword', s: 'weapon', b: [50, 50, 0, 0, 0, 60, 0, 0, 0], sp: 4, c: 'Stab Sword' };
const lookup = (id: number | null | undefined) => (id === 1 ? SWORD : null);
const DRAGON: Monster = { n: 'Test dragon', hp: 300, lv: [100, 100], d: [50, 50, 50, 50, 50, 50, 50], a: ['dragon'], sz: 3 };
const GOBLIN: Monster = { ...DRAGON, n: 'Goblin', a: [] };
const LOAD = { gear: { weapon: 1 }, style: 0, stats: { attack: 90, strength: 90, ranged: 1, magic: 1 } };

const rule = (over: Partial<EffectRule> = {}): EffectRule => ({
  id: 'r1',
  name: 'Test sword vs dragons',
  enabled: true,
  weapons: ['test sword'],
  monsterAttributes: ['dragon'],
  accuracy: 1.2,
  damage: 1.25,
  ...over,
});

test('a rule applies only when every condition it names holds', () => {
  const ctx = { weapon: 'Test sword', worn: ['Test sword'], kind: 'melee' as const, attackType: 'stab' as const, monsterName: 'Test dragon', monsterAttributes: ['dragon'], onTask: false };
  assert.equal(ruleApplies(rule(), ctx), true);
  assert.equal(ruleApplies(rule(), { ...ctx, monsterAttributes: [] }), false);
  assert.equal(ruleApplies(rule({ kinds: ['ranged'] }), ctx), false);
  assert.equal(ruleApplies(rule({ enabled: false }), ctx), false);
  assert.equal(ruleApplies(rule({ onTask: true }), ctx), false);
  // A rule with no gear/target condition would boost everything — never applies.
  assert.equal(ruleApplies(rule({ weapons: [], monsterAttributes: [] }), ctx), false);
});

test('the engine applies a rule after its own effects, and says so', () => {
  const base = calculate(LOAD, DRAGON, lookup)!;
  const boosted = calculate(LOAD, DRAGON, lookup, [rule()])!;
  assert.equal(boosted.maxHit, Math.floor(base.maxHit * 1.25));
  assert.equal(boosted.attackRoll, Math.floor(base.attackRoll * 1.2));
  assert.ok(boosted.notes.some((n) => n.includes('Test sword vs dragons')));
  // Not a dragon: unchanged.
  assert.equal(calculate(LOAD, GOBLIN, lookup, [rule()])!.maxHit, calculate(LOAD, GOBLIN, lookup)!.maxHit);
});

test('rule validation refuses rules that would boost everything or do nothing', () => {
  assert.throws(() => sanitizeRule({ name: 'x', accuracy: 1.2 }, 'a'), /at least one condition/);
  assert.throws(() => sanitizeRule({ name: 'x', weapons: ['a'] }, 'a'), /changes nothing/);
  assert.throws(() => sanitizeRule({ name: 'x', weapons: ['a'], damage: 9 }, 'a'), /between 0.5 and 3/);
  const ok = sanitizeRule({ name: ' Set bonus ', wornAll: ['A', 'B'], kinds: ['melee', 'bogus'], accuracy: '1.1', damage: 1 }, 'id9');
  assert.deepEqual([ok.id, ok.name, ok.kinds, ok.accuracy], ['id9', 'Set bonus', ['melee'], 1.1]);
});

test('item overrides: additions must be complete, patches may be partial, numbers are clamped', () => {
  assert.throws(() => sanitizeItemPatch({ n: 'New thing' }, true), /slot/);
  const add = sanitizeItemPatch({ n: 'New thing', s: 'weapon', b: [0, 999, 0, 0, 0, 5000, 0, 250, 0], c: 'Whip', sp: 4 }, true);
  assert.deepEqual(add.b, [0, 400, 0, 0, 0, 400, 0, 100, 0]);
  assert.deepEqual(sanitizeItemPatch({ sp: 5 }, false), { sp: 5 });
  assert.throws(() => sanitizeItemPatch({ c: 'Laser' }, false), /weapon category/);
  assert.throws(() => sanitizeItemPatch({ img: '../../x.svg' }, false), /wiki image/);
});

test('monster overrides: levels, defences and weakness', () => {
  const m = sanitizeMonsterPatch({ n: 'New boss', hp: 1500, lv: [250, 200], d: [100, 100, 100, 50, 80, 80, 80], a: 'Demon, Large', ew: 'Fire', ewp: 25 }, true);
  assert.deepEqual([m.hp, m.lv, m.a, m.ew, m.ewp], [1500, [250, 200], ['demon', 'large'], 'fire', 25]);
  assert.throws(() => sanitizeMonsterPatch({ n: 'x', hp: 10, lv: [1], d: [] }, true), /defence, magic/);
  assert.throws(() => sanitizeMonsterPatch({ ew: 'plasma' }, false), /air, water, earth or fire/);
});
