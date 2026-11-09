// The website's Feed & chat page, pure (lib/liveView, lib/liveRows): the panel's rows and chat lines
// as the browser draws them — same words, same colours, same pictures.
//
// Run: npx tsx --test tests/live-view.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chanKey, clockLabel, cssColor, feedCount, FEED_MAX, FEED_PAGE, isoStamp } from '../src/lib/liveView.ts';
import { liveChatLine, liveEmptyLine, liveIcon, liveMomentRow, liveTileRow } from '../src/lib/liveRows.ts';
import { chatRow, momentRow, type MomentLike } from '../src/lib/pluginUi/feedUi.ts';

const moment = (o: Partial<MomentLike>): MomentLike => ({
  id: 7,
  rsn: 'Rikkert',
  kind: 'unique',
  itemId: 12_922,
  itemName: 'Tanzanite fang',
  quantity: 1,
  valueGp: 2_400_000,
  source: 'Zulrah',
  teamId: 4,
  occurredAt: '2026-11-09T12:00:00.000Z',
  ...o,
});

test('a drop reads as the panel’s row: title, picture, value, team, time', () => {
  const m = moment({});
  const row = liveMomentRow(m, { mine: true, team: { name: 'Ruby', color: '#cf4a3e' } });
  const panel = momentRow(m, { mine: true, team: { name: 'Ruby', color: '#cf4a3e' } });
  assert.equal(row.title, panel.title);
  assert.equal(row.value, panel.value);
  assert.equal(row.id, panel.id);
  assert.equal(row.momentId, 7);
  assert.deepEqual(row.icon, { src: '/img/item/12922.png', alt: 'Tanzanite fang' });
  assert.deepEqual(row.tag, { label: 'Ruby', color: '#cf4a3e' });
  // No Supporter look: the name wears the team's colour, as in the panel.
  assert.equal(row.ink, null);
  assert.equal(row.whoColor, '#cf4a3e');
  assert.equal(row.mine, true);
  assert.equal(row.at, '2026-11-09T12:00:00.000Z');
});

test('a Supporter’s colours win over the team’s; a moving gradient keeps moving', () => {
  const row = liveMomentRow(moment({}), {
    team: { name: 'Ruby', color: '#cf4a3e' },
    ink: { color: '#ff7ab8', grad: ['#ffd27a', '#ff7ab8', '#7ae0ff'], move: true },
  });
  assert.deepEqual(row.ink, { color: '#ff7ab8', grad: ['#ffd27a', '#ff7ab8', '#7ae0ff'], move: true });
  assert.equal(row.whoColor, null);
});

test('tones and pictures by kind: a pet purple, a death coral on the skull, a 99 green on its skill', () => {
  const pet = liveMomentRow(moment({ kind: 'pet', itemId: 12_921, itemName: 'Pet snakeling', valueGp: null }));
  assert.equal(pet.title, 'Pet: Pet snakeling');
  assert.equal(pet.titleColor, '#c79bff');
  assert.equal(pet.value, null);

  const death = liveMomentRow(moment({ kind: 'death', itemId: null, itemName: null, valueGp: null, source: 'Vorkath' }));
  assert.equal(death.title, 'Died to Vorkath');
  assert.equal(death.titleColor, '#ff7a6b');
  assert.deepEqual(death.icon, { src: '/img/item/964.png', alt: 'death' });

  const level = liveMomentRow(moment({ kind: 'level', itemId: null, itemName: 'Slayer', quantity: 99, valueGp: null }));
  assert.equal(level.title, '99 Slayer');
  assert.equal(level.titleColor, '#5fd35f');
  assert.equal((level.icon as { src: string }).src, '/img/wiki/Slayer_icon.png');

  const total = liveIcon(moment({ kind: 'level', itemId: null, itemName: null, quantity: 2_000, sourceKind: 'total', valueGp: null }));
  assert.equal((total as { src: string }).src, '/img/wiki/Stats_icon.png');
});

test('a collapsed run says how many, like the panel', () => {
  const row = liveMomentRow(moment({ kind: 'death', itemId: null, itemName: null, source: 'Zulrah', valueGp: null, run: { n: 3 } }));
  assert.match(row.title, /×3/);
});

