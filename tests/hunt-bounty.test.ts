// Item hunt bounties: the pure rules (lib/itemHunt huntBountyClaims and friends, lib/huntForm,
// lib/huntDropPost's claim line).
//
// Run: npx tsx --test tests/hunt-bounty.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  bountyClaimWords,
  bountyFromInput,
  bountyLadderWords,
  huntBountyBoard,
  huntBountyClaims,
  huntBountyKey,
  huntBountyTotal,
  huntFromInput,
  taperBounty,
  unconfirmedBountyDrops,
  type HuntConfig,
  type HuntDrop,
} from '../src/lib/itemHunt.ts';
import { huntFormFromConfig, huntPayload } from '../src/lib/huntForm.ts';
import { bountyClaimLine, huntDropEmbed } from '../src/lib/huntDropPost.ts';

const M = 1_000_000;
const BARON = 28248;
const JAR = 28250;
const OPEN = { startMs: 0, endMs: null };

const config = (over: Partial<HuntConfig> = {}): HuntConfig => ({
  v: 2,
  target: 'items',
  petGroup: null,
  rule: 'first',
  ends: { kind: 'date' },
  confirm: 'staff',
  killsOf: null,
  xpSkill: null,
  items: [
    { id: BARON, name: 'Baron', sources: [], count: 'drops', pet: true, stat: null, bounty: [20 * M, 10 * M, 5 * M] },
    { id: JAR, name: 'Jar of spirits', sources: [], count: 'drops', stat: null, bounty: [5 * M] },
    { id: 1, name: 'Plain', sources: [], count: 'drops', stat: null },
  ],
  ...over,
});

let nextId = 1;
const drop = (rsnKey: string, itemId: number, at: string, over: Partial<HuntDrop> = {}): HuntDrop => ({
  id: nextId++,
  rsnKey,
  itemId,
  itemName: itemId === BARON ? 'Baron' : 'Jar of spirits',
  quantity: 1,
  source: null,
  kc: null,
  xp: null,
  statSkill: null,
  statBasis: null,
  occurredAt: at,
  origin: 'plugin',
  status: 'counted',
  confirmed: false,
  flagReason: null,
  approvedBy: null,
  screenshotUrl: null,
  note: null,
  ...over,
});

test('a bounty is stored as the list of places it pays', () => {
  assert.deepEqual(bountyFromInput(20 * M), [20 * M], 'a single number pays only the first');
  assert.deepEqual(bountyFromInput([20 * M, 10 * M, 5 * M]), [20 * M, 10 * M, 5 * M]);
  assert.deepEqual(bountyFromInput([20 * M, 0, 5 * M]), [20 * M], 'the list ends at the first place with no amount');
  assert.equal(bountyFromInput([]), undefined);
  assert.equal(bountyFromInput(null), undefined);
  assert.equal(bountyFromInput(Array(20).fill(M))?.length, 10, 'at most ten places');
  assert.deepEqual(bountyFromInput([1.9 * M]), [1_900_000]);
});

test('the editor’s taper fills the list: half less each place by default, or the same for all', () => {
  assert.deepEqual(taperBounty(20 * M, 3, 50), [20 * M, 10 * M, 5 * M]);
  assert.deepEqual(taperBounty(20 * M, 3, null), [20 * M, 20 * M, 20 * M]);
  assert.deepEqual(taperBounty(10 * M, 3, 25), [10 * M, 7_500_000, 5_625_000]);
  assert.deepEqual(taperBounty(20 * M, 1, 50), [20 * M]);
  assert.deepEqual(taperBounty(0, 3, 50), []);
  assert.deepEqual(taperBounty(3_333_333, 2, 50), [3_333_000, 1_667_000], 'rounded to a thousand');
});

test('a hunt keeps each row’s bounty through the server parse and the form', () => {
  const parsed = huntFromInput({ v: 2, rule: 'first', items: [{ id: BARON, name: 'Baron', bounty: [20 * M, 10 * M] }, { id: 4151, name: 'Abyssal whip', anySource: true }] });
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.config.items[0].bounty, [20 * M, 10 * M]);
  assert.equal(parsed.config.items[1].bounty, undefined);
  assert.equal(huntBountyTotal(parsed.config), 30 * M);
  const form = huntFormFromConfig(parsed.config);
  assert.deepEqual(form.items[0].bounty, [20 * M, 10 * M]);
  assert.deepEqual(form.items[1].bounty, []);
  const back = huntPayload(form);
  assert.deepEqual((back.items[0] as { bounty?: number[] }).bounty, [20 * M, 10 * M]);
  assert.equal('bounty' in back.items[1], false);
  assert.notEqual(huntBountyKey(parsed.config), huntBountyKey({ ...parsed.config, items: [{ ...parsed.config.items[0], bounty: [25 * M] }, parsed.config.items[1]] }), 'a change is seen');
});

