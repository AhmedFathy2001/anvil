'use client';

import { cn, formatNumber } from '@/lib/utils';

interface TileCellProps {
  label: string;
  icon?: string | null;
  completedBy: { teamId: number; teamName: string; color: string }[];
  interactive?: boolean;
  onClick?: () => void;
  size: number;
  tileType?: string;
  progress?: { current: number; required: number };
  statProgress?: { current: number; goal: number; statType?: string };
  expanded?: boolean;
  points?: number;
  /** Outside the active board filter — render faded + desaturated to recede. */
  dimmed?: boolean;
  /** Item can't be plugin-drop-tracked (shop/gamble reward) — show a manual-submit marker. */
  manualOnly?: boolean;
  /**
   * Union / spectator view (no single team selected): instead of painting the tile as one team's
   * completion, keep it neutral and show a team-colour dot per completing team. Prevents the
   * "everyone's tiles look completed" read on the public board.
   */
  markersOnly?: boolean;
}

export default function TileCell({ label, icon, completedBy, interactive, onClick, size, tileType, progress, statProgress, expanded, points, dimmed, manualOnly, markersOnly }: TileCellProps) {
  const anyCompleted = completedBy.length > 0;
  // In markers-only mode the tile never takes a team's "completed" fill — the dots carry that info.
  const isCompleted = anyCompleted && !markersOnly;
  const teamColor = isCompleted ? completedBy[0].color : undefined;
  // Drop and kill tiles both show a count-based partial-progress indicator.
  const isDrop = tileType === 'drop' || tileType === 'kill' || tileType === 'pvp';
  const hasPartialProgress = isDrop && progress && progress.current > 0 && !isCompleted;
  const hasStatProgress = statProgress && statProgress.current > 0 && !isCompleted;

  return (
    <button
      onClick={onClick}
      disabled={!interactive && !onClick}
      className={cn(
        'relative flex flex-col items-center justify-center text-center transition-all duration-200',
        'aspect-square overflow-hidden rounded-lg border-2',
        !isCompleted && !hasPartialProgress && !hasStatProgress && 'bg-tile-bg border-tile-border',
        hasPartialProgress && 'bg-yellow-900/10 border-yellow-600/40',
        hasStatProgress && !hasPartialProgress && 'bg-blue-900/10 border-blue-500/40',
        interactive && !isCompleted && 'cursor-pointer hover:border-gold/60 hover:bg-card-bg-hover hover:scale-[1.03] hover:shadow-lg hover:shadow-gold/5',
        interactive && isCompleted && 'cursor-pointer hover:scale-[1.03] hover:brightness-110',
        !interactive && onClick && 'cursor-pointer hover:border-gold/40 hover:scale-[1.02]',
        !interactive && !onClick && 'cursor-default',
        dimmed && 'opacity-30 grayscale',
      )}
      style={
        isCompleted
          ? {
              backgroundColor: teamColor + '18',
              borderColor: teamColor,
              boxShadow: `0 0 12px ${teamColor}30, inset 0 0 20px ${teamColor}10`,
            }
          : undefined
      }
      title={anyCompleted ? `Completed by: ${completedBy.map((c) => c.teamName).join(', ')}` : label}
    >
      {/* Point value badge (points-scoring events) — top-left so it clears the checkmark */}
      {points !== undefined && (
        <div
          className={cn(
            'absolute top-1 left-1 rounded px-1 font-bold leading-none',
            'bg-purple-500/25 text-purple-200 border border-purple-400/30',
            size <= 5 ? 'text-[8px] sm:text-[10px] py-0.5' : 'text-[7px] sm:text-[8px] py-px',
          )}
          title={`${points} point${points !== 1 ? 's' : ''}`}
        >
          {points}
        </div>
      )}

      {/* Manual-only marker — plugin can't drop-track this item. Top-right when free (checkmark
          only shows once completed), so it never overlaps. */}
      {manualOnly && !isCompleted && (
        <div
          className="absolute top-1 right-1 leading-none text-[10px] sm:text-xs"
          title="Not auto-tracked by the plugin — submit manually"
        >
          ✋
        </div>
      )}

      {/* Union/spectator view: a dot per completing team, kept clear of the point (top-left) and
          manual (top-right) corners. Replaces the single-team fill so the board reads per-team. */}
      {markersOnly && anyCompleted && (
        <div className="absolute top-1 left-1/2 -translate-x-1/2 flex -space-x-1">
          {completedBy.slice(0, 5).map((team) => (
            <span
              key={team.teamId}
              className="w-2.5 h-2.5 rounded-full border border-brown-dark"
              style={{ backgroundColor: team.color }}
              title={team.teamName}
            />
          ))}
          {completedBy.length > 5 && (
            <span className="text-[8px] text-text-muted pl-1.5 leading-none self-center">+{completedBy.length - 5}</span>
          )}
        </div>
      )}

      {/* Completed checkmark */}
      {isCompleted && (
        <div
          className="absolute top-1 right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold"
          style={{ backgroundColor: teamColor, color: '#fff' }}
        >
          ✓
        </div>
      )}

      {/* Icon */}
      {icon && (
        <div className={cn(
          'flex-shrink-0',
          size <= 3 ? 'w-10 h-10 sm:w-14 sm:h-14' : size <= 5 ? 'w-7 h-7 sm:w-10 sm:h-10' : 'w-5 h-5 sm:w-7 sm:h-7',
        )}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={icon}
            alt=""
            className={cn(
              'w-full h-full object-contain drop-shadow-md',
              isCompleted ? 'opacity-100' : 'opacity-60',
            )}
            loading="lazy"
          />
        </div>
      )}

      {/* Label */}
      <span
        className={cn(
          'leading-tight font-medium px-0.5',
          icon ? 'mt-0.5' : '',
          expanded
            ? size <= 3
              ? 'text-sm sm:text-base'
              : size <= 5
                ? 'text-xs sm:text-sm'
                : 'text-[10px] sm:text-xs'
            : size <= 3
              ? 'text-[11px] sm:text-sm'
              : size <= 5
                ? 'text-[9px] sm:text-xs'
                : 'text-[7px] sm:text-[9px]',
          isCompleted ? 'text-foreground' : 'text-text-muted',
        )}
      >
        {label}
      </span>

      {/* Drop tile progress indicator */}
      {isDrop && progress && !isCompleted && (
        <div className="absolute bottom-0 left-0 right-0">
          <div className="flex items-center justify-center mb-0.5">
            <span className="text-[8px] sm:text-[10px] text-yellow-400 font-medium">
              {progress.current}/{progress.required}
            </span>
          </div>
          <div className="h-1 bg-brown-dark/60 rounded-b-lg overflow-hidden">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (progress.current / progress.required) * 100)}%`,
                background: 'linear-gradient(90deg, #eab308cc, #eab308)',
              }}
            />
          </div>
        </div>
      )}

      {/* Stat/XP tile progress indicator */}
      {statProgress && statProgress.goal > 0 && !isCompleted && (
        <div className="absolute bottom-0 left-0 right-0">
          <div className="flex items-center justify-center mb-0.5">
            <span className="text-[8px] sm:text-[10px] text-blue-400 font-medium">
              {formatNumber(statProgress.current)}/{formatNumber(statProgress.goal)}
            </span>
          </div>
          <div className="h-1 bg-brown-dark/60 rounded-b-lg overflow-hidden">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (statProgress.current / statProgress.goal) * 100)}%`,
                background: 'linear-gradient(90deg, #3b82f6cc, #3b82f6)',
              }}
            />
          </div>
        </div>
      )}

    </button>
  );
}
