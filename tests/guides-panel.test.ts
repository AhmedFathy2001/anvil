// The plugin's Guides views (pluginUi/guidesUi): only node types the plugin already draws, phase-2
// pieces only behind the version gate, and text only.
//
// Run: npx tsx --test tests/guides-panel.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { guidePanelUi, guidesSearchUi, nextUpUi, type GuidePanelData } from '../src/lib/pluginUi/guidesUi.ts';
import type { Node } from '../src/lib/pluginUi/nodes.ts';

const KNOWN = new Set(['col', 'row', 'grid', 'text', 'icon', 'img', 'hero', 'bar', 'tabs', 'fold', 'filter', 'slot', 'segs', 'step', 'toggle', 'warm', 'input', 'button', 'gap', 'countdown', 'native', 'feed']);

function walk(n: unknown, f: (n: Record<string, unknown>) => void) {
  if (!n || typeof n !== 'object') return;
  if (Array.isArray(n)) return n.forEach((x) => walk(x, f));
  const o = n as Record<string, unknown>;
  if (typeof o.t === 'string') f(o);
  for (const v of Object.values(o)) walk(v, f);
}
const actions = (n: Node) => {
  const out: Record<string, unknown>[] = [];
  walk(n, (o) => {
    for (const k of ['on']) if (o[k] && typeof o[k] === 'object') out.push(o[k] as Record<string, unknown>);
    if (Array.isArray(o.menu)) for (const m of o.menu as { on?: Record<string, unknown> }[]) if (m.on) out.push(m.on);
    if (Array.isArray(o.tabs)) for (const t of o.tabs as { on?: Record<string, unknown> }[]) if (t.on) out.push(t.on);
  });
  return out;
};

const DATA: GuidePanelData = {
  id: 7,
  slug: 'vorkath-guide',
  title: 'Vorkath',
  tier: 'intermediate',
  tiers: [{ key: 'beginner', label: 'Beginner' }, { key: 'intermediate', label: 'Intermediate' }],
  byline: 'by Iron Pyre +12',
  rankGlyph: 'quill-gold',
  setups: [{ key: 'intermediate-dhcb', name: 'Ranged · DHCB', sub: 'Curator pick · 6.2 DPS', weapon: 21012, blocked: null }],
  current: 'intermediate-dhcb',
  dps: '6.2 DPS · ~2:05',
  usingFallbacks: "Ava's assembler for Dizana's quiver",
  slots: [{ slot: 'weapon', id: 21012, fallback: null, missing: false }, { slot: 'cape', id: 22109, fallback: "you'll use Ava's assembler", missing: false }, { slot: 'quiver', id: 21946, fallback: null, missing: false }],
  inventory: [{ id: 2434 }, null, { id: 8013, q: 10 }],
  pouch: [{ id: 556, q: 1000 }],
  spellbook: 'Standard',
  spells: ['Crumble Undead'],
  hasMarkers: 12,
  missing: [{ id: 21012, name: 'Dragon hunter crossbow', price: '92m' }],
  checkedAt: '2026-11-24 10:00',
  checklist: [{ text: 'Dragon Slayer II', ok: true }, { text: '70 Defence', ok: false }],
  steps: ['<b>Pot up</b> then fight.'],
  tips: [{ text: 'Bring a spare antifire.', useful: 41 }],
  mistakes: ['Forgetting the antifire.'],
  upgrades: [{ id: 28310, name: 'Venator ring', gain: '+2%', price: '3.1m' }],
  community: [{ key: 'c3', name: 'Budget DHL', used: 41, weapon: 22978 }],
  phase2: false,
  alternatives: { slot: 'weapon', rows: [{ id: 21012, name: 'DHCB', price: '92m', note: "guide's pick", owned: false, inUse: true, skipped: false }, { id: 11785, name: 'ACB', price: '31m', note: '-9% DPS', owned: true, inUse: false, skipped: false }], skipped: [], budget: '50', signedIn: true },
};

