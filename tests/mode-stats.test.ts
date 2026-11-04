// KC / XP from a game-mode world on a board that counts that mode (lib/modeStats): the readings a
// push leaves on the board row, and the gain they add — from the mode's own first reading, never the
// main game's hiscores baseline, and never summed on top of the main game's gain.
//
// Run: npx tsx --test tests/mode-stats.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MODE_STALE_MS,
  applyModeRead,
  countedModes,
  mergeModePush,
  milestoneWithModes,
  modeReadDue,
  modeReadingIssues,
  parseModeStats,
  resolveModeKey,
  statGainWithModes,
} from '../src/lib/modeStats.ts';

const T0 = Date.parse('2026-11-04T12:00:00.000Z');
const HOUR = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();
/** Two pushes an hour apart: honest pace for anything these tests push. */
const two = (mode: string, a: Record<string, number>, b: Record<string, number>, gapMs = HOUR) =>
  mergeModePush(mergeModePush(null, mode, a, iso(T0)), mode, b, iso(T0 + gapMs));

const snap = (zulrah: number, attackXp = 0) =>
  JSON.stringify({ skills: { overall: { rank: 1, xp: attackXp }, attack: { rank: 1, xp: attackXp } }, bosses: { zulrah: { rank: 1, score: zulrah } }, clues: {} });

test('a push sets each key’s first reading once and only ever raises the current one', () => {
  let json = mergeModePush(null, 'hardcore', { zulrah: 3 }, iso(T0));
  assert.deepEqual(parseModeStats(json), {
    hardcore: { first: { zulrah: 3 }, cur: { zulrah: 3 }, ft: { zulrah: iso(T0) }, at: { zulrah: iso(T0) } },
  });
  json = mergeModePush(json, 'hardcore', { zulrah: 7, attack: 500 }, iso(T0 + HOUR));
  const e = parseModeStats(json).hardcore;
  assert.deepEqual([e.first, e.cur], [{ zulrah: 3, attack: 500 }, { zulrah: 7, attack: 500 }]);
  assert.deepEqual(e.ft, { zulrah: iso(T0), attack: iso(T0 + HOUR) }, 'the first reading keeps its own time');
  assert.deepEqual(e.at, { zulrah: iso(T0 + HOUR), attack: iso(T0 + HOUR) }, 'a rise is stamped');
  assert.equal(mergeModePush(json, 'hardcore', { zulrah: 5 }), null, 'a lower reading changes nothing');
  json = mergeModePush(json, 'leagues', { zulrah: 40 });
  assert.equal(parseModeStats(json).hardcore.cur.zulrah, 7, 'modes are kept apart');
  assert.equal(parseModeStats(json).leagues.first.zulrah, 40);
});

test('garbage reads as no readings', () => {
  assert.deepEqual(parseModeStats('nope'), {});
  assert.deepEqual(parseModeStats('[1]'), {});
  assert.deepEqual(parseModeStats(JSON.stringify({ hardcore: { first: { zulrah: -1, x: 'a' }, cur: null } })), { hardcore: { first: {}, cur: {} } });
});

test('a kill count counts from its first reading, that first kill included', () => {
  const modes = two('hardcore', { zulrah: 1 }, { zulrah: 5 });
  // Main baseline says 0 Zulrah and main hiscores haven't moved: the mode's 5 kills are the gain.
  assert.equal(statGainWithModes(snap(0), snap(0), {}, ['zulrah'], 'boss', modes, ['hardcore']), 5);
});

test('XP counts from its first reading with nothing added (the login push carries no gain)', () => {
  const modes = two('hardcore', { attack: 1000 }, { attack: 4000 });
  assert.equal(statGainWithModes(snap(0, 0), snap(0, 0), {}, ['attack'], 'skill', modes, ['hardcore']), 3000);
  assert.equal(statGainWithModes(snap(0, 0), snap(0, 0), {}, ['overall'], 'skill', modes, ['hardcore']), 3000, 'total XP sums the mode’s skills');
});

