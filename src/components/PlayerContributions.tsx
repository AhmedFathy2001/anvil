'use client';

import { useState } from 'react';
import LocalTime from '@/components/LocalTime';

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
}

interface Props {
  submissions: Submission[];
  tiles: Tile[];
  playerName: string;
}

export default function PlayerContributions({ submissions, tiles, playerName }: Props) {
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

  if (submissions.length === 0) {
    return (
      <div className="text-center py-4 text-text-muted text-sm">
        No contributions from {playerName} yet.
      </div>
    );
  }

  const totalAmount = submissions.reduce((sum, s) => sum + s.amount, 0);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-foreground">
        {playerName}&apos;s Contributions ({submissions.length} submissions, {totalAmount} total)
      </h3>
      {Array.from(grouped.entries()).map(([tileId, subs]) => {
        const tile = tileMap.get(tileId);
        const tileTotal = subs.reduce((sum, s) => sum + s.amount, 0);
        const isOpen = expanded.has(tileId);
        return (
          <div key={tileId} className="border border-card-border rounded-lg bg-card-bg">
            <button
              type="button"
              onClick={() => toggle(tileId)}
              aria-expanded={isOpen}
              className="w-full flex items-center gap-2 p-3 text-left"
            >
              <span
                className={`text-text-muted text-[10px] flex-shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                aria-hidden
              >
                &#9656;
              </span>
              {tile?.icon && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tile.icon} alt="" className="w-5 h-5 object-contain" />
              )}
              <span className="text-sm font-medium">{tile?.label || `Tile #${tileId}`}</span>
              <span className="text-xs text-text-muted flex-shrink-0">
                ({subs.length})
              </span>
              <span className="text-xs text-accent-green-light ml-auto flex-shrink-0">
                Total: x{tileTotal}
              </span>
            </button>
            {isOpen && (
            <div className="space-y-1 px-3 pb-3">
              {subs.map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-xs text-text-muted">
                  <span className="text-gold font-medium">x{s.amount}</span>
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
            </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
