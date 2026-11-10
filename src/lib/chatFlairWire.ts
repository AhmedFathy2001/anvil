// The in-game Supporter name list on the wire (GET /api/plugin/chat-flair/v/<v>, push {t:'flair'}).
// Pure: no database, so the delta logic and the 200k-name load test run without one
// (tests/chat-flair-wire.test.ts). lib/chatFlairFeed is the database half.
//
// A list is a palette of looks plus parallel arrays: `names` (normalized, sorted) and `ix` (each
// name's look in `styles`). Most Supporters wear their tier's default, so the palette stays small and
// each name costs its own letters and a digit or two — and sorted names gzip well.
//
//   full:  {v, styles:[{c,g?,s?,d?,l?}…], names:[…], ix:[…]}
//          d / l: the person's own look for dark / light chat, {c, g?}, worn as-is there (omitted
//          when unset: the plugin then adapts c/g for contrast itself).
//   delta: {t:'flair', v, from, styles, names, ix, del:[…]}   names set to a look (palette local to
//          the message), del dropped. A plugin holding `from` applies it; anything else catches up.
//   big:   {t:'flair', v, from, full:true}                     too large for a socket message.

/** A surface's own look, raw: solid colour and gradient stops (g only with 2+). */
export interface FlairSurface {
  c: string;
  g?: string[];
}

/** One look: solid colour, optional gradient stops, Patron star, own dark/light looks — GET /api/plugin/chat-flair's entry minus the name. */
export interface FlairStyle {
  c: string;
  g?: string[];
  s?: true;
  d?: FlairSurface;
  l?: FlairSurface;
  /** Tenure chat icon (lib/supporterTiers TENURE_LADDER chat): 1 star, 2 ringed, 3 hex, 4 solid hex. Plugins that know it draw it instead of `s`, for every tier. */
  t?: 1 | 2 | 3 | 4;
}

/** What the server tracks per name: its look (as a key) and whose character it is (never sent). */
export interface FlairRecord {
  /** styleKey() of the look. */
  k: string;
  /** players.id owning the character, so a person's change finds their names. */
  p: number;
}

export type FlairState = Map<string, FlairRecord>;

export interface FlairList {
  v: number;
  styles: FlairStyle[];
  names: string[];
  ix: number[];
}

export interface FlairDelta {
  t: 'flair';
  v: number;
  from: number;
  styles?: FlairStyle[];
  names?: string[];
  ix?: number[];
  del?: string[];
  full?: true;
}

/** A change this many names or more isn't sent as a delta: plugins fetch the versioned list instead. */
export const MAX_DELTA_NAMES = 2_000;
/** Postgres NOTIFY carries at most 8000 bytes; a delta bigger than this goes out as {full:true}. */
export const MAX_NOTIFY_BYTES = 7_500;

type SurfaceKey = [string, string[] | null] | null;

function surfaceKey(x: FlairSurface | undefined): SurfaceKey {
  return x ? [x.c, x.g && x.g.length >= 2 ? x.g : null] : null;
}

function surfaceFromKey(k: SurfaceKey | undefined): FlairSurface | null {
  return k ? { c: k[0], ...(k[1] ? { g: k[1] } : {}) } : null;
}

/**
 * A look as a palette/state key. Looks without a dark/light override keep the original 3-part key,
 * so stored states and logged versions from before overrides existed still match. A tenure icon (t)
 * goes sixth, after the (possibly null) overrides.
 */
export function styleKey(s: FlairStyle): string {
  const base: unknown[] = [s.c, s.g ?? null, s.s ? 1 : 0];
  if (s.d || s.l || s.t) base.push(surfaceKey(s.d), surfaceKey(s.l));
  if (s.t) base.push(s.t);
  return JSON.stringify(base);
}

export function styleFromKey(key: string): FlairStyle {
  const [c, g, s, d, l, t] = JSON.parse(key) as [string, string[] | null, number, SurfaceKey?, SurfaceKey?, FlairStyle['t']?];
  const dark = surfaceFromKey(d);
  const light = surfaceFromKey(l);
  return { c, ...(g ? { g } : {}), ...(s ? { s: true as const } : {}), ...(dark ? { d: dark } : {}), ...(light ? { l: light } : {}), ...(t ? { t } : {}) };
}

/** Names with their looks as palette + parallel arrays, names sorted. */
function encode(entries: Iterable<[string, string]>): { styles: FlairStyle[]; names: string[]; ix: number[] } {
  const sorted = [...entries].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const palette = new Map<string, number>();
  const styles: FlairStyle[] = [];
  const names: string[] = new Array(sorted.length);
  const ix: number[] = new Array(sorted.length);
  sorted.forEach(([name, key], n) => {
    let i = palette.get(key);
    if (i == null) {
      palette.set(key, (i = styles.length));
      styles.push(styleFromKey(key));
    }
    names[n] = name;
    ix[n] = i;
  });
  return { styles, names, ix };
}

export function encodeList(v: number, state: FlairState): FlairList {
  return { v, ...encode([...state].map(([n, r]) => [n, r.k] as [string, string])) };
}

