// The stream overlay's rules and the `!join` bot's shared pieces — pure, no database.
//
// Run: npm run test:overlay

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  boardPayload,
  etagMatches,
  feedPayload,
  isOverlayKey,
  newOverlayKey,
  overlayEtag,
  parseOverlayOptions,
  safeColor,
  safeIcon,
  standingsPayload,
  type FeedItemIn,
} from '../src/lib/overlay/overlayView.ts';
import { overlayCsp, overlayHtml, scriptJson } from '../src/lib/overlay/overlayPage.ts';
import {
  ReplyLimiter,
  botSecret,
  cleanChatMessage,
  joinReplyText,
  joinTriggerOf,
  parseChatCommand,
  pickJoinEvent,
} from '../src/lib/twitchBot/wire.ts';

const UP = { hidden: false, revealAt: null };
const DOWN = { hidden: true, revealAt: '2026-12-01T18:00:00.000Z' };

// ── Keys ─────────────────────────────────────────────────────────────────────────────────────────

test('overlay keys are 32 url-safe characters and never repeat', () => {
  const a = newOverlayKey();
  const b = newOverlayKey();
  assert.equal(a.length, 32);
  assert.ok(isOverlayKey(a) && isOverlayKey(b));
  assert.notEqual(a, b);
});

test('anything not shaped like a key is refused before a query', () => {
  for (const bad of ['', 'short', `${'a'.repeat(31)}!`, `${'a'.repeat(33)}`, "x' OR 1=1 --xxxxxxxxxxxxxxxxxxxx", null, 42]) {
    assert.equal(isOverlayKey(bad), false, String(bad));
  }
});

// ── Options ──────────────────────────────────────────────────────────────────────────────────────

test('options are clamped and closed-set, never passed through', () => {
  const o = parseOverlayOptions(new URLSearchParams('view=evil&size=huge&limit=999&accent=red;}body{x&align=center&scale=abc'));
  assert.deepEqual(o, { view: 'standings', scale: 1, limit: 20, title: true, accent: '#e0aa1e', align: 'left' });
  const p = parseOverlayOptions(new URLSearchParams('view=feed&size=xl&accent=%23FF0000&title=0&align=right'));
  assert.equal(p.view, 'feed');
  assert.equal(p.scale, 1.7);
  assert.equal(p.limit, 6);
  assert.equal(p.accent, '#ff0000');
  assert.equal(p.title, false);
  assert.equal(p.align, 'right');
  assert.equal(parseOverlayOptions(new URLSearchParams('scale=9')).scale, 3);
  assert.equal(parseOverlayOptions(new URLSearchParams('scale=0.1')).scale, 0.5);
  assert.equal(parseOverlayOptions(new URLSearchParams('limit=0')).limit, 1);
});

// ── Visibility: the curtain ─────────────────────────────────────────────────────────────────────

const TEAMS = [
  { teamId: 1, name: 'Blue', color: '#0000ff', score: 4, total: 25, unit: 'tiles', pct: 16 },
  { teamId: 2, name: 'Red', color: 'red; background:url(x)', score: 9, total: 25, unit: 'tiles', pct: 36 },
  { teamId: 3, name: 'Green', color: null, score: 4, total: 25, unit: 'tiles', pct: 16 },
];

