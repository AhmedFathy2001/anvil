import { test } from 'node:test';
import assert from 'node:assert/strict';

import { filenameFromDisposition } from '../src/lib/downloadFile.ts';

test('reads the quoted, bare and encoded forms, else the fallback', () => {
  assert.equal(filenameFromDisposition('attachment; filename="a-tiles.xlsx"', 'x'), 'a-tiles.xlsx');
  assert.equal(filenameFromDisposition('attachment; filename=pack.json', 'x'), 'pack.json');
  assert.equal(filenameFromDisposition("attachment; filename*=UTF-8''my%20file.csv", 'x'), 'my file.csv');
  assert.equal(filenameFromDisposition(null, 'fallback.bin'), 'fallback.bin');
  assert.equal(filenameFromDisposition('attachment', 'fallback.bin'), 'fallback.bin');
});
