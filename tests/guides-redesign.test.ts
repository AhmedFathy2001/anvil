// The guides redesign's pure logic: setup fit and pills, ownership and fallbacks, ground markers,
// bank tag import, routes, writer credit, Discord selection and the XSS render paths. No database.
//
// Run: npx tsx --test tests/guides-redesign.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import { defaultSetup, guideAccountOf, guideBuildOf, setupFit, setupKey, viewerTier } from '../src/lib/guideSetups.ts';
import { equivalentsFrom, resolveSetup, personalSetup } from '../src/lib/gearOwnership.ts';
import { parseGroundMarkers, groundMarkersJson, cleanMarkerLabel } from '../src/lib/groundMarkers.ts';
import { bankGrid, parseBankTag, parseInventorySetup, parseRuneliteImport, tagToSetup } from '../src/lib/runeliteImport.ts';
import { bankLayout, bankTagString, inventorySetupJson } from '../src/lib/runeliteExport.ts';
import { parseRouteBlock, routeProgress, routeDiscordMarkdown, type RouteBlock } from '../src/lib/guideRoutes.ts';
import {
  canCurate,
  contributors,
  copyCreditLine,
  featuredWriters,
  impactBand,
  monthlyCredit,
  pieceReach,
  rankByVotes,
  voteWeight,
  writerRank,
  writtenByLine,
  type Piece,
  type Reach,
} from '../src/lib/guideCredit.ts';
import { cleanSelection, selectAll, setupSelected, type PostSelection } from '../src/lib/guideSelection.ts';
import { discordBody, indexGear } from '../src/lib/dps/summary.ts';
import { GEAR_DATA } from '../src/lib/dps/data.ts';
import { parseYouTube, youTubeEmbedUrl, youTubeLink } from '../src/lib/youtube.ts';
import { renderGuide } from '../src/lib/guideMarkdown.tsx';
import { renderGuideForDiscord } from '../src/lib/guideDiscord.ts';
import { splitSegments, type GearBlock, type GearSetup } from '../src/lib/guideTiers.ts';

const base = (over: Partial<GearSetup>): GearSetup => ({
  tier: 'intermediate',
  name: 'Setup',
  gear: {},
  style: 1,
  stats: { attack: 70, strength: 70, ranged: 70, magic: 70 },
  ...over,
});

// ── Setup fit and the default pill ─────────────────────────────────────────────────────────────

test('fit: an account type the setup is not for is greyed with the reason', () => {
  const s = base({ accounts: ['main', 'gim'] });
  assert.deepEqual(setupFit(s, { account: 'ironman' }), { ok: false, reason: 'not for Ironman' });
  assert.equal(setupFit(s, { account: 'main' }).ok, true);
  assert.equal(setupFit(s, {}).ok, true, 'no filter, no greying');
});

test('fit: an Ironman setup suits HCIM and GIM but not UIM', () => {
  const s = base({ accounts: ['ironman'] });
  assert.equal(setupFit(s, { account: 'hcim' }).ok, true);
  assert.equal(setupFit(s, { account: 'gim' }).ok, true);
  assert.equal(setupFit(s, { account: 'uim' }).ok, false);
});

test('fit: a build whose Defence cap is below the setup need is greyed', () => {
  const s = base({ req: { levels: { defence: 70 } } });
  assert.deepEqual(setupFit(s, { build: 'pure' }), { ok: false, reason: 'needs 70 Defence' });
  assert.deepEqual(setupFit(s, { build: 'zerker' }), { ok: false, reason: 'needs 70 Defence' });
  assert.equal(setupFit(s, { build: 'main' }).ok, true);
});

test('fit: known levels below the need grey it; unknown levels never do', () => {
  const s = base({ req: { levels: { ranged: 90 } } });
  assert.equal(setupFit(s, { levels: { ranged: 80 } }).reason, 'needs 90 Ranged');
  assert.equal(setupFit(s, { levels: {} }).ok, true);
});

