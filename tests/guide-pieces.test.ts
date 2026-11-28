// Guide pieces, pure parts (lib/guidePieces): text cleaning and links, the per-kind schemas with
// hostile payloads, kit imports, the resolver, the converter, and guide_areas rows → trip regions.
//
// Run: npx tsx --test tests/guide-pieces.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checkText, cleanText, hubUrl, isAnvilPath, looksLikeUrl, safeText } from '../src/lib/guidePieces/text.ts';
import { anvilPieceInput, checkBody, clanPieceInput, overrideInput } from '../src/lib/guidePieces/schema.ts';
import { checkKitBody, configValue, kitExport, kitFromImport, KIT_IMPORT_MAX } from '../src/lib/guidePieces/kit.ts';
import { resolvePieces, variantMatch, type AnvilPieceRow, type OverrideRow } from '../src/lib/guidePieces/resolve.ts';
import { chunkText, convertGuideBody } from '../src/lib/guidePieces/convert.ts';
import { contentForRegion, regionIds, regionsFromAreas, SPADE, TRIP_REGIONS } from '../src/lib/tripContent.ts';

/** What Swing's BasicHTML.isHTMLString looks for, and any "<" a renderer could start a tag with. */
const markupFree = (s: string) => !/^<html>/i.test(s) && !/<[a-z/!?]/i.test(s);

// ── Text ─────────────────────────────────────────────────────────────────────────────────────

test('text: tags, html prefixes and game markup never survive', () => {
  const hostile = [
    '<script>alert(1)</script>Use protect from magic',
    '<html><img src=x onerror=alert(1)>Pray range',
    '<HTML><a href="javascript:alert(1)">click</a>',
    '<html',
    '<<html>html>boom',
    '<scr<script>ipt>alert(1)</script>',
    '<col=ff0000>red</col> text <img=1>',
    '＜html＞fullwidth', // NFKC folds these to < >
    '<!-- comment --><?xml?>x',
    '</b>',
  ];
  for (const h of hostile) {
    const out = cleanText(h);
    assert.ok(markupFree(out), `${JSON.stringify(h)} → ${JSON.stringify(out)}`);
    assert.ok(markupFree(safeText(h)));
  }
  assert.equal(cleanText('<script>alert(1)</script>Use protect'), 'alert(1)Use protect');
  // A plain "<" in prose is kept.
  assert.equal(cleanText('Eat when HP < 50 and > 20'), 'Eat when HP < 50 and > 20');
  assert.equal(cleanText('<3 kc'), '<3 kc');
});

test('text: bidi overrides, zero-width and control characters go; combining spam is capped', () => {
  assert.equal(cleanText('invoice‮fdp.exe'), 'invoicefdp.exe');
  assert.equal(cleanText('a⁦b⁩c​d﻿e\u0007f'), 'abcdef');
  assert.equal(cleanText('line1\nline2\ttab'), 'line1 line2 tab');
  assert.equal(cleanText('line1\r\n\n\n\nline2', true), 'line1\n\nline2');
  const zalgo = 'Z' + '́̂̃̄̅̆̇̈'.repeat(10);
  const z = cleanText(zalgo);
  assert.ok([...z.normalize('NFD')].length <= 3, `${z.length}`);
  // Megabytes in are bounded before any regex sees them.
  assert.ok(cleanText('x'.repeat(5_000_000)).length <= 20_000);
});

test('text: length caps and required text', () => {
  assert.deepEqual(checkText('  hi  ', { max: 5 }), { ok: true, text: 'hi' });
  assert.equal(checkText('x'.repeat(6), { max: 5 }).ok, false);
  assert.equal(checkText('<b></b>', { max: 5 }).ok, false, 'empty once cleaned');
  assert.equal(checkText(42 as unknown as string, { max: 5 }).ok, false);
});

