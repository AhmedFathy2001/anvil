// A pet the plugin could not name (the duplicate line names none) is named off the kill's loot, and
// never reads "Pet: pet" (lib/petName). Pure: no database.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fillForPet, isGenericPetName, momentLabel, petForSource, petLabel, petLine, unnamedPetFills, withPetName } from '../src/lib/petName.ts';
import { momentTitle } from '../src/lib/pluginUi/feedUi.ts';
import { buildPluginEmbed } from '../src/lib/pluginEmbeds.ts';
import { feedItemFromMoment } from '../src/lib/chatFeedRules.ts';

const T = Date.UTC(2026, 10, 27, 17, 11, 0);

test('generic names are no name', () => {
  for (const n of [null, undefined, '', 'pet', 'Pet', ' a pet ', 'Pet drop!']) assert.equal(isGenericPetName(n), true, String(n));
  for (const n of ['Skotos', 'Pet snakeling', 'Pet chaos elemental']) assert.equal(isGenericPetName(n), false, n);
});

test('a boss with one pet names it; none or several names nothing', () => {
  assert.deepEqual(petForSource('Skotizo'), { id: 21273, name: 'Skotos' });
  assert.deepEqual(petForSource(' skotizo '), { id: 21273, name: 'Skotos' });
  assert.equal(petForSource('Goblin'), null);
  assert.equal(petForSource(null), null);
});

test('the Skotizo case: pet line with no name or source, the kill loot a few seconds later in the same push', () => {
  const rows = [
    { kind: 'pet', itemName: null, source: null, sourceKind: null, kc: null, at: T },
    { kind: 'drop', itemName: 'Grimy snapdragon', source: 'Skotizo', sourceKind: 'npc', kc: 184, at: T + 3_000 },
  ];
  const fills = unnamedPetFills(rows);
  assert.equal(fills.size, 1);
  assert.deepEqual(fills.get(0), { itemName: 'Skotos', itemId: 21273, source: 'Skotizo', sourceKind: 'npc', kc: 184 });
});

test('its own source names it before any loot', () => {
  const fill = fillForPet({ kind: 'pet', itemName: 'pet', source: 'Skotizo', sourceKind: 'npc', kc: 10, at: T }, []);
  assert.equal(fill?.itemName, 'Skotos');
  assert.equal(fill?.kc, 10);
});

test('a named pet, loot outside the window, or loot from a boss with no single pet leaves it alone', () => {
  assert.equal(fillForPet({ kind: 'pet', itemName: 'Skotos', at: T }, [{ kind: 'drop', source: 'Vorkath', at: T + 1_000 }]), null);
  assert.equal(fillForPet({ kind: 'pet', itemName: null, at: T }, [{ kind: 'drop', source: 'Skotizo', at: T + 60_000 }]), null);
  assert.equal(fillForPet({ kind: 'pet', itemName: null, at: T }, [{ kind: 'drop', source: 'Skotizo', at: T - 60_000 }]), null);
  assert.equal(fillForPet({ kind: 'pet', itemName: null, at: T }, [{ kind: 'drop', source: 'Goblin', at: T + 1_000 }]), null);
  // A death's killer is not loot.
  assert.equal(fillForPet({ kind: 'pet', itemName: null, at: T }, [{ kind: 'death', source: 'Skotizo', at: T + 1_000 }]), null);
});

test('loot after the line beats loot just before it', () => {
  const fill = fillForPet({ kind: 'pet', itemName: null, at: T }, [
    { kind: 'drop', source: 'Vorkath', at: T - 2_000 },
    { kind: 'drop', source: 'Skotizo', at: T + 4_000 },
  ]);
  assert.equal(fill?.itemName, 'Skotos');
});

test('an unnamed pet never reads as "Pet: pet"', () => {
  const base = { id: 1, rsn: 'phantomx22x', kind: 'pet', itemId: null, quantity: 1, valueGp: null, teamId: null, tier: null, sourceKind: null, occurredAt: new Date(T).toISOString() };
  assert.equal(momentTitle({ ...base, itemName: null, source: null }), 'Pet');
  assert.equal(momentTitle({ ...base, itemName: 'pet', source: null }), 'Pet');
  assert.equal(momentTitle({ ...base, itemName: null, source: 'Skotizo' }), 'Pet from Skotizo');
  assert.equal(momentTitle({ ...base, itemName: 'Skotos', source: 'Skotizo' }), 'Pet: Skotos');
  assert.equal(petLabel({ itemName: null, source: null }), 'Pet');
  assert.equal(momentLabel({ kind: 'pet', itemName: null, source: null }), 'Pet');
  assert.equal(momentLabel({ kind: 'drop', itemName: null, source: 'Zulrah' }), 'Zulrah');
  assert.equal(petLine('Pet'), 'Pet');
  assert.equal(petLine('Pet from Skotizo'), 'Pet from Skotizo');
  assert.equal(petLine('Skotos'), 'Skotos, pet');
});

test('Discord: a source with one pet names the post; a generic name is no name', () => {
  assert.deepEqual(withPetName({ rsn: 'a', name: null, source: 'Skotizo' }), { rsn: 'a', name: 'Skotos', itemId: 21273, source: 'Skotizo' });
  assert.deepEqual(withPetName({ rsn: 'a', name: 'Vorki', source: 'Vorkath' }), { rsn: 'a', name: 'Vorki', source: 'Vorkath' });
  const built = buildPluginEmbed('pet', { rsn: 'a', name: 'pet', duplicate: true });
  assert.equal(built.ok, true);
  if (built.ok) assert.equal(built.embed.title?.includes('pet'), false);
});

test('chat feed: a generic name reads as an unnamed pet', () => {
  const item = feedItemFromMoment({ kind: 'pet', itemName: 'pet', key: 'k' }, 'phantomx22x');
  assert.ok(item);
  assert.equal(item!.text.includes(': pet'), false);
});
