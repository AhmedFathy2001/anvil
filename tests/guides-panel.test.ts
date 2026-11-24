// The plugin's Guides views (pluginUi/guidesUi): only node types the plugin already draws, phase-2
// pieces only behind the version gate, text only, a way back from every guide view, and every guide
// opening — with setups or without.
//
// Run: npx tsx --test tests/guides-panel.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { guideGoneUi, guidePanelUi, guidesSearchUi, nextUpUi, type GuidePanelData, type GuidesSearchData } from '../src/lib/pluginUi/guidesUi.ts';
import { bodySections, plainLine, sectionsForTier, textTiers } from '../src/lib/pluginUi/guideBody.ts';
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
const texts = (n: Node) => {
  const out: string[] = [];
  walk(n, (o) => {
    if (o.t === 'text' && typeof o.s === 'string' && o.s) out.push(o.s);
    if (o.t === 'text' && Array.isArray(o.runs)) out.push((o.runs as { s: string }[]).map((r) => r.s).join(''));
  });
  return out;
};
/** The first thing on the page is "‹ Title", a click back to the Guides list. */
function backTo(ui: Node): Record<string, unknown> | null {
  let first: Record<string, unknown> | null = null;
  walk(ui, (o) => {
    if (!first && o.t === 'text' && (o.icon as { glyph?: string } | undefined)?.glyph === 'chevron-left') first = o;
  });
  return first ? ((first as Record<string, unknown>).on as Record<string, unknown>) : null;
}

const BODY = `Chambers of Xeric (CoX) is a team raid. Most supplies are made **inside** the raid.

## How a raid runs
1. **Start**: the leader makes a party at the entrance board
2. **Rooms**: combat rooms, puzzle rooms and a resource room

::: beginner
## Your first raids
-# Base 75+ combat, 70+ Prayer.
- Join **learner** raids — people expect questions there
- Bring an axe and a pickaxe
https://www.youtube.com/watch?v=dQw4w9WgXcQ

::: advanced
## Speed runs
-# 99s, best-in-slot switches.
- **Challenge mode** has a timer

:::
## Etiquette
- Stay until the end`;

const DATA: GuidePanelData = {
  id: 7,
  slug: 'vorkath-guide',
  title: 'Vorkath',
  kind: 'Bossing',
  tier: 'intermediate',
  tiers: [{ key: 'beginner', label: 'Beginner' }, { key: 'intermediate', label: 'Intermediate' }, { key: 'advanced', label: 'Advanced' }],
  byline: 'by Iron Pyre +12',
  rankGlyph: 'quill-gold',
  setups: [
    { key: 'intermediate-dhcb', name: 'Ranged · DHCB', sub: 'Curator pick · 6.2 DPS', weapon: 21012, blocked: null, pick: true },
    { key: 'intermediate-dhl', name: 'Melee · DHL', sub: '5.8 DPS', weapon: 22978, blocked: null },
  ],
  current: 'intermediate-dhcb',
  dps: '6.2 DPS · ~2:05',
  usingFallbacks: "Ava's assembler for Dizana's quiver",
  slots: [{ slot: 'weapon', id: 21012, fallback: null, missing: true }, { slot: 'cape', id: 22109, fallback: "you'll use Ava's assembler", missing: false }, { slot: 'quiver', id: 28951, fallback: null, missing: false }, { slot: 'head', id: null, fallback: null, missing: false }],
  inventory: [{ id: 2434 }, null, { id: 8013, q: 10 }],
  pouch: [{ id: 556, q: 1000 }],
  spellbook: 'Standard',
  spellbookId: 0,
  spells: ['Crumble Undead'],
  hasMarkers: 12,
  missing: [{ id: 21012, name: 'Dragon hunter crossbow', price: '92m' }],
  checkedAt: '2026-11-24 10:00',
  checklist: [{ text: 'Dragon Slayer II', ok: true, pic: { quest: true } }, { text: '70 Defence', ok: false, pic: { skill: 'defence' } }, { text: 'Prayer potion(4) ×4', ok: true, pic: { item: 2434 } }],
  setupSteps: ['Pot up then fight.'],
  body: sectionsForTier(BODY, 'beginner'),
  tips: [{ text: 'Bring a spare antifire.', useful: 41 }],
  mistakes: ['Forgetting the antifire.'],
  upgrades: [{ id: 28310, name: 'Venator ring', gain: '+2%', price: '3.1m' }],
  community: [{ key: 'c3', name: 'Budget DHL', used: 41, weapon: 22978 }],
  phase2: false,
  alternatives: null,
  route: null,
};
const ALTS = { slot: 'weapon', rows: [{ id: 21012, name: 'DHCB', price: '92m', note: "guide's pick", owned: false, inUse: true, skipped: false }, { id: 11785, name: 'ACB', price: '31m', note: '-9% DPS', owned: true, inUse: false, skipped: false }], skipped: [], budget: '50', signedIn: true };
/** A raid guide: no setups at all, only its written body. */
const RAID: GuidePanelData = {
  ...DATA,
  id: 9,
  slug: 'chambers-of-xeric-learner',
  title: 'Chambers of Xeric',
  kind: 'Raids',
  tier: 'beginner',
  tiers: [{ key: 'beginner', label: 'Beginner' }, { key: 'advanced', label: 'Advanced' }],
  setups: [],
  current: null,
  slots: [],
  inventory: [],
  pouch: [],
  checklist: [],
  setupSteps: [],
  missing: null,
  upgrades: [],
  community: [],
};

