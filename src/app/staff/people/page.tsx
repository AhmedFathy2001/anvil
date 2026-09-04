import { notFound } from 'next/navigation';

import { findPeople } from '@/lib/platformView';
import { requirePlatformPage } from '@/lib/platformAccess';
import { hasPlatformRole } from '@/lib/clanRoles';
import PeopleClient from './PeopleClient';

export const dynamic = 'force-dynamic';

export default async function StaffPeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const actor = await requirePlatformPage('support');
  if (!actor) notFound();

  const q = (await searchParams).q ?? '';
  const results = q ? await findPeople(q) : [];

  return (
    <div>
      <h1 className="text-2xl font-bold">People</h1>
      <p className="mt-1 text-sm text-gray-400">
        One human, all their accounts, every clan they are in. The platform ban here bars someone
        everywhere — a clan removing someone is a different thing entirely, and stays the clan&rsquo;s.
      </p>
      <div className="mt-6">
        <PeopleClient
          initialQuery={q}
          results={results}
          canWrite={hasPlatformRole(actor.role, 'staff')}
          canGrant={hasPlatformRole(actor.role, 'root')}
          // Who is looking, so their own row does not offer them the two actions the API refuses.
          viewerPlayerId={actor.user.playerId}
        />
      </div>
    </div>
  );
}