test('a lab moment (negative id) has nothing to react to', () => {
  assert.equal(liveMomentRow(moment({ id: -4 })).momentId, null);
});

test('a finished tile: green, the finisher with the team as tag, or the team alone', () => {
  const done = liveTileRow({ tileId: 9, teamId: 4, label: 'Any Zulrah unique', who: 'Rikkert', team: { name: 'Ruby', color: '#cf4a3e' }, at: '2026-11-09 12:00:00' });
  assert.equal(done.id, 't9:4');
  assert.equal(done.titleColor, '#5fd35f');
  assert.deepEqual(done.tag, { label: 'Ruby', color: '#cf4a3e' });
  assert.equal(done.at, '2026-11-09T12:00:00Z');
  const teamOnly = liveTileRow({ tileId: 9, teamId: 4, label: 'Any Zulrah unique', who: null, team: { name: 'Ruby', color: '#cf4a3e' }, at: '2026-11-09T12:00:00Z' });
  assert.equal(teamOnly.who, 'Ruby');
  assert.equal(teamOnly.tag, null);
});

test('a chat line from the chat engine: tag, colours, mine, and the mod menu as canMod', () => {
  const act = { a: 'post' as const, act: 'chat-del' };
  const host = chatRow(
    { id: 31, rsn: 'Ada', body: 'tile 9 is live', createdAt: '2026-11-09 12:01:00' },
    { role: 'host', mine: true, whoColor: '#e05ad0', grad: ['#ff9a5a', '#e05ad0', '#7a8cff'] },
  );
  assert.deepEqual(liveChatLine(host), {
    id: 31,
    who: 'Ada',
    ink: { color: '#e05ad0', grad: ['#ff9a5a', '#e05ad0', '#7a8cff'] },
    tag: { label: 'HOST', color: '#ffb54d' },
    body: 'tile 9 is live',
    at: '2026-11-09T12:01:00Z',
    mine: true,
    canMod: false,
  });
  const player = chatRow(
    { id: 32, rsn: 'Saltbeard', body: 'gl all', createdAt: '2026-11-09 12:02:00' },
    { team: { name: 'Jade', color: '#3ecf62' }, modActions: { del: act, mute: act } },
  );
  const line = liveChatLine(player)!;
  assert.equal(line.ink, null, 'plain white is no Supporter look');
  assert.deepEqual(line.tag, { label: 'Jade', color: '#3ecf62' });
  assert.equal(line.canMod, true);
  assert.equal(line.mine, false);
  assert.equal(liveChatLine({ ...player, id: 'm32' }), null, 'only chat rows are lines');
});

test('empty lists say what the panel says', () => {
  assert.equal(liveEmptyLine('chat', 'team'), 'Nothing said to your team yet.');
  assert.equal(liveEmptyLine('chat', 'announce'), 'No announcements yet.');
  assert.equal(liveEmptyLine('feed', 'pets'), 'No pets yet. The next one lands here.');
});

test('helpers: colours, stamps, counts, channel keys, times', () => {
  assert.equal(cssColor('#AbCdEf'), '#AbCdEf');
  assert.equal(cssColor('muted'), null);
  assert.equal(cssColor('done'), '#5fd35f');
  assert.equal(isoStamp('2026-11-09 08:00:00'), '2026-11-09T08:00:00Z');
  assert.equal(isoStamp('2026-11-09T08:00:00.000Z'), '2026-11-09T08:00:00.000Z');
  assert.equal(feedCount(undefined), FEED_PAGE);
  assert.equal(feedCount('41'), FEED_PAGE * 2);
  assert.equal(feedCount(10_000), FEED_MAX);
  assert.equal(chanKey('team:4'), 'team');
  assert.equal(chanKey('all'), 'all');
  assert.equal(chanKey('announce'), 'announce');
  const noon = Date.parse('2026-11-09T12:00:00');
  assert.doesNotMatch(clockLabel(new Date(noon - 3_600_000).toISOString(), noon), /·/, 'today: just the time');
  assert.match(clockLabel(new Date(noon - 3 * 86_400_000).toISOString(), noon), /·/, 'before today: the day too');
  assert.equal(clockLabel('not a time'), '');
});
