import { db } from '@/db';
import { requireClan } from '@/lib/clanContext';
import { clanRoster } from '@/db/schema';
import { and, count, eq, isNull } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
import PeopleTabNav from './PeopleTabNav';
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
      <header className="mb-5">
        <h1 className="text-2xl sm:text-3xl font-bold text-gold">People</h1>
        <p className="text-text-muted text-sm mt-0.5">
          Who is in the clan, who is asking to be, and who can act for it.
        </p>
      </header>
      <PeopleTabNav isAdmin={isAdmin} provisionalCount={provisionalCount} />
      {children}
    </div>
  );
}
