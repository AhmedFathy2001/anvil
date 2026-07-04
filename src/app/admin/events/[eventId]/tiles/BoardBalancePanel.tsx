'use client';

import { useMemo } from 'react';
import type { Tile } from '@/lib/types';
import type { TierBand } from '@/lib/tileFilter';
import { analyzeBoard, type BalanceLevel } from '@/lib/boardBalance';
import CollapsibleSection from '@/components/CollapsibleSection';

// "Board balance" — live structural read of the tile set (recomputes as tiles change).
// Phase 1: tier shape, category concentration, kind mix, luck exposure, hygiene checks.
// Phase 2 adds points-per-expected-hour with a fast/average/slow skill spread.

const LEVEL_STYLE: Record<BalanceLevel, { icon: string; cls: string }> = {
  warn: { icon: '⚠', cls: 'border-amber-500/30 bg-amber-500/10 text-amber-200' },
  info: { icon: 'ℹ', cls: 'border-blue-500/30 bg-blue-500/10 text-blue-200' },
  ok: { icon: '✓', cls: 'border-accent-green/30 bg-accent-green/10 text-accent-green-light' },
};

function ShareBar({ label, share, color }: { label: string; share: number; color?: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-28 shrink-0 truncate text-text-muted">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-brown-dark overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(2, Math.round(share * 100))}%`, backgroundColor: color ?? '#eab308' }}
        />
      </div>
      <span className="w-10 shrink-0 text-right font-medium text-foreground/80">{Math.round(share * 100)}%</span>
    </div>
  );
}

export default function BoardBalancePanel({
  tiles,
  pointsMode,
  tierBands,
}: {
  tiles: Tile[];
  pointsMode: boolean;
  tierBands?: TierBand[];
}) {
  const report = useMemo(() => analyzeBoard(tiles, { pointsMode, tierBands }), [tiles, pointsMode, tierBands]);
  if (report.tileCount === 0) return null;

  const warns = report.checks.filter((c) => c.level === 'warn').length;
  const summary =
    warns > 0
      ? `${warns} warning${warns === 1 ? '' : 's'} · ${Math.round(report.luckShare * 100)}% drop RNG`
      : `No warnings · ${Math.round(report.luckShare * 100)}% drop RNG`;

  return (
    <CollapsibleSection title="Board balance" summary={summary} defaultOpen={warns > 0}>
      <div className="px-5 pb-5 space-y-4">
        {/* Checks */}
        <div className="space-y-1.5">
          {report.checks.map((c) => (
            <div key={c.id} className={`text-xs px-3 py-2 rounded-lg border ${LEVEL_STYLE[c.level].cls}`}>
              <span className="font-semibold">{LEVEL_STYLE[c.level].icon} {c.title}</span>
              <span className="block mt-0.5 opacity-80">{c.detail}</span>
            </div>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
          {/* Tier shape (points boards) */}
          {pointsMode && (
            <div>
              <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1.5">
                Tiles per difficulty tier
              </p>
              <div className="space-y-1">
                {report.tierHistogram.map((h) => (
                  <ShareBar
                    key={h.key}
                    label={`${h.label} (${h.tiles})`}
                    share={report.tileCount ? h.tiles / report.tileCount : 0}
                    color={h.color}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Kind mix */}
          <div>
            <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1.5">
              How {pointsMode ? 'points are' : 'the board is'} earned
            </p>
            <div className="space-y-1">
              {report.kindShares.map((k) => (
                <ShareBar key={k.label} label={k.label} share={k.share} />
              ))}
            </div>
          </div>

          {/* Category spread — top slices */}
          {report.categoryShares.length > 0 && (
            <div className="sm:col-span-2">
              <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1.5">
                {pointsMode ? 'Points' : 'Tiles'} by category tag
              </p>
              <div className="space-y-1">
                {report.categoryShares.slice(0, 8).map((c) => (
                  <ShareBar key={c.label} label={c.label} share={c.share} />
                ))}
                {report.categoryShares.length > 8 && (
                  <p className="text-[10px] text-text-muted">+{report.categoryShares.length - 8} more tags</p>
                )}
              </div>
            </div>
          )}
        </div>

        <p className="text-[10px] text-text-muted leading-relaxed">
          Structural checks only — points-per-expected-hour auditing (with fast/average/slow player
          spread and accessibility floors) arrives with the effort model. Multi-tag tiles count toward
          each of their tags; optional tiles are excluded.
        </p>
      </div>
    </CollapsibleSection>
  );
}
