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
  const lynx = ((t.c[1] as Extract<Node, { t: 'tabs' }>).tabs[0].c as Extract<Node, { t: 'col' }>).c[0] as Extract<Node, { t: 'text' }>;
  assert.equal(lynx.color, 'white');
  assert.equal(lynx.icon, undefined);
});

test('a name with its own icon keeps it (a team swatch is information)', () => {
  const t = applyFlair(tree(), ink) as Extract<Node, { t: 'col' }>;
  const boaty = (t.c[2] as Extract<Node, { t: 'slot' }>).panes!.p as Extract<Node, { t: 'text' }>;
  assert.equal(boaty.color, SUPPORTER_INK.supporter.color);
  assert.equal((boaty.icon as Extract<Node, { t: 'icon' }>).glyph, 'swatch');
  assert.equal(boaty.grad, undefined, 'the base tier is a solid gold');
});