test('default pill: the fitting curator pick, else the first that fits, iron prefers iron setups', () => {
  const setups = [base({ name: 'DHCB', pick: true, req: { levels: { defence: 70 } } }), base({ name: 'DHL', accounts: ['ironman'] }), base({ name: 'Budget' })];
  assert.equal(defaultSetup(setups, { build: 'main' }), 0);
  assert.equal(defaultSetup(setups, { build: 'zerker' }), 1);
  assert.equal(defaultSetup(setups, { account: 'ironman', build: 'main' }), 1);
});

test('viewer tier: highest level whose setup stats they meet; account and build from data', () => {
  const setups = [base({ tier: 'beginner', stats: { attack: 1, strength: 1, ranged: 70, magic: 1 } }), base({ tier: 'intermediate', stats: { attack: 1, strength: 1, ranged: 90, magic: 1 } }), base({ tier: 'advanced', stats: { attack: 1, strength: 1, ranged: 99, magic: 1 } })];
  assert.equal(viewerTier(setups, { ranged: 92 }), 'intermediate');
  assert.equal(viewerTier(setups, null), null);
  assert.equal(guideAccountOf('hardcore_group'), 'gim');
  assert.equal(guideAccountOf(null), 'main');
  assert.equal(guideBuildOf({ defence: 1 }), 'pure');
  assert.equal(guideBuildOf({ defence: 45 }), 'zerker');
});

test('setup keys: own id kept, old setups get a stable derived key', () => {
  assert.equal(setupKey({ id: 'dhcb', tier: 'advanced', name: 'x' }, 3), 'dhcb');
  assert.equal(setupKey({ tier: 'advanced', name: 'Dragon hunter crossbow' }, 2), 'advanced-dragon-hunter-crossbow-2');
  assert.equal(setupKey({ id: '<script>', tier: 'beginner', name: 'A' }, 0), 'beginner-a-0');
});

// ── Ownership, fallbacks, skips, budget ────────────────────────────────────────────────────────

const QUIVER = 28951;
const ASSEMBLER = 22109;
const MASORI_ASSEMBLER = 27374;
const ACCUMULATOR = 10499;
const DHCB = 21012;
const DHCB_T = 25916;
const ACB = 11785;
const eq = equivalentsFrom([[21012, 21013]]);
const dhcbSetup = base({ gear: { weapon: DHCB, cape: QUIVER }, alts: { weapon: [ACB], cape: [ASSEMBLER, ACCUMULATOR] }, inventory: [{ id: 2434 }] });
const snap = (ids: number[], kind: 'bank' | 'inventory' | 'equipment' = 'bank') => ({ [kind]: { items: ids.map((id) => ({ id })), readAt: '2026-11-24T10:00:00Z' } });

test('fallbacks: the best owned item on each slot list is used', () => {
  const r = resolveSetup(dhcbSetup, snap([ACB, ACCUMULATOR]), eq);
  assert.equal(r.gear.weapon, ACB);
  assert.equal(r.gear.cape, ACCUMULATOR);
  assert.deepEqual(r.fallbacks.map((f) => f.slot).sort(), ['cape', 'weapon']);
  assert.equal(r.missing.length, 0, 'a slot with an owned fallback is not missing');
  assert.equal(personalSetup(dhcbSetup, r).gear.weapon, ACB);
});

test('ownership counts bank, inventory and worn gear together', () => {
  const r = resolveSetup(dhcbSetup, { ...snap([DHCB], 'equipment'), ...snap([QUIVER, 2434], 'inventory') }, eq);
  assert.equal(r.missing.length, 0);
  assert.equal(r.missingSupplies.length, 0);
  assert.equal(r.slots.every((s) => s.kind === 'guide'), true);
});

test('cosmetic equivalents count as the item: Masori assembler, DHCB (t)', () => {
  const r = resolveSetup(dhcbSetup, snap([DHCB_T, MASORI_ASSEMBLER]), eq);
  assert.equal(r.slots.find((s) => s.slot === 'weapon')!.kind, 'guide');
  assert.equal(r.gear.cape, ASSEMBLER, 'the assembler fallback is owned through the Masori kit');
});