test('a mode save’s numbers are never measured against the main game’s baseline', () => {
  // A Leagues save of a main with 500 Zulrah KC: the main baseline is 500, the Leagues save is at 20.
  const modes = two('leagues', { zulrah: 20 }, { zulrah: 30 });
  assert.equal(statGainWithModes(snap(500), snap(500), {}, ['zulrah'], 'boss', modes, ['leagues']), 11);
  // And progress the save had before the board started is not counted: first reading 400, now 402.
  const late = two('leagues', { zulrah: 400 }, { zulrah: 402 });
  assert.equal(statGainWithModes(snap(0), snap(0), {}, ['zulrah'], 'boss', late, ['leagues']), 3);
});

test('main and mode progress combine as the larger per key, never the sum', () => {
  const modes = two('hardcore', { zulrah: 1 }, { zulrah: 4 });
  // Main hiscores show +10, the mode +4: 10, not 14.
  assert.equal(statGainWithModes(snap(0), snap(10), {}, ['zulrah'], 'boss', modes, ['hardcore']), 10);
  // The mode ahead: 4 over the main's 2.
  assert.equal(statGainWithModes(snap(0), snap(2), {}, ['zulrah'], 'boss', modes, ['hardcore']), 4);
});

test('a mode the board does not count adds nothing, and no modes is exactly the main-game gain', () => {
  const modes = two('hardcore', { zulrah: 1 }, { zulrah: 50 });
  assert.equal(statGainWithModes(snap(0), snap(2), {}, ['zulrah'], 'boss', modes, []), 2);
  assert.equal(statGainWithModes(snap(0), snap(2), {}, ['zulrah'], 'boss', modes, ['leagues']), 2);
  assert.equal(statGainWithModes(snap(0), snap(2), { zulrah: 6 }, ['zulrah'], 'boss', null, ['hardcore']), 6);
});

test('the mode gain needs no hiscores baseline (a fresh character is not on the hiscores)', () => {
  const modes = two('hardcore', { zulrah: 1 }, { zulrah: 3 });
  assert.equal(statGainWithModes(null, null, {}, ['zulrah'], 'boss', modes, ['hardcore']), 3);
});

/** A read of the mode's table at `atMs` listing these boss KCs (null = the save isn't on it). */
const read = (bosses: Record<string, number> | null, atMs: number, skills: Record<string, number> = {}) => ({
  at: iso(atMs),
  snapshot: bosses
    ? ({
        skills: Object.fromEntries(Object.entries(skills).map(([k, xp]) => [k, { rank: 1, level: 1, xp }])),
        bosses: Object.fromEntries(Object.entries(bosses).map(([k, score]) => [k, { rank: 1, score }])),
      } as never)
    : null,
});

test('a milestone on a mode save: eligible only when its first reading was under the goal', () => {
  const none = { lifetime: 0, eligible: false, reached: false };
  const crossed = applyModeRead(two('hardcore', { zulrah: 90 }, { zulrah: 100 }), 'hardcore', read({ zulrah: 100 }, T0 + 2 * HOUR));
  assert.deepEqual(milestoneWithModes(none, crossed, ['hardcore'], ['zulrah'], 'boss', 100), { lifetime: 100, eligible: true, reached: true });
  const already = applyModeRead(two('hardcore', { zulrah: 101 }, { zulrah: 120 }), 'hardcore', read({ zulrah: 120 }, T0 + 2 * HOUR));
  assert.deepEqual(milestoneWithModes(none, already, ['hardcore'], ['zulrah'], 'boss', 100), none);
  assert.deepEqual(milestoneWithModes(none, crossed, [], ['zulrah'], 'boss', 100), none, 'not counted, not considered');
});

test('countedModes reads the board’s rules', () => {
  assert.deepEqual(countedModes({ worldModes: ['hardcore'] }), ['hardcore']);
  assert.deepEqual(countedModes(null), []);
});

