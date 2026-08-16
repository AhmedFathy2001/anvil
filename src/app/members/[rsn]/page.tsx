import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Persona from './Persona';
import {
  getActivityStandings,
  getCompetitionHistory,
  getPersona,
  getUpcomingMilestones,
  getDailySeries,
  getMemberProfile,
  getMilestones,
  getRecords,
  getStandings,
  type Standing,
} from '@/lib/memberProfile';
import ProfileTabs from './ProfileTabs';
import { SKILLS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ rsn: string }> }): Promise<Metadata> {
  const { rsn } = await params;
  const name = decodeURIComponent(rsn);
  return { title: `${name} — Anvil`, description: `Skills, bosses and efficient hours for ${name}.` };
}

/** Max total level, derived from the skill list — 24 skills today, whatever Jagex adds tomorrow. */
const MAX_TOTAL_LEVEL = (SKILLS.length - 1) * 99;

function fmtXp(xp: number): string {
  if (xp >= 1_000_000_000) return `${(xp / 1_000_000_000).toFixed(2)}B`;
  if (xp >= 1_000_000) return `${(xp / 1_000_000).toFixed(1)}M`;
  if (xp >= 1_000) return `${(xp / 1_000).toFixed(0)}K`;
  return Math.round(xp).toLocaleString();
}

/**
 * One number and its clan placing, as a single chip.
 *
 * The placing used to be grey small-print under a card; here it rides with the number, because
 * "277 EHP" means nothing on its own and "#1 of 41" is the whole point of tracking a clan.
 */
function Placing({ label, value, standing }: { label: string; value: string; standing?: Standing | null }) {
  return (
    <span className="text-xs border border-card-border rounded-full px-3 py-1 bg-brown-dark text-text-muted">
      {label} <span className="text-foreground font-semibold tabular-nums">{value}</span>
      {standing && standing.outOf > 1 && (
        <>
          {' · '}
          <span className="text-gold tabular-nums">#{standing.rank}</span> of {standing.outOf}
        </>
      )}
    </span>
  );
}

/** Total level as the progress it is: a ring against the 2,376 cap, with the levels still to go. */
function TotalLevelDial({ level }: { level: number }) {
  const pct = Math.max(0, Math.min(1, level / MAX_TOTAL_LEVEL));
  const r = 47;
  const circumference = 2 * Math.PI * r;
  const remaining = Math.max(0, MAX_TOTAL_LEVEL - level);

  return (
    <div className="text-center sm:ml-auto">
      <svg
        width="112"
        height="112"
        viewBox="0 0 112 112"
        role="img"
        aria-label={`Total level ${level.toLocaleString()} of ${MAX_TOTAL_LEVEL.toLocaleString()}`}
      >
        <circle cx="56" cy="56" r={r} fill="none" stroke="var(--tile-bg)" strokeWidth="9" />
        <circle
          cx="56"
          cy="56"
          r={r}
          fill="none"
          stroke="var(--gold)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${(circumference * pct).toFixed(1)} ${circumference.toFixed(1)}`}
          transform="rotate(-90 56 56)"
        />
        <text x="56" y="53" textAnchor="middle" fill="var(--foreground)" fontSize="23" fontWeight="700">
          {level.toLocaleString()}
        </text>
        <text x="56" y="70" textAnchor="middle" fill="var(--text-muted)" fontSize="10" letterSpacing="1.4">
          OF {MAX_TOTAL_LEVEL.toLocaleString()}
        </text>
      </svg>
      <div className="text-xs text-text-muted mt-1">
        {remaining > 0 ? `${remaining.toLocaleString()} levels to max` : 'every skill at 99'}
      </div>
    </div>
  );
}

