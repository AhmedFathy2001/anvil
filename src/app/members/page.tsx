import { getWeekLuck } from '@/lib/weekLuck';
import type { Metadata } from 'next';
import { hiddenNamesForViewer } from '@/lib/clanInsider';
import { withoutHiddenKeys, withoutHiddenNames, withoutHiddenRows } from '@/lib/rosterVisibility';
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
import { KINDS_OF } from '@/lib/pluginUi/feedLists';
import { LATELY_FILTERS, LatelyFilters, LatelyPaging } from './LatelyNav';
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

/** Rows the Lately tab shows per page, a collapsed run counting as one. */
const LATELY_PAGE = 50;

/** The Lately tab's page cursor: an ISO time, nothing else (it goes into a comparison, never markup). */
function latelyCursor(raw: string | undefined): string | null {
  if (!raw || raw.length > 40) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ sort?: string; tab?: string; f?: string; before?: string }> }) {
  const clan = await requireClan();
  const { sort: requestedSort, tab: requestedTab, f: requestedFilter, before: requestedBefore } = await searchParams;
  // Lately is the clan's whole feed (the plugin panel's Feed links here): its filters and pages.
  const latelyFilter = LATELY_FILTERS.find((x) => x.key === requestedFilter)?.key ?? 'all';
  const latelyBefore = latelyCursor(requestedBefore);
  const initialSort = requestedSort === 'xp' ? 'xp' as const : requestedSort === 'streak' ? 'streak' as const : 'week' as const;
  // A creator space has no roster (lib/creatorSpaces CREATOR_HIDDEN_PUBLIC_PATHS): its home instead.
  await creatorPublicAway('/members', clan);
  // A visitor from outside the clan is shown only the characters whose owner left "Show publicly"
  // on (lib/rosterVisibility). Counts and clan totals below still come from the whole roster.
  const hidden = await hiddenNamesForViewer(clan.id);
  // "Hide guests from the Members page" (members_hide_guests): the clan lists its members only.
  // Dropped at the source, so the roster, its counts, the podium and the totals all agree, and no
  // guest row reaches the page's payload for anyone.
  const hideGuests = (await getSetting(clan.id, 'members_hide_guests')) === '1';
  const allMembers = (await listMembers(clan.id)).filter((m) => !hideGuests || !m.isGuest);
  const members = withoutHiddenRows(allMembers, hidden);
  // Guests are listed but not counted, unless this clan says otherwise — see getClanAnalytics.
  // Hidden guests are never counted: a total that includes people the page won't show can't be checked.
  const countGuests = !hideGuests && (await getSetting(clan.id, 'members_count_guests')) === '1';
  // Rank sorts by seniority, not alphabetically.
  const rankCounts = new Map<string, number>();
  for (const m of allMembers) if (m.rank && !m.isGuest) rankCounts.set(m.rank, (rankCounts.get(m.rank) ?? 0) + 1);
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
    getClanAnalytics(allMembers, { countGuests }).then((a) => withoutHiddenNames(a, hidden)),
    getRosterLog(clan.id, 20).then((rows) => withoutHiddenRows(rows, hidden)),
    getClanActivityAnalytics(clan.id, { countGuests }).then((a) => withoutHiddenNames(a, hidden)),
    getRosterMovement(members),
    // All time, and the last seven days (lib/weekLuck) under the same hidden-name rule.
    Promise.all([getLuckBoards(clan.id), getWeekLuck(clan.id).catch(() => null)]).then(([b, w]) => ({
      ...withoutHiddenNames(b, hidden),
      week: w ? { ...withoutHiddenNames({ dry: w.dry, spooned: w.spooned }, hidden), judged: w.judged, members: w.members } : null,
    })),
    // Every scope's moments together — see momentsForClan for why a board's drop and a quiet
    // Tuesday's pet are the same news to someone reading this page.
    // Back-to-back repeats are one line with a count (lib/feedRuns), cut to 30 after.
    // Read past a page so back-to-back repeats still fill one; the extra says whether Older exists.
    momentsForClan(clan.id, LATELY_PAGE * 3, latelyFilter === 'all' ? undefined : KINDS_OF[latelyFilter], latelyBefore).then((rows) =>
      collapseMomentRuns(withoutHiddenRows(rows, hidden)).slice(0, LATELY_PAGE + 1),
    ),
    // Supporter flair on each character's name: one query for the whole roster (the podium's names
    // are roster names, so the same record covers them).
    supporterLooksByName(members.map((m) => m.rsn)),
    // The Booster mark: who boosts THIS clan, by the character the boost rides on. A stranger sees it
    // only where the clan shows strangers its members' names (the Clan Hall's switch), like the wall.
    boosterMarksFor(clan.id).then((marks) => withoutHiddenKeys(marks, hidden)),
    // Weekly activity streaks (lib/activityStreaks): decoration, so a failed read is no column values.
    clanStreaks(clan.id)
      .then((h) => withoutHiddenKeys(Object.fromEntries([...h.byRsn].filter(([, s]) => s.weeks > 0).map(([rsn, s]) => [rsn, s.weeks])), hidden))
      .catch(() => ({}) as Record<string, number>),
  ]);
  const recordHolders = withoutHiddenRows((await Promise.all(RECORD_PERIODS.map((p) => getClanRecordHolders(clan.id, p)))).flat(), hidden)
    .map((h) => ({ ...h, href: `/members/${encodeURIComponent(h.rsn)}` }));
  // GZ / Sad / Sit under each: counts for anyone, who gave them (and a press) for a clanmate.
  const latelyRows = moments.slice(0, LATELY_PAGE);
  const latelyLast = latelyRows[latelyRows.length - 1];
  // The next page starts below this one's oldest entry (a run's first, when the last row is a run).
  const latelyOlder = moments.length > LATELY_PAGE && latelyLast ? (latelyLast.run?.firstAt ?? latelyLast.occurredAt) : null;
  const session = await verifyUser();
  const reactions = await siteReactions(latelyRows, { clanId: clan.id }, session?.userId ?? null);

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
          <>
          <LatelyFilters filter={latelyFilter} />
          <MomentsFeed
            moments={latelyRows}
            reactions={reactions}
            boosters={boosters}
            looks={supporterLooks}
            blurb="pets, big drops, achievements and deaths, as they happened. Nothing here scores."
            title={latelyBefore ? 'Older' : 'Lately'}
            emptyNote={latelyBefore ? 'Nothing older.' : 'Nothing yet. Moments arrive from the Anvil plugin — pets and rare drops always, and anything else that clears the floors on Admin → Integrations.'}
          />
          <LatelyPaging filter={latelyFilter} before={latelyBefore} older={latelyOlder} />
          </>
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
