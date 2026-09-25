import { notFound } from 'next/navigation';

import { allClans, browsePeople, PEOPLE_SORTS, personDetail, type PeopleSort } from '@/lib/platformView';
import { requirePlatformPage } from '@/lib/platformAccess';
import { hasPlatformRole } from '@/lib/clanRoles';
import PeopleClient from './PeopleClient';

export const dynamic = 'force-dynamic';

export default async function StaffPeoplePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    clan?: string;
    login?: string;
    accounts?: string;
    banned?: string;
    multi?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const actor = await requirePlatformPage('support');
  if (!actor) notFound();

  const sp = await searchParams;
  const q = sp.q ?? '';
  const sort: PeopleSort = PEOPLE_SORTS.includes(sp.sort as PeopleSort)
    ? (sp.sort as PeopleSort)
    : 'connected';
  const filters = {
    clanId: sp.clan ?? '',
    login: sp.login === 'yes' || sp.login === 'no' ? sp.login : '',
    accounts: sp.accounts === 'yes' || sp.accounts === 'no' ? sp.accounts : '',
    // Accept the old checkbox URL as well as the new three-state filter.
    banned: sp.banned === 'yes' || sp.banned === 'no' ? sp.banned : sp.banned === 'true' ? 'yes' : '',
    multiClan: sp.multi === 'true',
    sort,
  };

  const [browse, clans] = await Promise.all([
    browsePeople(
      {
        q,
        clanId: filters.clanId ? Number(filters.clanId) : null,
        login: filters.login === 'yes' || filters.login === 'no' ? filters.login : null,
        accounts: filters.accounts === 'yes' || filters.accounts === 'no' ? filters.accounts : null,
        banned: filters.banned === 'yes' || filters.banned === 'no' ? filters.banned : null,
        multiClan: filters.multiClan,
        sort,
      },
      Number(sp.page) || 1,
    ),
    allClans(),
  ]);
  // Detail cards follow the SAME filtered, sorted ids as the browse query. Previously search used a
  // separate unfiltered query, so picking “No login” could still show a person with a login.
  const results = q
    ? (await Promise.all(browse.rows.map((row) => personDetail(row.playerId)))).filter(
        (person): person is NonNullable<typeof person> => person != null,
      )
    : [];

  return (
    <div>
      <h1 className="text-2xl font-bold">People</h1>
      <p className="mt-1 text-sm text-gray-400">
        One human, all their accounts, every clan they are in. The platform ban here bars someone
        everywhere — a clan removing someone is a different thing entirely, and stays the clan&rsquo;s.
      </p>
      <div className="mt-6">
        <PeopleClient
          key={JSON.stringify({ q, ...filters, page: browse.page })}
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
