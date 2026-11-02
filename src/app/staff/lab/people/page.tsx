import ClanLink from '@/components/ClanLink';

import PeopleClient from './PeopleClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Lab test users' };

/** The lab's test users and your standing in the lab clan (lib/labCast). */
export default function StaffLabPeoplePage() {
  return (
    <div>
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold text-gold">
        <span className="h-6 w-1 rounded-full bg-gold" />
        Test users
      </h1>
      <p className="mb-6 text-sm text-text-muted">
        Lab-only people to fill boards, give tiers and see the site as. They can never be a real member: their names
        start with <b>Lab~</b> and they live only in the hidden lab clan.{' '}
        <ClanLink href="/staff/lab" className="text-gold hover:underline">Back to the tile lab</ClanLink>
      </p>
      <PeopleClient />
    </div>
  );
}
