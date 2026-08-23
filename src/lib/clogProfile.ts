import { clogItemNames, clogPageItems, clogPageNames, clogTotalSlots } from '@/lib/clogDataset';
import { assessLuck, chancePerKill, type LuckAssessment } from '@/lib/clogLuck';

// Reading a synced collection log back out: the member's own page, and the clan's luck boards.
//
// Two rules shape everything here.
//
// The CATALOGUE decides what a page contains, not the stored rows. Rows say what someone owns; the
// dataset says what there is. So a page's "12/38" comes from intersecting their item ids with the
// page's, which also lets a shared item (a pet, under its boss and under All Pets) show up in both
// places while being stored exactly once — the storage shape the unique index requires.
//
// SYNCED and OWNED are different states, and conflating them is the one thing that would make this
// untrustworthy. A member who has never synced owns an unknown amount; a member who synced their
// whole log and has nothing on a page owns nothing there. Every shape below keeps that distinction.

export interface StoredClogItem {
  itemId: number;
  pageName: string;
  quantity: number;
  firstSeenAt: string | null;
  kcAtUnlock: number | null;
}

export interface ClogPageView {
  name: string;
  obtained: number;
  total: number;
  /** Item ids they own on this page, for rendering the grid lit/dim. */
  ownedIds: Set<number>;
  complete: boolean;
}

export interface ClogItemView {
  itemId: number;
  name: string;
  owned: boolean;
  quantity: number;
}

export interface RecentUnlock {
  itemId: number;
  name: string;
  pageName: string;
  at: string;
  kcAtUnlock: number | null;
}

export interface ClogProfileView {
  /** Null when this member has never synced — the empty state, not a zeroed one. */
  synced: {
    obtained: number;
    total: number;
    pagesSynced: number;
    pagesTotal: number;
    at: string | null;
    pluginVersion: string | null;
  } | null;
  pages: ClogPageView[];
  /** Newest first. Only unlocks we watched land — a first sync dates nothing. */
  recent: RecentUnlock[];
}

/** Assemble one member's collection log for display. */
export function buildClogProfile(args: {
  header: { obtained: number; total: number; pagesSynced: number; pagesTotal: number; syncedAt: string | null; pluginVersion: string | null } | null;
  items: StoredClogItem[];
  recentLimit?: number;
}): ClogProfileView {
  const { header, items } = args;
  const owned = new Map<number, StoredClogItem>();
  for (const item of items) owned.set(item.itemId, item);

  const pages: ClogPageView[] = clogPageNames().map((name) => {
    const catalogue = clogPageItems(name);
    const ownedIds = new Set<number>();
    for (const entry of catalogue) if (owned.has(entry.id)) ownedIds.add(entry.id);
    return {
      name,
      obtained: ownedIds.size,
      total: catalogue.length,
      ownedIds,
      complete: catalogue.length > 0 && ownedIds.size === catalogue.length,
    };
  });

  const names = clogItemNames();
  const recent: RecentUnlock[] = items
    .filter((i): i is StoredClogItem & { firstSeenAt: string } => !!i.firstSeenAt)
    .sort((a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt))
    .slice(0, args.recentLimit ?? 12)
    .map((i) => ({
      itemId: i.itemId,
      // Fall back to the PAGE, not a raw id. A miss here means the shipped catalogue is older than
      // the game, which is most likely for a brand-new unique — the very unlock worth showing. "a
      // Chambers of Xeric item" reads as something; "Item 28901" reads as a bug.
      name: names.get(i.itemId) ?? `a ${i.pageName} item`,
      pageName: i.pageName,
      at: i.firstSeenAt,
      kcAtUnlock: i.kcAtUnlock,
    }));

  return {
    synced: header
      ? {
          // The catalogue is the honest denominator: what the client reported is what it could see.
          obtained: owned.size,
          total: clogTotalSlots(),
          pagesSynced: header.pagesSynced,
          pagesTotal: header.pagesTotal || clogPageNames().length,
          at: header.syncedAt,
          pluginVersion: header.pluginVersion,
        }
      : null,
    pages,
    recent,
  };
}

