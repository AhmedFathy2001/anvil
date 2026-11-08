import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  globNumber,
  hookKindsOn,
  matchWatch,
  NO_CLAN_KINDS,
  NO_PERSONAL_KINDS,
  noShotList,
  normalizeClanKinds,
  normalizePatterns,
  normalizePersonalKinds,
  PATTERN_LIMITS,
  patternProblem,
  PRIVATE_KINDS,
  resolveKind,
  resolveShot,
  watchesFor,
  NEW_KINDS,
} from '../src/lib/notifyKinds.ts';
import { factsAsPoster, vetNewKindPost } from '../src/lib/notifyKindsPost.ts';
import { NO_CLAN_DROPS, NOTIFY_DEFAULTS, normalizeNotifyPrefs, pluginMe } from '../src/lib/notifyPrefs.ts';

const me = (raw: unknown) => normalizePersonalKinds(raw);
const clan = (raw: unknown) => normalizeClanKinds(raw);

test('every new kind is off on Anvil’s side, and the original kinds keep their screenshots', () => {
  for (const k of NEW_KINDS) assert.equal(resolveKind(k).on, false, k);
  for (const k of NEW_KINDS) assert.equal(resolveKind(k).sources.on, 'platform', k);
  assert.deepEqual(noShotList(), []);
  assert.deepEqual(watchesFor(), []);
  assert.deepEqual(hookKindsOn(), {});
  // The original kinds are untouched: still on by default.
  assert.equal(NOTIFY_DEFAULTS.pets && NOTIFY_DEFAULTS.deaths && NOTIFY_DEFAULTS.clog && NOTIFY_DEFAULTS.levels, true);
});

test('a kind resolves personal, then clan default, then Anvil', () => {
  const c = clan({ kinds: { kc: { on: true, every: 50 } } });
  let r = resolveKind('kc', NO_PERSONAL_KINDS, c);
  assert.deepEqual([r.on, r.every, r.sources.on, r.sources.every, r.sources.shot], [true, 50, 'clan', 'clan', 'platform']);
  r = resolveKind('kc', me({ kinds: { kc: { every: 250 } } }), c);
  assert.deepEqual([r.on, r.every, r.sources.on, r.sources.every], [true, 250, 'clan', 'custom']);
  r = resolveKind('kc', me({ kinds: { kc: { on: false } } }), c);
  assert.equal(r.on, false);
  // Reset = the kind removed from the person's settings: back to the clan's.
  assert.equal(resolveKind('kc', me({ kinds: {} }), c).every, 50);
  // No clan: Anvil's numbers.
  assert.equal(resolveKind('kc', me({ kinds: { kc: { on: true } } })).every, 100);
});

test('GE, trades, group storage and other plugins are the player’s alone', () => {
  for (const k of PRIVATE_KINDS) assert.equal(resolveKind(k).on, false, k);
  // A clan can't store them…
  const c = clan({ kinds: { ge: { on: true }, trade: { on: true }, storage: { on: true }, ext: { on: true }, kc: { on: true } } });
  assert.deepEqual(Object.keys(c.kinds), ['kc']);
  // …and even a crafted clan value is never read for them.
  const forged = { ...NO_CLAN_KINDS, kinds: { ge: { on: true, shot: true }, trade: { on: true, shot: true } } } as never;
  assert.equal(resolveKind('ge', NO_PERSONAL_KINDS, forged).on, false);
  assert.equal(resolveKind('trade', NO_PERSONAL_KINDS, forged).on, false);
  assert.deepEqual(hookKindsOn(NO_PERSONAL_KINDS), {});
  // The player turns them on for themselves.
  const p = me({ kinds: { ge: { on: true, min: 5_000_000 }, trade: { on: true }, storage: { on: true }, ext: { on: true } }, extSources: ['Loot Logger'] });
  assert.deepEqual(hookKindsOn(p), { ge: 5_000_000, trade: 0, storage: 0, ext: 0 });
  // Other plugins need at least one allowed name.
  assert.deepEqual(hookKindsOn(me({ kinds: { ext: { on: true } } })), {});
  // Their screenshots are off by default too.
  assert.deepEqual(noShotList(p), ['ge', 'trade', 'storage']);
});

