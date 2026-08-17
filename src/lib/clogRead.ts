import { db } from '@/db';
import { memberClog, memberClogItems, memberPersonalBests } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { clogPageItems, clogPageNames } from '@/lib/clogDataset';
import { buildClogProfile, matchBestsToPages, type BestTime } from '@/lib/clogProfile';
import { buildShowcase, buildValueShowcase, clogItemRarity, groupOf, type PageGroup } from '@/lib/clogRarity';
import { getItemPrices } from '@/lib/itemPrices';
import { BOSSES } from '@/lib/constants';
import type { CollectionLogProps } from '@/app/members/[rsn]/CollectionLog';

// Reading a member's synced log for their profile page. One place, because the catalogue slice the
// client needs is easy to get subtly wrong: the grid renders EVERY slot (dim when unowned), so the
// page ships the catalogue, and the rows only say which of them are lit.

/** Centiseconds → the way the game writes a time: 1:23.40, or 12:04:31.20 for a long one. */
export function formatPersonalBest(centis: number): string {
  const totalSeconds = Math.floor(centis / 100);
  const hundredths = centis % 100;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  return `${hours > 0 ? `${hours}:` : ''}${mm}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

/** "chambers of xeric" → "Chambers of Xeric". The game hands these over lowercased. */
function titleCase(activity: string): string {
  return activity.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

export async function getCollectionLog(clanMemberId: number, rsn: string): Promise<CollectionLogProps> {
  const [header, items, bests] = await Promise.all([
    db.query.memberClog.findFirst({ where: eq(memberClog.clanMemberId, clanMemberId) }),
    db
      .select({
        itemId: memberClogItems.itemId,
        pageName: memberClogItems.pageName,
        quantity: memberClogItems.quantity,
        firstSeenAt: memberClogItems.firstSeenAt,
        kcAtUnlock: memberClogItems.kcAtUnlock,
      })
      .from(memberClogItems)
      .where(eq(memberClogItems.clanMemberId, clanMemberId)),
    db
      .select({
        activity: memberPersonalBests.activity,
        teamSize: memberPersonalBests.teamSize,
        centis: memberPersonalBests.centis,
        // When they set it, so "what have they done lately" can include times, not just milestones.
        achievedAt: memberPersonalBests.achievedAt,
        updatedAt: memberPersonalBests.updatedAt,
      })
      .from(memberPersonalBests)
      .where(eq(memberPersonalBests.clanMemberId, clanMemberId)),
  ]);

  const view = buildClogProfile({
    header: header
      ? {
          obtained: header.obtained,
          total: header.total,
          pagesSynced: header.pagesSynced,
          pagesTotal: header.pagesTotal,
          syncedAt: header.syncedAt,
          pluginVersion: header.pluginVersion,
        }
      : null,
    items,
  });

  // Sets don't survive the server→client boundary; the grid wants ids anyway.
  const pages = view.pages.map((p) => ({
    name: p.name,
    obtained: p.obtained,
    total: p.total,
    ownedIds: [...p.ownedIds],
    complete: p.complete,
  }));

  // Only ship the catalogue for pages that exist — the whole thing is ~146KB of JSON, and the client
  // needs names and ids, not the rest of it.
  const catalogue: Record<string, { id: number; name: string }[]> = {};
  for (const name of clogPageNames()) {
    catalogue[name] = clogPageItems(name).map((i) => ({ id: i.id, name: i.name }));
  }

  const quantities: Record<number, number> = {};
  for (const item of items) if (item.quantity > 1) quantities[item.itemId] = item.quantity;

  // Two shelves, because a log is bragged about two ways. Rarity is what the odds say; value is what
  // the Grand Exchange says, and they rank almost nothing the same.
  const showcase = buildShowcase(items);
  const prices = await getItemPrices().catch(() => new Map<number, number>());
  const value = buildValueShowcase(items, prices);

  // Rates for the grid's rarity emphasis. Only the ~150 log items that HAVE a meaningful rate
  // travel, so this costs a couple of KB rather than shipping the drop dataset to a browser.
  const rarityById: Record<number, number> = {};
  for (const [itemId, rate] of clogItemRarity()) rarityById[itemId] = rate.denominator;

  // 125 flat pages is a scroll, not navigation.
  const bossLabels = new Set(BOSSES.map((b) => b.label.toLowerCase()));
  const groups: Record<string, PageGroup> = {};
  for (const page of pages) groups[page.name] = groupOf(page.name, bossLabels);

  // The nearest finish line, which is the one thing that reliably sends someone back to the game.
  const closest = pages
    .filter((p) => p.total > 0 && p.obtained > 0 && p.obtained < p.total)
    .map((p) => ({ page: p.name, remaining: p.total - p.obtained }))
    .sort((a, b) => a.remaining - b.remaining)[0] ?? null;

  const formatted = bests.map((b) => ({
    activity: b.activity,
    teamSize: b.teamSize,
    time: formatPersonalBest(b.centis),
    // achievedAt is the game's own word for it; updatedAt is when we heard. The first is truer and
    // the second always exists, so recency uses whichever we have.
    at: b.achievedAt ?? b.updatedAt ?? null,
  }));
  // Times belong next to the content they're for: a raid's page shows every scale of it, so someone
  // reading Chambers of Xeric sees their solo and their trio without going anywhere else.
  const byPage = matchBestsToPages(formatted, clogPageNames());

  return {
    rsn,
    synced: view.synced,
    pages,
    catalogue,
    quantities,
    showcase,
    valuable: value.items,
    totalValue: value.total,
    rarityById,
    groups,
    closest,
    recent: view.recent,
    bestsByPage: Object.fromEntries(byPage) as Record<string, BestTime[]>,
    bests: formatted
      .sort((a, b) => a.activity.localeCompare(b.activity))
      .map((b) => ({
        activity: titleCase(b.activity) + (b.teamSize > 0 ? ` (${b.teamSize})` : ''),
        time: b.time,
        at: b.at,
      })),
  };
}