// ── Checked against the mode's own hiscores ────────────────────────────────────────────────────

test('a reading the table has caught up to counts, and the table counts where it is ahead', () => {
  const pushed = two('hardcore', { zulrah: 1 }, { zulrah: 10 });
  const caught = applyModeRead(pushed, 'hardcore', read({ zulrah: 10 }, T0 + 2 * HOUR));
  assert.equal(resolveModeKey(parseModeStats(caught).hardcore, 'zulrah', 'boss')!.state, 'corroborated');
  assert.equal(statGainWithModes(null, null, {}, ['zulrah'], 'boss', caught, ['hardcore']), 10);
  // Kills made with the plugin off reach the table: they count too.
  const more = applyModeRead(pushed, 'hardcore', read({ zulrah: 14 }, T0 + 2 * HOUR));
  assert.equal(statGainWithModes(null, null, {}, ['zulrah'], 'boss', more, ['hardcore']), 14);
});

test('the plugin may be ahead of the table until the player has had to log out', () => {
  const pushed = two('hardcore', { zulrah: 1 }, { zulrah: 20 });
  // Read 30 minutes after the last kill: the player is probably still logged in.
  const soon = applyModeRead(pushed, 'hardcore', read({ zulrah: 5 }, T0 + HOUR + 30 * 60_000));
  const r = resolveModeKey(parseModeStats(soon).hardcore, 'zulrah', 'boss')!;
  assert.equal(r.state, 'ahead');
  assert.equal(statGainWithModes(null, null, {}, ['zulrah'], 'boss', soon, ['hardcore']), 20);
  assert.deepEqual(modeReadingIssues(soon, ['hardcore'], ['zulrah'], 'boss'), []);
});

test('a reading the table still contradicts after the logout window stops counting, and staff see it', () => {
  const pushed = two('hardcore', { zulrah: 1 }, { zulrah: 120 });
  const late = applyModeRead(pushed, 'hardcore', read({ zulrah: 40 }, T0 + HOUR + MODE_STALE_MS));
  const r = resolveModeKey(parseModeStats(late).hardcore, 'zulrah', 'boss')!;
  assert.equal(r.state, 'contradicted');
  assert.equal(statGainWithModes(null, null, {}, ['zulrah'], 'boss', late, ['hardcore']), 40, 'only what the table backs');
  const issues = modeReadingIssues(late, ['hardcore'], ['zulrah'], 'boss');
  assert.equal(issues.length, 1);
  assert.equal(issues[0].kind, 'contradicted');
  assert.equal(issues[0].pushed, 120);
  assert.equal(issues[0].hiscores, 40);
});

test('a reading that rose after the read is not contradicted by it', () => {
  const json = applyModeRead(two('hardcore', { zulrah: 1 }, { zulrah: 5 }), 'hardcore', read({ zulrah: 5 }, T0 + 2 * HOUR));
  const pushedLater = mergeModePush(json, 'hardcore', { zulrah: 9 }, iso(T0 + 3 * HOUR));
  const r = resolveModeKey(parseModeStats(pushedLater).hardcore, 'zulrah', 'boss')!;
  assert.equal(r.state, 'ahead');
  assert.equal(r.credited, 9);
});

test('a row stored before readings were stamped is taken as stale against a read (like the main overlay)', () => {
  const legacy = JSON.stringify({ hardcore: { first: { zulrah: 1 }, cur: { zulrah: 50 } } });
  const json = applyModeRead(legacy, 'hardcore', read({ zulrah: 10 }, T0));
  assert.equal(resolveModeKey(parseModeStats(json).hardcore, 'zulrah', 'boss')!.state, 'contradicted');
  // …and with no read at all it is left as it was (no clock to cap it by).
  assert.equal(statGainWithModes(null, null, {}, ['zulrah'], 'boss', legacy, ['hardcore']), 50);
});

