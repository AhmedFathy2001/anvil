import assert from 'node:assert/strict';
import test from 'node:test';

import { eventFeedFloor, panelFeedWorthy } from '../src/lib/moments.ts';
import { chatFeedId, chatLockFeeds, chatRow, feedTabUi, modeFeedId, modeMomentFeedIds, momentFeedIds, momentRow } from '../src/lib/pluginUi/feedUi.ts';

const drop = (valueGp: number | null, extra: Record<string, unknown> = {}) => ({
  id: 1,
  rsn: 'Rikkert',
  kind: 'unique',
  itemId: 22877,
  itemName: 'Dragonfruit tree seed',
  quantity: 1,
  valueGp,
  source: 'Seed pack',
  teamId: null,
  occurredAt: '2026-11-04 10:00:00',
  ...extra,
});

test('a priced drop must clear the floor, rare or not', () => {
  assert.equal(panelFeedWorthy(drop(200_000), 5_000_000), false, 'the 200k seed stays out');
  assert.equal(panelFeedWorthy(drop(6_000_000), 5_000_000), true);
  assert.equal(panelFeedWorthy(drop(1, { kind: 'pet' }), 5_000_000), true, 'pets always');
  assert.equal(panelFeedWorthy(drop(null, { kind: 'ca' }), 5_000_000), true, 'other kinds are the caller’s rule');
});

test('a board’s floor rises with its size', () => {
  assert.equal(eventFeedFloor(20), 1_000_000);
  assert.equal(eventFeedFloor(150), 3_000_000);
  assert.equal(eventFeedFloor(600), 5_000_000);
  assert.equal(eventFeedFloor(2000), 10_000_000);
});

test('a moment names every list it belongs in', () => {
  assert.deepEqual(momentFeedIds({ kind: 'clan', id: 3 }, 'loot', null), ['moments:clan:3', 'moments:clan:3:drops']);
  assert.deepEqual(momentFeedIds({ kind: 'event', id: 9 }, 'pet', 4), ['moments:event:9', 'moments:event:9:pets', 'moments:event:9:team:4']);
});

