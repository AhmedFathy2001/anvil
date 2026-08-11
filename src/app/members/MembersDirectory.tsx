'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { MemberListRow } from '@/lib/memberProfile';

// Filtering happens in the browser, on a list the server already sent whole. A clan is hundreds of
// rows, not thousands of pages — shipping the array once and filtering locally makes search instant
// and costs the database nothing per keystroke, which matters when every clan shares one box.

type Membership = 'all' | 'members' | 'guests';
type SortKey = 'name' | 'ehp' | 'ehb' | 'xp';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'ehp', label: 'EHP' },
  { key: 'ehb', label: 'EHB' },
  { key: 'xp', label: 'Total XP' },
];

function formatXp(xp: number | null): string {
  if (xp === null) return '—';
  if (xp >= 1_000_000_000) return `${(xp / 1_000_000_000).toFixed(2)}B`;
  if (xp >= 1_000_000) return `${(xp / 1_000_000).toFixed(1)}M`;
  if (xp >= 1_000) return `${(xp / 1_000).toFixed(0)}K`;
  return xp.toLocaleString();
}

const formatHours = (h: number | null): string => (h === null ? '—' : h.toFixed(1));

export default function MembersDirectory({ members }: { members: MemberListRow[] }) {
  const [query, setQuery] = useState('');
  const [membership, setMembership] = useState<Membership>('all');
  const [sort, setSort] = useState<SortKey>('name');

  const guestCount = useMemo(() => members.filter((m) => m.isGuest).length, [members]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = members.filter((m) => {
      if (membership === 'members' && m.isGuest) return false;
      if (membership === 'guests' && !m.isGuest) return false;
      if (q && !m.rsn.toLowerCase().includes(q)) return false;
      return true;
    });
    // Nulls last on every numeric sort: a member we haven't swept yet shouldn't outrank someone with
    // a real zero, and shouldn't sit at the top of the board either.
    const byNumber = (a: number | null, b: number | null) => {
      if (a === null && b === null) return 0;
      if (a === null) return 1;
      if (b === null) return -1;
      return b - a;
    };
    return [...filtered].sort((a, b) => {
      if (sort === 'name') return a.rsn.localeCompare(b.rsn);
      if (sort === 'ehp') return byNumber(a.ehp, b.ehp);
      if (sort === 'ehb') return byNumber(a.ehb, b.ehb);
      return byNumber(a.overallXp, b.overallXp);
    });
  }, [members, query, membership, sort]);

  const chip = (active: boolean) =>
    `px-3 py-1.5 text-xs rounded-md border transition-colors ${
      active ? 'bg-gold/20 border-gold text-gold' : 'border-card-border text-text-muted hover:border-gold/50'
    }`;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name…"
          aria-label="Search members by name"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="w-full sm:max-w-xs px-3 py-2 bg-brown-dark border border-card-border rounded-lg text-sm outline-none focus:border-gold/60 placeholder:text-text-muted/60"
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
        <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_5.5rem] sm:grid-cols-[minmax(0,1fr)_7rem_6rem_6rem_7rem] gap-2 px-4 py-2.5 bg-tile-bg text-xs text-text-muted">
          <button type="button" onClick={() => setSort('name')} className={`text-left ${sort === 'name' ? 'text-gold' : 'hover:text-foreground'}`}>
            Player
          </button>
          <span className="hidden sm:block">Rank</span>
          {SORTS.filter((s) => s.key !== 'name').map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSort(s.key)}
              className={`text-right ${sort === s.key ? 'text-gold' : 'hover:text-foreground'}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-text-muted">
            {members.length === 0 ? 'No members yet — sync the roster from the plugin.' : 'Nobody matches that.'}
          </p>
        ) : (
          shown.map((m, i) => (
            <Link
              key={m.id}
              href={`/members/${encodeURIComponent(m.rsn)}`}
              className={`grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_5.5rem] sm:grid-cols-[minmax(0,1fr)_7rem_6rem_6rem_7rem] gap-2 px-4 py-2.5 text-sm items-center hover:bg-brown-light transition-colors ${
                i % 2 ? 'bg-card-bg' : ''
              }`}
            >
              <span className="min-w-0 truncate">
                <span className="text-gold">{m.rsn}</span>
                {m.isGuest && (
                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-text-muted/15 text-text-muted align-middle">
                    guest
                  </span>
                )}
                {m.status !== 'active' && (
                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-300 align-middle">
                    {m.status}
                  </span>
                )}
              </span>
              <span className="hidden sm:block text-text-muted truncate capitalize">{m.rank ?? '—'}</span>
              <span className="text-right tabular-nums text-text-muted">{formatHours(m.ehp)}</span>
              <span className="text-right tabular-nums text-text-muted">{formatHours(m.ehb)}</span>
              <span className="text-right tabular-nums text-text-muted">{formatXp(m.overallXp)}</span>
            </Link>
          ))
        )}
      </div>

      <p className="mt-3 text-xs text-text-muted">
        Showing {shown.length} of {members.length}. Stats come from the last hiscores sweep — a dash
        means we haven&rsquo;t seen that account yet.
      </p>
    </div>
  );
}
