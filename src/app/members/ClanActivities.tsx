'use client';

import type { ClanActivityAnalytics } from '@/lib/memberProfile';
import ClanLink from '@/components/ClanLink';

// The clan's clues, minigames and collection logs — the side of the hiscores that isn't XP or KC,
// and the side people actually tease each other about. All of it comes off the compact activity map
// the sweep derives per member, so this is one narrow query no matter how big the roster gets.
//
// Titles are drawn as medals rather than list rows because that's what they are: one per activity,
// held until somebody takes it off you. The clue tiers collapse into a single stacked bar — the
// SHAPE of a clan's clue habit is the readable fact, and six near-identical bar rows buried it.

/** Emoji per title key, kept here (display) rather than in the analytics builder (data). */
const TITLE_ART: Record<string, string> = {
  cluesAll: '🗺️',
  cluesMaster: '👑',
  collectionsLogged: '📕',
  colosseumGlory: '⚔️',
  riftsClosed: '🌀',
  soulWarsZeal: '💀',
  lastManStanding: '🎯',
  bhHunter: '🩸',
};

/** Beginner → master, darkest to brightest: the ramp says "harder" without a legend. */
const TIER_SHADES = ['#4a3d2e', '#6b5423', '#8a6d1b', '#b08a1c', '#d4a017', '#f0c940'];

/** Boards scroll past this many rows rather than stretching the page. */
const BOARD_ROWS = 8;

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