test('a falsely low first reading is raised to what the table allows', () => {
  // The save really has 300 Zulrah; the client claims its first reading was 0, then pushes 310.
  const pushed = two('hardcore', { zulrah: 0 }, { zulrah: 310 }, 10 * 60_000);
  const json = applyModeRead(pushed, 'hardcore', read({ zulrah: 300 }, T0 + 10 * 60_000));
  const r = resolveModeKey(parseModeStats(json).hardcore, 'zulrah', 'boss')!;
  // 10 minutes at the default 100 KC/hr ceiling is 17 kills of slack: start ≥ 300 − 17.
  assert.equal(r.lowStart, true);
  assert.equal(r.start, 283);
  assert.ok(statGainWithModes(null, null, {}, ['zulrah'], 'boss', json, ['hardcore']) <= 27);
  assert.ok(modeReadingIssues(json, ['hardcore'], ['zulrah'], 'boss').some((i) => i.kind === 'low-start'));
});

test('an honest first reading is never raised, however late the read', () => {
  const pushed = two('hardcore', { attack: 10_000 }, { attack: 60_000 });
  const json = applyModeRead(pushed, 'hardcore', read({}, T0 + HOUR, { attack: 60_000 }));
  const r = resolveModeKey(parseModeStats(json).hardcore, 'attack', 'skill')!;
  assert.equal(r.lowStart, false);
  assert.equal(r.start, 10_000);
  assert.equal(statGainWithModes(null, null, {}, ['attack'], 'skill', json, ['hardcore']), 50_000);
});

test('an older read never replaces a newer one', () => {
  const pushed = two('hardcore', { zulrah: 1 }, { zulrah: 5 });
  const json = applyModeRead(pushed, 'hardcore', read({ zulrah: 5 }, T0 + 2 * HOUR));
  assert.equal(applyModeRead(json, 'hardcore', read({ zulrah: 1 }, T0 + HOUR)), null);
  assert.equal(applyModeRead(json, 'leagues', read({ zulrah: 1 }, T0 + 3 * HOUR)), null, 'no readings from that mode');
});

// ── Nothing to check against ────────────────────────────────────────────────────────────────────

test('unverified readings still count, at a plausible pace', () => {
  // A fresh character not on the table yet (404), honest pace: counts in full.
  const honest = applyModeRead(two('hardcore', { zulrah: 1 }, { zulrah: 30 }), 'hardcore', read(null, T0 + 2 * HOUR));
  assert.equal(resolveModeKey(parseModeStats(honest).hardcore, 'zulrah', 'boss')!.state, 'unverified');
  assert.equal(statGainWithModes(null, null, {}, ['zulrah'], 'boss', honest, ['hardcore']), 30);
  // 500 Zulrah "in" ten minutes on a mode with no table: held to ~17 past the first.
  const fake = two('beta', { zulrah: 1 }, { zulrah: 500 }, 10 * 60_000);
  const g = statGainWithModes(null, null, {}, ['zulrah'], 'boss', fake, ['beta']);
  assert.equal(g, 18);
  assert.equal(modeReadingIssues(fake, ['beta'], ['zulrah'], 'boss')[0].kind, 'capped');
  // Slow content has its own ceiling: 10 Inferno completions in an hour is not believable.
  const zuk = two('beta', { tzKalZuk: 0 }, { tzKalZuk: 10 });
  assert.equal(statGainWithModes(null, null, {}, ['tzKalZuk'], 'boss', zuk, ['beta']), 2);
});

test('a key the table does not list (below its minimum) is unverified, not contradicted', () => {
  const json = applyModeRead(two('hardcore', { zulrah: 1 }, { zulrah: 3 }), 'hardcore', read({ zulrah: -1 }, T0 + 9 * HOUR));
  const r = resolveModeKey(parseModeStats(json).hardcore, 'zulrah', 'boss')!;
  assert.equal(r.state, 'unverified');
  assert.equal(r.credited, 3);
});

