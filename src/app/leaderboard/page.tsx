import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import AnvilMark from '@/components/AnvilMark';
import ClanLink from '@/components/ClanLink';
import { isApexHost } from '@/lib/clanContext';
import { clanStandings, topPlayers, type LeaderboardWindow } from '@/lib/clanLeaderboard';
import ClanShapes from '@/components/leaderboard/ClanShapes';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Hall of Records — Anvil',
  description: 'Clans on Anvil, measured against each other.',
};

const WINDOWS: { key: LeaderboardWindow; label: string }[] = [
  { key: '7d', label: 'This week' },
  { key: '30d', label: '30 days' },
  { key: 'all', label: 'All time' },
];

/**
 * THREE METRICS, ALL VISIBLE.
 *
 * `clanStandings` has always returned XP, EHP and EHB — the query computes all three — and the page
 * printed XP and a greyed EHP column. Which is a shame, because they say different things: XP is how
 * much was done, EHP how many hours of it, and EHB how much of that was bossing. A clan can lead one
 * and be nowhere on another, and that contrast IS the interesting part of a cross-clan table.
 */


/**
 * Clans measured against each other — the first page that only makes sense because they share a
 * platform.
 *
 * Apex only. A leaderboard rendered under one clan's address would read as that clan's table rather
 * than everybody's, which is the opposite of the point.
 *
 * WHAT IT IS TRYING TO SAY. A ranked list of totals rewards being big, and says almost nothing: of
 * course the 400-member clan gained more experience than the 30-member one. The number worth
 * reading is how much of a clan actually PLAYED, which is why the share of a roster that moved is
 * given the same weight as the total it moved.
 */
export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string; m?: string }>;
}) {
  if (!isApexHost((await headers()).get('host'))) notFound();

  const params = await searchParams;
  const window: LeaderboardWindow = params.w === '30d' || params.w === 'all' ? params.w : '7d';
  const [all, players] = await Promise.all([clanStandings(window), topPlayers(window)]);

  // Ordered by experience because a table needs an order, not because it is the most interesting
  // column — the other two axes are drawn on every row rather than sorted by.
  const clans = [...all].sort((a, b) => b.xpGained - a.xpGained);
  const playerLeader = players.length > 0 ? players[0].xpGained : 0;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="relative mb-7 overflow-hidden">
        <AnvilMark
          size={190}
          className="pointer-events-none absolute -top-10 right-0 hidden text-gold/[0.04] sm:block"
        />
        <h1 className="display display-lg relative text-[clamp(1.7rem,4vw,2.2rem)] font-semibold">
          Hall of Records
        </h1>
        <p className="relative mt-2 max-w-[62ch] text-[14.5px] text-text-muted">
          Every verified clan on Anvil, on three axes at once. How much a clan gained mostly measures
          how big it is; how much of the roster turned up, and how much of that was bossing, are what
          make two clans of the same size completely different places to be.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Switch
          options={WINDOWS.map((w) => ({ key: w.key, label: w.label, href: `/leaderboard?w=${w.key}` }))}
          active={window}
        />
      </div>

      <ClanShapes rows={clans} />

      <section className="mt-10">
        <div className="mb-1.5 flex items-center gap-2.5">
          <span className="h-[18px] w-[3px] rounded-sm bg-gold" />
          <h2 className="text-[16.5px] font-semibold">Players</h2>
        </div>
        <p className="mb-4 ml-4 max-w-[62ch] text-[13px] text-text-muted">
          Only accounts their owner has shared. Everyone else still counts towards their clan&rsquo;s
          total — a cross-clan table isn&rsquo;t a way around a privacy setting.
        </p>

        {players.length === 0 ? (
          <p className="rounded-xl border border-dashed border-card-border px-5 py-8 text-center text-sm text-text-muted">
            Nobody has shared an account yet.
          </p>
        ) : (
          <ul className="divide-y divide-card-border overflow-hidden rounded-xl border border-card-border bg-card-bg">
            {players.map((p, i) => (
              <li key={p.rsn} className="relative flex items-center gap-3 px-4 py-2.5 sm:px-5">
                {/* The bar sits UNDER the row rather than in its own column: at this density a
                    separate track would be four pixels tall and unreadable. */}
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 bg-gold/[0.055]"
                  style={{ width: `${pct(p.xpGained, playerLeader)}%` }}
                />
                <span
                  className={`relative w-6 shrink-0 text-right font-mono text-[11px] tabular-nums ${
                    i === 0 ? 'text-gold' : 'text-text-dim'
                  }`}
                >
                  {i + 1}
                </span>
                <ClanLink
                  href={`/p/${encodeURIComponent(p.rsn)}`}
                  className="relative min-w-0 truncate text-[14px] hover:text-gold"
                >
                  {p.rsn}
                </ClanLink>
                {p.clanSlug && (
                  <ClanLink
                    href={`/c/${p.clanSlug}`}
                    className="relative hidden shrink-0 text-[12px] text-text-dim hover:text-gold sm:block"
                  >
                    {p.clanName}
                  </ClanLink>
                )}
                <span className="relative ml-auto shrink-0 font-mono text-[13px] tabular-nums">
                  {compact(p.xpGained)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Switch({
  options,
  active,
}: {
  options: { key: string; label: string; href: string }[];
  active: string;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => (
        <ClanLink
          key={o.key}
          href={o.href}
          aria-current={o.key === active ? 'page' : undefined}
          className={`rounded-md border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors ${
            o.key === active
              ? 'border-gold/30 bg-gold/[0.07] text-gold'
              : 'border-transparent text-text-muted hover:bg-brown-light hover:text-foreground'
          }`}
        >
          {o.label}
        </ClanLink>
      ))}
    </div>
  );
}





const pct = (value: number, of: number) => (of > 0 ? Math.max(1, Math.round((value / of) * 100)) : 0);

function compact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}
