// Collection-log slots that share an in-game name ("Decorative armour" is fifteen Castle Wars slots):
// each is its own labelled entry, search still finds them all, and a credit an unlock line could only
// guess is settled once a full log sync says which slot the member really holds.
//
// Run: npx tsx --test tests/clog-same-name.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { clogItemLabels, clogItemNames, clogPageItems, clogSameNameGroups } from '../src/lib/clogDataset.ts';
import { carryGuessedStamps, clogIdsForName } from '../src/lib/clogUnlock.ts';
import { guessedClogName, settleGuessedSlot, CLOG_UNLOCK_NOTE_PREFIX } from '../src/lib/clogTiles.ts';
import { fuzzySearch } from '../src/lib/fuzzySearch.ts';
import { clogLabelledItems, itemsByName, withClogLabels } from '../src/lib/osrsItems.ts';
import { labelGroup } from '../scripts/build-clog-dataset.mjs';

const RED_BODY = 4069;
const WHITE_BODY = 4504;
const GOLD_BODY = 4509;
const armour = clogIdsForName('Decorative armour');

// ─── Labels ──────────────────────────────────────────────────────────────────────────────────

test('every same-named slot has its own label; the in-game name is kept for matching', () => {
  assert.equal(armour.length, 15);
  const labels = clogItemLabels();
  assert.equal(labels.get(GOLD_BODY), 'Decorative armour (gold platebody)');
  assert.equal(labels.get(RED_BODY), 'Decorative armour (red platebody)');
  assert.equal(new Set(armour.map((id) => labels.get(id))).size, 15);
  assert.equal(clogItemNames().get(GOLD_BODY), 'Decorative armour');
  for (const ids of clogSameNameGroups().values()) {
    assert.equal(new Set(ids.map((id) => labels.get(id))).size, ids.length, `labels collide in ${ids.join(',')}`);
  }
});

test('a name only one slot carries keeps the plain game name', () => {
  const page = clogPageItems('Barrows Chests');
  const hood = page.find((i) => i.gameName === "Ahrim's hood")!;
  assert.equal(hood.name, "Ahrim's hood");
});

test('a page lists each same-named slot under its label', () => {
  const page = clogPageItems('Castle Wars');
  const names = page.filter((i) => i.gameName === 'Decorative armour').map((i) => i.name);
  assert.equal(names.length, 15);
  assert.ok(names.includes('Decorative armour (gold plateskirt)'));
});

test('the labeller: page names, shared-page versions, and an id when nothing else tells them apart', () => {
  const rows = new Map<number, { page_name?: string; version_anchor?: string }>([
    [1, { page_name: 'Thing (red)' }],
    [2, { page_name: 'Thing (blue)' }],
    [3, { page_name: 'Thing', version_anchor: 'Inventory' }],
  ]);
  const out = labelGroup('Thing', [1, 2, 3], rows);
  assert.deepEqual([...out], [[1, 'Thing (red)'], [2, 'Thing (blue)'], [3, null]]);
  const paged = labelGroup('Page', [7, 8], new Map([[7, { page_name: 'Page', version_anchor: '1' }], [8, { page_name: 'Page', version_anchor: '2' }]]));
  assert.deepEqual([...paged], [[7, 'Page (1)'], [8, 'Page (2)']]);
  const bare = labelGroup('Bare', [5, 6], new Map());
  assert.deepEqual([...bare], [[5, 'Bare (#5)'], [6, 'Bare (#6)']]);
});

// ─── Item picker ─────────────────────────────────────────────────────────────────────────────

test('the item list carries one entry per same-named slot instead of one per name', () => {
  // What the name-collapsing merge leaves: one "Decorative armour", a tradeable namesake elsewhere.
  const merged = [{ id: RED_BODY, name: 'Decorative armour' }, { id: 4151, name: 'Abyssal whip' }, { id: 999999, name: 'Rum' }];
  const out = withClogLabels(merged, clogLabelledItems());
  assert.equal(out.filter((i) => i.gameName === 'Decorative armour').length, 15);
  assert.ok(!out.some((i) => i.name === 'Decorative armour'));
  assert.ok(out.some((i) => i.id === 999999), 'a different id under a shared name stays');
  assert.equal(out.filter((i) => i.id === RED_BODY).length, 1);
});

test('search finds every piece for the game name and narrows on the variant', () => {
  const items = withClogLabels([{ id: 4151, name: 'Abyssal whip' }], clogLabelledItems());
  const all = fuzzySearch(items, 'decorative armour', (i) => i.name, { limit: 40 });
  assert.equal(all.filter((i) => i.gameName === 'Decorative armour').length, 15);
  const gold = fuzzySearch(items, 'decorative armour gold platebody', (i) => i.name, { limit: 5 });
  assert.equal(gold[0]?.id, GOLD_BODY);
  const short = fuzzySearch(items, 'gold platebody', (i) => i.name, { limit: 5 });
  assert.equal(short[0]?.id, GOLD_BODY);
});

