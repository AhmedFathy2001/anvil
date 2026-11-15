// The routing rule for one clan and one character's social post (drop, death, pet, level), with no
// database: lib/emissionRule. The DB matrix lives in tests/emission-routing.test.ts.
//
// Run: npx tsx --test tests/emission-rule.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { emissionDecision, GUEST_POSTS_BLOCKED_BY_DEFAULT } from '../src/lib/emissionRule.ts';

const base = { override: undefined, clanBlocksGuests: false, userBlocksGuests: GUEST_POSTS_BLOCKED_BY_DEFAULT };

test('the default is quiet in guest clans, and the schema default agrees', () => {
  assert.equal(GUEST_POSTS_BLOCKED_BY_DEFAULT, true);
  const schema = readFileSync(new URL('../src/db/schema.ts', import.meta.url), 'utf-8');
  assert.match(schema, /boolean\('block_guest_emissions'\)\.notNull\(\)\.default\(true\)/);
});

test('a player who changed nothing: own clan posts, guest clan does not', () => {
  assert.equal(emissionDecision({ ...base, seat: 'member' }), 'member');
  assert.equal(emissionDecision({ ...base, seat: 'guest' }), null);
});

test('turning guest-clan posting on posts in clans where they hold a guest seat', () => {
  assert.equal(emissionDecision({ ...base, seat: 'guest', userBlocksGuests: false }), 'guest');
  // On, but no seat in that clan: nothing.
  assert.equal(emissionDecision({ ...base, seat: null, userBlocksGuests: false }), null);
});

test('the own clan is unaffected by the guest switch and by the clan guest veto', () => {
  for (const userBlocksGuests of [true, false]) {
    for (const clanBlocksGuests of [true, false]) {
      assert.equal(emissionDecision({ seat: 'member', override: undefined, clanBlocksGuests, userBlocksGuests }), 'member');
      assert.equal(emissionDecision({ seat: 'member', override: true, clanBlocksGuests, userBlocksGuests }), 'member');
    }
  }
  assert.equal(emissionDecision({ ...base, seat: 'member', override: false }), null, 'only an explicit "never" silences it');
});

test('"always" for one clan posts there while the switch is off', () => {
  assert.equal(emissionDecision({ ...base, seat: 'guest', override: true }), 'guest');
  assert.equal(emissionDecision({ ...base, seat: null, override: true }), 'guest', 'an alt pointed at a clan');
});

test('"never" for one clan wins over the switch being on', () => {
  assert.equal(emissionDecision({ ...base, seat: 'guest', override: false, userBlocksGuests: false }), null);
});

test('a clan that refuses guests gets none, whatever the player chose', () => {
  assert.equal(emissionDecision({ seat: 'guest', override: undefined, clanBlocksGuests: true, userBlocksGuests: false }), null);
  assert.equal(emissionDecision({ seat: 'guest', override: true, clanBlocksGuests: true, userBlocksGuests: false }), null);
  assert.equal(emissionDecision({ seat: null, override: true, clanBlocksGuests: true, userBlocksGuests: true }), null);
});
