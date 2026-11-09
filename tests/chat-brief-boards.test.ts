import { test } from 'node:test';
import assert from 'node:assert/strict';

import { composeBrief } from '../src/lib/chatBrief';

const o = (name: string, rank: number | null, of: number, done: number, total: number) => ({ name, rank, of, done, total, points: false });

test('the brief names every live board compactly, with no rank where hidden, and caps with +N more', () => {
  const f = {
    bingo: { name: 'Lab session #12', rank: 185, teams: 201, nearly: [] },
    others: [o('Lab session #11', null, 0, 5, 9), o('Chat Test', null, 0, 1, 9)],
    weeklies: [{ label: 'BOTW Zulrah', unit: 'KC' as const, rank: 47, gained: 0, ahead: null }],
    clanEvents: [], goal: null,
  };
  const lines = composeBrief(['bingo', 'weekly'], f);
  assert.equal(lines.length, 1);
  assert.ok(lines[0].text.startsWith('3 boards live: Lab session #12 185th/201 · Lab session #11 5/9 tiles · Chat Test 1/9 tiles'));
  assert.ok(lines[0].text.includes('BOTW Zulrah: 47th with 0 KC'));
  const many = composeBrief(['bingo'], { ...f, others: [1, 2, 3, 4, 5].map((i) => o(`B${i}`, null, 0, i, 9)) });
  assert.ok(many[0].text.endsWith('+2 more'));
  // One board stays as it was.
  assert.equal(composeBrief(['bingo'], { ...f, others: [] })[0].text, 'Lab session #12 is live: your team is 185th of 201');
});
