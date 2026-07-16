// One MVP highlight card — the top contributor with their score. Shared across the event scoreboard
// (event-wide + day, with a team chip) and the in-team pages (team + day, no chip). Keeping it in one
// place means every MVP surface stays visually identical apart from the label / emoji / optional team.
export default function MvpHighlight({
  label,
  emoji,
  name,
  points,
  tasks,
  pointsMode,
  teamName,
  teamColor,
}: {
  label: string;
  emoji: string;
  name: string;
  points: number;
  tasks: number;
  pointsMode: boolean;
  teamName?: string;
  teamColor?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gold/30 bg-gradient-to-r from-gold/10 to-transparent p-3 sm:p-4">
      <span className="text-2xl shrink-0" aria-hidden>{emoji}</span>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.18em] text-gold/70">{label}</div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-base sm:text-lg font-bold text-foreground truncate">{name}</span>
          {teamName && (
            <span className="inline-flex items-center gap-1 text-xs text-text-muted">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: teamColor }} aria-hidden />
              {teamName}
            </span>
          )}
        </div>
      </div>
      <div className="ml-auto text-right shrink-0">
        {pointsMode ? (
          <>
            <div className="text-lg sm:text-xl font-bold text-gold tabular-nums">{points.toLocaleString()} pts</div>
            <div className="text-xs text-text-muted tabular-nums">{tasks} task{tasks !== 1 ? 's' : ''}</div>
          </>
        ) : (
          <div className="text-lg sm:text-xl font-bold text-gold tabular-nums">{tasks} task{tasks !== 1 ? 's' : ''}</div>
        )}
      </div>
    </div>
  );
}
