import { test } from 'node:test';
import assert from 'node:assert/strict';
import { huntStampModel, utcWords } from '@/lib/huntStamp';

const at = Date.UTC(2026, 10, 28, 1, 2, 3);
const base = { competition: 'Boss Rush: Raids', rush: true, rsn: 'dead person', recordedAt: at, stampedAt: at + 4000, id: 7, sha256: 'abcdef0123456789ff' };

test('a drop stamp is the server record of it', () => {
  const m = huntStampModel({ ...base, kind: 'drop', item: 'Vial of blood', quantity: 50, source: 'Theatre of Blood', split: 0.5 });
  assert.equal(m.title, 'BOSS RUSH DROP');
  assert.equal(m.detail, 'Vial of blood x50');
  assert.deepEqual(m.meta, ['RSN: dead person', 'Event: Boss Rush: Raids', 'From: Theatre of Blood', 'Recorded: 2026-11-28 01:02:03 UTC', 'Stamped: 2026-11-28 01:02:07 UTC']);
  assert.equal(m.footer, 'Drop #7, sha256 abcdef012345, stamped by Anvil');
  assert.equal(m.split, 0.5);
});

test('a death stamp names the killer when there is one', () => {
  assert.equal(huntStampModel({ ...base, kind: 'death', source: 'Zebak', split: null }).detail, 'Died to Zebak');
  const m = huntStampModel({ ...base, kind: 'death', source: null, split: null, rush: false });
  assert.equal(m.detail, 'Died');
  assert.equal(m.title, 'ITEM HUNT DEATH');
  assert.ok(!m.meta.some((l) => l.startsWith('From:')));
});

test('no middle dots anywhere on a stamp', () => {
  const m = huntStampModel({ ...base, kind: 'drop', item: 'Onyx', source: 'Tekton', split: 0.5 });
  assert.ok(![m.title, m.detail, ...m.meta, m.footer].some((s) => s.includes('·')));
  assert.equal(utcWords(at), '2026-11-28 01:02:03');
});

test('a rush kill proof says which kill at which target', () => {
  const m = huntStampModel({ kind: 'kill', competition: 'Demon Rush', rush: true, rsn: 'Ann', source: 'Tormented Demon', killNumber: 25, recordedAt: 0, stampedAt: 0, id: 9, sha256: null, split: null });
  assert.equal(m.title, 'BOSS RUSH KILL');
  assert.equal(m.detail, 'Tormented Demon kill 25');
  assert.match(m.footer, /^Kill proof #9/);
});
