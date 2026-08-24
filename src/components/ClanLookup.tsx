'use client';

import { useMemo, useState } from 'react';

import AnvilMark from '@/components/AnvilMark';
import ClanCrest from '@/components/ClanCrest';
import ClanLink from '@/components/ClanLink';

export interface LookupClan {
  slug: string;
  name: string;
  members: number;
  /** What is running there now, if anything — the one thing worth reading first. */
  doing: string | null;
  /** The viewer's own standing here, so their clans do not offer them a way to apply. */
  seat: 'member' | 'guest' | null;
  /** In-game name proven, so this is the clan it says it is. */
  verified: boolean;
  /** 'approval' | 'open' | 'closed'. */
  guestPolicy: string;
  /** Members who gained anything in seven days. */
  activeThisWeek: number;
  xpThisWeek: number;
}

type Sort = 'active' | 'size' | 'name';

/**
 * Somewhere to play, or somebody to play against.
 *
 * THE QUESTION THIS PAGE ANSWERS is "would I join this clan", and a table of names and member counts
 * answers none of it. A clan with 400 members and nobody playing reads exactly like a clan of 30 who
 * all do — until you can see how many of them moved this week, which is the number that actually
 * separates them.
 *
 * So each clan gets the three facts a stranger weighs: how alive it is, whether it is the clan it
 * says it is, and whether they could get in at all. That last one is only answerable now because the
 * guest policy became something an admin can set.
 *
 * Sorted by ACTIVITY by default, not alphabetically. A directory ordered by name tells you who is
 * called what; ordered by who is playing, the first row is somewhere worth clicking.
 */
export default function ClanLookup({ clans }: { clans: LookupClan[] }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('active');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? clans.filter((c) => c.name.toLowerCase().includes(q) || c.slug.includes(q))
      : clans;
    return [...filtered].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'size') return b.members - a.members || a.name.localeCompare(b.name);
      // Activity, and the share that played breaks the tie — so a small clan that all turned up
      // outranks a large one where the same number did.
      return (
        b.activeThisWeek - a.activeThisWeek ||
        share(b) - share(a) ||
        a.name.localeCompare(b.name)
      );
    });
  }, [clans, query, sort]);

  const busiest = Math.max(1, ...clans.map((c) => c.activeThisWeek));

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="relative mb-6 overflow-hidden">
        <AnvilMark
          size={190}
          className="pointer-events-none absolute -top-10 right-0 hidden text-gold/[0.04] sm:block"
        />
        <h1 className="display display-lg relative text-[clamp(1.7rem,4vw,2.2rem)] font-semibold">
          Find a clan
        </h1>
        <p className="relative mt-2 max-w-[62ch] text-[14.5px] text-text-muted">
          For when you want somewhere to play, or somebody to play against. Joining one never affects
          the others — your account and characters follow you between them.
        </p>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search clans…"
          className="min-w-0 flex-1 rounded-lg border border-card-border bg-card-bg px-3.5 py-2 text-[14px] outline-none transition-colors placeholder:text-text-dim focus:border-gold/45"
        />
        <div className="flex gap-1">
          {(
            [
              ['active', 'Most active'],
              ['size', 'Biggest'],
              ['name', 'A–Z'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSort(key)}
              aria-current={sort === key}
              className={`rounded-md border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors ${
                sort === key
                  ? 'border-gold/30 bg-gold/[0.07] text-gold'
                  : 'border-transparent text-text-muted hover:bg-brown-light hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-card-border px-5 py-10 text-center text-sm text-text-muted">
          {query ? `Nothing matching “${query}”.` : 'No clans are listed yet.'}
        </p>
      ) : (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
          {shown.map((c) => (
            <Card key={c.slug} clan={c} busiest={busiest} />
          ))}
        </div>
      )}

      <p className="mt-6 text-xs text-text-dim">
        Every clan here chose to be listed. A clan that keeps to itself is still reachable by link if
        it allows that — being unlisted is not the same as being private.
      </p>
    </div>
  );
}

function Card({ clan, busiest }: { clan: LookupClan; busiest: number }) {
  const pct = Math.round((clan.activeThisWeek / busiest) * 100);

  return (
    <ClanLink
      href={`/c/${clan.slug}`}
      className="flex flex-col rounded-xl border border-card-border bg-card-bg p-4 transition-colors hover:border-gold/40 hover:bg-card-bg-hover"
    >
      <div className="flex items-start gap-3">
        <ClanCrest name={clan.name} size={34} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-[15.5px] font-medium">{clan.name}</span>
            {clan.verified && (
              // The badge means the in-game name is proven — the thing that stops somebody
              // registering a famous clan's name and collecting its members.
              <span
                title="In-game name verified"
                className="shrink-0 rounded border border-accent-green/35 bg-accent-green/10 px-1.5 py-px font-mono text-[9px] uppercase tracking-[0.1em] text-accent-green-light"
              >
                Verified
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-[12.5px] text-text-dim">
            {clan.members} member{clan.members === 1 ? '' : 's'}
            {clan.seat && <> · you&rsquo;re a {clan.seat}</>}
          </span>
        </span>
      </div>

      {/* WHAT IS HAPPENING, given the most room. Everything else on this card is context for it. */}
      <div className="mt-3.5 min-h-[38px]">
        {clan.doing ? (
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-green-light" />
            <span className="min-w-0 truncate text-[13.5px]">{clan.doing}</span>
          </span>
        ) : (
          <span className="text-[13px] text-text-dim">Nothing running right now</span>
        )}
      </div>

      <div className="mt-auto pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-text-dim">
            {clan.activeThisWeek} of {clan.members} played this week
          </span>
          {clan.xpThisWeek > 0 && (
            <span className="font-mono text-[11.5px] tabular-nums text-text-muted">
              {compact(clan.xpThisWeek)} xp
            </span>
          )}
        </div>
        <span className="mt-1.5 block h-[5px] overflow-hidden rounded-sm bg-brown-light">
          <span
            className="block h-full rounded-sm bg-gradient-to-r from-gold-dark to-gold"
            style={{ width: `${pct}%` }}
          />
        </span>

        {/* CAN I EVEN GET IN. Only worth saying to somebody who is not already here — a member does
            not need telling that the door is open. */}
        {!clan.seat && (
          <span className="mt-2.5 block text-[12px] text-text-dim">{doorway(clan.guestPolicy)}</span>
        )}
      </div>
    </ClanLink>
  );
}

/** What the guest policy means to somebody standing outside. */
function doorway(policy: string): string {
  if (policy === 'open') return 'Anyone can join';
  if (policy === 'closed') return 'Not taking guests';
  return 'Takes guests by approval';
}

const share = (c: LookupClan) => (c.members > 0 ? c.activeThisWeek / c.members : 0);

function compact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}