test('game modes stay behind one quiet doorway, then reuse the familiar filters', () => {
  const clan = { kind: 'clan' as const, id: 3, slug: 'afk', name: 'The AFK Spot' };
  const ordinary = JSON.stringify(feedTabUi({
    scopes: [clan], current: clan, pane: 'feed', chatAvailable: false, filter: 'all', teamId: null,
    rows: [], mode: { active: false, count: 6 },
  }));
  assert.match(ordinary, /Game-mode activity · 6/);
  assert.match(ordinary, /"bg":"raised"[^}]*"on":\{"a":"load","v":"feed","args":\{"s":"clan:afk","p":"feed","m":"1"/, 'the mode doorway is a raised row that opens it');
  assert.doesNotMatch(ordinary, /moments:clan:3:modes/);

  const modes = JSON.stringify(feedTabUi({
    scopes: [clan], current: clan, pane: 'feed', chatAvailable: false, filter: 'pets', teamId: null,
    rows: [], mode: {
      active: true, count: 6, selected: 'hardcore',
      options: [{ key: 'hardcore', label: 'Hardcore' }, { key: 'leagues', label: 'Leagues' }],
    },
  }));
  assert.match(modes, /All game modes/);
  assert.match(modes, /Hardcore/);
  assert.match(modes, /Leagues/);
  assert.match(modes, /moments:clan:3:modes:mode:hardcore:pets/);
  for (const label of ['All', 'Drops', 'Pets', 'Achievements', 'Deaths']) assert.match(modes, new RegExp(label));
  assert.match(modes, /Separate from main-game progress/);
  assert.deepEqual(modeMomentFeedIds(3, 'pet', 'leagues'), [
    modeFeedId(3), modeFeedId(3, 'pets'), modeFeedId(3, undefined, 'leagues'), modeFeedId(3, 'pets', 'leagues'),
  ]);
  assert.deepEqual(modeMomentFeedIds(3, 'death', 'hardcore'), [
    modeFeedId(3), modeFeedId(3, 'deaths'), modeFeedId(3, undefined, 'hardcore'), modeFeedId(3, 'deaths', 'hardcore'), 'moments:clan:3:deaths',
  ]);
});

test('a game-mode row wears a compact mode tag', () => {
  const row = momentRow(drop(null, { worldMode: 'leagues', worldModeLabel: 'Leagues' }));
  assert.equal(row.tag, 'Leagues');
  assert.equal(row.tagColor, 'brand');
});

test('achievement rows use compact titles and their native game icons', () => {
  const base = { ...drop(null), itemId: null, itemName: null, source: null };
  const total = momentRow({ ...base, kind: 'level', quantity: 375, sourceKind: 'total' });
  assert.equal(total.title, '375 total');
  assert.equal(total.sprite, 'total');
  const legacyTotal = momentRow({
    ...base,
    kind: 'mode',
    itemName: "Congratulations, you've reached a total level of 375.",
  });
  assert.equal(legacyTotal.title, '375 total', 'already-stored raw announcements are cleaned too');
  assert.equal(legacyTotal.sprite, 'total');

  const level = momentRow({ ...base, kind: 'level', itemName: 'Prayer', quantity: 99, sourceKind: 'skill' });
  assert.equal(level.title, '99 Prayer');
  assert.equal(level.skill, 'prayer');

  const quest = momentRow({ ...base, kind: 'quest', itemName: 'The Tourist Trap' });
  assert.equal(quest.title, 'The Tourist Trap');
  assert.equal(quest.sprite, 'quest');
  const diary = momentRow({ ...base, kind: 'diary', itemName: 'Varrock', tier: 'Hard' });
  assert.equal(diary.title, 'Hard Varrock');
  assert.equal(diary.sprite, 'diary');
  const ca = momentRow({ ...base, kind: 'ca', itemName: 'No Pressure', tier: 'Elite' });
  assert.equal(ca.title, 'Elite: No Pressure');
  assert.equal(ca.sprite, 'combat');
});

test('a chat line goes to its channel’s list; locks name every channel or only the talking ones', () => {
  assert.equal(chatFeedId(9, 'all'), 'chat:9:all');
  assert.equal(chatFeedId(9, 'team:4'), 'chat:9:team:4');
  assert.equal(chatFeedId(9, 'announce'), 'chat:9:announce');
  assert.deepEqual(chatLockFeeds(9, 'every'), ['chat:9']);
  assert.deepEqual(chatLockFeeds(9, 'talk'), ['chat:9:all', 'chat:9:team'], 'a pause never touches Announcements');
});

test('a moment row reads as item, who, value, time', () => {
  const r = momentRow(drop(4_100_000, { itemName: 'Tanzanite fang' }), { team: { name: 'Ruby', color: '#cf4a3e' } });
  assert.equal(r.id, 'm1');
  assert.equal(r.title, 'Tanzanite fang');
  assert.equal(r.who, 'Rikkert');
  assert.equal(r.value, '4.1m');
  assert.equal(r.tag, 'Ruby');
  assert.equal(r.item, 22877);
  const stack = momentRow(drop(3_000_000, { quantity: 3, itemName: 'Zulrah scales' }));
  assert.equal(stack.title, '3 × Zulrah scales');
  assert.equal(stack.value, '3.0m', 'the stack’s worth');
});

test('a chat row: HOST and MOD tags, a team’s name otherwise, mod menu only when given', () => {
  const base = { id: 5, rsn: 'Kev', body: 'hi', createdAt: '2026-11-04 10:00:00' };
  assert.equal(chatRow(base, { role: 'mod' }).tag, 'MOD');
  assert.equal(chatRow(base, { role: 'host' }).tag, 'HOST');
  assert.equal(chatRow(base, { team: { name: 'Ruby', color: null } }).tag, 'Ruby');
  assert.equal(chatRow(base).menu, undefined);
  const del = { a: 'post' as const, act: 'chat-del', args: {} };
  assert.equal(chatRow(base, { modActions: { del, mute: del } }).menu?.length, 2);
});

test('the chat pane carries the send box; the feed pane its floor line', () => {
  const scopes = [
    { kind: 'clan' as const, id: 3, slug: 'afk', name: 'The AFK Spot' },
    { kind: 'event' as const, id: 9, name: 'Winter Bingo' },
  ];
  const chat = JSON.stringify(
    feedTabUi({
      scopes,
      current: scopes[1],
      pane: 'chat',
      chatAvailable: true,
      filter: 'team:4',
      teamId: 4,
      rows: [],
      send: { act: 'chat-send', args: { e: '9', to: 'team:4' }, hint: 'x' },
      chans: [{ label: 'My team', on: true, act: { a: 'load', v: 'feed' }, feed: 'chat:9:team:4' }, { label: 'All teams', on: false, act: { a: 'load', v: 'feed' }, feed: 'chat:9:all', n: 3, blue: true }],
      lock: { locked: 'You’re timed out · 9m left', sub: 'You can still read along.', warn: true },
    }),
  );
  assert.match(chat, /"t":"feed","id":"chat:9:team:4"/);
  assert.match(chat, /"send":\{"act":"chat-send"/);
  assert.match(chat, /"chans":\[\{"label":"My team","on":true/);
  assert.match(chat, /"locked":"You’re timed out · 9m left","lockSub":"You can still read along.","lockWarn":true/);
  const feed = JSON.stringify(feedTabUi({ scopes, current: scopes[0], pane: 'feed', chatAvailable: false, filter: 'drops', teamId: null, rows: [], floorNote: 'Drops ≥ 5m' }));
  assert.match(feed, /"id":"moments:clan:3:drops"/);
  assert.match(feed, /Drops ≥ 5m/);
  assert.doesNotMatch(feed, /"label":"Chat"|"s":"Chat"/, 'no chat chip off a board');
});

test('more than one clan or board: a dropdown of all of them, on the one showing', () => {
  const scopes = [
    { kind: 'clan' as const, id: 1, slug: 'afk', name: 'The AFK Spot' },
    { kind: 'event' as const, id: 9, name: 'Chat Test' },
    { kind: 'clan' as const, id: 2, slug: 'other', name: 'Other Clan' },
    { kind: 'event' as const, id: 12, name: 'Summer Bingo' },
  ];
  const ui = feedTabUi({ scopes, current: scopes[3], pane: 'feed', chatAvailable: false, filter: 'all', teamId: null, rows: [], floorNote: 'x' }) as unknown as { c: Record<string, unknown>[] };
  const top = ui.c[0] as unknown as { card: boolean; c: Record<string, unknown>[] };
  assert.ok(top.card, 'the scope picker sits in the top card');
  const select = top.c.find((n) => n.t === 'input') as { kind: string; name: string; value: string; options: { v: string; label: string }[] };
  assert.equal(select.kind, 'select');
  assert.equal(select.name, 's', 'the choice rides the load as the scope');
  assert.equal(select.value, 'event:12');
  assert.deepEqual(select.options.map((o) => o.label), ['Clan · The AFK Spot', 'Event · Chat Test', 'Clan · Other Clan', 'Event · Summer Bingo']);
  const one = JSON.stringify(feedTabUi({ scopes: [scopes[0]], current: scopes[0], pane: 'feed', chatAvailable: false, filter: 'all', teamId: null, rows: [], floorNote: 'x' }));
  assert.doesNotMatch(one, /"kind":"select"/, 'one scope is a heading, not a dropdown');
  const boostedClan = { kind: 'clan' as const, id: 1, slug: 'afk', name: 'The AFK Spot', boostLevel: 2 };
  const boosted = JSON.stringify(feedTabUi({ scopes: [boostedClan], current: boostedClan, pane: 'feed', chatAvailable: false, filter: 'all', teamId: null, rows: [], floorNote: 'x' }));
  assert.match(boosted, /"grad":\["#ffd27a","#ff7ab8","#7ae0ff"\],"move":true/);

  const markedClan = { ...scopes[0], logo: true };
  const marked = JSON.stringify(feedTabUi({ scopes: [markedClan], current: markedClan, pane: 'feed', chatAvailable: false, filter: 'all', teamId: null, rows: [], floorNote: 'x', images: true }));
  assert.match(marked, /kind=logo/);
  assert.match(marked, /"rad":8,"motion":true/, "the hero badge: a rounded-square logo");
});

test('a finished tile: its row, its lists, and a Tiles chip on a board only', async () => {
  const { completionRow, completionFeedIds } = await import('../src/lib/pluginUi/feedUi.ts');
  const row = completionRow({ tileId: 7, teamId: 4, label: 'Abyssal whip', who: 'Drenvox', team: { name: 'Jade', color: '#2ecc71' }, at: '2026-11-04T01:00:00Z', mine: true });
  assert.equal(row.id, 't7:4', 'one row per tile and team: live and reopened agree');
  assert.equal(row.title, 'Abyssal whip', 'the check glyph says complete');
  assert.equal(row.who, 'Drenvox', 'the team rides the tag, not the name too');
  assert.equal(row.tag, 'Jade');
  assert.equal(completionRow({ tileId: 7, teamId: 4, label: 'x', who: null, team: { name: 'Jade', color: null }, at: 'x' }).who, 'Jade', 'no finisher: the team');
  assert.deepEqual(completionFeedIds(9, 4), ['moments:event:9', 'moments:event:9:tiles', 'moments:event:9:team:4']);
  const board = { kind: 'event' as const, id: 9, name: 'Chat Test' };
  const clan = { kind: 'clan' as const, id: 1, slug: 'afk', name: 'The AFK Spot' };
  const onBoard = JSON.stringify(feedTabUi({ scopes: [board], current: board, pane: 'feed', chatAvailable: false, filter: 'all', teamId: 4, rows: [], floorNote: 'x' }));
  assert.match(onBoard, /"label":"Tiles"|"Tiles"/);
  const onClan = JSON.stringify(feedTabUi({ scopes: [clan], current: clan, pane: 'feed', chatAvailable: false, filter: 'all', teamId: null, rows: [], floorNote: 'x' }));
  assert.doesNotMatch(onClan, /Tiles/);
});

test("a board page's Feed and Chat open that board's feed, with a way back", async () => {
  const { boardFeedLinks } = await import('../src/lib/pluginUi/feedUi.ts');
  const links = boardFeedLinks(9, { open: 'board', label: 'Chat Test' }) as unknown as { c: { label: string; on: { v: string; args: Record<string, string> } }[] };
  assert.deepEqual(links.c.map((b) => b.label), ['Feed', 'Chat']);
  assert.deepEqual(links.c[1].on, { a: 'load', v: 'feed', args: { s: 'event:9', p: 'chat', back: 'board', backLabel: 'Chat Test' } });
  const bare = boardFeedLinks(9) as unknown as { c: { on: { args: Record<string, string> } }[] };
  assert.equal(bare.c[0].on.args.back, undefined, 'no back unless asked');
});

test('a tile row names who and which team; a death reads as one and has its own list', async () => {
  const { completionRow, momentRow, momentFeedIds, kindGroup } = await import('../src/lib/pluginUi/feedUi.ts');
  const row = completionRow({ tileId: 1, teamId: 2, label: 'Lap of seers', who: 'Drenvox', team: { name: 'Lab', color: null }, at: 'x' });
  assert.equal(row.who, 'Drenvox', 'the plugin prints the team tag after the name');
  assert.equal(kindGroup('death'), 'deaths');
  const death = momentRow({ id: 5, rsn: 'Mossy', kind: 'death', itemId: null, itemName: null, quantity: 1, valueGp: null, source: 'Vorkath', occurredAt: 'x', teamId: 2 } as never);
  assert.equal(death.title, 'Died to Vorkath');
  assert.ok(momentFeedIds({ kind: 'event', id: 9 }, 'death', 2).includes('moments:event:9:deaths'));
});

test('a death row offers Sad and Sit, never a GZ; every other row keeps its GZ', async () => {
  const { momentRow, rowReactKinds } = await import('../src/lib/pluginUi/feedUi.ts');
  assert.deepEqual(rowReactKinds('death'), ['sad', 'sit']);
  assert.deepEqual(rowReactKinds('pet'), ['gz']);
  assert.deepEqual(rowReactKinds('unique'), ['gz']);
  const asked: string[] = [];
  const reacts = {
    tally: (k: string) => (asked.push(k), k === 'sit' ? { n: 3, mine: true } : { n: 0, mine: false }),
    act: (k: string) => ({ a: 'post' as const, act: 'react-row', args: { slug: 'c', id: '5', kind: k } }),
  };
  const death = momentRow({ id: 5, rsn: 'Mossy', kind: 'death', itemId: null, itemName: null, quantity: 1, valueGp: null, source: 'Vorkath', occurredAt: 'x', teamId: null }, { reacts });
  assert.equal(death.gz, undefined, 'an older plugin draws no GZ on a death');
  assert.deepEqual(death.reacts, [
    { kind: 'sad', label: 'Sad', n: 0, mine: false, on: { a: 'post', act: 'react-row', args: { slug: 'c', id: '5', kind: 'sad' } } },
    { kind: 'sit', label: 'Sit', n: 3, mine: true, on: { a: 'post', act: 'react-row', args: { slug: 'c', id: '5', kind: 'sit' } } },
  ]);
  assert.ok(!asked.includes('gz'), 'a GZ is never asked for on a death');
  asked.length = 0;
  const pet = momentRow(drop(null, { kind: 'pet', itemName: 'Pet snakeling' }), { reacts });
  assert.deepEqual(pet.gz, { n: 0, mine: false, on: { a: 'post', act: 'react-row', args: { slug: 'c', id: '5', kind: 'gz' } } });
  assert.equal(pet.reacts, undefined);
  assert.deepEqual(asked, ['gz']);
  const unseen = momentRow({ id: 6, rsn: 'Mossy', kind: 'death', itemId: null, itemName: null, quantity: 1, valueGp: null, source: null, occurredAt: 'x', teamId: null });
  assert.equal(unseen.reacts, undefined, 'no reactions for someone who may not react');
  assert.equal(unseen.gz, undefined);
});

test('a live moment row carries its reaction chip, with the action the opened list gives', async () => {
  const { freshReacts, momentRow, reactRowAction } = await import('../src/lib/pluginUi/feedUi.ts');
  const like = { id: 42, rsn: 'Mossy', itemId: 4151, itemName: 'Abyssal whip', quantity: 1, valueGp: 2_000_000, source: null, teamId: null, occurredAt: '2026-11-05T10:00:00Z' };
  const drop = momentRow({ ...like, kind: 'unique' }, { reacts: freshReacts({ slug: 'theafkspot' }, 42) });
  assert.deepEqual(drop.gz, { n: 0, mine: false, on: { a: 'post', act: 'react-row', args: { slug: 'theafkspot', id: '42', kind: 'gz' } } });
  assert.deepEqual(drop.gz?.on, reactRowAction({ slug: 'theafkspot' }, 42, 'gz'));
  const death = momentRow({ ...like, kind: 'death', itemId: null }, { reacts: freshReacts({ e: 9 }, 42) });
  assert.deepEqual(death.reacts?.map((r) => [r.kind, r.n, r.on]), [
    ['sad', 0, { a: 'post', act: 'react-row', args: { e: '9', id: '42', kind: 'sad' } }],
    ['sit', 0, { a: 'post', act: 'react-row', args: { e: '9', id: '42', kind: 'sit' } }],
  ]);
  assert.equal(freshReacts({ e: 9 }, -3), undefined, 'a lab row has nothing to react to');
});

test('board Feed/Chat: on the Feed tab for a plugin that can, in place (with a way back) otherwise', async () => {
  const { boardFeedLinks, feedTabUi } = await import('../src/lib/pluginUi/feedUi.ts');
  const tab = JSON.stringify(boardFeedLinks(9, { open: 'board', label: 'Lab' }, true));
  assert.match(tab, /"a":"tab","tab":"feed","args":\{"s":"event:9","p":"chat"\}/);
  assert.doesNotMatch(tab, /backLabel/);
  const inPlace = JSON.stringify(boardFeedLinks(9, { open: 'board', label: 'Lab' }));
  assert.match(inPlace, /"a":"load","v":"feed"/);
  assert.match(inPlace, /"backLabel":"Lab"/);
  const board = { kind: 'event' as const, id: 9, name: 'Lab' };
  const closed = JSON.stringify(feedTabUi({ scopes: [board], current: board, pane: 'feed', chatAvailable: false, chatClosed: 'The host hasn’t turned chat on for this event.', filter: 'all', teamId: 4, rows: [], floorNote: 'x' }));
  assert.match(closed, /turned chat on/);
});

test('a board with chat off gets only the Feed button', async () => {
  const { boardFeedLinks } = await import('../src/lib/pluginUi/feedUi.ts');
  const off = JSON.stringify(boardFeedLinks(9, undefined, true, false));
  assert.doesNotMatch(off, /Chat/);
  assert.match(off, /"label":"Feed"|Feed/);
  assert.match(JSON.stringify(boardFeedLinks(9, undefined, true, true)), /This board’s chat/);
});

test("a stack's value is shown once, not times its quantity", async () => {
  const { momentRow } = await import('../src/lib/pluginUi/feedUi.ts');
  const row = momentRow({ id: 9, rsn: 'Drenvox', kind: 'drop', itemId: 995, itemName: 'Coins', quantity: 100_000_000, valueGp: 100_000_000, source: 'Loot Chest', occurredAt: 'x', teamId: null } as never);
  assert.equal(row.value, '100m');
});
