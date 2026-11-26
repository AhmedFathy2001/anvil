// Practice boards — the pure rules (lib/practiceRules) and the plugin's active-board pick. No database.
//
// Run: npx tsx --test tests/practice-rules.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PRACTICE_KEEP_DAYS,
  PRACTICE_MAX_PLAYERS,
  PRACTICE_MAX_TILES,
  lowerTargetValue,
  maskedHook,
  parsePracticeHook,
  parsePracticeInput,
  practiceDue,
  practiceRunning,
  practiceTeams,
  tilesFrozenByStart,
} from '../src/lib/practiceRules';
import { pickActivePluginEvent } from '../src/lib/pluginEventPick';
import { appendBoardTiles, boardLabel, prefixPracticeLabels } from '../src/lib/pluginBoardTiles';
import { named } from '../src/lib/pluginFacts/rules';
import { notCounted } from '../src/lib/pluginFacts/match';

const HOOK = 'https://discord.com/api/webhooks/123456789012345678/abcDEF_-token';

const good = {
  tiles: { mode: 'copy', eventId: 4, tileIds: [1, 2, 3] },
  seats: [10, 11],
  sides: 2,
  webhookUrl: HOOK,
  hours: 6,
};

test('a pasted test webhook must be a Discord webhook', () => {
  assert.deepEqual(parsePracticeHook(''), { ok: true, url: null });
  assert.deepEqual(parsePracticeHook(null), { ok: true, url: null });
  const ok = parsePracticeHook(`  ${HOOK}  `);
  assert.equal(ok.ok, true);
  assert.equal(ok.ok && ok.url, HOOK);
  for (const bad of [
    'http://discord.com/api/webhooks/1/abc',
    'https://evil.example/api/webhooks/1/abc',
    'https://discord.com.evil.example/api/webhooks/1/abc',
    'https://169.254.169.254/latest/meta-data',
    'https://discord.com/api/webhooks/1/abc/messages/5',
    'https://user:pw@discord.com/api/webhooks/1/abc',
    'https://discord.com:8443/api/webhooks/1/abc',
    'https://discord.com/channels/1/2',
    42,
  ]) {
    assert.equal(parsePracticeHook(bad).ok, false, String(bad));
  }
});

test('the setup body is checked: tiles, people, sides, length', () => {
  const parsed = parsePracticeInput(good);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.ok && parsed.value.webhookUrl, HOOK);

  assert.equal(parsePracticeInput({ ...good, hours: 3 }).ok, false);
  assert.equal(parsePracticeInput({ ...good, sides: 3 }).ok, false);
  assert.equal(parsePracticeInput({ ...good, sides: 2, seats: [10] }).ok, false, 'two teams need two people');
  assert.equal(parsePracticeInput({ ...good, seats: [] }).ok, false);
  assert.equal(parsePracticeInput({ ...good, seats: Array.from({ length: PRACTICE_MAX_PLAYERS + 1 }, (_, i) => i + 1) }).ok, false);
  assert.equal(parsePracticeInput({ ...good, webhookUrl: 'https://example.com/hook' }).ok, false);
  assert.equal(parsePracticeInput({ ...good, tiles: { mode: 'copy', eventId: 4, tileIds: [] } }).ok, false);
  assert.equal(
    parsePracticeInput({ ...good, tiles: { mode: 'copy', eventId: 4, tileIds: Array.from({ length: PRACTICE_MAX_TILES + 1 }, (_, i) => i + 1) } }).ok,
    false,
  );
  assert.equal(parsePracticeInput({ ...good, tiles: { mode: 'pick', count: PRACTICE_MAX_TILES + 1 } }).ok, false);
  assert.equal(parsePracticeInput({ ...good, tiles: { mode: 'pick', count: 3 } }).ok, true);
  assert.equal(parsePracticeInput({ ...good, tiles: { mode: 'other' } }).ok, false);
  // An empty board (built in the tile editor) and a library board.
  assert.equal(parsePracticeInput({ ...good, tiles: { mode: 'pick', count: 0 } }).ok, true);
  assert.equal(parsePracticeInput({ ...good, tiles: { mode: 'pick', count: -1 } }).ok, false);
  const lib = parsePracticeInput({ ...good, tiles: { mode: 'library', boardId: '7' } });
  assert.deepEqual(lib.ok && lib.value.tiles, { mode: 'library', boardId: 7 });
  assert.equal(parsePracticeInput({ ...good, tiles: { mode: 'library' } }).ok, false);
  assert.equal(parsePracticeInput({ ...good, tiles: { mode: 'library', boardId: 0 } }).ok, false);
  // Duplicates fold; no posts is fine.
  const dup = parsePracticeInput({ ...good, seats: [10, 10, 11], webhookUrl: '' });
  assert.equal(dup.ok, true);
  assert.deepEqual(dup.ok && dup.value.seats, [10, 11]);
  assert.equal(dup.ok && dup.value.webhookUrl, null);
});