test('standings: ranked, ties share a rank, colours sanitised, limited', () => {
  const p = standingsPayload(TEAMS, UP, 2);
  assert.ok('rows' in p);
  assert.deepEqual(p.rows.map((r) => [r.rank, r.name]), [[1, 'Red'], [2, 'Blue']]);
  assert.match(p.rows[0].color, /^#[0-9a-f]{6}$/);
  const all = standingsPayload(TEAMS, UP, 10);
  assert.ok('rows' in all);
  assert.deepEqual(all.rows.map((r) => r.rank), [1, 2, 2]);
});

test('standings: the curtain hides every team, names included in order', () => {
  const p = standingsPayload(TEAMS, DOWN, 10);
  assert.ok('notice' in p);
  assert.match(p.notice, /hidden until/);
  assert.doesNotMatch(JSON.stringify(p), /Red|Blue|Green/);
  const atEnd = standingsPayload(TEAMS, { hidden: true, revealAt: null }, 10);
  assert.ok('notice' in atEnd && /end of the event/.test(atEnd.notice));
});

const FEED: FeedItemIn[] = [
  { id: 'm1', kind: 'moment', sub: 'drop', text: 'Twisted bow', who: 'Zezima', teamId: 1, teamName: 'Blue', teamColor: '#0000ff', icon: '/img/item/20997.png', at: '2026-11-01 10:00:00' },
  { id: 'm2', kind: 'moment', sub: 'death', text: 'Died to Zuk', who: 'Zezima', teamId: 1, teamName: 'Blue', teamColor: '#0000ff', icon: null, at: '2026-11-01 11:00:00' },
  { id: 't1', kind: 'tile', sub: 'tile', text: 'Tile complete: Jad', who: 'Lynx', teamId: 2, teamName: 'Red', teamColor: '#ff0000', icon: 'https://evil.example/x.png', at: '2026-11-01T12:00:00Z' },
];

test('feed: newest first, no deaths, only our own asset paths as icons', () => {
  const p = feedPayload(FEED, UP, 10);
  assert.ok('items' in p);
  assert.deepEqual(p.items.map((i) => i.id), ['t1', 'm1']);
  assert.equal(p.items[0].icon, null);
  assert.equal(p.items[1].icon, '/img/item/20997.png');
});

test('feed: nothing at all under the curtain', () => {
  const p = feedPayload(FEED, DOWN, 10);
  assert.ok('notice' in p);
  assert.doesNotMatch(JSON.stringify(p), /Twisted|Zezima|Jad/);
});

test('board: unrevealed board shows nothing — not even a count', () => {
  const p = boardPayload({ revealed: false, tiles: [{ id: 1, label: 'Jad', icon: null }], claims: new Map(), teamColors: new Map(), curtain: UP, square: 5 });
  assert.deepEqual(p, { notice: 'The board is not revealed yet' });
});

test('board: claims shown live, dropped under the curtain (shape stays)', () => {
  const tiles = [
    { id: 1, label: 'Jad', icon: '/img/item/6570.png' },
    { id: 2, label: 'Zuk', icon: null },
  ];
  const claims = new Map([[1, [2, 1]]]);
  const colors = new Map([[1, '#0000ff'], [2, '#ff0000']]);
  const live = boardPayload({ revealed: true, tiles, claims, teamColors: colors, curtain: UP, square: 5 });
  assert.ok('cells' in live);
  assert.deepEqual(live.cells[0].done, ['#ff0000', '#0000ff']);
  assert.equal(live.cols, 2);
  const hidden = boardPayload({ revealed: true, tiles, claims, teamColors: colors, curtain: DOWN, square: 5 });
  assert.ok('cells' in hidden);
  assert.ok(hidden.cells.every((c) => c.done.length === 0));
  assert.equal(hidden.cells.length, 2);
});

test('colour and icon sanitisers', () => {
  assert.equal(safeColor('#ABCDEF', 0), '#abcdef');
  assert.match(safeColor('expression(alert(1))', 2), /^#[0-9a-f]{6}$/);
  assert.equal(safeIcon('/img/../api/x'), null);
  assert.equal(safeIcon('javascript:alert(1)'), null);
  assert.equal(safeIcon('/img/wiki/Fire_cape.png'), '/img/wiki/Fire_cape.png');
});

test('etag: stable for the same body, If-None-Match matching', () => {
  const a = overlayEtag('{"x":1}');
  assert.equal(a, overlayEtag('{"x":1}'));
  assert.notEqual(a, overlayEtag('{"x":2}'));
  assert.ok(etagMatches(`"zzz", ${a}`, a));
  assert.ok(!etagMatches(null, a));
  assert.ok(!etagMatches('W/"other"', a));
});

// ── The page ─────────────────────────────────────────────────────────────────────────────────────

test('page: no data in it, options escaped, nonce on the only script, strict CSP', () => {
  const key = newOverlayKey();
  const opts = parseOverlayOptions(new URLSearchParams('view=board&accent=00ff00'));
  const html = overlayHtml(key, opts, 'NONCE123');
  assert.match(html, /<script nonce="NONCE123">/);
  assert.equal((html.match(/<script nonce=/g) ?? []).length, 1);
  assert.match(html, /background:transparent/);
  assert.match(html, /--accent:#00ff00/);
  assert.ok(!/innerHTML/.test(html), 'payload is never written as markup');
  const csp = overlayCsp('NONCE123');
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /script-src 'nonce-NONCE123'/);
  assert.match(csp, /frame-ancestors 'self'/);
  assert.equal(scriptJson({ a: '</script><script>alert(1)</script>' }).includes('<'), false);
});

// ── !join ────────────────────────────────────────────────────────────────────────────────────────

test('!join is the command, alone or with words after it', () => {
  assert.equal(parseChatCommand('!join'), 'join');
  assert.equal(parseChatCommand('  !JOIN please'), 'join');
  assert.equal(parseChatCommand('!joinme'), null);
  assert.equal(parseChatCommand('how do I !join'), null);
  assert.equal(parseChatCommand(undefined), null);
});

const frame = (o: { chatter?: string; text?: string; type?: string; mt?: string; b?: string } = {}) => ({
  metadata: { message_type: o.mt ?? 'notification' },
  payload: {
    subscription: { type: o.type ?? 'channel.chat.message' },
    event: { broadcaster_user_id: o.b ?? '1234', chatter_user_id: o.chatter ?? '555', message_id: 'abc-1', message: { text: o.text ?? '!join' } },
  },
});

test('joinTriggerOf: only chat-message notifications with !join, never the bot itself', () => {
  assert.deepEqual(joinTriggerOf(frame(), '999'), { broadcasterId: '1234', messageId: 'abc-1' });
  assert.equal(joinTriggerOf(frame({ chatter: '999' }), '999'), null);
  assert.equal(joinTriggerOf(frame({ text: 'hello' }), '999'), null);
  assert.equal(joinTriggerOf(frame({ type: 'channel.follow' }), '999'), null);
  assert.equal(joinTriggerOf(frame({ mt: 'session_keepalive' }), '999'), null);
  assert.equal(joinTriggerOf(frame({ b: '12; DROP' }), '999'), null);
  assert.equal(joinTriggerOf(null, '999'), null);
});

test('reply limiter: one per channel per cooldown, plus a global budget', () => {
  const l = new ReplyLimiter({ channelMs: 30_000, globalMax: 2, globalWindowMs: 30_000 });
  assert.ok(l.take('a', 0));
  assert.ok(!l.take('a', 10_000));
  assert.ok(l.take('b', 10_000));
  assert.ok(!l.take('c', 10_001), 'global budget spent');
  assert.ok(l.take('a', 40_001), 'cooldown over and budget refilled');
});

test('chat text: one line, capped at 500', () => {
  assert.equal(cleanChatMessage('a\nb\r\n\tc'), 'a b c');
  assert.equal(cleanChatMessage('x'.repeat(600)).length, 500);
  assert.equal(joinReplyText('Summer\nBingo', 'https://anvilosrs.com/c/x/events/1'), 'Join Summer Bingo on Anvil: https://anvilosrs.com/c/x/events/1');
});

test('botSecret: derived, stable, distinct from the input', () => {
  assert.equal(botSecret('s'), botSecret('s'));
  assert.notEqual(botSecret('s'), botSecret('t'));
});

test('pickJoinEvent: running beats upcoming; finished and closed sign-ups are skipped', () => {
  const now = Date.parse('2026-11-04T12:00:00Z');
  const base = { endDate: null, forceEndedAt: null, signupDeadline: null };
  const rows = [
    { id: 1, ...base, startDate: '2026-11-10T00:00:00Z' },
    { id: 2, ...base, startDate: '2026-11-01T00:00:00Z' },
    { id: 3, ...base, startDate: '2026-10-01T00:00:00Z', endDate: '2026-10-30T00:00:00Z' },
    { id: 4, ...base, startDate: '2026-11-02T00:00:00Z', forceEndedAt: '2026-11-03T00:00:00Z' },
    { id: 5, ...base, startDate: '2026-11-03 00:00:00', signupDeadline: '2026-11-03 12:00:00' },
  ];
  assert.equal(pickJoinEvent(rows, now)?.id, 2);
  assert.equal(pickJoinEvent(rows.filter((r) => r.id !== 2), now)?.id, 1);
  assert.equal(pickJoinEvent([{ id: 9, ...base, startDate: null }, { id: 1, ...base, startDate: '2026-11-10T00:00:00Z' }], now)?.id, 1);
  assert.equal(pickJoinEvent(rows.filter((r) => r.id >= 3), now), null);
});
