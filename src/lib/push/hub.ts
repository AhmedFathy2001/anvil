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
//
// Stream overlays (lib/overlay) are WATCHERS, not clients: they get a bare NUDGE (`{"t":"nudge"}`)
// when their event moves, never a view, and fetch their own public payload in answer. So nothing an
// overlay key opens is built here, and the overlay's own rules (curtain, reveal) stay the only gate.
//
// The website's Feed & chat page (a `web` ticket) is a ROWS-ONLY client: it sits in its board's and
// its teams' rooms for panel rows (deliverRows) and in `people` for rows aimed at its user, but never
// in the view rooms — nothing is built for it and no board or tile view is sent to it. Staff who read
// every team's chat carry those teams in `teamIds` (rows rooms only, any ticket); a team not listed is
// never heard.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * One NOTIFY from the database (migration 0149) or lib/pushNotify: e = event, t = team, i = tile,
 * x = a team somebody just left (removed, or moved to another), p = the people whose seat on it was
 * just added, removed or moved (migration 0217).
 */
export interface PushChange {
  k: string;
  e: number;
  t: number | null;
  i: number | null;
  x?: number;
  p?: number[];
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

/** A stream overlay watching one event. */
export interface Watcher {
  send(message: string): void;
}

/** All an overlay is ever sent: "your event moved, fetch". */
export const NUDGE = JSON.stringify({ t: 'nudge' });

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
  /** user → their clients with the chat feed on (lib/chatFeed sends to people, not views). */
  private readonly feeds = new Map<number, Set<PushClient>>();
  /** user → every client they have open, for panel rows (lib/panelRows) aimed at people. */
  private readonly people = new Map<number, Set<PushClient>>();
  /** team key → rows-only listeners (a web ticket's teams, any ticket's `teamIds`): rows, never views. */
  private readonly rowTeams = new Map<string, Set<PushClient>>();
  /** event → rows-only listeners on the board (web tickets): its room's rows, never its tile views. */
  private readonly rowEvents = new Map<number, Set<PushClient>>();
  /** event → stream overlays watching it (see the header: they only ever get a nudge). */
  private readonly watchers = new Map<number, Set<Watcher>>();
  /** event → its pending nudge, gathered and spaced like a view build. */
  private readonly nudges = new Map<number, { timer: (() => void) | null; lastAt: number }>();

  constructor(opts: ViewHubOptions) {
    this.opts = opts;
  }

  /** Subscribe a client to its scope and send it what's current; the returned function unsubscribes. */
  add(client: PushClient): () => void {
    const sc = client.scope;
    // The team belongs to the first board (the seat's); any other board is watched without one. A web
    // client holds no view at all.
    const keys = sc.web ? [] : sc.eventIds.map((e, n) => teamKey(e, n === 0 ? sc.teamId : null));
    const rowKeys = rowTeamKeys(sc);
    const boards = sc.web ? this.rowEvents : this.events;
    for (const k of keys) addTo(this.teams, k, client);
    for (const k of rowKeys) addTo(this.rowTeams, k, client);
    for (const e of sc.eventIds) addTo(boards, e, client);
    if (client.scope.feed) addTo(this.feeds, client.scope.userId, client);
    addTo(this.people, client.scope.userId, client);
    for (const k of keys) {
      const v = this.view(k);
      if (v.text != null) client.send(v.text);
      else {
        v.owed.add(client);
        this.schedule(v);
      }
    }
    return () => {
      if (client.scope.feed) removeFrom(this.feeds, client.scope.userId, client);
      removeFrom(this.people, client.scope.userId, client);
      for (const k of keys) {
        removeFrom(this.teams, k, client);
        this.views.get(k)?.owed.delete(client);
        if (!this.teams.has(k)) this.drop(k);
      }
      for (const k of rowKeys) removeFrom(this.rowTeams, k, client);
      for (const e of sc.eventIds) {
        removeFrom(boards, e, client);
        if (!sc.web && !this.events.has(e)) for (const k of [...this.views.keys()]) if (parseViewKey(k)?.eventId === e) this.drop(k);
      }
    };
  }

