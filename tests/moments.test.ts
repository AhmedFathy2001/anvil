// The highlight rules (lib/moments) — what a pet, a unique, a big haul or a death is worth keeping
// against, and which competition week or board it lands on.
//
// Run: npx tsx --test tests/moments.test.ts
// (tsx, not native type-stripping: the module reads the shipped datasets through the `@/` alias.)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  bossUniqueIds,
  caTask,
  caTierRank,
  classifyObservation,
  dropRate,
  mappedPetNames,
  matchesBoss,
  momentSentence,
  petsForSkill,
  DEFAULT_CLAN_SCOPE,
  isClanWorthy,
  type ClanScope,
  type EventScope,
  type Observation,
  type WeeklyScope,
} from '../src/lib/moments.ts';
import { clogItemNames, clogPageItems } from '../src/lib/clogDataset.ts';

const BOTW: WeeklyScope = { id: 1, type: 'boss', metric: 'zulrah' };
const SOTW: WeeklyScope = { id: 2, type: 'skill', metric: 'runecraft' };

const board: EventScope = { id: 9, teamId: 4, sources: ['Vorkath'], itemIds: [11286], minLootGp: 1_000_000 };

/** The always-on backstop, as shipped. */
const clan: ClanScope = DEFAULT_CLAN_SCOPE;
/** No scopes at all — a quiet week, which is the whole case the backstop exists for. */
const quiet = { weeklies: [], event: null, clan };

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

// ── Combat tasks ──────────────────────────────────────────────────────────────────────────────

function caObs(taskName: string, over: Partial<Observation> = {}): Observation {
  return obs({ kind: 'ca', taskName, dedupKey: `ca-${taskName}`, ...over });
}

test('the CA dataset can place a task, and ranks its tier', () => {
  const task = caTask('Zulrah Adept');
  assert.equal(task?.monster, 'Zulrah');
  assert.equal(task?.tier, 'Hard');
  // Matching is loose the way every other name lookup here is — the client's spelling varies.
  assert.equal(caTask('zulrah adept')?.name, 'Zulrah Adept');
  assert.equal(caTask('a task that does not exist'), null);
  assert.ok(caTierRank('Grandmaster') > caTierRank('Master'));
  assert.ok(caTierRank('Master') > caTierRank('Hard'));
  assert.equal(caTierRank('nonsense'), -1);
});

test('a boss week keeps a combat task for its own boss, from Hard up', () => {
  const [moment] = classifyObservation(caObs('Zulrah Adept'), { weeklies: [BOTW], event: null });
  assert.equal(moment.kind, 'ca');
  assert.equal(moment.itemName, 'Zulrah Adept');
  // The task names the boss, not the client — that's what puts it on this week at all.
  assert.equal(moment.source, 'Zulrah');
  assert.equal(moment.tier, 'Hard');
  assert.equal(moment.weeklyCompetitionId, BOTW.id);
});

test('a boss week ignores a task for another boss, and the easy end of its own', () => {
  assert.deepEqual(classifyObservation(caObs('Vorkath Master'), { weeklies: [BOTW], event: null }), []);
  // Every Zulrah racer clears "kill one" in their first minute; a feed of those says nothing.
  assert.deepEqual(classifyObservation(caObs('Noxious Foe'), { weeklies: [BOTW], event: null }), []);
});

test('a skill week and an efficiency week claim no combat tasks', () => {
  assert.deepEqual(classifyObservation(caObs('Zulrah Adept'), { weeklies: [SOTW], event: null }), []);
  const eotw: WeeklyScope = { id: 3, type: 'efficiency', metric: 'ehp' };
  assert.deepEqual(classifyObservation(caObs('Zulrah Adept'), { weeklies: [eotw], event: null }), []);
});

test('a bingo keeps a task for a boss on its board, from Hard up', () => {
  const [moment] = classifyObservation(caObs('Vorkath Veteran'), { weeklies: [], event: board });
  assert.equal(moment.kind, 'ca');
  assert.equal(moment.eventId, board.id);
  assert.equal(moment.tier, 'Elite');
});

