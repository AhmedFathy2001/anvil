// Supporter flair in the plugin panel: builders mark names, one pass colours the supporters.
//
// Run: npx tsx --test tests/supporter-flair.test.ts (no database).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applyFlair, col, icon, nameText, namesIn, row, text, type Node } from '../src/lib/pluginUi/nodes.ts';
import { SUPPORTER_INK } from '../src/lib/supporterTiers.ts';

const tree = (): Node =>
  col([
    row(undefined, nameText('Zezima', 'white', { font: 'bold' }), undefined),
    { t: 'tabs', key: 'k', tabs: [{ label: 'A', c: col([nameText('Lynx Titan')]) }] },
    { t: 'slot', id: 's', c: text('x'), panes: { p: nameText('B0aty', 'white', { icon: icon({ glyph: 'swatch', color: '#ff0000' }) }) } },
    text('Not a name'),
  ]);

const ink = (name: string) => (name === 'Zezima' ? SUPPORTER_INK.champion : name === 'B0aty' ? SUPPORTER_INK.supporter : null);

test('every marked name is found, in tabs and panes too', () => {
  assert.deepEqual(namesIn(tree()).sort(), ['B0aty', 'Lynx Titan', 'Zezima']);
});

test('a supporter gets their colours and the star; nobody else changes', () => {
  const out = JSON.stringify(applyFlair(tree(), ink));
  const t = applyFlair(tree(), ink) as Extract<Node, { t: 'col' }>;
  const zez = (t.c[0] as Extract<Node, { t: 'row' }>).c as Extract<Node, { t: 'text' }>;
  assert.equal(zez.color, SUPPORTER_INK.champion.color);
  assert.deepEqual(zez.grad, SUPPORTER_INK.champion.grad);
  assert.equal((zez.icon as Extract<Node, { t: 'icon' }>).glyph, 'star');
  assert.equal(zez.iconAfter, true);
  assert.ok(!out.includes('"who"'), 'the marks never reach the plugin');
  const lynx = (((t.c[1] as Extract<Node, { t: 'tabs' }>).tabs[0] as { c: Node }).c as Extract<Node, { t: 'col' }>).c[0] as Extract<Node, { t: 'text' }>;
  assert.equal(lynx.color, 'white');
  assert.equal(lynx.icon, undefined);
});

test('a name with its own icon keeps it (a team swatch is information)', () => {
  const t = applyFlair(tree(), ink) as Extract<Node, { t: 'col' }>;
  const boaty = (t.c[2] as Extract<Node, { t: 'slot' }>).panes!.p as Extract<Node, { t: 'text' }>;
  assert.equal(boaty.color, SUPPORTER_INK.supporter.color);
  assert.equal((boaty.icon as Extract<Node, { t: 'icon' }>).glyph, 'swatch');
  assert.equal(boaty.grad, undefined, 'the base tier is a solid gold');
  assert.equal(boaty.move, undefined);
  assert.equal((applyFlair(nameText('P'), () => SUPPORTER_INK.patron) as Extract<Node, { t: 'text' }>).move, true, 'Patron moves');
});

test('tiersByName re-keys normalised tiers by the names as the page spells them', async () => {
  const { tiersByName } = await import('../src/lib/supporterTiers.ts');
  const norm = (n: string) => n.replace(/_/g, ' ').toLowerCase();
  const tiers = new Map([['lynx titan', 'patron' as const], ['zezima', 'supporter' as const]]);
  assert.deepEqual(tiersByName(['Lynx_Titan', 'Zezima', 'B0aty'], tiers, norm), { Lynx_Titan: 'patron', Zezima: 'supporter' });
  assert.deepEqual(tiersByName([], tiers, norm), {});
});

test('the star says which tier, after anything the name already explained', () => {
  const tip = (n: Node) => (n as Extract<Node, { t: 'text' }>).tip;
  assert.equal(tip(applyFlair(nameText('P'), () => ({ ...SUPPORTER_INK.patron, label: 'Anvil Patron' }))), 'Anvil Patron');
  assert.equal(tip(applyFlair(nameText('P', 'white', { tip: 'Look them up' }), () => ({ ...SUPPORTER_INK.patron, label: 'Anvil Patron' }))),
    'Anvil Patron · Look them up');
  assert.equal(tip(applyFlair(nameText('P'), () => SUPPORTER_INK.supporter)), 'Anvil Supporter', 'no label: the generic name');
});
