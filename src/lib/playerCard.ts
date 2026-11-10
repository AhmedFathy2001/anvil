import { and, desc, eq, isNotNull } from 'drizzle-orm';

import { streakForAccount } from '@/lib/activityStreaks';
import type { PlayerCardStreak } from '@/lib/playerCardShape';
import { db } from '@/db';
import { memberClog, memberClogItems, memberPersonalBests } from '@/db/schema';
import type { ApexCharacter } from '@/lib/apexProfiles';
import { clogItemLabels } from '@/lib/clogDataset';
import { buildClogProfile, titleCaseActivity } from '@/lib/clogProfile';
import { formatPersonalBest } from '@/lib/clogRead';
import { getAccountProfile, getMilestones } from '@/lib/memberProfile';
import { shapePlayerCard, type PlayerCard } from '@/lib/playerCardShape';

/** Load everything the plugin's player card shows for one (already visibility-checked) character. */
export async function loadPlayerCard(c: ApexCharacter): Promise<PlayerCard> {
  const [profile, header, items, recent, milestones, bests] = await Promise.all([
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
    db
      .select({ activity: memberPersonalBests.activity, teamSize: memberPersonalBests.teamSize, centis: memberPersonalBests.centis })
      .from(memberPersonalBests)
      .where(eq(memberPersonalBests.accountId, c.accountId)),
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
  const names = clogItemLabels();
  // Decoration: a failed read is a card without a streak.
  const streak = await streakForAccount(c.accountId).catch(() => null);

  const card = shapePlayerCard({
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
    skills: (profile?.skills ?? []).map((sk) => ({ key: sk.key, level: sk.level, xp: sk.xp })),
    activities: (profile?.activities ?? []).map((a) => ({
      key: a.key,
      label: a.label,
      shortLabel: a.shortLabel,
      group: a.group,
      score: a.score,
    })),
    clogHeader: header ? { obtained: header.obtained, total: header.total } : null,
    clogPages: view.pages.map((p) => ({ name: p.name, obtained: p.obtained, total: p.total })),
    recentItems: recent.flatMap((r) =>
      r.at ? [{ itemId: r.itemId, name: names.get(r.itemId) ?? `Item ${r.itemId}`, at: r.at }] : [],
    ),
    milestones,
    // Labelled exactly as the profile page labels them (lib/clogRead), team size and all.
    bests: bests.map((b) => ({
      activity: titleCaseActivity(b.activity) + (b.teamSize > 0 ? ` (${b.teamSize})` : ''),
      time: formatPersonalBest(b.centis),
    })),
  });
  return { ...card, streak: streak && cardStreak(streak) };
}

function cardStreak(s: Awaited<ReturnType<typeof streakForAccount>>): PlayerCardStreak {
  const letter = { active: 'a', rest: 'r', missed: 'm' } as const;
  return {
    weeks: s.weeks,
    best: s.best,
    thisWeek: s.thisWeek,
    needed: s.needed,
    safe: s.safe,
    restBanked: s.restBanked,
    recent: s.history.slice(-13).map((m) => letter[m]).join(''),
    milestone: s.milestone?.name ?? null,
  };
}