  /** Watch an event for a stream overlay; the returned function stops. */
  watch(eventId: number, watcher: Watcher): () => void {
    let set = this.watchers.get(eventId);
    if (!set) this.watchers.set(eventId, (set = new Set()));
    set.add(watcher);
    return () => {
      const s = this.watchers.get(eventId);
      s?.delete(watcher);
      if (s?.size === 0) {
        this.watchers.delete(eventId);
        this.nudges.get(eventId)?.timer?.();
        this.nudges.delete(eventId);
      }
    };
  }

  /** How many clients are connected, for the server's health line. */
  get size(): number {
    const all = new Set<PushClient>();
    for (const set of this.events.values()) for (const c of set) all.add(c);
    for (const set of this.people.values()) for (const c of set) all.add(c);
    return all.size;
  }

  /** How many stream overlays are watching, for the same line. */
  get watching(): number {
    let n = 0;
    for (const set of this.watchers.values()) n += set.size;
    return n;
  }

  /** A chat-feed line for these users, to each of their clients with the feed on. */
  deliver(feed: FeedNotice): void {
    const text = JSON.stringify(feed.m);
    for (const u of feed.u) for (const c of this.feeds.get(u) ?? []) c.send(text);
  }

  /**
   * Panel rows (a feed row, a chat line, a removal): to a board's room, one team's room on it, or
   * named people. Encoded once, whatever the room's size — a thousand-player event chat is one
   * stringify and a thousand sends.
   */
  deliverRows(notice: RowsNotice): void {
    const text = JSON.stringify(notice.m);
    // `rx`: the rows' reaction chips are for the board's players and staff. A room client not seated on
    // the board (a clanmate watching it as the clan's home board) gets the rows without them, encoded once.
    // A reaction update ('rowsreact') is nothing but chips: such a client gets none of it.
    let bare: string | null | undefined;
    const bareText = () => (bare !== undefined ? bare : (bare = notice.m.t === 'rowsreact' ? null : JSON.stringify(withoutReacts(notice.m))));
    const sent = new Set<PushClient>();
    const send = (set: Set<PushClient> | undefined, room = false) => {
      for (const c of set ?? []) {
        // Only a plugin that said it reads rows: an older one would log a warning for each.
        if (sent.has(c) || !c.scope.rows) continue;
        sent.add(c);
        const out = room && notice.rx && !seatedOn(c.scope, notice.e!) ? bareText() : text;
        if (out != null) c.send(out);
      }
    };
    // The people named first: they're the ones a row was meant for as it is (a staff member watching
    // the board from their home board is named too, and gets the chips).
    for (const u of notice.u ?? []) send(this.people.get(u));
    if (notice.e != null) {
      if (notice.t != null) {
        const k = teamKey(notice.e, notice.t);
        send(this.teams.get(k), true);
        send(this.rowTeams.get(k), true);
      } else {
        send(this.events.get(notice.e), true);
        send(this.rowEvents.get(notice.e), true);
      }
    }
    // A feed row on a board is news for its overlays' feed view (a reaction count isn't).
    if (notice.e != null && notice.m.t !== 'rowsreact') this.nudge(notice.e);
  }

  /**
   * A Supporter-list delta ({"t":"flair"}, lib/chatFlairFeed) to every plugin that said it reads them
   * (an older one would log a warning for each). Global: the list is the same for everyone.
   */
  deliverFlair(message: Record<string, unknown>): number {
    const text = JSON.stringify(message);
    const sent = new Set<PushClient>();
    for (const set of this.people.values()) {
      for (const c of set) {
        if (sent.has(c) || !c.scope.flair) continue;
        sent.add(c);
        c.send(text);
      }
    }
    return sent.size;
  }