test('a bingo keeps a task from anywhere once it is Master or above', () => {
  // Nothing on this board goes near the Alchemical Hydra — a Grandmaster task is its own news.
  const [moment] = classifyObservation(caObs('No Pressure'), { weeklies: [], event: board });
  assert.equal(moment.kind, 'ca');
  assert.equal(moment.tier, 'Grandmaster');
  // ...and the ordinary ones from off the board are not.
  assert.deepEqual(classifyObservation(caObs('Barrows Novice'), { weeklies: [], event: board }), []);
});

test('a task the dataset has never heard of is judged on the tier the client claimed', () => {
  const brandNew = caObs('Some Task Added Next Week', { tier: 'Grandmaster' });
  const [moment] = classifyObservation(brandNew, { weeklies: [], event: board });
  assert.equal(moment.kind, 'ca');
  assert.equal(moment.tier, 'Grandmaster');
  // With no monster we can't place it, so a boss week can't claim it...
  assert.deepEqual(classifyObservation(brandNew, { weeklies: [BOTW], event: null }), []);
  // ...and an unplaceable task below the off-topic floor is nothing to anyone.
  assert.deepEqual(
    classifyObservation(caObs('Another New Task', { tier: 'Hard' }), { weeklies: [], event: board }),
    [],
  );
  // A client that names no tier at all can't clear a floor either.
  assert.deepEqual(
    classifyObservation(caObs('Nameless Tier Task'), { weeklies: [], event: board }),
    [],
  );
});

test('a task lands on the week AND the board when both are running', () => {
  const planned = classifyObservation(caObs('Perfect Zulrah'), { weeklies: [BOTW], event: board });
  assert.equal(planned.length, 2);
  assert.deepEqual(planned.map((m) => m.kind), ['ca', 'ca']);
  // Same observation, two scopes, two rows that can never collapse onto each other.
  assert.notEqual(planned[0].dedupKey, planned[1].dedupKey);
});

test('an event moment carries the side it happened on; a weekly one has no side', () => {
  const planned = classifyObservation(
    obs({ kind: 'death', source: 'Vorkath' }),
    { weeklies: [BOTW], event: board },
  );
  const onBoard = planned.find((p) => p.eventId === board.id);
  const onWeek = planned.find((p) => p.weeklyCompetitionId === BOTW.id);
  // Stamped at ingest so subbing someone across teams later can't drag their deaths with them.
  assert.equal(onBoard?.teamId, 4);
  // A weekly competition has no sides to be on.
  assert.equal(onWeek?.teamId ?? null, null);
});

test('the feed line leads with the tier', () => {
  assert.equal(
    momentSentence({ kind: 'ca', itemName: 'Perfect Zulrah', quantity: 1, source: 'Zulrah', valueGp: null, tier: 'Master' }),
    'completed the Master combat task Perfect Zulrah',
  );
  // Nothing known but that it happened.
  assert.equal(
    momentSentence({ kind: 'ca', itemName: null, quantity: 1, source: null, valueGp: null, tier: null }),
    'completed a combat task',
  );
});


// ---- the clan backstop: what is kept when nothing is running -------------------------------------

test('with nothing running, a pet is still the news', () => {
  const rows = classifyObservation(obs({ kind: 'pet', itemName: 'Baby mole', itemId: 12646 }), quiet);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, 'pet');
  // Unscoped: it belonged to no week and no board, which is exactly why it needed catching.
  assert.equal(rows[0].weeklyCompetitionId, null);
  assert.equal(rows[0].eventId, null);
  assert.equal(rows[0].teamId, null);
  assert.match(rows[0].dedupKey, /:clan$/);
});

test('a haul is kept on its own terms, and a small one is not', () => {
  const big = classifyObservation(obs({ valueGp: 9_000_000, source: 'Vorkath' }), quiet);
  assert.equal(big.length, 1);
  assert.equal(big[0].kind, 'loot');
  // Under the clan floor and rare from nowhere: a normal Tuesday.
  assert.deepEqual(classifyObservation(obs({ valueGp: 2_000_000, source: 'Vorkath' }), quiet), []);
});

test('a genuinely rare drop is kept whatever it is worth', () => {
  // Rarity is read first so an untradeable with no price is still a moment.
  const rows = classifyObservation(obs({ source: 'Vorkath', itemId: 22006, valueGp: 0 }), quiet);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, 'unique');
});

