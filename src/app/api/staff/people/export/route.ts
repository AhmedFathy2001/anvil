import { requirePlatformApi } from '@/lib/platformAccess';
import { browsePeople, PEOPLE_SORTS, SUPPORTER_FILTERS, type PeopleSort } from '@/lib/platformView';
import { csvResponse, toCsv } from '@/lib/csv';

export const dynamic = 'force-dynamic';

/** The most people one file holds; a filter narrows a longer list. */
const MAX_ROWS = 5000;

/**
 * The staff people list as a spreadsheet, under the same filters and order as the page. Names,
 * counts, Supporter tier and plugin facts only: nothing here is more than the page shows.
 */
export async function GET(request: Request) {
  const gate = await requirePlatformApi('support');
  if ('response' in gate) return gate.response;
  const sp = new URL(request.url).searchParams;
  const yn = (v: string | null) => (v === 'yes' || v === 'no' ? v : null);
  const sort = PEOPLE_SORTS.includes(sp.get('sort') as PeopleSort) ? (sp.get('sort') as PeopleSort) : 'connected';
  const supporter = (SUPPORTER_FILTERS as readonly string[]).includes(sp.get('supporter') ?? '') ? sp.get('supporter') : null;
  const { rows } = await browsePeople(
    {
      q: sp.get('q') ?? '',
      clanId: Number(sp.get('clan')) || null,
      login: yn(sp.get('login')),
      accounts: yn(sp.get('accounts')),
      banned: yn(sp.get('banned')),
      multiClan: sp.get('multi') === 'true',
      supporter,
      sort,
    },
    1,
    MAX_ROWS,
  );
  return csvResponse(
    `anvil-people-${new Date().toISOString().slice(0, 10)}`,
    toCsv(
      ['Person id', 'Name', 'Characters', 'Clans', 'Signed in', 'Banned', 'Supporter', 'Held by', 'Supporter ends or renews', 'Plugin version', 'Last seen playing'],
      rows.map((r) => [
        r.playerId,
        r.name,
        r.accounts,
        r.clans,
        r.hasLogin ? 'yes' : 'no',
        r.banned ? 'yes' : 'no',
        r.supporter?.tier ?? '',
        r.supporter ? (r.supporter.how === 'paid' ? 'paid' : r.supporter.how === 'gift' ? 'gift' : 'staff gift') : '',
        r.supporter?.endsAt ?? '',
        r.pluginVersion ?? '',
        r.lastSeenAt ?? '',
      ]),
    ),
  );
}
