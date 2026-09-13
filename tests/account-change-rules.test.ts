// Who answers when a player asks to be tracked on a different character.
//
// THE RULE FOLLOWS THE MONEY. A clan that collects its members' fees is already administering those
// members, so it answers their requests; a clan whose members paid into the host's pot handed that
// administration over with the gp. `events.cashPolicy` already says which, and the repoint
// permission this queue feeds already exists — what the queue adds is a way to ASK, and these tests
// pin who is asked.
//
// Run: npx tsx --test tests/account-change-rules.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  approverFor,
  isAccountChangeApproval,
  teamCollectsOwnFees,
} from '../src/lib/accountChangeRules.ts';

test('a clan that collects its own fees answers its own people', () => {
  assert.equal(
    approverFor({ delegated: true, cashPolicy: 'each-settles', override: 'auto' }),
    'team',
  );
  assert.equal(
    approverFor({ delegated: true, cashPolicy: 'clans-collect-host-pays', override: 'auto' }),
    'team',
    'they still collect, even though the host pays the winners',
  );
});

test('a clan whose members paid into the host pot does not', () => {
  assert.equal(approverFor({ delegated: true, cashPolicy: 'host-holds', override: 'auto' }), 'host');
});

test('a drafted team has no clan staff to answer for it, whatever the cash says', () => {
  // The same line the repoint route draws: a drafted side is drawn from several clans on somebody
  // else's board, so there is no "their own staff" to hand it to.
  assert.equal(
    approverFor({ delegated: false, cashPolicy: 'each-settles', override: 'auto' }),
    'host',
  );
  assert.equal(approverFor({ delegated: false, cashPolicy: 'each-settles', override: 'team' }), 'host');
});

test('a board may override the money, in either direction', () => {
  // Roster admin is not the cash, and a host is entitled to say "not on this one" without
  // restructuring who holds the pot.
  assert.equal(approverFor({ delegated: true, cashPolicy: 'each-settles', override: 'host' }), 'host');
  assert.equal(approverFor({ delegated: true, cashPolicy: 'host-holds', override: 'team' }), 'team');
});

test('an unrecognised policy reads as host-holds, never wider', () => {
  // An unknown string must not silently hand somebody authority; the default is also the narrower
  // of the two answers.
  assert.equal(teamCollectsOwnFees(undefined), false);
  assert.equal(teamCollectsOwnFees(null), false);
  assert.equal(teamCollectsOwnFees('something-new'), false);
  assert.equal(approverFor({ delegated: true, cashPolicy: null, override: 'auto' }), 'host');
});

test('only the three overrides are overrides', () => {
  assert.equal(isAccountChangeApproval('auto'), true);
  assert.equal(isAccountChangeApproval('host'), true);
  assert.equal(isAccountChangeApproval('team'), true);
  assert.equal(isAccountChangeApproval('admin'), false);
  assert.equal(isAccountChangeApproval(null), false);
});
