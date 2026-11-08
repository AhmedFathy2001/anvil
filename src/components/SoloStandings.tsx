'use client';

import { useMemo, useState } from 'react';

import ClanLink from '@/components/ClanLink';
import Input from '@/components/Input';
import type { TeamScore } from '@/lib/boardScoring';
import { competitionRanks, standingsPage, standingsWindow, STANDINGS_PAGE_SIZE } from '@/lib/standingsWindow';

// The standings of a players board — solo placement, or a big board of one-person teams
// (lib/standingsWindow isSoloLike). A card per team is right for six teams and a wall for 170, so
// this is a ranked list: the top five, then the viewer's own line(s) with two either side, and the
// whole field a page at a time behind "View all", searchable by name. Normal team boards keep
// components/Scoreboard.

interface Entrant {
  id: number;
  name: string;
  color: string;
}

interface Row extends Entrant {
  rank: number;
  score: TeamScore;
}

const ZERO: TeamScore = { teamId: 0, boardScore: 0, bonusScore: 0, score: 0, total: 0, unit: 'tiles', pct: 0 };
const MEDALS = ['🥇', '🥈', '🥉'];

export default function SoloStandings({
  teams,
  scores,
  eventId,
  pointsMode,
  myTeamIds = [],
}: {
  teams: Entrant[];
  /** Per-team scores from lib/boardScoring, the same the cards use. */
  scores: Map<number, TeamScore>;
  eventId: number;
  pointsMode?: boolean;
  /** The viewer's own entrants (one per account of theirs on the board). */
  myTeamIds?: number[];
}) {
  // Ranked once: best first, ties share a rank and read by name (the plugin's order too).
  const rows = useMemo<Row[]>(() => {
    const scoreOf = (t: Entrant) => scores.get(t.id) ?? ZERO;
    const sorted = [...teams].sort(
      (a, b) => scoreOf(b).score - scoreOf(a).score || a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }),
    );
    const rank = competitionRanks(sorted, (t) => scoreOf(t).score);
    return sorted.map((t) => ({ ...t, rank: rank.get(t) ?? sorted.length, score: scoreOf(t) }));
  }, [teams, scores]);
  const mine = useMemo(() => new Set(myTeamIds), [myTeamIds]);
  const cut = useMemo(() => standingsWindow(rows, (r) => mine.has(r.id)), [rows, mine]);

  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const paged = standingsPage(rows, (r) => r.name, { page, query, pageSize: STANDINGS_PAGE_SIZE });

  if (rows.length === 0) return <p className="py-8 text-center text-text-muted">Nobody has joined yet.</p>;

  return (
    <div>
      <p className="mb-3 text-xs text-text-muted">
        {rows.length.toLocaleString()} players, each on their own
      </p>
      <div className="overflow-hidden rounded-xl border border-card-border">
        {cut.parts.map((part, i) =>
          part.kind === 'gap' ? (
            <button
              key={`gap-${i}`}
              type="button"
              onClick={() => setShowAll(true)}
              className="block w-full border-b border-card-border/60 bg-brown-dark/40 px-3 py-1.5 text-center text-[11px] text-text-muted transition-colors last:border-b-0 hover:text-gold"
            >
              · · · {part.skipped.toLocaleString()} more
            </button>
          ) : (
            part.rows.map((r) => <StandingRow key={r.id} row={r} eventId={eventId} pointsMode={pointsMode} mine={mine.has(r.id)} />)
          ),
        )}
      </div>
      {cut.mineMore > 0 && (
        <p className="mt-1.5 text-[11px] text-text-muted">
          +{cut.mineMore} more of your accounts — find them under View all.
        </p>
      )}

      {!cut.complete && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            aria-expanded={showAll}
            className="text-xs rounded-lg border border-card-border px-3 py-1.5 text-text-muted transition-colors hover:border-gold/50 hover:text-gold"
          >
            {showAll ? 'Hide the full list' : `View all ${rows.length.toLocaleString()} players`}
          </button>
          {showAll && (
            <div className="mt-3">
              <Input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search players by name"
                aria-label="Search players by name"
                className="mb-2"
              />
              {paged.rows.length === 0 ? (
                <p className="rounded-xl border border-dashed border-card-border px-4 py-6 text-center text-xs text-text-muted">
                  No players match &quot;{query.trim()}&quot;.
                </p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-card-border">
                  {paged.rows.map((r) => (
                    <StandingRow key={r.id} row={r} eventId={eventId} pointsMode={pointsMode} mine={mine.has(r.id)} />
                  ))}
                </div>
              )}
              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-text-muted">
                <button
                  type="button"
                  onClick={() => setPage(paged.page - 1)}
                  disabled={paged.page <= 1}
                  className="rounded-lg border border-card-border px-3 py-1.5 transition-colors hover:border-gold/50 hover:text-gold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ‹ Prev
                </button>
                <span>
                  Page {paged.page} of {paged.pages}
                  {query.trim() ? ` · ${paged.matched.toLocaleString()} match${paged.matched === 1 ? '' : 'es'}` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(paged.page + 1)}
                  disabled={paged.page >= paged.pages}
                  className="rounded-lg border border-card-border px-3 py-1.5 transition-colors hover:border-gold/50 hover:text-gold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next ›
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StandingRow({ row, eventId, pointsMode, mine }: { row: Row; eventId: number; pointsMode?: boolean; mine: boolean }) {
  const s = row.score;
  const medal = row.rank <= 3 && s.score > 0 ? MEDALS[row.rank - 1] : null;
  return (
    <ClanLink
      href={`/events/${eventId}/teams/${row.id}`}
      className={`grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 border-b border-card-border/60 px-3 py-2 transition-colors last:border-b-0 hover:bg-card-bg-hover ${
        mine ? 'bg-gradient-to-r from-accent-green/20 to-card-bg shadow-[inset_3px_0_0_#34d058]' : 'bg-card-bg'
      }`}
    >
      <span className="text-center font-mono text-xs text-text-muted">{medal ?? `#${row.rank}`}</span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
          <span className={`truncate ${mine ? 'font-bold' : 'font-medium'}`}>{row.name}</span>
          {mine && <span className="shrink-0 text-[10px] uppercase tracking-wide text-accent-green-light">you</span>}
        </span>
        <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-brown-dark">
          <span className="block h-full rounded-full" style={{ width: `${s.pct}%`, backgroundColor: row.color }} />
        </span>
      </span>
      <span className="whitespace-nowrap text-right">
        <span className="font-mono text-sm font-bold tabular-nums">{s.score.toLocaleString()}</span>
        <span className="text-xs text-text-muted">/{s.total.toLocaleString()}{pointsMode ? ' pts' : ''}</span>
        {s.bonusScore > 0 && <span className="ml-1 text-[10px] text-purple-200">+{s.bonusScore}</span>}
      </span>
    </ClanLink>
  );
}
