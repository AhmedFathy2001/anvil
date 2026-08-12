'use client';

import Link from 'next/link';
import { Bar } from '@/components/stats/Charts';
import type { ClanActivityAnalytics } from '@/lib/memberProfile';

// The clan's clues, minigames and collection logs — the side of the hiscores that isn't XP or KC,
// and the side people actually tease each other about. All of it comes off the compact activity map
// the sweep derives per member, so this is one narrow query no matter how big the roster gets.

/** Big round numbers read better shortened; exact ones are on the profiles. */
function short(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}

function Total({ value, label }: { value: number; label: string }) {
  return (
    <div className="border border-card-border rounded-xl bg-card-bg px-4 py-3">
      <div className="text-xl font-bold text-gold tabular-nums">{short(value)}</div>
      <div className="text-[11px] uppercase tracking-widest text-text-muted mt-0.5">{label}</div>
    </div>
  );
}

export default function ClanActivities({ activities }: { activities: ClanActivityAnalytics }) {
  const { totals, clueMix, titles, boards, tracked } = activities;

  // Nothing to show until the sweep has derived at least one member's activities. Saying so beats
  // rendering a wall of zeroes that reads like the clan has never opened a clue.
  if (tracked === 0) {
    return (
      <div className="border border-card-border rounded-xl bg-card-bg p-6 mb-8 text-center">
        <p className="text-sm text-text-muted">
          Clue, minigame and collection-log numbers appear here once the next hiscores sweep runs.
        </p>
      </div>
    );
  }

  const maxTier = Math.max(...clueMix.map((c) => c.count), 1);
  const anyClues = clueMix.some((c) => c.count > 0);

  return (
    <div className="mb-8">
      {/* No heading: the tab this sits behind already names it, and repeating that immediately
          under the tab strip reads as a mistake. */}
      <p className="text-sm text-text-muted mb-4">
        Everything on the hiscores that isn&apos;t experience or a boss kill, added up across{' '}
        {tracked} tracked {tracked === 1 ? 'member' : 'members'}.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Total value={totals.caskets} label="caskets opened" />
        <Total value={totals.clogSlots} label="log slots filled" />
        <Total value={totals.rifts} label="rifts closed" />
        <Total value={totals.glory} label="colosseum glory" />
      </div>

      {titles.length > 0 && (
        <div className="border border-card-border rounded-xl bg-card-bg p-4 mb-4">
          <div className="text-[11px] uppercase tracking-widest text-text-muted mb-3">
            Who holds what
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {titles.map((t) => (
              <Link
                key={t.key}
                href={`/members/${encodeURIComponent(t.rsn)}`}
                className="flex items-center gap-3 rounded-lg border border-card-border px-3 py-2 hover:border-gold/50 transition-colors"
              >
                <span className="text-xl shrink-0" aria-hidden>
                  {t.emoji}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-gold truncate">{t.title}</span>
                  <span className="block text-xs text-text-muted truncate">
                    {t.rsn} · {t.value}
                  </span>
                  <span className="block text-[11px] text-text-muted/70 truncate">{t.blurb}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        {anyClues && (
          <div className="border border-card-border rounded-xl bg-card-bg p-4">
            <div className="text-[11px] uppercase tracking-widest text-text-muted mb-3">
              Caskets by tier
            </div>
            <div className="space-y-2">
              {clueMix.map((tier) => (
                <div
                  key={tier.key}
                  className="grid grid-cols-[4.5rem_minmax(0,1fr)_4.5rem] items-center gap-3 text-sm"
                >
                  <span className="text-text-muted">{tier.label}</span>
                  <Bar value={tier.count} max={maxTier} muted={tier.count === 0} />
                  <span className="text-right tabular-nums text-text-muted">
                    {tier.count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {boards.map((board) => {
          const top = board.rows[0];
          const max = Math.max(...board.rows.map((r) => r.score), 1);
          return (
            <div key={board.key} className="border border-card-border rounded-xl bg-card-bg p-4">
              <div className="text-[11px] uppercase tracking-widest text-text-muted mb-3">
                {board.label}
              </div>
              <div className="space-y-2">
                {board.rows.map((row, i) => (
                  <Link
                    key={row.rsn}
                    href={`/members/${encodeURIComponent(row.rsn)}`}
                    className="grid grid-cols-[1.25rem_minmax(0,1fr)_minmax(0,6rem)_4rem] items-center gap-2 text-sm hover:text-gold"
                  >
                    <span className="text-text-muted/60 tabular-nums">{i + 1}</span>
                    <span className="truncate">{row.rsn}</span>
                    {/* A rank board has no meaningful bar — position 1 against position 40,000 is
                        not a length anyone can read — so only counts get one. */}
                    {board.scale === 'count' ? (
                      <Bar value={row.score} max={max} />
                    ) : (
                      <span />
                    )}
                    <span className="text-right tabular-nums text-text-muted">
                      {board.scale === 'rank'
                        ? `#${(row.rank ?? 0).toLocaleString()}`
                        : row.score.toLocaleString()}
                    </span>
                  </Link>
                ))}
              </div>
              {top && board.rows.length > 1 && board.scale === 'count' && (
                <p className="mt-3 pt-3 border-t border-card-border text-[11px] text-text-muted">
                  {top.rsn} has{' '}
                  {/* The gap to second place is the line that makes a leaderboard worth reading. */}
                  {(top.score / Math.max(board.rows[1].score, 1)).toFixed(1)}× the runner-up
                  {board.unit ? ` ${board.unit}` : ''}.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
