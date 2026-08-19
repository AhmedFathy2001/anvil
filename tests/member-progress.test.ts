// Account progress the hiscores don't carry (lib/memberProgress): what a push is allowed to say,
// and what of it is worth a write.
//
// Run: node --experimental-strip-types --test tests/member-progress.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DIARY_ELITE,
  DIARY_EASY,
  DIARY_HARD,
  DIARY_MEDIUM,
  PROGRESS_KEYS,
  caTierName,
  cleanProgress,
  progressKey,
  progressSummary,
  progressUpdates,
  progressView,
} from '../src/lib/memberProgress.ts';

test('the registry is the whitelist: an unknown key is not storable', () => {
  assert.equal(progressKey('questPoints')?.group, 'quests');
  assert.equal(progressKey('somethingElse'), null);
  assert.equal(progressKey(null), null);
  // Every key is unique — two rows fighting over one (member, key) would be a silent overwrite.
  assert.equal(new Set(PROGRESS_KEYS.map((k) => k.key)).size, PROGRESS_KEYS.length);
});

test('cleanProgress: keeps the good rows and drops the rest, rather than refusing the push', () => {
  const clean = cleanProgress([
    { key: 'questPoints', value: 300 },
    { key: 'caPoints', value: 1200.7 },       // floored, not rejected
    { key: 'notAKey', value: 5 },             // a newer plugin than this server
    { key: 'diaryElite', value: -1 },         // impossible
    { key: 'diaryEasy', value: 999 },         // past the key's ceiling
    { key: 'caTier', value: 'master' },       // wrong type
  ]);
  assert.deepEqual([...clean.entries()], [['questPoints', 300], ['caPoints', 1200]]);
  // One bad row can't cost a member the good ones alongside it.
  assert.equal(clean.has('notAKey'), false);
  assert.equal(cleanProgress(null).size, 0);
  assert.equal(cleanProgress([]).size, 0);
});

test('progressUpdates: only what moved, and progress never moves down', () => {
  const stored = new Map([['questPoints', 300], ['caPoints', 1200]]);
  const incoming = new Map([['questPoints', 300], ['caPoints', 1300], ['diaryElite', 2]]);
  const updates = progressUpdates(stored, incoming);
  // Unchanged keys aren't written; new and risen ones are.
  assert.deepEqual([...updates.entries()], [['caPoints', 1300], ['diaryElite', 2]]);

  // A client that read a varbit before the game populated it reports zeroes — which must never
  // erase an account.
  assert.equal(progressUpdates(stored, new Map([['questPoints', 0]])).size, 0);
  assert.equal(progressUpdates(stored, new Map([['caPoints', 900]])).size, 0);
  // Nothing stored yet: everything is new.
  assert.equal(progressUpdates(new Map(), incoming).size, 3);
});

test('progressView: registry order, and silence about keys nobody pushed', () => {
  const view = progressView([
    { key: 'diaryElite', value: 3, updatedAt: '2026-08-19T00:00:00.000Z' },
    { key: 'questPoints', value: 300 },
  ]);
  // Registry order, not row order, so the strip reads the same on every profile.
  assert.deepEqual(view.map((v) => v.key), ['questPoints', 'diaryElite']);
  // A key nobody has pushed is absent rather than 0 — "we were never told" is not "they have none".
  assert.equal(view.some((v) => v.key === 'caPoints'), false);
  assert.equal(view[0].max, null);
  assert.equal(view[1].max, 12);
});

test('caTierName: 0 is "not yet", and anything past Grandmaster still reads as Grandmaster', () => {
  assert.equal(caTierName(0), '—');
  assert.equal(caTierName(null), '—');
  assert.equal(caTierName(3), 'Hard');
  assert.equal(caTierName(6), 'Grandmaster');
  assert.equal(caTierName(99), 'Grandmaster');
});

test('progressSummary: a region mask says which diary, not just how many', () => {
  const s = progressSummary([
    { key: 'questPoints', value: 302 },
    { key: 'questsCompleted', value: 148 },
    { key: 'caPoints', value: 1465 },
    { key: 'caTiers', value: 0b001111 },
    { key: 'caTier', value: 4 },
    { key: 'diaryArdougne', value: DIARY_EASY | DIARY_MEDIUM | DIARY_HARD | DIARY_ELITE },
    { key: 'diaryVarrock', value: DIARY_EASY | DIARY_MEDIUM },
    { key: 'diaryKaramja', value: DIARY_ELITE },
  ]);

  assert.equal(s.questPoints, 302);
  assert.equal(s.questsCompleted, 148);
  assert.equal(s.caTier, 'Elite');
  // Cumulative, from the mask: everything up to Elite lit, Master and Grandmaster dark.
  assert.deepEqual(s.caTiers.filter((t) => t.cleared).map((t) => t.name), ['Easy', 'Medium', 'Hard', 'Elite']);

  const ardougne = s.regions.find((r) => r.key === 'diaryArdougne');
  assert.deepEqual(ardougne?.tiers.map((t) => t.state), ['done', 'done', 'done', 'done']);
  const varrock = s.regions.find((r) => r.key === 'diaryVarrock');
  assert.deepEqual(varrock?.tiers.map((t) => t.state), ['done', 'done', 'todo', 'todo']);

  // Karamja's lower three have no completion flag in the game — unknown, never "unfinished", and
  // never counted in the denominator either.
  const karamja = s.regions.find((r) => r.key === 'diaryKaramja');
  assert.deepEqual(karamja?.tiers.map((t) => t.state), ['unknown', 'unknown', 'unknown', 'done']);
  assert.equal(s.diariesDone, 4 + 2 + 1);
  assert.equal(s.diariesKnowable, 4 + 4 + 1);
});

test('progressSummary: an older plugin still fills the summary, without the grid', () => {
  const s = progressSummary([
    { key: 'questPoints', value: 100 },
    { key: 'diaryEasy', value: 5 },
    { key: 'diaryElite', value: 1 },
    { key: 'caTier', value: 2 },
  ]);
  assert.deepEqual(s.regions, []);
  assert.equal(s.diariesDone, 6);
  // 11 readable regions × 3 tiers + 12 elite.
  assert.equal(s.diariesKnowable, 45);
  // With no mask, the tiers up to the highest cleared are implied rather than claimed exactly.
  assert.deepEqual(s.caTiers.filter((t) => t.cleared).map((t) => t.name), ['Easy', 'Medium']);
});

test('progressSummary: nothing pushed is empty, not a row of zeroes', () => {
  const s = progressSummary([]);
  assert.equal(s.empty, true);
  assert.equal(s.questPoints, null);
  assert.equal(s.caPoints, null);
  assert.deepEqual(s.regions, []);
});
