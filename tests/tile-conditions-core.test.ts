// Pure tests for the site half of tile conditions: checking a tile save's conditions, the raid keys
// the rule table hands the plugin, parsing raid / kill / loot facts, judging them (match.ts), the
// submissions they plan into, and the "can take it" lines. No database.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  conditionedForPlugin,
  conditionsKindError,
  raidFactsSupportedBy,
  raidKeys,
  RAID_KEY_MODES,
  startCountOfSnapshot,
  takeLine,
  teamTakeLine,
  tileStartKeys,
  validateConditions,
} from '@/lib/tileConditionsCheck';
import type { TileConditions } from '@/lib/tileConditions';
import { matchFacts, type DropTile, type KillTile, type RaidTile, type Tracked } from '@/lib/pluginFacts/match';
import { parseFacts } from '@/lib/pluginFacts/parse';
import { buildRuleTable } from '@/lib/pluginFacts/rules';
import { planSubmissions } from '@/lib/pluginFacts/plan';
import { panelTiles } from '@/lib/pluginPanel';
import { isJudged, markJudged } from '@/lib/pluginFacts/judged';

const board = { eventId: 1, teamId: 2, playerId: 3 };

function raidTile(c: TileConditions, extra: Partial<RaidTile> = {}): RaidTile {
  return { tileId: 10, label: 'Raid tile', requiredAmount: 3, currentAmount: 0, conditions: c, keys: raidKeys(c), ...extra };
}

// ─── Saving ──────────────────────────────────────────────────────────────────────────────────────

test('validateConditions keeps known fields and checks ranges', () => {
  const ok = validateConditions({ v: 1, raids: [{ raid: 'cox', modes: ['cm'], under: 1800, challenge: true, party: { op: 'gte', n: 3 }, scale: 3, junk: 1 }], noDeaths: true, shared: 'together', mates: { min: 2 } });
  assert.ok(ok.ok);
  assert.deepEqual(ok.value, { v: 1, raids: [{ raid: 'cox', modes: ['cm'], under: 1800, party: { op: 'gte', n: 3 }, challenge: true, scale: 3 }], noDeaths: true, mates: { min: 2 }, shared: 'together' });
  // From a JSON string too, and an empty object stores as nothing.
  assert.deepEqual(validateConditions(JSON.stringify({ v: 1 })), { ok: true, value: null });
  assert.deepEqual(validateConditions(null), { ok: true, value: null });
  const bad = (c: unknown) => assert.equal(validateConditions(c).ok, false, JSON.stringify(c));
  bad({ v: 2 });
  bad({ v: 1, raids: [1, 2, 3, 4, 5].map(() => ({ raid: 'tfa', modes: ['normal'] })) });
  bad({ v: 1, raids: [{ raid: 'cox', modes: [] }] });
  bad({ v: 1, raids: [{ raid: 'cox', modes: ['hard'] }] });
  bad({ v: 1, raids: [{ raid: 'cox', modes: ['normal'], under: 0 }] });
  bad({ v: 1, raids: [{ raid: 'cox', modes: ['normal'], under: 6 * 3600 + 1 }] });
  bad({ v: 1, raids: [{ raid: 'tob', modes: ['normal'], party: { op: 'eq', n: 6 } }] });
  bad({ v: 1, raids: [{ raid: 'tob', modes: ['normal'], scale: 3 }] });
  bad({ v: 1, raids: [{ raid: 'cox', modes: ['normal'], challenge: true }] });
  bad({ v: 1, raids: [{ raid: 'toa', toa: { min: 601, entry: false } }] });
  bad({ v: 1, startCount: { op: 'lt', n: 100_001 } });
  bad({ v: 1, startCount: { op: 'lt', n: 0 } });
  bad({ v: 1, toaLevel: { min: -1, entry: false } });
  assert.ok(validateConditions({ v: 1, raids: [{ raid: 'toa', toa: { min: 300, entry: true, op: 'eq' } }] }).ok);
});

