'use client';

import { useState } from 'react';

interface Team {
  id: number;
  name: string;
  color: string;
}

interface Props {
  teams: Team[];
  currentOrder: number[];
  onSave: (order: number[]) => void;
  saving: boolean;
}

// The saved order can drift from the live team list (teams deleted or added after it
// was saved). Keep whatever of the saved sequence still applies, drop ghosts, and
// append any team that isn't in it yet so the order always covers every team.
function reconcileOrder(teams: Team[], saved: number[]): number[] {
  const teamIds = new Set(teams.map((t) => t.id));
  const kept = saved.filter((id, i) => teamIds.has(id) && saved.indexOf(id) === i);
  const missing = teams.map((t) => t.id).filter((id) => !kept.includes(id));
  return [...kept, ...missing];
}

export default function DraftOrderSetup({ teams, currentOrder, onSave, saving }: Props) {
  const [order, setOrder] = useState<number[]>(() => reconcileOrder(teams, currentOrder));

  // Re-reconcile when the team set changes while this is on screen (a team added or
  // deleted on the Teams step) — without discarding the admin's unsaved reordering.
  // Render-time adjust (not an effect) per react.dev's "adjusting state when a prop changes".
  const [prevTeams, setPrevTeams] = useState(teams);
  if (teams !== prevTeams) {
    setPrevTeams(teams);
    const next = reconcileOrder(teams, order);
    if (next.length !== order.length || next.some((id, i) => id !== order[i])) setOrder(next);
  }

  function moveUp(index: number) {
    if (index === 0) return;
    const newOrder = [...order];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setOrder(newOrder);
  }

  function moveDown(index: number) {
    if (index === order.length - 1) return;
    const newOrder = [...order];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setOrder(newOrder);
  }

  function randomize() {
    const shuffled = [...order];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setOrder(shuffled);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">Draft Order</h3>
        <button
          onClick={randomize}
          className="text-xs font-medium bg-gold/10 text-gold border border-gold/20 px-2.5 py-1 rounded-lg hover:bg-gold/20 transition-colors"
        >
          Randomize
        </button>
      </div>

      <div className="space-y-1.5 mb-4">
        {order.map((teamId, index) => {
          const team = teams.find((t) => t.id === teamId);
          if (!team) return null;
          return (
            <div
              key={teamId}
              className="flex items-center gap-2 border border-card-border rounded-lg p-2 bg-card-bg"
            >
              <span className="text-xs text-text-muted w-5 text-center font-mono">{index + 1}</span>
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: team.color }}
              />
              <span className="font-medium text-sm flex-1 min-w-0 truncate">{team.name}</span>
              <div className="flex gap-1">
                <button
                  onClick={() => moveUp(index)}
                  disabled={index === 0}
                  className="text-xs text-text-muted hover:text-gold disabled:opacity-30 px-1"
                >
                  ▲
                </button>
                <button
                  onClick={() => moveDown(index)}
                  disabled={index === order.length - 1}
                  className="text-xs text-text-muted hover:text-gold disabled:opacity-30 px-1"
                >
                  ▼
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => onSave(order)}
        disabled={saving}
        className="w-full text-sm font-medium bg-gold/10 text-gold border border-gold/20 px-4 py-2 rounded-lg hover:bg-gold/20 transition-colors disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Draft Order'}
      </button>
    </div>
  );
}
