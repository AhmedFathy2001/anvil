import LocalTime from '@/components/LocalTime';
import type { StandingsCurtainInfo } from '@/lib/standingsVisibility';

/**
 * What sits where the leaderboard would be while the host keeps the standings hidden
 * (lib/standingsVisibility). Says when they come back, and that the viewer's own team is still theirs
 * to follow — the point of the curtain is the race, not keeping a player from their own progress.
 */
export default function StandingsHiddenNotice({
  curtain,
  ownTeamNames = [],
  className = '',
}: {
  curtain: Pick<StandingsCurtainInfo, 'revealAt' | 'mode'>;
  ownTeamNames?: string[];
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-dashed border-gold/30 bg-gold/5 p-5 ${className}`}>
      <p className="flex items-center gap-2 font-semibold text-foreground">
        <span aria-hidden>🙈</span>
        {curtain.mode === 'at-date' && curtain.revealAt ? (
          <span>
            Standings are hidden until <LocalTime date={curtain.revealAt} />
          </span>
        ) : (
          <span>Standings are hidden until the end of the event</span>
        )}
      </p>
      <p className="mt-1 text-sm text-text-muted">
        {ownTeamNames.length > 0
          ? `You can still follow ${ownTeamNames.join(' and ')}'s own progress. Other teams' scores come back when the standings are revealed.`
          : 'The hosts are keeping the race a secret for now. Team scores and progress come back when the standings are revealed.'}
      </p>
    </div>
  );
}
