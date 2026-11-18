import { test } from 'node:test';
import assert from 'node:assert/strict';

test('a coffer reading counts only for the clan the character is in, in game', async () => {
  process.env.DATABASE_URL ??= 'postgres://unused:unused@127.0.0.1:1/unused';
  const { mayReadCofferFor } = await import('../src/lib/cofferReader.ts');
  // A guest whose own clan is elsewhere (and not on Anvil at all): refused.
  assert.deepEqual(mayReadCofferFor('guest', 'The AFK Spot', 'thesyndicate'), { ok: false, why: 'other-clan' });
  // A member seat does not help once they report another clan: they moved, the roster has not caught up.
  assert.deepEqual(mayReadCofferFor('member', 'The AFK Spot', 'the guards'), { ok: false, why: 'other-clan' });
  // In this clan in game, whatever the site calls their seat. Spaces and underscores read alike.
  assert.deepEqual(mayReadCofferFor('guest', 'The AFK Spot', 'the afk spot'), { ok: true });
  assert.deepEqual(mayReadCofferFor('member', 'The_AFK  Spot', 'the afk spot'), { ok: true });
});

test('with no fresh report, only a member seat counts', async () => {
  const { mayReadCofferFor } = await import('../src/lib/cofferReader.ts');
  assert.deepEqual(mayReadCofferFor('member', 'The AFK Spot', null), { ok: true });
  assert.deepEqual(mayReadCofferFor('guest', 'The AFK Spot', null), { ok: false, why: 'guest' });
  assert.deepEqual(mayReadCofferFor(null, 'The AFK Spot', null), { ok: false, why: 'guest' });
  // A clan with no in-game name on record cannot be matched against a report: the seat decides.
  assert.deepEqual(mayReadCofferFor('member', null, 'thesyndicate'), { ok: true });
  assert.deepEqual(mayReadCofferFor('guest', null, 'thesyndicate'), { ok: false, why: 'guest' });
});
