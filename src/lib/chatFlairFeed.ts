// The in-game Supporter name list, versioned (capability 'chat-flair-v'). The database half of
// lib/chatFlairWire.
//
// Every change to who wears which colours is a version in chat_flair_log (migration 0216). The tables
// that decide the list announce their own changes (the 0216 triggers → NOTIFY 'flairdirty'); the push
// server gathers a burst and calls refreshChatFlair with the people and names it heard about
// (api/internal/push/flair). That works out only THOSE names' looks, diffs them against the list,
// and — if anything moved — writes the next version and NOTIFYs its delta ('flairv'), which the push
// server hands to every plugin socket. Plugins holding the previous version apply it in place.
//
// Many app instances (blue-green slots) each keep a copy in memory, brought up to date from the log
// (or the newest snapshot) whenever the stored version moved — so whichever instance a plugin hits
// answers for the same version, and nothing depends on an instance hearing a NOTIFY. A transaction
// advisory lock makes version numbers strictly sequential across instances.
//
// What a version can't see coming — a membership lapsing by date, a tier's default colour changing in
// a deploy — is caught by a full rebuild at most every RECONCILE_MS per instance, diffed the same way.

import { gzipSync } from 'node:zlib';

import { createHash } from 'node:crypto';
import { desc, gt, inArray, lt, sql } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, chatFlairLog, chatFlairSnapshots } from '@/db/schema';
import { log } from '@/lib/logger';
import { gameChatFlairRecords } from '@/lib/supporter';
import {
  applyDiff,
  catchUp,
  decodeState,
  deltaMessage,
  diffFlair,
  encodeList,
  encodeState,
  isEmptyDiff,
  notifyMessage,
  ownersOf,
  replay,
  styleFromKey,
  type FlairDelta,
  type FlairState,
} from '@/lib/chatFlairWire';

/** Versions between snapshots: a fresh instance replays at most this many. */
const SNAPSHOT_EVERY = 100;
/** Deltas kept for plugins catching up after a reconnect. */
const KEEP_LOG = 500;
const RECONCILE_MS = 10 * 60_000;
/** How long an instance trusts its idea of the stored version before asking again. */
const VERSION_TTL_MS = 2_000;
const LOCK = sql`select pg_advisory_xact_lock(hashtext('anvil-chat-flair'))`;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

interface Mem {
  v: number;
  state: FlairState;
  snapshotV: number;
}

let mem: Mem = { v: 0, state: new Map(), snapshotV: 0 };
let checkedAt = 0;
let reconciledAt = 0;
let body: { v: number; gz: Buffer; json: string } | null = null;
let legacy: { v: number; body: string } | null = null;
/** One refresh at a time per instance (the lock serializes instances). */
let queue: Promise<unknown> = Promise.resolve();

/** Test hook: forget everything this instance holds. */
export function resetChatFlairMemory(): void {
  mem = { v: 0, state: new Map(), snapshotV: 0 };
  checkedAt = 0;
  reconciledAt = 0;
  body = null;
  legacy = null;
}

async function storedVersion(ex: Tx | typeof db): Promise<number> {
  const [row] = await ex.select({ v: chatFlairLog.version }).from(chatFlairLog).orderBy(desc(chatFlairLog.version)).limit(1);
  const [snap] = await ex.select({ v: chatFlairSnapshots.version }).from(chatFlairSnapshots).orderBy(desc(chatFlairSnapshots.version)).limit(1);
  return Math.max(row?.v ?? 0, snap?.v ?? 0);
}