  dispatch(change: PushChange): void {
    // Overlays first: a board nobody has the plugin open on can still be on stream.
    this.nudge(change.e);
    // Someone was just seated, unseated or moved here: every client of theirs re-tickets, wherever it
    // listens. A newly seated player isn't on this board's room yet (their ticket predates the seat),
    // so nothing below would reach them — and their chat and Feed rows would wait for a config poll.
    for (const u of change.p ?? []) for (const c of [...(this.people.get(u) ?? [])]) c.rescope?.();
    // Rows-only listeners on a team somebody just left re-ticket too (they hold no view, so nothing
    // below reaches them).
    if (change.x != null) for (const c of [...(this.rowTeams.get(teamKey(change.e, change.x)) ?? [])]) c.rescope?.();
    const onBoard = this.events.get(change.e);
    if (!onBoard) return;
    // A ticket's team was true when the site signed it. When somebody leaves a team, that team's
    // listeners ask again — the leaver among them — rather than anyone hearing a team they've left
    // until their ticket runs out. Nobody else on the board is touched.
    if (change.x != null) {
      for (const c of [...(this.teams.get(teamKey(change.e, change.x)) ?? [])]) c.rescope?.();
      // Clients that follow this board as an EXTRA board (not their ticket's first) have no team room
      // here, so the line above can't reach a leaver among them: they re-ticket too.
      for (const c of [...onBoard]) if (c.scope.eventIds[0] !== change.e) c.rescope?.();
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
    // The event row itself moved (its rules, its clock, a standings reveal — lib/standingsReveal
    // announces one): every tile view on the board may read differently now, so rebuild those too.
    // Only views somebody already holds; nothing new is built.
    if (change.k === 'events') {
      const tilePrefix = `tile:${change.e}:`;
      for (const k of this.views.keys()) if (k.startsWith(tilePrefix)) this.schedule(this.view(k));
    }
  }

  /** Everything rebuilt — after the database listener reconnects, when changes may have gone unheard. */
  refreshAll(): void {
    for (const k of this.teams.keys()) this.schedule(this.view(k));
    for (const e of this.watchers.keys()) this.nudge(e);
    // Web pages hold no view to rebuild: rows may have gone unheard, so they check once.
    const sent = new Set<PushClient>();
    for (const set of this.rowEvents.values()) {
      for (const c of set) {
        if (sent.has(c)) continue;
        sent.add(c);
        c.send(NUDGE);
      }
    }
  }

  /** Tell an event's overlays to fetch: gathered for a moment, then at most once per gap. */
  private nudge(eventId: number): void {
    const set = this.watchers.get(eventId);
    if (!set) return;
    let n = this.nudges.get(eventId);
    if (!n) this.nudges.set(eventId, (n = { timer: null, lastAt: -Infinity }));
    if (n.timer) return;
    const state = n;
    const gap = state.lastAt + (this.opts.minGapMs ?? DEFAULT_MIN_GAP_MS) - this.now();
    state.timer = this.later(() => {
      state.timer = null;
      state.lastAt = this.now();
      for (const w of this.watchers.get(eventId) ?? []) w.send(NUDGE);
    }, Math.max(this.opts.gatherMs ?? DEFAULT_GATHER_MS, gap));
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

/** The rows-only team rooms a scope listens in, on its first board: a web ticket's own team, and `teamIds`. */
function rowTeamKeys(scope: PushScope): string[] {
  const first = scope.eventIds[0];
  if (first == null) return [];
  const teams = new Set<number>(scope.teamIds ?? []);
  if (scope.web && scope.teamId != null) teams.add(scope.teamId);
  else if (scope.teamId != null) teams.delete(scope.teamId); // already in its view room
  return [...teams].map((t) => teamKey(first, t));
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

/** A chat-feed NOTIFY (lib/chatFeed): `u` the users, `m` the message they get. */
export interface FeedNotice {
  u: number[];
  m: Record<string, unknown>;
}

/** A NOTIFY payload as a feed notice, or null when it isn't one. */
export function parseFeed(payload: string): FeedNotice | null {
  try {
    const p = JSON.parse(payload);
    if (p?.k !== 'feed' || !Array.isArray(p.u) || !p.m || typeof p.m !== 'object') return null;
    return { u: p.u.filter((n: unknown): n is number => Number.isInteger(n)), m: p.m };
  } catch {
    return null;
  }
}

/**
 * Panel rows (lib/panelRows): `e` a board (with `t`, only that team on it) and/or `u` people. `rx`: the
 * rows' reaction chips are for players only (see deliverRows).
 */
export interface RowsNotice {
  e?: number;
  t?: number;
  u?: number[];
  rx?: boolean;
  m: Record<string, unknown>;
}

/**
 * Whether a ticket holds a seat on this board: its first board with a team (else that first board is
 * only the clan's home board, watched), or any other board it lists (push/ticket: those are the
 * character's own live boards).
 */
export function seatedOn(scope: PushScope, eventId: number): boolean {
  const at = scope.eventIds.indexOf(eventId);
  return at > 0 || (at === 0 && scope.teamId != null);
}

/** A rows message with its rows' reaction chips (`gz`, `reacts`) taken off. */
export function withoutReacts(m: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(m.rows)) return m;
  return {
    ...m,
    rows: m.rows.map((r: unknown) => {
      if (!r || typeof r !== 'object') return r;
      const rest = { ...(r as Record<string, unknown>) };
      delete rest.gz;
      delete rest.reacts;
      return rest;
    }),
  };
}

/** A NOTIFY payload as panel rows, or null when it isn't one. */
export function parseRows(payload: string): RowsNotice | null {
  try {
    const p = JSON.parse(payload);
    if (p?.k !== 'rows' || !p.m || typeof p.m !== 'object') return null;
    const e = Number.isInteger(p.e) ? (p.e as number) : undefined;
    const u = Array.isArray(p.u) ? p.u.filter((n: unknown): n is number => Number.isInteger(n)) : undefined;
    if (e == null && !u?.length) return null;
    return { ...(e != null ? { e } : {}), ...(e != null && Number.isInteger(p.t) ? { t: p.t } : {}), ...(u?.length ? { u } : {}), ...(e != null && p.rx === 1 ? { rx: true } : {}), m: p.m };
  } catch {
    return null;
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
      ...(Number.isInteger(p.x) ? { x: p.x } : {}),
      ...(Array.isArray(p.p) && p.p.some(Number.isInteger) ? { p: p.p.filter((n: unknown): n is number => Number.isInteger(n)) } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * A Supporter-list NOTIFY: 'flairdirty' (migration 0216's triggers: these people and old names may
 * wear different colours now) or 'flairv' (lib/chatFlairFeed stored a version: `m` is its delta).
 */
export type FlairNotice = { kind: 'dirty'; players: number[]; names: string[] } | { kind: 'version'; m: Record<string, unknown> };

export function parseFlair(payload: string): FlairNotice | null {
  try {
    const p = JSON.parse(payload);
    if (p?.k === 'flairv' && p.m && typeof p.m === 'object' && p.m.t === 'flair') return { kind: 'version', m: p.m };
    if (p?.k !== 'flairdirty') return null;
    const players = Array.isArray(p.p) ? p.p.filter((n: unknown): n is number => Number.isInteger(n)) : [];
    const names = Array.isArray(p.n) ? p.n.filter((n: unknown): n is string => typeof n === 'string') : [];
    return { kind: 'dirty', players, names };
  } catch {
    return null;
  }
}

/**
 * Gathers 'flairdirty' notices for `gatherMs` (a merge or a Gumroad burst is one call), then hands the
 * union to `flush` — the site works out the delta. A notice arriving during a flush starts the next.
 */
export class FlairGather {
  private players = new Set<number>();
  private names = new Set<string>();
  private timer: (() => void) | null = null;
  private readonly flush: (players: number[], names: string[]) => void;
  private readonly gatherMs: number;
  private readonly later: (fn: () => void, ms: number) => () => void;

  constructor(flush: (players: number[], names: string[]) => void, gatherMs = 2_000, later?: (fn: () => void, ms: number) => () => void) {
    this.flush = flush;
    this.gatherMs = gatherMs;
    this.later = later ?? ((fn, ms) => {
      const t = setTimeout(fn, ms);
      return () => clearTimeout(t);
    });
  }

  add(players: number[], names: string[]): void {
    for (const n of players) this.players.add(n);
    for (const n of names) this.names.add(n);
    if (this.timer) return;
    this.timer = this.later(() => {
      this.timer = null;
      const p = [...this.players];
      const n = [...this.names];
      this.players.clear();
      this.names.clear();
      if (p.length || n.length) this.flush(p, n);
    }, this.gatherMs);
  }
}
