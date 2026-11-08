// Pure tests for the notify settings that moved off the plugin: prefs resolution (lib/notifyPrefs) and
// the drop judge that replaced the plugin's maybeNotifyRareDrop (lib/notifyDrops). No database.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NOTIFY_DEFAULTS,
  NO_CLAN_DROPS,
  dropGates,
  normalizeNotifyPrefs,
  parseNotifyPrefs,
  pluginMe,
  prefsFromRuneLite,
} from '../src/lib/notifyPrefs';
import { deservesSpoonLine, dropRarity, isGuaranteed, isTrollDrop, judgeDrop, rareTable, type JudgeContext } from '../src/lib/notifyDrops';

const ALL_ON = {
  rareDrops: true, deaths: true, combatAchievements: true, pvpKills: true, pets: true,
  levels: true, quests: true, diaries: true, collectionLog: true,
};
const noNames = () => undefined;
const ctx = (over: Partial<JudgeContext> = {}): JudgeContext => ({
  prefs: NOTIFY_DEFAULTS, clan: NO_CLAN_DROPS, mode: null, guaranteed: {}, nameOf: noNames, ...over,
});

test('defaults are the plugin config defaults; junk normalises back to them', () => {
  assert.deepEqual(normalizeNotifyPrefs(null), NOTIFY_DEFAULTS);
  assert.deepEqual(parseNotifyPrefs('{not json'), NOTIFY_DEFAULTS);
  const p = normalizeNotifyPrefs({ dropMin: -5, ca: 'NOPE', quests: 'OFF', deathMsg: '  ', drops: 'false' });
  assert.equal(p.dropMin, 0);
  assert.equal(p.ca, 'MASTER');
  assert.equal(p.quests, 'OFF');
  assert.equal(p.deathMsg, '{name} just died!');
  assert.equal(p.drops, false);
});

test('RuneLite upload maps the old keys, including the 1/5000 → 1/10000 bump', () => {
  const p = prefsFromRuneLite({
    notifyRareDrops: 'false', rareDropMinValue: '2000000', rareDropMinRarity: '5000', notifyPvpKills: 'true',
    caMinTaskTier: 'ELITE', questAnnounce: 'ALL', deathMessage: 'rip {name}',
  });
  assert.equal(p.drops, false);
  assert.equal(p.dropMin, 2_000_000);
  assert.equal(p.rarity, null); // never migrated: the old shipped default, so it inherits
  assert.equal(p.pvp, true);
  assert.equal(p.ca, 'ELITE');
  assert.equal(p.quests, 'ALL');
  assert.equal(p.deathMsg, 'rip {name}');
  assert.equal(p.clog, true); // missing keys keep the default
  assert.equal(prefsFromRuneLite({ rareDropMinRarity: '5000', configDefaultsVersion: '1' }).rarity, 5000);
});

test('me: person AND clan channel, floors enforced, tiers expanded', () => {
  const me = pluginMe({ ...NOTIFY_DEFAULTS, dropMin: 10, rarity: 200, ca: 'ELITE', quests: 'ALL' }, { ...ALL_ON, deaths: false }, NO_CLAN_DROPS, null);
  assert.equal(me.dropMin, 1_000_000); // never below 1m
  assert.equal(me.floor, 1000); // never looser than 1/1000
  assert.equal(me.deaths, false); // the clan switched deaths off
  assert.equal(me.pets, true); // pets ride the person's switch only
  assert.deepEqual(me.ca, ['ELITE', 'MASTER', 'GRANDMASTER']);
  assert.deepEqual(me.quests, ['*']);
  assert.deepEqual(pluginMe({ ...NOTIFY_DEFAULTS, quests: 'EXPERIENCED' }, ALL_ON, NO_CLAN_DROPS, null).quests, ['EXPERIENCED', 'MASTER', 'GRANDMASTER']);
  assert.deepEqual(pluginMe({ ...NOTIFY_DEFAULTS, ca: 'OFF' }, ALL_ON, NO_CLAN_DROPS, null).ca, []);
  assert.deepEqual(pluginMe(NOTIFY_DEFAULTS, { ...ALL_ON, combatAchievements: false }, NO_CLAN_DROPS, null).ca, []);
  assert.equal(pluginMe(NOTIFY_DEFAULTS, null, NO_CLAN_DROPS, null).drops, false);
});