test('exact-name lookups answer to the label and still to the plain game name', () => {
  const items = withClogLabels([], clogLabelledItems());
  const byName = itemsByName(items);
  assert.equal(byName.get('decorative armour (gold platebody)')?.id, GOLD_BODY);
  assert.equal(byName.get('decorative armour')?.id, RED_BODY);
});

// ─── Guessed credits ─────────────────────────────────────────────────────────────────────────

const anyPage = { pages: [], itemIds: [] };
const none = new Set<number>();
const base = { siblings: armour, spec: anyPage, datedBefore: none, undated: none, counted: none };

test('only unlock-line credits from the plugin count as guesses', () => {
  assert.equal(guessedClogName({ note: `${CLOG_UNLOCK_NOTE_PREFIX}Decorative armour`, source: 'plugin' }), 'Decorative armour');
  assert.equal(
    guessedClogName({ note: '[Auto] New collection log slot: Decorative armour — detected by RuneLite plugin', source: 'plugin' }),
    'Decorative armour',
  );
  assert.equal(guessedClogName({ note: `${CLOG_UNLOCK_NOTE_PREFIX}Decorative armour`, source: 'web' }), null);
  assert.equal(guessedClogName({ note: 'Got the gold body', source: 'plugin' }), null);
  assert.equal(guessedClogName({ note: null, source: null }), null);
});

test('a guess the log confirms is kept', () => {
  assert.deepEqual(settleGuessedSlot({ ...base, guessedId: RED_BODY, owned: new Set([RED_BODY]) }), { action: 'keep' });
});

test('a wrong guess moves to the same-named slot the log holds', () => {
  assert.deepEqual(settleGuessedSlot({ ...base, guessedId: RED_BODY, owned: new Set([GOLD_BODY]) }), { action: 'move', itemId: GOLD_BODY });
});

test('a sibling from before the event, or already counted, is not a new slot', () => {
  const owned = new Set([GOLD_BODY, WHITE_BODY]);
  assert.deepEqual(settleGuessedSlot({ ...base, guessedId: RED_BODY, owned, datedBefore: new Set([GOLD_BODY]) }), { action: 'move', itemId: WHITE_BODY });
  assert.deepEqual(
    settleGuessedSlot({ ...base, guessedId: RED_BODY, owned, datedBefore: new Set([GOLD_BODY]), counted: new Set([WHITE_BODY]) }),
    { action: 'remove' },
  );
});

test('a dated-new sibling beats an undated one', () => {
  const owned = new Set([WHITE_BODY, GOLD_BODY]);
  assert.deepEqual(settleGuessedSlot({ ...base, guessedId: RED_BODY, owned, undated: new Set([WHITE_BODY]) }), { action: 'move', itemId: GOLD_BODY });
  assert.deepEqual(settleGuessedSlot({ ...base, guessedId: RED_BODY, owned, undated: owned }), { action: 'move', itemId: WHITE_BODY });
});

test('a sibling off the tile does not count; with none left the credit is removed', () => {
  const spec = { pages: [], itemIds: [RED_BODY, WHITE_BODY] };
  assert.deepEqual(settleGuessedSlot({ ...base, spec, guessedId: RED_BODY, owned: new Set([GOLD_BODY]) }), { action: 'remove' });
  assert.deepEqual(settleGuessedSlot({ ...base, guessedId: RED_BODY, owned: new Set() }), { action: 'remove' });
});

test('a name only one slot carries was never a guess', () => {
  const [whip] = clogIdsForName('Abyssal whip');
  assert.deepEqual(settleGuessedSlot({ ...base, siblings: [whip], guessedId: whip, owned: new Set() }), { action: 'keep' });
});

// ─── Profile rows ────────────────────────────────────────────────────────────────────────────

test('a sync that swaps a guessed row keeps the unlock date and KC on the true slot', () => {
  const gone = [{ itemId: RED_BODY, firstSeenAt: '2026-11-01T10:00:00.000Z', kcAtUnlock: 12 }];
  const added = [
    { itemId: 4151, firstSeenAt: '2026-11-10T00:00:00.000Z', kcAtUnlock: null },
    { itemId: GOLD_BODY, firstSeenAt: '2026-11-10T00:00:00.000Z', kcAtUnlock: null },
  ];
  carryGuessedStamps(gone, added);
  assert.deepEqual(added[1], { itemId: GOLD_BODY, firstSeenAt: '2026-11-01T10:00:00.000Z', kcAtUnlock: 12 });
  assert.equal(added[0].firstSeenAt, '2026-11-10T00:00:00.000Z');
});

test('an undated row, or one whose name no other slot shares, hands nothing on', () => {
  const added = [{ itemId: GOLD_BODY, firstSeenAt: 'now', kcAtUnlock: null }];
  carryGuessedStamps([{ itemId: RED_BODY, firstSeenAt: null, kcAtUnlock: 3 }], added);
  assert.equal(added[0].firstSeenAt, 'now');
  const [whip] = clogIdsForName('Abyssal whip');
  carryGuessedStamps([{ itemId: whip, firstSeenAt: 'then', kcAtUnlock: 3 }], added);
  assert.equal(added[0].firstSeenAt, 'now');
});
