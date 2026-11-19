import { notFound } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import { clanServers } from '@/lib/botGuilds';
import { requirePlatformPage } from '@/lib/platformAccess';

export const dynamic = 'force-dynamic';

/**
 * The Discord servers the Anvil bot is in, with the clan each belongs to (lib/botGuilds). Asked of
 * Discord itself, so it also shows a server no clan is linked to, and names the clans whose saved
 * server the bot is not in: their roles and team channels fail without anyone being told.
 */
export default async function StaffServersPage() {
  const actor = await requirePlatformPage('support');
  if (!actor) notFound();
  const { known, servers, missing } = await clanServers();
  const unlinked = servers.filter((s) => s.clans.length === 0);

  return (
    <div>
      <h1 className="text-2xl font-bold">Discord servers</h1>
      <p className="mt-1 max-w-[70ch] text-sm text-gray-400">
        Where the Anvil bot is, from Discord&rsquo;s own list, beside the server each clan saved. Refreshed every ten minutes.
      </p>

      {!known ? (
        <p className="mt-6 rounded-xl border border-card-border bg-card-bg px-4 py-6 text-sm text-gray-300">
          Discord could not be asked just now (no bot token here, or it refused). Nothing below can be shown until it answers.
        </p>
      ) : (
        <>
          {missing.length > 0 && (
            <div className="mt-6 rounded-xl border border-red-400/40 bg-red-950/20 px-4 py-3">
              <h2 className="text-sm font-bold text-red-300">
                {missing.length === 1 ? '1 clan saved a server the bot is not in' : `${missing.length} clans saved a server the bot is not in`}
              </h2>
              <ul className="mt-2 space-y-1 text-sm text-gray-200">
                {missing.map((m) => (
                  <li key={m.id}>
                    <ClanLink href={`/staff/clans/${m.id}`} className="text-gold-light hover:text-gold">
                      {m.name}
                    </ClanLink>
                    <span className="text-text-muted"> · roles and team channels will not work until the bot is invited back</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 overflow-x-auto rounded-xl border border-card-border bg-card-bg">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="border-b border-card-border text-left text-xs uppercase tracking-wide text-gray-400">
                <tr>
                  <th className="px-4 py-3">Server</th>
                  <th className="px-4 py-3 text-right">Members</th>
                  <th className="px-4 py-3">Clan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {servers.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-300">{s.members == null ? '—' : s.members.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      {s.clans.length === 0 ? (
                        <span className="text-amber-300">no clan linked</span>
                      ) : (
                        s.clans.map((c, i) => (
                          <span key={c.id}>
                            {i > 0 && ', '}
                            <ClanLink href={`/staff/clans/${c.id}`} className="text-gold-light hover:text-gold">
                              {c.name}
                            </ClanLink>
                          </span>
                        ))
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-text-muted">
            {servers.length} {servers.length === 1 ? 'server' : 'servers'}
            {unlinked.length > 0 ? ` · ${unlinked.length} with no clan linked` : ''} · member counts are Discord&rsquo;s approximate figures
          </p>
        </>
      )}
    </div>
  );
}