const seat = (id: number, rsn = `P${id}`) => ({ id, rsn });

test('sides: solo is a team each named after the character, two teams alternate with the creator first', () => {
  const solo = practiceTeams([seat(1, 'muhmadd'), seat(2, 'Titoc'), seat(3, 'titoc')], 1);
  assert.deepEqual(solo.map((t) => t.seats), [[1], [2], [3]]);
  assert.deepEqual(solo.map((t) => t.name), ['muhmadd', 'Titoc', 'titoc (2)']);
  assert.equal(new Set(solo.map((t) => t.color)).size, 3);
  const two = practiceTeams([1, 2, 3, 4, 5].map((i) => seat(i)), 2);
  assert.deepEqual(two.map((t) => t.seats), [[1, 3, 5], [2, 4]]);
  assert.equal(two[0].name, 'Team Gold');
});

test('running, and deleted a week after it ends', () => {
  const now = Date.parse('2026-11-23T12:00:00Z');
  const run = { startDate: '2026-11-23T11:00:00Z', endDate: '2026-11-23T13:00:00Z', forceEndedAt: null };
  assert.equal(practiceRunning(run, now), true);
  assert.equal(practiceRunning({ ...run, forceEndedAt: '2026-11-23T11:30:00Z' }, now), false);
  assert.equal(practiceRunning({ ...run, endDate: '2026-11-23T11:59:00Z' }, now), false);
  assert.equal(practiceDue(run, now), false);
  const day = 86_400_000;
  assert.equal(practiceDue({ endDate: new Date(now - (PRACTICE_KEEP_DAYS - 1) * day).toISOString(), forceEndedAt: null }, now), false);
  assert.equal(practiceDue({ endDate: new Date(now - (PRACTICE_KEEP_DAYS + 1) * day).toISOString(), forceEndedAt: null }, now), true);
  // Ended by hand counts from the hand.
  assert.equal(practiceDue({ endDate: '2027-01-01T00:00:00Z', forceEndedAt: new Date(now - 8 * day).toISOString() }, now), true);
});

test('the page never prints the hook back; a lowered target stays between 1 and the goal', () => {
  const shown = maskedHook(HOOK)!;
  assert.ok(!shown.includes('abcDEF'));
  assert.ok(shown.endsWith('5678'));
  assert.equal(maskedHook('nope'), null);
  assert.equal(lowerTargetValue(50, 2), 2);
  assert.equal(lowerTargetValue(50, 80), 50);
  assert.equal(lowerTargetValue(50, 0), null);
  assert.equal(lowerTargetValue(null, 2), null);
});

test('the plugin’s one active board is a real one whenever a real one runs', () => {
  const now = '2026-11-23T12:00:00.000Z';
  const real = { eventId: 1, teamId: 1, startDate: '2026-11-20T00:00:00Z', endDate: '2026-11-30T00:00:00Z', forceEndedAt: null, practice: false };
  const practice = { eventId: 2, teamId: 2, startDate: '2026-11-23T11:59:00Z', endDate: '2026-11-23T18:00:00Z', forceEndedAt: null, practice: true };
  // The practice board started later, and still does not win.
  assert.equal(pickActivePluginEvent([practice, real], now)?.eventId, 1);
  // Alone, it is the board.
  assert.equal(pickActivePluginEvent([practice], now)?.eventId, 2);
  // Rows without the flag keep the freshest-start rule.
  const a = { ...real, eventId: 3, practice: undefined };
  const b = { ...real, eventId: 4, startDate: '2026-11-22T00:00:00Z', practice: undefined };
  assert.equal(pickActivePluginEvent([a, b], now)?.eventId, 4);
});

