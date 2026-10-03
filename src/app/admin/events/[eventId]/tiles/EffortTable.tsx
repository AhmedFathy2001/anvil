'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BalanceCheck } from '@/lib/boardBalance';
import { clanFetch } from '@/lib/clanFetch';
import { useModalA11y } from '@/hooks/useModalA11y';

// The effort side of the balance panel — fetched from the server (drop-rate dataset lives
// there) and refreshed, debounced, whenever the tile set changes. Shows estimated hours as
// a fast/average/slow spread, points-per-hour against the board median, a suggested point
// value, and one-click Apply.

interface EffortTileWire {
  tileId: number;
  label: string;
  weight: number;
  hours: (number | null)[] | null; // [fast, avg, slow]; null entries = that band can't do it
  floor: 'anyone' | 'mid' | 'high' | 'elite';
  difficulty: number;
  skillRating: number | null;
  pricingHours: number | null;
  overlapCreditHours: number;
  rawPtsPerHour: number | null; // points ÷ real hours (throughput)
  ptsPerHour: number | null; // points ÷ effort-hours (difficulty-adjusted — the ranking metric)
  oneOff: boolean;
  suggestedPoints: number | null;
  pClass: 'grind' | 'long-shot' | 'lottery' | 'unreachable' | null;
  note: string | null;
}
interface EffortWire {
  perTile: EffortTileWire[];
  medianPtsPerHour: number | null;
  modelledCount: number;
  unmodelledCount: number;
  eliteShare: number;
  checks: BalanceCheck[];
  revision: string;
}

interface PointChange {
  tileId: number;
  points: number;
}

interface SuggestionReview {
  changes: EffortTileWire[];
  unchanged: EffortTileWire[];
  unmodelled: EffortTileWire[];
  lotteries: EffortTileWire[];
}

const FLOOR_STYLE: Record<EffortTileWire['floor'], string> = {
  anyone: 'bg-accent-green/15 text-accent-green-light',
  mid: 'bg-blue-500/15 text-blue-300',
  high: 'bg-amber-500/15 text-amber-200',
  elite: 'bg-red-500/15 text-red-300',
};

function fmtHours(h: number | null): string {
  if (h == null) return '—';
  if (h < 0.1) return '<0.1h';
  if (h < 10) return `${h.toFixed(1)}h`;
  return `${Math.round(h)}h`;
}

function buildSuggestionReview(tiles: EffortTileWire[]): SuggestionReview {
  const review: SuggestionReview = { changes: [], unchanged: [], unmodelled: [], lotteries: [] };
  for (const tile of tiles) {
    if (tile.pClass === 'lottery') review.lotteries.push(tile);
    else if (tile.suggestedPoints == null) review.unmodelled.push(tile);
    else if (tile.suggestedPoints === tile.weight) review.unchanged.push(tile);
    else review.changes.push(tile);
  }
  return review;
}