test('private posts are declined unless the player turned them on, and never reach a clan', () => {
  const facts = { rsn: 'Zezima', item: 'Twisted bow', qty: 1, value: 1_200_000_000, sold: true };
  assert.equal(vetNewKindPost('ge', facts, NO_PERSONAL_KINDS, clan({ kinds: { ge: { on: true } } })), null);
  const p = me({ kinds: { ge: { on: true } } });
  const ok = vetNewKindPost('ge', facts, p, NO_CLAN_KINDS);
  assert.ok(ok);
  assert.equal(ok.personalOnly, true);
  assert.match(ok.embed.description ?? '', /sold \*\*1 × Twisted bow\*\* for \*\*1,200,000,000 gp\*\*/);
  // Under the player's floor.
  assert.equal(vetNewKindPost('ge', { ...facts, value: 10 }, p, NO_CLAN_KINDS), null);
  const trade = vetNewKindPost('trade', { rsn: 'Zezima', items: [{ id: 995, name: 'Coins', qty: -500, value: -500 }, { id: 4151, name: 'Abyssal whip', qty: 1, value: 1_500_000 }] }, me({ kinds: { trade: { on: true } } }), NO_CLAN_KINDS);
  assert.ok(trade);
  assert.equal(trade.personalOnly, true);
  assert.deepEqual(trade.embed.fields?.map((f) => f.name), ['Gave (500 gp)', 'Got (1,500,000 gp)']);
  assert.equal(vetNewKindPost('storage', { items: [{ name: 'Coins', qty: 5, value: 5 }] }, NO_PERSONAL_KINDS, NO_CLAN_KINDS), null);
  // Another plugin: only a name the player allowed, with markdown and mentions defused.
  const ext = me({ kinds: { ext: { on: true } }, extSources: ['Loot Logger'] });
  assert.equal(vetNewKindPost('ext', { source: 'Evil plugin', text: 'hi' }, ext, NO_CLAN_KINDS), null);
  const e = vetNewKindPost('ext', { rsn: 'Zezima', source: 'loot logger', text: '@everyone **[click](x)**' }, ext, NO_CLAN_KINDS);
  assert.ok(e);
  assert.ok(!(e.embed.description ?? '').includes('@everyone'));
  assert.ok(!(e.embed.description ?? '').includes('['));
});

test('chat patterns: validated, capped, and matched without regex', () => {
  assert.equal(patternProblem('You have a funny feeling*'), null);
  assert.equal(patternProblem('Your * count is: #'), null);
  assert.match(patternProblem('ab') ?? '', /At least/);
  assert.match(patternProblem('x'.repeat(PATTERN_LIMITS.max + 1)) ?? '', /At most/);
  assert.match(patternProblem('* # * # *') ?? '', /letters or digits/);
  assert.match(patternProblem('<col=ff0000>hi there') ?? '', /Plain text/);
  const many = Array.from({ length: 30 }, (_, i) => `Pattern number ${i}*`);
  assert.equal(normalizePatterns(many).length, PATTERN_LIMITS.count);
  assert.deepEqual(normalizePatterns(['Hello world', 'hello WORLD', 'ab', 7, 'Spaced***out']), ['Hello world', 'Spaced*out']);
  // The matcher is the plugin's: * any text, # a number, case ignored.
  assert.equal(globNumber('Your * count is: #*', 'Your Zulrah kill count is: 1,234.'), 1234);
  assert.equal(globNumber('You have a funny feeling*', 'you have a FUNNY feeling like you would have been followed...'), 0);
  assert.equal(globNumber('You have a funny feeling*', 'You have a strange feeling'), -1);
  // A hostile pattern costs at most pattern x line steps.
  const t0 = Date.now();
  assert.equal(globNumber('*a*a*a*a*a*a*a*a*a*a*a*a*a*b', 'a'.repeat(400)), -1);
  assert.ok(Date.now() - t0 < 200);
});

