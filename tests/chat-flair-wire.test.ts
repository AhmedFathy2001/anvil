// The Supporter name list on the wire (lib/chatFlairWire) and its socket broadcast (lib/push/hub):
// deltas only say what the full list would, catching up falls back to the full list on any gap, and
// a 200k-name list builds, encodes and gzips in a sensible time and size. No database.
//
// Run: npx tsx --test tests/chat-flair-wire.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';

import {
  applyDiff,
  catchUp,
  decodeEntries,
  decodeState,
  deltaMessage,
  diffFlair,
  encodeList,
  encodeState,
  notifyMessage,
  ownersOf,
  replay,
  styleFromKey,
  styleKey,
  MAX_DELTA_NAMES,
  type FlairDelta,
  type FlairRecord,
  type FlairState,
} from '../src/lib/chatFlairWire.ts';
import { FlairGather, ViewHub, parseFlair, type PushClient } from '../src/lib/push/hub.ts';

const GOLD = styleKey({ c: 'ffd700' });
const PATRON = styleKey({ c: 'ff00ff', g: ['ff00ff', '00ffff'], s: true });
const rec = (k: string, p: number): FlairRecord => ({ k, p });

test('a diff sets new and changed looks, drops names gone ineligible, and records owner-only moves silently', () => {
  const state: FlairState = new Map([['alpha', rec(GOLD, 1)], ['bravo', rec(GOLD, 2)], ['charlie', rec(GOLD, 3)]]);
  // alpha upgraded, bravo unshared (absent from fresh), charlie merged into person 9, delta new.
  const fresh = new Map([['alpha', rec(PATRON, 1)], ['charlie', rec(GOLD, 9)], ['delta', rec(GOLD, 4)]]);
  const d = diffFlair(state, fresh, ['alpha', 'bravo', 'charlie', 'delta', 'echo']);
  assert.deepEqual([...d.set.keys()].sort(), ['alpha', 'delta']);
  assert.deepEqual(d.del, ['bravo']);
  assert.equal(d.records.get('charlie')?.p, 9);
  const msg = deltaMessage(8, 7, d);
  assert.equal(msg.from, 7);
  assert.equal(msg.v, 8);
  // Owners never go on the wire; charlie (no look change) isn't in it at all.
  assert.ok(!JSON.stringify(msg).includes('charlie'));
  assert.deepEqual([...decodeEntries(msg).keys()], ['alpha', 'delta']);

  // Replaying the logged version gives the same state as applying the diff.
  const a = new Map(state);
  applyDiff(a, d);
  const b = new Map(state);
  replay(b, JSON.parse(JSON.stringify(msg)), ownersOf(d));
  assert.deepEqual([...b].sort(), [...a].sort());
  assert.deepEqual(decodeState(encodeState(a)), a);
});

test('a name outside the checked set is never touched, even if the state has it', () => {
  const state: FlairState = new Map([['alpha', rec(GOLD, 1)]]);
  const d = diffFlair(state, new Map(), ['zulu']);
  assert.equal(d.del.length, 0);
  assert.equal(d.set.size, 0);
});

test('a huge change goes out as full:true; an oversized NOTIFY too', () => {
  const big = new Map(Array.from({ length: MAX_DELTA_NAMES }, (_, i) => [`n${i}`, GOLD] as [string, string]));
  assert.deepEqual(deltaMessage(2, 1, { set: big, del: [] }), { t: 'flair', v: 2, from: 1, full: true });
  const mid = new Map(Array.from({ length: 900 }, (_, i) => [`name${i}`, GOLD] as [string, string]));
  const msg = deltaMessage(3, 2, { set: mid, del: [] });
  assert.ok(!msg.full);
  assert.deepEqual(notifyMessage(msg), { t: 'flair', v: 3, from: 2, full: true });
  const small = deltaMessage(4, 3, { set: new Map([['x', GOLD]]), del: ['y'] });
  assert.equal(notifyMessage(small), small);
});