test('conditionsKindError keeps each condition on its kind', () => {
  const raid: TileConditions = { v: 1, raids: [{ raid: 'tfa', modes: ['normal'] }] };
  assert.equal(conditionsKindError('raid', raid, false), null);
  assert.match(conditionsKindError('raid', null, false)!, /at least one raid/);
  assert.match(conditionsKindError('kill', raid, false)!, /raid tile/);
  assert.equal(conditionsKindError('kill', { v: 1, startCount: { op: 'lt', n: 1 } }, false), null);
  assert.match(conditionsKindError('kill', { v: 1, startCount: { op: 'lt', n: 1 } }, true)!, /plugin/);
  assert.match(conditionsKindError('lap', { v: 1, startCount: { op: 'lt', n: 1 } }, false)!, /Only raid and kill/);
  assert.match(conditionsKindError('clog', { v: 1, startCount: { op: 'lt', n: 1 } }, false)!, /Only raid and kill/);
  assert.equal(conditionsKindError('drop', { v: 1, toaLevel: { min: 300, entry: false } }, false), null);
  assert.match(conditionsKindError('kill', { v: 1, toaLevel: { min: 300, entry: false } }, false)!, /drop tiles/);
});

// ─── Keys and gates ──────────────────────────────────────────────────────────────────────────────

test('raidKeys lists every mode of each picked raid, so a CM clear arrives under its own name', () => {
  assert.deepEqual(raidKeys({ v: 1, raids: [{ raid: 'cox', modes: ['normal'] }] }).sort(), ['chambers of xeric', 'chambers of xeric challenge mode']);
  assert.equal(raidKeys({ v: 1, raids: [{ raid: 'toa', toa: { min: 300, entry: false } }] }).length, 3);
  assert.deepEqual(RAID_KEY_MODES.get('theatre of blood: hard mode'), { raid: 'tob', mode: 'hard' });
  assert.deepEqual(RAID_KEY_MODES.get('fractured archive'), { raid: 'tfa', mode: 'normal' });
});

test('raid facts need plugin 1.17.2; only judged requests may credit a conditioned tile', () => {
  assert.equal(raidFactsSupportedBy('1.17.2'), true);
  assert.equal(raidFactsSupportedBy('1.18.0'), true);
  assert.equal(raidFactsSupportedBy('1.17.1'), false);
  assert.equal(raidFactsSupportedBy(null), false);
  assert.equal(conditionedForPlugin({ tileType: 'raid', conditions: null }), true);
  assert.equal(conditionedForPlugin({ tileType: 'kill', conditions: JSON.stringify({ v: 1, startCount: { op: 'lt', n: 1 } }) }), true);
  assert.equal(conditionedForPlugin({ tileType: 'kill', conditions: null }), false);
  // A request from the network is never one the facts route marked, whatever it carries.
  const raw = new Request('https://x.test/api/events/1/submissions', { method: 'POST', headers: { 'x-judged': '1' } });
  assert.equal(isJudged(raw), false);
  assert.equal(isJudged(markJudged(new Request('https://x.test/'))), true);
});

// ─── Parsing ─────────────────────────────────────────────────────────────────────────────────────

test('parseFacts reads raid facts, kill count lines and loot raid levels', () => {
  const facts = parseFacts([
    { k: 'raid', key: 'Chambers of Xeric', sec: 1800, party: 3, scale: 4, deaths: 0, mates: 2, all: true, kc: 7, id: 'abcdefgh12345678' },
    { k: 'raid', key: 42 },
    { k: 'kill', n: { 'TzKal-Zuk': 1 }, c: { 'TzKal-Zuk': 3, bad: -1 } },
    { k: 'loot', src: 'Tombs of Amascut', kind: 'event', items: [[27277, 1]], lvl: 350, deaths: 1 },
  ]);
  assert.equal(facts.length, 3);
  assert.deepEqual({ ...facts[0], id: undefined }, { k: 'raid', key: 'chambers of xeric', sec: 1800, party: 3, scale: 4, deaths: 0, lvl: undefined, mates: 2, all: true, kc: 7, id: undefined });
  assert.deepEqual((facts[1] as { c?: unknown }).c, { 'TzKal-Zuk': 3 });
  assert.equal((facts[2] as { lvl?: number }).lvl, 350);
  assert.equal((facts[2] as { deaths?: number }).deaths, 1);
});

// ─── Judging ─────────────────────────────────────────────────────────────────────────────────────