test('guide panel: only node types the plugin draws; Setup | How to | Upgrades when it has setups', () => {
  const ui = guidePanelUi(DATA);
  walk(ui, (o) => assert.ok(KNOWN.has(o.t as string), `unknown node ${String(o.t)}`));
  let sections: string[] = [];
  walk(ui, (o) => {
    if (o.t === 'tabs' && String(o.key).startsWith('guide-sections')) sections = (o.tabs as { label: string }[]).map((t) => t.label);
  });
  assert.deepEqual(sections, ['Setup', 'How to', 'Upgrades']);
});

test('guide panel: every guide view has the back header to the Guides list and a site link', () => {
  const views: [string, Node][] = [
    ['setups', guidePanelUi(DATA)],
    ['no setups', guidePanelUi(RAID)],
    ['route', guidePanelUi({ ...RAID, kind: 'Progression route', tiers: [], tier: null, body: [], route: { signedIn: true, following: false, done: 1, total: 2, chapters: [{ name: 'Start', steps: [{ title: '70 Agility', item: null, why: 'Shortcuts', done: true, skipped: false }, { title: 'Fighter torso', item: 10551, why: '', done: false, skipped: false }] }] } })],
    ['gone', guideGoneUi('9023')],
  ];
  for (const [name, ui] of views) {
    walk(ui, (o) => assert.ok(KNOWN.has(o.t as string), `${name}: unknown node ${String(o.t)}`));
    const back = backTo(ui);
    assert.ok(back, `${name}: no back header`);
    assert.equal(back!.a, 'load', name);
    assert.equal(back!.v, 'guides', name);
    assert.ok(actions(ui).some((a) => a.a === 'site'), `${name}: no site link`);
  }
  // The region rides along, so "You're at" is still there on the way back.
  assert.deepEqual(backTo(guidePanelUi({ ...DATA, region: '9023' }))!.args, { region: '9023' });
  // The alternatives page goes back to the guide.
  const alt = backTo(guidePanelUi({ ...DATA, alternatives: ALTS }));
  assert.equal(alt!.a, 'load');
  assert.equal(alt!.v, 'guide');
  assert.equal((alt!.args as Record<string, string>).setup, 'intermediate-dhcb');
});

test('guide panel: a guide with no setups shows its sections, steps, notes and a video link — never a bare card', () => {
  const ui = guidePanelUi(RAID);
  const t = texts(ui);
  for (const head of ['About this guide', 'How a raid runs', 'Your first raids', 'Etiquette']) assert.ok(t.includes(head), `section ${head}`);
  assert.ok(!t.includes('Speed runs'), 'the other level stays out');
  assert.ok(t.includes('Base 75+ combat, 70+ Prayer.'), 'the -# requirement line');
  assert.ok(t.some((s) => s === 'Step 1') && t.some((s) => s.startsWith('Start: the leader')), 'numbered steps in boxes');
  assert.ok(t.some((s) => s.startsWith('•  Join learner raids')), 'bullets, marks stripped');
  assert.ok(t.includes('Watch the video on the site'));
  assert.ok(t.some((s) => s.includes('Bring a spare antifire')), 'tips');
  assert.ok(t.includes('Open the full guide on the site ↗'));
  assert.equal(t.some((s) => /no setups/i.test(s)), false);
  // Its levels as short chips that reload the guide.
  const levels = actions(ui).filter((a) => a.a === 'load' && a.v === 'guide');
  assert.deepEqual(levels.map((a) => (a.args as Record<string, string>).tier), ['beginner', 'advanced']);
  // Nothing written at all still gets a card that says so, and the way back.
  const empty = guidePanelUi({ ...RAID, body: [], tips: [], mistakes: [] });
  assert.ok(texts(empty).some((s) => s.includes('reads best on the site')));
});

