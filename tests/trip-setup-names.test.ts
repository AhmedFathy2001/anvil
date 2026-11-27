// Saved trip setups' names and tags (lib/tripSetupNames), and the trip lock in lib/tripTarget. Pure.
//
// Run: npx tsx --test tests/trip-setup-names.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { cleanSetupName, cleanTag, newSetupName, presetTags } from '../src/lib/tripSetupNames.ts';
import { resolveTarget } from '../src/lib/tripTarget.ts';

test('preset tags per trip, and by boss for one picked by hand', () => {
  assert.deepEqual(presetTags('cox'), ['Solo', 'Trio', 'CM']);
  assert.deepEqual(presetTags('tob'), ['Solo', 'Duo', 'Trio', '4-5', 'Entry', 'HM']);
  assert.deepEqual(presetTags('toa'), ['Solo', 'Group', 'Expert']);
  assert.deepEqual(presetTags('m:Yama#Normal'), ['Contract 1', 'Contract 2']);
  assert.deepEqual(presetTags('vorkath'), []);
});

test('a new setup takes the first unused preset, else Setup N', () => {
  assert.deepEqual(newSetupName('cox', 'CoX', []), { name: 'CoX Solo', tag: 'Solo' });
  assert.deepEqual(newSetupName('cox', 'CoX', [{ name: 'Mine', tag: 'Solo' }]), { name: 'CoX Trio', tag: 'Trio' });
  assert.deepEqual(newSetupName('cox', 'CoX', [{ name: 'a', tag: 'Solo' }, { name: 'b', tag: 'Trio' }, { name: 'c', tag: 'CM' }]), { name: 'Setup 4', tag: null });
  assert.deepEqual(newSetupName('m:Yama', 'Yama', []), { name: 'Yama Contract 1', tag: 'Contract 1' });
  assert.deepEqual(newSetupName('vorkath', 'Vorkath', [{ name: 'Setup 2', tag: null }]), { name: 'Setup 3', tag: null });
  assert.deepEqual(newSetupName('zulrah', 'Zulrah', [{ name: 'Setup 2', tag: null }]).name, 'Setup 3');
});

test('names: 1 to 24 characters, one line, no markup; tags only the trip’s', () => {
  assert.equal(cleanSetupName('  Solo   shadow '), 'Solo shadow');
  assert.equal(cleanSetupName('<b>Hi</b>'), 'bHi/b');
  assert.equal(cleanSetupName('x'.repeat(24)), 'x'.repeat(24));
  assert.equal(cleanSetupName('x'.repeat(25)), null);
  assert.equal(cleanSetupName('   '), null);
  assert.equal(cleanSetupName(5), null);
  assert.equal(cleanTag('cox', 'CM'), 'CM');
  assert.equal(cleanTag('cox', ''), null);
  assert.equal(cleanTag('cox', 'HM'), undefined);
});

test('a lock wins over everything and never goes idle or ends with the trip', () => {
  const now = Date.now();
  const old = new Date(now - 10 * 3_600_000).toISOString();
  const kill = { vorkath: new Date(now - 1000).toISOString() };
  const lock = { lock: { key: 'toa', at: old }, clearedAt: new Date(now - 500).toISOString() };
  assert.deepEqual(resolveTarget({ state: lock, guide: null, kcTimes: kill, ownKeys: [], now }), { key: 'toa', source: 'lock' });
  assert.deepEqual(resolveTarget({ state: { lock: { key: 'm:Doom of Mokhaiotl', at: old } }, guide: null, kcTimes: {}, ownKeys: [], now }), { key: 'doom', source: 'lock' });
  assert.deepEqual(resolveTarget({ state: { clearedAt: old }, guide: null, kcTimes: kill, ownKeys: [], now }), { key: 'vorkath', source: 'last' });
});

