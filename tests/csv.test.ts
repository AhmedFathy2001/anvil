import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, toCsv } from '../src/lib/csv.ts';

test('cells are quoted, quotes doubled, empties kept', () => {
  assert.equal(csvCell('The "AFK" Spot'), '"The ""AFK"" Spot"');
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell(42), '"42"');
});

test('a cell a spreadsheet would run as a formula is kept as text', () => {
  assert.equal(csvCell('=HYPERLINK("http://x")'), '"\'=HYPERLINK(""http://x"")"');
  assert.equal(csvCell('+1'), '"\'+1"');
  assert.equal(csvCell('@name'), '"\'@name"');
  assert.equal(csvCell('-5'), '"\'-5"');
  assert.equal(csvCell('a-b'), '"a-b"');
});

test('rows end with CRLF, the head first', () => {
  assert.equal(toCsv(['a', 'b'], [[1, 'x']]), '"a","b"\r\n"1","x"\r\n');
});
