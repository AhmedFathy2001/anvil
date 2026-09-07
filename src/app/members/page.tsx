import type { Metadata } from 'next';
import {
  getClanActivityAnalytics,
  getClanAnalytics,
  getRosterLog,
  getRosterMovement,
  listMembers,
} from '@/lib/memberProfile';
import { requireClan } from '@/lib/clanContext';
import { getClanDisplayName } from '@/lib/pluginConfig';
import { clanSectionMetadata } from '@/lib/seoPages';
import { getSetting } from '@/lib/settings';
import MembersTabs from './MembersTabs';
import { getLuckBoards } from '@/lib/clogLuckBoard';
import { momentsForClan } from '@/lib/momentsStore';
import MomentsFeed from '@/components/MomentsFeed';

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

export default async function MembersPage() {
  const clan = await requireClan();
  const members = await listMembers(clan.id);
  // Guests are listed but not counted, unless this clan says otherwise — see getClanAnalytics.
  const countGuests = (await getSetting(clan.id, 'members_count_guests')) === '1';
  // Analytics reuses the list rather than re-querying it, so the whole page is a handful of
  // statements. The activity read is its own query, but a narrow one — two columns off the roster,
  // where the alternative was every member's full hiscores snapshot.
  const [analytics, rosterLog, activities, movement, luck, moments] = await Promise.all([
    getClanAnalytics(members, { countGuests }),
    getRosterLog(clan.id, 20),
    getClanActivityAnalytics(clan.id, { countGuests }),
    getRosterMovement(members),
    getLuckBoards(clan.id),
    // Every scope's moments together — see momentsForClan for why a board's drop and a quiet
    // Tuesday's pet are the same news to someone reading this page.
    momentsForClan(clan.id, 30),
  ]);

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
        members={members}
        analytics={analytics}
        rosterLog={rosterLog}
        activities={activities}
        movement={movement}
        luck={luck}
        lately={
          <MomentsFeed
            moments={moments}
            title="Lately"
            blurb="pets, big drops and combat tasks, as they happened. Nothing here scores."
            emptyNote="Nothing yet. Moments arrive from the Anvil plugin — pets and rare drops always, and anything else that clears the floors on Admin → Integrations."
          />
        }
      />
    </main>
  );
}
