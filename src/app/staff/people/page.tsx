import { notFound } from 'next/navigation';

import { allClans, browsePeople, findPeople } from '@/lib/platformView';
import { requirePlatformPage } from '@/lib/platformAccess';
import { hasPlatformRole } from '@/lib/clanRoles';
import PeopleClient from './PeopleClient';

export const dynamic = 'force-dynamic';

export default async function StaffPeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; clan?: string; login?: string; banned?: string; multi?: string; page?: string }>;
}) {
  const actor = await requirePlatformPage('support');
  if (!actor) notFound();

  const sp = await searchParams;
  const q = sp.q ?? '';
  const filters = {
    clanId: sp.clan ?? '',
    login: sp.login === 'yes' || sp.login === 'no' ? sp.login : '',
    banned: sp.banned === 'true',
    multiClan: sp.multi === 'true',
  };

  // Both, always. The search answers "who is this", the list answers "who is here", and a page that
  // could only do the first showed a blank screen to an operator asking the second.
  const [results, browse, clans] = await Promise.all([
    q ? findPeople(q) : Promise.resolve([]),
    browsePeople(
      {
        q,
        clanId: filters.clanId ? Number(filters.clanId) : null,
        login: filters.login === 'yes' || filters.login === 'no' ? filters.login : null,
        banned: filters.banned,
        multiClan: filters.multiClan,
      },
      Number(sp.page) || 1,
    ),
    allClans(),
  ]);

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
          browse={browse}
          filters={filters}
          clans={clans.map((c) => ({ id: c.id, name: c.name }))}
          canWrite={hasPlatformRole(actor.role, 'staff')}
          canGrant={hasPlatformRole(actor.role, 'root')}
          // Who is looking, so their own row does not offer them the two actions the API refuses.
          viewerPlayerId={actor.user.playerId}
        />
      </div>
    </div>
  );
}