test('a milestone never completes on unverified readings', () => {
  const none = { lifetime: 0, eligible: false, reached: false };
  const pushed = two('hardcore', { zulrah: 90 }, { zulrah: 100 });
  assert.deepEqual(milestoneWithModes(none, pushed, ['hardcore'], ['zulrah'], 'boss', 100), none, 'no read yet');
  const absent = applyModeRead(pushed, 'hardcore', read(null, T0 + 2 * HOUR));
  assert.deepEqual(milestoneWithModes(none, absent, ['hardcore'], ['zulrah'], 'boss', 100), none, 'not on the table');
  assert.deepEqual(milestoneWithModes(none, pushed, ['beta'], ['zulrah'], 'boss', 100), none, 'a mode with no table');
});

// ── When to read the table ──────────────────────────────────────────────────────────────────────

test('reads are wanted only when the readings moved', () => {
  const entryOf = (json: string | null) => parseModeStats(json).hardcore;
  const pushed = two('hardcore', { zulrah: 1 }, { zulrah: 5 });
  assert.deepEqual(modeReadDue(entryOf(pushed), T0 + HOUR), { due: true, urgent: true }, 'never read: the starting line');

  const json = applyModeRead(pushed, 'hardcore', read({ zulrah: 5 }, T0 + HOUR + 60_000));
  assert.equal(modeReadDue(entryOf(json), T0 + 10 * HOUR).due, false, 'caught up and idle: nothing to spend');

  const rose = mergeModePush(json, 'hardcore', { zulrah: 8 }, iso(T0 + 2 * HOUR));
  assert.equal(modeReadDue(entryOf(rose), T0 + HOUR + 30 * 60_000).due, false, 'rose, but read under an hour ago');
  assert.deepEqual(modeReadDue(entryOf(rose), T0 + 3 * HOUR), { due: true, urgent: false });

  const newKey = mergeModePush(json, 'hardcore', { vorkath: 1 }, iso(T0 + HOUR + 20 * 60_000));
  assert.deepEqual(modeReadDue(entryOf(newKey), T0 + HOUR + 25 * 60_000), { due: true, urgent: true }, 'a new key’s starting line');
});

test('a reading left above the table gets the read that settles it', () => {
  const entryOf = (json: string | null) => parseModeStats(json).hardcore;
  // Pushed 120, table read soon after says 40 (ahead, fine for now). Nothing moves again.
  const json = applyModeRead(two('hardcore', { zulrah: 1 }, { zulrah: 120 }), 'hardcore', read({ zulrah: 40 }, T0 + HOUR + 60 * 60_000));
  assert.equal(modeReadDue(entryOf(json), T0 + HOUR + 3 * HOUR).due, false);
  assert.deepEqual(modeReadDue(entryOf(json), T0 + HOUR + MODE_STALE_MS), { due: true, urgent: false });
  // Once a read after the window has been taken, it is not wanted again.
  const settled = applyModeRead(json, 'hardcore', read({ zulrah: 40 }, T0 + HOUR + MODE_STALE_MS + 60_000));
  assert.equal(modeReadDue(entryOf(settled), T0 + 20 * HOUR).due, false);
});

test('a save the table did not have is re-read less often', () => {
  const entryOf = (json: string | null) => parseModeStats(json).hardcore;
  const json = applyModeRead(two('hardcore', { zulrah: 1 }, { zulrah: 5 }), 'hardcore', read(null, T0 + HOUR + 60_000));
  const rose = mergeModePush(json, 'hardcore', { zulrah: 8 }, iso(T0 + 2 * HOUR));
  assert.equal(modeReadDue(entryOf(rose), T0 + 3 * HOUR).due, false);
  assert.equal(modeReadDue(entryOf(rose), T0 + 4 * HOUR + 2 * 60_000).due, true);
});