test('rarity floor: the clan can tighten, never loosen, and off stays off', () => {
  const hard = (n: number) => ({ ...NO_CLAN_DROPS, hardFloor: n });
  assert.equal(dropGates({ ...NOTIFY_DEFAULTS, rarity: 2000 }, hard(50_000)).rarity, 50_000);
  assert.equal(dropGates({ ...NOTIFY_DEFAULTS, rarity: 20_000 }, hard(5_000)).rarity, 20_000);
  assert.equal(dropGates({ ...NOTIFY_DEFAULTS, rarity: 0 }, hard(5_000)).rarity, 0);
  // A mode's own looser thresholds open the gate further.
  const me = pluginMe(NOTIFY_DEFAULTS, ALL_ON, NO_CLAN_DROPS, { dropMinValue: 500_000, dropRarityFloor: 500 });
  assert.equal(me.dropMin, 500_000);
  assert.equal(me.floor, 500);
});

test('value gate: a valuable drop posts alone with its spoon line; a cheap one does not post', () => {
  const big = judgeDrop({ source: 'Goblin', sourceKind: 'npc', items: [{ id: 1, name: 'Shiny', qty: 1, value: 60_000_000 }] }, ctx());
  assert.ok(big);
  assert.equal((big.items as unknown[]).length, 1);
  assert.equal(big.spoon, true);
  assert.equal(big.dropRate, null);
  assert.equal(judgeDrop({ source: 'Goblin', sourceKind: 'npc', items: [{ id: 1, name: 'Bones', qty: 1, value: 100 }] }, ctx()), null);
  // Drops off entirely.
  assert.equal(judgeDrop({ items: [{ id: 1, name: 'Shiny', qty: 1, value: 60_000_000 }] }, ctx({ prefs: { ...NOTIFY_DEFAULTS, drops: false } })), null);
});

test('rarity: a 1/4000 pet-tier roll clears 1/1000; one of two rolls at 1/1024 (~1/512) does not; both rolls do', () => {
  const prefs = { ...NOTIFY_DEFAULTS, rarity: 1000, dropMin: 0 };
  const jar = { id: 12921, name: 'Pet snakeling', qty: 1, value: 0 };
  const rate = dropRarity('npc', 'Zulrah', jar, noNames);
  assert.equal(rate, 1 / 4000);
  const post = judgeDrop({ source: 'Zulrah', sourceKind: 'npc', kc: 3000, items: [jar] }, ctx({ prefs }));
  assert.ok(post);
  assert.equal(post.dropRate, rate);
  assert.equal(post.troll, true); // a rare roll worth nothing
  // At the default 1/10000 it no longer qualifies on rarity.
  assert.equal(judgeDrop({ source: 'Zulrah', sourceKind: 'npc', items: [jar] }, ctx({ prefs: { ...prefs, rarity: 10_000 } })), null);
  const fang = { id: 12922, name: 'Tanzanite fang', qty: 1, value: 0 };
  assert.equal(judgeDrop({ source: 'Zulrah', sourceKind: 'npc', items: [fang] }, ctx({ prefs })), null);
  assert.ok(judgeDrop({ source: 'zulrah', sourceKind: 'npc', items: [{ ...fang, qty: 2 }] }, ctx({ prefs })));
  // Rarity never applies to a source kind without a table.
  assert.equal(dropRarity('event', 'Zulrah', jar, noNames), null);
});

test('several qualifying items make one combined post; the haul total decides the spoon line', () => {
  const post = judgeDrop(
    { source: 'X', sourceKind: 'npc', note: 'roll', items: [{ id: 1, name: 'A', qty: 1, value: 30_000_000 }, { id: 2, name: 'B', qty: 1, value: 25_000_000 }] },
    ctx(),
  );
  assert.ok(post);
  assert.equal((post.items as unknown[]).length, 2);
  assert.equal(post.spoon, true);
  assert.equal(post.note, undefined); // the vestige line rides single posts only, as before
});

test('loot keys: one post for the lot, gated only by the total', () => {
  const items = [{ id: 1, name: 'Coins', qty: 1, value: 600_000 }, { id: 2, name: 'Rune', qty: 1, value: 500_000 }];
  assert.ok(judgeDrop({ key: true, source: 'Loot key', items }, ctx()));
  assert.equal(judgeDrop({ key: true, source: 'Loot key', items }, ctx({ prefs: { ...NOTIFY_DEFAULTS, keyMin: 2_000_000 } })), null);
  assert.equal(judgeDrop({ key: true, source: 'Loot key', items }, ctx({ prefs: { ...NOTIFY_DEFAULTS, keyMin: 0 } })), null);
});