/** Bring this instance's copy up to the stored version: replay the log, or start again from a snapshot. */
async function sync(ex: Tx | typeof db, target?: number): Promise<void> {
  const v = target ?? (await storedVersion(ex));
  if (v === mem.v) return;
  const rows = v > mem.v ? await ex.select().from(chatFlairLog).where(gt(chatFlairLog.version, mem.v)).orderBy(chatFlairLog.version) : [];
  if (v > mem.v && rows.length === v - mem.v && rows[0]?.version === mem.v + 1 && rows.every((r) => !(JSON.parse(r.msg) as FlairDelta).full)) {
    for (const r of rows) replay(mem.state, JSON.parse(r.msg), JSON.parse(r.owners));
    mem.v = v;
    return;
  }
  const [snap] = await ex.select().from(chatFlairSnapshots).orderBy(desc(chatFlairSnapshots.version)).limit(1);
  const state = snap ? decodeState(snap.state) : new Map();
  const from = snap?.version ?? 0;
  const after = await ex.select().from(chatFlairLog).where(gt(chatFlairLog.version, from)).orderBy(chatFlairLog.version);
  for (const r of after) replay(state, JSON.parse(r.msg), JSON.parse(r.owners));
  mem = { v: after.at(-1)?.version ?? from, state, snapshotV: from };
}

/** What a change names: these people (players.id) and these names (an old name a rename left behind). */
export interface FlairScope {
  players?: number[];
  names?: string[];
}

/**
 * Work out what changed for `scope` (or everyone: 'all') and, if anything did, store the next version
 * and announce its delta. Returns the version now current.
 */
export function refreshChatFlair(scope: FlairScope | 'all'): Promise<number> {
  const run = queue.then(() => refresh(scope));
  queue = run.catch(() => {});
  return run;
}

async function refresh(scope: FlairScope | 'all'): Promise<number> {
  if (scope === 'all') reconciledAt = Date.now();
  let next: { v: number; diff: ReturnType<typeof diffFlair>; snapshot: boolean } | null = null;
  await db.transaction(async (tx) => {
    await tx.execute(LOCK);
    await sync(tx);
    let checked: string[];
    let fresh;
    if (scope === 'all') {
      fresh = await gameChatFlairRecords();
      checked = [...mem.state.keys(), ...fresh.keys()];
    } else {
      const players = new Set((scope.players ?? []).filter((n) => Number.isInteger(n) && n > 0));
      const names = new Set((scope.names ?? []).filter((n) => typeof n === 'string' && n.length > 0 && n.length <= 12));
      // The names those people wear now, and the ones they own today.
      for (const [n, r] of mem.state) if (players.has(r.p)) names.add(n);
      // clan-scope: global -- a character is one account however many clans roster it.
      if (players.size) {
        const rows = await tx.select({ n: accounts.rsnNormalized }).from(accounts).where(inArray(accounts.playerId, [...players]));
        for (const r of rows) names.add(r.n);
      }
      checked = [...names];
      fresh = await gameChatFlairRecords(checked);
    }
    const diff = diffFlair(mem.state, fresh, checked);
    if (isEmptyDiff(diff)) return;
    const v = mem.v + 1;
    const msg = deltaMessage(v, mem.v, diff);
    await tx.insert(chatFlairLog).values({ version: v, msg: JSON.stringify(msg), owners: msg.full ? '{}' : JSON.stringify(ownersOf(diff)) });
    const snapshot = !!msg.full || v - mem.snapshotV >= SNAPSHOT_EVERY;
    if (snapshot) {
      const state = new Map(mem.state);
      applyDiff(state, diff);
      await tx.insert(chatFlairSnapshots).values({ version: v, state: encodeState(state) });
      await tx.delete(chatFlairSnapshots).where(lt(chatFlairSnapshots.version, v));
      await tx.delete(chatFlairLog).where(lt(chatFlairLog.version, v - KEEP_LOG));
    }
    // Delivered at commit, so no plugin hears of a version before it can be fetched.
    await tx.execute(sql`select pg_notify('anvil_push', ${JSON.stringify({ k: 'flairv', m: notifyMessage(msg) })})`);
    next = { v, diff, snapshot };
  });
  const done = next as { v: number; diff: ReturnType<typeof diffFlair>; snapshot: boolean } | null;
  if (done) {
    applyDiff(mem.state, done.diff);
    mem.v = done.v;
    if (done.snapshot) mem.snapshotV = done.v;
    checkedAt = Date.now();
    log.info('chat-flair.version', { v: done.v, set: done.diff.set.size, del: done.diff.del.length });
  }
  return mem.v;
}

