import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { currentClan, isApexHost } from '@/lib/clanContext';
import { clanRankFor } from '@/lib/clanLeaderboard';
import { JsonLd, clanLd, websiteLd } from '@/lib/jsonLd';
import { clanSectionMetadata } from '@/lib/seoPages';
import { ordinal } from '@/lib/utils';
import ApexLanding from '@/components/landing/ApexLanding';
import ApexHome from '@/components/landing/ApexHome';
import { platformStats } from '@/lib/platformStats';
import { apexHomeView } from '@/lib/apexHome';
import { apexSignals } from '@/lib/apexHomeSignals';
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
 * The clan's own front door, described with facts rather than with the product's tagline.
 *
 * Every clan page carried the layout's "Bingos, competitions and the roster for X." — true of all of
 * them, useful about none of them, and the same sentence a hundred times over is not a description.
 * A snippet that says how many people are in a clan, what it is running right now and where it sits
 * on the table is the difference between a result somebody clicks and one they scroll past.
 *
 * The apex is deliberately left alone: there the layout's platform metadata is already correct.
 */
export async function generateMetadata(): Promise<Metadata> {
  const clan = await currentClan();
  if (!clan) return {};

  const view = await publicClanHomeView(clan.id);
  if (!view) return {};

  // Only for a clan that is on the table at all — lib/clanListing keeps private and unlisted clans
  // off it, so this cannot describe a clan by a standing it never agreed to publish.
  const rank = await clanRankFor(clan.id);

  const bits: string[] = [];
  if (view.memberCount > 0) {
    bits.push(`${view.memberCount.toLocaleString()} member${view.memberCount === 1 ? '' : 's'}`);
  }
  if (rank) bits.push(`${ordinal(rank.rank)} of ${rank.field} clans this week`);
  const live = view.recentEvents.find((e) => isLive(e));
  if (live) bits.push(`${live.name} running now`);
  else if (view.eventsRun > 0) bits.push(`${view.eventsRun.toLocaleString()} events run`);

  // The clan's own words first when it has written any — nobody describes a clan better than it
  // does — with the facts appended rather than replacing them.
  const own = (view.tagline || view.description || '').trim().replace(/\s+/g, ' ');
  const facts = bits.join(' · ');
  const description = own
    ? `${own.length > 110 ? `${own.slice(0, 107)}…` : own}${facts ? ` — ${facts}.` : ''}`
    : facts
      ? `${facts}. Old School RuneScape clan events on Anvil.`
      : `Old School RuneScape clan events, competitions and roster for ${view.name}.`;

  return clanSectionMetadata({ description });
}

/**
 * Running right now, by the event's own dates.
 *
 * The two timestamp formats these columns hold (see lib/dbTime) compare correctly against an ISO
 * `now` once the space form is normalised, which is all this needs — it is choosing a word for a
 * meta description, not settling a scoring dispute.
 */
function isLive(e: { startDate: string | null; endDate: string | null }): boolean {
  const now = new Date().toISOString();
  const start = e.startDate?.replace(' ', 'T');
  const end = e.endDate?.replace(' ', 'T');
  return !!start && start <= now && (!end || end >= now);
}

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
  if (!session) {
    return (
      <>
        {/* The signed-out apex is the only page a crawler indexes as "the platform", so it is the
            one place the platform describes itself as a thing rather than as a set of clan pages. */}
        <JsonLd data={websiteLd()} />
        <ApexLanding stats={await platformStats()} />
      </>
    );
  }

  const [view, userRow, signals] = await Promise.all([
    apexHomeView(session.playerId, session.userId),
    db.query.users.findFirst({ where: eq(users.id, session.userId), columns: { displayName: true } }),
    // The "how am I doing" half. Fetched alongside rather than inside apexHomeView so the two stay
    // separable: this half is about the person, that half is about what wants them.
    apexSignals(session.playerId, session.userId),
  ]);
  return <ApexHome view={view} signals={signals} displayName={userRow?.displayName ?? 'there'} />;
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
    if (publicView) {
      return (
        <>
          {/* Structured data on the PUBLIC branch only, which is the branch a crawler ever reaches —
              they arrive signed out, and a `members` clan never renders children at all (the layout
              swaps in ClanPrivate). So this cannot describe a clan that withheld itself. */}
          <JsonLd
            data={clanLd({
              name: publicView.name,
              slug: publicView.slug,
              description:
                (publicView.tagline || publicView.description || '').trim() ||
                `Old School RuneScape clan events and roster for ${publicView.name}.`,
              memberCount: publicView.memberCount,
              discordInvite: publicView.discordInvite,
            })}
          />
          <PublicClanHome view={publicView} signedIn={!!session?.userId} />
        </>
      );
    }
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