test('a raid clear that meets its pick credits once; a refused one says why', () => {
  const c: TileConditions = { v: 1, raids: [{ raid: 'cox', modes: ['normal'], under: 1800 }], noDeaths: true };
  const t: Tracked = { trackedRaids: [raidTile(c)] };
  const ok = matchFacts([{ k: 'raid', key: 'chambers of xeric', sec: 1700, deaths: 0 }], t);
  assert.equal(ok.credits.length, 1);
  assert.equal(ok.credits[0].kind, 'raid');
  assert.equal(ok.credits[0].have, 1);
  const slow = matchFacts([{ k: 'raid', key: 'chambers of xeric', sec: 1900, deaths: 0 }], t);
  assert.equal(slow.credits.length, 0);
  assert.deepEqual(slow.notes, ['Not counted: Raid tile: 31:40, needs under 30:00.']);
  const died = matchFacts([{ k: 'raid', key: 'chambers of xeric', sec: 1000, deaths: 2 }], t);
  assert.deepEqual(died.notes, ['Not counted: Raid tile: 2 deaths in the party.']);
  // The CM line names its own key now, and a Normal-only pick refuses it in words.
  const cm = matchFacts([{ k: 'raid', key: 'chambers of xeric challenge mode', sec: 1000, deaths: 0 }], t);
  assert.deepEqual(cm.notes, ['Not counted: Raid tile: Challenge Mode does not count here.']);
  // A key the tile doesn't list is someone else's business.
  assert.equal(matchFacts([{ k: 'raid', key: 'theatre of blood', sec: 1 }], t).notes.length, 0);
});

test('ToA picks go by the level; teammates and shared rules apply', () => {
  const c: TileConditions = { v: 1, raids: [{ raid: 'toa', toa: { min: 300, entry: false } }], mates: { min: 2 } };
  const t: Tracked = { trackedRaids: [raidTile(c)] };
  assert.equal(matchFacts([{ k: 'raid', key: 'tombs of amascut: expert mode', lvl: 350, mates: 2 }], t).credits.length, 1);
  assert.deepEqual(matchFacts([{ k: 'raid', key: 'tombs of amascut', lvl: 250, mates: 2 }], t).notes, ['Not counted: Raid tile: raid level 250, needs 300+.']);
  assert.deepEqual(matchFacts([{ k: 'raid', key: 'tombs of amascut: expert mode', lvl: 400, mates: 1 }], t).notes, ['Not counted: Raid tile: 1 of the team inside, needs 2.']);
});

