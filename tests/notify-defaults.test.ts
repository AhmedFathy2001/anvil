// Pure tests for drop-threshold inheritance (custom -> clan -> Anvil), the value/rarity combine mode, the
// reset-to-inherit rule, and per-webhook filters. No database.
// Run: npx tsx --test tests/notify-defaults.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NO_CLAN_DROPS,
  NOTIFY_DEFAULTS,
  dropGates,
  hookGates,
  normalizeNotifyPrefs,
  parseNotifyPrefs,
  pluginMe,
  prefsFromRuneLite,
  type ClanDropSettings,
} from '../src/lib/notifyPrefs';
import { dropPasses, judgeDrop, judgeDropFor, keepDropDestinations, type JudgeContext } from '../src/lib/notifyDrops';

const clan = (over: Partial<ClanDropSettings> = {}): ClanDropSettings => ({ ...NO_CLAN_DROPS, ...over });
const ctx = (over: Partial<JudgeContext> = {}): JudgeContext => ({
  prefs: NOTIFY_DEFAULTS, clan: NO_CLAN_DROPS, mode: null, guaranteed: {}, nameOf: () => undefined, ...over,
});
const jar = { id: 12921, name: 'Pet snakeling', qty: 1, value: 0 }; // Zulrah, 1/4000, worth nothing
const cheapCommon = { id: 1, name: 'Bones', qty: 1, value: 100 };
const richCommon = { id: 2, name: 'Shiny', qty: 1, value: 60_000_000 };
const zulrah = (items: { id: number; name: string; qty: number; value: number }[]) => ({ source: 'Zulrah', sourceKind: 'npc', items });

test('platform defaults are 1m and 1/1,000, and a fresh person inherits them', () => {
  const g = dropGates(NOTIFY_DEFAULTS);
  assert.equal(g.value, 1_000_000);
  assert.equal(g.rarity, 1_000);
  assert.equal(g.mode, 'or');
  assert.deepEqual([g.valueSource, g.raritySource, g.modeSource], ['platform', 'platform', 'platform']);
  assert.equal(NOTIFY_DEFAULTS.dropMin, null);
  assert.equal(NOTIFY_DEFAULTS.rarity, null);
});

test('inheritance chain: custom beats clan beats platform, per field', () => {
  const c = clan({ value: 2_000_000, rarity: 5_000, mode: 'and' });
  const inherit = dropGates(NOTIFY_DEFAULTS, c);
  assert.deepEqual([inherit.value, inherit.rarity, inherit.mode], [2_000_000, 5_000, 'and']);
  assert.deepEqual([inherit.valueSource, inherit.raritySource, inherit.modeSource], ['clan', 'clan', 'clan']);
  const own = dropGates({ dropMin: 3_000_000, rarity: null, dropMode: 'or' }, c);
  assert.deepEqual([own.value, own.rarity, own.mode], [3_000_000, 5_000, 'or']);
  assert.deepEqual([own.valueSource, own.raritySource, own.modeSource], ['custom', 'clan', 'custom']);
  // Only one field set on the clan: the other falls through to Anvil's.
  const half = dropGates(NOTIFY_DEFAULTS, clan({ rarity: 2_000 }));
  assert.deepEqual([half.value, half.rarity, half.valueSource, half.raritySource], [1_000_000, 2_000, 'platform', 'clan']);
  // A custom 0 is "off", and stays off whatever the clan says.
  assert.equal(dropGates({ dropMin: 0, rarity: 0 }, c).value, 0);
  assert.equal(dropGates({ dropMin: 0, rarity: 0 }, c).rarity, 0);
});

test('the clan hard floor still lifts the rarity gate over a member choice, never turns it on', () => {
  const hard = clan({ hardFloor: 20_000 });
  assert.equal(dropGates({ dropMin: null, rarity: 2_000 }, hard).rarity, 20_000);
  assert.equal(dropGates(NOTIFY_DEFAULTS, hard).rarity, 20_000);
  assert.equal(dropGates({ dropMin: null, rarity: 0 }, hard).rarity, 0);
  // A clan default looser than the hard floor is lifted to it.
  assert.equal(dropGates(NOTIFY_DEFAULTS, clan({ rarity: 2_000, hardFloor: 20_000 })).rarity, 20_000);
});