test('links: Anvil paths and hub names only', () => {
  for (const ok of ['/guide/vorkath', '/c/my-clan/guides?tier=advanced', '/']) assert.ok(isAnvilPath(ok), ok);
  for (const bad of ['javascript:alert(1)', 'https://evil.example', '//evil.example', '/\\evil', '/a/../../etc', 'guide/vorkath', '/guide/<x>', '/a b', 'data:text/html,x']) assert.ok(!isAnvilPath(bad), bad);
  assert.equal(hubUrl('inventory-setups'), 'https://runelite.net/plugin-hub/show/inventory-setups');
  assert.throws(() => hubUrl('../x'));
  for (const u of ['https://discord.com/api/webhooks/1/abc', 'discord.com/api/webhooks/1', 'www.x.y', 'javascript:x', '10.0.0.1', 'see evil.gg']) assert.ok(looksLikeUrl(u), u);
  for (const n of ['Vorkath', 'Ahrim the Blighted', 'Zulrah*']) assert.ok(!looksLikeUrl(n), n);
});

// ── Schemas ──────────────────────────────────────────────────────────────────────────────────

test('schemas: unknown kinds and unknown fields are refused at every depth', () => {
  assert.equal(checkBody('html', { text: 'x' }).ok, false);
  assert.equal(checkBody('__proto__', {}).ok, false);
  assert.equal(checkBody('note', { text: 'x', html: '<b>x</b>' }).ok, false);
  assert.equal(checkBody('steps', { items: [{ text: 'x', onclick: 'alert(1)' }] }).ok, false);
  assert.equal(checkBody('note', JSON.parse('{"text":"x","__proto__":{"admin":true}}')).ok, false);
  assert.equal(checkBody('loadout', { worn: { head: 1, jaw: 2 } }).ok, false, 'not a slot');
  assert.equal(checkBody('loadout', { worn: JSON.parse('{"__proto__":4151}') }).ok, false);
  assert.equal(checkBody('loadout', { worn: { weapon: 4151.5 } }).ok, false);
  assert.equal(checkBody('loadout', { worn: { weapon: -1 } }).ok, false);
  assert.equal(checkBody('loadout', { worn: {}, inventory: Array(29).fill(null) }).ok, false);
  assert.equal(checkBody('steps', { items: Array.from({ length: 41 }, () => ({ text: 'x' })) }).ok, false);
  assert.equal(checkBody('note', 'just a string').ok, false);
  assert.equal(checkBody('note', [{ text: 'x' }]).ok, false);
  // A class instance or anything that isn't a plain object.
  assert.equal(checkBody('note', new (class { text = 'x'; })()).ok, false);
});

test('schemas: every kind takes its good shape and stores the cleaned value', () => {
  const good: Record<string, unknown> = {
    steps: { items: [{ text: '<b>Step</b> under the boss', link: { to: 'anvil', path: '/guide/vorkath' } }, { text: 'Install', link: { to: 'hub', plugin: 'tick-counter' } }] },
    danger: { items: [{ title: 'Acid phase', text: 'Walk, never stand', severity: 'high' }] },
    loadout: { name: 'Ranged', worn: { weapon: 11785, ammo: 11212 }, quiver: null, inventory: [{ id: 385, q: 1 }, null], runePouch: [{ id: 560, q: 300 }], spellbook: 1 },
    fallbacks: { slots: { cape: [22109, 10499] }, items: [{ item: 12695, alts: [2440] }] },
    spec: { weapons: [13652, 11802], note: 'Spec on spawn' },
    checks: { items: [{ type: 'skill', skill: 'ranged', level: 90 }, { type: 'item', item: 952 }, { type: 'unlock', key: 'dragon-slayer-2', label: 'Dragon Slayer II' }, { type: 'spellbook', book: 0 }, { type: 'runePouch', runes: [{ id: 560 }] }, { type: 'prayer', prayer: 'rigour' }] },
    technique: { name: 'Woox walk', changes: { supply: [{ item: 385, delta: -4 }], gear: [{ slot: 'shield', item: null }], steps: ['Walk out'], req: [{ type: 'skill', skill: 'agility', level: 1 }] } },
    kit: { type: 'plugin', plugin: 'inventory-setups' },
    note: { text: 'Line one\nLine two' },
  };
  for (const [k, b] of Object.entries(good)) {
    const r = checkBody(k, b);
    assert.ok(r.ok, `${k}: ${!r.ok ? r.error : ''}`);
  }
  const steps = checkBody('steps', good.steps);
  assert.ok(steps.ok && (steps.value as { items: { text: string }[] }).items[0].text === 'Step under the boss');
});

