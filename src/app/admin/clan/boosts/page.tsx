import { redirect } from 'next/navigation';

import { verifyAdmin } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { clanHref } from '@/lib/clanPath';
import { isCreatorSpace } from '@/lib/creatorSpaces';
import { LEVEL_AT, boostPerks, clanBoostSummary, RECRUITING_LINE_MAX, RECRUIT_POST_MAX } from '@/lib/clanBoosts';
import { BoostedBadge, BoostersWall } from '@/components/ClanBoost';
import MovedToSpace from '../MovedToSpace';
import BoostsClient from './BoostsClient';

export const dynamic = 'force-dynamic';

const day = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

const LEVELS: { level: 1 | 2 | 3; perks: string[] }[] = [
  { level: 1, perks: ['“Boosted” badge on your clan page, Clan Hall card and in search', 'Listed above unboosted clans in the Clan Hall', 'Your clan name in a gradient'] },
  { level: 2, perks: ['A spot in the Clan Hall’s Featured row', 'Your animated banner plays (below Level 2 it shows its still frame)', 'A recruiting line for visitors', 'Your clan name’s gradient moves'] },
  { level: 3, perks: ['A Spotlight at the very top of the Clan Hall', 'One recruitment post a month in the Anvil Discord'] },
];

/**
 * Clan settings → Boosts (lib/clanBoosts). Owners and admins see the level, any grace week, and the
 * two things a level lets them write: the recruiting line (Level 2) and the monthly Discord post
 * (Level 3). Boosts themselves are placed by members on Settings → Clan boosts.
 */
export default async function ClanBoostsPage() {
  if (!(await verifyAdmin())) redirect(await clanHref('/admin/people'));
  const clan = await requireClan();
  if (isCreatorSpace(clan)) return <MovedToSpace />;
  const summary = await clanBoostSummary(clan.id);
  const perks = boostPerks(summary.level);

  return (
    <div className="max-w-3xl">
      <section className="mb-6 rounded-xl border border-card-border bg-card-bg p-5">
        <div className="mb-2 flex flex-wrap items-center gap-2.5">
          <span className="h-5 w-1 rounded-full bg-gold" />
          <h2 className="text-[16.5px] font-semibold">{summary.level > 0 ? `Level ${summary.level}` : 'Not boosted yet'}</h2>
          <BoostedBadge level={summary.level} />
          <span className="ml-auto text-[13px] text-text-muted">
            <b className="font-semibold tabular-nums text-foreground">{summary.counted}</b> boost{summary.counted === 1 ? '' : 's'} counting
            {summary.progress && <> · {summary.progress.need - summary.progress.have} more to Level {summary.progress.next}</>}
          </span>
        </div>
        {summary.graceEndsAt && (
          <p className="mb-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-[13px] text-yellow-300">
            Your boosts fell below Level {summary.level}. Its perks stay until {day(summary.graceEndsAt)}; after that the clan is
            Level {summary.countedLevel || 0} unless members boost it back.
          </p>
        )}
        <p className="text-[13px] text-text-muted">
          Members who are paying Anvil Supporters place boosts on the clan from their own settings, through a member seat at least
          14 days old. Up to two from one person count. Levels at {LEVEL_AT.join(', ')}. Boosts only change how the clan looks and
          where it&rsquo;s listed: never a rank, a score, seats or your plan.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {LEVELS.map((l) => (
            <li
              key={l.level}
              className={`rounded-lg border p-3 text-[12.5px] ${summary.level >= l.level ? 'border-[#ff7ab8]/40 bg-[#ff7ab8]/[0.05]' : 'border-card-border'}`}
            >
              <p className="mb-1.5 font-semibold">
                Level {l.level} <span className="font-normal text-text-dim">· {LEVEL_AT[l.level - 1]} boosts</span>
              </p>
              <ul className="grid gap-1 text-text-muted">
                {l.perks.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <BoostsClient
        recruitingLine={summary.recruitingLineDraft ?? ''}
        lineUnlocked={perks.recruitingLine}
        lineMax={RECRUITING_LINE_MAX}
        postUnlocked={perks.discordPost}
        postMax={RECRUIT_POST_MAX}
        postNextAt={summary.recruitPostNextAt ? day(summary.recruitPostNextAt) : null}
        lastPostAt={summary.lastRecruitPostAt ? day(summary.lastRecruitPostAt) : null}
      />

      {summary.wall.length > 0 && (
        <section className="mt-6 rounded-xl border border-card-border bg-card-bg p-5">
          <div className="mb-2 flex items-center gap-2.5">
            <span className="h-5 w-1 rounded-full bg-gold" />
            <h2 className="text-[16.5px] font-semibold">Boosters</h2>
          </div>
          <BoostersWall wall={summary.wall} max={50} />
        </section>
      )}
    </div>
  );
}
