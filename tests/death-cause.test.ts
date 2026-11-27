import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deathCause, settleDeathSource } from '@/lib/deathSource';

test('a poison or venom death names the poison, and the culprit when there is one', () => {
  assert.equal(deathCause('Lizardman shaman', 'poison'), 'poison (Lizardman shaman)');
  assert.equal(deathCause('Zulrah', 'venom'), 'venom (Zulrah)');
  assert.equal(deathCause(null, 'poison'), 'poison');
  assert.equal(deathCause('Vorkath', 'npc'), 'Vorkath');
  assert.equal(deathCause(null, 'npc'), null);
});

test('settling keeps a poison death a poison death', () => {
  const raw: Record<string, unknown> = { kind: 'death', source: 'Lizardman shaman', sourceKind: 'poison', regionId: 5277 };
  settleDeathSource(raw);
  assert.equal(raw.source, 'Lizardman shaman');
  assert.equal(raw.sourceKind, 'poison');
  assert.equal(raw.raid, undefined);
});