test('per character: the same person gets each character clan default; no clan means Anvil defaults', () => {
  const prefs = NOTIFY_DEFAULTS;
  const inClanA = dropGates(prefs, clan({ value: 5_000_000 }));
  const inClanB = dropGates(prefs, clan({ value: 2_000_000, rarity: 10_000 }));
  const clanless = dropGates(prefs, NO_CLAN_DROPS);
  assert.deepEqual([inClanA.value, inClanA.rarity], [5_000_000, 1_000]);
  assert.deepEqual([inClanB.value, inClanB.rarity], [2_000_000, 10_000]);
  assert.deepEqual([clanless.value, clanless.rarity], [1_000_000, 1_000]);
  // ...and what the plugin is told follows the same character.
  const flags = { rareDrops: true };
  assert.equal(pluginMe(prefs, flags, clan({ value: 5_000_000 }), null).dropMin, 5_000_000);
  assert.equal(pluginMe(prefs, flags, NO_CLAN_DROPS, null).dropMin, 1_000_000);
});

test('reset to default: null goes back to inheriting, so a later clan change flows through', () => {
  const custom = normalizeNotifyPrefs({ dropMin: 7_000_000, rarity: 4_000, dropMode: 'and' });
  assert.deepEqual([custom.dropMin, custom.rarity, custom.dropMode], [7_000_000, 4_000, 'and']);
  const reset = normalizeNotifyPrefs({ ...custom, dropMin: null, rarity: null, dropMode: null });
  assert.deepEqual([reset.dropMin, reset.rarity, reset.dropMode], [null, null, null]);
  // Stored absent, not as a copied number.
  const stored = JSON.parse(JSON.stringify(reset));
  assert.equal(stored.dropMin, null);
  assert.equal(dropGates(reset, clan({ value: 3_000_000 })).value, 3_000_000);
  assert.equal(dropGates(reset, clan({ value: 4_000_000 })).value, 4_000_000);
  // A row that never had the keys inherits too.
  assert.equal(parseNotifyPrefs(JSON.stringify({ drops: false })).dropMin, null);
  // A custom number is clamped, and an explicit 0 is off, not inherit.
  assert.equal(normalizeNotifyPrefs({ dropMin: 0 }).dropMin, 0);
  assert.equal(dropGates({ dropMin: 5, rarity: 5 }).value, 1_000_000);
  assert.equal(dropGates({ dropMin: 5, rarity: 5 }).rarity, 1_000);
});

test('the RuneLite upload treats the old defaults (5m, 1/10,000) as inherit, anything else as custom', () => {
  const same = prefsFromRuneLite({ rareDropMinValue: '5000000', rareDropMinRarity: '10000', configDefaultsVersion: '2' });
  assert.deepEqual([same.dropMin, same.rarity], [null, null]);
  const other = prefsFromRuneLite({ rareDropMinValue: '2000000', rareDropMinRarity: '5000', configDefaultsVersion: '2' });
  assert.deepEqual([other.dropMin, other.rarity], [2_000_000, 5_000]);
});

test('combine mode: OR passes on value alone or rarity alone; AND needs both', () => {
  assert.equal(dropPasses('or', 1_000_000, 1_000, true, false), true);
  assert.equal(dropPasses('or', 1_000_000, 1_000, false, true), true);
  assert.equal(dropPasses('or', 1_000_000, 1_000, false, false), false);
  assert.equal(dropPasses('and', 1_000_000, 1_000, true, false), false);
  assert.equal(dropPasses('and', 1_000_000, 1_000, false, true), false);
  assert.equal(dropPasses('and', 1_000_000, 1_000, true, true), true);
  // A threshold that is off isn't required; both off posts nothing.
  assert.equal(dropPasses('and', 0, 1_000, false, true), true);
  assert.equal(dropPasses('and', 1_000_000, 0, true, false), true);
  assert.equal(dropPasses('and', 0, 0, true, true), false);

  // Through the judge: today's behaviour (OR) is the default.
  assert.ok(judgeDrop(zulrah([richCommon]), ctx())); // value only
  assert.ok(judgeDrop(zulrah([jar]), ctx())); // rarity only
  assert.equal(judgeDrop(zulrah([cheapCommon]), ctx()), null);
  const both = ctx({ clan: clan({ mode: 'and' }) });
  assert.equal(judgeDrop(zulrah([richCommon]), both), null);
  assert.equal(judgeDrop(zulrah([jar]), both), null);
  const rareAndRich = { id: 12922, name: 'Tanzanite fang', qty: 1, value: 5_000_000 }; // qty 2 -> rarer than 1/1,000 and worth 15m
  assert.ok(judgeDrop(zulrah([{ ...rareAndRich, qty: 2 }]), both));
});

