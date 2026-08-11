import type { Metadata } from 'next';
import { getClanAnalytics, getRosterLog, listMembers } from '@/lib/memberProfile';
import MembersDirectory from './MembersDirectory';
import ClanPulse from './ClanPulse';

export const metadata: Metadata = {
  title: 'Members — Anvil',
  description: 'Everyone tracked on this clan site, with their efficient hours and total experience.',
};

// Roster and stats both move on the sweep, so there's nothing worth caching between requests.
export const dynamic = 'force-dynamic';

export default async function MembersPage() {
  const members = await listMembers();
  // Analytics reuses the list rather than re-querying it, so the whole page is three statements.
  const [analytics, rosterLog] = await Promise.all([getClanAnalytics(members), getRosterLog(20)]);

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-1 h-5 bg-gold rounded-full" />
        <h1 className="text-2xl font-bold">Members</h1>
      </div>
      <p className="text-sm text-text-muted mb-6">
        Everyone we track. Click anyone to see their skills, bosses and efficient hours.
      </p>

      <ClanPulse analytics={analytics} rosterLog={rosterLog} />
      <MembersDirectory members={members} />
    </main>
  );
}
