// The highlight rules (lib/moments) — what a pet, a unique, a big haul or a death is worth keeping
// against, and which competition week or board it lands on.
//
// Run: npx tsx --test tests/moments.test.ts
// (tsx, not native type-stripping: the module reads the shipped datasets through the `@/` alias.)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  bossUniqueIds,
  classifyObservation,
  dropRate,
  mappedPetNames,
  matchesBoss,
  momentSentence,
  petsForSkill,
  type EventScope,
  type Observation,
  type WeeklyScope,
} from '../src/lib/moments.ts';
import { clogItemNames, clogPageItems } from '../src/lib/clogDataset.ts';

const BOTW: WeeklyScope = { id: 1, type: 'boss', metric: 'zulrah' };
const SOTW: WeeklyScope = { id: 2, type: 'skill', metric: 'runecraft' };

const board: EventScope = { id: 9, sources: ['Vorkath'], itemIds: [11286], minLootGp: 1_000_000 };

function obs(over: Partial<Observation> = {}): Observation {
  return {
    kind: 'drop',
    occurredAt: '2026-08-17T10:00:00.000Z',
    dedupKey: 'k1',
    ...over,
  };
}

/** The pet map is only useful if its names still match the catalogue it's meant to point into. */
test('every mapped pet name exists in the collection-log catalogue', () => {
  const known = new Set([...clogItemNames().values()].map((n) => n.toLowerCase()));
  const missing = mappedPetNames().filter((n) => !known.has(n.toLowerCase()));
  assert.deepEqual(missing, [], `skillPets.json names not in clog.json: ${missing.join(', ')}`);
});

/**
 * The catalogue's "Skilling Pets" page is exactly the set of pets with no boss page of their own —
 * so a name on it that isn't in the map is a skill week that can never notice its own pet. Nothing
 * else in the system can catch that: the pet simply never appears and nobody knows to look.
 *
 * Every one of them is assigned today, which is why this has no allowlist: the next pet a game
 * update adds fails here, and the fix is one line of src/data/skillPets.json.
 */
test('every pet with no boss page of its own is mapped to a skill', () => {
  const mapped = new Set(mappedPetNames().map((n) => n.toLowerCase()));
  const unassigned = clogPageItems('Skilling Pets')
    .map((i) => i.name)
    .filter((name) => !mapped.has(name.toLowerCase()));
  assert.deepEqual(
    unassigned,
    [],
    `new skilling pets with no owning skill in src/data/skillPets.json: ${unassigned.join(', ')}`,
  );
});

test('a boss week keeps a unique off its own boss', () => {
  const planned = classifyObservation(
    obs({ itemId: 12922, itemName: 'Tanzanite fang', source: 'Zulrah', kc: 210 }),
    { weeklies: [BOTW], event: null },
  );
  assert.equal(planned.length, 1);
  assert.equal(planned[0].kind, 'unique');
  assert.equal(planned[0].weeklyCompetitionId, 1);
  // Priced here, from the shipped drop table — never taken from the client.
  assert.ok((planned[0].rarityDenominator ?? 0) > 100);
});

test('a boss week ignores a unique from a different boss', () => {
  const planned = classifyObservation(
    obs({ itemId: 11286, itemName: 'Draconic visage', source: 'Vorkath' }),
    { weeklies: [BOTW], event: null },
  );
  assert.deepEqual(planned, []);
});

test('a boss week ignores ordinary loot from its own boss', () => {
  // Zulrah drops plenty of death runes; a stack of them is not a moment.
  const planned = classifyObservation(
    obs({ itemId: 560, itemName: 'Death rune', quantity: 500, source: 'Zulrah' }),
    { weeklies: [BOTW], event: null },
  );
  assert.deepEqual(planned, []);
});

test('a skill week keeps the pets that skill produces, and no others', () => {
  const rift = classifyObservation(
    obs({ kind: 'pet', itemName: 'Rift guardian', source: 'Guardians of the Rift' }),
    { weeklies: [SOTW], event: null },
  );
  assert.equal(rift.length, 1);
  assert.equal(rift[0].kind, 'pet');

  const beaver = classifyObservation(
    obs({ kind: 'pet', itemName: 'Beaver' }),
    { weeklies: [SOTW], event: null },
  );
  assert.deepEqual(beaver, []);
});

test('a skill week ignores drops and deaths — it has no boss', () => {
  const scopes = { weeklies: [SOTW], event: null };
  assert.deepEqual(classifyObservation(obs({ itemId: 12922, source: 'Zulrah' }), scopes), []);
  assert.deepEqual(classifyObservation(obs({ kind: 'death', source: 'Zulrah' }), scopes), []);
});