test('schemas: hostile text and links inside bodies', () => {
  const r = checkBody('note', { text: '<html><img src=x onerror=alert(1)>Pray‮ range' });
  assert.ok(r.ok);
  assert.ok(markupFree((r.value as { text: string }).text));
  assert.ok(!(r.value as { text: string }).text.includes('‮'));
  for (const link of [
    { to: 'anvil', path: 'javascript:alert(1)' },
    { to: 'anvil', path: 'https://evil.example/' },
    { to: 'anvil', path: '//evil.example' },
    { to: 'url', href: 'https://evil.example' },
    { to: 'hub', plugin: 'https://evil.example' },
    { to: 'hub', plugin: 'tick-counter', href: 'https://evil.example' },
  ]) {
    assert.equal(checkBody('note', { text: 'x', link }).ok, false, JSON.stringify(link));
  }
  assert.equal(checkBody('note', { text: 'x'.repeat(2001) }).ok, false);
});

test('schemas: write inputs refuse a clan id, a user id or a version riding along', () => {
  assert.equal(overrideInput({ body: { text: 'x' }, clanId: 2 }, '').ok, false);
  assert.equal(overrideInput({ hidden: true, clan_id: 2 }, '').ok, false);
  assert.equal(clanPieceInput({ guideId: 1, kind: 'note', body: { text: 'x' }, clanId: 2 }, '').ok, false);
  assert.equal(anvilPieceInput({ guideId: 1, kind: 'note', body: { text: 'x' }, version: 99 }, '').ok, false);
  assert.equal(anvilPieceInput({ guideId: 1, kind: 'note', body: {}, updatedByUserId: 1 }, '').ok, false);
  assert.equal(clanPieceInput({ guideId: 1, kind: 'note', body: { text: 'x' }, section: '../x' }, '').ok, false);
  assert.equal(clanPieceInput({ guideId: 1, kind: 'note', body: { text: 'x' }, role: '<b>' }, '').ok, false);
  assert.equal(clanPieceInput({ guideId: 1, kind: 'note', body: { text: 'x' }, variant: { level: 'god' } }, '').ok, false);
  assert.equal(clanPieceInput({ guideId: 1, kind: 'note', body: { text: 'x' }, variant: { teamSize: { min: 5, max: 2 } } }, '').ok, false);
  assert.ok(clanPieceInput({ guideId: 1, kind: 'note', body: { text: 'x' }, section: 'akkha', role: 'melee', variant: { teamSize: { min: 1, max: 3 } } }, '').ok);
});

// ── Kit ──────────────────────────────────────────────────────────────────────────────────────

test('kit: ground markers are parsed and re-serialised, labels cleaned, oversize refused', () => {
  const paste = JSON.stringify([{ regionId: 9023, regionX: 10, regionY: 20, z: 0, color: '#FF00FF00', label: '<html><img src=x>stand', extra: 'dropped' }]);
  const r = kitFromImport('groundMarkers', paste);
  assert.ok(r.ok, !r.ok ? r.error : '');
  const pts = (r.value as unknown as { points: Record<string, unknown>[] }).points;
  assert.deepEqual(Object.keys(pts[0]).sort(), ['color', 'label', 'regionId', 'regionX', 'regionY', 'z']);
  assert.ok(markupFree(String(pts[0].label)));
  const out = JSON.parse(kitExport(r.value)!);
  assert.equal(out[0].regionId, 9023);
  assert.equal(out[0].extra, undefined);
  assert.equal(kitFromImport('groundMarkers', ' '.repeat(KIT_IMPORT_MAX + 1)).ok, false);
  assert.equal(kitFromImport('groundMarkers', JSON.stringify(Array(501).fill({ regionId: 1, regionX: 1, regionY: 1, z: 0 }))).ok, false);
  assert.equal(kitFromImport('groundMarkers', '{"not":"a list"}').ok, false);
});

