// Death killers the plugin only inferred from the fight (lib/deathSource): kept when a boss, else dropped.
// Pure — no database.
//
// Run: npx tsx --test tests/death-source.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foughtBoss, settleDeathSource, shownKiller } from '../src/lib/deathSource';

test('a fought boss is kept under its own name', () => {
  const raw: Record<string, unknown> = { kind: 'death', source: 'Alchemical Hydra', sourceKind: 'fought' };
  settleDeathSource(raw);
  assert.equal(raw.sourceKind, 'npc');
  assert.ok(typeof raw.source === 'string' && /hydra/i.test(raw.source as string));
});

test('a fought non-boss is dropped', () => {
  for (const name of ['Jug', 'Abyssal portal', '', null]) {
    const raw: Record<string, unknown> = { kind: 'death', source: name, sourceKind: 'fought' };
    settleDeathSource(raw);
    assert.equal(raw.source, null);
    assert.equal(raw.sourceKind, null);
  }
});

test('a targeted killer and other kinds are untouched', () => {
  const targeted: Record<string, unknown> = { kind: 'death', source: 'Jug', sourceKind: 'npc' };
  settleDeathSource(targeted);
  assert.deepEqual(targeted, { kind: 'death', source: 'Jug', sourceKind: 'npc' });
  const drop: Record<string, unknown> = { kind: 'drop', source: 'Jug', sourceKind: 'fought' };
  settleDeathSource(drop);
  assert.equal(drop.source, 'Jug');
});

test('foughtBoss knows aliases and ignores junk', () => {
  assert.ok(foughtBoss('Vorkath'));
  assert.equal(foughtBoss(42), null);
});

test('Death (the NPC in Death\'s Domain) is never the killer', async () => {
  const { settleDeathSource } = await import('../src/lib/deathSource');
  const raw: Record<string, unknown> = { kind: 'death', source: 'Death', sourceKind: 'npc' };
  settleDeathSource(raw);
  assert.equal(raw.source, null);
  assert.equal(raw.sourceKind, null);
  const real: Record<string, unknown> = { kind: 'death', source: 'Vorkath', sourceKind: 'npc' };
  settleDeathSource(real);
  assert.equal(real.source, 'Vorkath');
});

test("a lingering Kephri scarab is never named as the killer", () => {
  assert.equal(shownKiller('Agile Scarab'), null);
  const raw: Record<string, unknown> = { kind: 'death', source: 'Agile Scarab', sourceKind: 'npc' };
  settleDeathSource(raw);
  assert.equal(raw.source, null);
});