test('an efficiency week claims nothing — everything happens during it', () => {
  const ehp: WeeklyScope = { id: 3, type: 'efficiency', metric: 'ehp' };
  const planned = classifyObservation(
    obs({ kind: 'pet', itemName: 'Rift guardian' }),
    { weeklies: [ehp], event: null },
  );
  assert.deepEqual(planned, []);
});

test('a boss week keeps a death to that boss', () => {
  const planned = classifyObservation(
    obs({ kind: 'death', source: 'Zulrah' }),
    { weeklies: [BOTW], event: null },
  );
  assert.equal(planned.length, 1);
  assert.equal(planned[0].kind, 'death');
});

test('a raid week keeps a death to one of its rooms', () => {
  const cox: WeeklyScope = { id: 4, type: 'boss', metric: 'chambersOfXeric' };
  const planned = classifyObservation(
    obs({ kind: 'death', source: 'Great Olm' }),
    { weeklies: [cox], event: null },
  );
  assert.equal(planned.length, 1);
  assert.equal(planned[0].kind, 'death');
});

test('a boss answers to its nickname and its punctuation', () => {
  assert.ok(matchesBoss('Zulrah', 'zulrah'));
  assert.ok(matchesBoss("Vet'ion", 'vetion'));
  assert.ok(matchesBoss('vetion', 'vetion'));
  // Short generic aliases must not make every raid match every other one.
  assert.equal(matchesBoss('raids', 'chambersOfXeric'), false);
});

test('a bingo keeps a near-miss: the board named the source, the drop was not the tile item', () => {
  const planned = classifyObservation(
    obs({ itemId: 11286, itemName: 'Draconic visage', source: 'Vorkath', valueGp: 0 }),
    { weeklies: [], event: board },
  );
  assert.equal(planned.length, 1);
  assert.equal(planned[0].eventId, 9);
});

test('a bingo keeps a big haul from anywhere, as loot', () => {
  const planned = classifyObservation(
    obs({ itemId: 2577, itemName: 'Ranger boots', source: 'Reward Casket (Hard)', valueGp: 30_000_000 }),
    { weeklies: [], event: board },
  );
  assert.equal(planned.length, 1);
  assert.equal(planned[0].kind, 'loot');
});

test('a bingo drops a cheap haul from a source nobody has a tile for', () => {
  const planned = classifyObservation(
    obs({ itemId: 995, itemName: 'Coins', quantity: 400, source: 'Goblin', valueGp: 400 }),
    { weeklies: [], event: board },
  );
  assert.deepEqual(planned, []);
});

test('a bingo keeps every pet and every death', () => {
  const pet = classifyObservation(obs({ kind: 'pet', itemName: 'Beaver' }), { weeklies: [], event: board });
  assert.equal(pet.length, 1);
  const death = classifyObservation(obs({ kind: 'death', source: 'Chaos Fanatic' }), { weeklies: [], event: board });
  assert.equal(death.length, 1);
});

test('one moment can land on both a week and a board, with keys that stay apart', () => {
  const planned = classifyObservation(
    obs({ kind: 'pet', itemName: 'Rift guardian', dedupKey: 'pet-1' }),
    { weeklies: [SOTW], event: board },
  );
  assert.equal(planned.length, 2);
  assert.deepEqual(planned.map((p) => p.dedupKey).sort(), ['pet-1:e9', 'pet-1:w2']);
});

test('the same observation classified twice produces the same keys — a retry cannot duplicate', () => {
  const scopes = { weeklies: [BOTW], event: board };
  const first = classifyObservation(obs({ itemId: 12922, source: 'Zulrah' }), scopes);
  const second = classifyObservation(obs({ itemId: 12922, source: 'Zulrah' }), scopes);
  assert.deepEqual(first.map((p) => p.dedupKey), second.map((p) => p.dedupKey));
});

test('a boss log page is the definition of its uniques', () => {
  assert.ok(bossUniqueIds('zulrah').has(12922)); // Tanzanite fang
  assert.equal(bossUniqueIds('zulrah').has(11286), false); // Draconic visage is Vorkath's
});

test('a drop rate is read from the source that actually drops it', () => {
  assert.ok((dropRate('Zulrah', 12922) ?? 0) > 100);
  assert.equal(dropRate('Zulrah', 11286), null);
});

test('runecraft has both of its pets', () => {
  const pets = petsForSkill('runecraft');
  assert.ok(pets.has('riftguardian'));
  assert.ok(pets.has('abyssalprotector'));
});

test('the feed sentence reads as a sentence', () => {
  assert.equal(
    momentSentence({ kind: 'pet', itemName: 'Rift guardian', quantity: 1, source: 'Guardians of the Rift', valueGp: null }),
    'got Rift guardian from Guardians of the Rift',
  );
  assert.equal(
    momentSentence({ kind: 'death', itemName: null, quantity: 1, source: 'Great Olm', valueGp: null }),
    'died to Great Olm',
  );
});
