'use client';

import type { CompetitionType } from '@/lib/competitionInsights';
import type { CompetitionEntry, CompetitionHighlight, CompetitionMilestone } from '@/lib/competitionView';
import { dateLabel, exactValue, shortValue } from './format';

/**
 * The standings, the viewer's own place in them, and the week's superlatives.
 *
 * The board keeps everyone — a competition nobody signed up for is one where everyone in the clan
 * is already entered — but each row now carries what it did TODAY and the shape of its week, so the
 * table answers "who's actually still going" without anyone opening a profile.
 */

const MEDALS = ['🥇', '🥈', '🥉'];

// A competition board is every member of the clan who gained anything, which on a big week is
// eighty rows. Past this many it scrolls inside its own frame rather than pushing the milestones
// and records — and everything beside it — off the bottom of the page. Matches the roster
// directory's cap (src/app/members/MembersDirectory.tsx).
const VISIBLE_ROWS = 12;
const ROW_PX = 38;

export function YouStrip({
  me,
  type,
  unit,
  elapsed,
  showDaily,
  started,
}: {
  me: { rank: number; entry: CompetitionEntry; behind: { rsn: string; amount: number } | null };
  type: CompetitionType;
  unit: string;
  elapsed: number;
  /** Whether the week's daily history is complete enough to say anything about your days. */
  showDaily: boolean;
  /** Whether the competition has begun — an unstarted one has no standings to narrate. */
  started: boolean;
}) {
  const { entry, behind, rank } = me;
  const max = Math.max(...entry.days.slice(0, elapsed), 1);
  const activeDays = entry.days.slice(0, elapsed).filter((d) => d > 0).length;
  // A scoreless board has no leader and no gap to draw. Before this, everyone enrolled in a
  // competition that had not started yet was told "You are winning this one" over a full green bar.
  const scored = entry.gained > 0;
  const share = !scored ? 0 : behind ? entry.gained / Math.max(1, entry.gained + behind.amount) : 1;

  return (
    <div className="sticky top-[var(--nav-height)] z-10 mb-6 grid grid-cols-2 items-center gap-5 rounded-xl border border-accent-green/25 bg-gradient-to-r from-accent-green/15 via-card-bg/95 to-card-bg/95 p-3.5 backdrop-blur sm:grid-cols-[auto_auto_minmax(180px,1fr)_auto] sm:gap-6">
      <div className="font-mono text-3xl font-bold leading-none tabular-nums">
        <span className="text-base text-text-muted">#</span>
        {rank}
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2 font-semibold">
          <span className="truncate">{entry.rsn}</span>
          {showDaily &&
            (entry.today > 0 ? (
              <span className="font-mono text-[11px] font-bold text-accent-green-light">▲ {shortValue(entry.today, type)} today</span>
            ) : (
              <span className="font-mono text-[11px] font-bold text-text-muted">quiet today</span>
            ))}
        </div>
        <div className="text-xs text-text-muted">
          {shortValue(entry.gained, type)} {unit}
          {showDaily && (
            <>
              {' '}· {activeDays} of {elapsed} days
              {entry.streak >= 3 && entry.streak === elapsed && <> · 🔥 every day</>}
            </>
          )}
        </div>
      </div>

      <div className="col-span-2 sm:col-span-1">
        <div className="mb-1.5 text-xs text-text-muted">
          {!scored ? (
            <span>{started ? 'Nothing scored yet — first one on the board leads.' : 'Not started yet. You are entered.'}</span>
          ) : behind ? (
            <>
              <span className="font-semibold text-foreground">{shortValue(behind.amount, type)} {unit}</span> behind {behind.rsn}
            </>
          ) : (
            <span className="font-semibold text-gold">You are winning this one.</span>
          )}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full border border-card-border bg-brown-dark">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent-green to-accent-green-light"
            style={{ width: `${Math.max(4, Math.min(99, share * 100))}%` }}
          />
        </div>
      </div>

      {showDaily && (
      <div className="col-span-2 flex h-9 items-end gap-[3px] sm:col-span-1" title="your day by day">
        {entry.days.slice(0, elapsed).map((v, i) => (
          <i
            key={i}
            className={`block w-[7px] rounded-sm ${i === elapsed - 1 ? 'bg-gold-light' : 'bg-accent-green/60'}`}
            style={{ height: `${v > 0 ? Math.max(1, (v / max) * 34) : 1}px` }}
          />
        ))}
      </div>
      )}
    </div>
  );
}