test('the first counted drop of an item claims its bounty; later places go in order, once per player', () => {
  const drops = [
    drop('minyol', BARON, '2026-11-20T10:00:00Z'),
    drop('minyol', BARON, '2026-11-20T11:00:00Z'), // their second Baron is not the second place
    drop('bravo', BARON, '2026-11-20T12:00:00Z'),
    drop('carol', BARON, '2026-11-20T13:00:00Z'),
    drop('dave', BARON, '2026-11-20T14:00:00Z'), // past the three it pays
    drop('bravo', JAR, '2026-11-20T09:00:00Z'),
    drop('minyol', JAR, '2026-11-20T15:00:00Z'), // a later jar wins nothing
  ];
  const claims = huntBountyClaims(config(), drops, OPEN);
  assert.deepEqual(
    claims.map((c) => [c.itemName, c.place, c.rsnKey, c.amount]),
    [
      ['Baron', 1, 'minyol', 20 * M],
      ['Baron', 2, 'bravo', 10 * M],
      ['Baron', 3, 'carol', 5 * M],
      ['Jar of spirits', 1, 'bravo', 5 * M],
    ],
  );
});

test('places go by when it happened, not when it was filed', () => {
  const late = drop('bravo', BARON, '2026-11-20T12:00:00Z');
  const early = drop('carol', BARON, '2026-11-20T08:00:00Z'); // a later id, an earlier drop
  assert.deepEqual(huntBountyClaims(config(), [late, early], OPEN).map((c) => [c.rsnKey, c.place]), [['carol', 1], ['bravo', 2]]);
});

test('a held or waiting drop claims nothing until approved; a rejected first drop lets the next one claim', () => {
  const first = drop('minyol', JAR, '2026-11-20T10:00:00Z', { status: 'rejected' });
  const held = drop('bravo', JAR, '2026-11-20T11:00:00Z', { status: 'review' });
  const proof = drop('carol', JAR, '2026-11-20T11:30:00Z', { status: 'pending', origin: 'manual' });
  const next = drop('dave', JAR, '2026-11-20T12:00:00Z');
  assert.deepEqual(huntBountyClaims(config(), [first, held, proof, next], OPEN).map((c) => c.rsnKey), ['dave']);
  // Staff approve the held one: being earlier, it takes the bounty.
  assert.deepEqual(huntBountyClaims(config(), [first, { ...held, status: 'counted' }, proof, next], OPEN).map((c) => c.rsnKey), ['bravo']);
});

test('only the players who can be paid claim, and a drop outside the hunt claims nothing', () => {
  const drops = [drop('guest', JAR, '2026-11-20T10:00:00Z'), drop('bravo', JAR, '2026-11-20T11:00:00Z')];
  assert.deepEqual(huntBountyClaims(config(), drops, OPEN, new Set(['bravo'])).map((c) => c.rsnKey), ['bravo']);
  const window = { startMs: Date.parse('2026-11-20T10:30:00Z'), endMs: null };
  assert.deepEqual(huntBountyClaims(config(), drops, window).map((c) => c.rsnKey), ['bravo']);
});

test('the settle waits on unconfirmed drops behind a claim, unless plugin drops count automatically', () => {
  const d = drop('bravo', JAR, '2026-11-20T11:00:00Z');
  const claims = huntBountyClaims(config(), [d], OPEN);
  assert.deepEqual(unconfirmedBountyDrops(config(), claims, [d]).map((x) => x.id), [d.id]);
  assert.deepEqual(unconfirmedBountyDrops(config(), claims, [{ ...d, confirmed: true }]), []);
  assert.deepEqual(unconfirmedBountyDrops(config({ confirm: 'auto' }), claims, [d]), []);
});

test('the page, the panel and the posts say it the same way', () => {
  const drops = [drop('minyol', BARON, '2026-11-20T10:00:00Z')];
  const board = huntBountyBoard(config(), drops, OPEN, (k) => (k === 'minyol' ? 'Minyol' : k));
  assert.deepEqual(board.map((b) => [b.name, b.claimedBy]), [['Baron', ['Minyol']], ['Jar of spirits', []]]);
  const gp = (n: number) => `${n / M}m`;
  assert.equal(`Baron · ${bountyLadderWords(board[0].amounts, gp)} · ${bountyClaimWords(board[0].amounts, board[0].claimedBy)}`, 'Baron · 20m / 10m / 5m · 1 of 3 claimed (Minyol)');
  assert.equal(bountyClaimWords([5 * M], []), 'open');
  assert.equal(bountyClaimWords([5 * M], ['Bravo']), 'claimed (Bravo)');

  assert.equal(bountyClaimLine({ place: 2, itemName: 'Baron', amount: 10 * M, hcw: false }), '+ claims 2nd Baron bounty: 10m');
  assert.equal(bountyClaimLine({ place: 1, itemName: 'Baron', amount: 20 * M, hcw: true }), '+ claims the Baron bounty: 20m HCW gp');
  const e = huntDropEmbed({
    clanId: 1, title: 'DT2 pets', kind: 'Item hunt', rule: 'first', huntIconUrl: null, rsn: 'Bravo', itemId: BARON, itemName: 'Baron', quantity: 1,
    source: null, stat: null, origin: 'plugin', count: 1, place: 2, endDate: '2026-12-01T00:00:00Z', imageUrl: null,
    bounty: { place: 2, itemName: 'Baron', amount: 10 * M, hcw: false },
  });
  assert.equal(e.description, '**Bravo** got **Baron**.\n💰 **+ claims 2nd Baron bounty: 10m**');
});
