import { db } from '@/db';
import { clanMembers, memberClog, memberClogItems, playerSnapshots } from '@/db/schema';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import npcDrops from '@/data/npcDrops.json'; // regenerate with `npm run data:drops`
import { BOSSES } from '@/lib/constants';
import { clogItemNames, clogPageItems, clogPageNames } from '@/lib/clogDataset';
import { aggregateLuck, assessLuckAt, bundleSize, dropsFromQuantity, type LuckTotal } from '@/lib/clogLuck';
import { buildLuckBoards, expectationFor, type LuckEntry, type LuckRateSource, type LuckSource } from '@/lib/clogProfile';
import { parsePluginStats } from '@/lib/pluginStats';

// The clan's luck boards: who is dry, and who was spooned.
//
// Three datasets have to agree for an item to qualify, and only a minority do — which is fine, and
// better than the alternative of guessing:
//
//   the CATALOGUE says a log page exists and which items are on it,
//   the DROP DATASET (wiki, npm run data:drops) has the same name as a source and a rate for the item,
//   the HISCORES have a boss key matching that source, so we know how many kills someone has.
//
// Clue pages, minigames and anything without a per-kill rate are therefore absent by design: "dry on
// a clue item" needs a caskets-opened count the hiscores don't break down that way.

interface DropEntry {
  i: number; // item id
  d: number; // 1-in-d per roll
  q?: number; // fixed quantity per drop
  m?: number; // ranged quantity, low
  n?: number; // ranged quantity, high
  r?: number; // rolls per kill
}

/** Rarer than this isn't worth a board entry — a 1-in-30 seed isn't a dry streak, it's a Tuesday. */
const MIN_DENOMINATOR = 100;

/** A drop table can list hundreds of items; only the rare tail makes a story. */
const MAX_ITEMS_PER_SOURCE = 12;

export interface LuckCandidate {
  itemId: number;
  itemName: string;
  /** The collection log page it's displayed under. */
  page: string;
  /** Every killable source that drops it and that the hiscores count. */
  sources: LuckRateSource[];
}

/**
 * The items we can actually reason about: on a collection log page, with a wiki drop rate, from a
 * source the hiscores count kills for. Computed once per process — all three inputs ship in the repo.
 */
let candidateCache: LuckCandidate[] | null = null;
export function luckCandidates(): LuckCandidate[] {
  if (candidateCache) return candidateCache;

  const drops = npcDrops as unknown as Record<string, DropEntry[]>;
  const bossByLabel = new Map(BOSSES.map((b) => [b.label.toLowerCase(), b.key]));
  const names = clogItemNames();

  // Index every drop table by ITEM first. An item is not owned by the page it displays under: a
  // dragon thrownaxe hangs on the Alchemical Hydra page but falls off six slayer bosses at two
  // different rates, and reading only the page's own boss charged a Drake farmer's whole stack
  // against zero Drake kills — which is what put people on the spooned board for being ordinary.
  const byItem = new Map<number, LuckRateSource[]>();
  for (const [source, table] of Object.entries(drops)) {
    const bossKey = bossByLabel.get(source.toLowerCase());
    if (!bossKey) continue; // nothing to count kills with
    for (const drop of table) {
      if (!Number.isFinite(drop.d) || drop.d <= 0) continue;
      const list = byItem.get(drop.i) ?? [];
      list.push({
        source,
        bossKey,
        denominator: drop.d,
        rolls: drop.r && drop.r > 0 ? drop.r : 1,
        bundle: bundleSize(drop),
      });
      byItem.set(drop.i, list);
    }
  }

  const out: LuckCandidate[] = [];
  for (const page of clogPageNames()) {
    const onPage = clogPageItems(page);
    const rare = onPage
      .map((entry) => ({ entry, sources: byItem.get(entry.id) ?? [] }))
      // Rare EVERYWHERE it comes from. Judging by the page's own rate would let an item that is
      // common elsewhere onto the board, where the expectation from that common source swamps the
      // count and every holder reads as dry.
      .filter((c) => c.sources.length > 0 && Math.min(...c.sources.map((r) => r.denominator)) >= MIN_DENOMINATOR)
      .sort(
        (a, b) =>
          Math.min(...b.sources.map((r) => r.denominator)) - Math.min(...a.sources.map((r) => r.denominator)),
      )
      .slice(0, MAX_ITEMS_PER_SOURCE);

    for (const { entry, sources } of rare) {
      out.push({
        itemId: entry.id,
        itemName: names.get(entry.id) ?? (entry.name || `Item ${entry.id}`),
        page,
        sources,
      });
    }
  }

  // One row per ITEM, not per page it appears on. A pet sits on its boss's page and on All Pets, and
  // a slayer unique on both the boss and the Slayer page — scoring each copy would count the same
  // drop twice, once on the board and again in anyone's personal total. The page that names one of
  // the item's own sources wins over a catch-all, so the entry reads "Alchemical Hydra", not "Slayer".
  const deduped = new Map<number, LuckCandidate>();
  for (const candidate of out) {
    const existing = deduped.get(candidate.itemId);
    if (!existing) {
      deduped.set(candidate.itemId, candidate);
      continue;
    }
    const names = new Set(candidate.sources.map((r) => r.source.toLowerCase()));
    if (names.has(candidate.page.toLowerCase()) && !names.has(existing.page.toLowerCase())) {
      deduped.set(candidate.itemId, candidate);
    }
  }

  candidateCache = [...deduped.values()];
  return candidateCache;
}

