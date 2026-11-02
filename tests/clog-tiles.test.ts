// Collection-log tiles (lib/clogTiles): what counts as a new slot, how a team adds them up, and when
// a whole page is finished.
//
// Run: npx tsx --test tests/clog-tiles.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  canonicalClogPage,
  clogPageProof,
  clogItemFromProof,
  clogNameKey,
  clogTileGroups,
  clogTileError,
  clogTileSpec,
  clogTileTitle,
  decideClogSlot,
  decideClogSlotByName,
  evaluateClogPages,
  ownedAtStart,
  pluginClogEntry,
  type ClogMemberLog,
} from '../src/lib/clogTiles.ts';
import { clogPageItems } from '../src/lib/clogDataset.ts';
import { countProgress, memberProgress } from '../src/lib/countProgress.ts';

const barrows = clogPageItems('Barrows Chests').map((i) => i.id);
const wintertodt = clogPageItems('Wintertodt').map((i) => i.id);
const phoenix = clogPageItems('Wintertodt').find((i) => i.name === 'Phoenix')!.id;
const ahrimHood = clogPageItems('Barrows Chests').find((i) => i.name === "Ahrim's hood")!.id;

// ── Spec ─────────────────────────────────────────────────────────────────────────────────────

test('a stored tile reads back as its mode, canonical pages and requirement', () => {
  assert.deepEqual(clogTileSpec({ countMode: 'slots', targetNpcs: null, requiredAmount: 10 }), { mode: 'slots', pages: [], itemIds: [], required: 10 });
  assert.deepEqual(clogTileSpec({ countMode: null, targetNpcs: '["barrows chests"]', requiredAmount: 3 }), { mode: 'slots', pages: ['Barrows Chests'], itemIds: [], required: 3 });
  // Complete: NULL requirement = every listed page; an over-large one is clamped to the list.
  assert.deepEqual(clogTileSpec({ countMode: 'complete', targetNpcs: ['Wintertodt', 'Barrows Chests'], requiredAmount: null }).required, 2);
  assert.deepEqual(clogTileSpec({ countMode: 'complete', targetNpcs: ['Wintertodt'], requiredAmount: 9 }).required, 1);
  // Unknown pages are dropped on read (the API refuses them on write).
  assert.deepEqual(clogTileSpec({ countMode: 'slots', targetNpcs: ['Nope', 'Wintertodt'], requiredAmount: 1 }).pages, ['Wintertodt']);
});

test('page names resolve case- and punctuation-insensitively; the API refuses unknown pages', () => {
  assert.equal(canonicalClogPage('BARROWS chests'), 'Barrows Chests');
  assert.equal(canonicalClogPage('Not a page'), null);
  assert.match(clogTileError('slots', ['Not a page'], [], 3) ?? '', /Not a collection log page/);
  assert.match(clogTileError('complete', [], [], null) ?? '', /Pick the collection log page/);
  assert.match(clogTileError('complete', ['Wintertodt'], [], 2) ?? '', /between 1 and 1/);
  assert.equal(clogTileError('slots', [], [], 10), null);
  assert.equal(clogTileError('complete', ['Wintertodt', 'Barrows Chests'], [], 1), null);
  assert.match(clogTileError('weird', [], [], 1) ?? '', /slots' or 'complete/);
});

test('titles say what the tile asks for', () => {
  assert.equal(clogTileTitle({ mode: 'slots', pages: [], itemIds: [], required: 10 }), '10 new collection log slots');
  assert.equal(clogTileTitle({ mode: 'slots', pages: ['Barrows Chests'], itemIds: [], required: 3 }), '3 new Barrows Chests log slots');
  assert.equal(clogTileTitle({ mode: 'complete', pages: ['Wintertodt'], itemIds: [], required: 1 }), 'Complete the Wintertodt collection log page');
});

// ── New slots ────────────────────────────────────────────────────────────────────────────────

test('any page: any catalogue item is a slot; unknown names are not', () => {
  const v = decideClogSlotByName('Phoenix', { pages: [], itemIds: [] }, new Set(), new Set());
  assert.deepEqual(v, { ok: true, itemId: phoenix });
  assert.deepEqual(decideClogSlotByName('Bronze dagger', { pages: [], itemIds: [] }, new Set(), new Set()), { ok: false, reason: 'unknown-item' });
});