// ── Coalescing, for callers in this process ─────────────────────────────────────────────────────

const GATHER_MS = 2_000;
let pending: { players: Set<number>; names: Set<string>; all: boolean; promise: Promise<number> } | null = null;

/**
 * Something changed the list's contents: gathered for GATHER_MS (a burst is one version), then
 * refreshChatFlair. The database triggers already cover table writes; this is for anything else
 * (a tier's look changing in code, a staff "rebuild").
 */
export function invalidateChatFlair(scope: FlairScope | 'all' = 'all'): Promise<number> {
  if (!pending) {
    let resolve!: (v: number) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<number>((res, rej) => ((resolve = res), (reject = rej)));
    const p = (pending = { players: new Set<number>(), names: new Set<string>(), all: false, promise });
    setTimeout(() => {
      pending = null;
      refreshChatFlair(p.all ? 'all' : { players: [...p.players], names: [...p.names] }).then(resolve, reject);
    }, GATHER_MS);
  }
  if (scope === 'all') pending.all = true;
  else {
    for (const n of scope.players ?? []) pending.players.add(n);
    for (const n of scope.names ?? []) pending.names.add(n);
  }
  return pending.promise;
}

// ── Reads ───────────────────────────────────────────────────────────────────────────────────────

/** This instance's copy at the stored version (asked at most every VERSION_TTL_MS), built on first use. */
async function current(): Promise<Mem> {
  const now = Date.now();
  if (now - checkedAt > VERSION_TTL_MS) {
    // Through the same queue as refreshes: one thing touches this instance's copy at a time.
    const run = queue.then(async () => {
      const v = await storedVersion(db);
      if (v !== mem.v) await sync(db, v);
    });
    queue = run.catch(() => {});
    await run;
    checkedAt = now;
    if (mem.v === 0 && !reconciledAt) await refreshChatFlair('all');
  }
  // A lapse by date or a deploy's new default colour shows up here. In the background: never makes
  // the plugin wait.
  if (now - reconciledAt > RECONCILE_MS) {
    reconciledAt = now;
    void refreshChatFlair('all').catch((err) => log.warn('chat-flair.reconcile-failed', { err: String(err) }));
  }
  return mem;
}

/** The current version alone, and the deltas from `since` when few enough (else full: fetch /v/<v>). */
export async function flairSince(since: number): Promise<{ v: number; deltas?: FlairDelta[]; full?: true }> {
  const m = await current();
  if (since === m.v) return { v: m.v };
  const rows = since > 0 && since < m.v ? await db.select({ msg: chatFlairLog.msg }).from(chatFlairLog).where(gt(chatFlairLog.version, since)).orderBy(chatFlairLog.version) : [];
  const chain = catchUp(since, m.v, rows.map((r) => JSON.parse(r.msg) as FlairDelta));
  return chain && chain.length ? { v: m.v, deltas: chain } : { v: m.v, full: true };
}

/** The whole list at the current version: JSON and gzip, built once per version per instance. */
export async function flairFull(): Promise<{ v: number; gz: Buffer; json: string }> {
  const m = await current();
  if (!body || body.v !== m.v) {
    const json = JSON.stringify(encodeList(m.v, m.state));
    body = { v: m.v, json, gz: gzipSync(json) };
  }
  return body;
}

/** The pre-version list (GET /api/plugin/chat-flair) for plugins before 'chat-flair-v'. */
export async function flairLegacy(): Promise<{ body: string; etag: string }> {
  const m = await current();
  if (!legacy || legacy.v !== m.v) {
    const names = [...m.state].map(([n, r]) => ({ n, ...styleFromKey(r.k) })).sort((a, b) => (a.n < b.n ? -1 : a.n > b.n ? 1 : 0));
    legacy = { v: m.v, body: JSON.stringify({ names }) };
  }
  return { body: legacy.body, etag: `"${createHash('sha1').update(legacy.body).digest('hex').slice(0, 16)}"` };
}
