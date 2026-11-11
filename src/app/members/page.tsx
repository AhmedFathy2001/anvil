import type { Metadata } from 'next';
import { clanStreaks } from '@/lib/activityStreaks';
import RecordsBoard from '@/components/records/RecordsBoard';
import { getClanRecordHolders } from '@/lib/records';
import { RECORD_PERIODS } from '@/lib/recordsRules';
import {
  getClanActivityAnalytics,
  getClanAnalytics,
  getRosterLog,
  getRosterMovement,
  listMembers,
} from '@/lib/memberProfile';
import { requireClan } from '@/lib/clanContext';
import { creatorPublicAway } from '@/lib/creatorGuard';
import { getClanDisplayName } from '@/lib/pluginConfig';
import { clanSectionMetadata } from '@/lib/seoPages';
import { getSetting } from '@/lib/settings';
import { RANK_NUMBERS_KEY, RANK_ORDER_KEY, effectiveRankOrder, parseRankNumbers, parseRankOrder, rankOrderWithNumbers } from '@/lib/rankRules';
import MembersTabs from './MembersTabs';
import { getLuckBoards } from '@/lib/clogLuckBoard';
import { momentsForClan } from '@/lib/momentsStore';
import { collapseMomentRuns } from '@/lib/feedRuns';
import MomentsFeed from '@/components/MomentsFeed';
import { supporterLooksByName } from '@/lib/supporter';
import { verifyUser } from '@/lib/auth';
import { siteReactions } from '@/lib/siteReactions';
import { boosterMarks } from '@/lib/clanBoosts';
import { hallConfig } from '@/lib/clanHall';
import { viewerMemberIds } from '@/lib/competitionView';

/**
 * A static export named the product instead of the clan — "Members — Anvil" on every clan's roster,
 * so a person with three clans open had three identical tabs and search had three identical results.
 */
export async function generateMetadata(): Promise<Metadata> {
  const clan = await requireClan();
  const name = (await getClanDisplayName(clan.id, clan.name)) || clan.name;
  return clanSectionMetadata({
    section: 'Members',
    // No article in front of the name: a great many clans are called "The <something>", and
    // "the The AFK Spot roster" is what a template that assumes otherwise produces.
    description: `Every member of ${name}, with their efficient hours, total experience and what they gained this week.`,
  });
}

// Roster and stats both move on the sweep, so there's nothing worth caching between requests.
export const dynamic = 'force-dynamic';

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ sort?: string; tab?: string }> }) {
  const clan = await requireClan();
  const { sort: requestedSort, tab: requestedTab } = await searchParams;
  const initialSort = requestedSort === 'xp' ? 'xp' as const : requestedSort === 'streak' ? 'streak' as const : 'week' as const;
  // A creator space has no roster (lib/creatorSpaces CREATOR_HIDDEN_PUBLIC_PATHS): its home instead.
  await creatorPublicAway('/members', clan);
  const members = await listMembers(clan.id);
  // Guests are listed but not counted, unless this clan says otherwise — see getClanAnalytics.
  const countGuests = (await getSetting(clan.id, 'members_count_guests')) === '1';
  // Rank sorts by seniority, not alphabetically.
  const rankCounts = new Map<string, number>();
  for (const m of members) if (m.rank && !m.isGuest) rankCounts.set(m.rank, (rankCounts.get(m.rank) ?? 0) + 1);
  // The game's own order where the plugin has reported rank numbers (custom titles included); the
  // ladder for anything it hasn't.
  const rankOrder = rankOrderWithNumbers(
    parseRankNumbers(await getSetting(clan.id, RANK_NUMBERS_KEY)),
    effectiveRankOrder(
      parseRankOrder(await getSetting(clan.id, RANK_ORDER_KEY)),
      [...rankCounts].map(([rank, count]) => ({ rank, count })),
    ),
  );
  // Analytics reuses the list rather than re-querying it, so the whole page is a handful of
  // statements. The activity read is its own query, but a narrow one — two columns off the roster,
  // where the alternative was every member's full hiscores snapshot.
  const [analytics, rosterLog, activities, movement, luck, moments, supporterLooks, boosters, streaks] = await Promise.all([
    getClanAnalytics(members, { countGuests }),
    getRosterLog(clan.id, 20),
    getClanActivityAnalytics(clan.id, { countGuests }),
    getRosterMovement(members),
    getLuckBoards(clan.id),
    // Every scope's moments together — see momentsForClan for why a board's drop and a quiet
    // Tuesday's pet are the same news to someone reading this page.
    // Back-to-back repeats are one line with a count (lib/feedRuns), cut to 30 after.
    momentsForClan(clan.id, 90).then((rows) => collapseMomentRuns(rows).slice(0, 30)),
    // Supporter flair on each character's name: one query for the whole roster (the podium's names
    // are roster names, so the same record covers them).
    supporterLooksByName(members.map((m) => m.rsn)),
    // The Booster mark: who boosts THIS clan, by the character the boost rides on. A stranger sees it
    // only where the clan shows strangers its members' names (the Clan Hall's switch), like the wall.
    boosterMarksFor(clan.id),
    // Weekly activity streaks (lib/activityStreaks): decoration, so a failed read is no column values.
    clanStreaks(clan.id)
      .then((h) => Object.fromEntries([...h.byRsn].filter(([, s]) => s.weeks > 0).map(([rsn, s]) => [rsn, s.weeks])))
      .catch(() => ({}) as Record<string, number>),
  ]);
  const recordHolders = (await Promise.all(RECORD_PERIODS.map((p) => getClanRecordHolders(clan.id, p))))
    .flat()
    .map((h) => ({ ...h, href: `/members/${encodeURIComponent(h.rsn)}` }));
  // GZ / Sad / Sit under each: counts for anyone, who gave them (and a press) for a clanmate.
  const session = await verifyUser();
  const reactions = await siteReactions(moments, { clanId: clan.id }, session?.userId ?? null);

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-1 h-5 bg-gold rounded-full" />
        <h1 className="text-2xl font-bold">Members</h1>
      </div>
      <p className="text-sm text-text-muted mb-6">
        Everyone we track. Click anyone to see their skills, bosses and efficient hours.
      </p>

      <MembersTabs
        initialTab={requestedTab}
        initialSort={initialSort}
        streaks={streaks}
        members={members}
        analytics={analytics}
        rosterLog={rosterLog}
        activities={activities}
        movement={movement}
        rankOrder={rankOrder}
        luck={luck}
        supporterLooks={supporterLooks}
        boosters={boosters}
        records={
          <div className="border border-card-border rounded-xl bg-card-bg p-4">
            <p className="text-sm text-text-muted mb-3">Who holds the clan&apos;s biggest day, week, month and year for each skill and boss. Counted from when Anvil started tracking records.</p>
            <RecordsBoard rows={recordHolders} emptyText="No records yet. They fill in as members gain XP and kills." />
          </div>
        }
        lately={
          <MomentsFeed
            moments={moments}
            reactions={reactions}
            boosters={boosters}
            looks={supporterLooks}
            title="Lately"
            blurb="pets, big drops and combat tasks, as they happened. Nothing here scores."
            emptyNote="Nothing yet. Moments arrive from the Anvil plugin — pets and rare drops always, and anything else that clears the floors on Admin → Integrations."
          />
        }
      />
    </main>
  );
}

async function boosterMarksFor(clanId: number): Promise<Record<string, number>> {
  const session = await verifyUser();
  const insider = !!session && (await viewerMemberIds(clanId, session)).length > 0;
  if (!insider && !(await hallConfig(clanId).catch(() => null))?.publicNames) return {};
  return boosterMarks(clanId);
}