test('chosen pages: only items on them count', () => {
  const spec = { pages: ['Barrows Chests'], itemIds: [] };
  assert.deepEqual(decideClogSlotByName("Ahrim's hood", spec, new Set(), new Set()), { ok: true, itemId: ahrimHood });
  assert.deepEqual(decideClogSlotByName('Phoenix', spec, new Set(), new Set()), { ok: false, reason: 'off-page' });
  // Several pages: either one.
  assert.equal(decideClogSlotByName('Phoenix', { pages: ['Barrows Chests', 'Wintertodt'], itemIds: [] }, new Set(), new Set()).ok, true);
});

test('a slot already in the member’s log before the event is not new; a repeat is not new twice', () => {
  const spec = { pages: ['Barrows Chests'], itemIds: [] };
  assert.deepEqual(decideClogSlotByName("Ahrim's hood", spec, new Set([ahrimHood]), new Set()), { ok: false, reason: 'owned-before' });
  assert.deepEqual(decideClogSlotByName("Ahrim's hood", spec, new Set(), new Set([ahrimHood])), { ok: false, reason: 'already-counted' });
});

test('a name shared by several ids takes the first one still open', () => {
  const v = decideClogSlot({ candidates: [ahrimHood, barrows[1]], spec: { pages: ['Barrows Chests'], itemIds: [] }, ownedBefore: new Set([ahrimHood]), counted: new Set() });
  assert.deepEqual(v, { ok: true, itemId: barrows[1] });
});

test('the start-of-event log: undated (first sync) and pre-start rows; unlock-proven slots are never old', () => {
  const start = Date.parse('2026-11-01T12:00:00Z');
  const rows = [
    { itemId: 1, firstSeenAt: null },
    { itemId: 2, firstSeenAt: '2026-10-20T00:00:00.000Z' },
    { itemId: 3, firstSeenAt: '2026-11-01T13:00:00.000Z' },
    { itemId: 4, firstSeenAt: '2026-11-01 11:59:00' },
    { itemId: 5, firstSeenAt: null },
  ];
  assert.deepEqual([...ownedAtStart(rows, start, new Set([5]))].sort(), [1, 2, 4]);
});

test('team counting: a slot is (member, item) — teammates on the same item both count, a repeat never does', () => {
  const subs = [
    { playerId: 1, amount: 1, itemId: 10 },
    { playerId: 1, amount: 1, itemId: 10 }, // the same slot again (a retried upload)
    { playerId: 1, amount: 1, itemId: 11 },
    { playerId: 2, amount: 1, itemId: 10 }, // a teammate's first one is new for THEM
    { playerId: 3, amount: 1, itemId: null }, // no item = proves nothing
  ];
  assert.equal(countProgress(subs, 'team', 'slots').current, 3);
  const solo = countProgress(subs, 'individual', 'slots');
  assert.equal(solo.current, 2);
  assert.equal(solo.finisherPlayerId, 1);
  assert.equal(memberProgress(subs, 2, 'slots'), 1);
});

// ── Chosen items ─────────────────────────────────────────────────────────────────────────────

const idOf = (page: string, name: string) => clogPageItems(page).find((i) => i.name === name)!.id;

test('chosen items are the pool: other items on the same page do not count', () => {
  const hood = ahrimHood;
  const staff = idOf('Barrows Chests', "Ahrim's staff");
  const spec = { pages: ['Barrows Chests'], itemIds: [hood] };
  assert.deepEqual(decideClogSlot({ candidates: [hood], spec, ownedBefore: new Set(), counted: new Set() }), { ok: true, itemId: hood });
  assert.deepEqual(decideClogSlot({ candidates: [staff], spec, ownedBefore: new Set(), counted: new Set() }), { ok: false, reason: 'off-page' });
  // Mixed across pages, no page at all: still only the chosen ones.
  const mixed = { pages: [], itemIds: [hood, phoenix] };
  assert.equal(decideClogSlotByName('Phoenix', mixed, new Set(), new Set()).ok, true);
  assert.equal(decideClogSlotByName("Ahrim's staff", mixed, new Set(), new Set()).ok, false);
});

test('a stored item list survives the catalogue: unknown ids are dropped on read and refused on write', () => {
  const spec = clogTileSpec({ countMode: 'slots', targetNpcs: '["Barrows Chests"]', trackedItemIds: `[${ahrimHood}, 999999999]`, requiredAmount: 1 });
  assert.deepEqual(spec.itemIds, [ahrimHood]);
  assert.match(clogTileError('slots', [], [999999999], 1) ?? '', /Not collection log items/);
  assert.match(clogTileError('slots', [], [ahrimHood, phoenix], 3) ?? '', /at most 2 new slots/);
});