test('guaranteed drops get no spoon or troll line; modeOnly marks a post only a mode let through', () => {
  const item = { id: 1, name: 'Ancient blood ornament kit', qty: 1, value: 60_000_000 };
  const post = judgeDrop({ source: 'Duke Sucellus', sourceKind: 'npc', items: [item] }, ctx({ guaranteed: { 'ancient blood ornament kit': ['duke sucellus'] } }));
  assert.ok(post);
  assert.equal(post.guaranteed, true);
  assert.equal(post.spoon, false);
  const modeOnly = judgeDrop(
    { source: 'X', sourceKind: 'npc', items: [{ id: 1, name: 'A', qty: 1, value: 500_000 }] },
    ctx({ mode: { dropMinValue: 400_000, dropRarityFloor: null } }),
  );
  assert.equal(modeOnly?.modeOnly, true);
  assert.equal(judgeDrop({ source: 'X', sourceKind: 'npc', items: [{ id: 1, name: 'A', qty: 1, value: 500_000 }] }, ctx()), null);
});

test('lucky-drop rules match the plugin DropLuck', () => {
  assert.equal(isTrollDrop(1 / 10_000, 35_000, 10_000), true);
  assert.equal(isTrollDrop(1 / 10_000, 5_000_000, 10_000), false);
  assert.equal(isTrollDrop(1 / 2_000, 5_000, 10_000), false);
  assert.equal(deservesSpoonLine('Infernal cape', 0, 1, 1), false);
  assert.equal(deservesSpoonLine('Twisted bow', 1_000_000_000, 1 / 512, 1500), true);
  assert.equal(deservesSpoonLine('Dragon spear', 35_000, 1 / 512, 20), true);
  assert.equal(deservesSpoonLine('Dragon spear', 35_000, 1 / 512, 1500), false);
  assert.equal(isGuaranteed({ kit: ['*'] }, 'Kit', null), true);
  assert.equal(isGuaranteed({ kit: ['duke'] }, 'Kit', 'Other'), false);
});

test('the rare screenshot gate lists every item judgeDrop could pass at that floor', () => {
  const t = rareTable(1000, new Map(), noNames);
  assert.ok(t.zulrah.includes(12921));
  assert.ok(t.zulrah.includes(267)); // 1/124.5 a roll, but both rolls at once is ~1/15500
  assert.ok(!t.zulrah.includes(23083)); // 1/50, one roll: never rare
  assert.deepEqual(rareTable(0, new Map(), noNames), {});
  // Variant ids sharing a listed item's name ride along.
  const named = rareTable(1000, new Map([['pet snakeling', [12921, 99999]]]), (id) => (id === 12921 ? 'Pet snakeling' : undefined));
  assert.ok(named.zulrah.includes(99999));
});

test('notable items post past every gate; earned and guaranteed ones get no spoon line', () => {
  const cape = judgeDrop({ source: null, items: [{ id: -1, name: 'Infernal cape', qty: 1, value: 0 }], notable: 'unlock' }, ctx());
  assert.equal(cape?.notable, 'unlock');
  assert.equal(cape?.earned, true);
  assert.equal(cape?.spoon, false);
  const shard = judgeDrop({ source: 'Vardorvis', sourceKind: 'npc', items: [{ id: 5, name: 'Blood shard', qty: 1, value: 0 }], notable: 'loot' }, ctx());
  assert.equal(shard?.spoon, true);
  assert.equal(judgeDrop({ items: [{ id: 5, name: 'Blood shard', qty: 1, value: 0 }], notable: 'loot' }, ctx({ prefs: { ...NOTIFY_DEFAULTS, drops: false } })), null);
});

test('screenshot privacy: PMs hidden by default, old rows and junk keys get the defaults', () => {
  assert.deepEqual(NOTIFY_DEFAULTS.hide, { pm: true, public: false, clanOthers: false, clanSelf: false, channel: false, group: false });
  // A row stored before the setting existed.
  assert.deepEqual(parseNotifyPrefs(JSON.stringify({ drops: false })).hide, NOTIFY_DEFAULTS.hide);
  const p = normalizeNotifyPrefs({ hide: { pm: false, clanSelf: 'true', group: 7, bogus: true } });
  assert.deepEqual(p.hide, { pm: false, public: false, clanOthers: false, clanSelf: true, channel: false, group: false });
  assert.equal('bogus' in p.hide, false);
  assert.deepEqual(normalizeNotifyPrefs({ hide: 'all' }).hide, NOTIFY_DEFAULTS.hide);
});

test('pluginMe sends screenshot privacy whatever the clan switches', () => {
  const prefs = normalizeNotifyPrefs({ hide: { public: true, channel: true } });
  const me = pluginMe(prefs, null, NO_CLAN_DROPS, null);
  assert.deepEqual(me.hide, { pm: true, public: true, clanOthers: false, clanSelf: false, channel: true, group: false });
  assert.notEqual(me.hide, prefs.hide);
  assert.deepEqual(pluginMe(NOTIFY_DEFAULTS, ALL_ON, NO_CLAN_DROPS, null).hide, NOTIFY_DEFAULTS.hide);
});
