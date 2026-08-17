import { clogItemNames, clogPageItems, clogPageNames, clogTotalSlots } from '@/lib/clogDataset';
import { assessDry, assessSpoon, chancePerKill, type DryVerdict, type SpoonVerdict } from '@/lib/clogLuck';

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
      name: names.get(i.itemId) ?? `Item ${i.itemId}`,
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

/** Party size out of a label, so "5 players" sorts after "3 players" and both after a solo. */
function partySizeOf(label: string, fallback: number): number {
  const match = /(\d+)\s*players?/.exec(label);
  return match ? parseInt(match[1], 10) : fallback;
}

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

    // Whatever isn't the page's own name describes the run: a mode, a party size, or both.
    const label = activity.replace(page.core, ' ').replace(/\s+/g, ' ').trim() || 'Solo';
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
  clanMemberId: number;
  rsn: string;
  /** Absolute kill count for the page's source, from the hiscores. */
  kills: number;
  /** Do they own it? */
  owned: boolean;
  /** KC when it dropped, if we watched it land. */
  kcAtUnlock: number | null;
}

export interface DryEntry {
  clanMemberId: number;
  rsn: string;
  itemId: number;
  itemName: string;
  source: string;
  rate: DropRate;
  verdict: DryVerdict;
}

export interface SpoonEntry {
  clanMemberId: number;
  rsn: string;
  itemId: number;
  itemName: string;
  source: string;
  rate: DropRate;
  verdict: SpoonVerdict;
}

/**
 * The dry board: members who have put in the kills and still have nothing.
 *
 * Sorted by how remarkable it is (fewest people would still be waiting), not by raw KC — 800 kills
 * on a 1-in-100 is a worse beat than 800 on a 1-in-5,000, and a board sorted on KC only ever shows
 * the rarest items and the same three people.
 */
export function buildDryBoard(
  candidates: { itemId: number; itemName: string; source: string; rate: DropRate; members: LuckSource[] }[],
  limit = 20,
): DryEntry[] {
  const out: DryEntry[] = [];
  for (const candidate of candidates) {
    const chance = chancePerKill(candidate.rate.denominator, candidate.rate.rolls);
    if (chance <= 0) continue;
    for (const member of candidate.members) {
      if (member.owned || member.kills <= 0) continue;
      const verdict = assessDry(chance, member.kills);
      if (!verdict.notable) continue;
      out.push({
        clanMemberId: member.clanMemberId,
        rsn: member.rsn,
        itemId: candidate.itemId,
        itemName: candidate.itemName,
        source: candidate.source,
        rate: candidate.rate,
        verdict,
      });
    }
  }
  return out.sort((a, b) => a.verdict.luckPercentile - b.verdict.luckPercentile).slice(0, limit);
}

/**
 * The spoon board: unlocks that landed far inside the rate.
 *
 * Only from `kcAtUnlock`, so it covers what we watched happen rather than everything anyone ever
 * got. That's a real limitation and the UI says so — the alternative is inferring luck from current
 * KC, which would call every long-serving player spooned the moment they stopped killing something.
 */
export function buildSpoonBoard(
  candidates: { itemId: number; itemName: string; source: string; rate: DropRate; members: LuckSource[] }[],
  limit = 20,
): SpoonEntry[] {
  const out: SpoonEntry[] = [];
  for (const candidate of candidates) {
    const chance = chancePerKill(candidate.rate.denominator, candidate.rate.rolls);
    if (chance <= 0) continue;
    for (const member of candidate.members) {
      if (!member.owned || member.kcAtUnlock == null || member.kcAtUnlock <= 0) continue;
      const verdict = assessSpoon(chance, member.kcAtUnlock);
      if (!verdict.notable) continue;
      out.push({
        clanMemberId: member.clanMemberId,
        rsn: member.rsn,
        itemId: candidate.itemId,
        itemName: candidate.itemName,
        source: candidate.source,
        rate: candidate.rate,
        verdict,
      });
    }
  }
  return out.sort((a, b) => a.verdict.luckPercentile - b.verdict.luckPercentile).slice(0, limit);
}
