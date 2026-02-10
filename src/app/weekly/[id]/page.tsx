import { db } from '@/db';
import { weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { computeLeaderboard } from '@/lib/weekly';
import { SKILL_LABELS, BOSSES } from '@/lib/constants';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

function getMetricLabel(type: string, metric: string): string {
  if (type === 'skill') return SKILL_LABELS[metric] || metric;
  const boss = BOSSES.find((b) => b.key === metric);
  return boss?.label || metric;
}

function formatValue(value: number, type: string): string {
  if (type === 'skill') {
    // Format XP nicely
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toLocaleString();
  }
  return value.toLocaleString();
}

export default async function WeeklyLeaderboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const compId = parseInt(id, 10);

  const comp = await db.select().from(weeklyCompetitions).where(eq(weeklyCompetitions.id, compId));
  if (comp.length === 0) {
    notFound();
  }

  const competition = comp[0];
  const participants = await db.select().from(weeklyParticipants)
    .where(eq(weeklyParticipants.competitionId, compId));

  const leaderboard = computeLeaderboard(participants);

  const gainLabel = competition.type === 'skill' ? 'XP Gained' : 'KC Gained';

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/weekly"
          className="text-sm text-text-muted hover:text-gold transition-colors mb-2 inline-block"
        >
          &larr; All Competitions
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-gold">{competition.title}</h1>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gold/15 text-gold">
            {competition.type === 'skill' ? 'Skill' : 'Boss'}: {getMetricLabel(competition.type, competition.metric)}
          </span>
          <span
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
              competition.status === 'active'
                ? 'bg-accent-green/15 text-accent-green-light'
                : competition.status === 'upcoming'
                  ? 'bg-blue-500/15 text-blue-400'
                  : 'bg-text-muted/15 text-text-muted'
            }`}
          >
            {competition.status.charAt(0).toUpperCase() + competition.status.slice(1)}
          </span>
          <span className="text-xs text-text-muted">
            {new Date(competition.startDate).toLocaleDateString()} -{' '}
            {new Date(competition.endDate).toLocaleDateString()}
          </span>
        </div>
      </div>

      {leaderboard.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-card-border rounded-xl">
          <p className="text-text-muted">No participants yet.</p>
        </div>
      ) : (
        <div className="border border-card-border rounded-xl bg-card-bg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-left text-text-muted">
                <th className="px-4 py-3 font-medium w-16">Rank</th>
                <th className="px-4 py-3 font-medium">Player</th>
                <th className="px-4 py-3 font-medium text-right">{gainLabel}</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, i) => {
                const rank = i + 1;
                const isTop3 = rank <= 3;
                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';

                return (
                  <tr
                    key={entry.rsn}
                    className={`border-b border-card-border/50 transition-colors ${
                      isTop3 ? 'bg-gold/5' : 'hover:bg-card-bg-hover'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span className={`font-medium ${isTop3 ? 'text-gold' : 'text-text-muted'}`}>
                        {medal || `#${rank}`}
                      </span>
                    </td>
                    <td className={`px-4 py-3 font-medium ${isTop3 ? 'text-gold' : ''}`}>
                      {entry.rsn}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${
                      entry.gained > 0 ? 'text-accent-green-light' : 'text-text-muted'
                    }`}>
                      {entry.baselineValue !== null
                        ? `+${formatValue(entry.gained, competition.type)}`
                        : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-text-muted mt-4 text-center">
        {participants.length} participants &middot; Stats updated hourly
      </p>
    </div>
  );
}
