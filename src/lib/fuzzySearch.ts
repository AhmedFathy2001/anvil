// Typo-tolerant name search for the authoring pickers (items, monsters, collection log pages, the
// creator's browse lists). Pure and dependency-free, so the same ranking runs in API routes and in the
// browser.
//
// Ranking, best first:
//   0 exact name          "zenyte"         → Zenyte
//   1 name prefix         "zenyte s"       → Zenyte shard
//   2 word-boundary hit   "shard"          → Zenyte shard
//   3 every word starts a name word, any order ("shard zen" → Zenyte shard)
//   4 substring anywhere  "enyte"          → Zenyte shard
//   5 typo: every typed word is within a few edits of a name word (or of the start of one, for the
//     word still being typed) — "znyte" → Zenyte, Zenyte shard; "abyssal wip" → Abyssal whip.
// Typos are never guessed for a query of three letters or fewer, and a word gets 1 edit at 4–5
// letters, 2 at 6+ (a 3-letter word gets 1 only beside a word that matched as typed). Fuzzy only runs
// when the cheaper tiers leave room under `limit`.

/** Damerau-Levenshtein (optimal string alignment): a transposition costs 1. Stops early past `max`. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2: number[] = new Array(b.length + 1).fill(0);
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur: number[] = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev2[j] = prev[j];
    prev = cur;
  }
  return prev[b.length];
}

/** Lowercase, apostrophes dropped ("Tumeken's" → tumekens), everything else non-alphanumeric → space. */
export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Edits a typed word of this length may be off by. */
export function allowedEdits(len: number): number {
  return len <= 3 ? 0 : len <= 5 ? 1 : 2;
}

interface Entry<T> {
  item: T;
  order: number;
  /** Normalized names (primary first, then aliases). */
  names: string[];
  /** Words of each name. */
  words: string[][];
  sortKey: string;
}

export interface SearchIndex<T> {
  entries: Entry<T>[];
}

/** Precompute normalized names once per list; reuse the index across queries. */
export function buildSearchIndex<T>(items: readonly T[], namesOf: (item: T) => string | readonly string[]): SearchIndex<T> {
  const entries: Entry<T>[] = [];
  items.forEach((item, order) => {
    const raw = namesOf(item);
    const names = (typeof raw === 'string' ? [raw] : [...raw]).map(normalizeName).filter(Boolean);
    if (names.length === 0) return;
    entries.push({ item, order, names, words: names.map((n) => n.split(' ')), sortKey: names[0] });
  });
  return { entries };
}

export interface FuzzyOptions<T> {
  /** Most results returned (default 20). */
  limit?: number;
  /** Skip entries before scoring (e.g. drop-only items). */
  filter?: (item: T) => boolean;
  /** Extra readings of the query, e.g. OSRS shorthand expanded ("tbow" → twisted bow). */
  alternates?: readonly string[];
  /** Order within a tier: the list's own order (default) or alphabetical by primary name. */
  tieBreak?: 'index' | 'alpha';
}

export interface FuzzyHit<T> {
  item: T;
  /** 0 exact … 4 substring, 5 typo-corrected. */
  tier: number;
  /** Total edits for a typo hit (0 otherwise). */
  edits: number;
}

function plainTier(name: string, words: string[], q: string, qWords: string[]): number {
  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  if (name.includes(' ' + q)) return 2;
  if (qWords.length > 1 && qWords.every((w) => words.some((n) => n.startsWith(w)))) return 3;
  if (name.includes(q)) return 4;
  return -1;
}

interface Query {
  q: string;
  words: string[];
}

/**
 * Edits needed for every query word to land on a distinct-enough name word, or -1. `dist` caches
 * word distances for this query (names share words: "dragon" is in hundreds of items).
 */