test('deaths stay out unless the clan asks for them', () => {
  assert.deepEqual(classifyObservation(obs({ kind: 'death', source: 'Vorkath' }), quiet), []);
  const on = classifyObservation(obs({ kind: 'death', source: 'Vorkath' }), {
    ...quiet,
    clan: { ...clan, deaths: true },
  });
  assert.equal(on.length, 1);
  assert.equal(on[0].kind, 'death');
});

test('combat tasks clear the clan floor, or are turned off entirely', () => {
  const master = obs({ kind: 'ca', taskName: 'Phantom Muspah Speed-Chaser', tier: 'Master' });
  assert.equal(classifyObservation(master, quiet).length, 1);
  // An Easy task on an ordinary day is not news. (Tiers always arrive — every combat task has one,
  // the completion line says it, and both the plugin and the ingest route drop a line without one.)
  assert.deepEqual(
    classifyObservation(obs({ kind: 'ca', taskName: 'Nothing We Know Of', tier: 'Easy' }), quiet),
    [],
  );
  // A floor we can't rank is how a clan says "no combat tasks here" — and the safe answer to a
  // misspelled tier, which should keep nothing rather than everything.
  assert.deepEqual(classifyObservation(master, { ...quiet, clan: { ...clan, minCaTier: 'none' } }), []);
  assert.deepEqual(classifyObservation(master, { ...quiet, clan: { ...clan, minCaTier: 'Msater' } }), []);
});

test('the backstop only catches what nothing else wanted', () => {
  // A Zulrah drop during a Zulrah week belongs to the week. One row, not two: the clan feed reads
  // across every scope, so a second unscoped copy would just show the same drop twice.
  const rows = classifyObservation(
    obs({ source: 'Zulrah', itemId: 12922, valueGp: 30_000_000 }),
    { weeklies: [BOTW], event: null, clan },
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].weeklyCompetitionId, BOTW.id);
});

test('a week that is about one boss no longer throws away everything else', () => {
  // A competition week claims only its own boss, so a huge drop from anywhere else used to be
  // discarded for happening during the wrong week. The backstop is what keeps it.
  const scopes = { weeklies: [BOTW], event: null, clan };
  const rows = classifyObservation(obs({ source: 'Vorkath', valueGp: 20_000_000 }), scopes);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].weeklyCompetitionId, null, 'not the Zulrah week — it came from Vorkath');
  assert.equal(rows[0].kind, 'loot');
});

test('a running board already keeps more than the clan floor would', () => {
  // Not a gap to fill: a board takes any haul over ITS floor (1m here) whatever the source, which
  // is below the clan's. So the backstop finds nothing left to catch, and the drop stays one row
  // on the board it happened during rather than being duplicated onto the clan.
  const rows = classifyObservation(obs({ source: 'Zulrah', valueGp: 20_000_000 }), {
    weeklies: [],
    event: board,
    clan,
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].eventId, board.id);
});

test('no clan scope at all keeps the old behaviour exactly', () => {
  // Callers that predate the backstop (and every existing test above) pass two scopes and get the
  // same answers they always did.
  assert.deepEqual(classifyObservation(obs({ kind: 'pet', itemName: 'Baby mole' }), { weeklies: [], event: null }), []);
});


// ---- the clan BAR: what the feed shows, as opposed to what got stored -----------------------------

test('a board keeps its near-misses; the clan feed does not show them', () => {
  // Exactly the rows that filled the Lately tab: a common drop from a boss the board named, and a
  // death. Both belong on the board's own page and neither is clan news.
  assert.equal(isClanWorthy({ kind: 'loot', source: 'Alchemical Hydra', itemId: 1377, valueGp: 120_000 }, clan), false);
  assert.equal(isClanWorthy({ kind: 'death', source: 'The Whisperer' }, clan), false);
  // 1,157 blood runes out of a raid chest is a good raid, not a moment.
  assert.equal(isClanWorthy({ kind: 'loot', source: 'Chambers of Xeric', itemId: 565, quantity: 1157, valueGp: 400_000 }, clan), false);
});