test('kit: inventory setups and bank tags keep only parsed data', () => {
  const inv = JSON.stringify({ setup: { inv: [{ id: 385, q: 2 }, null], eq: [{ id: 10828 }, null, null, { id: 4151 }], rp: [{ id: 560, q: 100 }], name: '<html><b>Vork</b>', notes: 'https://evil.example', hc: '#FFFF0000', webhook: 'x' }, layout: [4151] });
  const r = kitFromImport('inventorySetup', inv);
  assert.ok(r.ok, !r.ok ? r.error : '');
  const v = r.value as Record<string, unknown>;
  assert.deepEqual(Object.keys(v).sort(), ['inventory', 'name', 'runePouch', 'type', 'worn']);
  assert.ok(markupFree(String(v.name)));
  const exported = kitExport(r.value)!;
  assert.ok(!exported.includes('evil'), 'notes are not carried');
  assert.ok(!exported.includes('webhook'));
  const tag = kitFromImport('bankTag', 'banktags,1,<b>My tag</b>,4151,layout,0,4151,1,11785');
  assert.ok(tag.ok, !tag.ok ? tag.error : '');
  assert.equal(kitExport(tag.value), 'banktags,1,My tag,4151,layout,0,4151,1,11785');
  assert.equal(kitFromImport('bankTag', 'x,4151,javascript:alert(1)').ok, false);
  assert.equal(kitFromImport('bankTag', 'x,' + '4151,'.repeat(20_000)).ok, false);
});

test('kit: plugin configs take allowlisted keys only and never an address', () => {
  const ok = kitFromImport('pluginConfig', 'npcindicators.highlightHull=true\nnpcindicators.npcToHighlight=Vorkath, Zombified Spawn\nnpcindicators.npcColor=-16711936');
  assert.ok(ok.ok, !ok.ok ? ok.error : '');
  assert.deepEqual((ok.value as { values: unknown }).values, { highlightHull: true, npcToHighlight: 'Vorkath,Zombified Spawn', npcColor: '#FF00FF00' });
  assert.equal(kitExport(ok.value), 'npcindicators.highlightHull=true\nnpcindicators.npcToHighlight=Vorkath,Zombified Spawn\nnpcindicators.npcColor=-16711936');
  const hostile = [
    'discordlootlogger.webhook=https://discord.com/api/webhooks/1/abc', // not an allowlisted plugin
    'npcindicators.webhookUrl=https://discord.com/api/webhooks/1/abc', // not an allowlisted key
    'npcindicators.npcToHighlight=https://discord.com/api/webhooks/1/abc', // an address in a names field
    'npcindicators.npcToHighlight=discord.com/api/webhooks/1',
    'npcindicators.npcToHighlight=<html><img src=x>',
    'npcindicators.highlightHull=maybe',
    'npcindicators.borderWidth=9999',
    'npcindicators.highlightHull=true\ngrounditems.hiddenItems=Bones', // two plugins in one share
    'not a config line',
  ];
  for (const h of hostile) assert.equal(kitFromImport('pluginConfig', h).ok, false, h);
  // The same rules on a direct write, not only through the import.
  assert.equal(checkKitBody({ type: 'pluginConfig', plugin: 'npcindicators', values: { npcToHighlight: 'http://10.0.0.1/x' } }).ok, false);
  assert.equal(checkKitBody({ type: 'pluginConfig', plugin: 'npcindicators', values: JSON.parse('{"__proto__":true}') }).ok, false);
  assert.equal(checkKitBody({ type: 'pluginConfig', plugin: 'constructor', values: { a: true } }).ok, false);
  assert.equal(configValue('npcindicators', 'toString', 'x').ok, false);
  assert.equal(checkKitBody({ type: 'groundMarkers', points: [{ regionId: 1, regionX: 64, regionY: 0, z: 0 }] }).ok, false);
  assert.equal(checkKitBody({ type: 'script', src: 'x' }).ok, false);
});

