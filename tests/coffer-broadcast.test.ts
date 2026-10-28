// The coffer's clan-chat line, pure (lib/cofferBroadcastParse).
//
// Run: node --experimental-strip-types --test tests/coffer-broadcast.test.ts

import assert from 'node:assert/strict';
import test from 'node:test';

import { parseCofferBroadcast, splitDeposit } from '../src/lib/cofferBroadcastParse.ts';

test('the lines as the game writes them', () => {
  assert.deepEqual(parseCofferBroadcast('Drenvox has deposited 519 coins into the coffer.'), { actorRsn: 'Drenvox', actorKey: 'drenvox', direction: 'deposit', amount: 519 });
  assert.deepEqual(parseCofferBroadcast('Drenvox has withdrawn one coin from the coffer.'), { actorRsn: 'Drenvox', actorKey: 'drenvox', direction: 'withdrawal', amount: 1 });
  assert.equal(parseCofferBroadcast('GIM Nisbro has deposited 46,203,031 coins into the coffer.')?.amount, 46_203_031);
  assert.equal(parseCofferBroadcast('GIM_Nisbro has deposited 5 coins into the coffer.')?.actorKey, 'gim nisbro');
  assert.equal(parseCofferBroadcast('[The AFK Spot] <col=ff0000>Drenvox</col> has withdrawn 519 coins from the coffer.')?.actorRsn, 'Drenvox');
});

test('anything else that mentions the coffer is ignored', () => {
  assert.equal(parseCofferBroadcast('who has deposited 50m into the coffer lol'), null);
  assert.equal(parseCofferBroadcast('Drenvox has deposited 0 coins into the coffer.'), null);
  assert.equal(parseCofferBroadcast('Someone with a long name has deposited 5 coins into the coffer.'), null, 'no RSN is that long');
});

test('a deposit first pays back what its depositor was holding', () => {
  assert.deepEqual(splitDeposit(50_000_000, 0), { returned: 0, donated: 50_000_000 });
  assert.deepEqual(splitDeposit(50_000_000, 30_000_000), { returned: 30_000_000, donated: 20_000_000 });
  assert.deepEqual(splitDeposit(10_000_000, 30_000_000), { returned: 10_000_000, donated: 0 });
  assert.deepEqual(splitDeposit(10, -5), { returned: 0, donated: 10 });
});