test('the things everyone would want to see still come through', () => {
  assert.equal(isClanWorthy({ kind: 'pet', itemName: 'Baby mole' } as never, clan), true);
  // 87.8M of Oathplate legs clears the gp floor whatever its rate is.
  assert.equal(isClanWorthy({ kind: 'unique', source: 'Yama', itemId: 30756, valueGp: 87_800_000 }, clan), true);
  // A Master task still reads as one.
  assert.equal(isClanWorthy({ kind: 'ca', tier: 'Master' }, clan), true);
  assert.equal(isClanWorthy({ kind: 'ca', tier: 'Hard' }, clan), false);
});

test('a stack does not inherit the rarity of one of the item', () => {
  // The dataset prices Onyx bolts (e) by a single-bolt line, so a stack of 39 was arriving as a
  // "1 in 101" unique. Quantity is what tells a drop from a pile.
  const bolts = { kind: 'unique', source: 'Alchemical Hydra', itemId: 9245, valueGp: 0 };
  assert.equal(isClanWorthy({ ...bolts, quantity: 39 }, clan), false);
});

test('deaths come through once the clan asks for them', () => {
  assert.equal(isClanWorthy({ kind: 'death', source: 'The Whisperer' }, { ...clan, deaths: true }), true);
});

// ── Levels ────────────────────────────────────────────────────────────────────────────────────
//
// Ahmed hit 99 Cooking mid-board and the site had nowhere to put it: the feed knew pets, drops,
// deaths and combat tasks, and a 99 was none of them. It went to Discord (when it went anywhere at
// all) and left no trace on the site that a clan reads afterwards.
//
// A level carries no item and no source, so it rides in the columns that already exist: the skill
// in `itemName`, the number in `quantity`, and which KIND of number in `sourceKind`.

const lvl = (over: Partial<Observation> = {}): Observation =>
  obs({ kind: 'level', itemName: 'Cooking', quantity: 99, sourceKind: 'skill', ...over });

test('a 99 during a bingo is a moment, whatever the board asked for', () => {
  const planned = classifyObservation(lvl(), { weeklies: [], event: board });
  assert.equal(planned.length, 1);
  assert.equal(planned[0].kind, 'level');
  assert.equal(planned[0].eventId, 9);
  assert.equal(planned[0].teamId, 4, 'it belongs to the side they play for');
  assert.equal(planned[0].quantity, 99);
});

test('a skill week claims the 99 that is its own skill', () => {
  const planned = classifyObservation(lvl({ itemName: 'Runecraft' }), {
    weeklies: [SOTW],
    event: null,
  });
  assert.equal(planned.length, 1);
  assert.equal(planned[0].kind, 'level');
  assert.equal(planned[0].weeklyCompetitionId, 2);
});

test('a skill week ignores a 99 in some other skill', () => {
  // Lovely for them, nothing to do with the week being raced.
  assert.deepEqual(classifyObservation(lvl(), { weeklies: [SOTW], event: null }), []);
});

test('a boss week ignores a 99 but keeps a max', () => {
  assert.deepEqual(classifyObservation(lvl(), { weeklies: [BOTW], event: null }), []);

  const maxed = classifyObservation(
    lvl({ itemName: null, quantity: 2277, sourceKind: 'max' }),
    { weeklies: [BOTW], event: null },
  );
  assert.equal(maxed.length, 1, 'a max is everybody’s story');
  assert.equal(maxed[0].kind, 'level');
});

test('the sentence says which kind of number it was', () => {
  const say = (over: Partial<Parameters<typeof momentSentence>[0]>) =>
    momentSentence({
      kind: 'level',
      itemName: 'Cooking',
      quantity: 99,
      sourceKind: 'skill',
      source: null,
      valueGp: null,
      ...over,
    });

  assert.equal(say({}), 'reached level 99 Cooking');
  assert.equal(
    say({ itemName: null, quantity: 1800, sourceKind: 'total' }),
    'reached 1,800 total level',
  );
  assert.equal(
    say({ itemName: null, quantity: 2277, sourceKind: 'max' }),
    'maxed, with a total level of 2,277',
  );
});
