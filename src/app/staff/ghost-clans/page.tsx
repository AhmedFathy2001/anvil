import { notFound } from 'next/navigation';

import { requirePlatformPage } from '@/lib/platformAccess';
import { ghostClanLeads } from '@/lib/gameClans';
import { parseStamp } from '@/lib/dbTime';
import ClanLink from '@/components/ClanLink';

export const dynamic = 'force-dynamic';

/**
 * In-game clans that Anvil players are in but that are not on Anvil (lib/gameClans) — the lead
 * list. Counts every fresh sighting, including players who hid their clan from public pages: this
 * is platform staff, and the number is all it shows of them.
 */
export default async function StaffGhostClansPage() {
  const actor = await requirePlatformPage('support');
  if (!actor) notFound();

  const leads = await ghostClanLeads(200);

  return (
    <div>
      <h1 className="text-2xl font-bold">Ghost clans</h1>
      <p className="mt-1 text-sm text-gray-400">
        In-game clans with Anvil players in them that haven&rsquo;t come to Anvil yet, from each player&rsquo;s own
        plugin. Seen in the last 60 days. Not a roster: only Anvil players are counted.
      </p>
      {leads.length === 0 ? (
        <p className="mt-6 text-sm text-gray-400">Nothing yet — sightings arrive as players log in with a plugin that reports its clan.</p>
      ) : (
        <table className="mt-6 w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="py-2 pr-4 font-medium">Clan</th>
              <th className="py-2 pr-4 font-medium">Anvil players</th>
              <th className="py-2 font-medium">Last seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-card-border">
            {leads.map((l) => {
              const seen = parseStamp(l.lastSeenAt);
              return (
                <tr key={l.key}>
                  <td className="py-2 pr-4">
                    <ClanLink href={`/clans/g/${encodeURIComponent(l.key)}`} className="hover:text-gold">
                      {l.name}
                    </ClanLink>
                  </td>
                  <td className="py-2 pr-4 tabular-nums">{l.members}</td>
                  <td className="py-2 text-gray-400">{seen ? new Date(seen).toLocaleDateString() : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