export default async function MemberProfilePage({ params }: { params: Promise<{ rsn: string }> }) {
  const { rsn } = await params;
  const profile = await getMemberProfile(decodeURIComponent(rsn));
  if (!profile) notFound();

  // Every tab's data in one round trip — every query is small and the tabs then switch instantly.
  const [milestones, records, series, standings, history, persona, activityStandings] = await Promise.all([
    getMilestones(profile.id, 50),
    getRecords(profile.id),
    getDailySeries(profile.id, 365),
    getStandings(profile.id),
    getCompetitionHistory(profile.id, profile.rsn),
    getPersona(profile.id),
    getActivityStandings(profile.rsn),
  ]);
  const upcoming = getUpcomingMilestones(profile);

  const eff = profile.efficiency;
  // Summed from the skill rows: `skills` carries the real skills only, so looking for an 'overall'
  // row found nothing and the chip read 0 XP.
  const totalXp = profile.skills.reduce((sum, s) => sum + (s.key === 'overall' ? 0 : s.xp), 0);

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <Link href="/members" className="text-sm text-text-muted hover:text-gold">
        ← All members
      </Link>

      {/* Identity band: who they are, where they place, and how far from max — one object rather
          than a name followed by five identically-weighted stat cards. Combat sits on the shield
          because that is where an OSRS player looks for it. */}
      <div
        className="relative overflow-hidden rounded-xl border border-card-border p-5 sm:p-6 mt-3 mb-6"
        style={{
          background:
            'radial-gradient(80% 160% at 0% 0%, rgba(212,160,23,.14), transparent 60%), var(--card-bg)',
        }}
      >
        <div className="flex flex-wrap items-center gap-5 sm:gap-6">
          {/* Drawn as SVG rather than a clip-path: clipping cuts the border off with the corners,
              which left the number floating with four stray edge marks instead of a shield. */}
          <svg
            width="84"
            height="92"
            viewBox="0 0 84 92"
            className="hidden sm:block shrink-0"
            role="img"
            aria-label={profile.combatLevel ? `Combat level ${profile.combatLevel}` : 'Combat level unknown'}
          >
            <defs>
              <linearGradient id="shield-fill" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--brown-light)" />
                <stop offset="100%" stopColor="var(--tile-bg)" />
              </linearGradient>
            </defs>
            <path
              d="M42 1 L82 14 V64 L42 91 L2 64 V14 Z"
              fill="url(#shield-fill)"
              stroke="var(--gold-dark)"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <text
              x="42"
              y="46"
              textAnchor="middle"
              fill="var(--gold-light)"
              fontSize="27"
              fontWeight="700"
            >
              {profile.combatLevel ?? '—'}
            </text>
            <text
              x="42"
              y="62"
              textAnchor="middle"
              fill="var(--text-muted)"
              fontSize="9"
              letterSpacing="1.5"
            >
              COMBAT
            </text>
          </svg>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="text-3xl font-bold text-gold break-words">{profile.rsn}</h1>
              {profile.isGuest && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-text-muted/15 text-text-muted">guest</span>
              )}
              {profile.rank && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-gold/15 text-gold capitalize">
                  {profile.rank}
                </span>
              )}
              {profile.leftAt && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-300">left the clan</span>
              )}
            </div>
            <p className="text-xs text-text-muted mt-1">
              {profile.statsAt
                ? `Stats as at ${new Date(profile.statsAt).toLocaleString()}`
                : 'Stats from the last hiscores sweep'}
            </p>

            {eff && (
              <div className="flex flex-wrap gap-2 mt-3">
                <Placing label="EHP" value={eff.ehp.toFixed(1)} standing={standings.ehp} />
                <Placing label="EHB" value={eff.ehb.toFixed(1)} standing={standings.ehb} />
                <Placing label="XP" value={fmtXp(totalXp)} standing={standings.xp} />
                <span className="text-xs border border-card-border rounded-full px-3 py-1 bg-brown-dark text-text-muted">
                  {eff.ttm >= 1 ? (
                    <>
                      <span className="text-gold font-semibold tabular-nums">{Math.round(eff.ttm).toLocaleString()}h</span> to max
                    </>
                  ) : (
                    <span className="text-gold font-semibold">maxed</span>
                  )}
                </span>
              </div>
            )}
          </div>

          {profile.totalLevel > 0 && <TotalLevelDial level={profile.totalLevel} />}
        </div>
      </div>

      {/* One human, several accounts. getPersona returns null for a member with a single linked
          account, so this only appears when there IS something behind the name — and it was
          computed but never rendered until now, which is why nobody could see who owned an alt. */}
      {persona && <Persona persona={persona} currentMemberId={profile.id} />}

      <ProfileTabs
        profile={profile}
        series={series}
        records={records}
        milestones={milestones}
        history={history}
        upcoming={upcoming}
        activityStandings={activityStandings}
      />
    </main>
  );
}
