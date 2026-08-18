import { db } from '@/db';
import { clanRoster, memberClog, memberClogItems, playerSnapshots } from '@/db/schema';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import npcDrops from '@/data/npcDrops.json'; // regenerate with `npm run data:drops`
import { BOSSES } from '@/lib/constants';
import { clogItemNames, clogPageItems, clogPageNames } from '@/lib/clogDataset';
import { buildLuckBoards, type LuckEntry, type LuckSource } from '@/lib/clogProfile';
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
  q?: number;
  r?: number; // rolls per kill
}

/** Rarer than this isn't worth a board entry — a 1-in-30 seed isn't a dry streak, it's a Tuesday. */
const MIN_DENOMINATOR = 100;

/** A drop table can list hundreds of items; only the rare tail makes a story. */
const MAX_ITEMS_PER_SOURCE = 12;

export interface LuckCandidate {
  itemId: number;
  itemName: string;
  source: string;
  bossKey: string;
  rate: { denominator: number; rolls: number };
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
  const out: LuckCandidate[] = [];

  for (const page of clogPageNames()) {
    const table = drops[page];
    const bossKey = bossByLabel.get(page.toLowerCase());
    // No drop table under that name, or no hiscores counter for it — nothing to be dry against.
    if (!table || !bossKey) continue;

    const onPage = new Set(clogPageItems(page).map((i) => i.id));
    const rare = table
      .filter((d) => onPage.has(d.i) && Number.isFinite(d.d) && d.d >= MIN_DENOMINATOR)
      .sort((a, b) => b.d - a.d)
      .slice(0, MAX_ITEMS_PER_SOURCE);

    for (const drop of rare) {
      out.push({
        itemId: drop.i,
        itemName: names.get(drop.i) ?? `Item ${drop.i}`,
        source: page,
        bossKey,
        rate: { denominator: drop.d, rolls: drop.r && drop.r > 0 ? drop.r : 1 },
      });
    }
  }

  candidateCache = out;
  return out;
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
    .select({ liveStats: clanRoster.liveStats })
    .from(clanRoster)
    .where(eq(clanRoster.id, clanMemberId));
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
    .select({ id: memberClog.clanMemberId, rsn: clanRoster.rsn, liveStats: clanRoster.liveStats })
    .from(memberClog)
    .innerJoin(clanRoster, eq(memberClog.clanMemberId, clanRoster.id))
    .where(isNull(clanRoster.leftAt));
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
    source: c.source,
    rate: c.rate,
    members: synced.map((m): LuckSource => ({
      clanMemberId: m.id,
      rsn: m.rsn,
      kills: kills.get(m.id)?.[c.bossKey] ?? 0,
      obtained: owned.get(`${m.id}:${c.itemId}`) ?? 0,
    })),
  }));

  const boards = buildLuckBoards(shaped, limit);
  return {
    ...boards,
    membersConsidered: synced.length,
    itemsConsidered: candidates.length,
  };
}