test('catching up: the chain from `since` when whole and small, else null (fetch the full list)', () => {
  const d = (v: number, from: number, extra: Partial<FlairDelta> = {}): FlairDelta => ({ t: 'flair', v, from, names: ['a'], ix: [0], styles: [{ c: 'fff' }], del: [], ...extra });
  const log = [d(5, 4), d(6, 5), d(7, 6)];
  assert.deepEqual(catchUp(4, 7, log)?.map((x) => x.v), [5, 6, 7]);
  assert.deepEqual(catchUp(7, 7, log), []);
  assert.equal(catchUp(0, 7, log), null, 'no version held');
  assert.equal(catchUp(3, 7, log), null, 'gap: trimmed log');
  assert.equal(catchUp(4, 7, [d(5, 4), d(6, 5, { full: true }), d(7, 6)]), null, 'a full marker in the way');
  assert.equal(catchUp(9, 7, log), null, 'ahead of the server (reset database)');
});

test('the hub sends flair deltas only to sockets that asked for them, once each', () => {
  const hub = new ViewHub({ fetchView: async () => null, later: () => () => {} });
  const got: Record<string, string[]> = { old: [], neu: [], neu2: [] };
  const client = (name: string, flair: boolean, userId: number): PushClient => ({
    scope: { userId, eventIds: [], teamId: null, rows: true, ...(flair ? { flair: true } : {}) },
    send: (m) => got[name].push(m),
  });
  hub.add(client('old', false, 1));
  hub.add(client('neu', true, 2));
  hub.add(client('neu2', true, 2));
  assert.equal(hub.deliverFlair({ t: 'flair', v: 2, from: 1, names: [], ix: [], styles: [], del: ['x'] }), 2);
  assert.equal(got.old.length, 0);
  assert.equal(got.neu.length, 1);
  assert.equal(got.neu2.length, 1);
  assert.equal(JSON.parse(got.neu[0]).t, 'flair');
});

test('flair NOTIFYs parse; a burst of dirty notices is one flush', () => {
  assert.deepEqual(parseFlair(JSON.stringify({ k: 'flairdirty', p: [1, 'x'], n: ['old name'] })), { kind: 'dirty', players: [1], names: ['old name'] });
  assert.equal(parseFlair(JSON.stringify({ k: 'flairv', m: { t: 'flair', v: 3 } }))?.kind, 'version');
  assert.equal(parseFlair(JSON.stringify({ k: 'rows', m: {} })), null);
  let fire: (() => void) | null = null;
  const flushed: [number[], string[]][] = [];
  const g = new FlairGather((p, n) => flushed.push([p, n]), 2_000, (fn) => ((fire = fn), () => {}));
  g.add([1], ['a']);
  g.add([2, 1], []);
  g.add([], ['b']);
  assert.equal(flushed.length, 0);
  fire!();
  assert.deepEqual(flushed, [[[1, 2], ['a', 'b']]]);
});

