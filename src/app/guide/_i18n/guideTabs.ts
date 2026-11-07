// The two tabs on /guide, and turning library guides into cards the search box can rank.
//
// Pure on purpose (no `@/db`, no React) so the parts with decisions in them — what an unknown
// `?tab=` means, what a library guide is searchable by, how the grid groups — are pinned in a test.

/** "Using Anvil" (the setup guides) or "In-game guides" (the Anvil library of OSRS content guides). */
export type GuideTab = 'anvil' | 'ingame';

/** The query parameter that addresses a tab: `/guide?tab=ingame`. The default tab has no param. */
export const GUIDE_TAB_PARAM = 'tab';

/** Anything that isn't exactly the in-game tab is the default, so an old or mistyped link still lands. */
export function parseGuideTab(raw: string | string[] | undefined | null): GuideTab {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.trim().toLowerCase() === 'ingame' ? 'ingame' : 'anvil';
}

/** The param value to write for a tab — null drops it, so the default tab keeps the bare URL. */
export function guideTabParam(tab: GuideTab): string | null {
  return tab === 'ingame' ? 'ingame' : null;
}

/** The fields of a library guide the index needs. A structural subset of the `guides` row. */
export interface LibraryGuideLike {
  id: number;
  slug: string;
  title: string;
  summary: string;
  category: string;
  /** Library guides only: anything with a clan is a clan's guide and never belongs on this tab. */
  clanId: number | null;
  status: string;
  /** Read time, already worked out by the caller (lib/guideCategories readingMinutes). */
  minutes: number;
}

export interface LibraryCard {
  page: string;
  href: string;
  eyebrow: string;
  title: string;
  blurb: string;
  minutes: string;
  terms: string[];
  category: string;
}

/**
 * Cards for the in-game tab: published library guides only.
 *
 * The filter is repeated here although the store already applies it, because "a clan's private copy
 * shows up on the public index" is the one failure this tab must not have, and it should not depend
 * on a caller remembering which list function to use.
 */
export function libraryCards(
  guides: readonly LibraryGuideLike[],
  opts: {
    category: (key: string) => { label: string; icon: string };
    href: (slug: string) => string;
    /** "{n} min read". */
    readTime: string;
  },
): LibraryCard[] {
  return guides
    .filter((g) => g.clanId == null && g.status === 'published')
    .map((g) => {
      const cat = opts.category(g.category);
      return {
        page: g.slug,
        href: opts.href(g.slug),
        eyebrow: `${cat.icon} ${cat.label}`,
        title: g.title,
        blurb: g.summary,
        minutes: opts.readTime.replace('{n}', String(g.minutes)),
        // The category key and the slug's words: "cox", "tob" and "zulrah" live in slugs more often
        // than in a summary written for people who already know what the guide is.
        terms: [g.category, ...g.slug.split('-').filter(Boolean)],
        category: g.category,
      };
    });
}

/** Cards grouped by category, in the given category order; categories nobody lists go last. */
export function groupLibraryCards(cards: readonly LibraryCard[], order: readonly string[]): { category: string; cards: LibraryCard[] }[] {
  const groups = new Map<string, LibraryCard[]>();
  for (const card of cards) {
    const list = groups.get(card.category);
    if (list) list.push(card);
    else groups.set(card.category, [card]);
  }
  const rank = (key: string) => {
    const i = order.indexOf(key);
    return i === -1 ? order.length : i;
  };
  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([category, list]) => ({ category, cards: list }));
}
