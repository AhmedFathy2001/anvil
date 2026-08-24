import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { apexCharacter } from '@/lib/apexProfiles';
import { isApexHost } from '@/lib/clanContext';
import ClanLink from '@/components/ClanLink';
import ClanCrest from '@/components/ClanCrest';
import AccountProgressCard from '@/components/AccountProgressCard';
import ProfileTabs from '@/app/members/[rsn]/ProfileTabs';
import { getCollectionLog } from '@/lib/clogRead';
import { getMemberItems, getMemberProgress } from '@/lib/memberProgressRead';
import {
  getAccountProfile,
  getDailySeries,
  getMilestones,
  getRecords,
  getUpcomingMilestones,
} from '@/lib/memberProfile';

export const dynamic = 'force-dynamic';

/**
 * One CHARACTER — an OSRS account, not the human behind it.
 *
 * The distinction is the identity model in the URL bar: /p/drenvox-mdps is a character, /u/<id> is
 * the person who plays it, and the old one-clan-per-database model had no way to tell them apart.
 *
 * THE SAME PROFILE THE CLAN GETS. This was a stub — four rows in a box — because everything worth
 * showing looked clan-shaped: the rich profile hung off a roster seat, and the apex has no seats. It
 * turned out nothing on it actually did. Every number here comes off the ACCOUNT, which is what
 * Jagex tracks, so /p/ and a clan's own member page now render the same component from the same
 * builder; the clan page adds only what a roster knows on top.
 *
 * WHAT IS DELIBERATELY ABSENT is anything a clan owns: standings ("#3 of 47" means nothing without
 * a clan to be third in), competition history, and the persona card. And nothing from Discord — this
 * page is public, and a character's owner is named only when they published the link themselves.
 *
 * Only shown when the account is shared. The apex holds no seat for anyone, so the visibility rule —
 * seat in the clan, or shared — leaves only the second half here. A page saying "this exists but you
 * may not see it" would disclose the very thing being withheld, so an unshared character is a 404,
 * indistinguishable from one that does not exist.
 */

export async function generateMetadata({ params }: { params: Promise<{ rsn: string }> }): Promise<Metadata> {
  const c = await apexCharacter(decodeURIComponent((await params).rsn));
  return c ? { title: `${c.rsn} — Anvil` } : { title: 'Not found — Anvil' };
}

/** Nothing to say without a clan, but the tabs still want the shape. */
const NO_COMPETITIONS = {
  events: [],
  weeklies: [],
  eventWins: 0,
  eventPodiums: 0,
  weeklyWins: 0,
  weeklyPodiums: 0,
  totalPoints: 0,
};

export default async function CharacterPage({ params }: { params: Promise<{ rsn: string }> }) {
  if (!isApexHost((await headers()).get('host'))) notFound();

  const character = await apexCharacter(decodeURIComponent((await params).rsn));
  if (!character) notFound();

  const profile = await getAccountProfile(character.accountId);
  if (!profile) notFound();

  const [series, records, milestones, collection, progress, questItems, caItems] = await Promise.all([
    getDailySeries(character.accountId, 365),
    getRecords(character.accountId),
    getMilestones(character.accountId, 50),
    getCollectionLog(character.accountId, character.rsn),
    getMemberProgress(character.accountId),
    getMemberItems(character.accountId, 'quest'),
    getMemberItems(character.accountId, 'ca'),
  ]);

  const upcoming = getUpcomingMilestones(profile);
  const ehp = profile.efficiency?.ehp ?? null;
  const ehb = profile.efficiency?.ehb ?? null;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-7">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h1 className="display display-lg text-[clamp(1.7rem,4vw,2.2rem)] font-semibold">
            {character.rsn}
          </h1>
          {character.verified && (
            <span className="rounded-md border border-accent-green/35 bg-accent-green/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-accent-green-light">
              Verified
            </span>
          )}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13.5px] text-text-muted">
          {character.clan ? (
            <ClanLink
              href={`/c/${character.clan.slug}`}
              className="flex items-center gap-2 transition-colors hover:text-gold"
            >
              <ClanCrest name={character.clan.name} size={18} />
              {character.clan.name}
            </ClanLink>
          ) : (
            <span className="text-text-dim">No clan</span>
          )}

          {/* Only present when its owner turned linking on, and named by another RSN they shared —
              never by anything from Discord. This line used to read "played by <Discord name>".

              THE LABEL IS THEIR PRIMARY SHARED RSN, which is frequently THIS character: the primary
              account is the one most likely to be published and the one most likely to be looked up.
              So the obvious phrasing produced "Drenvox mdps · also plays Drenvox mdps". When the name
              would repeat, the link says what it is for instead of naming anybody. */}
          {character.owner && (
            <span>
              {character.owner.label === character.rsn ? (
                <ClanLink href={`/u/${character.owner.playerId}`} className="text-gold hover:underline">
                  Their other characters
                </ClanLink>
              ) : (
                <>
                  also plays{' '}
                  <ClanLink href={`/u/${character.owner.playerId}`} className="text-gold hover:underline">
                    {character.owner.label}
                  </ClanLink>
                </>
              )}
            </span>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-x-8 gap-y-4">
          <Figure label="Total level" value={profile.totalLevel > 0 ? profile.totalLevel.toLocaleString() : '—'} />
          <Figure label="Combat" value={profile.combatLevel != null ? String(profile.combatLevel) : '—'} />
          <Figure
            label="Total XP"
            value={character.overallXp != null ? compact(character.overallXp) : '—'}
          />
          <Figure label="EHP" value={ehp != null ? ehp.toFixed(1) : '—'} />
          <Figure label="EHB" value={ehb != null ? ehb.toFixed(1) : '—'} />
        </div>
      </header>

      {profile.statsAt || profile.skills.length > 0 ? (
        <ProfileTabs
          profile={profile}
          series={series}
          records={records}
          milestones={milestones}
          history={NO_COMPETITIONS}
          upcoming={upcoming}
          // Standings are a clan's answer — "#3 of 47" says nothing on a page with no clan behind
          // it. The tabs already render a dash for an absent placing, so this is empty rather than
          // faked from the platform, which would be a different and much less useful number.
          activityStandings={{}}
          collection={collection}
          accountProgress={
            <AccountProgressCard summary={progress} quests={questItems} combat={caItems} />
          }
        />
      ) : (
        <div className="rounded-xl border border-dashed border-card-border px-5 py-10 text-center text-sm text-text-muted">
          Nothing tracked for this character yet. Stats appear once the hiscores sweep has seen it, or
          as soon as the RuneLite plugin pushes.
        </div>
      )}

      <p className="mt-8 text-xs text-text-dim">
        Shown because this account is shared. Its owner can turn that off from their profile.
      </p>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[22px] tabular-nums">{value}</div>
      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-text-dim">
        {label}
      </div>
    </div>
  );
}

function compact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}
