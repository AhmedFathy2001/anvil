// Shared-kill correlation (lib/coopRuns) — collapsing N members' reports of one kill into one run,
// and the minimum-teammates gate that rides on the same grouping.
//
// Run: node --experimental-strip-types --test tests/coop-runs.test.ts
// (lib/coopRuns imports nothing, so Node's native TS type-stripping runs it directly.)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { coopProgress, buildRuns, isCoop, parseCoopCredit, type CoopSubmission } from '../src/lib/coopRuns.ts';

const T0 = Date.parse('2026-08-12T03:00:00.000Z');
let seq = 1;
const sub = (
  playerId: number,
  opts: { at?: number; rsn?: string; group?: string[]; party?: number; amount?: number } = {},
): CoopSubmission => ({
  id: seq++,
  playerId,
  amount: opts.amount ?? 1,
  createdAt: new Date(T0 + (opts.at ?? 0)).toISOString(),
  rsn: opts.rsn ?? null,
  coopGroup: opts.group ?? null,
  coopPartySize: opts.party ?? null,
});

const PER_KILL = { credit: 'per-kill' as const };

test('isCoop: only a client that saw company reports one', () => {
  assert.equal(isCoop(sub(1)), false);
  assert.equal(isCoop(sub(1, { party: 1 })), false, 'a party of one is solo');
  assert.equal(isCoop(sub(1, { party: 2 })), true);
  assert.equal(isCoop(sub(1, { group: ['bob'] })), true);
});

test('parseCoopCredit defaults to per-member so no live board changes under anyone', () => {
  assert.equal(parseCoopCredit(null), 'per-member');
  assert.equal(parseCoopCredit(undefined), 'per-member');
  assert.equal(parseCoopCredit('nonsense'), 'per-member');
  assert.equal(parseCoopCredit('per-kill'), 'per-kill');
});

test('two members in one Yama instance credit ONE kill, not two', () => {
  const subs = [
    sub(1, { rsn: 'alice', group: ['bob'], party: 2 }),
    sub(2, { rsn: 'bob', group: ['alice'], party: 2, at: 400 }),
  ];
  assert.equal(coopProgress(subs, PER_KILL).current, 1);
  // Off (the default) it stays the old behaviour.
  assert.equal(coopProgress(subs).current, 2);
});

test('a 20-man raid credits once', () => {
  // Nobody can name anyone inside a raid — the party splits across rooms — but every client knows
  // the party size, and the completion line fires for all of them at once.
  const subs = Array.from({ length: 20 }, (_, i) => sub(i + 1, { party: 20, at: i * 300 }));
  assert.equal(coopProgress(subs, PER_KILL).current, 1);
});

test('two members grinding the same boss SEPARATELY still count twice', () => {
  const subs = [sub(1, { rsn: 'alice' }), sub(2, { rsn: 'bob', at: 1000 })];
  assert.equal(coopProgress(subs, PER_KILL).current, 2, 'solo kills never merge');
});

test('a solo kill is not swallowed by a nearby shared one', () => {
  const subs = [
    sub(1, { rsn: 'alice', group: ['bob'], party: 2 }),
    sub(2, { rsn: 'bob', group: ['alice'], party: 2, at: 500 }),
    sub(3, { rsn: 'carol', at: 900 }), // off doing it alone
  ];
  assert.equal(coopProgress(subs, PER_KILL).current, 2);
});

test('successive shared kills outside the window are separate runs', () => {
  const hour = 60 * 60 * 1000;
  const subs = [
    sub(1, { rsn: 'alice', group: ['bob'], party: 2 }),
    sub(2, { rsn: 'bob', group: ['alice'], party: 2, at: 300 }),
    sub(1, { rsn: 'alice', group: ['bob'], party: 2, at: hour }),
    sub(2, { rsn: 'bob', group: ['alice'], party: 2, at: hour + 300 }),
  ];
  assert.equal(coopProgress(subs, PER_KILL).current, 2);
});

test('a late report (offline retry) still joins its kill', () => {
  const subs = [
    sub(1, { rsn: 'alice', group: ['bob'], party: 2 }),
    sub(2, { rsn: 'bob', group: ['alice'], party: 2, at: 9 * 60 * 1000 }),
  ];
  assert.equal(coopProgress(subs, PER_KILL).current, 1);
});

test('one-sided naming still identifies the same kill', () => {
  // Alice saw Bob; Bob's client never rendered Alice but knew the party was 2.
  const subs = [
    sub(1, { rsn: 'alice', group: ['bob'], party: 2 }),
    sub(2, { rsn: 'bob', party: 2, at: 200 }),
  ];
  assert.equal(coopProgress(subs, PER_KILL).current, 1);
});

test('only one partner running the plugin needs no collapsing', () => {
  const subs = [sub(1, { rsn: 'alice', group: ['bob'], party: 2 })];
  assert.equal(coopProgress(subs, PER_KILL).current, 1, 'one report is already the right answer');
});

// ---- minimum-teammates gate ----------------------------------------------------------------------

test('minMembers: a kill with too few of the team counts for nothing', () => {
  const duo = [
    sub(1, { rsn: 'alice', group: ['bob'], party: 2 }),
    sub(2, { rsn: 'bob', group: ['alice'], party: 2, at: 300 }),
  ];
  assert.equal(coopProgress(duo, { ...PER_KILL, minMembers: 3 }).current, 0);

  const trio = [
    ...duo,
    sub(3, { rsn: 'carol', group: ['alice', 'bob'], party: 3, at: 500 }),
  ];
  assert.equal(coopProgress(trio, { ...PER_KILL, minMembers: 3 }).current, 1);
});

test('minMembers is satisfied by NAMES when only one member runs the plugin', () => {
  // Alice reports alone but names two teammates; the site resolves them to player rows.
  const subs = [sub(1, { rsn: 'alice', group: ['bob', 'carol'], party: 3 })];
  const named = (g: string[]) => g.map((n) => ({ bob: 2, carol: 3 }[n] ?? 0)).filter(Boolean);
  const gated = coopProgress(subs, { ...PER_KILL, minMembers: 3, namedMemberIds: named });
  assert.equal(gated.current, 1);
  assert.equal(gated.runs[0].memberCount, 3);
});

test('a big raid party of strangers never satisfies the gate', () => {
  // 20 in the party, one of them ours: party size is not teammate count.
  const subs = [sub(1, { rsn: 'alice', party: 20 })];
  assert.equal(coopProgress(subs, { ...PER_KILL, minMembers: 3 }).current, 0);
  assert.equal(buildRuns(subs, { minMembers: 3 })[0].memberCount, 1);
});

test('a solo kill fails a minimum-teammates tile', () => {
  assert.equal(coopProgress([sub(1, { rsn: 'alice' })], { minMembers: 2 }).current, 0);
});

test('amounts still sum on an ungated per-member tile', () => {
  const subs = [sub(1, { amount: 3 }), sub(2, { amount: 4 })];
  assert.equal(coopProgress(subs).current, 7);
});

test('empty in, zero out', () => {
  assert.equal(coopProgress([], PER_KILL).current, 0);
  assert.deepEqual(buildRuns([]), []);
});
