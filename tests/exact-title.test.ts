// Run: npx tsx --test tests/exact-title.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { exactTitle, formatNumber } from '@/lib/utils';

test('exactTitle: the exact figures behind an abbreviated "19M / 20.1M"', () => {
  assert.equal(formatNumber(19_023_122), '19.0M');
  assert.equal(exactTitle(19_023_122, 20_142_002), '19,023,122 / 20,142,002');
  assert.equal(exactTitle(1_500), '1,500');
  assert.equal(exactTitle(248, 500), undefined);
});
