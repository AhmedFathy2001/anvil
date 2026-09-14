import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import AnvilMark from '@/components/AnvilMark';
import ClanLink from '@/components/ClanLink';
import { isApexHost } from '@/lib/clanContext';
import { clanStandings, topPlayers, type LeaderboardWindow } from '@/lib/clanLeaderboard';
import ClanShapes from '@/components/leaderboard/ClanShapes';
import PlayerSearch from '@/components/PlayerSearch';
import { JsonLd, leaderboardLd } from '@/lib/jsonLd';

export const dynamic = 'force-dynamic';

/**
 * The apex's competitive front door, and the page it should be found by.
 *
 * "Hall of Records — Anvil / Clans on Anvil, measured against each other" names the furniture and
 * assumes the reader already knows what Anvil is — which is exactly backwards for the one page here
 * that a stranger might search for on its own terms. Nobody searches for a hall of records; people
 * search for OSRS clan rankings, and this is that.
 */
export const metadata: Metadata = {
  // Players lead the page now, so they lead the title: the search anybody actually types is for a
  // ranking of people or of clans, and this is both with the people first.
  title: 'OSRS Player & Clan Leaderboard — Hall of Records',
  description:
    'Old School RuneScape players and clans ranked by experience, efficient hours and bossing — updated every week. No clan needed to appear.',
  alternates: { canonical: '/leaderboard' },
  openGraph: {
    type: 'website',
    siteName: 'Anvil',
    title: 'OSRS Player & Clan Leaderboard — Hall of Records',
    description:
      'Old School RuneScape players and clans ranked by experience, efficient hours and bossing, updated every week.',
    url: '/leaderboard',
    images: [{ url: '/api/og/leaderboard', width: 1200, height: 630, alt: 'OSRS Clan Leaderboard' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OSRS Player & Clan Leaderboard — Hall of Records',
    description: 'Old School RuneScape players and clans ranked by experience, efficient hours and bossing.',
    images: ['/api/og/leaderboard'],
  },
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
/** A page of people. Twenty-five is a readable ranking; past that it is a spreadsheet. */
const PER_PAGE = 25;

/**
 * How deep paging goes before the search box is the better tool.
 *
 * Offset paging walks the rows it skips, so an unbounded `?p=` is a way to ask the database to
 * aggregate the whole table and throw nearly all of it away. Forty pages of twenty-five is a
 * thousand people, and anybody looking for one name past that is looking for a name.
 */
const MAX_PAGE = 40;

/**
 * How many clans the standings show.
 *
 * A table, not a directory — the clan directory is Clan Hall, which is built for browsing all of
 * them and has a search. This is the top of one ranking, and a ranking that runs to a thousand rows
 * is not read, it is scrolled past.
 */
const CLANS_SHOWN = 10;

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string; m?: string; p?: string }>;
}) {
  if (!isApexHost((await headers()).get('host'))) notFound();

  const params = await searchParams;
  const window: LeaderboardWindow = params.w === '30d' || params.w === 'all' ? params.w : '7d';

  // THE PAGE NUMBER IS SOMEBODY ELSE'S STRING. Clamped hard: a hand-typed `?p=99999` must not turn
  // into an offset the database walks a million rows to satisfy.
  const page = Math.min(Math.max(1, Number(params.p) || 1), MAX_PAGE);
  const offset = (page - 1) * PER_PAGE;

  // One row past the page, which is how the next link knows whether there is a next page without a
  // COUNT over an aggregate — the count would be the most expensive query on the page and would only
  // ever be used to decide whether to draw an arrow.
  const [clanRows, playerRows] = await Promise.all([
    clanStandings(window, CLANS_SHOWN),
    topPlayers(window, PER_PAGE + 1, null, offset),
  ]);

  const hasNext = playerRows.length > PER_PAGE;
  const players = hasNext ? playerRows.slice(0, PER_PAGE) : playerRows;

  // Ordered by experience because a table needs an order, not because it is the most interesting
  // column — the other two axes are drawn on every row rather than sorted by.
  const clans = [...clanRows].sort((a, b) => b.xpGained - a.xpGained);
  // The bar is drawn against the leader OF THIS PAGE, not of the table: on page 4 every row would
  // otherwise be a sliver against a first place nobody can see.
  const playerLeader = players.length > 0 ? players[0].xpGained : 0;
  const href = (p: number) => `/leaderboard?w=${window}${p > 1 ? `&p=${p}` : ''}`;

  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* The page's whole content is an ordering, so it says so: an ItemList is what lets a search
          engine read this as a ranking rather than as a table of links to clans. */}
      <JsonLd data={leaderboardLd(clans.map((c) => ({ name: c.name, slug: c.slug })))} />
      <header className="relative mb-7 overflow-hidden">
        <AnvilMark
          size={190}
          className="pointer-events-none absolute -top-10 right-0 hidden text-gold/[0.04] sm:block"
        />
        <h1 className="display display-lg relative text-[clamp(1.7rem,4vw,2.2rem)] font-semibold">
          Hall of Records
        </h1>
        <p className="relative mt-2 max-w-[62ch] text-[14.5px] text-text-muted">
          Everybody on Anvil who has shared a character, in one order. Anvil does not need a clan to
          be a member of — the clans are here too, further down, measured against each other.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Switch
          options={WINDOWS.map((w) => ({
            key: w.key,
            label: w.label,
            // Changing the window starts the ranking again: page 4 of the week is not page 4 of
            // all time, and carrying the number across lands somebody in an unrelated middle.
            href: `/leaderboard?w=${w.key}`,
          }))}
          active={window}
        />
      </div>

      <section>
        <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
          <span className="h-[18px] w-[3px] rounded-sm bg-gold" />
          <h2 className="text-[16.5px] font-semibold">Players</h2>
          {/* A table of twenty-five is a ranking, not a directory. The box is how you reach the other
              ones — by name, which is the only handle anybody actually has on a character. */}
          <div className="ml-auto"><PlayerSearch /></div>
        </div>
        <p className="mb-4 ml-4 max-w-[62ch] text-[13px] text-text-muted">
          Only accounts their owner has shared. Everyone else still counts towards their clan&rsquo;s
          total — a cross-clan table isn&rsquo;t a way around a privacy setting.
        </p>

        {/* THE CHIP-PER-CLAN FILTER IS GONE. It rendered one chip for every clan on the platform,
            which reads fine at three and is a wall at a thousand — and it was answering a question
            two other surfaces answer better: Clan Hall browses every clan, and a clan's own page
            lists its members individually to anyone allowed to read it. What is left here is the one
            thing neither of those does: everybody, in one order. */}

        {players.length === 0 ? (
          <p className="rounded-xl border border-dashed border-card-border px-5 py-8 text-center text-sm text-text-muted">
            {page > 1
              ? 'Nothing on this page — the table ends before here.'
              : 'Nobody has shared an account yet.'}
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
                  {offset + i + 1}
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

        {(page > 1 || hasNext) && (
          <nav className="mt-4 flex items-center justify-between gap-3" aria-label="Player ranking pages">
            {page > 1 ? (
              <ClanLink
                href={href(page - 1)}
                className="rounded-lg border border-card-border px-3 py-1.5 text-[13px] transition-colors hover:border-gold/45 hover:text-gold"
              >
                ← Previous
              </ClanLink>
            ) : (
              <span />
            )}

            {/* The position, not a page count: knowing there are 40 pages helps nobody, and counting
                them costs an aggregate over the whole table to render one number. */}
            <span className="font-mono text-[12px] text-text-dim">
              {offset + 1}–{offset + players.length}
            </span>

            {hasNext && page < MAX_PAGE ? (
              <ClanLink
                href={href(page + 1)}
                className="rounded-lg border border-card-border px-3 py-1.5 text-[13px] transition-colors hover:border-gold/45 hover:text-gold"
              >
                Next →
              </ClanLink>
            ) : (
              <span />
            )}
          </nav>
        )}

        {page >= MAX_PAGE && hasNext && (
          <p className="mt-3 text-center text-[12.5px] text-text-dim">
            The ranking stops here. Past a thousand people you are looking for a name — use the search.
          </p>
        )}
      </section>

      {/* CLANS SECOND, AND ONLY THE TOP OF THEM. A person can be on Anvil without a clan now, so a
          page that opened by measuring clans against each other was telling most new arrivals about
          something they are not part of. Browsing every clan is Clan Hall's job — it is built for it
          and has a search; this is the head of one ranking. */}
      <section className="mt-12">
        <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
          <span className="h-[18px] w-[3px] rounded-sm bg-gold" />
          <h2 className="text-[16.5px] font-semibold">Clans</h2>
          <ClanLink href="/clans" className="ml-auto text-[13px] text-text-muted hover:text-gold">
            Browse every clan →
          </ClanLink>
        </div>
        <p className="mb-4 ml-4 max-w-[62ch] text-[13px] text-text-muted">
          The top {CLANS_SHOWN}, verified and listed. How much a clan gained mostly measures how big
          it is; how much of the roster turned up, and how much of that was bossing, are what make two
          clans of the same size completely different places to be.
        </p>
        <ClanShapes rows={clans} />
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
