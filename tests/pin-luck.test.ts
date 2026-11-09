import assert from 'node:assert/strict';
import test from 'node:test';

import { pinLuck } from '../src/lib/pinLuck.ts';

const src = { source: 'Vorkath', bossKey: 'vorkath', denominator: 1200, rolls: 1, bundle: 1 };
const cands = [{ itemId: 21992, sources: [src] }];
const kc = () => 1204;

test('pin luck: spooned, on rate, dry, no drop KC shows no KC, and no rate', () => {
  assert.deepEqual(pinLuck({ itemId: 21992, source: 'Vorkath', kc: 54 }, cands, kc), { text: 'Spooned · 54 KC (1/1,200)', tone: 'green' });
  assert.deepEqual(pinLuck({ itemId: 21992, source: 'Vorkath', kc: 1000 }, cands, kc), { text: '1,000 KC · on rate', tone: 'muted' });
  assert.deepEqual(pinLuck({ itemId: 21992, source: 'Vorkath', kc: 8000 }, cands, kc), { text: 'Dry · 8,000 KC (1/1,200)', tone: 'muted' });
  // Several owned with a drop KC: judged at that drop KC (the only KC ever shown is a real drop KC).
  assert.deepEqual(pinLuck({ itemId: 21992, source: 'Vorkath', kc: 54, qty: 3 }, cands, kc), { text: 'Spooned · 54 KC (1/1,200)', tone: 'green' });
  assert.equal(pinLuck({ itemId: 21992, source: 'Vorkath', qty: 4 }, cands, kc), null, 'no drop KC: no KC shown (the caller shows ×4 owned)');
  assert.equal(pinLuck({ itemId: 4151, source: 'X', kc: 54 }, cands, kc), null, 'no known rate: the caller falls back');
  assert.equal(pinLuck({ itemId: 21992, source: 'Vorkath' }, cands, kc), null, 'clog sync only: never today\'s KC as if it were the drop KC');
});
