// A roster push has to be believable before it is allowed to remove anybody.
//
// The sync departs everyone the payload does not name, so "the client could not read the clan" and
// "sixty people left" arrive as the same request. On 2026-09-11 a ported HDOS client posted an empty
// member list against a 144-member clan and the server obeyed it: every member was soft-deleted,
// including the owner's own seat — which is where the plugin resolves WHICH clan an apex request is
// for, so the wipe also revoked the only account that could have synced the fix.
//
// These are the cases that must never reach the diff again.
//
// Run: npx tsx --test tests/roster-read-verdict.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_SHRINK_FRACTION,
  SHRINK_GUARD_MIN_ROSTER,
  rosterReadVerdict,
  type RosterReadFacts,
} from '../src/lib/rosterSync';

/** A healthy push against a 144-member clan: everyone named, nobody leaving. */
function facts(over: Partial<RosterReadFacts> = {}): RosterReadFacts {
  return { sent: 144, resolved: 144, skippedNames: 0, activeMembers: 144, wouldDepart: 0, ...over };
}

test('the ordinary sync is not refused', () => {
  assert.equal(rosterReadVerdict(facts()), null);
});

test('an empty payload against a populated clan is a failed read, not an empty clan', () => {
  const v = rosterReadVerdict(facts({ sent: 0, resolved: 0, wouldDepart: 144 }));
  assert.deepEqual(v, { kind: 'empty' }, 'this is the HDOS incident');
});

test('a payload of unreadable names is empty too — the raw length lies', () => {
  // 144 "#Player1404" placeholders: non-empty array, nothing survives isPlausibleRsn. A guard
  // written as `members.length === 0` sails past this and wipes the clan anyway.
  const v = rosterReadVerdict(facts({ sent: 144, resolved: 0, skippedNames: 144, wouldDepart: 144 }));
  assert.deepEqual(v, { kind: 'empty' });
});

test('a half-loaded list is refused even though every name in it is real', () => {
  const v = rosterReadVerdict(facts({ sent: 144, resolved: 8, skippedNames: 136, wouldDepart: 136 }));
  assert.deepEqual(v, { kind: 'mostly-unreadable' }, 'resolved 8 of 144 — it failed, it did not witness');
});

test('a few genuinely unresolvable members are normal and sync fine', () => {
  assert.equal(rosterReadVerdict(facts({ sent: 144, resolved: 140, skippedNames: 4, wouldDepart: 4 })), null);
});

test('an online-only payload is refused by the ceiling — the case the other two cannot see', () => {
  // Every name real, nothing skipped: only the SIZE betrays it.
  const v = rosterReadVerdict(facts({ sent: 12, resolved: 12, activeMembers: 144, wouldDepart: 132 }));
  assert.deepEqual(v, { kind: 'shrink', ceiling: 72 });
});

test('force answers the ceiling, because a real mass kick has to be possible', () => {
  const massKick = facts({ sent: 12, resolved: 12, activeMembers: 144, wouldDepart: 132 });
  assert.equal(rosterReadVerdict({ ...massKick, force: true }), null);
});

test('force does NOT answer an unreadable list', () => {
  // A read that returned nothing legible cannot be confirmed by the person who also could not see it.
  const blind = facts({ sent: 0, resolved: 0, wouldDepart: 144, force: true });
  assert.deepEqual(rosterReadVerdict(blind), { kind: 'empty' });
  const partial = facts({ sent: 144, resolved: 8, skippedNames: 136, wouldDepart: 136, force: true });
  assert.deepEqual(rosterReadVerdict(partial), { kind: 'mostly-unreadable' });
});

test('exactly half may leave; one more has to be confirmed', () => {
  const half = Math.floor(100 * MAX_SHRINK_FRACTION);
  assert.equal(rosterReadVerdict(facts({ activeMembers: 100, resolved: 50, wouldDepart: half })), null);
  assert.deepEqual(
    rosterReadVerdict(facts({ activeMembers: 100, resolved: 49, wouldDepart: half + 1 })),
    { kind: 'shrink', ceiling: half },
  );
});

test('a small clan may shrink by any amount — churn there is ordinary', () => {
  const small = SHRINK_GUARD_MIN_ROSTER - 1;
  assert.equal(
    rosterReadVerdict(facts({ sent: 2, resolved: 2, activeMembers: small, wouldDepart: small - 2 })),
    null,
  );
});

test('a clan with nothing to lose is never refused', () => {
  // No active members: an unreadable push is useless, not destructive, so it takes the normal path
  // and reports its own zeroes rather than erroring.
  assert.equal(rosterReadVerdict(facts({ sent: 0, resolved: 0, activeMembers: 0, wouldDepart: 0 })), null);
});

test('a first sync that seats an entire clan is growth, not shrink', () => {
  assert.equal(rosterReadVerdict(facts({ sent: 144, resolved: 144, activeMembers: 1, wouldDepart: 0 })), null);
});