test('missing only when nothing on the list is owned; no snapshot = nothing missing', () => {
  const r = resolveSetup(dhcbSetup, snap([995]), eq);
  assert.deepEqual(r.missing.map((m) => m.slot).sort(), ['cape', 'weapon']);
  assert.equal(r.gear.weapon, DHCB, 'shows the guide item to get');
  assert.equal(r.missingSupplies.length, 1);
  const none = resolveSetup(dhcbSetup, null, eq);
  assert.equal(none.missing.length, 0);
  assert.equal(none.gear.weapon, DHCB);
});

test('skips: a skipped item counts as not owned and the next fallback takes over', () => {
  const r = resolveSetup(dhcbSetup, snap([DHCB, ACB]), eq, { skipped: new Set([DHCB]) });
  assert.equal(r.gear.weapon, ACB);
  const r2 = resolveSetup(dhcbSetup, snap([995]), eq, { skipped: new Set([DHCB]) });
  assert.equal(r2.gear.weapon, ACB, 'the missing pointer skips past it too');
});

test('budget cap: items over it are skipped unless already owned', () => {
  const prices = { [DHCB]: 92_000_000, [ACB]: 31_000_000 };
  const r = resolveSetup(dhcbSetup, snap([995]), eq, { budgetCap: 50_000_000, prices });
  assert.equal(r.gear.weapon, ACB);
  const owned = resolveSetup(dhcbSetup, snap([DHCB]), eq, { budgetCap: 50_000_000, prices });
  assert.equal(owned.gear.weapon, DHCB, 'owning it beats the cap');
});

// ── Ground markers ───────────────────────────────────────────────────────────────────────────

test('ground markers: the RuneLite shape parses, colours normalise, bad tiles are refused', () => {
  const ok = parseGroundMarkers('[{"regionId":9023,"regionX":34,"regionY":21,"z":0,"color":"#FFE0B453"},{"regionId":9023,"regionX":35,"regionY":21,"z":0,"color":"#e0b453","label":"Stand"}]');
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.points.length, 2);
    assert.equal(ok.points[1].color, '#FFE0B453');
    assert.equal(ok.points[1].label, 'Stand');
  }
  assert.equal(parseGroundMarkers('[{"regionId":"9023","regionX":1,"regionY":1,"z":0}]').ok, false);
  assert.equal(parseGroundMarkers('[{"regionId":1,"regionX":64,"regionY":1,"z":0}]').ok, false);
  assert.equal(parseGroundMarkers('{"a":1}').ok, false);
});

test('ground markers: an HTML label comes out as plain text', () => {
  const r = parseGroundMarkers('[{"regionId":1,"regionX":1,"regionY":1,"z":0,"label":"<img src=x onerror=alert(1)>Safe spot<script>x</script>"}]');
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.points[0].label!.includes('<'), false);
    assert.equal(/onerror|script/i.test(groundMarkersJson(r.points)), false);
  }
  assert.equal(cleanMarkerLabel('"><svg/onload=1>'), null);
});

// ── Bank tag and Inventory Setups import ─────────────────────────────────────────────────────

test('bank tag import: our own export round-trips to the same layout', () => {
  const s = { name: 'Vorkath DHCB', gear: { weapon: DHCB, cape: QUIVER, ammo: 21944 }, inventory: [{ id: 2434 }, { id: 391 }], runePouch: [{ id: 556, q: 1000 }], quiver: 21946 };
  const r = parseBankTag(bankTagString(s));
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.tag.name, 'Vorkath DHCB');
  assert.equal(r.tag.icon, DHCB);
  assert.deepEqual([...r.tag.layout.entries()].sort((a, b) => a[0] - b[0]), [...bankLayout(s).entries()].sort((a, b) => a[0] - b[0]));
  assert.equal(r.tag.layout.get(2), 21946, 'quiver ammo sits above ammo (row 0, col 2)');
  const grid = bankGrid(r.tag.layout);
  assert.equal(grid[0].length, 8);
});

