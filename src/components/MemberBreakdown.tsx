'use client';

import { useState } from 'react';
import type { MemberContribution } from '@/lib/memberBreakdown';
import { formatContributionAmount } from '@/lib/tileKinds';

// Per-member points/tasks for a team. Points only carry meaning in points-mode events, so that
// column is hidden otherwise. The raw submission count is deliberately not shown — it's dominated
// by kill-count tiles (one submission per kill) and reads as misleading.
//
// Two modes:
//  • selector (onSelect set) — rows pick a member; the parent shows that member's full contributions
//    elsewhere (full width). Used on the team boards where the breakdown and the detail are merged.
//  • inline (no onSelect) — rows expand in place to a compact per-tile list. Used on the admin Stats
//    tab, which has no room for a separate detail panel.
export default function MemberBreakdown({
  members,
  pointsMode,
  selectedPlayerId,
  onSelect,
}: {
  members: MemberContribution[];
  pointsMode: boolean;
  selectedPlayerId?: number | null;
  onSelect?: (playerId: number) => void;
}) {
  const selectable = !!onSelect;
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
        const isSelected = selectable && selectedPlayerId === m.playerId;
        const isOpen = !selectable && open.has(m.playerId);
        const canExpand = m.contributions.length > 0;
        return (
          <li key={m.playerId}>
            <button
              type="button"
              onClick={() => {
                if (selectable) onSelect!(m.playerId);
                else if (canExpand) toggle(m.playerId);
              }}
              aria-expanded={selectable ? undefined : isOpen}
              aria-pressed={selectable ? isSelected : undefined}
              disabled={!selectable && !canExpand}
              className={`w-full flex items-center gap-2 sm:gap-3 py-2 px-1 text-left rounded-md transition-colors disabled:cursor-default ${
                isSelected ? 'bg-gold/10' : selectable ? 'hover:bg-brown-light' : ''
              }`}
            >
              {!selectable && (
                <span
                  className={`text-text-muted text-[10px] w-3 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''} ${canExpand ? '' : 'opacity-0'}`}
                  aria-hidden
                >
                  &#9656;
                </span>
              )}
              <span className="text-xs text-text-muted w-4 shrink-0 text-right tabular-nums">{i + 1}</span>
              <span className={`text-sm font-medium truncate min-w-0 flex-1 ${m.frozenAt ? 'text-text-muted line-through' : ''} ${isSelected ? 'text-gold' : ''}`}>{m.name}</span>
              {m.frozenAt && (
                <span
                  className="text-[10px] text-amber-300/90 border border-amber-300/30 rounded px-1 py-px shrink-0"
                  title="Subbed out — no longer active; their locked contribution still counts unless it was cleared"
                >
                  Subbed out
                </span>
              )}
              {pointsMode && (
                <span className="text-sm font-semibold text-gold shrink-0 tabular-nums">
                  {m.points.toLocaleString()} pts
                </span>
              )}
              <span className="text-xs text-text-muted shrink-0 tabular-nums text-right">
                {m.tasks} done
                {m.inProgress > 0 && <span className="text-yellow-500/80"> · {m.inProgress} wip</span>}
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
                      {formatContributionAmount(c)}
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