test('load: 200k names build, encode and gzip quickly and small', () => {
  // A realistic spread: most wear one of three tier defaults, one in ten a colour of their own.
  const defaults = [styleKey({ c: 'e8c547' }), styleKey({ c: 'c0c0ff', g: ['c0c0ff', '8080ff'] }), styleKey({ c: 'ff66cc', g: ['ff66cc', 'ffcc66', '66ccff'], s: true })];
  const state: FlairState = new Map();
  let seed = 42;
  const rnd = () => {
    // mulberry32
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const letters = 'abcdefghijklmnopqrstuvwxyz0123456789 ';
  while (state.size < 200_000) {
    const len = 4 + Math.floor(rnd() * 8);
    let n = '';
    for (let i = 0; i < len; i++) n += letters[Math.floor(rnd() * (i === 0 ? 26 : letters.length))];
    n = n.trim().replace(/ +/g, ' ');
    const k = rnd() < 0.1 ? styleKey({ c: Math.floor(rnd() * 0xffffff).toString(16).padStart(6, '0') }) : defaults[Math.floor(rnd() * 3)];
    state.set(n, rec(k, state.size + 1));
  }
  const t0 = performance.now();
  const json = JSON.stringify(encodeList(1, state));
  const t1 = performance.now();
  const gz = gzipSync(json);
  const t2 = performance.now();
  const snap = encodeState(state);
  decodeState(snap);
  const t3 = performance.now();
  // A 50-name delta against the full state.
  const fresh = new Map<string, FlairRecord>();
  const checked = [...state.keys()].slice(0, 50);
  for (const n of checked) fresh.set(n, rec(defaults[2], 1));
  const t4 = performance.now();
  diffFlair(state, fresh, checked);
  const t5 = performance.now();
  console.log(
    `[load] 200k names: encode ${(t1 - t0).toFixed(0)}ms, json ${(json.length / 1e6).toFixed(2)}MB, gzip ${(gz.length / 1e6).toFixed(2)}MB in ${(t2 - t1).toFixed(0)}ms; snapshot round-trip ${(t3 - t2).toFixed(0)}ms (${(snap.length / 1e6).toFixed(2)}MB); 50-name diff ${(t5 - t4).toFixed(2)}ms`,
  );
  assert.ok(gz.length < 2_000_000, `gzip ${gz.length}`);
  assert.ok(t1 - t0 < 3_000);
});

test('per-surface looks: d/l ride in the style table, dedupe on them, and are omitted when unset', () => {
  const plain = { c: '#ff7ab8', g: ['#ffd27a', '#ff7ab8', '#7ae0ff'], s: true as const };
  const withDark = { ...plain, d: { c: '#ffffff', g: ['#ffffff', '#ffe0a0'] } };
  const withLight = { ...plain, l: { c: '#3a2000' } };
  // Unset: the key and the entry are exactly what they were before overrides existed.
  assert.equal(styleKey(plain), JSON.stringify(['#ff7ab8', ['#ffd27a', '#ff7ab8', '#7ae0ff'], 1]));
  assert.deepEqual(styleFromKey(styleKey(plain)), plain);
  // Round trip with overrides; g only on a gradient.
  assert.deepEqual(styleFromKey(styleKey(withDark)), withDark);
  assert.deepEqual(styleFromKey(styleKey(withLight)), withLight);
  assert.deepEqual(styleFromKey(styleKey({ c: '#111111', l: { c: '#222222', g: ['#222222'] } })), { c: '#111111', l: { c: '#222222' } });
  // Same main look, different overrides: three distinct keys.
  assert.equal(new Set([styleKey(plain), styleKey(withDark), styleKey(withLight)]).size, 3);

  const state: FlairState = new Map([
    ['alice', { k: styleKey(plain), p: 1 }],
    ['bob', { k: styleKey(withDark), p: 2 }],
    ['carol', { k: styleKey(withDark), p: 3 }],
    ['dave', { k: styleKey(withLight), p: 4 }],
  ]);
  const list = encodeList(5, state);
  assert.equal(list.styles.length, 3);
  assert.deepEqual(list.names, ['alice', 'bob', 'carol', 'dave']);
  assert.equal(list.ix[1], list.ix[2]);
  const byName = decodeEntries(list);
  assert.deepEqual(byName.get('bob'), withDark);
  assert.deepEqual(byName.get('dave'), withLight);
  assert.ok(!('d' in byName.get('alice')!) && !('l' in byName.get('alice')!));
  assert.equal(JSON.stringify(list.styles[list.ix[0]]), JSON.stringify(plain));

  // A changed override alone is a change on the wire (delta path).
  const fresh = new Map<string, FlairRecord>([['alice', { k: styleKey({ ...plain, d: { c: '#eeeeee' } }), p: 1 }]]);
  const diff = diffFlair(state, fresh, ['alice']);
  const msg = deltaMessage(6, 5, diff);
  assert.deepEqual(msg.styles, [{ ...plain, d: { c: '#eeeeee' } }]);
  assert.deepEqual(msg.names, ['alice']);
});
