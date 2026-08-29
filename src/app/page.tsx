import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { currentClan, isApexHost } from '@/lib/clanContext';
import ApexLanding from '@/components/landing/ApexLanding';
import ApexHome from '@/components/landing/ApexHome';
import { platformStats } from '@/lib/platformStats';
import { apexHomeView } from '@/lib/apexHome';
import { db } from '@/db';
import { users, clanStaff } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import PublicClanHome from '@/components/PublicClanHome';
import { publicClanHomeView } from '@/lib/clanHome';
import { getDiscordInviteUrl } from '@/lib/pluginConfig';
import { verifyUser } from '@/lib/auth';
import { buildHomeView } from '@/lib/homeView';
import { viewerMemberIds } from '@/lib/competitionView';
import { countLiveTeamInvolvements } from '@/lib/myTeamNav';
import { ClanWeek, Competitions, Hero, LiveNow, YouStrip } from '@/components/home/HomeSections';
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
 * The apex home, which is TWO pages behind one URL.
 *
 * Signed out it is marketing, and it argues to the person who ORGANISES — they are who signs a clan
 * up, and their problem is that running an event is a fortnight of data entry while everyone else
 * enjoys the thing they built.
 *
 * Signed in it is your clans and what is running in them. It used to be the clan directory in both
 * cases, which asked a signed-in member to read a list of strangers: you already know which clans
 * are yours, and the rest are somebody else's. The directory moved to /clans, where it is a lookup
 * you visit on purpose.
 */
async function ApexRoot() {
  const session = await verifyUser();
  if (!session) return <ApexLanding stats={await platformStats()} />;

  const [view, userRow] = await Promise.all([
    apexHomeView(session.playerId, session.userId),
    db.query.users.findFirst({ where: eq(users.id, session.userId), columns: { displayName: true } }),
  ]);
  return <ApexHome view={view} displayName={userRow?.displayName ?? 'there'} />;
}

export default async function HomePage() {
  const clan = await currentClan();
  if (!clan) {
    // No clan resolved. That is the apex if the host IS the apex, and nothing at all otherwise —
    // an unrecognised host must not land on a real page just because it failed to name a clan.
    const host = (await headers()).get('host');
    if (isApexHost(host)) return <ApexRoot />;
    notFound();
  }
  const session = await verifyUser();
  const myMemberIds = await viewerMemberIds(clan.id, session);
  // Insider = signed in and either holds a seat here or runs the clan → the member week view. Everyone
  // else (a signed-out visitor, or a member of some OTHER clan) gets the public clan home: what this
  // clan IS, not what's happening for you this week. The layout already gated `members`-only clans out,
  // so reaching here at all means the clan is readable.
  const staffHere = session?.userId
    ? (
        await db
          .select({ id: clanStaff.id })
          .from(clanStaff)
          .where(and(eq(clanStaff.clanId, clan.id), eq(clanStaff.userId, session.userId)))
          .limit(1)
      ).length > 0
    : false;
  const insider = !!session && (myMemberIds.length > 0 || staffHere);

  if (!insider) {
    const publicView = await publicClanHomeView(clan.id, await getDiscordInviteUrl(clan.id));
    if (publicView) return <PublicClanHome view={publicView} signedIn={!!session?.userId} />;
  }

  const view = await buildHomeView(clan.id, myMemberIds);
  // Same rule as the nav: the shortcut only exists when there's something of theirs behind it.
  const myTeams = session?.userId ? await countLiveTeamInvolvements(clan.id, session.userId) : 0;

  return (
    <div>
      <Hero view={view} />
      <YouStrip you={view.you} signedIn={!!session?.userId} discordInvite={view.discordInvite} />
      <LiveNow view={view} />
      <Competitions view={view} />
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