test('start counts: the event-start count decides, else the clear or kill count line', () => {
  const c: TileConditions = { v: 1, raids: [{ raid: 'tfa', modes: ['normal'] }], startCount: { op: 'lt', n: 1 } };
  const known = matchFacts([{ k: 'raid', key: 'fractured archive', kc: 1 }], { trackedRaids: [raidTile(c, { startCount: 4 })] });
  assert.deepEqual(known.notes, ['Not counted: Raid tile: you had 4 clears when it started.']);
  const unknownFirst = matchFacts([{ k: 'raid', key: 'fractured archive', kc: 1 }], { trackedRaids: [raidTile(c, { startCount: null })] });
  assert.equal(unknownFirst.credits.length, 1);
  const unknownThird = matchFacts([{ k: 'raid', key: 'fractured archive', kc: 3 }], { trackedRaids: [raidTile(c, { startCount: null })] });
  assert.deepEqual(unknownThird.notes, ["Not counted: Raid tile: this was clear 3, so you'd done it before."]);

  const kill = (start: number | null): KillTile => ({ tileId: 20, label: 'First Inferno', requiredAmount: 1, currentAmount: 0, targetNpcs: ['TzKal-Zuk'], conditions: { v: 1, startCount: { op: 'lt', n: 1 } }, startCount: start });
  assert.deepEqual(matchFacts([{ k: 'kill', n: { 'TzKal-Zuk': 1 } }], { trackedKills: [kill(12)] }).notes, ['Not counted: First Inferno: you had 12 kills when it started.']);
  assert.equal(matchFacts([{ k: 'kill', n: { 'TzKal-Zuk': 1 }, c: { 'TzKal-Zuk': 1 } }], { trackedKills: [kill(null)] }).credits.length, 1);
  assert.deepEqual(matchFacts([{ k: 'kill', n: { 'TzKal-Zuk': 1 }, c: { 'TzKal-Zuk': 3 } }], { trackedKills: [kill(null)] }).notes, ["Not counted: First Inferno: this was kill 3, so you'd done it before."]);
  // No count line and no baseline: refused, never assumed.
  const neither = matchFacts([{ k: 'kill', n: { 'TzKal-Zuk': 1 } }], { trackedKills: [kill(null)] });
  assert.equal(neither.credits.length, 0);
  assert.deepEqual(neither.notes, ["Not counted: First Inferno: your kill count wasn't seen; make sure the game's kill count messages are on."]);
  assert.deepEqual(matchFacts([{ k: 'raid', key: 'fractured archive' }], { trackedRaids: [raidTile(c, { startCount: null })] }).notes, ["Not counted: Raid tile: your clear count wasn't seen; make sure the game's clear count messages are on."]);
  // A credit whose conditions were checked here is marked so; only those may file on a conditioned tile.
  assert.equal(matchFacts([{ k: 'kill', n: { 'TzKal-Zuk': 1 }, c: { 'TzKal-Zuk': 1 } }], { trackedKills: [kill(null)] }).credits[0].judged, true);
  // "Over 50": the 52nd kill is the first that had more than 50 before it.
  const over: KillTile = { ...kill(null), conditions: { v: 1, startCount: { op: 'gt', n: 50 } } };
  assert.equal(matchFacts([{ k: 'kill', n: { 'TzKal-Zuk': 1 }, c: { 'TzKal-Zuk': 51 } }], { trackedKills: [over] }).credits.length, 0);
  assert.equal(matchFacts([{ k: 'kill', n: { 'TzKal-Zuk': 1 }, c: { 'TzKal-Zuk': 52 } }], { trackedKills: [{ ...over }] }).credits.length, 1);
});

test('a tile fact the plugin judged itself never credits a conditioned tile', () => {
  // A replayed older proof (`note`) may name any tracked tile, a kill tile with a start count included.
  const kill: KillTile = { tileId: 20, label: 'First Inferno', requiredAmount: 1, currentAmount: 0, targetNpcs: ['TzKal-Zuk'], conditions: { v: 1, startCount: { op: 'lt', n: 1 } }, startCount: 12 };
  const out = matchFacts([{ k: 'tile', t: 20, n: 1, note: '[Auto] Zuk kill' }], { trackedKills: [kill] });
  assert.equal(out.credits.length, 0);
  assert.deepEqual(out.notes, ['Not counted: First Inferno: this tile counts only clears and kills the site has checked.']);
  // An unconditioned one still goes through, unmarked.
  const plain = matchFacts([{ k: 'tile', t: 21, n: 1, note: 'x' }], { trackedKills: [{ ...kill, tileId: 21, conditions: null }] });
  assert.equal(plain.credits.length, 1);
  assert.equal(plain.credits[0].judged, undefined);
});

test('a ToA-level drop tile reads the loot raid level', () => {
  const drop = (): DropTile => ({ tileId: 30, label: 'Shadow at 400', requiredAmount: 1, currentAmount: 0, itemIds: [27277], conditions: { v: 1, toaLevel: { min: 400, entry: false } } });
  const loot = (lvl?: number) => ({ k: 'loot' as const, src: 'Tombs of Amascut', kind: 'event' as const, items: [[27277, 1]] as [number, number][], ...(lvl != null ? { lvl } : {}) });
  assert.equal(matchFacts([loot(450)], { trackedDrops: [drop()] }).credits.length, 1);
  assert.deepEqual(matchFacts([loot(300)], { trackedDrops: [drop()] }).notes, ['Not counted: Shadow at 400: raid level 300, needs 400+.']);
  assert.deepEqual(matchFacts([loot()], { trackedDrops: [drop()] }).notes, ['Not counted: Shadow at 400: the raid level was not seen.']);
});

// ─── Rules, plans, rows ──────────────────────────────────────────────────────────────────────────

