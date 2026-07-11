'use client';

import type { MemberContribution } from '@/lib/memberBreakdown';

// Per-member points/tasks table for a team. Points only carry meaning in points-mode events, so the
// column is hidden otherwise. Every roster member is shown (zero-contribution ones sink to the
// bottom) so it reads as a complete "who did what" for the team.
export default function MemberBreakdown({
  members,
  pointsMode,
}: {
  members: MemberContribution[];
  pointsMode: boolean;
}) {
  const anyContribution = members.some((m) => m.submissions > 0 || m.tasks > 0);
  if (!anyContribution) {
    return <p className="text-sm text-text-muted py-1">No member contributions yet.</p>;
  }
  return (
    <ul className="divide-y divide-card-border">
      {members.map((m, i) => (
        <li key={m.playerId} className="flex items-center gap-2 sm:gap-3 py-2">
          <span className="text-xs text-text-muted w-5 shrink-0 text-right tabular-nums">{i + 1}</span>
          <span className="text-sm font-medium truncate min-w-0 flex-1">{m.name}</span>
          {pointsMode && (
            <span className="text-sm font-semibold text-gold shrink-0 tabular-nums">
              {m.points.toLocaleString()} pts
            </span>
          )}
          <span className="text-xs text-text-muted shrink-0 tabular-nums w-[3.5rem] text-right">
            {m.tasks} task{m.tasks !== 1 ? 's' : ''}
          </span>
          <span className="text-xs text-text-muted/70 shrink-0 tabular-nums w-[3.5rem] text-right hidden sm:inline">
            {m.submissions} sub{m.submissions !== 1 ? 's' : ''}
          </span>
        </li>
      ))}
    </ul>
  );
}
