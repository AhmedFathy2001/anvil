import type { PushScope } from './ticket.ts';

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Who hears about a change, and how often. Pure (the clock and timer are injected), so it is tested
// directly (tests/plugin-push.test.ts); push/server.ts wires it to Postgres NOTIFY and the sockets.
//
// A message only says WHAT moved — the plugin refetches it through the same routes it polls, so a
// push never carries data an old route wouldn't have served it. Per connection, the first change in
// a quiet spell goes out at once and later ones fold into one message per MIN_GAP: a busy team gets
// the board a few seconds late at worst, never a refetch per drop.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/** One NOTIFY from the database (migration 0149) or lib/pushNotify: e = event, t = team, i = tile. */
export interface PushChange {
  k: string;
  e: number;
  t: number | null;
  i: number | null;
}

/** What the plugin should refetch: its config (own team's progress), the board, pinned tiles. */
export interface PushMessage {
  t: 'changed';
  config?: true;
  board?: true;
  tiles?: number[];
}

export interface PushClient {
  scope: PushScope;
  send(message: string): void;
}

export const DEFAULT_MIN_GAP_MS = 5_000;

export interface PushHubOptions {
  minGapMs?: number;
  now?: () => number;
  /** Runs fn after ms; returns a cancel. */
  later?: (fn: () => void, ms: number) => () => void;
}

interface Conn {
  client: PushClient;
  config: boolean;
  board: boolean;
  tiles: Set<number>;
  lastSentAt: number;
  timer: (() => void) | null;
}

export class PushHub {
  private readonly byEvent = new Map<number, Set<Conn>>();
  // A plain field, not a constructor parameter property: push/server.ts runs this file under Node's
  // type stripping, which can't rewrite those.
  private readonly opts: PushHubOptions;

  constructor(opts: PushHubOptions = {}) {
    this.opts = opts;
  }

  /** Subscribe a client to its scope's events; the returned function unsubscribes it. */
  add(client: PushClient): () => void {
    const conn: Conn = { client, config: false, board: false, tiles: new Set(), lastSentAt: -Infinity, timer: null };
    for (const e of client.scope.eventIds) {
      let set = this.byEvent.get(e);
      if (!set) this.byEvent.set(e, (set = new Set()));
      set.add(conn);
    }
    return () => {
      conn.timer?.();
      conn.timer = null;
      for (const e of client.scope.eventIds) {
        const set = this.byEvent.get(e);
        set?.delete(conn);
        if (set?.size === 0) this.byEvent.delete(e);
      }
    };
  }

  /** How many clients are listening, for the server's log line. */
  get size(): number {
    const all = new Set<Conn>();
    for (const set of this.byEvent.values()) for (const c of set) all.add(c);
    return all.size;
  }

  /**
   * Everyone refetches everything — after the server's database listener reconnects, when changes
   * may have gone by unheard.
   */
  refreshAll(): void {
    const all = new Set<Conn>();
    for (const set of this.byEvent.values()) for (const c of set) all.add(c);
    for (const conn of all) {
      conn.config = true;
      conn.board = true;
      this.flush(conn);
    }
  }

  dispatch(change: PushChange): void {
    const set = this.byEvent.get(change.e);
    if (!set) return;
    for (const conn of set) {
      // A team-only change (a teammate's drop) moves that team's config; anything event-wide moves
      // everyone's. Every change can move the board and a pinned tile's tracker.
      if (change.t == null || change.t === conn.client.scope.teamId) conn.config = true;
      conn.board = true;
      if (change.i != null) conn.tiles.add(change.i);
      this.flush(conn);
    }
  }

  private flush(conn: Conn): void {
    if (conn.timer) return; // a send is already scheduled and will carry this too
    const now = this.now();
    const wait = conn.lastSentAt + this.gap() - now;
    if (wait > 0) {
      conn.timer = this.later(() => {
        conn.timer = null;
        this.send(conn);
      }, wait);
      return;
    }
    this.send(conn);
  }

  private send(conn: Conn): void {
    if (!conn.config && !conn.board && conn.tiles.size === 0) return;
    const msg: PushMessage = { t: 'changed' };
    if (conn.config) msg.config = true;
    if (conn.board) msg.board = true;
    if (conn.tiles.size > 0) msg.tiles = [...conn.tiles];
    conn.config = false;
    conn.board = false;
    conn.tiles.clear();
    conn.lastSentAt = this.now();
    conn.client.send(JSON.stringify(msg));
  }

  private gap(): number {
    return this.opts.minGapMs ?? DEFAULT_MIN_GAP_MS;
  }

  private now(): number {
    return (this.opts.now ?? Date.now)();
  }

  private later(fn: () => void, ms: number): () => void {
    if (this.opts.later) return this.opts.later(fn, ms);
    const t = setTimeout(fn, ms);
    return () => clearTimeout(t);
  }
}

/** A NOTIFY payload as a change, or null when it isn't one of ours. */
export function parseChange(payload: string): PushChange | null {
  try {
    const p = JSON.parse(payload);
    if (!Number.isInteger(p?.e)) return null;
    return {
      k: typeof p.k === 'string' ? p.k : '',
      e: p.e,
      t: Number.isInteger(p.t) ? p.t : null,
      i: Number.isInteger(p.i) ? p.i : null,
    };
  } catch {
    return null;
  }
}