test('combine mode inherits like a threshold: custom beats clan; no clan means OR', () => {
  assert.equal(dropGates(NOTIFY_DEFAULTS, NO_CLAN_DROPS).mode, 'or');
  assert.equal(dropGates(NOTIFY_DEFAULTS, clan({ mode: 'and' })).mode, 'and');
  assert.equal(dropGates({ dropMin: null, rarity: null, dropMode: 'or' }, clan({ mode: 'and' })).mode, 'or');
  assert.equal(dropGates({ dropMin: null, rarity: null, dropMode: 'and' }).mode, 'and');
  assert.equal(normalizeNotifyPrefs({ dropMode: 'both' }).dropMode, null);
});

test('per-webhook filters fall back to the person\'s effective settings', () => {
  const base = dropGates(NOTIFY_DEFAULTS, clan({ value: 2_000_000, rarity: 5_000, mode: 'and' }));
  const none = hookGates(base, { minValue: null, minRarity: null, mode: null });
  assert.deepEqual([none.value, none.rarity, none.mode], [2_000_000, 5_000, 'and']);
  const v = hookGates(base, { minValue: 100_000, minRarity: null, mode: null });
  assert.deepEqual([v.value, v.rarity, v.mode], [100_000, 5_000, 'and']);
  const m = hookGates(base, { minValue: null, minRarity: 500, mode: 'or' });
  assert.deepEqual([m.value, m.rarity, m.mode], [2_000_000, 500, 'or']);
});

test('judgeDropFor: each destination uses its own filters; a hook with none follows the person', () => {
  const c = ctx(); // person: 1m or 1/1,000
  const item = { id: 3, name: 'Mid', qty: 1, value: 300_000 };
  const hooks = [
    { id: 1, minValue: null, minRarity: null, mode: null }, // follows the person
    { id: 2, minValue: 250_000, minRarity: null, mode: null }, // looser value
    { id: 3, minValue: 100_000_000, minRarity: null, mode: null }, // stricter value
  ];
  const mid = judgeDropFor(zulrah([item]), c, hooks);
  assert.ok(mid);
  assert.equal(mid.clan, false); // the person's own gate says no...
  assert.deepEqual(mid.hooks, [2]); // ...but the looser webhook still gets it
  const rich = judgeDropFor(zulrah([richCommon]), c, hooks);
  assert.ok(rich);
  assert.equal(rich.clan, true);
  assert.deepEqual(rich.hooks, [1, 2]); // 3 wants 100m+
  // Nothing anywhere: no verdict.
  assert.equal(judgeDropFor(zulrah([cheapCommon]), c, hooks), null);
  // A webhook can ask for both while the person takes either.
  const strict = judgeDropFor(zulrah([richCommon]), c, [{ id: 9, minValue: null, minRarity: null, mode: 'and' }]);
  assert.ok(strict);
  assert.deepEqual([strict.clan, strict.hooks], [true, []]);
});

test('pluginMe: the screenshot gate is the loosest of the person and their drop webhooks', () => {
  const flags = { rareDrops: true };
  const me = pluginMe(NOTIFY_DEFAULTS, flags, NO_CLAN_DROPS, null, [{ id: 1, minValue: 200_000, minRarity: 500, mode: null }]);
  assert.equal(me.dropMin, 200_000);
  assert.equal(me.floor, 500);
  assert.equal(pluginMe(NOTIFY_DEFAULTS, flags, NO_CLAN_DROPS, null, []).dropMin, 1_000_000);
});

test('a drop below the clan gate but above a webhook filter reaches only that webhook, never a clan channel', () => {
  const item = { id: 3, name: 'Mid', qty: 1, value: 300_000 }; // person/clan gate 1m: declined
  const verdict = judgeDropFor(zulrah([item]), ctx(), [{ id: 7, minValue: 250_000, minRarity: null, mode: null }]);
  assert.ok(verdict);
  assert.equal(verdict.clan, false);
  assert.deepEqual(verdict.hooks, [7]);
  // Whatever put clan channels in the send list (the clan itself, a guest clan, a mode channel)...
  const urls = new Map<string, number | undefined>([
    ['https://clan.example/drops', 1],
    ['https://guest.example/drops', 2],
    ['https://me.example/hook', undefined],
  ]);
  const kept = keepDropDestinations(urls, verdict);
  assert.deepEqual([...kept.keys()], ['https://me.example/hook']);
  // A drop the clan gate accepts keeps every destination; an unjudged post is untouched.
  const rich = judgeDropFor(zulrah([richCommon]), ctx(), []);
  assert.equal(keepDropDestinations(urls, rich).size, 3);
  assert.equal(keepDropDestinations(urls, null).size, 3);
});
