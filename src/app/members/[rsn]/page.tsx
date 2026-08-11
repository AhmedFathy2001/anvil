import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getCompetitionHistory,
  getDailySeries,
  getMemberProfile,
  getMilestones,
  getRecords,
  getStandings,
  type Standing,
} from '@/lib/memberProfile';
import ProfileTabs from './ProfileTabs';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ rsn: string }> }): Promise<Metadata> {
  const { rsn } = await params;
  const name = decodeURIComponent(rsn);
  return { title: `${name} — Anvil`, description: `Skills, bosses and efficient hours for ${name}.` };
}

/** A headline number, with where it places in the clan when we know. */
function Stat({
  label,
  value,
  standing,
  standingBy,
  hint,
}: {
  label: string;
  value: string;
  standing?: Standing | null;
  /** What the rank is measured on, when that differs from the number above it. */
  standingBy?: string;
  hint?: string;
}) {
  return (
    <div className="border border-card-border rounded-xl bg-card-bg px-4 py-3" title={hint}>
      <div className="text-[11px] uppercase tracking-widest text-text-muted">{label}</div>
      <div className="text-xl font-bold text-gold tabular-nums mt-0.5">{value}</div>
      {standing && (
        <div className="text-[11px] text-text-muted mt-0.5">
          #{standing.rank} of {standing.outOf}
          {standingBy && ` by ${standingBy}`}
        </div>
      )}
    </div>
  );
}

export default async function MemberProfilePage({ params }: { params: Promise<{ rsn: string }> }) {
  const { rsn } = await params;
  const profile = await getMemberProfile(decodeURIComponent(rsn));
  if (!profile) notFound();

  // All four tabs' data in one round trip — every query is small and the tabs then switch instantly.
  const [milestones, records, series, standings, history] = await Promise.all([
    getMilestones(profile.id, 50),
    getRecords(profile.id),
    getDailySeries(profile.id, 365),
    getStandings(profile.id),
    getCompetitionHistory(profile.id, profile.rsn),
  ]);

  const eff = profile.efficiency;

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <Link href="/members" className="text-sm text-text-muted hover:text-gold">
        ← All members
      </Link>

      {/* Masthead: the identity, then the five numbers worth knowing before anything else. */}
      <div className="flex items-start gap-4 mt-3 mb-6">
        <span
          className="hidden sm:grid shrink-0 w-14 h-14 place-items-center rounded-xl bg-gold/15 border border-gold/30 text-2xl font-bold text-gold"
          aria-hidden
        >
          {profile.rsn.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
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
        </div>
      </div>

      {eff && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          <Stat label="Combat" value={profile.combatLevel?.toString() ?? '—'} />
          <Stat
            label="Total level"
            value={profile.totalLevel.toLocaleString()}
            standing={standings.xp}
            standingBy="XP"
          />
          <Stat
            label="EHP"
            value={eff.ehp.toFixed(2)}
            standing={standings.ehp}
            hint="Efficient hours played — all XP converted to time at the best known rates."
          />
          <Stat
            label="EHB"
            value={eff.ehb.toFixed(2)}
            standing={standings.ehb}
            hint="Efficient hours bossed — boss kills converted to time."
          />
          <Stat
            label="Time to max"
            value={eff.ttm >= 1 ? `${Math.round(eff.ttm).toLocaleString()}h` : 'maxed'}
            hint="Hours of efficient play from here to all 99s."
          />
        </div>
      )}

      <ProfileTabs
        profile={profile}
        series={series}
        records={records}
        milestones={milestones}
        history={history}
      />
    </main>
  );
}