test('complete mode on chosen items: each page’s chosen items is a group, off-page picks one custom group', () => {
  const staff = idOf('Barrows Chests', "Ahrim's staff");
  const groups = clogTileGroups({ pages: ['Barrows Chests'], itemIds: [ahrimHood, staff, phoenix] });
  assert.deepEqual(groups, [{ name: 'Barrows Chests', items: [ahrimHood, staff] }, { name: 'Chosen items', items: [phoenix] }]);
  // "Own all of these": one custom page.
  const spec = clogTileSpec({ countMode: 'complete', targetNpcs: null, trackedItemIds: [ahrimHood, phoenix], requiredAmount: null });
  assert.equal(spec.required, 1);
  const done = evaluateClogPages(spec, [member(1, [ahrimHood, phoenix], [ahrimHood])], 'team');
  assert.equal(done.complete, true);
  assert.equal(done.pages[0].page, 'Chosen items');
  // Already owned both at the start: not finished during the event.
  assert.equal(evaluateClogPages(spec, [member(1, [ahrimHood, phoenix], [ahrimHood, phoenix])], 'team').complete, false);
});

test('the plugin entry for chosen items lists exactly their names', () => {
  const tile = { id: 1, position: 0, label: 'x', description: null, points: 1, category: null, trackingMode: 'team' };
  const e = pluginClogEntry({ ...tile, countMode: 'slots', targetNpcs: null, trackedItemIds: [ahrimHood, phoenix], requiredAmount: 2 }, 0, false);
  assert.deepEqual(e.items?.sort(), [clogNameKey("Ahrim's hood"), clogNameKey('Phoenix')].sort());
});

// ── Whole pages ──────────────────────────────────────────────────────────────────────────────

const member = (playerId: number, owned: number[], atStart: number[], credited: number[] = [], synced = true): ClogMemberLog => ({
  playerId, synced, owned: new Set(owned), ownedAtStart: new Set(atStart), credited: new Set(credited),
});

test('a page completes when one member’s own log fills it during the event — old slots count', () => {
  const spec = { mode: 'complete' as const, pages: ['Wintertodt'], itemIds: [], required: 1 };
  const missingOne = wintertodt.slice(0, -1);
  // Had all but one at the start, got the last one during the event.
  const done = evaluateClogPages(spec, [member(1, wintertodt, missingOne)], 'team');
  assert.equal(done.complete, true);
  assert.deepEqual(done.pages[0].doneBy, [1]);
  // Still one short.
  assert.equal(evaluateClogPages(spec, [member(1, missingOne, missingOne)], 'team').complete, false);
});

test('a page that was already full at the start is not "finished" during the event', () => {
  const spec = { mode: 'complete' as const, pages: ['Wintertodt'], itemIds: [], required: 1 };
  assert.equal(evaluateClogPages(spec, [member(1, wintertodt, wintertodt)], 'team').complete, false);
});

test('team logs are not pooled: two half pages are not a page', () => {
  const spec = { mode: 'complete' as const, pages: ['Wintertodt'], itemIds: [], required: 1 };
  const half = Math.floor(wintertodt.length / 2);
  const a = member(1, wintertodt.slice(0, half), []);
  const b = member(2, wintertodt.slice(half), []);
  const out = evaluateClogPages(spec, [a, b], 'team');
  assert.equal(out.complete, false);
  assert.equal(out.pages[0].best?.have, Math.max(half, wintertodt.length - half));
});

test('credited unlocks fill a page for a member with no synced log, and prove the page was not full at start', () => {
  const spec = { mode: 'complete' as const, pages: ['Wintertodt'], itemIds: [], required: 1 };
  const out = evaluateClogPages(spec, [member(1, [], [], wintertodt, false)], 'team');
  assert.equal(out.complete, true);
  assert.deepEqual(out.unsynced, [1]);
  // A first sync taken after the last unlock files it undated (so "at start"), but the credit proves otherwise.
  const late = evaluateClogPages(spec, [member(1, wintertodt, wintertodt, [phoenix])], 'team');
  assert.equal(late.complete, true);
});

