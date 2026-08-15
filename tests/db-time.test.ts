// Reading the two timestamp formats Anvil's text columns hold (lib/dbTime).
//
// Run: node --experimental-strip-types --test tests/db-time.test.ts
// (lib/dbTime imports nothing from `@/`, so Node's native TS type-stripping runs it directly.)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { dayKey, daysSince, parseStamp } from '../src/lib/dbTime.ts';

const UTC_NOON = Date.parse('2026-08-15T12:00:00.000Z');

test('a JS ISO timestamp parses to exactly its instant', () => {
  assert.equal(parseStamp('2026-08-15T12:00:00.000Z'), UTC_NOON);
});

test("SQLite's space format is read as UTC, not as the reader's local time", () => {
  // The whole point: `Date.parse("2026-08-15 12:00:00")` is local in V8, so on a UTC+3 box this
  // would land three hours early and every derived age would be wrong by the offset.
  assert.equal(parseStamp('2026-08-15 12:00:00'), UTC_NOON);
});

test('both formats agree with each other', () => {
  assert.equal(parseStamp('2026-08-15 12:00:00'), parseStamp('2026-08-15T12:00:00.000Z'));
});

test('an already-ISO value is never double-suffixed into NaN', () => {
  // The bug this module exists to kill: "…000Z" + "Z" parses to NaN, and the dashboard rendered
  // "Oldest: NaN days".
  const ms = parseStamp('2026-08-15T12:00:00.000Z');
  assert.notEqual(ms, null);
  assert.ok(Number.isFinite(ms!));
});

test('an explicit non-UTC offset is respected rather than overwritten', () => {
  assert.equal(parseStamp('2026-08-15T15:00:00+03:00'), UTC_NOON);
  assert.equal(parseStamp('2026-08-15T08:00:00-0400'), UTC_NOON);
});

test('a T with no zone is still treated as UTC', () => {
  assert.equal(parseStamp('2026-08-15T12:00:00'), UTC_NOON);
});

test('unreadable input is null, never NaN', () => {
  for (const bad of [null, undefined, '', '   ', 'not a date']) {
    assert.equal(parseStamp(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

test('daysSince counts whole days and never goes negative', () => {
  const now = Date.parse('2026-08-15T12:00:00.000Z');
  assert.equal(daysSince('2026-08-15 12:00:00', now), 0);
  assert.equal(daysSince('2026-08-14 12:00:00', now), 1);
  assert.equal(daysSince('2026-07-27 12:00:00', now), 19);
  // A clock-skewed row from the future reads as "today", not as a negative age.
  assert.equal(daysSince('2026-08-20T00:00:00.000Z', now), 0);
  assert.equal(daysSince(null, now), null);
});

test('dayKey gives the prefix both formats share', () => {
  const now = Date.parse('2026-08-15T12:00:00.000Z');
  assert.equal(dayKey(now), '2026-08-15');
  assert.equal(dayKey(now, 7), '2026-08-08');
  // Which is exactly what makes a prefix comparison format-blind.
  assert.ok('2026-08-15 09:00:00'.slice(0, 10) >= dayKey(now, 7));
  assert.ok('2026-08-15T09:00:00.000Z'.slice(0, 10) >= dayKey(now, 7));
});

test('the prefix comparison keeps a boundary day that whole-string sorting would drop', () => {
  // "2026-08-08 06:00:00" < "2026-08-08T00:00:00.000Z" as whole strings, because space sorts
  // below T — so a naive `>= isoCutoff` filter loses SQLite-written rows on the cutoff day.
  const cutoffIso = '2026-08-08T00:00:00.000Z';
  const sqliteRow = '2026-08-08 06:00:00';
  assert.ok(sqliteRow < cutoffIso, 'precondition: whole-string comparison is wrong');
  assert.ok(sqliteRow.slice(0, 10) >= cutoffIso.slice(0, 10), 'prefix comparison keeps it');
});