/** The hiscores boss key a log page counts kills for, or null when the page isn't a boss. */
export function bossKeyForPage(page: string): string | null {
  const match = BOSSES.find((b) => b.label.toLowerCase() === page.toLowerCase());
  return match ? match.key : null;
}

/**
 * A member's kill counts by hiscores key: the live push, floored by the last hiscores snapshot.
 *
 * Used at INGEST to stamp `kcAtUnlock` on a new item — the one moment that number is knowable. After
 * the fact it is gone forever: a pet spooned at 12 and a pet earned at 3,000 look identical once the
 * player has 3,000 kills.
 */
export async function bossKillsFor(clanMemberId: number): Promise<Record<string, number>> {
  const [member] = await db
    .select({ liveStats: clanMembers.liveStats })
    .from(clanMembers)
    .where(eq(clanMembers.id, clanMemberId));
  const kills = parsePluginStats(member?.liveStats);

  const snaps = await db
    .select({ payload: playerSnapshots.payload, capturedAt: playerSnapshots.capturedAt })
    .from(playerSnapshots)
    .where(and(eq(playerSnapshots.clanMemberId, clanMemberId), eq(playerSnapshots.kind, 'current')));
  const newest = snaps.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0];
  if (newest) {
    try {
      const parsed = JSON.parse(newest.payload) as { bosses?: Record<string, { score?: number }> };
      for (const [key, value] of Object.entries(parsed.bosses ?? {})) {
        const score = typeof value?.score === 'number' ? value.score : 0;
        if (score > (kills[key] ?? 0)) kills[key] = score;
      }
    } catch {
      /* no hiscores half for this member */
    }
  }
  return kills;
}

export interface LuckBoards {
  dry: LuckEntry[];
  spooned: LuckEntry[];
  /** How many members' logs the boards are drawn from — the honest denominator under the tables. */
  membersConsidered: number;
  /** Items the three datasets agreed on. Useful when a board looks thin. */
  itemsConsidered: number;
}

/**
 * Build both boards for the whole clan.
 *
 * Only members who have synced a log are considered: without one we cannot tell "hasn't got it" from
 * "hasn't told us", and putting the second on a dry board would be a lie about a real person.
 */
