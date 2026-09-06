import { BOSSES } from '@/lib/constants';

// What a collection log page counts, and where that number comes from.
//
// The game prints these under a page's title, one line per mode:
//
//   Theatre of Blood completions: 105
//   Theatre of Blood (Entry) completions: 11
//   Theatre of Blood (Hard) completions: 81
//
// SEPARATE LINES, NOT A SUM. The tiers share a collection log page because they share a drop table,
// but they are different content with different killcounts, and adding them together would answer a
// question nobody asked. This mirrors the game rather than inventing a total.
//
// TWO SOURCES, in this order:
//   the PLUGIN's own reading of those lines (member_clog_kc) — exact, and it covers Entry mode and
//     everything else the hiscores never publish;
//   the HISCORES — every mode the hiscores do track, which is most of the interesting ones.
//
// The plugin only captures the lines for pages a player actually OPENS: the one-button whole-log
// sync uses a search toggle that renders every item without page headers, so it carries no counters
// at all. That is why the hiscores fallback is not optional — for most members it is the only
// source there will ever be.
//
// Pages with neither are silent. Slayer, the clue tiers, minigames and the skilling pages have no
// killcount to show and showing "0" would be a lie rather than an absence.

/**
 * Pages whose counters do not follow from their own name.
 *
 * Two shapes: a page covering several bosses (Dagannoth Kings), and a page whose harder modes are
 * separate hiscores rows (Chambers of Xeric). Both come out as several lines, which is what the
 * game does.
 */
const PAGE_BOSS_KEYS: Record<string, string[]> = {
  // Raids — the tier is a separate hiscores row but the same log page.
  'Chambers of Xeric': ['chambersOfXeric', 'chambersOfXericChallengeMode'],
  'Theatre of Blood': ['theatreOfBlood', 'theatreOfBloodHardMode'],
  'Tombs of Amascut': ['tombsOfAmascut', 'tombsOfAmascutExpertMode'],
  // Same drop table, two difficulties, two counts.
  'The Nightmare': ['nightmare', 'phosanisNightmare'],
  'The Gauntlet': ['gauntlet', 'corruptedGauntlet'],
  // One page, several bosses.
  'Dagannoth Kings': ['dagannothRex', 'dagannothPrime', 'dagannothSupreme'],
  'Callisto and Artio': ['callisto', 'artio'],
  'Venenatis and Spindel': ['venenatis', 'spindel'],
  "Vet'ion and Calvar'ion": ['vetion', 'calvarion'],
  // Pages named for the place rather than the thing killed.
  'Barrows Chests': ['barrows'],
  'The Fight Caves': ['tzTokJad'],
  'The Inferno': ['tzKalZuk'],
  'Fortis Colosseum': ['solHeredit'],
  'Moons of Peril': ['lunarChests'],
  'Thermonuclear Smoke Devil': ['thermonuclearSmokeDevil'],
};

const BY_KEY = new Map(BOSSES.map((b) => [b.key, b.label]));
const BY_LABEL = new Map(BOSSES.map((b) => [b.label.toLowerCase(), b.key]));
/** "The Whisperer" is one page and one boss; the article is the only difference. */
const stripArticle = (s: string) => s.toLowerCase().replace(/^the\s+/, '');
const BY_BARE_LABEL = new Map(BOSSES.map((b) => [stripArticle(b.label), b.key]));

/** Every hiscores boss a log page counts, in the order the page should print them. */
export function bossKeysForPage(page: string): string[] {
  const explicit = PAGE_BOSS_KEYS[page];
  if (explicit) return explicit;
  const direct = BY_LABEL.get(page.toLowerCase()) ?? BY_BARE_LABEL.get(stripArticle(page));
  return direct ? [direct] : [];
}

export interface PageKillcount {
  /** As the line should read — the boss's own name, so two tiers are told apart. */
  label: string;
  count: number;
  /** True when it came from the plugin reading the game's own line rather than the hiscores. */
  exact: boolean;
}

/**
 * The counter lines for one page.
 *
 * `fromPlugin` wins wherever it exists, because it is the game's own number and its labels are the
 * game's own words. Anything it does not cover falls back to the hiscores, and a boss with no count
 * on either is omitted rather than shown as zero — "never killed it" and "we cannot see it" look
 * identical at 0, and only one of them is honest.
 */
export function killcountsForPage(
  page: string,
  fromPlugin: { label: string; count: number }[] = [],
  bossKills: Record<string, number> = {},
): PageKillcount[] {
  if (fromPlugin.length > 0) {
    return fromPlugin.map((r) => ({ label: r.label, count: r.count, exact: true }));
  }
  const out: PageKillcount[] = [];
  for (const key of bossKeysForPage(page)) {
    const count = bossKills[key];
    if (typeof count !== 'number' || count <= 0) continue;
    out.push({ label: BY_KEY.get(key) ?? key, count, exact: false });
  }
  return out;
}
