import type { PushScope } from './ticket.ts';

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Who gets which view, built how often. Pure (the fetch, clock and timer are injected), so it is
// tested directly (tests/plugin-push.test.ts); push/server.ts wires it to Postgres NOTIFY, the site's
// internal view route and the sockets.
//
// A view is built ONCE per change and the same text goes to everyone subscribed to it (lib/push/views):
//   team:<event>:<team>  each client's own team on its board (team 0 = no team: the board only)
//   tile:<event>:<tile>  one tile's tracker numbers — to everyone on that board
// Changes to one view are gathered for a moment and then built at most once per MIN_GAP, so a busy
// team costs a handful of builds a minute however many teammates are watching.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * One NOTIFY from the database (migration 0149) or lib/pushNotify: e = event, t = team, i = tile,
 * x = a team somebody just left (removed, or moved to another).
 */
export interface PushChange {
  k: string;
  e: number;
  t: number | null;
  i: number | null;
  x?: number;
}

export interface PushClient {
  scope: PushScope;
  send(message: string): void;
  /** Drop the connection so the plugin re-tickets: its scope was signed before a roster change. */
  rescope?(): void;
}

export interface ViewHubOptions {
  /** The view's message text, or null when there is none (unknown, hidden, failed). */
  fetchView: (key: string) => Promise<string | null>;
  /** Wait after the first change, so a burst (a raid's worth of drops) is one build. */
  gatherMs?: number;
  /** Least time between two builds of the same view. */
  minGapMs?: number;
  now?: () => number;
  /** Runs fn after ms; returns a cancel. */
  later?: (fn: () => void, ms: number) => () => void;
}

export const DEFAULT_GATHER_MS = 300;
export const DEFAULT_MIN_GAP_MS = 2_000;

export function teamKey(eventId: number, teamId: number | null): string {
  return `team:${eventId}:${teamId ?? 0}`;
}

export function tileKey(eventId: number, tileId: number): string {
  return `tile:${eventId}:${tileId}`;
}

export function parseViewKey(key: string): { kind: 'team' | 'tile'; eventId: number; id: number } | null {
  const m = /^(team|tile):(\d+):(\d+)$/.exec(key);
  return m ? { kind: m[1] as 'team' | 'tile', eventId: Number(m[2]), id: Number(m[3]) } : null;
}

interface View {
  key: string;
  /** Last text sent, so an unchanged rebuild goes nowhere and a newcomer gets it at once. */
  text: string | null;
  dirty: boolean;
  inFlight: boolean;
  lastBuiltAt: number;
  timer: (() => void) | null;
  /** Newcomers owed the current text even if the next build doesn't change it. */
  owed: Set<PushClient>;
}

export class ViewHub {
  // Plain fields, not constructor parameter properties: push/server.ts runs this file under Node's
  // type stripping, which can't rewrite those.
  private readonly opts: ViewHubOptions;
  /** team key → its subscribers. */
  private readonly teams = new Map<string, Set<PushClient>>();
  /** event → everyone on it (tile views go to all of them). */
  private readonly events = new Map<number, Set<PushClient>>();
  private readonly views = new Map<string, View>();

  constructor(opts: ViewHubOptions) {
    this.opts = opts;
  }

  /** Subscribe a client to its scope and send it what's current; the returned function unsubscribes. */
  add(client: PushClient): () => void {
    // The team belongs to the first board (the seat's); any other board is watched without one.
    const keys = client.scope.eventIds.map((e, n) => teamKey(e, n === 0 ? client.scope.teamId : null));
    for (const k of keys) addTo(this.teams, k, client);
    for (const e of client.scope.eventIds) addTo(this.events, e, client);
    for (const k of keys) {
      const v = this.view(k);
      if (v.text != null) client.send(v.text);
      else {
        v.owed.add(client);
        this.schedule(v);
      }
    }
    return () => {
      for (const k of keys) {
        removeFrom(this.teams, k, client);
        this.views.get(k)?.owed.delete(client);
        if (!this.teams.has(k)) this.drop(k);
      }
      for (const e of client.scope.eventIds) {
        removeFrom(this.events, e, client);
        if (!this.events.has(e)) for (const k of [...this.views.keys()]) if (parseViewKey(k)?.eventId === e) this.drop(k);
      }
    };
  }

  /** How many clients are connected, for the server's health line. */
  get size(): number {
    const all = new Set<PushClient>();
    for (const set of this.events.values()) for (const c of set) all.add(c);
    return all.size;
  }

  dispatch(change: PushChange): void {
    const onBoard = this.events.get(change.e);
    if (!onBoard) return;
    // A ticket's team was true when the site signed it. When somebody leaves a team, that team's
    // listeners ask again — the leaver among them — rather than anyone hearing a team they've left
    // until their ticket runs out. Nobody else on the board is touched.
    if (change.x != null) {
      for (const c of [...(this.teams.get(teamKey(change.e, change.x)) ?? [])]) c.rescope?.();
    }
    const prefix = `team:${change.e}:`;
    for (const k of this.teams.keys()) {
      if (!k.startsWith(prefix)) continue;
      // A team-only change (a teammate's drop) rebuilds that team; anything event-wide rebuilds
      // every team. The no-team board view moves with any of it.
      const team = Number(k.slice(prefix.length));
      if (change.t == null || change.t === team || team === 0) this.schedule(this.view(k));
    }
    if (change.i != null) this.schedule(this.view(tileKey(change.e, change.i)));
  }