test('a practice board’s folded-in tiles carry practice: true, a real board’s do not', () => {
  const body: Record<string, unknown> = { trackedKills: [{ label: 'Real kill' }] };
  appendBoardTiles(body, { trackedKills: [{ label: 'Zulrah' }] }, { eventId: 9, teamId: 1, playerId: 2, clan: 'alpha', name: 'Practice', practice: true });
  appendBoardTiles(body, { trackedKills: [{ label: 'Vorkath' }] }, { eventId: 8, teamId: 1, playerId: 3, clan: 'alpha', name: 'Winter' });
  const rows = body.trackedKills as { board?: { practice?: boolean; eventId: number } }[];
  assert.equal(rows[0].board, undefined, 'the active board’s own entries stay untagged');
  assert.equal(rows[1].board?.practice, true);
  assert.equal(rows[2].board && 'practice' in rows[2].board, false);
});

test('a practice board’s popups say [Practice] — once — and a real board’s keep the board suffix', () => {
  const practice = { eventId: 9, teamId: 1, playerId: 2, clan: 'alpha', name: 'Practice · Winter Bingo', practice: true };
  const real = { eventId: 8, teamId: 1, playerId: 3, clan: 'alpha', name: 'Winter' };
  assert.equal(boardLabel('50 Zulrah kills', practice), '[Practice] 50 Zulrah kills');
  assert.equal(boardLabel('[Practice] 50 Zulrah kills', practice), '[Practice] 50 Zulrah kills', 'idempotent');
  assert.equal(boardLabel('50 Zulrah kills', real), '50 Zulrah kills · Winter');
  assert.equal(boardLabel('50 Zulrah kills · Winter', real), '50 Zulrah kills · Winter');
  assert.equal(boardLabel('50 Zulrah kills', null), '50 Zulrah kills');

  // Folded in as another board: every list's label carries the prefix (drops and kills too, which
  // the site's rules would name anyway), and the rules' named() leaves it as it is.
  const body: Record<string, unknown> = {};
  appendBoardTiles(body, { trackedKills: [{ label: 'Zulrah' }], trackedPvp: [{ label: 'PK' }] }, practice);
  appendBoardTiles(body, { trackedKills: [{ label: 'Vorkath' }], trackedPvp: [{ label: 'PK' }] }, real);
  const kills = body.trackedKills as { label: string; board: unknown }[];
  assert.deepEqual(kills.map((k) => k.label), ['[Practice] Zulrah', 'Vorkath']);
  assert.deepEqual((body.trackedPvp as { label: string }[]).map((k) => k.label), ['[Practice] PK', 'PK · Winter']);
  assert.equal(named(kills[0]), '[Practice] Zulrah');
  assert.equal(named(kills[1]), 'Vorkath · Winter');
  assert.equal(notCounted({ label: 'Zulrah', board: practice }, 'party too small'), 'Not counted: [Practice] Zulrah: party too small.');

  // The ACTIVE board's untagged lists, when it is the practice board.
  const active: Record<string, unknown> = { trackedDrops: [{ label: 'Any Barrows item' }], completedTiles: [{ label: 'Done one' }], notAList: 'x' };
  const before = active.trackedDrops;
  prefixPracticeLabels(active);
  prefixPracticeLabels(active);
  assert.deepEqual((active.trackedDrops as { label: string }[]).map((d) => d.label), ['[Practice] Any Barrows item']);
  assert.deepEqual((active.completedTiles as { label: string }[]).map((d) => d.label), ['[Practice] Done one']);
  assert.deepEqual((before as { label: string }[])[0].label, 'Any Barrows item', 'new rows, the originals untouched');
});

test('a practice board’s tiles never freeze at the start; a real board’s do', () => {
  const now = Date.parse('2026-11-26T12:00:00Z');
  const before = '2026-11-26T11:00:00Z';
  const after = '2026-11-26T13:00:00Z';
  assert.equal(tilesFrozenByStart({ startDate: before }, now), true, 'a started real board');
  assert.equal(tilesFrozenByStart({ practice: false, startDate: before }, now), true);
  assert.equal(tilesFrozenByStart({ startDate: after }, now), false, 'not started yet');
  assert.equal(tilesFrozenByStart({ startDate: null }, now), false, 'no start date');
  assert.equal(tilesFrozenByStart({ practice: true, startDate: before }, now), false, 'a running practice board stays authorable');
  assert.equal(PRACTICE_MAX_TILES >= 49, true, 'a whole 7×7 fits');
});