export async function getLuckBoards(limit = 15): Promise<LuckBoards> {
  const candidates = luckCandidates();
  if (candidates.length === 0) return { dry: [], spooned: [], membersConsidered: 0, itemsConsidered: 0 };

  // Everyone who has synced, and is still in the clan.
  const synced = await db
    .select({ id: memberClog.clanMemberId, rsn: clanMembers.rsn, liveStats: clanMembers.liveStats })
    .from(memberClog)
    .innerJoin(clanMembers, eq(memberClog.clanMemberId, clanMembers.id))
    .where(isNull(clanMembers.leftAt));
  if (synced.length === 0) return { dry: [], spooned: [], membersConsidered: 0, itemsConsidered: candidates.length };

  const memberIds = synced.map((m) => m.id);
  const itemIds = [...new Set(candidates.map((c) => c.itemId))];

  // Only the candidate items, not every row of every log — a clan of a hundred fully-synced logs is
  // ~170k rows, and this needs a few hundred of them.
  const ownedRows = await db
    .select({
      clanMemberId: memberClogItems.clanMemberId,
      itemId: memberClogItems.itemId,
      quantity: memberClogItems.quantity,
    })
    .from(memberClogItems)
    .where(and(inArray(memberClogItems.clanMemberId, memberIds), inArray(memberClogItems.itemId, itemIds)));

  // How MANY, not whether: the count is the metric, and a missing row simply means none.
  const owned = new Map<string, number>();
  for (const row of ownedRows) owned.set(`${row.clanMemberId}:${row.itemId}`, row.quantity);

  // Kill counts: the live push first (it's the fresher of the two), falling back to the most recent
  // hiscores snapshot we hold for them.
  const kills = new Map<number, Record<string, number>>();
  for (const m of synced) kills.set(m.id, parsePluginStats(m.liveStats));

  const snapshots = await db
    .select({ clanMemberId: playerSnapshots.clanMemberId, payload: playerSnapshots.payload, capturedAt: playerSnapshots.capturedAt })
    .from(playerSnapshots)
    .where(and(inArray(playerSnapshots.clanMemberId, memberIds), eq(playerSnapshots.kind, 'current')));
  const newest = new Map<number, { payload: string; capturedAt: string }>();
  for (const s of snapshots) {
    const prev = newest.get(s.clanMemberId);
    if (!prev || s.capturedAt > prev.capturedAt) newest.set(s.clanMemberId, s);
  }
  for (const [memberId, snap] of newest) {
    const live = kills.get(memberId) ?? {};
    try {
      const parsed = JSON.parse(snap.payload) as { bosses?: Record<string, { score?: number }> };
      for (const [key, value] of Object.entries(parsed.bosses ?? {})) {
        const score = typeof value?.score === 'number' ? value.score : 0;
        // The live push and the hiscores can disagree while a sweep is pending; the higher of the
        // two is the one that can't be behind.
        if (score > (live[key] ?? 0)) live[key] = score;
      }
    } catch {
      /* a malformed snapshot just means no hiscores half for this member */
    }
    kills.set(memberId, live);
  }

  const shaped = candidates.map((c) => ({
    itemId: c.itemId,
    itemName: c.itemName,
    source: c.page,
    sources: c.sources,
    members: synced.map((m): LuckSource => {
      const memberKills = kills.get(m.id) ?? {};
      const { expected, bundle, kills: totalKills } = expectationFor(c.sources, memberKills);
      return {
        clanMemberId: m.id,
        rsn: m.rsn,
        kills: totalKills,
        expected,
        // The stack collapses to the number of times the table actually hit. Without this a single
        // 750-axe drop reads as 750 drops against an expectation of two.
        obtained: dropsFromQuantity(owned.get(`${m.id}:${c.itemId}`) ?? 0, bundle),
      };
    }),
  }));

  const boards = buildLuckBoards(shaped, limit);
  return {
    ...boards,
    membersConsidered: synced.length,
    itemsConsidered: candidates.length,
  };
}

// ── One member's luck ────────────────────────────────────────────────────────────────────────────

export interface MemberLuckItem {
  itemId: number;
  itemName: string;
  page: string;
  sources: LuckRateSource[];
  kills: number;
  expected: number;
  obtained: number;
  assessment: ReturnType<typeof assessLuckAt>;
}

export interface MemberLuck {
  total: LuckTotal;
  /** Their driest tracked drops, worst first. */
  dry: MemberLuckItem[];
  /** Their luckiest, best first. */
  spooned: MemberLuckItem[];
}

/**
 * One member's luck across everything the rates can speak to.
 *
 * Returns null when they've never synced a log: we cannot tell "hasn't got it" from "hasn't told us",
 * and a personal luck score built on the second would be a number about our own ignorance.
 *
 * Only items they have kills for count. Never having fought something is not bad luck, and letting
 * untouched content into the total would drag everyone toward the same meaningless middle.
 */
export async function getMemberLuck(clanMemberId: number, listLimit = 5): Promise<MemberLuck | null> {
  const [synced] = await db
    .select({ id: memberClog.clanMemberId })
    .from(memberClog)
    .where(eq(memberClog.clanMemberId, clanMemberId));
  if (!synced) return null;

  const candidates = luckCandidates();
  const kills = await bossKillsFor(clanMemberId);

  const itemIds = [...new Set(candidates.map((c) => c.itemId))];
  const ownedRows = await db
    .select({ itemId: memberClogItems.itemId, quantity: memberClogItems.quantity })
    .from(memberClogItems)
    .where(and(eq(memberClogItems.clanMemberId, clanMemberId), inArray(memberClogItems.itemId, itemIds)));
  const owned = new Map(ownedRows.map((r) => [r.itemId, r.quantity]));

  const items: MemberLuckItem[] = [];
  for (const candidate of candidates) {
    const { expected, bundle, kills: kc } = expectationFor(candidate.sources, kills);
    if (expected <= 0) continue;
    const obtained = dropsFromQuantity(owned.get(candidate.itemId) ?? 0, bundle);
    items.push({
      itemId: candidate.itemId,
      itemName: candidate.itemName,
      page: candidate.page,
      sources: candidate.sources,
      kills: kc,
      expected,
      obtained,
      assessment: assessLuckAt(expected, kc, obtained),
    });
  }

  const total = aggregateLuck(items);
  const byTail = (a: MemberLuckItem, b: MemberLuckItem) => a.assessment.tail - b.assessment.tail;
  return {
    total,
    dry: items.filter((i) => i.assessment.verdict === 'dry').sort(byTail).slice(0, listLimit),
    spooned: items.filter((i) => i.assessment.verdict === 'spooned').sort(byTail).slice(0, listLimit),
  };
}