test('guide panel: the alternatives are closed until a slot is clicked, then a page of their own', () => {
  const closed = guidePanelUi(DATA);
  assert.equal(actions(closed).some((a) => a.act === 'guide-skip' || a.act === 'guide-budget'), false);
  // A slot opens them as a load (a refresh then shows the same slot again).
  assert.ok(actions(closed).some((a) => a.a === 'load' && (a.args as Record<string, string> | undefined)?.alt === 'weapon'), 'slots open them');
  const open = guidePanelUi({ ...DATA, alternatives: ALTS });
  const acts = actions(open).filter((a) => a.a === 'post').map((a) => a.act);
  for (const name of ['guide-skip', 'guide-budget']) assert.ok(acts.includes(name), name);
  let tabs = 0;
  walk(open, (o) => {
    if (o.t === 'tabs') tabs++;
  });
  assert.equal(tabs, 0, 'not stacked over the tabs');
});

test('guide panel: level chips fit (short labels), the picker lists every setup, slots show their state', () => {
  const ui = guidePanelUi(DATA);
  const t = texts(ui);
  assert.ok(t.includes('Mid') && !t.some((s) => s.startsWith('Intermedi') && s.length < 12));
  // The picker: "1 of 2 ▾", then each setup loads the guide with its key.
  assert.ok(t.includes('1 of 2 ▾'));
  const picks = actions(ui).filter((a) => a.a === 'load' && a.v === 'guide').map((a) => (a.args as Record<string, string>).setup);
  assert.ok(picks.includes('intermediate-dhl'));
  // An empty slot shows the game's slot picture; a missing one its own well colour.
  let sprites = 0;
  let missingWell = false;
  walk(ui, (o) => {
    if (o.t === 'text' && (o.icon as { sprite?: number } | undefined)?.sprite === 156) sprites++;
    if (o.t === 'text' && o.chip === '#3d1f1c') missingWell = true;
  });
  assert.equal(sprites, 1);
  assert.ok(missingWell);
});

test('guide panel: phase-2 pieces only past the gate (copy action, quill glyph)', () => {
  const old = guidePanelUi(DATA);
  assert.equal(actions(old).some((a) => a.a === 'copy'), false);
  assert.ok(actions(old).some((a) => a.a === 'site' && a.path === '/guides/vorkath-guide'));
  const next = guidePanelUi({ ...DATA, phase2: true });
  const copy = actions(next).find((a) => a.a === 'copy');
  assert.ok(copy);
  assert.match(String(copy!.path), /^\/api\/plugin\/guide-export\?guide=7&setup=intermediate-dhcb&kind=banktag&mine=1$/);
});