// ── Resolver ─────────────────────────────────────────────────────────────────────────────────

const piece = (id: number, over: Partial<AnvilPieceRow> = {}): AnvilPieceRow => ({ id, guideId: 1, sectionKey: 'tactics', roleKey: '*', variant: {}, kind: 'note', body: { text: `anvil ${id}` }, position: id * 10, version: 1, status: 'published', ...over });
const ov = (id: number, over: Partial<OverrideRow> = {}): OverrideRow => ({ id, clanId: 7, pieceId: null, guideId: 1, sectionKey: 'tactics', roleKey: '*', variant: {}, kind: 'note', body: { text: `clan ${id}` }, hidden: false, position: null, basedOnVersion: null, version: 1, ...over });

test('resolver: override wins, hidden removes, clan-added included, anvilChanged flagged', () => {
  const anvil = [piece(1), piece(2, { version: 3 }), piece(3), piece(4, { status: 'draft' })];
  const overrides = [ov(10, { pieceId: 2, basedOnVersion: 2, body: { text: 'ours' } }), ov(11, { pieceId: 3, hidden: true, body: null }), ov(12, { position: 15 })];
  const r = resolvePieces(anvil, overrides);
  assert.deepEqual(r.map((p) => p.key), ['a1', 'c12', 'a2']);
  assert.deepEqual(r.map((p) => p.source), ['anvil', 'clan', 'clan']);
  assert.deepEqual(r[2].body, { text: 'ours' });
  assert.equal(r[2].anvilChanged, true);
  assert.equal(r[0].anvilChanged, false);
  // Anvil-only (no clan): drafts hidden from readers.
  assert.deepEqual(resolvePieces(anvil, []).map((p) => p.key), ['a1', 'a2', 'a3']);
  // A clan editor sees hidden pieces, flagged, and no drafts; the library editor sees drafts.
  const e = resolvePieces(anvil, overrides, { editor: true });
  assert.equal(e.find((p) => p.key === 'a3')?.hidden, true);
  assert.equal(e.some((p) => p.key === 'a4'), false);
  assert.equal(resolvePieces(anvil, [], { editor: true, drafts: true }).find((p) => p.key === 'a4')?.draft, true);
  // Caught up: not flagged.
  assert.equal(resolvePieces(anvil, [ov(10, { pieceId: 2, basedOnVersion: 3 })])[1].anvilChanged, false);
  // An override of a piece Anvil deleted (piece_id set null) is the clan's own; a hide of one hides nothing.
  assert.deepEqual(resolvePieces([piece(1)], [ov(20, { pieceId: null }), ov(21, { pieceId: null, hidden: true, body: null })]).map((p) => p.key), ['c20', 'a1']);
});

test('resolver: roles layer on the base; single kinds pick the most specific; variants filter', () => {
  const anvil = [
    piece(1, { kind: 'loadout', body: { worn: { weapon: 1 } } }),
    piece(2, { kind: 'loadout', roleKey: 'melee', body: { worn: { weapon: 2 } } }),
    piece(3, { kind: 'loadout', roleKey: 'mage', body: { worn: { weapon: 3 } } }),
    piece(4, { kind: 'steps', body: { items: [{ text: 'base' }] } }),
    piece(5, { kind: 'steps', roleKey: 'melee', body: { items: [{ text: 'melee' }] } }),
    piece(6, { kind: 'note', variant: { level: 'advanced' } }),
    piece(7, { kind: 'note', variant: { teamSize: { min: 1, max: 2 } } }),
    piece(8, { kind: 'spec', variant: { level: 'beginner' }, body: { weapons: [1] } }),
    piece(9, { kind: 'spec', body: { weapons: [2] } }),
    piece(10, { kind: 'note', sectionKey: 'p2' }),
  ];
  const melee = resolvePieces(anvil, [], { role: 'melee', reader: { level: 'beginner', teamSize: 4 } });
  assert.deepEqual(melee.map((p) => p.key), ['a2', 'a4', 'a5', 'a8', 'a10']);
  const ranged = resolvePieces(anvil, [], { role: 'ranged', reader: { level: 'advanced', teamSize: 2 }, section: 'tactics' });
  assert.deepEqual(ranged.map((p) => p.key), ['a1', 'a4', 'a6', 'a7', 'a9']);
  // No role asked: each role's loadout side by side.
  assert.equal(resolvePieces(anvil, [], { kinds: ['loadout'] }).length, 3);
  assert.deepEqual(variantMatch({ raidLevel: { min: 300, max: 500 } }, { raidLevel: 150 }), { ok: false, score: 0 });
  assert.deepEqual(variantMatch({ raidLevel: { min: 300, max: 500 } }, {}), { ok: true, score: 0 });
});