test('several pages: Team lets different members finish different pages; Solo needs one member for all', () => {
  const spec = { mode: 'complete' as const, pages: ['Wintertodt', 'Barrows Chests'], itemIds: [], required: 2 };
  const a = member(1, wintertodt, wintertodt.slice(1));
  const b = member(2, barrows, barrows.slice(1));
  assert.equal(evaluateClogPages(spec, [a, b], 'team').complete, true);
  const solo = evaluateClogPages(spec, [a, b], 'individual');
  assert.equal(solo.complete, false);
  assert.equal(solo.current, 1);
  const both = member(3, [...wintertodt, ...barrows], []);
  const soloDone = evaluateClogPages(spec, [a, both], 'individual');
  assert.equal(soloDone.complete, true);
  assert.equal(soloDone.finisherPlayerId, 3);
  // "Any 1 of the 2" — one page is enough.
  assert.equal(evaluateClogPages({ ...spec, required: 1 }, [a], 'team').complete, true);
});

test('a finished page waits for a screenshot from someone who finished it', () => {
  const spec = { mode: 'complete' as const, pages: ['Wintertodt'], itemIds: [], required: 1 };
  const missingOne = wintertodt.slice(0, -1);
  // Got the last slot by an unlock line (credited): verified.
  const viaUnlock = evaluateClogPages(spec, [member(1, wintertodt, missingOne, [wintertodt[wintertodt.length - 1]]), member(2, [], [])], 'team');
  assert.deepEqual(clogPageProof(viaUnlock, new Set()), { ok: false, flag: [] });
  assert.deepEqual(clogPageProof(viaUnlock, new Set([2])), { ok: false, flag: [] }); // not a finisher's shot
  assert.deepEqual(clogPageProof(viaUnlock, new Set([1])), { ok: true, flag: [] });
  // The last slot only ever showed up in a sync: still counts once proven, but the proof is flagged.
  const viaSync = evaluateClogPages(spec, [member(1, wintertodt, missingOne)], 'team');
  assert.deepEqual(viaSync.pages[0].unverifiedBy, [1]);
  assert.deepEqual(clogPageProof(viaSync, new Set([1])), { ok: true, flag: [1] });
  // Not finished: nothing to prove.
  assert.equal(clogPageProof(evaluateClogPages(spec, [member(1, missingOne, missingOne)], 'team'), new Set([1])).ok, false);
});

test('a Solo page tile is proven only by the member who finished every page', () => {
  const spec = { mode: 'complete' as const, pages: ['Wintertodt', 'Barrows Chests'], itemIds: [], required: 2 };
  const both = member(3, [...wintertodt, ...barrows], [], [...wintertodt, ...barrows]);
  const partial = member(1, wintertodt, wintertodt.slice(1), [wintertodt[0]]);
  const solo = evaluateClogPages(spec, [partial, both], 'individual');
  assert.equal(clogPageProof(solo, new Set([1])).ok, false);
  assert.equal(clogPageProof(solo, new Set([3])).ok, true);
});

// ── Plugin + proof ───────────────────────────────────────────────────────────────────────────

test('the plugin entry lists the counted names for chosen pages, null for any page', () => {
  const tile = { id: 7, position: 3, label: 'Barrows', description: null, points: 2, category: null, trackingMode: 'team' };
  const any = pluginClogEntry({ ...tile, countMode: 'slots', targetNpcs: null, requiredAmount: 10 }, 4, false);
  assert.equal(any.items, null);
  assert.equal(any.requiredAmount, 10);
  assert.equal(any.currentAmount, 4);
  const pages = pluginClogEntry({ ...tile, countMode: 'slots', targetNpcs: '["Barrows Chests"]', requiredAmount: 3 }, 0, false);
  assert.ok(pages.items?.includes(clogNameKey("Ahrim's hood")));
  assert.ok(!pages.items?.includes(clogNameKey('Phoenix')));
  assert.equal(clogNameKey("Ahrim's hood"), 'ahrim s hood');
  assert.equal(pages.groups, undefined);
  // A whole-page tile also hands the plugin each page's chosen ids, so it can screenshot a full page.
  const whole = pluginClogEntry({ ...tile, countMode: 'complete', targetNpcs: '["Wintertodt"]', trackedItemIds: null, requiredAmount: null }, 0, false);
  assert.deepEqual(whole.groups, { Wintertodt: wintertodt });
});

test('a plugin proof names its item in the banner detail, or the game line in its chat', () => {
  assert.equal(clogItemFromProof({ detail: 'Phoenix', chat: [] }), 'Phoenix');
  assert.equal(
    clogItemFromProof({ detail: '', chat: [{ text: 'New item added to your collection log: <col=ff0000>Pet chaos elemental</col>' }] }),
    'Pet chaos elemental',
  );
  assert.equal(clogItemFromProof(null), null);
});
