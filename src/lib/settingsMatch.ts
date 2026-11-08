// The ranked "which setting did they mean" match, shared by the admin settings search
// (lib/adminSettingsIndex) and the member one on /settings (lib/memberSettingsIndex).
//
// PURE, no imports: both catalogues are read by client components and node:test suites, and the
// member page should not ship the whole admin catalogue just to borrow the matcher.

/** What the matcher reads from an entry: what it is called, what people call it, and where it lives. */
export interface MatchEntry {
  readonly label: string;
  readonly keywords: readonly string[];
  readonly description: string;
  readonly section: string;
}


/** Lowercase, accents off ("Déaths" is "deaths"), split on anything that isn't a letter or digit. */
export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** "webhooks" should find "webhook", "deaths" "death": drop one trailing s from longer words. */
function stem(term: string): string {
  return term.length > 3 && term.endsWith('s') && !term.endsWith('ss') ? term.slice(0, -1) : term;
}

/** Words that say nothing about WHICH setting: "where do I change the deaths" is a search for deaths. */
const FILLER = new Set([
  'the', 'a', 'an', 'to', 'of', 'my', 'our', 'how', 'do', 'does', 'i', 'where', 'is', 'are', 'can', 'what',
  'for', 'and', 'or', 'with', 'from', 'change', 'edit', 'find', 'setting', 'settings', 'turn', 'on', 'off',
  'make', 'get', 'set', 'up',
]);

/** The words of a query that matter: filler dropped, unless that leaves nothing. */
export function queryTerms(query: string): string[] {
  const all = tokens(query).map(stem);
  const kept = all.filter((t) => !FILLER.has(t));
  return kept.length ? kept : all;
}

/**
 * Edit distance with adjacent swaps counted once ("boots" → "boost"), stopped early past `max`:
 * past that it is a different word, not a typo.
 */
export function withinEdits(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  const rows: number[][] = [Array.from({ length: b.length + 1 }, (_, j) => j)];
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(rows[i - 1][j] + 1, row[j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, rows[i - 2][j - 2] + 1);
      row[j] = v;
      best = Math.min(best, v);
    }
    if (best > max) return false;
    rows.push(row);
  }
  return rows[a.length][b.length] <= max;
}

/** Typos are forgiven only in words long enough that one slip still leaves the word recognisable. */
const TYPO_MIN = 4;

/** Is `t` a one-slip typo of `w`, or of the start of `w` (a long word half typed, with a slip)? */
function typoOf(t: string, w: string): boolean {
  if (t.length < TYPO_MIN) return false;
  if (withinEdits(t, w, 1)) return true;
  for (const n of [t.length - 1, t.length, t.length + 1]) {
    if (n >= TYPO_MIN && n < w.length && withinEdits(t, w.slice(0, n), 1)) return true;
  }
  return false;
}

interface Haystack {
  label: string[];
  keywords: string[];
  phrases: string[];
  rest: string[];
  labelText: string;
}

const HAY = new WeakMap<MatchEntry, Haystack>();

function haystack(entry: MatchEntry): Haystack {
  let h = HAY.get(entry);
  if (!h) {
    const label = tokens(entry.label).map(stem);
    h = {
      label,
      keywords: tokens(entry.keywords.join(' ')).map(stem),
      phrases: entry.keywords.map((k) => tokens(k).map(stem).join(' ')),
      rest: tokens(`${entry.description} ${entry.section}`).map(stem),
      labelText: label.join(' '),
    };
    HAY.set(entry, h);
  }
  return h;
}

// Where a word hit, best first. The label names the setting; keywords are what people call it; the
// description and breadcrumb only mention it. A typo anywhere is worth less than a clean hit there.
const W = {
  labelFirst: 40,
  labelExact: 34,
  labelPrefix: 30,
  keywordExact: 24,
  keywordPrefix: 20,
  restExact: 12,
  restPrefix: 10,
  labelTypo: 14,
  keywordTypo: 9,
  restTypo: 4,
  wholeLabelPrefix: 50,
  wholeKeyword: 25,
  keywordPhrasePrefix: 15,
} as const;

function termScore(t: string, h: Haystack): { score: number; typo: boolean } | null {
  if (h.label[0]?.startsWith(t)) return { score: W.labelFirst, typo: false };
  if (h.label.includes(t)) return { score: W.labelExact, typo: false };
  if (h.label.some((w) => w.startsWith(t))) return { score: W.labelPrefix, typo: false };
  if (h.keywords.includes(t)) return { score: W.keywordExact, typo: false };
  if (h.keywords.some((w) => w.startsWith(t))) return { score: W.keywordPrefix, typo: false };
  if (h.rest.includes(t)) return { score: W.restExact, typo: false };
  if (h.rest.some((w) => w.startsWith(t))) return { score: W.restPrefix, typo: false };
  if (h.label.some((w) => typoOf(t, w))) return { score: W.labelTypo, typo: true };
  if (h.keywords.some((w) => typoOf(t, w))) return { score: W.keywordTypo, typo: true };
  if (h.rest.some((w) => typoOf(t, w))) return { score: W.restTypo, typo: true };
  return null;
}

/** How one entry answers a query: 0 = not at all; `typo` = only by forgiving a slip somewhere. */
export function matchSetting(entry: MatchEntry, query: string): { score: number; typo: boolean } {
  const terms = queryTerms(query);
  if (terms.length === 0) return { score: 0, typo: false };
  const h = haystack(entry);
  let score = 0;
  let typo = false;
  for (const t of terms) {
    const hit = termScore(t, h);
    if (!hit) return { score: 0, typo: false };
    score += hit.score;
    typo ||= hit.typo;
  }
  const phrase = terms.join(' ');
  if (h.labelText.startsWith(phrase)) score += W.wholeLabelPrefix;
  // A keyword PHRASE typed whole ("keep deaths", "old bot"). One word is already scored above.
  if (terms.length > 1) {
    if (h.phrases.includes(phrase)) score += W.wholeKeyword;
    else if (h.phrases.some((p) => p.startsWith(phrase))) score += W.keywordPhrasePrefix;
  }
  return { score, typo };
}

/**
 * How well one entry answers the query, or 0 when it does not. EVERY word has to hit somewhere, so
 * more words narrow; each word scores by the best place it hit (label start > label word > keyword >
 * description), so an entry NAMED by the query outranks one that merely mentions it.
 */
export function scoreSetting(entry: MatchEntry, query: string): number {
  return matchSetting(entry, query).score;
}

/**
 * Entries matching every word of the query, best first; ties keep catalogue order. Empty query →
 * none. Typo-forgiven matches are a fallback: if anything matched cleanly, they are left out, so
 * "rank" finds ranks without a "bank" tagging along.
 */
export function searchSettings<E extends MatchEntry>(query: string, entries: readonly E[], limit = 20): E[] {
  const scored = entries
    .map((entry, i) => ({ entry, i, ...matchSetting(entry, query) }))
    .filter((r) => r.score > 0);
  const clean = scored.some((r) => !r.typo);
  return scored
    .filter((r) => !clean || !r.typo)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, limit)
    .map((r) => r.entry);
}
