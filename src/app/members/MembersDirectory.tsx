'use client';

import { useMemo, useState } from 'react';
import type { MemberListRow, RosterMovement } from '@/lib/memberProfile';
import ClanLink from '@/components/ClanLink';
import { type MemberSortKey as SortKey, sortMembers } from '@/lib/memberSort';
import Input from '@/components/Input';
import SupporterName from '@/components/SupporterName';
import { BoosterMark } from '@/components/ClanBoost';
import type { SupporterLook } from '@/lib/supporterStyle';

// Filtering happens in the browser, on a list the server already sent whole. A clan is hundreds of
// rows, not thousands of pages — shipping the array once and filtering locally makes search instant
// and costs the database nothing per keystroke, which matters when every clan shares one box.
//
// The row carries movement, not just totals: a sparkline of the last week, the week's gain, the
// streak, and how many places they've climbed. Totals alone tell you who has played the most since
// 2013; these tell you who is playing now, which is the thing a roster is actually checked for.

type Membership = 'all' | 'members' | 'guests';

/** The way each column sorts on first click: names A→Z, everything else highest (or most senior) first. */
const FIRST_DESC: Record<SortKey, boolean> = { name: false, rank: true, week: true, ehp: true, ehb: true, xp: true };

/** Rows are scrollable past this many — the page shouldn't grow a screen per twenty members. */
const VISIBLE_ROWS = 12;
const ROW_PX = 44;

function formatXp(xp: number | null): string {
  if (xp === null) return '—';
  if (xp >= 1_000_000_000) return `${(xp / 1_000_000_000).toFixed(2)}B`;
  if (xp >= 1_000_000) return `${(xp / 1_000_000).toFixed(1)}M`;
  if (xp >= 1_000) return `${(xp / 1_000).toFixed(0)}K`;
  return xp.toLocaleString();
}

const formatHours = (h: number | null): string => (h === null ? '—' : h.toFixed(1));

/** Rank colours by broad tier, so the column reads at a glance instead of as grey text. */
function rankClass(rank: string | null, isGuest: boolean): string {
  if (isGuest || !rank) return 'text-text-muted border-card-border';
  const r = rank.toLowerCase();
  if (/owner|deputy|leader/.test(r)) return 'text-orange-300 border-orange-400/40 bg-orange-400/10';
  if (/captain|general|admin/.test(r)) return 'text-gold-light border-gold/40 bg-gold/10';
  if (/lieutenant|sergeant|corporal|officer|moderator/.test(r)) return 'text-blue-200 border-blue-300/30 bg-blue-300/[0.07]';
  return 'text-foreground/70 border-card-border';
}

/** Seven days of gains as a 108×22 line. Flat when they haven't played — never an empty cell. */
function Spark({ points }: { points: number[] }) {
  const max = Math.max(...points, 0.01);
  const w = 96;
  const h = 20;
  const step = points.length > 1 ? w / (points.length - 1) : w;
  const coords = points.map((v, i) => [2 + i * step, h - 2 - (v / max) * (h - 5)] as const);
  const d = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [lastX, lastY] = coords[coords.length - 1] ?? [w, h];
  const dead = points.every((v) => v === 0);

  return (
    <svg width={w + 4} height={h + 2} viewBox={`0 0 ${w + 4} ${h + 2}`} aria-hidden className="overflow-visible">
      <polyline
        points={d}
        fill="none"
        stroke={dead ? 'var(--tile-border)' : 'var(--gold-dark)'}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastY} r="2.4" fill={dead ? 'var(--tile-border)' : 'var(--gold)'} />
    </svg>
  );
}

function Delta({ places }: { places: number }) {
  // Nothing at all when they haven't moved: a column of dashes reads as broken data, and the whole
  // point of the marker is that it catches the eye when something changed.
  if (places === 0) return null;
  const up = places > 0;
  return (
    <span
      className={`text-[11px] tabular-nums ${up ? 'text-accent-green-light' : 'text-red-400'}`}
      title={`${up ? 'Up' : 'Down'} ${Math.abs(places)} ${Math.abs(places) === 1 ? 'place' : 'places'} since last week`}
    >
      {up ? '▲' : '▼'}
      {Math.abs(places)}
    </span>
  );
}

