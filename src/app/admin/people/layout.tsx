import { db } from '@/db';
import { requireClan } from '@/lib/clanContext';
import { clanRoster } from '@/db/schema';
import { rosterClanSeat } from '@/lib/seatScope';
import { and, count, eq, isNull } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
import SectionHeader from '@/components/SectionHeader';
import { atLeast, holdsModeratorTier } from '@/lib/clanRoles';
import { pendingClaimRequests } from '@/lib/claimRequests';
import { isCreatorSpace, streamsEvents } from '@/lib/creatorSpaces';

export const dynamic = 'force-dynamic';

// Shell for People. The parent admin layout already gates access to admin/mod/editor; here we
// resolve the role (the Staff tab is admin-only) and the provisional-member badge.
export default async function PeopleLayout({ children }: { children: React.ReactNode }) {
  const session = await verifyUser();
  const isAdmin = atLeast(session?.role, 'admin');
  // "Past viewers" (lib/eventPlayers): moderator work, like the roster; only where events stream.
  // Moderator TIER, as the API behind it asks (lib/clanRoles holdsModeratorTier): a clan treasurer is in.
  const isModerator = holdsModeratorTier(session);

  const clan = await requireClan();
  // BOTH KINDS OF WAITING, because the tab holds both and only one of them was counted.
  //
  // A provisional member is a row a mod must confirm. A CLAIM REQUEST is the other half: somebody
  // whose character is already on this roster as an established member, who played with the plugin
  // and was refused an automatic link — a public RSN cannot claim an established seat, or renaming
  // your Discord would be a takeover. Their way in is a moderator saying "yes, that is them".
  //
  // Counted only as provisional rows, that queue was silent: a member sat unable to join a clan he
  // was already on the roster of, and the tab that could let him in showed no badge at all.
  const [provisionalRows, claimRequests] = await Promise.all([
    db
      .select({ c: count() })
      .from(clanRoster)
      // An event player's seat is not on the roster: never a claim for this clan to review.
      .where(and(eq(clanRoster.clanId, clan.id), eq(clanRoster.provisional, 1), isNull(clanRoster.leftAt), rosterClanSeat()))
      .then((r) => r[0]?.c ?? 0),
    pendingClaimRequests(clan.id).then((r) => r.length),
  ]);
  const provisionalCount = provisionalRows + claimRequests;

  // A creator space: its players (event guests) and its staff. No roster, nothing provisional to
  // review, and who may join is each event's own entry setting.
  if (isCreatorSpace(clan)) {
    return (
      <div>
        <SectionHeader
          pages={[
            { href: '/admin/people', exact: true, title: 'Players', blurb: 'Who has played your events, and who is asking to.' },
            { href: '/admin/people/viewers', title: 'Past viewers', blurb: 'Viewers by event: their team and how it finished.', show: isModerator },
            { href: '/admin/people/staff', title: 'Staff & roles', blurb: 'Who helps run your events, and what each of them can do.', show: isAdmin },
          ]}
        />
        {children}
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        pages={[
          { href: '/admin/people', exact: true, title: 'Roster', blurb: 'Who is in the clan, and who is asking to join.' },
          // Viewers who joined a streamed event: never on the roster, so they get their own list.
          { href: '/admin/people/viewers', title: 'Past viewers', blurb: 'Viewers from your stream, by event: their team and how it finished.', show: isModerator && streamsEvents(clan) },
          { href: '/admin/people/needs-review', title: 'Needs review', blurb: 'Newcomers and ownership claims waiting on a yes or no.', badge: provisionalCount },
          // Who can act for the clan. Admin-only: handing out authority is not roster work.
          { href: '/admin/people/staff', title: 'Staff & roles', blurb: 'Who helps run the clan, and what each of them can do.', show: isAdmin },
          // Who may see the clan and how outsiders get in — here, next to the people it decides about.
          { href: '/admin/people/access', title: 'Who can join', blurb: 'Who may see the clan, and how players from other clans get in.', show: isAdmin },
        ]}
      />
      {children}
    </div>
  );
}
