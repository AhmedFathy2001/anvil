'use client';

import { useEffect, useRef, useState } from 'react';
import type { BalanceCheck } from '@/lib/boardBalance';
import { clanFetch } from '@/lib/clanFetch';

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
  rawPtsPerHour: number | null; // points ÷ real hours (throughput)
  ptsPerHour: number | null; // points ÷ effort-hours (difficulty-adjusted — the ranking metric)
  oneOff: boolean;
  suggestedPoints: number | null;
  note: string | null;
}
interface EffortWire {
  perTile: EffortTileWire[];
  medianPtsPerHour: number | null;
  modelledCount: number;
  unmodelledCount: number;
  eliteShare: number;
  checks: BalanceCheck[];
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

export default function EffortTable({
  eventId,
  pointsMode,
  tilesVersion,
  onChecks,
  onApplyPoints,
}: {
  eventId: number;
  pointsMode: boolean;
  /** Bump to trigger a (debounced) refetch — the parent passes a counter tied to tile edits. */
  tilesVersion: number;
  /** Effort-side checks bubble up so the panel shows one unified checks list. */
  onChecks: (checks: BalanceCheck[]) => void;
  /** Applies a suggested point value; resolves when the tile is saved so we can refetch. */
  onApplyPoints: (tileId: number, points: number) => Promise<boolean>;
}) {
  const [report, setReport] = useState<EffortWire | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  return (
    <div>
      <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1.5">
        Points vs effort{median != null && <> · board median {median.toFixed(1)} adj. pts/h</>}
      </p>
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
                    </td>
                    <td className="py-1.5 pr-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${FLOOR_STYLE[t.floor]}`}>{t.floor}</span>
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
        <span className="text-foreground/80"> Adj. pts/h</span> weights each hour by difficulty (elite ≈ 4× anyone),
        so hard content isn&apos;t judged like a grind; one-off tiles are scored on difficulty alone.
        Override any rate via the <span className="text-gold">balance_rates</span> setting.
      </p>
    </div>
  );
}