  /** Everything rebuilt — after the database listener reconnects, when changes may have gone unheard. */
  refreshAll(): void {
    for (const k of this.teams.keys()) this.schedule(this.view(k));
  }

  private view(key: string): View {
    let v = this.views.get(key);
    if (!v) {
      v = { key, text: null, dirty: false, inFlight: false, lastBuiltAt: -Infinity, timer: null, owed: new Set() };
      this.views.set(key, v);
    }
    return v;
  }

  private drop(key: string): void {
    this.views.get(key)?.timer?.();
    this.views.delete(key);
  }

  private schedule(v: View): void {
    if (v.inFlight) {
      v.dirty = true;
      return;
    }
    if (v.timer) return;
    const gap = v.lastBuiltAt + (this.opts.minGapMs ?? DEFAULT_MIN_GAP_MS) - this.now();
    v.timer = this.later(() => {
      v.timer = null;
      void this.build(v);
    }, Math.max(this.opts.gatherMs ?? DEFAULT_GATHER_MS, gap));
  }

  private async build(v: View): Promise<void> {
    v.inFlight = true;
    v.dirty = false;
    v.lastBuiltAt = this.now();
    let text: string | null = null;
    try {
      text = await this.opts.fetchView(v.key);
    } catch {
      text = null;
    }
    v.inFlight = false;
    if (this.views.get(v.key) !== v) return; // nobody is listening any more
    if (text != null) {
      // Listeners already holding the last text get what changed; newcomers get it whole.
      const change = text !== v.text ? (v.text == null ? text : teamDelta(v.key, v.text, text)) : null;
      const owed = new Set(v.owed);
      v.text = text;
      v.owed.clear();
      if (change != null) for (const c of this.audience(v.key)) if (!owed.has(c)) c.send(change);
      for (const c of owed) c.send(text);
    }
    if (v.dirty) this.schedule(v);
  }

  private audience(key: string): Set<PushClient> {
    const k = parseViewKey(key);
    if (!k) return new Set();
    return new Set(k.kind === 'team' ? this.teams.get(key) : this.events.get(k.eventId));
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

function addTo<K>(map: Map<K, Set<PushClient>>, key: K, client: PushClient): void {
  let set = map.get(key);
  if (!set) map.set(key, (set = new Set()));
  set.add(client);
}

function removeFrom<K>(map: Map<K, Set<PushClient>>, key: K, client: PushClient): void {
  const set = map.get(key);
  set?.delete(client);
  if (set?.size === 0) map.delete(key);
}

/**
 * What a team view's listeners need, given the one they hold: when only counts moved (the usual —
 * a kill, a drop), `{"t":"counts","c":{tile: team count},"m":{player: {c, y}}}` with just those;
 * when nothing of the team's moved (a rival's tile, a claim: the board did), `{"t":"moved"}`; when
 * anything else changed (a completion, a new mission), the whole view. Tile views always go whole.
 */
export function teamDelta(key: string, before: string, after: string): string {
  if (parseViewKey(key)?.kind !== 'team') return after;
  let a: TeamMessage;
  let b: TeamMessage;
  try {
    a = JSON.parse(before);
    b = JSON.parse(after);
  } catch {
    return after;
  }
  const [shapeA, countsA] = splitCounts(a);
  const [shapeB, countsB] = splitCounts(b);
  if (shapeA !== shapeB) return after;
  const c: Record<string, number> = {};
  for (const [tile, n] of Object.entries(countsB)) if (countsA[tile] !== n) c[tile] = n;
  const m: Record<string, unknown> = {};
  for (const [player, own] of Object.entries(b.members ?? {})) {
    if (JSON.stringify(own) !== JSON.stringify(a.members?.[player])) m[player] = own;
  }
  const head = { eventId: b.eventId, teamId: b.teamId };
  if (!Object.keys(c).length && !Object.keys(m).length) return JSON.stringify({ t: 'moved', ...head });
  return JSON.stringify({ t: 'counts', ...head, c, m });
}

interface TeamMessage {
  eventId: number;
  teamId: number;
  at?: string;
  config?: Record<string, unknown>;
  members?: Record<string, unknown>;
}

/** The view with every tracked count zeroed and the members and stamp left out, and those counts by tile. */
function splitCounts(v: TeamMessage): [string, Record<string, number>] {
  const counts: Record<string, number> = {};
  const config: Record<string, unknown> = { ...(v.config ?? {}) };
  for (const [field, list] of Object.entries(config)) {
    if (!field.startsWith('tracked') || !Array.isArray(list)) continue;
    config[field] = list.map((row) => {
      if (!row || typeof row !== 'object' || !('tileId' in row) || !('currentAmount' in row)) return row;
      const r = row as { tileId: number; currentAmount: number };
      counts[String(r.tileId)] = r.currentAmount;
      return { ...r, currentAmount: 0 };
    });
  }
  return [JSON.stringify({ ...v, at: undefined, members: undefined, config }), counts];
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
      ...(Number.isInteger(p.x) ? { x: p.x } : {}),
    };
  } catch {
    return null;
  }
}
