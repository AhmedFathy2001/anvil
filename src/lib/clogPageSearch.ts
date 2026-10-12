import { BOSSES } from '@/lib/constants';
import { clogPageNames } from '@/lib/clogDataset';
import { bossKeysForPage } from '@/lib/clogKillcounts';

// Finding a collection log page by what people actually type.
//
// The game names some pages for the place rather than the boss — TzKal-Zuk's kills are on "The
// Inferno", Sol Heredit's on "Fortis Colosseum", Jad's on "The Fight Caves" — so a search over page
// names alone finds nothing for "zuk". Each page is searchable by its own name, by every boss whose
// kills it counts (lib/clogKillcounts), and by those bosses' short names (BOSSES aliases: cox, cg,
// kq, jad…). The page name stays the canonical value; the boss is only how it was found.

const BOSS_BY_KEY = new Map(BOSSES.map((b) => [b.key, b]));
const bare = (s: string) => s.toLowerCase().replace(/^the\s+/, '').trim();

interface PageTerms {
  page: string;
  /** [term, the boss label it came from (null = the page's own name)]. */
  terms: [string, string | null][];
}

let index: PageTerms[] | null = null;
function pages(): PageTerms[] {
  if (index) return index;
  index = clogPageNames().map((page) => {
    const terms: [string, string | null][] = [[page.toLowerCase(), null], [bare(page), null]];
    for (const key of bossKeysForPage(page)) {
      const boss = BOSS_BY_KEY.get(key);
      if (!boss) continue;
      terms.push([boss.label.toLowerCase(), boss.label], [bare(boss.label), boss.label]);
      for (const alias of boss.aliases ?? []) terms.push([alias.toLowerCase(), boss.label]);
    }
    return { page, terms };
  });
  return index;
}

export interface PageMatch {
  page: string;
  /** The boss the query matched, when it wasn't the page's own name — "TzKal-Zuk" for "zuk". */
  via: string | null;
}

/**
 * Pages matching `query`, best first: an exact name or alias, then a prefix, then a word that starts
 * with it, then anywhere inside. An empty query lists pages in catalogue order.
 */
export function searchClogPages(query: string, limit = 25): PageMatch[] {
  const q = query.trim().toLowerCase();
  if (!q) return pages().slice(0, limit).map((p) => ({ page: p.page, via: null }));
  const scored: { m: PageMatch; score: number; order: number }[] = [];
  pages().forEach((p, order) => {
    let best: { score: number; via: string | null } | null = null;
    for (const [term, via] of p.terms) {
      const score =
        term === q ? 0 : term.startsWith(q) ? 1 : term.split(/[\s'-]+/).some((w) => w.startsWith(q)) ? 2 : term.includes(q) ? 3 : -1;
      if (score < 0) continue;
      // Prefer the page's own name on a tie, so "inferno" doesn't announce itself as "via TzKal-Zuk".
      if (!best || score < best.score || (score === best.score && via == null && best.via != null)) best = { score, via };
    }
    if (best) scored.push({ m: { page: p.page, via: best.via }, score: best.score, order });
  });
  scored.sort((a, b) => a.score - b.score || a.order - b.order);
  return scored.slice(0, limit).map((s) => s.m);
}

/** Free-typed text → one page: the best match, or null. */
export function resolveClogPage(query: string): string | null {
  return searchClogPages(query, 1)[0]?.page ?? null;
}
