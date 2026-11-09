import assert from 'node:assert/strict';
import test from 'node:test';

import { pinLuck } from '../src/lib/pinLuck.ts';

const src = { source: 'Vorkath', bossKey: 'vorkath', denominator: 1200, rolls: 1, bundle: 1 };
const cands = [{ itemId: 21992, sources: [src] }];
const kc = () => 1204;

test('pin luck: spooned, on rate, dry, several owned, and no rate', () => {
  assert.deepEqual(pinLuck({ itemId: 21992, source: 'Vorkath', kc: 54 }, cands, kc), { text: 'Spooned · 54 KC (1/1,200)', tone: 'green' });
  assert.deepEqual(pinLuck({ itemId: 21992, source: 'Vorkath', kc: 1000 }, cands, kc), { text: '1,000 KC · on rate', tone: 'muted' });
  assert.deepEqual(pinLuck({ itemId: 21992, source: 'Vorkath', kc: 8000 }, cands, kc), { text: 'Dry · 8,000 KC (1/1,200)', tone: 'muted' });
  const many = pinLuck({ itemId: 21992, source: 'Vorkath', kc: 54, qty: 3 }, cands, kc);
  assert.equal(many?.text, '×3 in 1,204 KC');
  assert.equal(many?.tone, 'muted', 'three at 1204 KC against 1/1200 is within normal range');
  assert.deepEqual(pinLuck({ itemId: 21992, source: 'Vorkath', qty: 4 }, cands, kc), { text: '×4 in 1,204 KC', tone: 'green' });
  assert.equal(pinLuck({ itemId: 4151, source: 'X', kc: 54 }, cands, kc), null, 'no known rate: the caller falls back');
  assert.equal(pinLuck({ itemId: 21992, source: 'Vorkath', qty: 3 }, cands, () => 0), null, 'no kills known');
  assert.deepEqual(pinLuck({ itemId: 21992, source: 'Vorkath' }, cands, kc), { text: '1,204 Vorkath KC', tone: 'muted' }, 'clog sync only: the source boss and its KC now');
  assert.equal(pinLuck({ itemId: 21992, source: 'Vorkath' }, cands, () => 0), null, 'no KC at the boss either');
});
