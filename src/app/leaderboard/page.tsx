import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import ClanLink from '@/components/ClanLink';
import { isApexHost } from '@/lib/clanContext';
import { clanStandings, topPlayers, type LeaderboardWindow } from '@/lib/clanLeaderboard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Clan leaderboard — Anvil',
  description: 'Clans on Anvil, measured against each other.',
};

const WINDOWS: { key: LeaderboardWindow; label: string }[] = [
  { key: '7d', label: 'This week' },
  { key: '30d', label: '30 days' },
  { key: 'all', label: 'All time' },
];

const n = (v: number) => v.toLocaleString();

/**
 * Clans measured against each other — the first page that only makes sense because they share a
 * platform.
 *
 * Apex only. A leaderboard rendered under one clan's address would read as that clan's table rather
 * than everybody's, which is the opposite of the point.
 */
export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  if (!isApexHost((await headers()).get('host'))) notFound();

  const raw = (await searchParams).w;
  const window: LeaderboardWindow = raw === '30d' || raw === 'all' ? raw : '7d';

  const [clans, players] = await Promise.all([clanStandings(window), topPlayers(window)]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold">Clan leaderboard</h1>
      <p className="mt-1 text-sm text-gray-400">
        Experience gained by each clan&rsquo;s members. Verified clans only.
      </p>

      <div className="mt-5 flex gap-2">
        {WINDOWS.map((w) => (
          <ClanLink
            key={w.key}
            href={`/leaderboard?w=${w.key}`}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              w.key === window
                ? 'border-gold/40 text-gold'
                : 'border-card-border text-gray-400 hover:text-gold'
            }`}
          >
            {w.label}
          </ClanLink>
        ))}
      </div>

      {clans.length === 0 ? (
        <p className="mt-6 rounded-xl border border-card-border bg-card-bg p-4 text-sm text-gray-400">
          Nothing to show yet. Clans appear here once they are verified and their members start
          reporting through the plugin.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-card-border bg-card-bg">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="border-b border-card-border text-left text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3">Clan</th>
                <th className="px-4 py-3 text-right">XP gained</th>
                <th className="px-4 py-3 text-right">EHP</th>
                <th className="px-4 py-3 text-right">Playing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {clans.map((c, i) => (
                <tr key={c.clanId}>
                  <td className="px-4 py-3 tabular-nums text-gray-500">{i + 1}</td>
                  <td className="px-4 py-3">
                    <ClanLink href={`/c/${c.slug}`} className="font-medium hover:text-gold">
                      {c.name}
                    </ClanLink>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{n(c.xpGained)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-400">
                    {c.ehpGained.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-400">
                    {/* Actives over roster size: 20 of 30 reads very differently from 20 of 300, and
                        the ratio is the honest way to compare a small clan to a large one. */}
                    {c.actives}
                    <span className="text-gray-600"> / {c.members}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="mt-10">
        <div className="mb-3 flex items-center gap-2">
          <span className="h-5 w-1 bg-gold" />
          <h2 className="text-lg font-semibold">Players</h2>
        </div>
        <p className="mb-3 text-xs text-gray-500">
          Only accounts their owner has shared. Everyone else still counts towards their clan&rsquo;s
          total &mdash; a cross-clan table isn&rsquo;t a way around a privacy setting.
        </p>
        {players.length === 0 ? (
          <p className="rounded-xl border border-card-border bg-card-bg p-4 text-sm text-gray-400">
            Nobody has shared an account yet.
          </p>
        ) : (
          <ul className="divide-y divide-card-border overflow-hidden rounded-xl border border-card-border bg-card-bg">
            {players.map((p, i) => (
              <li key={p.rsn} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-6 tabular-nums text-xs text-gray-500">{i + 1}</span>
                <ClanLink href={`/p/${encodeURIComponent(p.rsn)}`} className="hover:text-gold">
                  {p.rsn}
                </ClanLink>
                {p.clanSlug && (
                  <ClanLink href={`/c/${p.clanSlug}`} className="text-xs text-gray-500 hover:text-gold">
                    {p.clanName}
                  </ClanLink>
                )}
                <span className="ml-auto tabular-nums text-sm">{n(p.xpGained)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