test('each line kind’s watch reads the real game line, gate included', () => {
  const on = (k: string, extra: object = {}) => me({ kinds: { [k]: { on: true, ...extra } } });
  const lines = {
    slayer: "You've completed 50 tasks and received 15 points, giving you a total of 1,234; return to a Slayer master.",
    clues: 'You have completed 100 hard Treasure Trails.',
    speedruns: 'Fight duration: 1:23.40 (new personal best)',
    kc: 'Your Zulrah kill count is: 500.',
    ba: 'High level gamble count: 100.',
  } as const;
  for (const [k, line] of Object.entries(lines)) {
    const hit = matchWatch(line, k, watchesFor(on(k)));
    assert.ok(hit, `${k}: ${line}`);
  }
  // KC every 100: 500 posts, 501 doesn't.
  assert.equal(matchWatch('Your Zulrah kill count is: 501.', 'kc', watchesFor(on('kc'))), null);
  // Clues from elite up: a hard one doesn't.
  assert.equal(matchWatch(lines.clues, 'clues', watchesFor(on('clues', { tier: 'elite' }))), null);
  assert.ok(matchWatch('You have completed 3 master Treasure Trails.', 'clues', watchesFor(on('clues', { tier: 'elite' }))));
  // Speedruns: PBs only by default; any time when turned off.
  assert.equal(matchWatch('Fight duration: 1:30.00. Personal best: 1:23.40', 'speedruns', watchesFor(on('speedruns'))), null);
  assert.ok(matchWatch('Fight duration: 1:30.00. Personal best: 1:23.40', 'speedruns', watchesFor(on('speedruns', { pbOnly: false }))));
  // Slayer every 10th task.
  assert.equal(matchWatch(lines.slayer.replace('50', '51'), 'slayer', watchesFor(on('slayer', { every: 10 }))), null);
});

test('a newer-kind post carries the token character’s name, never the body’s rsn', () => {
  const kcOn = me({ kinds: { kc: { on: true } } });
  const body = { rsn: 'Zezima', k: 'kc', line: 'Your Zulrah kill count is: 500.' };
  const post = vetNewKindPost('line', factsAsPoster(body, 'Realme'), kcOn, NO_CLAN_KINDS);
  assert.ok(post);
  assert.equal(post.embed.author?.name, 'Realme');
  assert.doesNotMatch(post.embed.description ?? '', /Zezima/);
  // No resolvable character: no name at all, rather than the body's.
  const anon = vetNewKindPost('line', factsAsPoster(body, null), kcOn, NO_CLAN_KINDS);
  assert.ok(anon);
  assert.equal(anon.embed.author, undefined);
  assert.deepEqual(factsAsPoster('junk', 'Realme'), { rsn: 'Realme' });
});

test('a reported line posts only if one of the person’s own watches matches it now', () => {
  const kcOn = me({ kinds: { kc: { on: true } } });
  assert.equal(vetNewKindPost('line', { k: 'kc', line: 'Your Zulrah kill count is: 500.' }, NO_PERSONAL_KINDS, NO_CLAN_KINDS), null);
  const post = vetNewKindPost('line', { rsn: 'Zezima', k: 'kc', line: 'Your Zulrah kill count is: 500.' }, kcOn, NO_CLAN_KINDS);
  assert.ok(post);
  assert.equal(post.personalOnly, false);
  assert.match(post.embed.description ?? '', /\*\*500\*\* — Zulrah kill count/);
  // A tampered line that no watch matches.
  assert.equal(vetNewKindPost('line', { k: 'kc', line: 'Buy gold at example.com' }, kcOn, NO_CLAN_KINDS), null);
  // Custom: the clan's pattern goes to the clan, the person's own only to their webhooks.
  const c = clan({ kinds: { custom: { on: true } }, patterns: ['You feel something weird sneaking*'] });
  const p = me({ patterns: ['You have a funny feeling*'] });
  assert.equal(vetNewKindPost('line', { k: 'custom', line: 'You feel something weird sneaking up on you.' }, p, c)?.personalOnly, false);
  assert.equal(vetNewKindPost('line', { k: 'custom', line: 'You have a funny feeling like you would have been followed.' }, p, c)?.personalOnly, true);
  assert.equal(vetNewKindPost('line', { k: 'custom', line: 'Something else entirely.' }, p, c), null);
});

test('screenshots per kind: personal, then clan default, then on', () => {
  assert.deepEqual(resolveShot('drops'), { shot: true, source: 'platform' });
  const c = clan({ shots: { deaths: false } });
  assert.deepEqual(resolveShot('deaths', NO_PERSONAL_KINDS, c), { shot: false, source: 'clan' });
  assert.deepEqual(resolveShot('deaths', me({ shots: { deaths: true } }), c), { shot: true, source: 'custom' });
  assert.deepEqual(noShotList(me({ shots: { levels: false, pvp: false } })), ['level', 'totalLevel', 'pvpKills']);
});

