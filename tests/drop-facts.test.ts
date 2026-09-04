import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GUARANTEED_SUPPLEMENT,
  guaranteedDropsFor,
  parseGuaranteedOverrides,
  petFacts,
} from '../src/lib/dropFacts.ts';

// These run against the shipped datasets rather than fixtures on purpose: the whole point of the
// module is that the wiki data already knows the answers, so a regen that stops answering one of
// them should fail here rather than quietly change what Discord says.

test('pets: a boss pet names its boss, not whatever loot came last', () => {
  const pets = petFacts();
  assert.deepEqual(pets['baby mole']?.sources, ['Giant Mole']);
  assert.equal(pets['baby mole']?.kind, 'npc');
  assert.deepEqual(pets['pet dark core']?.sources, ['Corporeal Beast']);
});

test('pets: one pet, several monsters — the plugin gets both to choose from', () => {
  const pets = petFacts();
  assert.deepEqual(pets["vet'ion jr."]?.sources, ["Calvar'ion", "Vet'ion"]);
  assert.deepEqual(pets['callisto cub']?.sources, ['Artio', 'Callisto']);
});

test('pets: raid and minigame pets fall back to the content that has no kill table', () => {
  const pets = petFacts();
  assert.deepEqual(pets['olmlet'], { sources: ['Chambers of Xeric'], kind: 'event' });
  assert.deepEqual(pets["tumeken's guardian"], { sources: ['Tombs of Amascut'], kind: 'event' });
  assert.deepEqual(pets['abyssal orphan'], { sources: ['Abyssal Sire'], kind: 'event' });
});

test('pets: a skilling pet has no monster and says so rather than inventing one', () => {
  const pets = petFacts();
  assert.deepEqual(pets['beaver'], { sources: [], kind: 'skill', skill: 'woodcutting' });
  assert.deepEqual(pets['rocky'], { sources: [], kind: 'skill', skill: 'thieving' });
});

test('pets: every pet in the catalogue is accounted for', () => {
  const pets = petFacts();
  const unplaced = Object.entries(pets).filter(([, f]) => f.sources.length === 0 && !f.skill);
  // A new pet the catalogue lists but nothing places is fine — it just posts without a source — but
  // it should be a conscious handful, not a silent majority.
  assert.ok(unplaced.length <= 3, `unplaced pets: ${unplaced.map(([n]) => n).join(', ')}`);
});

// A tiny stand-in for the item-name index the real caller builds from the log + the notable list.
const NAMES: Record<number, string> = {
  28336: 'Ancient blood ornament kit',
  30750: 'Oathplate helm',
  30783: 'Purifying sigil (left)',
  12934: "Zulrah's scales",
  25744: 'Sanguine ornament kit',
};
const nameOf = (id: number) => NAMES[id] ?? null;

test('guaranteed: an always-drop is guaranteed, and names every source that owes it', () => {
  const guaranteed = guaranteedDropsFor(nameOf);
  assert.deepEqual(guaranteed['ancient blood ornament kit'], [
    'duke sucellus',
    'the leviathan',
    'the whisperer',
    'vardorvis',
  ]);
});

test('guaranteed: a source that both gives and rolls the same item is NOT guaranteed', () => {
  // Yama's Contract hands the Oathplate set over; an ordinary kill rolls it at 1/600. Until the
  // dataset separates the two, "guaranteed" would rob a real 1/600 drop of its moment.
  const guaranteed = guaranteedDropsFor(nameOf);
  assert.equal(guaranteed['oathplate helm'], undefined);
  // The sigil pieces only ever drop from the Contract, so they stay guaranteed.
  assert.deepEqual(guaranteed['purifying sigil (left)'], ['yama']);
  // Same shape for an item a source both gives and rolls a bigger pile of: Zulrah always drops
  // 100-299 scales and rolls 500 at 1/49.8. "Always" is only half the story, so it isn't claimed.
  assert.equal(guaranteed["zulrah's scales"], undefined);
});

test('guaranteed: rolled raid kits stay out, and the given one is supplemented in', () => {
  const guaranteed = guaranteedDropsFor(nameOf);
  assert.equal(guaranteed['sanguine ornament kit'], undefined);
  assert.deepEqual(guaranteed['menaphite ornament kit'], GUARANTEED_SUPPLEMENT['menaphite ornament kit']);
});

test('guaranteed: unnameable items are dropped rather than shipped as ids', () => {
  const guaranteed = guaranteedDropsFor(() => null);
  assert.deepEqual(Object.keys(guaranteed), Object.keys(GUARANTEED_SUPPLEMENT));
});

test('overrides: a bare name means "wherever it drops", a piped one names the sources', () => {
  const parsed = parseGuaranteedOverrides('Some kit\nOther kit | Duke Sucellus, Vardorvis\n\n  ');
  assert.deepEqual(parsed['some kit'], ['*']);
  assert.deepEqual(parsed['other kit'], ['duke sucellus', 'vardorvis']);
  assert.equal(Object.keys(parsed).length, 2);
});

test('overrides: nothing configured is not an override of everything', () => {
  assert.deepEqual(parseGuaranteedOverrides(null), {});
  assert.deepEqual(parseGuaranteedOverrides(''), {});
});