export default function MembersDirectory({
  members,
  movement,
  rankOrder,
  supporterLooks = {},
  boosters = {},
  initialSort = 'week',
}: {
  /** This clan's boosting characters by name (lib/clanBoosts boosterMarks). */
  boosters?: Record<string, number>;
  members: MemberListRow[];
  movement: Record<number, RosterMovement>;
  /** Ranks most senior first; a rank not on it (or a guest) sorts after every known one. */
  rankOrder: string[];
  /** Supporter look (tier and colours) by roster name; only supporters appear. */
  supporterLooks?: Record<string, SupporterLook>;
  initialSort?: SortKey;
}) {
  const [query, setQuery] = useState('');
  const [membership, setMembership] = useState<Membership>('all');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: initialSort, desc: FIRST_DESC[initialSort] });
  // Click a column to sort by it; click it again to flip the direction.
  const pick = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: FIRST_DESC[key] }));

  const guestCount = useMemo(() => members.filter((m) => m.isGuest).length, [members]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = members.filter((m) => {
      if (membership === 'members' && m.isGuest) return false;
      if (membership === 'guests' && !m.isGuest) return false;
      if (q && !m.rsn.toLowerCase().includes(q)) return false;
      return true;
    });
    return sortMembers(filtered, { key: sort.key, desc: sort.desc, movement, rankOrder });
  }, [members, query, membership, sort, movement, rankOrder]);

  const chip = (active: boolean) =>
    `px-3 py-1.5 text-xs rounded-md border transition-colors ${
      active ? 'bg-gold/20 border-gold text-gold' : 'border-card-border text-text-muted hover:border-gold/50'
    }`;

  const sortable = (key: SortKey, label: string, className = 'text-right') => {
    const on = sort.key === key;
    const way = key === 'name' ? (sort.desc ? 'Z to A' : 'A to Z') : key === 'rank' ? (sort.desc ? 'most senior first' : 'newest ranks first') : sort.desc ? 'highest first' : 'lowest first';
    return (
      <button
        type="button"
        onClick={() => pick(key)}
        aria-label={on ? `${label}, sorted ${way}. Click to reverse.` : `Sort by ${label}`}
        title={on ? `Sorted ${way} — click to reverse` : `Sort by ${label}`}
        className={`${className} ${on ? 'text-gold' : 'hover:text-foreground'}`}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden className={on ? 'opacity-100' : 'opacity-0'}>
            <path d={on && !sort.desc ? 'M4 1.5 7 6H1z' : 'M4 6.5 1 2h6z'} fill="currentColor" />
          </svg>
        </span>
      </button>
    );
  };

  const cols =
    'grid-cols-[minmax(0,1fr)_4.5rem_5.5rem] sm:grid-cols-[minmax(0,1fr)_6.5rem_6.5rem_5.5rem_5rem_5.5rem_4rem]';

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name…"
          aria-label="Search members by name"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="sm:max-w-xs rounded-lg outline-none focus:border-gold/60"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => setMembership('all')} className={chip(membership === 'all')}>
            All {members.length}
          </button>
          <button type="button" onClick={() => setMembership('members')} className={chip(membership === 'members')}>
            Members {members.length - guestCount}
          </button>
          <button
            type="button"
            onClick={() => setMembership('guests')}
            className={chip(membership === 'guests')}
            title="Tracked but not on the in-game roster — they linked an account without a roster sync picking them up."
          >
            Guests {guestCount}
          </button>
        </div>
      </div>

      <div className="border border-card-border rounded-xl overflow-hidden">
        <div
          className={`grid ${cols} gap-2 px-4 py-2.5 bg-tile-bg text-xs text-text-muted`}
        >
          {sortable('name', 'Player', 'text-left')}
          {sortable('rank', 'Rank', 'text-left hidden sm:block')}
          <span className="hidden sm:block">Last 7 days</span>
          {sortable('week', '7d')}
          {sortable('ehp', 'Hours played', 'text-right hidden sm:block')}
          {sortable('ehb', 'Hours bossed', 'text-right hidden sm:block')}
          {sortable('xp', 'XP', 'text-right')}
        </div>

        {shown.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-text-muted">
            {members.length === 0 ? 'No members yet — a clan admin loads the list from the Anvil plugin.' : 'Nobody matches that.'}
          </p>
        ) : (
          // Capped, not endless: a long roster scrolls inside its own frame so the page below stays
          // reachable. Under the cap the container just fits the rows and never scrolls.
          <div
            className="overflow-y-auto"
            style={{ maxHeight: shown.length > VISIBLE_ROWS ? VISIBLE_ROWS * ROW_PX : undefined }}
          >
            {shown.map((m, i) => {
              const mv = movement[m.id];
              return (
                <ClanLink
                  key={m.id}
                  href={`/members/${encodeURIComponent(m.rsn)}`}
                  className={`grid ${cols} gap-2 px-4 py-2.5 text-sm items-center hover:bg-brown-light transition-colors ${
                    i % 2 ? 'bg-card-bg' : ''
                  }`}
                >
                  <span className="min-w-0 truncate flex items-center gap-2">
                    <SupporterName name={m.rsn} tier={supporterLooks[m.rsn]?.tier} style={supporterLooks[m.rsn]?.style} className="text-gold truncate" plain />
                    {boosters[m.rsn] ? <BoosterMark count={boosters[m.rsn]} /> : null}
                    {mv && <Delta places={mv.delta} />}
                    {m.status !== 'active' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-300 shrink-0">
                        {m.status}
                      </span>
                    )}
                    {mv && mv.streak >= 3 && (
                      <span
                        className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded-full border border-orange-400/30 bg-orange-400/10 text-orange-300 tabular-nums shrink-0"
                        title={`${mv.streak} days in a row with a gain`}
                      >
                        {mv.streak}d{mv.streak >= 7 ? ' 🔥' : ''}
                      </span>
                    )}
                  </span>

                  <span className="hidden sm:block">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border capitalize ${rankClass(m.rank, m.isGuest)}`}
                    >
                      {m.isGuest ? 'guest' : (m.rank ?? '—')}
                    </span>
                  </span>

                  <span className="hidden sm:block">{mv ? <Spark points={mv.spark} /> : null}</span>

                  <span className="text-right tabular-nums">
                    {mv && mv.week > 0 ? (
                      <span className="text-accent-green-light">+{mv.week.toFixed(1)}</span>
                    ) : (
                      <span className="text-text-muted/50">—</span>
                    )}
                  </span>

                  <span className="hidden sm:block text-right tabular-nums text-text-muted">{formatHours(m.ehp)}</span>
                  <span className="hidden sm:block text-right tabular-nums text-text-muted">{formatHours(m.ehb)}</span>
                  <span className="text-right tabular-nums text-text-muted">{formatXp(m.overallXp)}</span>
                </ClanLink>
              );
            })}
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-text-muted">
        Showing {shown.length} of {members.length}. Stats come from the latest OSRS Hiscores check — a dash
        means we haven&rsquo;t seen that account yet. <span className="text-foreground/70">7d</span> is
        efficient hours gained this week; ▲▼ is places moved since last week.
      </p>
    </div>
  );
}
