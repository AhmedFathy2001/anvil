// The game-value counter catalog (lib/gameCounters) and the wire shape the plugin's
// GameValueCounters reads. These names are matched verbatim against kill tiles, and nothing
// validates a tile's target at author time — so a malformed entry is a tile that counts zero.
//
// Run: npx tsx --test tests/game-counters.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { GAME_COUNTERS, pluginGameCounters } from '../src/lib/gameCounters.ts';
import { COUNTER_TARGETS } from '../src/lib/constants.ts';

test('every entry is well-formed', () => {
  const names = new Set<string>();
  for (const c of GAME_COUNTERS) {
    assert.ok(c.name.trim(), 'name');
    assert.ok(!names.has(c.name.toLowerCase()), `duplicate ${c.name}`);
    names.add(c.name.toLowerCase());
    // The plugin's kill index strips a trailing "(...)" as a wiki qualifier.
    assert.ok(!/\)\s*$/.test(c.name), `${c.name} ends in a parenthetical`);
    assert.ok(c.sources.length > 0, `${c.name} has no source`);
    for (const s of [...c.sources, ...(c.unless ?? [])]) {
      assert.ok(s.type === 'varbit' || s.type === 'varp', `${c.name} source type`);
      assert.ok(Number.isInteger(s.id) && s.id > 0, `${c.name} source id`);
    }
    assert.equal(typeof c.confirmed, 'boolean');
  }
});

test('plugin wire shape carries exactly what GameValueCounters.Entry reads', () => {
  const allowed = new Set(['name', 'sources', 'direction', 'confirmed', 'maxDelta', 'balance', 'changes', 'unless']);
  const wire = pluginGameCounters();
  assert.equal(wire.length, GAME_COUNTERS.length);
  for (const w of wire) {
    for (const k of Object.keys(w)) assert.ok(allowed.has(k), `unexpected field ${k}`);
    assert.ok(w.direction === 'increase' || w.direction === 'decrease');
    for (const s of w.sources) assert.deepEqual(Object.keys(s).sort(), ['id', 'type']);
  }
  const claimed = wire.find((w) => w.name === 'Wintertodt rewards claimed');
  assert.equal(claimed?.direction, 'decrease');
});

test('slayer split: any master counts once per tick; other masters stands down for Mortimer/Krystilia', () => {
  const any = GAME_COUNTERS.find((c) => c.name === 'Slayer tasks: any master')!;
  assert.equal(any.changes, true);
  assert.equal(any.sources.length, 3);
  const other = GAME_COUNTERS.find((c) => c.name === 'Slayer tasks: other masters')!;
  assert.deepEqual(other.sources, [{ type: 'varbit', id: 4069 }]);
  assert.deepEqual(new Set((other.unless ?? []).map((s) => `${s.type}:${s.id}`)), new Set(['varp:5720', 'varbit:5617']));
});

test('the kill picker offers every catalog entry, unconfirmed ones marked', () => {
  for (const c of GAME_COUNTERS) {
    const chip = COUNTER_TARGETS.find((t) => t.name === c.name);
    assert.ok(chip, `${c.name} missing from COUNTER_TARGETS`);
    assert.equal(chip!.confirmed, c.confirmed);
  }
  const lower = COUNTER_TARGETS.map((t) => t.name.toLowerCase());
  assert.equal(new Set(lower).size, lower.length, 'duplicate counter target');
});

test('new chat counters have their patterns in the site copy of the catalog', () => {
  const catalog = JSON.parse(readFileSync(new URL('../src/data/chatPatterns.json', import.meta.url), 'utf8')) as {
    patterns: { key: string }[];
  };
  const keys = new Set(catalog.patterns.map((p) => p.key));
  for (const k of ['counter.gotr_energy', 'counter.reward_search', 'counter.vale_offerings', 'counter.sunstone_golem', 'counter.doom_delve']) {
    assert.ok(keys.has(k), k);
  }
});

test('every entry has a per-action ceiling; balances never on resetting counters', () => {
  for (const c of GAME_COUNTERS) {
    // The ceiling is what stops a var that arrives late after login from crediting the whole value.
    assert.ok(c.maxDelta != null && c.maxDelta > 0 && c.maxDelta <= 200, `${c.name} needs a real-action maxDelta`);
    if (c.balance) assert.notEqual(c.direction, 'decrease', `${c.name}: balance guard is for earned points`);
  }
  for (const n of ['Tithe Farm points', "Giants' Foundry reputation"]) {
    assert.equal(GAME_COUNTERS.find((c) => c.name === n)?.balance, true, n);
  }
  for (const c of GAME_COUNTERS.filter((c) => c.name.startsWith('Slayer') || c.name.startsWith('Wintertodt'))) {
    assert.ok(!c.balance, `${c.name} legitimately rises from 0`);
  }
});