test('bank tag import: old form without the head, loose items, and no layout', () => {
  const r = parseBankTag('my tag,4151,4151,1127,1079');
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.tag.name, 'my tag');
  assert.deepEqual(r.tag.items, [4151, 1127, 1079]);
  assert.equal(r.tag.layout.get(0), 4151);
  const setup = tagToSetup(r.tag, (id) => (id === 4151 ? 'weapon' : id === 1127 ? 'body' : null));
  assert.equal(setup.gear.weapon, 4151);
  assert.deepEqual(setup.inventory, [{ id: 1079 }]);
});

test('bank tag import: malformed input is refused with a reason', () => {
  for (const bad of ['', 'banktags,1,x,notanid', 'banktags,1,x,4151,12a', 'banktags,1,x,4151,layout,1', 'banktags,1,x,4151,layout,-3,4151', 'banktaglayoutsplugin:x']) {
    const r = parseBankTag(bad);
    assert.equal(r.ok, false, bad);
  }
});

test('bank tag import: XSS in the name comes out as plain text', () => {
  const r = parseBankTag('banktags,1,<img src=x onerror=alert(1)>Vork<script>alert(1)</script>,4151,4151');
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(/[<>]|onerror|script/i.test(r.tag.name) && r.tag.name.includes('<'), false);
  if (r.ok) assert.equal(r.tag.name.includes('<'), false);
});

test('inventory setup import: round-trips our export, rejects bad ids', () => {
  const s = { name: 'Set', gear: { weapon: DHCB, head: 24271 }, inventory: [{ id: 2434 }, null, { id: 391, q: 5 }], runePouch: [{ id: 556, q: 200 }], spellbook: 2 };
  const r = parseRuneliteImport(inventorySetupJson(s));
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.tag.gear!.weapon, DHCB);
  assert.equal(r.tag.gear!.head, 24271);
  assert.deepEqual(r.tag.inventory!.slice(0, 3), [{ id: 2434 }, null, { id: 391, q: 5 }]);
  assert.equal(r.tag.spellbook, 2);
  assert.equal(parseInventorySetup('{"setup":{"inv":[{"id":"1"}],"eq":[]}}').ok, false);
  assert.equal(parseInventorySetup('{"setup":{"inv":[{"id":1.5}],"eq":[]}}').ok, false);
  assert.equal(parseInventorySetup('nope').ok, false);
});

// ── Routes ───────────────────────────────────────────────────────────────────────────────────

const ROUTE: RouteBlock = parseRouteBlock(
  JSON.stringify({
    chapters: [
      {
        name: 'Early game',
        steps: [
          { id: 'graceful', title: 'Graceful set', goal: { kind: 'clog', id: 11850 }, why: 'Run energy.' },
          { id: 'fossil', title: 'Fossil Island', goal: { kind: 'quest', name: 'Bone Voyage' } },
          { id: 'chaos', title: 'Chaos Temple bones', goal: { kind: 'manual' }, reqs: [{ kind: 'level', skill: 'prayer', level: 31 }], forks: { hcim: { skip: true, alt: 'Gilded altar instead' } } },
          { id: 'agility', title: '70 Agility', goal: { kind: 'level', skill: 'agility', level: 70 } },
          { id: 'rcb', title: 'Rune pouch', goal: { kind: 'item', id: 12791 }, reqs: [{ kind: 'level', skill: 'slayer', level: 99 }] },
        ],
      },
    ],
  }),
)!;

test('route steps auto-tick from facts; next up is the first open step whose reqs are met', () => {
  const p = routeProgress(ROUTE, { levels: { prayer: 20, agility: 64, slayer: 40 }, clog: new Set([11850]), quests: new Set(['bone voyage']), items: new Set() }, 'ironman');
  assert.equal(p.done, 2);
  assert.equal(p.total, 5);
  assert.deepEqual(p.next.map((s) => s.step.id), ['agility'], 'chaos needs 31 Prayer, rune pouch needs 99 Slayer');
  assert.equal(p.lastDone?.step.id, 'fossil');
  assert.equal(p.steps[0].source, 'from your collection log');
});

