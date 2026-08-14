'use client';

import { Fragment } from 'react';
import { cn, formatNumber } from '@/lib/utils';
import { isManualOnlyDropTile } from '@/lib/clogManual';

interface Tile {
  id: number;
  position: number;
  label: string;
  icon?: string | null;
  tileType?: string;
  optional?: number | null;
}

interface Completion {
  teamId: number;
  tileId: number;
}

interface Team {
  id: number;
  name: string;
  color: string;
}

interface TileRaceBoardProps {
  tiles: Tile[];
  completions: Completion[];
  teams: Team[];
  /** When set, the board shows a single team's run (its colour, its tokens, its lock state). */
  activeTeamId?: number;
  interactive?: boolean;
  onTileClick?: (tileId: number) => void;
  dropProgress?: Map<number, { current: number; required: number }>;
  statProgress?: Map<number, { current: number; goal: number; statType?: string }>;
  expanded?: boolean;
  matchedTileIds?: Set<number> | null;
}

// How many tiles per row before the track snakes back the other way.
const COLS = 5;

export default function TileRaceBoard({
  tiles,
  completions,
  teams,
  activeTeamId,
  onTileClick,
  dropProgress,
  statProgress,
  expanded,
  matchedTileIds,
}: TileRaceBoardProps) {
  const sortedTiles = [...tiles].sort((a, b) => a.position - b.position);
  const tileIds = new Set(sortedTiles.map((t) => t.id));

  // teamId -> set of completed tile ids (restricted to this event's tiles)
  const teamCompleted = new Map<number, Set<number>>();
  for (const c of completions) {
    if (!tileIds.has(c.tileId)) continue;
    if (!teamCompleted.has(c.teamId)) teamCompleted.set(c.teamId, new Set());
    teamCompleted.get(c.teamId)!.add(c.tileId);
  }

  // The furthest *contiguous* tile a team has reached from the start (its token sits
  // here). -1 means the team is still at the start line. Completions are kept strictly
  // ordered by the API, so this is normally just "(tiles done) − 1".
  function frontierIndex(teamId: number): number {
    const done = teamCompleted.get(teamId);
    if (!done) return -1;
    let f = -1;
    for (let i = 0; i < sortedTiles.length; i++) {
      if (done.has(sortedTiles[i].id)) f = i;
      else break;
    }
    return f;
  }

  const renderedTeams = activeTeamId ? teams.filter((t) => t.id === activeTeamId) : teams;

  // Standings: furthest first, then alphabetical for ties.
  const standings = [...renderedTeams]
    .map((t) => ({ team: t, frontier: frontierIndex(t.id), reached: frontierIndex(t.id) + 1 }))
    .sort((a, b) => b.frontier - a.frontier || a.team.name.localeCompare(b.team.name));

  // Tokens sitting on each tile index, plus those still at the start line.
  const tokensByIndex = new Map<number, Team[]>();
  const tokensAtStart: Team[] = [];
  for (const { team, frontier } of standings) {
    if (frontier < 0) tokensAtStart.push(team);
    else {
      if (!tokensByIndex.has(frontier)) tokensByIndex.set(frontier, []);
      tokensByIndex.get(frontier)!.push(team);
    }
  }

  // Which tiles count as "reached" for fill colour. Single-team view → that team's
  // colour; multi-team → any rendered team has it (neutral gold fill, tokens show who).
  const activeColor = activeTeamId ? renderedTeams[0]?.color : undefined;
  const reachedTileIds = new Set<number>();
  for (const t of renderedTeams) {
    for (const id of teamCompleted.get(t.id) ?? []) reachedTileIds.add(id);
  }
  // For the active single team, the tile right after the frontier is the live target;
  // anything past it is locked until the team gets there.
  const activeFrontier = activeTeamId ? frontierIndex(activeTeamId) : -1;
  const nextIndex = activeTeamId ? activeFrontier + 1 : -1;

  // Chunk into snake rows: odd rows are reversed so the track reads continuously and
  // each row's turn lines up under the previous row's end.
  const rows: { tile: Tile; index: number }[][] = [];
  for (let i = 0; i < sortedTiles.length; i += COLS) {
    const rowNum = i / COLS;
    const chunk = sortedTiles.slice(i, i + COLS).map((tile, j) => ({ tile, index: i + j }));
    rows.push(rowNum % 2 === 1 ? [...chunk].reverse() : chunk);
  }

  const finishIndex = sortedTiles.length - 1;

  return (
    <div
      className={cn(
        'w-full mx-auto p-3 sm:p-4 bg-brown-dark/50 rounded-xl border border-card-border space-y-4',
        expanded ? 'max-w-6xl' : 'max-w-4xl',
      )}
    >
      {/* Standings strip */}
      {standings.length > 0 && (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {standings.map(({ team, reached, frontier }, rank) => {
            const finished = frontier === finishIndex && finishIndex >= 0;
            return (
              <div key={team.id} className="flex items-center gap-2 text-sm">
                <span className="w-5 text-right text-xs text-text-muted tabular-nums">{rank + 1}.</span>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: team.color }} />
                <span className="truncate flex-1 text-foreground/90">{team.name}</span>
                <span className={cn('tabular-nums text-xs', finished ? 'text-gold font-semibold' : 'text-text-muted')}>
                  {finished ? '🏁 finished' : `${reached}/${sortedTiles.length}`}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Start line — only shown while someone is still on it */}
      {tokensAtStart.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span className="px-2 py-1 rounded-md bg-brown-dark/60 border border-card-border font-medium">🏁 Start</span>
          <TokenRow teams={tokensAtStart} />
        </div>
      )}

      {/* Snake track */}
      <div className="space-y-1.5 sm:space-y-2">
        {rows.map((row, r) => {
          const reversed = r % 2 === 1;
          return (
            <div key={r}>
              <div
                className="flex items-stretch gap-0"
                style={{ justifyContent: reversed ? 'flex-end' : 'flex-start' }}
              >
                {row.map(({ tile, index }, i) => {
                  const reached = activeTeamId
                    ? (teamCompleted.get(activeTeamId)?.has(tile.id) ?? false)
                    : reachedTileIds.has(tile.id);
                  const isNext = activeTeamId !== undefined && index === nextIndex;
                  const isLocked = activeTeamId !== undefined && index > nextIndex;
                  const tokens = tokensByIndex.get(index) ?? [];
                  return (
                    <Fragment key={tile.id}>
                      <div className="min-w-0 flex-shrink" style={{ flexBasis: `${100 / COLS}%` }}>
                        <TrackTile
                          tile={tile}
                          seq={index + 1}
                          reached={reached}
                          fillColor={reached ? (activeColor ?? '#d4af37') : undefined}
                          isNext={isNext}
                          isLocked={isLocked}
                          tokens={tokens}
                          onClick={onTileClick ? () => onTileClick(tile.id) : undefined}
                          progress={dropProgress?.get(tile.id)}
                          statProgress={statProgress?.get(tile.id)}
                          dimmed={matchedTileIds ? !matchedTileIds.has(tile.id) : false}
                        />
                      </div>
                      {i < row.length - 1 && (
                        <div className="flex items-center justify-center shrink-0 w-3 sm:w-5 text-text-muted/60 text-xs sm:text-sm">
                          {reversed ? '←' : '→'}
                        </div>
                      )}
                    </Fragment>
                  );
                })}
              </div>
              {r < rows.length - 1 && (
                <div className="flex" style={{ justifyContent: reversed ? 'flex-start' : 'flex-end' }}>
                  <div
                    className="flex items-center justify-center text-text-muted/60 text-xs sm:text-sm"
                    style={{ width: `${100 / COLS}%` }}
                  >
                    ↓
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TokenRow({ teams }: { teams: Team[] }) {
  return (
    <div className="flex items-center -space-x-1">
      {teams.map((t) => (
        <span
          key={t.id}
          className="w-3.5 h-3.5 rounded-full border border-brown-dark"
          style={{ backgroundColor: t.color }}
          title={t.name}
        />
      ))}
    </div>
  );
}

interface TrackTileProps {
  tile: Tile;
  seq: number;
  reached: boolean;
  fillColor?: string;
  isNext: boolean;
  isLocked: boolean;
  tokens: Team[];
  onClick?: () => void;
  progress?: { current: number; required: number };
  statProgress?: { current: number; goal: number; statType?: string };
  dimmed?: boolean;
}

function TrackTile({
  tile,
  seq,
  reached,
  fillColor,
  isNext,
  isLocked,
  tokens,
  onClick,
  progress,
  statProgress,
  dimmed,
}: TrackTileProps) {
  const isDrop = tile.tileType === 'drop' || tile.tileType === 'kill' || tile.tileType === 'lap' || tile.tileType === 'pvp';
  const showDrop = isDrop && progress && progress.current > 0 && !reached;
  const showStat = statProgress && statProgress.current > 0 && !reached;

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'relative w-full aspect-square overflow-hidden rounded-lg border-2 flex flex-col items-center justify-center text-center transition-all duration-200 px-0.5',
        !reached && !isNext && 'bg-tile-bg border-tile-border',
        isNext && !reached && 'bg-gold/10 border-gold/70 shadow-[0_0_10px_rgba(212,175,55,0.25)]',
        isLocked && !reached && 'opacity-40',
        dimmed && 'opacity-30 grayscale',
        onClick && 'cursor-pointer hover:scale-[1.03]',
        !onClick && 'cursor-default',
      )}
      style={
        reached && fillColor
          ? { backgroundColor: fillColor + '22', borderColor: fillColor, boxShadow: `0 0 10px ${fillColor}30` }
          : undefined
      }
      title={tile.label}
    >
      {/* Sequence number */}
      <span className="absolute top-0.5 left-1 text-[8px] sm:text-[10px] font-bold text-text-muted/70 tabular-nums leading-none">
        {seq}
      </span>

      {/* Reached check / locked marker */}
      {reached ? (
        <span
          className="absolute top-0.5 right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex items-center justify-center text-[8px] sm:text-[10px] font-bold"
          style={{ backgroundColor: fillColor, color: '#fff' }}
        >
          ✓
        </span>
      ) : isLocked ? (
        <span className="absolute top-0.5 right-1 text-[8px] sm:text-[10px] text-text-muted/50 leading-none">🔒</span>
      ) : isManualOnlyDropTile(tile) ? (
        <span
          className="absolute top-0.5 right-1 text-[8px] sm:text-[10px] leading-none"
          title="Not auto-tracked by the plugin — submit manually"
        >
          ✋
        </span>
      ) : null}

      {tile.icon && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={tile.icon}
          alt=""
          className={cn('w-6 h-6 sm:w-8 sm:h-8 object-contain drop-shadow-md', reached ? 'opacity-100' : 'opacity-60')}
          loading="lazy"
        />
      )}
      <span
        className={cn(
          'leading-tight font-medium px-0.5 text-[8px] sm:text-[10px]',
          tile.icon ? 'mt-0.5' : '',
          reached ? 'text-foreground' : 'text-text-muted',
        )}
      >
        {tile.label}
      </span>

      {/* Drop progress */}
      {showDrop && progress && (
        <div className="absolute bottom-0 left-0 right-0">
          <div className="text-center text-[7px] sm:text-[9px] text-yellow-400 font-medium leading-none mb-0.5">
            {progress.current}/{progress.required}
          </div>
          <div className="h-1 bg-brown-dark/60 overflow-hidden">
            <div
              className="h-full"
              style={{
                width: `${Math.min(100, (progress.current / progress.required) * 100)}%`,
                background: 'linear-gradient(90deg, #eab308cc, #eab308)',
              }}
            />
          </div>
        </div>
      )}

      {/* Stat progress */}
      {showStat && statProgress && statProgress.goal > 0 && (
        <div className="absolute bottom-0 left-0 right-0">
          <div className="text-center text-[7px] sm:text-[9px] text-blue-400 font-medium leading-none mb-0.5">
            {formatNumber(statProgress.current)}/{formatNumber(statProgress.goal)}
          </div>
          <div className="h-1 bg-brown-dark/60 overflow-hidden">
            <div
              className="h-full"
              style={{
                width: `${Math.min(100, (statProgress.current / statProgress.goal) * 100)}%`,
                background: 'linear-gradient(90deg, #3b82f6cc, #3b82f6)',
              }}
            />
          </div>
        </div>
      )}

      {/* Team tokens parked on this tile */}
      {tokens.length > 0 && !showDrop && !showStat && (
        <div className="absolute bottom-0.5 left-0 right-0 flex items-center justify-center">
          <TokenRow teams={tokens} />
        </div>
      )}
    </button>
  );
}
