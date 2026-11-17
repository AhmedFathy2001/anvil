// A quick-add line's own name, and a spoken list as lines (lib/quickAddLine). Pure.
//
// Run: npx tsx --test tests/quick-add-line.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { numberWordsToDigits, splitLineName, spokenToLines } from '../src/lib/quickAddLine.ts';

test('a line can name its tile, three ways', () => {
  assert.deepEqual(splitLineName('25 rumours called Rumour mill'), { text: '25 rumours', name: 'Rumour mill' });
  assert.deepEqual(splitLineName('50 raid kc named Raid night.'), { text: '50 raid kc', name: 'Raid night' });
  assert.deepEqual(splitLineName('50 toa, name it Sand trip'), { text: '50 toa', name: 'Sand trip' });
  assert.deepEqual(splitLineName('25 rumours "Rumour mill"'), { text: '25 rumours', name: 'Rumour mill' });
  assert.deepEqual(splitLineName('Rumour mill: 25 rumours'), { text: '25 rumours', name: 'Rumour mill' });
});

test('a line with no name is left exactly as it was', () => {
  for (const line of ['25 Hunter rumours', '5 CoX or ToB, no Entry Mode', 'CoX or ToB: any mode', 'points: 500 2 zenytes', '150 herbiboars', 'called', 'Zulrah: no pets']) {
    assert.deepEqual(splitLineName(line), { text: line, name: null }, line);
  }
});

test('number words become digits', () => {
  assert.equal(numberWordsToDigits('twenty five rumours'), '25 rumours');
  assert.equal(numberWordsToDigits('twenty-five rumours'), '25 rumours');
  assert.equal(numberWordsToDigits('a hundred and fifty herbiboars'), '150 herbiboars');
  assert.equal(numberWordsToDigits('two thousand five hundred tithe farm points'), '2500 tithe farm points');
  assert.equal(numberWordsToDigits('five cox or tob'), '5 cox or tob');
  assert.equal(numberWordsToDigits('50 toa'), '50 toa');
  assert.equal(numberWordsToDigits('one million gp'), '1000000 gp');
  assert.equal(numberWordsToDigits('kill a jad'), 'kill a jad');
  assert.equal(numberWordsToDigits('fifty, then ten'), '50, then 10');
});

test('a spoken list becomes lines', () => {
  assert.deepEqual(spokenToLines('Twenty five rumours next fifty raid kc next fifty toa.'), ['25 rumours', '50 raid kc', '50 toa']);
  assert.deepEqual(spokenToLines('25 rumours called rumour mill. New line, a hundred and fifty herbiboars for twenty points'), ['25 rumours called rumour mill', '150 herbiboars – 20 pts']);
  assert.deepEqual(spokenToLines('five cox worth 30 points; next tile ten zulrah'), ['5 cox – 30 pts', '10 zulrah']);
  assert.deepEqual(spokenToLines('   '), []);
  assert.deepEqual(spokenToLines('next next'), []);
});

test('a whole line: task, points and name in either order', async () => {
  const { parseBulkLine } = await import('../src/lib/taskMatch.ts');
  const { readQuickLine } = await import('../src/lib/quickAddLine.ts');
  const read = (l: string) => readQuickLine(l, parseBulkLine);
  assert.deepEqual(read('25 rumours called Rumour mill 20 points'), { text: '25 rumours', points: 20, name: 'Rumour mill' });
  assert.deepEqual(read('25 rumours 20 points called Rumour mill'), { text: '25 rumours', points: 20, name: 'Rumour mill' });
  assert.deepEqual(read('25 rumours – 20 pts'), { text: '25 rumours', points: 20, name: null });
  assert.deepEqual(read('Rumour mill: 25 rumours – 20 pts'), { text: '25 rumours', points: 20, name: 'Rumour mill' });
  assert.deepEqual(read('50 toa'), { text: '50 toa', points: null, name: null });
  // Spoken on a points board: the number words, then the points, then the name.
  const [line] = spokenToLines('twenty five rumours thirty points called rumour mill');
  assert.deepEqual(read(line), { text: '25 rumours', points: 30, name: 'rumour mill' });
  const [worth] = spokenToLines('fifty toa worth a hundred points');
  assert.deepEqual(read(worth), { text: '50 toa', points: 100, name: null });
});