test('the rule table emits site-judged raid rules, only to plugins that send raid facts', () => {
  const c: TileConditions = { v: 1, raids: [{ raid: 'cox', modes: ['cm'] }] };
  const cfg = { trackedRaids: [raidTile(c, { currentAmount: 1 })] };
  const rules = buildRuleTable(cfg).events.filter((e) => e.on === 'raid');
  assert.deepEqual(rules, [{ t: 10, label: 'Raid tile', have: 1, of: 3, on: 'raid', keys: ['chambers of xeric', 'chambers of xeric challenge mode'], site: true }]);
  assert.equal(buildRuleTable(cfg, { raidFacts: false }).events.length, 0);
  assert.equal(buildRuleTable({ trackedRaids: [raidTile(c, { needsPlugin: true } as Partial<RaidTile>)] }).events.length, 0);
  // A first-only kill tile the player is known to be out of isn't watched; an unknown one is.
  const first = (start: number | null): KillTile => ({ tileId: 20, label: 'First Inferno', requiredAmount: 1, currentAmount: 0, targetNpcs: ['TzKal-Zuk'], conditions: { v: 1, startCount: { op: 'lt', n: 1 } }, startCount: start });
  assert.equal(Object.keys(buildRuleTable({ trackedKills: [first(12)] }).kills).length, 0);
  assert.ok(buildRuleTable({ trackedKills: [first(null)] }).kills['tzkal-zuk']);
  // A ToA-level drop is never counted locally, and not watched at all by an older plugin.
  const drop: DropTile = { tileId: 30, label: 'Shadow', requiredAmount: 1, currentAmount: 0, itemIds: [27277], conditions: { v: 1, toaLevel: { min: 400, entry: false } } };
  assert.equal(buildRuleTable({ trackedDrops: [drop] }).drops['27277'][0].simple, false);
  assert.equal(buildRuleTable({ trackedDrops: [drop] }, { raidFacts: false }).drops['27277'], undefined);
});

test('a raid credit plans one submission with its clear time and company', () => {
  const c: TileConditions = { v: 1, raids: [{ raid: 'cox', modes: ['normal'] }], shared: 'together' };
  const m = matchFacts([{ k: 'raid', key: 'chambers of xeric', sec: 1500, party: 3 }, { k: 'raid', key: 'chambers of xeric', sec: 1400, party: 3 }], { trackedRaids: [raidTile(c)] });
  const plans = planSubmissions(m.credits, () => board, null, null, { teammates: ['bob'] });
  assert.equal(plans.length, 2);
  assert.equal(plans[0].body.amount, 1);
  assert.equal(plans[0].body.durationSeconds, 1500);
  assert.equal(plans[0].body.coopPartySize, 3);
  assert.deepEqual(plans[0].body.coopGroup, ['bob']);
  assert.match(String(plans[0].body.note), /Chambers Of Xeric clear in 25:00/);
});

test('can-take lines for the panel and the team board', () => {
  const bar = { op: 'lt' as const, n: 1 };
  assert.deepEqual(takeLine(bar, null), { ok: true, line: 'You can take this' });
  assert.deepEqual(takeLine(bar, 12), { ok: false, line: 'Not for you: 12 kills at the start' });
  assert.equal(teamTakeLine('Team Bandos', [{ name: 'a', start: 0 }, { name: 'b', start: null }, { name: 'c', start: 5 }], bar), '2 of 3 on Team Bandos can take it: a, b.');
  assert.equal(teamTakeLine('Team Bandos', [{ name: 'c', start: 5 }], bar), 'Nobody on the team can take this');
  const snap = JSON.stringify({ bosses: { tzKalZuk: { score: 12 }, chambersOfXeric: { score: -1 } } });
  assert.equal(startCountOfSnapshot(snap, tileStartKeys({ tileType: 'kill', targetNpcs: JSON.stringify(['TzKal-Zuk']) })), 12);
  assert.equal(startCountOfSnapshot(snap, tileStartKeys({ tileType: 'raid', conditions: JSON.stringify({ v: 1, raids: [{ raid: 'cox', modes: ['normal'] }] }) })), null);
  // The row's line rides `sets`, which every client draws under the bar.
  const rows = panelTiles({ trackedRaids: [{ tileId: 1, label: 'R', points: 1, position: 0, description: null, currentAmount: 0, requiredAmount: 2, take: 'Needs the latest Anvil plugin' }] });
  assert.equal(rows[0].sets, 'Needs the latest Anvil plugin');
});
