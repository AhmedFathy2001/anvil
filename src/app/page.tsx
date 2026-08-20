import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { currentClan, isApexHost } from '@/lib/clanContext';
import ApexDirectory from '@/components/ApexDirectory';
import { directoryClans } from '@/lib/apexDirectory';
import { verifyUser } from '@/lib/auth';
import { buildHomeView } from '@/lib/homeView';
import { viewerMemberIds } from '@/lib/competitionView';
import { countLiveTeamInvolvements } from '@/lib/myTeamNav';
import { ClanWeek, EventGrid, Hero, LiveNow, WeeklyRail, YouStrip } from '@/components/home/HomeSections';
import ClanLink from '@/components/ClanLink';

export const dynamic = 'force-dynamic';

/**
 * The clan home page.
 *
 * It used to be a name, four counters and a list of what was live — which meant a member who opened
 * it between events saw an empty page, and a member who opened it during one saw less than the
 * Discord post already told them. What it never showed was the clan: what anyone actually did this
 * week, who won anything, or that there were thirty competitions before this one.
 *
 * Everything here is assembled in lib/homeView from rows that already exist.
 */
/**
 * The apex home: a directory of every clan, since the apex belongs to none of them.
 *
 * Counts are per clan, read the same way each clan's own pages read them.
 */
async function ApexHome() {
  // One query, shared with /clans. Two copies of a counting query is how two pages start
  // disagreeing about how many members a clan has.
  return <ApexDirectory clans={await directoryClans()} />;
}

export default async function HomePage() {
  const clan = await currentClan();
  if (!clan) {
    // No clan resolved. That is the apex if the host IS the apex, and nothing at all otherwise —
    // an unrecognised host must not land on a real page just because it failed to name a clan.
    const host = (await headers()).get('host');
    if (isApexHost(host)) return <ApexHome />;
    notFound();
  }
  const session = await verifyUser();
  const myMemberIds = await viewerMemberIds(clan.id, session);
  const view = await buildHomeView(clan.id, myMemberIds);
  // Same rule as the nav: the shortcut only exists when there's something of theirs behind it.
  const myTeams = session?.userId ? await countLiveTeamInvolvements(clan.id, session.userId) : 0;

  return (
    <div>
      <Hero view={view} />
      <YouStrip you={view.you} signedIn={!!session?.userId} discordInvite={view.discordInvite} />
      <LiveNow view={view} />
      <WeeklyRail weeklies={view.weeklies} />
      <EventGrid events={view.events} />
      <ClanWeek view={view} />

      <section className="mt-9 grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
        <QuickLink href="/events" emoji="🏆" label="Competitions" />
        {myTeams > 0 && <QuickLink href="/team" emoji="🎯" label={myTeams > 1 ? 'My Teams' : 'My Team'} />}
        <QuickLink href="/profile" emoji="👤" label="My Profile" />
        {view.discordInvite && <QuickLink href={view.discordInvite} emoji="💬" label="Discord" external />}
      </section>
    </div>
  );
}

function QuickLink({
  href,
  emoji,
  label,
  external,
}: {
  href: string;
  emoji: string;
  label: string;
  external?: boolean;
}) {
  const className =
    'flex items-center gap-2.5 rounded-xl border border-card-border bg-card-bg p-3.5 text-[13.5px] font-semibold transition-colors hover:border-gold/45 hover:bg-card-bg-hover';
  const body = (
    <>
      <span className="text-[17px]" aria-hidden>
        {emoji}
      </span>
      {label}
    </>
  );
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {body}
    </a>
  ) : (
    <ClanLink href={href} className={className}>
      {body}
    </ClanLink>
  );
}