function SkippedTiles({
  title,
  detail,
  tiles,
}: {
  title: string;
  detail: string;
  tiles: EffortTileWire[];
}) {
  if (tiles.length === 0) return null;
  return (
    <details className="rounded-lg border border-card-border/60 bg-brown-dark/30 px-3 py-2">
      <summary className="cursor-pointer text-xs text-foreground/90">
        {title} <span className="text-text-muted">({tiles.length})</span>
      </summary>
      <p className="mt-1 text-[11px] leading-relaxed text-text-muted">{detail}</p>
      <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-[11px] text-text-muted">
        {tiles.map((tile) => (
          <li key={tile.tileId} className="flex items-start justify-between gap-3">
            <span className="min-w-0 truncate" title={tile.label}>{tile.label}</span>
            <span className="shrink-0 tabular-nums">{tile.weight} pts</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function SuggestionReviewDialog({
  review,
  revision,
  onClose,
  onApply,
}: {
  review: SuggestionReview;
  revision: string;
  onClose: () => void;
  onApply: (changes: PointChange[], revision: string) => Promise<boolean>;
}) {
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = useCallback(() => {
    if (!applying) onClose();
  }, [applying, onClose]);
  const modalRef = useModalA11y<HTMLDivElement>({ onClose: close });
  const currentTotal = review.changes.reduce((sum, tile) => sum + tile.weight, 0);
  const proposedTotal = review.changes.reduce((sum, tile) => sum + (tile.suggestedPoints ?? 0), 0);
  const skipped = review.unchanged.length + review.unmodelled.length + review.lotteries.length;

  async function applyAll() {
    if (review.changes.length === 0 || applying) return;
    setApplying(true);
    setError(null);
    const ok = await onApply(
      review.changes.map((tile) => ({ tileId: tile.tileId, points: tile.suggestedPoints! })),
      revision,
    );
    setApplying(false);
    if (ok) onClose();
    else setError('Nothing was changed. Fix the reported problem, then reopen this review for fresh suggestions.');
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/75" onClick={close} aria-hidden />
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="point-review-title"
        className="relative flex max-h-[min(90vh,850px)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-card-border bg-card-bg shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-card-border px-4 py-4 sm:px-5">
          <div>
            <h2 id="point-review-title" className="text-base font-bold text-foreground">
              Review all point changes
            </h2>
            <p className="mt-1 text-xs text-text-muted">
              Dry run only — no points change until you apply all {review.changes.length} suggestion{review.changes.length === 1 ? '' : 's'}.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={applying}
            className="shrink-0 rounded-md px-2 py-1 text-lg leading-none text-text-muted hover:bg-brown-light hover:text-foreground disabled:opacity-40"
            aria-label="Close review"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {review.changes.length > 0 ? (
            <>
              <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-text-muted">
                <span><strong className="text-foreground">{review.changes.length}</strong> changes</span>
                <span>Changed-tile total: <strong className="text-foreground">{currentTotal}</strong> → <strong className="text-gold">{proposedTotal}</strong> pts</span>
                <span><strong className="text-foreground">{skipped}</strong> skipped</span>
              </div>
              <div className="overflow-x-auto rounded-lg border border-card-border/70">
                <table className="w-full min-w-[520px] text-xs">
                  <thead className="bg-brown-dark/70 text-[10px] uppercase tracking-wide text-text-muted">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Tile</th>
                      <th className="px-3 py-2 text-right font-semibold">Current</th>
                      <th className="px-3 py-2 text-center font-semibold" aria-label="changes to" />
                      <th className="px-3 py-2 text-right font-semibold">Proposed</th>
                      <th className="px-3 py-2 text-right font-semibold">Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {review.changes.map((tile) => {
                      const delta = tile.suggestedPoints! - tile.weight;
                      return (
                        <tr key={tile.tileId} className="border-t border-card-border/50">
                          <td className="max-w-[28rem] px-3 py-2 text-foreground">
                            <span className="line-clamp-2">{tile.label}</span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-text-muted">{tile.weight}</td>
                          <td className="px-3 py-2 text-center text-text-muted">→</td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums text-gold">{tile.suggestedPoints}</td>
                          <td className={`px-3 py-2 text-right tabular-nums ${delta > 0 ? 'text-accent-green-light' : 'text-red-300'}`}>
                            {delta > 0 ? '+' : ''}{delta}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-accent-green/30 bg-accent-green/10 px-4 py-3 text-sm text-accent-green-light">
              The model has no point changes to apply.
            </div>
          )}

          {skipped > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                Skipped automatically
              </p>
              <div className="space-y-2">
                <SkippedTiles
                  title="Already at the suggestion"
                  detail="These tiles already match the model, so writing them again would only create noise in tile history."
                  tiles={review.unchanged}
                />
                <SkippedTiles
                  title="Unmodelled"
                  detail="These tiles do not have enough measurable time or rate data for a defensible suggestion. Their current points stay untouched."
                  tiles={review.unmodelled}
                />
                <SkippedTiles
                  title="Lottery tiles"
                  detail="Very low-probability RNG tiles are intentionally author-priced jackpots. The model labels them, but never auto-reprices them."
                  tiles={review.lotteries}
                />
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-card-border px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
          <button
            type="button"
            onClick={close}
            disabled={applying}
            className="rounded-lg border border-card-border px-4 py-2 text-sm text-foreground hover:border-gold/40 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void applyAll()}
            disabled={applying || review.changes.length === 0}
            className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brown-dark hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-40"
          >
            {applying ? 'Applying…' : `Apply ${review.changes.length} suggestion${review.changes.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EffortTable({
  eventId,
  pointsMode,
  tilesVersion,
  onChecks,
  onApplyPoints,
  onApplyAllPoints,
}: {
  eventId: number;
  pointsMode: boolean;
  /** Bump to trigger a (debounced) refetch — the parent passes a counter tied to tile edits. */
  tilesVersion: number;
  /** Effort-side checks bubble up so the panel shows one unified checks list. */
  onChecks: (checks: BalanceCheck[]) => void;
  /** Applies a suggested point value; resolves when the tile is saved so we can refetch. */
  onApplyPoints: (tileId: number, points: number) => Promise<boolean>;
  /** Applies the exact reviewed suggestion set in one all-or-nothing request. */
  onApplyAllPoints: (changes: PointChange[], revision: string) => Promise<boolean>;
}) {
  const [report, setReport] = useState<EffortWire | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<number | null>(null);
  const [reviewSnapshot, setReviewSnapshot] = useState<{
    review: SuggestionReview;
    revision: string;
  } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeReview = useCallback(() => setReviewSnapshot(null), []);

  async function refetch() {
    const res = await clanFetch(`/api/admin/events/${eventId}/balance`);
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data = (await res.json()) as EffortWire;
    setReport(data);
    onChecks(data.checks);
    setLoading(false);
  }

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void refetch(), 800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, tilesVersion]);

  if (loading) return <p className="text-xs text-text-muted">Estimating effort…</p>;
  if (!report) return <p className="text-xs text-text-muted">Effort model unavailable.</p>;

  const modelled = report.perTile
    .filter((t) => t.ptsPerHour != null)
    // Grind tiles first (ranked by adjusted throughput), one-offs pooled at the bottom.
    .sort((a, b) => Number(a.oneOff) - Number(b.oneOff) || (b.ptsPerHour ?? 0) - (a.ptsPerHour ?? 0));
  const median = report.medianPtsPerHour;
  const currentReview = buildSuggestionReview(report.perTile);

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">
          Points vs effort{median != null && <> · board median {median.toFixed(1)} adj. pts/h</>}
        </p>
        {pointsMode && (
          <button
            type="button"
            onClick={() => setReviewSnapshot({ review: currentReview, revision: report.revision })}
            className="rounded-lg border border-gold/35 px-3 py-1.5 text-xs font-medium text-gold transition-colors hover:bg-gold/10"
          >
            Review all changes · {currentReview.changes.length}
          </button>
        )}
      </div>
      {modelled.length === 0 ? (
        <p className="text-xs text-text-muted">No tiles could be effort-modelled yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-text-muted">
                <th className="py-1 pr-2 font-semibold">Tile</th>
                <th className="py-1 pr-2 font-semibold">Est. hours (fast–slow)</th>
                <th className="py-1 pr-2 font-semibold">Floor</th>
                {pointsMode && <th className="py-1 pr-2 font-semibold text-right">Pts</th>}
                <th className="py-1 pr-2 font-semibold text-right" title="Raw points per real hour (throughput)">Pts/h</th>
                <th className="py-1 pr-2 font-semibold text-right" title="Points per difficulty-adjusted hour — the fairness metric ranked here">Adj. pts/h</th>
                {pointsMode && <th className="py-1 pr-2 font-semibold text-right">Suggested</th>}
                {pointsMode && <th className="py-1 font-semibold" />}
              </tr>
            </thead>
            <tbody>
              {modelled.map((t) => {
                // One-offs are judged on difficulty, not throughput — never flagged over/under.
                const over = !t.oneOff && median != null && t.ptsPerHour! > median * 3;
                const under = !t.oneOff && median != null && t.ptsPerHour! < median / 3;
                const avg = t.hours?.[1] ?? null;
                return (
                  <tr
                    key={t.tileId}
                    className={`border-t border-card-border/40 ${over ? 'bg-amber-500/5' : under ? 'bg-red-500/5' : ''}`}
                  >
                    <td className="py-1.5 pr-2 max-w-[200px] truncate text-foreground">
                      {t.note && (
                        <span className="text-amber-300/80 mr-1" title={t.note}>⚠</span>
                      )}
                      {t.label}
                    </td>
                    <td className="py-1.5 pr-2 text-text-muted whitespace-nowrap">
                      <span className="text-foreground/90 font-medium">{fmtHours(avg)}</span>
                      <span className="ml-1 opacity-70">({fmtHours(t.hours?.[0] ?? null)}–{fmtHours(t.hours?.[2] ?? null)})</span>
                      {t.overlapCreditHours > 0 && (
                        <span
                          className="ml-1 text-[10px] text-sky-300"
                          title={`${fmtHours(t.overlapCreditHours)} already rewarded by an earlier cumulative tile`}
                        >
                          · price {fmtHours(t.pricingHours)} marginal
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 pr-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${FLOOR_STYLE[t.floor]}`}>{t.floor}</span>
                      {t.skillRating != null && (
                        <span
                          className="ml-1 text-[10px] text-sky-300"
                          title={`Explicit execution rating ${t.skillRating}/5; ${Math.round((t.difficulty - 1) * 100)}% effort premium`}
                        >
                          S{t.skillRating}
                        </span>
                      )}
                    </td>
                    {pointsMode && <td className="py-1.5 pr-2 text-right text-foreground/90">{t.weight}</td>}
                    <td className="py-1.5 pr-2 text-right text-text-muted/80">
                      {t.rawPtsPerHour != null ? t.rawPtsPerHour.toFixed(1) : '—'}
                    </td>
                    <td className={`py-1.5 pr-2 text-right font-medium ${over ? 'text-amber-300' : under ? 'text-red-300' : t.oneOff ? 'text-text-muted' : 'text-foreground/90'}`}>
                      {t.oneOff ? (
                        <span className="text-[10px] uppercase tracking-wide text-text-muted" title="Single completion — scored on difficulty, not throughput">one-off</span>
                      ) : (
                        <>
                          {t.ptsPerHour!.toFixed(1)}
                          {over ? ' ▲' : under ? ' ▼' : ''}
                        </>
                      )}
                    </td>
                    {pointsMode && (
                      <td className="py-1.5 pr-2 text-right text-gold">{t.suggestedPoints ?? '—'}</td>
                    )}
                    {pointsMode && (
                      <td className="py-1.5 text-right">
                        {t.suggestedPoints != null && t.suggestedPoints !== t.weight && (
                          <button
                            disabled={applying === t.tileId}
                            onClick={async () => {
                              setApplying(t.tileId);
                              const ok = await onApplyPoints(t.tileId, t.suggestedPoints!);
                              setApplying(null);
                              if (ok) void refetch();
                            }}
                            className="text-[10px] px-2 py-0.5 rounded border border-gold/30 text-gold hover:bg-gold/15 transition-colors disabled:opacity-50"
                          >
                            {applying === t.tileId ? '…' : 'Apply'}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {report.unmodelledCount > 0 && (
        <p className="text-[10px] text-text-muted mt-2">
          {report.unmodelledCount} tile{report.unmodelledCount === 1 ? '' : 's'} not modelled (manual tiles, gains,
          deathless, values, diaries, or unknown rates) — excluded from the median.
        </p>
      )}
      <p className="text-[10px] text-text-muted mt-1 leading-relaxed">
        Estimates from curated rates (fast / average / slow player) + wiki drop rates — rough by design.
        <span className="text-foreground/80"> Adj. pts/h</span> adds a modest execution premium after
        failures are already priced (explicit S0–S5 = +0–25%); manual person-hours cover bespoke objectives,
        cumulative milestones are priced on added work, and one-off tiles are scored on difficulty alone.
        Override shared rates through <span className="text-gold">balance_rates</span> /{' '}
        <span className="text-gold">raid_luck_rates</span>, or calibrate one tile in its editor.
      </p>
      {reviewSnapshot && (
        <SuggestionReviewDialog
          review={reviewSnapshot.review}
          revision={reviewSnapshot.revision}
          onClose={closeReview}
          onApply={async (changes, revision) => {
            const ok = await onApplyAllPoints(changes, revision);
            if (ok) void refetch();
            return ok;
          }}
        />
      )}
    </div>
  );
}
