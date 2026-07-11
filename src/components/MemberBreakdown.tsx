'use client';

import { useState } from 'react';
import type { MemberContribution } from '@/lib/memberBreakdown';
import { formatTileAmount } from '@/lib/tileKinds';

// Per-member points/tasks for a team, with a drill-down into exactly which tiles each member did.
// Points only carry meaning in points-mode events, so that column is hidden otherwise. The raw
// submission count is deliberately not shown — it's dominated by kill-count tiles (one submission
// per kill) and reads as misleading; the per-tile amounts on expand tell the real story.
export default function MemberBreakdown({
  members,
  pointsMode,
}: {
  members: MemberContribution[];
  pointsMode: boolean;
}) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (id: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const anyContribution = members.some((m) => m.contributions.length > 0);
  if (!anyContribution) {
    return <p className="text-sm text-text-muted py-1">No member contributions yet.</p>;
  }

  return (
    <ul className="divide-y divide-card-border">
      {members.map((m, i) => {
        const isOpen = open.has(m.playerId);
        const canExpand = m.contributions.length > 0;
        return (
          <li key={m.playerId}>
            <button
              type="button"
              onClick={() => canExpand && toggle(m.playerId)}
              aria-expanded={isOpen}
              disabled={!canExpand}
              className="w-full flex items-center gap-2 sm:gap-3 py-2 text-left disabled:cursor-default"
            >
              <span
                className={`text-text-muted text-[10px] w-3 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''} ${canExpand ? '' : 'opacity-0'}`}
                aria-hidden
              >
                &#9656;
              </span>
              <span className="text-xs text-text-muted w-4 shrink-0 text-right tabular-nums">{i + 1}</span>
              <span className="text-sm font-medium truncate min-w-0 flex-1">{m.name}</span>
              {pointsMode && (
                <span className="text-sm font-semibold text-gold shrink-0 tabular-nums">
                  {m.points.toLocaleString()} pts
                </span>
              )}
              <span className="text-xs text-text-muted shrink-0 tabular-nums w-[3.5rem] text-right">
                {m.tasks} task{m.tasks !== 1 ? 's' : ''}
              </span>
            </button>
            {isOpen && canExpand && (
              <ul className="pb-2 pl-9 pr-1 space-y-1">
                {m.contributions.map((c) => (
                  <li key={c.tileId} className="flex items-center gap-2 text-xs">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.completed ? 'bg-accent-green' : 'bg-text-muted/40'}`}
                      aria-hidden
                      title={c.completed ? 'Completed' : 'In progress'}
                    />
                    <span className="truncate min-w-0 flex-1 text-text-muted">{c.label}</span>
                    <span className="shrink-0 text-accent-green-light tabular-nums">
                      {formatTileAmount({ tileType: c.tileType }, c.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
