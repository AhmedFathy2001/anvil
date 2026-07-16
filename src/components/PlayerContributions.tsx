'use client';

import { useState } from 'react';
import LocalTime from '@/components/LocalTime';
import { formatTileAmount, formatContributionAmount } from '@/lib/tileKinds';
import { submissionHasProof } from '@/lib/submissionProof';

interface Submission {
  id: number;
  tileId: number;
  teamId: number;
  playerId: number | null;
  creditPlayerId: number | null;
  amount: number;
  imageUrl: string | null;
  note: string | null;
  createdAt: string;
  uploaderName?: string | null;
  creditPlayerName?: string | null;
}

interface Tile {
  id: number;
  label: string;
  icon?: string | null;
  tileType?: string | null;
}

// Skill/boss tiles are tracked from the hiscores, not submissions — so they never appear in the
// submission list. These carry the member's XP / KC gain toward such a tile (from the member
// breakdown) so the panel shows their skilling and boss-kill contributions too.
interface StatContribution {
  tileId: number;
  label: string;
  tileType?: string | null;
  statType: string | null; // 'skill' | 'boss'
  amount: number; // XP or KC gained
  completed: boolean;
}

interface Props {
  submissions: Submission[];
  tiles: Tile[];
  playerName: string;
  statContributions?: StatContribution[];
}

export default function PlayerContributions({ submissions, tiles, playerName, statContributions = [] }: Props) {
  // Each tile's individual submission rows start collapsed — the header (label + Total) is enough
  // at a glance; click a tile to expand its per-submission breakdown.
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const tileMap = new Map(tiles.map((t) => [t.id, t]));

  // Group by tile
  const grouped = new Map<number, Submission[]>();
  for (const s of submissions) {
    const arr = grouped.get(s.tileId) || [];
    arr.push(s);
    grouped.set(s.tileId, arr);
  }

  // Skill/boss tiles the member gained on — completed first, then by gain size.
  const stats = [...statContributions]
    .filter((c) => c.amount > 0)
    .sort((a, b) => Number(b.completed) - Number(a.completed) || b.amount - a.amount);

  if (submissions.length === 0 && stats.length === 0) {
    return (
      <div className="text-center py-4 text-text-muted text-sm">
        No contributions from {playerName} yet.
      </div>
    );
  }

  const tileCount = grouped.size + stats.length;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-foreground">
        {playerName}&apos;s Contributions{' '}
        <span className="text-text-muted font-normal">
          ({tileCount} tile{tileCount !== 1 ? 's' : ''}
          {submissions.length > 0 && `, ${submissions.length} submission${submissions.length !== 1 ? 's' : ''}`})
        </span>
      </h3>

      {/* Skill XP / boss KC contributions — hiscores-tracked, so no per-submission drill-down. */}
      {stats.map((c) => {
        const tile = tileMap.get(c.tileId);
        const isBoss = c.statType === 'boss';
        return (
          <div key={`stat-${c.tileId}`} className="border border-card-border rounded-lg bg-card-bg">
            <div className="w-full flex items-center gap-2 p-3">
              {tile?.icon && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tile.icon} alt="" className="w-5 h-5 object-contain" />
              )}
              <span className="text-sm font-medium">{c.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${
                  isBoss ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                }`}
              >
                {isBoss ? 'KC' : 'XP'}
              </span>
              {c.completed && <span className="text-accent-green-light text-xs flex-shrink-0">✓</span>}
              <span className="text-xs text-accent-green-light ml-auto flex-shrink-0">
                +{formatContributionAmount(c)}
              </span>
            </div>
          </div>
        );
      })}

      {Array.from(grouped.entries()).map(([tileId, subs]) => {
        const tile = tileMap.get(tileId);
        const tileTotal = subs.reduce((sum, s) => sum + s.amount, 0);
        // A kill-count tile lands one submission per kill with no screenshot — 500 kills would be
        // 500 identical log rows. Only submissions with real proof (an image or a note) are worth
        // listing individually; the rest collapse into one aggregated line. A tile with no proof at
        // all needs no drill-down — its header total already says everything (e.g. "500 kills").
        const proofSubs = subs.filter(submissionHasProof);
        const bareSubs = subs.filter((s) => !submissionHasProof(s));
        const bareTotal = bareSubs.reduce((sum, s) => sum + s.amount, 0);
        const canExpand = proofSubs.length > 0;
        const isOpen = canExpand && expanded.has(tileId);
        const header = (
          <>
            {canExpand ? (
              <span
                className={`text-text-muted text-[10px] flex-shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                aria-hidden
              >
                &#9656;
              </span>
            ) : (
              <span className="w-[10px] flex-shrink-0" aria-hidden />
            )}
            {tile?.icon && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tile.icon} alt="" className="w-5 h-5 object-contain" />
            )}
            <span className="text-sm font-medium">{tile?.label || `Tile #${tileId}`}</span>
            <span className="text-xs text-text-muted flex-shrink-0">({subs.length})</span>
            <span className="text-xs text-accent-green-light ml-auto flex-shrink-0">
              {tile ? formatTileAmount(tile, tileTotal) : `x${tileTotal}`}
            </span>
          </>
        );
        return (
          <div key={tileId} className="border border-card-border rounded-lg bg-card-bg">
            {canExpand ? (
              <button
                type="button"
                onClick={() => toggle(tileId)}
                aria-expanded={isOpen}
                className="w-full flex items-center gap-2 p-3 text-left"
              >
                {header}
              </button>
            ) : (
              <div className="w-full flex items-center gap-2 p-3">{header}</div>
            )}
            {isOpen && (
              <div className="space-y-1 px-3 pb-3">
                {proofSubs.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 text-xs text-text-muted">
                    <span className="text-gold font-medium">{tile ? formatTileAmount(tile, s.amount) : `x${s.amount}`}</span>
                    {s.uploaderName && s.uploaderName !== s.creditPlayerName && (
                      <span className="text-text-muted truncate min-w-0">(uploaded by {s.uploaderName})</span>
                    )}
                    {s.note && <span className="truncate">&mdash; {s.note}</span>}
                    <span className="ml-auto flex-shrink-0">
                      <LocalTime date={s.createdAt} format="date" />
                    </span>
                    {s.imageUrl && (
                      <a
                        href={s.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gold hover:text-gold-light"
                      >
                        img
                      </a>
                    )}
                  </div>
                ))}
                {bareSubs.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-text-muted pt-0.5">
                    <span className="text-gold font-medium">
                      {tile ? formatTileAmount(tile, bareTotal) : `x${bareTotal}`}
                    </span>
                    <span className="truncate">· {bareSubs.length} more without a screenshot</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
