'use client';

import { cn } from '@/lib/utils';

interface TileCellProps {
  label: string;
  icon?: string | null;
  completedBy: { teamId: number; teamName: string; color: string }[];
  interactive?: boolean;
  onClick?: () => void;
  size: number;
  tileType?: string;
  progress?: { current: number; required: number };
}

export default function TileCell({ label, icon, completedBy, interactive, onClick, size, tileType, progress }: TileCellProps) {
  const isCompleted = completedBy.length > 0;
  const teamColor = isCompleted ? completedBy[0].color : undefined;
  const isDrop = tileType === 'drop';
  const hasPartialProgress = isDrop && progress && progress.current > 0 && !isCompleted;

  return (
    <button
      onClick={onClick}
      disabled={!interactive && !onClick}
      className={cn(
        'relative flex flex-col items-center justify-center text-center transition-all duration-200',
        'aspect-square overflow-hidden rounded-lg border-2',
        !isCompleted && !hasPartialProgress && 'bg-tile-bg border-tile-border',
        hasPartialProgress && 'bg-yellow-900/10 border-yellow-600/40',
        interactive && !isCompleted && 'cursor-pointer hover:border-gold/60 hover:bg-card-bg-hover hover:scale-[1.03] hover:shadow-lg hover:shadow-gold/5',
        interactive && isCompleted && 'cursor-pointer hover:scale-[1.03] hover:brightness-110',
        !interactive && onClick && 'cursor-pointer hover:border-gold/40 hover:scale-[1.02]',
        !interactive && !onClick && 'cursor-default',
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
      title={isCompleted ? `Completed by: ${completedBy.map((c) => c.teamName).join(', ')}` : label}
    >
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
          size <= 3
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

      {/* Multi-team color bar */}
      {isCompleted && completedBy.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 flex h-1 rounded-b-lg overflow-hidden">
          {completedBy.map((team) => (
            <div
              key={team.teamId}
              className="flex-1"
              style={{ backgroundColor: team.color }}
            />
          ))}
        </div>
      )}
    </button>
  );
}