/** The item grid for one page: everything the page holds, flagged by what they own. */
export function buildPageItems(page: string, items: StoredClogItem[]): ClogItemView[] {
  const owned = new Map(items.map((i) => [i.itemId, i]));
  const names = clogItemNames();
  return clogPageItems(page).map((entry) => {
    const mine = owned.get(entry.id);
    return {
      itemId: entry.id,
      name: entry.name || names.get(entry.id) || `Item ${entry.id}`,
      owned: !!mine,
      quantity: mine?.quantity ?? 0,
    };
  });
}

// ── Personal bests ───────────────────────────────────────────────────────────────────────────────

export interface BestTime {
  /** How this run is qualified — "Solo", "3 players", "Challenge mode 5 players". */
  label: string;
  /** Formatted time, e.g. 33:38.00. */
  time: string;
  /** The raw activity name, for searching. */
  activity: string;
  /** Players in the run, so scales sort in a sensible order instead of by clock time. */
  partySize: number;
}

/**
 * Normalised form for matching a stored best to a log page. The game names an activity without the
 * punctuation the collection log uses, so both sides lose everything that isn't a letter, a digit or
 * a single space.
 */
function normalizeActivity(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** "The Gauntlet" and "gauntlet" are the same content; the article only exists on one of them. */
function coreName(value: string): string {
  return normalizeActivity(value).replace(/^the /, '');
}

/** Words that only take a capital when they open the name (or the bit after a colon). */
const MINOR_WORDS = new Set(['a', 'an', 'and', 'at', 'for', 'in', 'of', 'on', 'the', 'to']);

/**
 * "chambers of xeric: challenge mode" → "Chambers of Xeric: Challenge Mode". RuneLite hands these
 * over lowercased, and the game's own capitalisation is what people expect to read back.
 *
 * The rule this replaces was `/\b[a-z]/` → uppercase, which is wrong in two ways an OSRS name hits
 * immediately: a word boundary sits after an apostrophe, so "phosani's nightmare" came out as
 * "Phosani'S Nightmare"; and it capitalised every connecting word, so "Chambers Of Xeric". Here a
 * capital goes on the first letter of a word and after a hyphen — never after an apostrophe — and
 * minor words keep their lowercase unless they start a clause.
 */
export function titleCaseActivity(activity: string): string {
  let startsClause = true;
  return activity
    .split(' ')
    .map((word) => {
      const bare = word.replace(/[^a-z]/gi, '').toLowerCase();
      const cased = startsClause || !MINOR_WORDS.has(bare)
        ? word.replace(/(^|-)([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase())
        : word;
      // A colon starts a new clause: the mode after it is named, not a continuation.
      startsClause = word.endsWith(':');
      return cased;
    })
    .join(' ');
}

/**
 * Party size out of a label, so scales sort in the order a player thinks in.
 *
 * "Solo" is 1. A bucket takes its lower bound ("11-15 players" → 11), which keeps it in the right
 * place among the exact sizes. The bare, unqualified best across every scale sorts FIRST, because
 * it's the headline number rather than one of the scales.
 */
function partySizeOf(label: string, fallback: number): number {
  if (label === ANY_SCALE) return 0;
  if (/^solo/i.test(label)) return 1;
  const match = /(\d+)/.exec(label);
  return match ? parseInt(match[1], 10) : fallback;
}

/**
 * What RuneLite's unqualified "<boss>" key means: the best across ALL scales, which it writes
 * alongside the per-scale ones. Calling it "Solo" — as this did — hid the real solo time behind a
 * number that usually came from a team.
 */
const ANY_SCALE = 'Best overall';

/**
 * Attach best times to the log pages they belong to.
 *
 * A raid has ONE collection log page and many personal bests — party sizes and modes both — so
 * everything from "chambers of xeric" to "chambers of xeric challenge mode 3 players" belongs to
 * Chambers of Xeric, and what's left over becomes the label. Content whose name carries a qualifier
 * at the FRONT ("corrupted gauntlet" under The Gauntlet) matches the same way, or it would be
 * dropped for not starting with its own page's name.
 *
 * Ordered by scale rather than by time: a solo and a five-man aren't comparable, and sorting them
 * together would put a trio above a solo for no reason anyone reading it would accept.
 */
export function matchBestsToPages(
  bests: { activity: string; teamSize: number; time: string }[],
  pageNames: string[],
): Map<string, BestTime[]> {
  const pages = pageNames
    .map((name) => ({ name, core: coreName(name) }))
    .filter((p) => p.core.length > 0)
    // Longest first so a page that contains another's words can't steal its times.
    .sort((a, b) => b.core.length - a.core.length);

  const out = new Map<string, BestTime[]>();
  for (const best of bests) {
    const activity = normalizeActivity(best.activity);
    const page = pages.find(
      (p) =>
        activity === p.core ||
        activity.startsWith(p.core + ' ') ||
        activity.endsWith(' ' + p.core) ||
        activity.includes(' ' + p.core + ' '),
    );
    if (!page) continue;

    // Whatever isn't the page's own name describes the run: a mode, a party size, or both. Nothing
    // left over means RuneLite's cross-scale best, not a solo.
    const label = activity.replace(page.core, ' ').replace(/\s+/g, ' ').trim() || ANY_SCALE;
    const list = out.get(page.name) ?? [];
    list.push({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      time: best.time,
      activity: best.activity,
      partySize: partySizeOf(label, best.teamSize || 1),
    });
    out.set(page.name, list);
  }

  for (const list of out.values()) {
    list.sort((a, b) => a.partySize - b.partySize || a.label.localeCompare(b.label));
  }
  return out;
}

// ── Clan luck ────────────────────────────────────────────────────────────────────────────────────

export interface DropRate {
  /** Wiki dataset denominator: 1 in `denominator` per roll. */
  denominator: number;
  /** Rolls per kill, where a source rolls its table more than once. */
  rolls: number;
}

export interface LuckSource {
  /** The ACCOUNT the log belongs to — luck follows the player, not the roster they sit on. */
  accountId: number;
  rsn: string;
  /** Absolute kill count for the page's source, from the hiscores. */
  kills: number;
  /**
   * How many they have. The collection log counts what you've obtained, not just whether you have
   * it, and that count is the whole metric: presence alone can't tell one seed in 30,000 Gauntlet
   * from a fair fifteen.
   */
  obtained: number;
}

export interface LuckEntry {
  /** The ACCOUNT — a drop's luck belongs to the player, not to a roster they sit on. */
  accountId: number;
  rsn: string;
  itemId: number;
  itemName: string;
  source: string;
  rate: DropRate;
  assessment: LuckAssessment;
}

/**
 * Both tails of the clan's luck, from what everyone owns and how much they've killed.
 *
 * One pass, one model: an entry is dry or spooned by how far its COUNT sits from expectation, so a
 * player holding one of a drop they're owed fifteen of lands on the dry board where they belong,
 * and someone sitting near the rate lands on neither.
 *
 * Sorted by how unlikely the result is rather than by the raw multiple: at low expectation a wild
 * ratio is ordinary — two drops where one was owed is nothing — and a board that leads with those
 * is a board of noise.
 */
export function buildLuckBoards(
  candidates: { itemId: number; itemName: string; source: string; rate: DropRate; members: LuckSource[] }[],
  limit = 15,
): { dry: LuckEntry[]; spooned: LuckEntry[] } {
  const dry: LuckEntry[] = [];
  const spooned: LuckEntry[] = [];

  for (const candidate of candidates) {
    const chance = chancePerKill(candidate.rate.denominator, candidate.rate.rolls);
    if (chance <= 0) continue;
    for (const member of candidate.members) {
      if (member.kills <= 0) continue;
      const assessment = assessLuck(chance, member.kills, member.obtained);
      if (!assessment.notable) continue;
      const entry: LuckEntry = {
        accountId: member.accountId,
        rsn: member.rsn,
        itemId: candidate.itemId,
        itemName: candidate.itemName,
        source: candidate.source,
        rate: candidate.rate,
        assessment,
      };
      (assessment.verdict === 'dry' ? dry : spooned).push(entry);
    }
  }

  const byTail = (a: LuckEntry, b: LuckEntry) => a.assessment.tail - b.assessment.tail;
  return { dry: dry.sort(byTail).slice(0, limit), spooned: spooned.sort(byTail).slice(0, limit) };
}

