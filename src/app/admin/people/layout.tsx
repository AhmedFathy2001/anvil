import { db } from '@/db';
import { requireClan } from '@/lib/clanContext';
import { clanRoster } from '@/db/schema';
import { and, count, eq, isNull } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
import SectionHeader from '@/components/SectionHeader';
import { atLeast } from '@/lib/clanRoles';
import { pendingClaimRequests } from '@/lib/claimRequests';

export const dynamic = 'force-dynamic';

// Shell for People. The parent admin layout already gates access to admin/mod/editor; here we
// resolve the role (the Staff tab is admin-only) and the provisional-member badge.
export default async function PeopleLayout({ children }: { children: React.ReactNode }) {
  const session = await verifyUser();
  const isAdmin = atLeast(session?.role, 'admin');

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
      .where(and(eq(clanRoster.clanId, clan.id), eq(clanRoster.provisional, 1), isNull(clanRoster.leftAt)))
      .then((r) => r[0]?.c ?? 0),
    pendingClaimRequests(clan.id).then((r) => r.length),
  ]);
  const provisionalCount = provisionalRows + claimRequests;

  return (
    <div>
      <SectionHeader
        pages={[
          { href: '/admin/people', exact: true, group: 'roster', title: 'Roster', blurb: 'Who is in the clan, and who is asking to join.' },
          { href: '/admin/people/needs-review', group: 'roster', title: 'Needs review', blurb: 'Newcomers and ownership claims waiting on a yes or no.', badge: provisionalCount },
          // Who can act for the clan. Admin-only: handing out authority is not roster work.
          { href: '/admin/people/staff', group: 'staff', title: 'Staff & roles', blurb: 'Who helps run the clan, and what each of them can do.', show: isAdmin },
        ]}
      />
      {children}
    </div>
  );
}