function SectionHead({ title, aside }: { title: string; aside?: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-3">
      <span className="w-1 h-5 bg-gold rounded-full shrink-0" aria-hidden />
      <h3 className="font-bold">{title}</h3>
      {aside && <span className="text-xs text-text-muted">{aside}</span>}
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

  const clueTotal = clueMix.reduce((sum, t) => sum + t.count, 0);

  return (
    <div className="mb-8 space-y-8">
      {/* No heading on the page: the tab this sits behind already names it. */}
      <div>
        <p className="text-sm text-text-muted mb-4">
          Everything on the hiscores that isn&apos;t experience or a boss kill, added up across{' '}
          {tracked} tracked {tracked === 1 ? 'member' : 'members'}.
        </p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Total value={totals.caskets} label="caskets opened" />
          <Total value={totals.clogSlots} label="log slots filled" />
          <Total value={totals.rifts} label="rifts closed" />
          <Total value={totals.glory} label="colosseum glory" />
        </div>
      </div>

      {titles.length > 0 && (
        <div>
          <SectionHead title="Who holds what" aside="one per activity, held until someone takes it" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {titles.map((t) => (
              <ClanLink
                key={t.key}
                href={`/members/${encodeURIComponent(t.rsn)}`}
                className="border border-card-border rounded-xl bg-card-bg p-4 text-center hover:border-gold/50 transition-colors group"
              >
                <span
                  className="w-13 h-13 mx-auto mb-2.5 grid place-items-center rounded-full text-2xl border border-gold-dark"
                  style={{
                    width: '3.25rem',
                    height: '3.25rem',
                    background:
                      'radial-gradient(circle at 32% 28%, rgba(240,201,64,.28), rgba(138,109,27,.16))',
                  }}
                  aria-hidden
                >
                  {TITLE_ART[t.key] ?? '🏅'}
                </span>
                <span className="block text-sm font-bold text-gold">{t.title}</span>
                <span className="block text-sm truncate group-hover:text-gold transition-colors">{t.rsn}</span>
                <span className="block text-[11px] text-text-muted mt-0.5 tabular-nums">{t.value}</span>
                <span className="block text-[11px] text-text-muted/70">{t.blurb}</span>
              </ClanLink>
            ))}
          </div>
        </div>
      )}

      {clueTotal > 0 && (
        <div>
          <SectionHead title="Caskets by tier" aside={`${clueTotal.toLocaleString()} opened clan-wide`} />
          <div
            className="flex h-8 rounded-lg overflow-hidden border border-card-border"
            role="img"
            aria-label={clueMix
              .map((t) => `${t.label}: ${t.count.toLocaleString()}`)
              .join(', ')}
          >
            {clueMix.map((tier, i) => {
              const pct = (tier.count / clueTotal) * 100;
              if (pct <= 0) return null;
              return (
                <span
                  key={tier.key}
                  className="h-full"
                  style={{ width: `${pct}%`, background: TIER_SHADES[i] ?? TIER_SHADES[0] }}
                  title={`${tier.label} · ${tier.count.toLocaleString()}`}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3 text-xs text-text-muted">
            {clueMix.map((tier, i) => (
              <span key={tier.key} className="inline-flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-sm inline-block"
                  style={{ background: TIER_SHADES[i] ?? TIER_SHADES[0] }}
                  aria-hidden
                />
                {tier.label}{' '}
                <span className={`tabular-nums ${tier.count > 0 ? 'text-foreground/80' : 'text-text-muted/50'}`}>
                  {tier.count.toLocaleString()}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {boards.length > 0 && (
        <div>
          <SectionHead
            title="Boards"
            aside="counts rank high-to-low; hiscores positions rank low-to-high"
          />
          <div className="grid lg:grid-cols-2 gap-4">
            {boards.map((board) => {
              const top = board.rows[0];
              const max = Math.max(...board.rows.map((r) => r.score), 1);
              return (
                <div key={board.key} className="border border-card-border rounded-xl bg-card-bg p-4">
                  <div className="flex items-baseline justify-between gap-3 mb-3">
                    <span className="text-[11px] uppercase tracking-widest text-text-muted">
                      {board.label}
                    </span>
                    <span className="text-[10px] text-text-muted/70 uppercase tracking-widest">
                      {board.scale === 'rank' ? 'hiscores rank' : 'count'}
                    </span>
                  </div>
                  <div
                    className="space-y-2 overflow-y-auto pr-1"
                    style={{ maxHeight: board.rows.length > BOARD_ROWS ? BOARD_ROWS * 30 : undefined }}
                  >
                    {board.rows.map((row, i) => (
                      <ClanLink
                        key={row.rsn}
                        href={`/members/${encodeURIComponent(row.rsn)}`}
                        className="grid grid-cols-[1.25rem_minmax(0,1fr)_minmax(0,6rem)_4.5rem] items-center gap-2 text-sm hover:text-gold"
                      >
                        <span className="text-text-muted/60 tabular-nums text-xs">{i + 1}</span>
                        <span className="truncate">{row.rsn}</span>
                        {/* A rank board has no meaningful bar — position 1 against position 40,000 is
                            not a length anyone can read — so only counts get one. */}
                        {board.scale === 'count' ? (
                          <span className="h-1.5 rounded-full bg-tile-bg overflow-hidden">
                            <span
                              className="block h-full rounded-full"
                              style={{
                                width: `${Math.max(4, (row.score / max) * 100)}%`,
                                background:
                                  i === 0
                                    ? 'linear-gradient(90deg, var(--gold-dark), var(--gold-light))'
                                    : 'linear-gradient(90deg, var(--gold-dark), var(--gold))',
                              }}
                            />
                          </span>
                        ) : (
                          <span />
                        )}
                        <span className={`text-right tabular-nums ${i === 0 ? 'text-gold' : 'text-text-muted'}`}>
                          {board.scale === 'rank'
                            ? `#${(row.rank ?? 0).toLocaleString()}`
                            : row.score.toLocaleString()}
                        </span>
                      </ClanLink>
                    ))}
                  </div>

                  {board.scale === 'rank' ? (
                    <p className="mt-3 pt-3 border-t border-card-border text-[11px] text-text-muted">
                      Lower is better — unranked accounts are left out entirely, not sorted last.
                    </p>
                  ) : (
                    top &&
                    board.rows.length > 1 &&
                    // The gap to second place is the line that makes a leaderboard worth reading —
                    // but only when there IS a gap. "1.0× the runner-up" is a sentence about nothing.
                    top.score / Math.max(board.rows[1].score, 1) >= 1.05 && (
                      <p className="mt-3 pt-3 border-t border-card-border text-[11px] text-text-muted">
                        {top.rsn} has {(top.score / Math.max(board.rows[1].score, 1)).toFixed(1)}× the
                        runner-up{board.unit ? ` ${board.unit}` : ''}.
                      </p>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