test('card v2: the Setup dropdown, the next move as the headline, one primary button, the lock, no middle dots', async () => {
  const { tripPanelUi } = await import('../src/lib/pluginUi/tripUi.ts');
  const worn = { weapon: { id: 20997, have: 'bank' as const }, head: { id: 21018, have: 'none' as const } };
  const inventory = [{ id: 6685, have: 'here' as const }, { id: 13441, have: 'bank' as const }, ...Array(26).fill(null)];
  const d = {
    region: '13136', regionName: 'the CoX bank', content: { key: 'cox', name: 'Chambers of Xeric', short: 'CoX' }, fromRegion: true, source: 'own' as const, sourceLine: 'x', guide: { id: 3, title: 'CoX' },
    check: { rows: [{ group: 'gear' as const, ok: false, line: 'Twisted bow in your bank', item: 20997 }], info: [], unknown: [], bank: [20997], layouts: { missing: { ids: [20997], layout: [20997] }, setup: { ids: [20997], layout: [20997] } } },
    status: 'ready' as const, checkedAt: '05:27', hasOwn: true, canSave: true, options: [], monsters: [], bankFilter: true,
    layout: { worn, inventory, pouch: [], quiver: null, inBank: 2, notOwned: 1 },
    setups: [{ id: 7, name: 'Trio ranger' }], setupSel: 7 as const, setupName: 'Trio ranger', sourceShort: 'Your Trio ranger setup', summary: '1 food, 1 potion, 26 free slots.',
    plan: { preset: 'max', presets: [{ key: 'max', label: 'Max DPS' }], blurb: '' },
  };
  const json = JSON.stringify(tripPanelUi(d));
  assert.ok(json.includes('"kind":"select"') && json.includes('"label":"Trio ranger"') && json.includes('"v":"anvil"') && json.includes('"v":"new"') && json.includes('"act":"trip-setup"'));
  assert.ok(json.includes('Missing 1 you don’t own') && json.includes('And 2 to take from your bank. Checked 05:27.'), 'the dropdown names the setup: the card does not repeat it');
  assert.ok(json.includes('Show the 2 in my bank') && (json.match(/"kind":"primary"/g) ?? []).length === 1);
  assert.ok(!json.includes('"act":"trip-plan"'), 'the plan chooser only with Anvil’s loadout');
  assert.ok(json.includes('"sid":"7"'), 'Save goes into the picked setup');
  assert.ok(json.includes('"path":"/profile/setups"') && !json.includes('for how you play'));
  assert.ok(json.includes('"lock":"1"') && json.includes('"glyph":"unlock"'));
  assert.ok(!json.includes(' · '));
  const locked = JSON.stringify(tripPanelUi({ ...d, lock: { at: 'ToB' }, layout: { ...d.layout, inBank: 0, notOwned: 0 }, check: { ...d.check, rows: [] } }));
  assert.ok(locked.includes('At ToB’s bank, still checking CoX.') && locked.includes('"lock":"0"') && locked.includes('"glyph":"lock"') && locked.includes('Ready for CoX'));
  assert.ok(!locked.includes('"kind":"primary"'), 'nothing to take: no primary button');
  assert.ok(locked.includes('"s":"Bank"'), 'nothing to take: the whole setup is a Bank cell in the action row');
});

test('card v2: clan setups in the dropdown, read-only, and the CA row only with Anvil’s loadout', async () => {
  const { tripPanelUi } = await import('../src/lib/pluginUi/tripUi.ts');
  const d = {
    region: '', regionName: null, content: { key: 'zulrah', name: 'Zulrah', short: 'Zulrah' }, fromRegion: false, source: 'calc' as const, sourceLine: 'x', guide: null,
    check: { rows: [], info: [], unknown: [] }, status: 'ready' as const, checkedAt: '11:08', hasOwn: false, canSave: true, options: [], monsters: [], bankFilter: true,
    layout: { worn: {}, inventory: Array(28).fill(null), pouch: [], quiver: null, inBank: 0, notOwned: 0 },
    setups: [], clanSetups: [{ id: 41, name: 'Tanzanite', rsn: 'Zezima' }], setupSel: 'anvil' as const, setupName: null,
    plan: { preset: 'experienced', presets: [{ key: 'experienced', label: 'Experienced' }], blurb: '' },
    ca: { options: [{ id: 229, name: 'Perfect Zulrah', does: 'x' }, { id: 230, name: 'Zulrah Speed-Trialist', does: 'y' }], sel: 229, line: 'Perfect Zulrah: 3 food swapped for 2 prayer potions' },
  };
  const json = JSON.stringify(tripPanelUi(d));
  assert.ok(json.includes('"v":"c:41"') && json.includes('"label":"Tanzanite (Zezima)"') && json.includes('From your clan'));
  assert.ok(json.includes('Going for a CA?') && json.includes('"act":"trip-ca"') && json.includes('Perfect Zulrah: 3 food swapped for 2 prayer potions'));
  const clan = JSON.stringify(tripPanelUi({ ...d, setupSel: 'c:41' as const }));
  assert.ok(!clan.includes('Going for a CA?') && !clan.includes('"act":"trip-plan"'), 'a clan setup is checked as it is');
  assert.ok(!json.includes(' · ') && !clan.includes(' · '));
});