/** A list (or a delta's set part) back into name → look. */
export function decodeEntries(list: { styles?: FlairStyle[]; names?: string[]; ix?: number[] }): Map<string, FlairStyle> {
  const out = new Map<string, FlairStyle>();
  const names = list.names ?? [];
  for (let n = 0; n < names.length; n++) {
    const s = list.styles?.[list.ix?.[n] ?? -1];
    if (s) out.set(names[n], s);
  }
  return out;
}

export interface FlairDiff {
  /** Names whose look is new or changed: on the wire. */
  set: Map<string, string>;
  /** Names gone from the list: on the wire. */
  del: string[];
  /** Every record to write into the state, owner-only moves included (those are never sent). */
  records: Map<string, FlairRecord>;
}

/**
 * What changed among `checked` names, `fresh` being what the database says of them now (a name in
 * `checked` but not in `fresh` is no longer eligible). Only eligible names ever reach `set`, so a
 * delta can't say more than the full list would.
 */
export function diffFlair(state: FlairState, fresh: Map<string, FlairRecord>, checked: Iterable<string>): FlairDiff {
  const set = new Map<string, string>();
  const del: string[] = [];
  const records = new Map<string, FlairRecord>();
  for (const name of new Set(checked)) {
    const now = fresh.get(name);
    const was = state.get(name);
    if (!now) {
      if (was) del.push(name);
      continue;
    }
    if (!was || was.k !== now.k) set.set(name, now.k);
    if (!was || was.k !== now.k || was.p !== now.p) records.set(name, now);
  }
  del.sort();
  return { set, del, records };
}

export function isEmptyDiff(d: FlairDiff): boolean {
  return d.set.size === 0 && d.del.length === 0 && d.records.size === 0;
}

export function applyDiff(state: FlairState, d: Pick<FlairDiff, 'del' | 'records'>): void {
  for (const n of d.del) state.delete(n);
  for (const [n, r] of d.records) state.set(n, r);
}

/** The socket message for a diff (or {full:true} when it is too big to be one). */
export function deltaMessage(v: number, from: number, d: Pick<FlairDiff, 'set' | 'del'>): FlairDelta {
  if (d.set.size + d.del.length >= MAX_DELTA_NAMES) return { t: 'flair', v, from, full: true };
  const msg: FlairDelta = { t: 'flair', v, from, ...encode(d.set), del: d.del };
  return msg;
}

/** The NOTIFY-sized form: the delta itself when it fits, else the bare "fetch it" marker. */
export function notifyMessage(msg: FlairDelta): FlairDelta {
  if (msg.full || Buffer.byteLength(JSON.stringify(msg)) <= MAX_NOTIFY_BYTES) return msg;
  return { t: 'flair', v: msg.v, from: msg.from, full: true };
}

/**
 * The deltas a plugin at `since` needs to reach `v`, or null when it must take the full list: a gap
 * (trimmed log), a delta too big to have been kept, or more names than a full download would cost.
 */
export function catchUp(since: number, v: number, log: FlairDelta[]): FlairDelta[] | null {
  if (since <= 0 || since > v) return null;
  if (since === v) return [];
  const chain = log.filter((d) => d.v > since && d.v <= v).sort((a, b) => a.v - b.v);
  let at = since;
  let names = 0;
  for (const d of chain) {
    if (d.from !== at || d.full) return null;
    names += (d.names?.length ?? 0) + (d.del?.length ?? 0);
    at = d.v;
  }
  if (at !== v || names >= MAX_DELTA_NAMES) return null;
  return chain;
}

/** The server's whole state as compact JSON (chat_flair_snapshots.state). */
export function encodeState(state: FlairState): string {
  const keys = new Map<string, number>();
  const names: string[] = [];
  const ix: number[] = [];
  const p: number[] = [];
  for (const [n, r] of state) {
    let i = keys.get(r.k);
    if (i == null) keys.set(r.k, (i = keys.size));
    names.push(n);
    ix.push(i);
    p.push(r.p);
  }
  return JSON.stringify({ keys: [...keys.keys()], names, ix, p });
}

export function decodeState(text: string): FlairState {
  const { keys, names, ix, p } = JSON.parse(text) as { keys: string[]; names: string[]; ix: number[]; p: number[] };
  const state: FlairState = new Map();
  for (let n = 0; n < names.length; n++) state.set(names[n], { k: keys[ix[n]], p: p[n] });
  return state;
}

/** One logged version replayed onto a state: its delta plus the owners it recorded. */
export function replay(state: FlairState, msg: FlairDelta, owners: Record<string, number>): void {
  const set = decodeEntries(msg);
  for (const n of msg.del ?? []) state.delete(n);
  for (const [n, p] of Object.entries(owners)) {
    const look = set.get(n);
    const k = look ? styleKey(look) : state.get(n)?.k;
    if (k) state.set(n, { k, p });
  }
}

/** The owners a diff records, for its log row. */
export function ownersOf(d: Pick<FlairDiff, 'records'>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [n, r] of d.records) out[n] = r.p;
  return out;
}