// ── Converter ────────────────────────────────────────────────────────────────────────────────

test('converter: levels → variant, gear setups → loadouts (+ fallbacks, steps, markers), text → notes', () => {
  const block = {
    monster: 'Vorkath',
    setups: [
      { tier: 'beginner', name: 'RCB', gear: { weapon: 9185, ammo: 21905, bogus: 5 }, style: 0, stats: { attack: 1, strength: 1, ranged: 1, magic: 1 }, alts: { cape: [10499] }, steps: ['Walk the acid'], inventory: [{ id: 385 }, null], markers: [{ regionId: 9023, regionX: 1, regionY: 2, z: 0, color: null, label: null }] },
      { tier: 'advanced', name: 'Tbow', gear: { weapon: 20997 }, style: 0, stats: { attack: 1, strength: 1, ranged: 1, magic: 1 } },
    ],
    markers: { advanced: [{ regionId: 9023, regionX: 3, regionY: 3, z: 0 }] },
  };
  const body = ['Intro <script>x</script> text', '', '::: beginner', 'Beginner tips', '```gear', JSON.stringify(block), '```', '::: advanced', 'Advanced tips', ':::', 'Outro'].join('\n');
  const { pieces, skipped } = convertGuideBody(body);
  assert.deepEqual(skipped, []);
  assert.deepEqual(pieces.map((p) => `${p.kind}:${p.variant.level ?? '*'}`), ['note:*', 'note:beginner', 'loadout:beginner', 'fallbacks:beginner', 'steps:beginner', 'kit:beginner', 'loadout:advanced', 'kit:advanced', 'note:advanced', 'note:*']);
  assert.deepEqual((pieces[2].body as { worn: unknown }).worn, { weapon: 9185, ammo: 21905 });
  assert.ok(markupFree((pieces[0].body as { text: string }).text));
  assert.ok(pieces.every((p) => p.sectionKey === 'tactics' && p.roleKey === '*'));
  // Long text is split into note-sized pieces at paragraphs.
  const chunks = chunkText(Array.from({ length: 30 }, (_, i) => `Paragraph ${i} ${'x'.repeat(150)}`).join('\n\n'));
  assert.ok(chunks.length > 1 && chunks.every((c) => c.length <= 1950));
});

// ── guide_areas → trip regions ───────────────────────────────────────────────────────────────

test('guide_areas rows read as the trip regions the check shipped with', () => {
  const rows = Object.entries(TRIP_REGIONS).map(([id, r]) => ({ regionId: Number(id), contentKey: r.content, label: r.name, cues: r.cues ?? [], noBank: !!r.noBank, tripCheck: true }));
  assert.deepEqual(regionsFromAreas(rows), TRIP_REGIONS);
  const regions = regionsFromAreas([...rows, { regionId: 1234, contentKey: 'toa', label: 'off', tripCheck: false }, { regionId: 70000, contentKey: 'toa', label: 'bad' }]);
  assert.deepEqual(regionIds(regions), regionIds(TRIP_REGIONS));
  assert.equal(contentForRegion(12344, new Set([SPADE]), regions)?.key, 'barrows');
  assert.equal(contentForRegion(12344, new Set(), regions), null);
});