function fuzzyEdits(words: string[], qy: Query, dist: Map<string, number>[]): number {
  let total = 0;
  let anchored = false;
  const pending: number[] = [];
  for (let i = 0; i < qy.words.length; i++) {
    const w = qy.words[i];
    if (words.some((n) => n === w || (w.length >= 2 && n.startsWith(w)))) {
      anchored = true;
      continue;
    }
    pending.push(i);
  }
  for (const i of pending) {
    const w = qy.words[i];
    const max = w.length === 3 && anchored ? 1 : allowedEdits(w.length);
    if (max === 0) return -1;
    const last = i === qy.words.length - 1;
    const cache = dist[i];
    let best = max + 1;
    for (const n of words) {
      let d = cache.get(n);
      if (d == null) {
        d = n.length >= 3 ? editDistance(w, n, max) : max + 1;
        // The word still being typed may be a misspelt start: "znyt" → "zenyt(e)". Same first
        // letter only, so a short stub can't wander far.
        if (last && d > max && n.length > w.length && n[0] === w[0]) {
          for (let len = w.length - 1; len <= w.length + 1 && d > 0; len++) {
            if (len < 3 || len >= n.length) continue;
            const p = editDistance(w, n.slice(0, len), max);
            if (p <= max) d = Math.min(d, p + 0.5);
          }
        }
        cache.set(n, d);
      }
      if (d < best) best = d;
      if (best === 0) break;
    }
    // A misspelt-start hit carries +0.5 so a whole-word typo ranks above it.
    if (Math.floor(best) > max) return -1;
    total += best;
  }
  return total;
}

const MAX_QUERY = 64;
const MAX_WORDS = 6;

/** Ranked matches for `query` over a prebuilt index. */
export function searchIndex<T>(index: SearchIndex<T>, query: string, opts: FuzzyOptions<T> = {}): FuzzyHit<T>[] {
  const limit = opts.limit ?? 20;
  const queries: Query[] = [];
  for (const raw of [query, ...(opts.alternates ?? [])]) {
    // Bounded work per request: no real name is longer than this, and the routes pass ?q= straight in.
    const q = normalizeName(raw.slice(0, MAX_QUERY)).split(' ').slice(0, MAX_WORDS).join(' ');
    if (q && !queries.some((x) => x.q === q)) queries.push({ q, words: q.split(' ') });
  }
  if (queries.length === 0) return [];

  const pool = opts.filter ? index.entries.filter((e) => opts.filter!(e.item)) : index.entries;
  const hits: { e: Entry<T>; tier: number; edits: number }[] = [];
  const missed: Entry<T>[] = [];
  for (const e of pool) {
    let tier = -1;
    for (const qy of queries) {
      for (let k = 0; k < e.names.length; k++) {
        const t = plainTier(e.names[k], e.words[k], qy.q, qy.words);
        if (t >= 0 && (tier < 0 || t < tier)) tier = t;
      }
      if (tier === 0) break;
    }
    if (tier >= 0) hits.push({ e, tier, edits: 0 });
    else missed.push(e);
  }

  // Typos only fill what the plain tiers left empty, and never for a short query.
  const letters = queries[0].q.replace(/ /g, '').length;
  if (hits.length < limit && letters > 3) {
    const caches = queries.map((qy) => qy.words.map(() => new Map<string, number>()));
    for (const e of missed) {
      let best = -1;
      queries.forEach((qy, qi) => {
        for (const words of e.words) {
          const d = fuzzyEdits(words, qy, caches[qi]);
          if (d >= 0 && (best < 0 || d < best)) best = d;
        }
      });
      if (best >= 0) hits.push({ e, tier: 5, edits: best });
    }
  }

  const alpha = opts.tieBreak === 'alpha';
  hits.sort(
    (a, b) =>
      a.tier - b.tier ||
      a.edits - b.edits ||
      (alpha ? a.e.sortKey.localeCompare(b.e.sortKey) : a.e.order - b.e.order),
  );
  return hits.slice(0, limit).map((h) => ({ item: h.e.item, tier: h.tier, edits: h.edits }));
}

const indexCache = new WeakMap<object, SearchIndex<unknown>>();

/**
 * Ranked, typo-tolerant search over `items`. The index is cached per array, so pass a long-lived
 * array (a server catalogue, a memoised client list) to precompute once — and always search one
 * array with the same `namesOf`.
 */
export function fuzzySearch<T>(
  items: readonly T[],
  query: string,
  namesOf: (item: T) => string | readonly string[],
  opts: FuzzyOptions<T> = {},
): T[] {
  let index = indexCache.get(items) as SearchIndex<T> | undefined;
  if (!index) {
    index = buildSearchIndex(items, namesOf);
    indexCache.set(items, index as SearchIndex<unknown>);
  }
  return searchIndex(index, query, opts).map((h) => h.item);
}
