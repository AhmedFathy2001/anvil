import { and, desc, eq, isNotNull } from 'drizzle-orm';

import { db } from '@/db';
import { memberClog, memberClogItems } from '@/db/schema';
import type { ApexCharacter } from '@/lib/apexProfiles';
import { clogItemNames } from '@/lib/clogDataset';
import { buildClogProfile } from '@/lib/clogProfile';
import { getAccountProfile, getMilestones } from '@/lib/memberProfile';
import { shapePlayerCard, type PlayerCard } from '@/lib/playerCardShape';

/** Load everything the plugin's player card shows for one (already visibility-checked) character. */
export async function loadPlayerCard(c: ApexCharacter): Promise<PlayerCard> {
  const [profile, header, items, recent, milestones] = await Promise.all([
    getAccountProfile(c.accountId),
    db.query.memberClog.findFirst({ where: eq(memberClog.accountId, c.accountId) }),
    db
      .select({
        itemId: memberClogItems.itemId,
        pageName: memberClogItems.pageName,
        quantity: memberClogItems.quantity,
        firstSeenAt: memberClogItems.firstSeenAt,
        kcAtUnlock: memberClogItems.kcAtUnlock,
      })
      .from(memberClogItems)
      .where(eq(memberClogItems.accountId, c.accountId)),
    // Only dated unlocks: items already in the log at first sync have no date, and a card that called
    // them "latest" would be lying about when they happened.
    db
      .select({ itemId: memberClogItems.itemId, at: memberClogItems.firstSeenAt })
      .from(memberClogItems)
      .where(and(eq(memberClogItems.accountId, c.accountId), isNotNull(memberClogItems.firstSeenAt)))
      .orderBy(desc(memberClogItems.firstSeenAt))
      .limit(3),
    getMilestones(c.accountId, 3),
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
  const names = clogItemNames();

  return shapePlayerCard({
    rsn: c.rsn,
    accountType: profile?.accountType ?? null,
    clan: c.clan,
    totalLevel: profile?.totalLevel ?? 0,
    combatLevel: profile?.combatLevel ?? null,
    overallXp: c.overallXp,
    ehp: profile?.efficiency?.ehp ?? null,
    ehb: profile?.efficiency?.ehb ?? null,
    statsAt: profile?.statsAt ?? null,
    bosses: (profile?.bosses ?? []).map((b) => ({ key: b.key, kc: b.kc })),
    clogHeader: header ? { obtained: header.obtained, total: header.total } : null,
    clogPages: view.pages.map((p) => ({ name: p.name, obtained: p.obtained, total: p.total })),
    recentItems: recent.flatMap((r) =>
      r.at ? [{ itemId: r.itemId, name: names.get(r.itemId) ?? `Item ${r.itemId}`, at: r.at }] : [],
    ),
    milestones,
  });
}
