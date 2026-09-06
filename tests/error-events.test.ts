// What counts as the same failure, and what the digest says about it.
//
// Both halves are pure — lib/errorFingerprint takes strings, lib/errorDigest takes rows — which is
// deliberate: the fingerprint is the one decision that decides whether this whole surface is
// readable, and it should be testable without a database or a thrown error.
//
// Run: npm run test:errors

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  fingerprintOf,
  normalizeMessage,
  normalizePath,
  ownFrame,
  trimStack,
} from '../src/lib/errorFingerprint.ts';
import { buildDigest, deltaOf, isNew, type DigestRow } from '../src/lib/errorDigest.ts';

test('the variable parts of a message do not enter its identity', () => {
  // THE POINT OF THE WHOLE TABLE. Without this, one broken handler hit with two hundred different
  // ids is two hundred rows, and the digest is unreadable exactly when it matters most.
  const a = normalizeMessage("Event 5 not found in roster 'the afk spot'");
  const b = normalizeMessage("Event 918 not found in roster 'rival clan'");
  assert.equal(a, b);
  assert.equal(a, "Event <n> not found in roster '<v>'");

  // UUIDs and hex digests are matched before bare numbers, or the number rule would chew them up.
  assert.equal(
    normalizeMessage('row 550e8400-e29b-41d4-a716-446655440000 missing'),
    'row <uuid> missing',
  );
  assert.equal(normalizeMessage('token a1b2c3d4e5f60718293a4b5c6d7e8f90 bad'), 'token <hash> bad');
});

test('two genuinely different failures stay apart', () => {
  const a = fingerprintOf({ name: 'TypeError', message: 'x is not a function' });
  const b = fingerprintOf({ name: 'TypeError', message: 'y is undefined' });
  assert.notEqual(a, b);
  // Same message, different error type, is also two things.
  assert.notEqual(
    fingerprintOf({ name: 'TypeError', message: 'boom' }),
    fingerprintOf({ name: 'RangeError', message: 'boom' }),
  );
});

test('a path folds its ids and its clan away', () => {
  // The clan is recorded in its own column; leaving it in the path too would split one bug across
  // every clan that hit it.
  assert.equal(normalizePath('/c/theafkspot/events/91'), '/c/<clan>/events/<n>');
  assert.equal(normalizePath('/c/rivals/events/4'), '/c/<clan>/events/<n>');
  assert.equal(normalizePath('/api/events/5/submissions?x=1'), '/api/events/<n>/submissions');
  assert.equal(normalizePath(null), null);
});

test('the own frame skips the framework AND the build output', () => {
  const stack = [
    'Error: boom',
    '    at handler (/app/node_modules/next/dist/server/route.js:1:1)',
    '    at wrapped (/app/.next/server/chunks/[root-of-the-server]__abc123._.js:1:6249)',
    '    at loadBoard (/app/src/lib/boardScoring.ts:42:11)',
  ].join('\n');
  // `.next/` is the build output, not our code: every failure in the app lives in some hashed chunk,
  // so without skipping it the "own frame" is a filename that changes wholesale on the next build
  // and tells a reader nothing. Found by running it — the first fingerprints were all chunk paths.
  assert.equal(ownFrame(stack), 'loadBoard (/app/src/lib/boardScoring.ts');
  assert.equal(ownFrame(null), null);
});

test('with no usable frame, the fingerprint falls back to the route', () => {
  const onlyChunks = [
    'Error: boom',
    '    at v (/app/.next/server/chunks/x._.js:1:1)',
  ].join('\n');
  const fp = fingerprintOf({
    name: 'Error',
    message: 'Event 5 not found',
    stack: onlyChunks,
    path: '/c/theafkspot/api/boomtest',
  });
  assert.ok(fp.endsWith('/c/<clan>/api/boomtest'), fp);
});

test('a stack is trimmed, not stored whole', () => {
  const long = ['Error: x', ...Array.from({ length: 40 }, (_, i) => `    at f${i} (/app/a.ts:1:1)`)].join('\n');
  const trimmed = trimStack(long)!;
  assert.ok(trimmed.split('\n').length <= 9);
  assert.ok(trimmed.length < long.length);
});

// ── The digest ───────────────────────────────────────────────────────────────────────────────────

function row(over: Partial<DigestRow> = {}): DigestRow {
  return {
    id: 1,
    fingerprint: 'Error|boom|/x',
    name: 'Error',
    message: 'boom',
    path: '/x',
    source: 'route',
    release: '1.0.0',
    clanSlug: null,
    count: 5,
    notifiedCount: 0,
    firstSeenAt: '2026-09-06 10:00:00',
    lastSeenAt: '2026-09-06 11:00:00',
    ...over,
  };
}

test('a quiet hour posts nothing at all', () => {
  // NOT a formatting preference. An hourly "0 errors" trains everyone to ignore the channel, which
  // costs precisely the alarm the job exists to raise.
  assert.equal(buildDigest([]), null);
  assert.equal(buildDigest([row({ count: 5, notifiedCount: 5 })]), null);
});

test('the digest reports the delta, not the total', () => {
  // A failure that happened 4,000 times overnight and has stopped should go quiet on its own; one
  // still going should keep being mentioned.
  assert.equal(deltaOf({ count: 4000, notifiedCount: 3990 }), 10);
  assert.equal(deltaOf({ count: 10, notifiedCount: 10 }), 0);
  // Never negative, even if a count were somehow rewound.
  assert.equal(deltaOf({ count: 3, notifiedCount: 9 }), 0);

  const digest = buildDigest([row({ count: 4000, notifiedCount: 3990 })])!;
  assert.match(digest.description, /10 occurrences/);
});

test('a failure nobody has reported reads differently from one that is continuing', () => {
  assert.equal(isNew({ notifiedCount: 0 }), true);
  assert.equal(isNew({ notifiedCount: 3 }), false);

  const fresh = buildDigest([row({ notifiedCount: 0 })])!;
  assert.match(fresh.title, /🔴/);
  assert.match(fresh.description, /1 new failure/);

  const continuing = buildDigest([row({ count: 9, notifiedCount: 5 })])!;
  assert.match(continuing.title, /continuing/);
  assert.match(continuing.description, /nothing new/);
});

test('the worst offender leads, and the overflow is counted rather than dropped', () => {
  const rows = Array.from({ length: 14 }, (_, i) =>
    row({ id: i + 1, message: `boom ${i}`, count: i + 1, notifiedCount: 0 }),
  );
  const digest = buildDigest(rows)!;
  assert.equal(digest.fields.length, 10);
  // Ordered by how much it is happening, not by when it arrived.
  assert.match(digest.fields[0].name, /×14/);
  assert.match(digest.footer!.text, /\+4 more/);
});

test('a clan failure says which clan, an apex one says apex', () => {
  const withClan = buildDigest([row({ clanSlug: 'theafkspot' })])!;
  assert.match(withClan.fields[0].value, /clan `theafkspot`/);
  const apex = buildDigest([row({ clanSlug: null })])!;
  assert.match(apex.fields[0].value, /apex/);
});

test('Discord field limits are respected even for a pathological error', () => {
  // Discord rejects the whole post over its limits, which would lose the alarm entirely — and a
  // 20KB message is exactly the kind of thing a broken serialiser produces.
  const digest = buildDigest([row({ message: 'x'.repeat(20_000), path: '/y'.repeat(500) })])!;
  for (const f of digest.fields) {
    assert.ok(f.name.length <= 256, `field name ${f.name.length}`);
    assert.ok(f.value.length <= 1024, `field value ${f.value.length}`);
  }
});