test('guide panel: text only — no img nodes, no markup', () => {
  let imgs = 0;
  walk(guidePanelUi(RAID), (o) => {
    if (o.t === 'img') imgs++;
  });
  assert.equal(imgs, 0);
  assert.equal(texts(guidePanelUi(RAID)).some((s) => /\*\*|__|\|\||^- |^-#/.test(s)), false);
});

test('guide body: headings become sections, list marks go, headings never become steps', () => {
  const s = bodySections(`## Speed runs
-# 90+ Magic, the best mage gear you own.
- A **Sanguinesti staff** heals you
- ||spoiler|| and [a link](https://example.com) and <https://bare.example>

1. First
2. Second
![Map of the mounds](https://oldschool.runescape.wiki/images/x.png)
\`\`\`
code is left out
\`\`\``);
  assert.equal(s.length, 1);
  assert.equal(s[0].title, 'Speed runs');
  assert.equal(s[0].note, '90+ Magic, the best mage gear you own.');
  assert.deepEqual(s[0].blocks, [
    { k: 'li', s: 'A Sanguinesti staff heals you' },
    { k: 'li', s: 'spoiler and a link and' },
    { k: 'step', n: 1, s: 'First' },
    { k: 'step', n: 2, s: 'Second' },
    { k: 'img', alt: 'Map of the mounds' },
  ]);
  assert.equal(plainLine('*Protect from Magic*, hit him'), 'Protect from Magic, hit him');
  assert.deepEqual(textTiers(BODY), ['beginner', 'advanced']);
});

const SEARCH: GuidesSearchData = {
  recent: [],
  sections: [
    { label: 'Raids', rows: [{ id: 9, title: 'Chambers of Xeric', category: 'Raids', pic: { boss: 'chambersOfXeric' }, meta: '3 levels · 4 min read', by: 'by X' }] },
    { label: 'Bossing', rows: [{ id: 7, title: 'Vorkath', category: 'Bossing', pic: { item: 21012 }, meta: '3 levels · 3 setups', by: 'by X' }] },
  ],
  filters: { level: '', account: 'main', build: 'any' },
  here: null,
};

test('guides search: no switch of its own (the plugin draws it), a region card when given, a picture on every row', () => {
  assert.equal(actions(guidesSearchUi(SEARCH)).some((a) => a.a === 'tab'), false);
  const p2 = guidesSearchUi({ ...SEARCH, here: { id: 7, title: 'Vorkath', where: 'Ungael', pic: { item: 21012 } }, region: '9023' });
  assert.ok(texts(p2).includes("You're at Vorkath"));
  const opens = actions(p2).filter((a) => a.a === 'load' && a.v === 'guide');
  assert.ok(opens.length >= 3 && opens.every((a) => (a.args as Record<string, string>).region === '9023'));
  let filter: Record<string, unknown> | null = null;
  walk(guidesSearchUi(SEARCH), (o) => {
    if (o.t === 'filter') filter = o;
  });
  assert.ok(filter && (filter as Record<string, unknown>).hint, 'the box has a hint');
  // Each section is a one-column grid, so the search filters its rows.
  const lists = ((filter as unknown as { c: Node[] }).c).filter((n) => n.t === 'grid');
  assert.equal(lists.length, 2);
  for (const l of lists) for (const r of (l as { c: Node[] }).c.slice(1, -1)) assert.ok((r as { l?: { icon?: unknown } }).l?.icon, 'a picture');
});

test('guides search: three short filter chips that fit a third of the panel; choices carry the region', () => {
  const ui = guidesSearchUi({ ...SEARCH, region: '9023' });
  const chips = texts(ui).filter((s) => s.endsWith(' ▾'));
  assert.equal(chips.length, 3);
  for (const c of chips) assert.ok(c.length <= 11, `${c} fits`);
  const posts = actions(ui).filter((a) => a.a === 'post' && a.act === 'guides-filter');
  assert.ok(posts.length >= 10);
  assert.ok(posts.every((a) => (a.args as Record<string, string>).region === '9023'));
  // A choice keeps the other two filters.
  const ironman = posts.find((a) => (a.args as Record<string, string>).account === 'ironman')!;
  assert.deepEqual(ironman.args, { level: '', account: 'ironman', build: 'any', region: '9023' });
  assert.ok(actions(guidesSearchUi(SEARCH)).filter((a) => a.act === 'guides-filter').every((a) => !(a.args as Record<string, string>).region));
});

test('You tab guides card: a section with the route, else recent guides and a way to Lookup › Guides, else nothing', () => {
  const route = nextUpUi({ route: { id: 9, slug: 'ironman-first-100-hours', title: 'Ironman: the first 100 hours' }, done: 14, total: 42, lastDone: { title: "Ava's accumulator", icon: 10499, source: 'from the plugin' }, next: [{ title: '70 Agility', icon: null, line: 'Shortcuts', reqs: [{ text: 'Agility 64/70', met: false }] }], recent: [], followed: [{ id: 9, title: 'A' }, { id: 10, title: 'B' }] })!;
  walk(route, (o) => assert.ok(KNOWN.has(o.t as string)));
  let bar = 0;
  walk(route, (o) => {
    if (o.t === 'bar') bar = o.pct as number;
  });
  assert.equal(bar, 33);
  assert.ok(texts(route).includes('Next up'));
  assert.ok(actions(route).some((a) => a.act === 'guide-route' && a.into === 'guide-next'));
  const recent = nextUpUi({ route: null, done: 0, total: 0, lastDone: null, next: [], recent: [{ id: 7, title: 'Vorkath', category: 'bossing', pic: { item: 21012 }, meta: '3 levels', by: '' }], followed: [] })!;
  assert.ok(texts(recent).includes('Guides'));
  assert.ok(actions(recent).some((a) => a.a === 'tab' && a.tab === 'lookup' && (a.args as Record<string, string>).mode === 'guides'));
  // The card is a section (a card with the house inset), not loose text.
  let card = false;
  walk(recent, (o) => {
    if (o.t === 'col' && o.card && o.inset === 10) card = true;
  });
  assert.ok(card);
  assert.equal(nextUpUi({ route: null, done: 0, total: 0, lastDone: null, next: [], recent: [], followed: [] }), null);
});