test('route forks: HCIM skips a step; manual ticks count', () => {
  const p = routeProgress(ROUTE, { levels: { prayer: 40, agility: 70, slayer: 99 }, manual: new Set(['chaos']) }, 'hcim');
  assert.equal(p.total, 4);
  assert.equal(p.steps.find((s) => s.step.id === 'chaos')!.skipped, true);
  const iron = routeProgress(ROUTE, { manual: new Set(['chaos']) }, 'ironman');
  assert.equal(iron.steps.find((s) => s.step.id === 'chaos')!.done, true);
});

test('route parsing drops bad goals and strips markup from text', () => {
  const r = parseRouteBlock('{"chapters":[{"name":"<b>A</b>","steps":[{"title":"<script>x</script>Ok","goal":{"kind":"level","skill":"attack","level":"99"}},{"title":"Fine","goal":{"kind":"evil"}},{"title":"Good <img onerror=1>","goal":{"kind":"quest","name":"Dragon Slayer II"}}]}]}')!;
  assert.equal(r.chapters[0].steps.length, 1);
  assert.equal(r.chapters[0].steps[0].title.includes('<'), false);
  assert.equal(r.chapters[0].name, 'A');
});

test('route Discord body: chapters, checkbox lines, quests hand over to Quest Helper', () => {
  const md = routeDiscordMarkdown(ROUTE, 'https://anvilosrs.com/guides/ironman');
  assert.match(md, /^## Early game/m);
  assert.match(md, /⬜ \*\*2\. Fossil Island\*\*/);
  assert.match(md, /Quest Helper takes it from here/);
  assert.match(md, /HCIM: skip/);
});

// ── Writer credit ──────────────────────────────────────────────────────────────────────────────

const piece = (over: Partial<Piece> = {}): Piece => ({ id: 'p1', authorUserId: 1, authorPlayerId: 100, live: true, ...over });
const reachRows = (n: number, over: Partial<Reach> = {}): Reach[] =>
  Array.from({ length: n }, (_, i) => ({ pieceId: 'p1', accountId: 1000 + i, playerId: 5000 + i, clanId: null, ageDays: 200, confirmed: true, voted: false, ...over }));

test('credit: an old live piece keeps earning each month; a hidden one stops', () => {
  const reach = reachRows(40);
  assert.equal(monthlyCredit('2026-11', [piece({ createdMonth: '2025-01' })], [], reach).get(1), 40);
  assert.equal(monthlyCredit('2026-11', [piece({ live: false })], [], reach).get(1), undefined);
});

test('credit: splitting an edit into many earns nothing extra', () => {
  const one = monthlyCredit('2026-11', [piece()], [{ pieceId: 'p1', userId: 2, tag: 'fix', month: '2026-11' }], reachRows(40)).get(2);
  const ten = monthlyCredit('2026-11', [piece()], Array.from({ length: 10 }, () => ({ pieceId: 'p1', userId: 2, tag: 'fix' as const, month: '2026-11' })), reachRows(40)).get(2);
  assert.equal(one, ten);
  const subs = monthlyCredit('2026-11', [piece()], Array.from({ length: 5 }, () => ({ pieceId: 'p1', userId: 2, tag: 'substantive' as const, month: '2026-11' })), reachRows(40));
  assert.equal(subs.get(2), 8, 'one 20% share however many edits');
  assert.equal(subs.get(1), 40, 'the author keeps a whole share');
});

test('credit: a reverted edit stops earning', () => {
  const c = monthlyCredit('2026-11', [piece()], [{ pieceId: 'p1', userId: 2, tag: 'substantive', month: '2026-10', reverted: true }], reachRows(40));
  assert.equal(c.get(2), undefined);
});

test('credit: own characters, brand-new accounts and one clan’s excess are worth ~0', () => {
  assert.equal(pieceReach(piece(), reachRows(30, { playerId: 100 })), 0, 'the writer’s own characters');
  assert.ok(pieceReach(piece(), reachRows(30, { ageDays: 1 })) < 2, 'new accounts');
  const clan = pieceReach(piece(), [...reachRows(100, { clanId: 7 }), ...reachRows(10, { clanId: null }).map((r, i) => ({ ...r, accountId: 9000 + i }))]);
  assert.ok(clan < 40, `one clan is capped (got ${clan})`);
  assert.ok(pieceReach(piece(), reachRows(10, { confirmed: false, voted: true })) < 10 * 0.5, 'vote-only counts less');
  assert.equal(pieceReach(piece(), reachRows(10, { confirmed: false, voted: false })), 0);
});

test('ranks, bands, featured group and curator trust', () => {
  assert.equal(writerRank(0), null);
  assert.equal(writerRank(5)!.label, 'Contributor');
  assert.equal(writerRank(12_000)!.label, 'Master writer');
  assert.equal(impactBand(1240), '1k–5k players');
  assert.equal(impactBand(0), 'No players yet');
  const credit = new Map([[1, 100], [2, 900], [3, 50], [4, 1]]);
  const names = new Map([[1, 'Zed'], [2, 'Amy'], [3, 'Bob'], [4, 'Cy']]);
  assert.deepEqual(featuredWriters(credit, names, 2), [2, 1], 'top two, shown in name order');
  assert.equal(canCurate({ lifetime: 10_000 }), true);
  assert.equal(canCurate({ lifetime: 9_999 }), false);
  assert.equal(canCurate({ guideEditor: true }), true);
});

test('used-it votes: kc required, own clan halves, auto counts full', () => {
  assert.equal(voteWeight({ kc: 0 }), 0);
  assert.ok(voteWeight({ kc: 100 }) === 1);
  assert.equal(voteWeight({ kc: 100, sameClan: true }), 0.5);
  assert.equal(voteWeight({ kc: 0, source: 'auto' }), 1);
  const ranked = rankByVotes([{ id: 1, createdAt: 'a' }, { id: 2, createdAt: 'b' }], [{ itemId: 2, userId: 9, weight: 1 }, { itemId: 2, userId: 9, weight: 1 }, { itemId: 1, userId: 8, weight: 0.3 }]);
  assert.deepEqual(ranked.map((r) => [r.id, r.score]), [[2, 1], [1, 0.3]], 'one vote per user');
});

test('contributors: ordered by impact; copy credits keep library and clan apart; names escaped', () => {
  const list = contributors([
    { userId: 2, name: 'Solo Saga', kind: 'edit', tag: 'fix' },
    { userId: 1, name: 'Iron Pyre', kind: 'author' },
    { userId: 3, name: 'Gnome', kind: 'setup', reach: 40 },
    { userId: 2, name: 'Solo Saga', kind: 'tip' },
  ]);
  assert.deepEqual(list.map((c) => c.userId), [1, 3, 2]);
  assert.equal(writtenByLine(list), 'Written by Iron Pyre, Gnome and 1 other');
  assert.equal(copyCreditLine(list, [], 'Clan'), "Based on Anvil's guide by Iron Pyre +2");
  assert.match(copyCreditLine(list, [{ userId: 9, name: 'Z', impact: 1, kinds: [] }], 'My Clan'), /edited for My Clan by Z/);
  const evil = contributors([{ userId: 1, name: '@everyone **x**', kind: 'author' }]);
  assert.equal(writtenByLine(evil, true).includes('@everyone'), false);
  assert.equal(writtenByLine(evil, true).includes('**'), false);
});

// ── Discord: selections, multi-setup, legacy unchanged ─────────────────────────────────────────

const idx = indexGear(GEAR_DATA);
const VORK: GearBlock = {
  monster: 'Vorkath#Post-quest',
  setups: [
    base({ id: 'dhcb', name: 'Ranged · DHCB', pick: true, accounts: ['main', 'gim'], gear: { weapon: DHCB, cape: QUIVER, ammo: 21944 }, quiver: 21946, alts: { cape: [ASSEMBLER, ACCUMULATOR] }, spells: ['Crumble Undead'], runePouch: [{ id: 556, q: 1000 }], inventory: [{ id: 2434 }, { id: 2434 }], steps: ['Acid: walk.'] }),
    base({ id: 'dhl', name: 'Melee · DHL', accounts: ['ironman'], gear: { weapon: 22978, body: 10551 } }),
    base({ id: 'tbow', tier: 'advanced', name: 'Twisted bow', gear: { weapon: 20997, ammo: 11212 } }),
  ],
};
const BODY = `Intro.\n::: intermediate\nMid text.\n::: advanced\nEnd text.\n:::\n\n\`\`\`gear\n${JSON.stringify(VORK)}\n\`\`\`\n`;

test('discord: no selection keeps the original compact format (old posts edit in place)', () => {
  const legacy = discordBody(BODY, idx, 'https://x/guides/v');
  assert.match(legacy, /⚔️ Gear progression vs Vorkath/);
  assert.equal(legacy.includes('banktags,1'), false);
});

test('discord: a multi-setup guide posts one block per setup with fallbacks and a bank tag', () => {
  const body = discordBody(BODY, idx, 'https://x/guides/v', { selection: selectAll(VORK), names: { 2434: 'Prayer potion(4)', 556: 'Air rune' }, title: 'Vorkath' });
  assert.match(body, /### Intermediate · Ranged · DHCB ⭐/);
  assert.match(body, /### Intermediate · Melee · DHL/);
  assert.match(body, /Cape: Dizana's quiver \(or Ava's assembler \/ Ava's accumulator\)/);
  assert.match(body, /Quiver: Diamond dragon bolts \(e\)/);
  assert.match(body, /Inventory: 2× Prayer potion\(4\)/);
  assert.match(body, /Rune pouch: 1,000 Air rune/);
  assert.match(body, /Spellbook: Standard · Crumble Undead/);
  assert.match(body, /```\nbanktags,1,Vorkath Ranged · DHCB,21012/);
  const msgs = renderGuideForDiscord({ title: 'Vorkath', body });
  assert.ok(msgs.every((m) => m.content.length <= 2000));
});

test('discord: a filtered selection posts only the chosen levels and setups', () => {
  const sel: PostSelection = { ...selectAll(VORK), tiers: ['intermediate'], setups: ['dhcb'] };
  const body = discordBody(BODY, idx, null, { selection: sel, title: 'Vorkath' });
  assert.match(body, /Ranged · DHCB/);
  assert.equal(body.includes('Melee · DHL'), false);
  assert.equal(body.includes('Twisted bow'), false);
  assert.equal(body.includes('End text.'), false, 'the advanced section is left out');
  assert.match(body, /Mid text\./);
});

test('discord: a resync keeps the selection; setups added later stay out unless opted in', () => {
  const stored = cleanSelection(JSON.parse(JSON.stringify({ ...selectAll(VORK), setups: ['dhcb'] })))!;
  const grown: GearBlock = { ...VORK, setups: [...VORK.setups, base({ id: 'budget', name: 'Budget RCB', gear: { weapon: 9185 } })] };
  const s = grown.setups[3];
  assert.equal(setupSelected(stored, s, 3), false);
  assert.equal(setupSelected({ ...stored, includeNew: true }, s, 3), true);
  assert.equal(setupSelected(stored, grown.setups[1], 1), false, 'unticked stays unticked');
  const body = discordBody(BODY.replace(JSON.stringify(VORK), JSON.stringify(grown)), idx, null, { selection: stored, title: 'Vorkath' });
  assert.equal(body.includes('Budget RCB'), false);
});

test('discord: a route guide posts chapters as checkbox lines', () => {
  const body = discordBody(`Start here.\n\n\`\`\`route\n${JSON.stringify(ROUTE)}\n\`\`\``, null, null);
  assert.match(body, /## Early game/);
  assert.match(body, /⬜ \*\*1\. Graceful set\*\*/);
});

// ── Media and XSS through every render path ────────────────────────────────────────────────────

test('youtube: watch, youtu.be, shorts with t= give id + start; anything else is refused', () => {
  assert.deepEqual(parseYouTube('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=62'), { id: 'dQw4w9WgXcQ', start: 62 });
  assert.deepEqual(parseYouTube('https://youtu.be/dQw4w9WgXcQ?t=1m2s'), { id: 'dQw4w9WgXcQ', start: 62 });
  assert.deepEqual(parseYouTube('https://youtube.com/shorts/dQw4w9WgXcQ'), { id: 'dQw4w9WgXcQ', start: 0 });
  for (const bad of ['javascript:alert(1)', 'https://evil.com/watch?v=dQw4w9WgXcQ', 'https://youtube.com/watch?v="><script>', 'https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXc"onload=1']) {
    assert.equal(parseYouTube(bad), null, bad);
  }
  assert.equal(youTubeEmbedUrl({ id: 'dQw4w9WgXcQ', start: 5 }), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0&start=5');
  assert.throws(() => youTubeEmbedUrl({ id: '"><script>', start: 0 }));
  assert.equal(youTubeLink({ id: 'dQw4w9WgXcQ', start: 0 }), 'https://youtu.be/dQw4w9WgXcQ');
});

const PAYLOADS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '[click](javascript:alert(1))',
  '![x](javascript:alert(1))',
  '![x](data:image/svg+xml;base64,PHN2Zz4=)',
  'https://youtube.com/watch?v="><script>alert(1)</script>',
  '<a href="javascript:alert(1)">x</a>',
];

test('xss: the site renderer turns every payload into inert text', () => {
  for (const p of PAYLOADS) {
    const html = renderToStaticMarkup(renderGuide(`Text\n${p}\nmore`) as React.ReactElement);
    assert.equal(/<script|<img[^>]*onerror|<a[^>]*href="javascript:|src="javascript:|src="data:|<iframe/i.test(html), false, `${p} → ${html}`);
  }
  const yt = renderToStaticMarkup(renderGuide('https://www.youtube.com/watch?v=dQw4w9WgXcQ') as React.ReactElement);
  assert.match(yt, /i\.ytimg\.com\/vi\/dQw4w9WgXcQ/);
  assert.equal(yt.includes('<iframe'), false, 'nothing loads until clicked');
  const link = renderToStaticMarkup(renderGuide('[ok](https://example.com)') as React.ReactElement);
  assert.match(link, /rel="noopener noreferrer nofollow ugc"/);
});

test('xss: setup text in Discord is escaped and cannot mention', () => {
  const evil: GearBlock = { monster: 'Vorkath#Post-quest', setups: [base({ id: 'x', name: '@everyone <script>**bold**', steps: ['<@123> [x](javascript:alert(1))'], gear: { weapon: DHCB } })] };
  const body = discordBody(`\`\`\`gear\n${JSON.stringify(evil)}\n\`\`\``, idx, null, { selection: selectAll(evil), title: 'V' });
  assert.equal(body.includes('@everyone'), false);
  assert.equal(body.includes('<@123>'), false);
  // Inside a code block text is literal; outside it, markdown is escaped.
  assert.equal(body.replace(/```[\s\S]*?```/g, '').includes('**bold**'), false);
  assert.equal(/[^\\]\]\(javascript:/.test(body), false, 'the link bracket is escaped');
});

test('a route block is its own segment and never renders as raw JSON on the site', () => {
  const segs = splitSegments('Hi\n```route\n{"chapters":[]}\n```');
  assert.deepEqual(segs.map((s) => s.kind), ['text', 'route']);
});