test('the plugin gets watches, screenshot switches and private kinds in `me`', () => {
  const prefs = normalizeNotifyPrefs({ announce: { kinds: { ba: { on: true, shot: false }, ge: { on: true } }, shots: { drops: false } } });
  const m = pluginMe(prefs, {}, NO_CLAN_DROPS, null, [], clan({ kinds: { kc: { on: true, every: 1000 } } }));
  assert.deepEqual(
    m.watch.map((w) => [w.k, w.g, w.every, w.shot]),
    [
      ['kc', 'Your * count is: #*', 1000, true],
      ['ba', '*gamble count: #*', 100, false],
    ],
  );
  assert.deepEqual(m.noShot, ['drop', 'ge']);
  assert.deepEqual(m.on, { ge: 1_000_000 });
  // Nothing set: nothing new.
  const d = pluginMe(normalizeNotifyPrefs(null), {}, NO_CLAN_DROPS, null);
  assert.deepEqual([d.watch, d.noShot, d.on], [[], [], {}]);
});

test('feed rows: a shared kind that is on makes one; off, private or a personal pattern makes none', async () => {
  const { milestoneForFeed } = await import('../src/lib/notifyKindsPost.ts');
  const { momentRow, kindGroup } = await import('../src/lib/pluginUi/feedUi.ts');
  const line = { rsn: 'Zezima', k: 'kc', line: 'Your Zulrah kill count is: 500.' };
  const on = me({ kinds: { kc: { on: true } } });
  const f = milestoneForFeed('line', line, on, NO_CLAN_KINDS);
  assert.deepEqual(f, { sub: 'kc', itemName: 'Zulrah kill count', quantity: 500, tier: null });
  // Off for this player (the clan default on, their own choice off): no row.
  assert.equal(milestoneForFeed('line', line, me({ kinds: { kc: { on: false } } }), clan({ kinds: { kc: { on: true } } })), null);
  assert.equal(milestoneForFeed('line', line, NO_PERSONAL_KINDS, NO_CLAN_KINDS), null);
  // On through the clan default: a row.
  assert.ok(milestoneForFeed('line', line, NO_PERSONAL_KINDS, clan({ kinds: { kc: { on: true } } })));
  // Private kinds never make a row, even when on.
  const all = me({ kinds: { ge: { on: true }, trade: { on: true }, storage: { on: true }, ext: { on: true } }, extSources: ['X'] });
  assert.equal(milestoneForFeed('ge', { item: 'Twisted bow', qty: 1, value: 2e9 }, all, NO_CLAN_KINDS), null);
  assert.equal(milestoneForFeed('trade', { items: [{ name: 'Coins', qty: 5, value: 5 }] }, all, NO_CLAN_KINDS), null);
  assert.equal(milestoneForFeed('ext', { source: 'X', text: 'hi' }, all, NO_CLAN_KINDS), null);
  // A player's own pattern stays on their webhooks; the clan's pattern is a feed row.
  const c = clan({ kinds: { custom: { on: true } }, patterns: ['You feel something weird sneaking*'] });
  const p = me({ patterns: ['You have a funny feeling*'] });
  assert.equal(milestoneForFeed('line', { k: 'custom', line: 'You have a funny feeling like you would have been followed.' }, p, c), null);
  assert.equal(milestoneForFeed('line', { k: 'custom', line: 'You feel something weird sneaking up on you.' }, p, c)?.sub, 'custom');

  // The panel row: its own group, blue like other info rows, the stored facts as its title.
  assert.equal(kindGroup('milestone'), 'milestones');
  const row = momentRow({ id: 1, rsn: 'Zezima', kind: 'milestone', itemId: null, itemName: f!.itemName, quantity: f!.quantity, valueGp: null, source: null, teamId: null, occurredAt: '2026-11-08T10:00:00.000Z', sourceKind: 'kc', tier: null });
  assert.equal(row.title, 'Zulrah kill count 500');
  assert.equal(row.textColor, '#6fb6ff');
  const slayer = milestoneForFeed('line', { k: 'slayer', line: "You've completed 50 tasks and received 15 points, giving you a total of 1,234; return to a Slayer master." }, me({ kinds: { slayer: { on: true } } }), NO_CLAN_KINDS)!;
  const sr = momentRow({ id: 2, rsn: 'Zezima', kind: 'milestone', itemId: null, itemName: slayer.itemName, quantity: slayer.quantity, valueGp: null, source: null, teamId: null, occurredAt: '2026-11-08T10:00:00.000Z', sourceKind: 'slayer', tier: null });
  assert.equal(sr.title, 'Slayer task · 50 streak');
  assert.equal(sr.skill, 'slayer');
});
