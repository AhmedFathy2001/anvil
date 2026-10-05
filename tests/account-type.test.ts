// Game-mode mapping from the IRONMAN varbit (lib/accountType). Pure — no database.
//
// Run: npx tsx --test tests/account-type.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { accountTypeBadge, accountTypeFromVarbit, accountTypeLabel } from '../src/lib/accountType.ts';

test('the varbit maps onto the seven modes, and nothing else', () => {
  assert.equal(accountTypeFromVarbit(0), 'normal');
  assert.equal(accountTypeFromVarbit(3), 'hardcore');
  assert.equal(accountTypeFromVarbit(5), 'hardcore_group');
  assert.equal(accountTypeFromVarbit(6), 'unranked_group');
  assert.equal(accountTypeFromVarbit(7), null);
  assert.equal(accountTypeFromVarbit(-1), null);
  assert.equal(accountTypeFromVarbit('3'), null, 'a string is not the varbit');
  assert.equal(accountTypeFromVarbit(1.5), null);
});

test('labels and badges', () => {
  assert.equal(accountTypeLabel('ultimate'), 'Ultimate Ironman');
  assert.equal(accountTypeBadge('hardcore'), 'HCIM');
  assert.equal(accountTypeBadge('normal'), null, 'a regular account gets no badge');
  assert.equal(accountTypeBadge('nonsense'), null);
  assert.equal(accountTypeLabel(null), null);
});