export function Podium({
  entries,
  days,
  elapsed,
  type,
  unit,
  showShape,
}: {
  entries: CompetitionEntry[];
  days: string[];
  elapsed: number;
  type: CompetitionType;
  unit: string;
  /** Share of the week's gains the daily history can account for, 0–1. */
  /** Whether the week's history is complete enough to draw per-player shapes (see lib/competitionInsights). */
  showShape: boolean;
}) {
  const top = entries.slice(0, 3).filter((e) => e.gained > 0);
  if (top.length === 0) return null;

  // ONE scale across the three cards. Normalising each card to its own best day made every podium
  // look the same shape, so a 1M week and an 870K week drew identical bars — and the reader, quite
  // reasonably, read height as size. Shared scale means the bars mean what they look like.
  const scale = Math.max(...top.flatMap((e) => e.days.slice(0, elapsed)), 1);

  // …but a shape drawn from a fraction of the week doesn't just say little, it says the WRONG thing:
  // at 12% coverage third place can own the biggest tracked day and out-draw the leader, flatly
  // contradicting the ranking directly above it. `showShape` is the page's one judgement about that.

  return (
    <div className="mb-7 grid items-end gap-3 sm:grid-cols-3">
      {top.map((e, i) => {
        const first = i === 0;
        const own = Math.max(...e.days.slice(0, elapsed), 0);
        const bestIdx = e.days.slice(0, elapsed).indexOf(own);
        return (
          <div
            key={e.rsn}
            className={`relative overflow-hidden rounded-xl border p-4 ${
              first
                ? 'border-gold/45 bg-card-bg bg-[radial-gradient(120%_100%_at_50%_0%,rgba(212,175,55,0.18),transparent_66%)] py-6'
                : 'border-card-border bg-card-bg'
            } ${e.isMe ? 'ring-1 ring-accent-green/40' : ''}`}
          >
            <span className="absolute right-3.5 top-3.5 text-xl leading-none" aria-hidden>{MEDALS[i]}</span>
            <div className={`font-mono text-xs font-bold tracking-widest ${first ? 'text-gold' : 'text-text-muted'}`}>
              {first ? 'LEADER' : `#${i + 1}`}
            </div>
            <div className={`mt-2 break-words font-extrabold leading-tight ${first ? 'text-xl text-gold-light sm:text-2xl' : 'text-lg'}`}>
              {e.rsn}
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className={`font-mono font-bold leading-none tabular-nums ${first ? 'text-4xl text-gold-light' : i === 1 ? 'text-3xl text-[#cfd3d8]' : 'text-3xl text-[#c8916a]'}`}>
                {shortValue(e.gained, type)}
              </span>
              <span className="text-xs text-text-muted">{unit}</span>
            </div>
            <div className="mt-2.5 flex items-center gap-2.5 text-xs text-text-muted">
              {showShape && own > 0 && (
                <span>
                  best day {days[bestIdx] ? dateLabel(days[bestIdx]) : '—'} · {shortValue(own, type)}
                </span>
              )}
              {e.streak >= 3 && e.streak === elapsed && <span title={`Every day so far (${e.streak})`}>🔥</span>}
              {showShape && (
                <span className="ml-auto flex h-6 items-end gap-[3px]">
                  {e.days.slice(0, elapsed).map((v, k) => (
                    <i
                      key={k}
                      className="block w-2 rounded-sm"
                      style={{
                        height: `${v > 0 ? Math.max(1, (v / scale) * 24) : 1}px`,
                        backgroundColor: v > 0 ? (first ? '#f0c940' : 'rgba(138,126,108,0.6)') : 'rgba(61,50,38,0.9)',
                      }}
                    />
                  ))}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Board({
  entries,
  elapsed,
  type,
  unit,
  showDaily,
}: {
  entries: CompetitionEntry[];
  elapsed: number;
  type: CompetitionType;
  unit: string;
  showDaily: boolean;
}) {
  const max = Math.max(...entries.flatMap((e) => e.days.slice(0, elapsed)), 1);

  return (
    <div>
      <h2 className="mb-4 flex flex-wrap items-center gap-2 text-lg font-bold text-foreground">
        <span className="h-5 w-1 rounded-full bg-gold" />
        Leaderboard
        <span className="text-xs font-normal text-text-muted">
          {entries.length} entered{showDaily && " · today's gain beside each"}
        </span>
      </h2>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-card-border py-10 text-center text-sm text-text-muted">
          No participants yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-card-border">
          <div
            className="overflow-y-auto"
            style={{ maxHeight: entries.length > VISIBLE_ROWS ? VISIBLE_ROWS * ROW_PX : undefined }}
          >
          {entries.map((e, i) => (
            <div
              key={e.rsn}
              className={`grid items-center gap-3 border-b border-card-border/60 px-3 py-2 last:border-b-0 ${
                e.isMe ? 'bg-gradient-to-r from-accent-green/20 to-card-bg shadow-[inset_3px_0_0_#34d058]' : 'bg-card-bg'
              }`}
              style={{
                gridTemplateColumns: showDaily
                  ? '34px minmax(0,1fr) auto auto 34px'
                  : '34px minmax(0,1fr) auto',
              }}
            >
              <span className={`font-mono text-xs ${i < 3 ? 'text-gold' : 'text-text-muted'}`}>
                {i < 3 && e.gained > 0 ? MEDALS[i] : `#${i + 1}`}
              </span>
              <span className="min-w-0 truncate text-sm font-medium">
                {e.rsn}
                {e.flagged && (
                  <span className="ml-1.5 text-[11px] text-amber-300" title={e.flagReason ?? 'Baseline looks stale — an admin should check it'}>
                    ⚠
                  </span>
                )}
                {e.streak >= 3 && e.streak === elapsed && (
                  <span className="ml-1.5 text-[11px]" title={`Scored every day of the competition so far (${e.streak})`}>
                    🔥
                  </span>
                )}
              </span>
              {showDaily && (
                <span className={`text-right font-mono text-[11.5px] ${e.today > 0 ? 'text-accent-green-light' : 'text-text-muted'}`}>
                  {e.today > 0 ? `+${shortValue(e.today, type)}` : '—'}
                </span>
              )}
              <span className="text-right font-mono text-sm font-bold tabular-nums text-accent-green-light" title={`${exactValue(e.gained, type)} ${unit}`}>
                {shortValue(e.gained, type)}
              </span>
              {showDaily && (
                <span className="flex h-4 items-end gap-[1.5px]">
                  {e.days.slice(0, elapsed).map((v, k) => (
                    <i
                      key={k}
                      className={`block w-[3px] rounded-[1px] ${e.isMe ? 'bg-accent-green/70' : 'bg-text-muted/55'}`}
                      style={{ height: `${v > 0 ? Math.max(1, (v / max) * 16) : 1}px` }}
                    />
                  ))}
                </span>
              )}
            </div>
          ))}
          </div>
          {entries.length > VISIBLE_ROWS && (
            <div className="border-t border-card-border/60 bg-brown-dark/40 px-3 py-1.5 text-center text-[11px] text-text-muted">
              scroll for {entries.length - VISIBLE_ROWS} more
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SidePanels({
  milestones,
  highlights,
}: {
  milestones: CompetitionMilestone[];
  highlights: CompetitionHighlight[];
}) {
  return (
    <>
      {/* The week's luck, above its milestones: a pet is the thing people open the page for, and a
          milestone is still true tomorrow. */}
      {highlights.length > 0 && (
        <div className="mt-5 rounded-xl border border-card-border bg-card-bg p-4">
          <h3 className="text-sm font-bold">Moments</h3>
          <p className="mt-0.5 text-xs text-text-muted">
            pets, uniques and deaths from this competition&apos;s own content — reported by the plugin, never scored
          </p>
          <div className="mt-2.5">
            {highlights.map((h) => (
              <div key={h.id} className="flex items-center gap-2.5 border-t border-card-border/60 py-2 text-[12.5px] first:border-t-0">
                <span className="text-base leading-none">{h.emoji}</span>
                <span className="min-w-0 flex-1 text-text-muted">
                  <b className="font-semibold text-foreground">{h.rsn}</b> {h.sentence}
                  {h.detail && <span className="ml-1.5 text-[11px] text-text-muted/80">{h.detail}</span>}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-text-muted">{dateLabel(h.day)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {milestones.length > 0 && (
        <div className="mt-5 rounded-xl border border-card-border bg-card-bg p-4">
          <h3 className="text-sm font-bold">Milestones on this metric</h3>
          <p className="mt-0.5 text-xs text-text-muted">crossed while the competition ran — the clan&apos;s other milestones are on the home page</p>
          <div className="mt-2.5">
            {milestones.map((m, i) => (
              <div key={i} className="flex items-center gap-2.5 border-t border-card-border/60 py-2 text-[12.5px] first:border-t-0">
                <span className="text-base leading-none">{m.emoji}</span>
                <span className="min-w-0 flex-1 text-text-muted">
                  <b className="font-semibold text-foreground">{m.rsn}</b> {m.action}{' '}
                  <b className="font-semibold text-foreground">{m.highlight}</b>
                </span>
                <span className="shrink-0 font-mono text-[11px] text-text-muted">{dateLabel(m.day)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