test('guide panel: only node types the plugin draws; Setup | How to | Upgrades tabs', () => {
  const ui = guidePanelUi(DATA);
  walk(ui, (o) => assert.ok(KNOWN.has(o.t as string), `unknown node ${String(o.t)}`));
  let sections: string[] = [];
  walk(ui, (o) => {
    if (o.t === 'tabs' && String(o.key).startsWith('guide-sections')) sections = (o.tabs as { label: string }[]).map((t) => t.label);
  });
  assert.deepEqual(sections, ['Setup', 'How to', 'Upgrades']);
});

test('guide panel: phase-2 pieces only past the gate (copy action, quill glyph)', () => {
  const old = guidePanelUi(DATA);
  assert.equal(actions(old).some((a) => a.a === 'copy'), false);
  // Below the gate the copy buttons fall back to a site link.
  assert.ok(actions(old).some((a) => a.a === 'site' && a.path === '/guides/vorkath-guide'));
  const next = guidePanelUi({ ...DATA, phase2: true });
  const copy = actions(next).find((a) => a.a === 'copy');
  assert.ok(copy);
  assert.match(String(copy!.path), /^\/api\/plugin\/guide-export\?guide=7&setup=intermediate-dhcb&kind=banktag&mine=1$/);
});

test('guide panel: alternatives skip and budget are post actions the plugin already sends', () => {
  const acts = actions(guidePanelUi(DATA)).filter((a) => a.a === 'post').map((a) => a.act);
  for (const name of ['guide-pick', 'guide-alt', 'guide-skip', 'guide-budget']) assert.ok(acts.includes(name), name);
});

test('guide panel: text only — markup in steps reaches the plugin as plain characters, never a tag it renders', () => {
  const texts: string[] = [];
  walk(guidePanelUi(DATA), (o) => {
    if (o.t === 'text' && typeof o.s === 'string') texts.push(o.s);
  });
  assert.ok(texts.some((t) => t.includes('Pot up')));
  // The plugin draws text nodes as text; nothing here is an img node pointing anywhere.
  let imgs = 0;
  walk(guidePanelUi(DATA), (o) => {
    if (o.t === 'img') imgs++;
  });
  assert.equal(imgs, 0);
});

test('guides search: the Players | Guides switch only past the gate; region card when given', () => {
  const base = { rows: [], recent: [], sections: [{ label: 'Bossing', rows: [{ id: 7, title: 'Vorkath', category: 'Bossing', icon: 21012, meta: '3 levels', by: 'by X' }] }], filters: { level: '', account: '', build: 'any' }, here: null, phase2: false };
  assert.equal(actions(guidesSearchUi(base)).some((a) => a.a === 'tab'), false);
  const p2 = guidesSearchUi({ ...base, phase2: true, here: { id: 7, title: 'Vorkath', where: 'Ungael', icon: 21012 } });
  assert.ok(actions(p2).some((a) => a.a === 'tab' && a.tab === 'lookup'));
  assert.ok(actions(p2).some((a) => a.a === 'load' && a.v === 'guide'));
});

test('next up card: progress, done step, next steps, route switch', () => {
  const ui = nextUpUi({ route: { id: 9, slug: 'ironman-first-100-hours', title: 'Ironman: the first 100 hours' }, done: 14, total: 42, lastDone: { title: "Ava's accumulator", icon: 10499, source: 'from the plugin' }, next: [{ title: '70 Agility', icon: null, line: 'Shortcuts', reqs: [{ text: 'Agility 64/70', met: false }] }], recent: [], followed: [{ id: 9, title: 'A' }, { id: 10, title: 'B' }] });
  walk(ui, (o) => assert.ok(KNOWN.has(o.t as string)));
  let bar = 0;
  walk(ui, (o) => {
    if (o.t === 'bar') bar = o.pct as number;
  });
  assert.equal(bar, 33);
  assert.ok(actions(ui).some((a) => a.act === 'guide-route'));
});
