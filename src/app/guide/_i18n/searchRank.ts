// Ranking a typed query against the guide list.
//
// Pure and separate from the component because this is the part with opinions in it — what counts
// as a match, what a typo is worth, whether two words AND or OR — and those are worth pinning in a
// test rather than discovering by typing into the box.

export interface Searchable {
  title: string;
  eyebrow: string;
  blurb: string;
  /** Language-neutral jargon and symptom words — see searchTerms. */
  terms: string[];
}

/** Lowercase, strip accents and punctuation, split. */
export function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Edit distance, short-circuited at `max` — past that it is a different word, not a typo. */
export function within(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      best = Math.min(best, row[j]);
    }
    if (best > max) return false;
    prev = row;
  }
  return prev[b.length] <= max;
}

interface Haystacks {
  title: string[];
  blurb: string[];
  terms: string[];
}

export function haystacksFor(item: Searchable): Haystacks {
  return {
    title: tokenize(`${item.title} ${item.eyebrow}`),
    blurb: tokenize(item.blurb),
    terms: item.terms.flatMap((t) => tokenize(t)),
  };
}

/**
 * Score one guide against one typed token.
 *
 * Weighted by WHERE it matched: a hit in the title means the reader named the page, a hit in the
 * blurb means they described it, a hit in the term list means they typed the jargon or the symptom.
 * All three should find it; they should not rank equally.
 */
export function scoreToken(token: string, hay: Haystacks): number {
  let best = 0;
  const consider = (word: string, weight: number) => {
    if (word === token) best = Math.max(best, weight * 3);
    else if (word.startsWith(token) || token.startsWith(word)) best = Math.max(best, weight * 2);
    // Typos only for words long enough that one edit is not simply a different short word.
    else if (token.length >= 4 && within(word, token, 1)) best = Math.max(best, weight);
  };
  for (const w of hay.title) consider(w, 4);
  for (const w of hay.terms) consider(w, 3);
  for (const w of hay.blurb) consider(w, 2);
  return best;
}

/**
 * Rank items against a query, best first. `null` means "no query" — show the normal listing.
 *
 * Multi-word queries AND rather than OR: "discord webhook" must not return every guide that says
 * Discord once. A token nothing scores on drops that guide entirely.
 */
export function rank<T extends Searchable>(query: string, items: T[]): T[] | null {
  const tokens = tokenize(query);
  if (!tokens.length) return null;

  const scored: { item: T; total: number }[] = [];
  for (const item of items) {
    const hay = haystacksFor(item);
    let total = 0;
    let missed = false;
    for (const token of tokens) {
      const s = scoreToken(token, hay);
      if (s === 0) {
        missed = true;
        break;
      }
      total += s;
    }
    if (!missed) scored.push({ item, total });
  }
  return scored.sort((a, b) => b.total - a.total).map((r) => r.item);
}
