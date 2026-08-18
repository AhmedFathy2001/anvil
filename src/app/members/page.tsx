import type { Metadata } from 'next';
import {
  getClanActivityAnalytics,
  getClanAnalytics,
  getRosterLog,
  getRosterMovement,
  listMembers,
} from '@/lib/memberProfile';
import { requireClan } from '@/lib/clanContext';
import MembersTabs from './MembersTabs';
import { getLuckBoards } from '@/lib/clogLuckBoard';

export const metadata: Metadata = {
  title: 'Members — Anvil',
  description: 'Everyone tracked on this clan site, with their efficient hours and total experience.',
};

// Roster and stats both move on the sweep, so there's nothing worth caching between requests.
export const dynamic = 'force-dynamic';

export default async function MembersPage() {
  const clan = await requireClan();
  const members = await listMembers(clan.id);
  // Analytics reuses the list rather than re-querying it, so the whole page is a handful of
  // statements. The activity read is its own query, but a narrow one — two columns off the roster,
  // where the alternative was every member's full hiscores snapshot.
  const [analytics, rosterLog, activities, movement, luck] = await Promise.all([
    getClanAnalytics(members),
    getRosterLog(clan.id, 20),
    getClanActivityAnalytics(clan.id),
    getRosterMovement(members),
    getLuckBoards(),
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
      />
    </main>
  );
}
