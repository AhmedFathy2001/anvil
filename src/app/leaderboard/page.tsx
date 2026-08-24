import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import AnvilMark from '@/components/AnvilMark';
import ClanCrest from '@/components/ClanCrest';
import ClanLink from '@/components/ClanLink';
import { isApexHost } from '@/lib/clanContext';
import { clanStandings, topPlayers, type ClanStanding, type LeaderboardWindow } from '@/lib/clanLeaderboard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Records — Anvil',
  description: 'Clans on Anvil, measured against each other.',
};

const WINDOWS: { key: LeaderboardWindow; label: string }[] = [
  { key: '7d', label: 'This week' },
  { key: '30d', label: '30 days' },
  { key: 'all', label: 'All time' },
];

/**
 * THREE METRICS, and only one of them used to be visible.
 *
 * `clanStandings` has always returned XP, EHP and EHB — the query computes all three — and the page
 * printed XP and a greyed EHP column. Which is a shame, because they say different things: XP is how
 * much was done, EHP how many hours of it, and EHB how much of that was bossing. A clan can lead one
 * and be nowhere on another, and that contrast IS the interesting part of a cross-clan table.
 */
const METRICS = [
  { key: 'xp', label: 'Experience', unit: 'xp', of: (c: ClanStanding) => c.xpGained },
  { key: 'ehp', label: 'Hours played', unit: 'ehp', of: (c: ClanStanding) => c.ehpGained },
  { key: 'ehb', label: 'Hours bossing', unit: 'ehb', of: (c: ClanStanding) => c.ehbGained },
] as const;

type MetricKey = (typeof METRICS)[number]['key'];

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
  const metricKey: MetricKey =
    params.m === 'ehp' || params.m === 'ehb' ? (params.m as MetricKey) : 'xp';
  const metric = METRICS.find((m) => m.key === metricKey)!;

  const [all, players] = await Promise.all([clanStandings(window), topPlayers(window)]);

  // Re-ranked for the chosen metric rather than fetched again — the query already returns all three,
  // and asking Postgres a second time to sort a list of at most fifty rows would be silly.
  const clans = [...all].sort((a, b) => metric.of(b) - metric.of(a));
  const leader = clans.length > 0 ? metric.of(clans[0]) : 0;
  const podium = clans.slice(0, 3);
  const rest = clans.slice(3);
  const playerLeader = players.length > 0 ? players[0].xpGained : 0;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="relative mb-7 overflow-hidden">
        <AnvilMark
          size={190}
          className="pointer-events-none absolute -top-10 right-0 hidden text-gold/[0.04] sm:block"
        />
        <h1 className="display display-lg relative text-[clamp(1.7rem,4vw,2.2rem)] font-semibold">
          Records
        </h1>
        <p className="relative mt-2 max-w-[62ch] text-[14.5px] text-text-muted">
          Every verified clan on Anvil, measured against each other. Totals reward being big — the
          share of a roster that actually played is the number worth reading.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Switch
          options={WINDOWS.map((w) => ({ key: w.key, label: w.label, href: `/leaderboard?w=${w.key}&m=${metricKey}` }))}
          active={window}
        />
        <Switch
          options={METRICS.map((m) => ({ key: m.key, label: m.label, href: `/leaderboard?w=${window}&m=${m.key}` }))}
          active={metricKey}
        />
      </div>

      {clans.length === 0 ? (
        <p className="rounded-xl border border-dashed border-card-border px-5 py-10 text-center text-sm text-text-muted">
          Nothing to show yet. Clans appear here once they are verified and their members start
          reporting through the plugin.
        </p>
      ) : (
        <>
          {/* THE TOP THREE, given room. A leaderboard whose first row looks like its fortieth is a
              table, not a leaderboard — and the gap between first and second is the fact everybody
              actually came to see. */}
          <div className="grid gap-3 sm:grid-cols-3">
            {podium.map((c, i) => (
              <Podium key={c.clanId} clan={c} place={i + 1} metric={metric} leader={leader} />
            ))}
          </div>

          {rest.length > 0 && (
            <ul className="mt-3 divide-y divide-card-border overflow-hidden rounded-xl border border-card-border bg-card-bg">
              {rest.map((c, i) => (
                <Row key={c.clanId} clan={c} place={i + 4} metric={metric} leader={leader} />
              ))}
            </ul>
          )}
        </>
      )}

      <section className="mt-11">
        <div className="mb-2 flex items-center gap-2.5">
          <span className="molten h-5 w-1 shrink-0 rounded-sm" />
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

type Metric = (typeof METRICS)[number];

function Podium({
  clan,
  place,
  metric,
  leader,
}: {
  clan: ClanStanding;
  place: number;
  metric: Metric;
  leader: number;
}) {
  const value = metric.of(clan);
  return (
    <ClanLink
      href={`/c/${clan.slug}`}
      className={`relative overflow-hidden rounded-xl border p-4 transition-colors ${
        place === 1
          ? 'border-gold/45 bg-gold/[0.06] hover:bg-gold/[0.09]'
          : 'border-card-border bg-card-bg hover:border-gold/35 hover:bg-card-bg-hover'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <ClanCrest name={clan.name} size={26} />
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{clan.name}</span>
        <span
          className={`shrink-0 font-mono text-[11px] ${place === 1 ? 'text-gold' : 'text-text-dim'}`}
        >
          #{place}
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-mono text-[26px] tabular-nums leading-none">
          {metric.key === 'xp' ? compact(value) : value.toFixed(1)}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-dim">
          {metric.unit}
        </span>
      </div>

      <Bar value={value} of={leader} lead={place === 1} />

      <div className="mt-2.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-text-dim">
        {clan.actives} of {clan.members} played
      </div>
    </ClanLink>
  );
}

function Row({
  clan,
  place,
  metric,
  leader,
}: {
  clan: ClanStanding;
  place: number;
  metric: Metric;
  leader: number;
}) {
  const value = metric.of(clan);
  return (
    <li>
      <ClanLink
        href={`/c/${clan.slug}`}
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-card-bg-hover sm:px-5"
      >
        <span className="w-6 shrink-0 text-right font-mono text-[11px] tabular-nums text-text-dim">
          {place}
        </span>
        <ClanCrest name={clan.name} size={20} />
        <span className="min-w-0 flex-1 truncate text-[14px]">{clan.name}</span>
        <span className="hidden shrink-0 font-mono text-[11px] text-text-dim sm:block">
          {clan.actives}/{clan.members}
        </span>
        <span className="w-24 shrink-0">
          <Bar value={value} of={leader} />
        </span>
        <span className="w-20 shrink-0 text-right font-mono text-[13px] tabular-nums">
          {metric.key === 'xp' ? compact(value) : value.toFixed(1)}
        </span>
      </ClanLink>
    </li>
  );
}

function Bar({ value, of, lead }: { value: number; of: number; lead?: boolean }) {
  return (
    <span className="mt-2 block h-[5px] overflow-hidden rounded-sm bg-brown-light">
      <span
        className={`block h-full rounded-sm ${
          lead ? 'bg-gradient-to-r from-gold to-gold-light' : 'bg-gradient-to-r from-gold-dark to-gold'
        }`}
        style={{ width: `${pct(value, of)}%` }}
      />
    </span>
  );
}

const pct = (value: number, of: number) => (of > 0 ? Math.max(1, Math.round((value / of) * 100)) : 0);

function compact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}
