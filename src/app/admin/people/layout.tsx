import { db } from '@/db';
import { requireClan } from '@/lib/clanContext';
import { clanRoster } from '@/db/schema';
import { and, count, eq, isNull } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
import PeopleTabNav from './PeopleTabNav';
import { atLeast } from '@/lib/clanRoles';

export const dynamic = 'force-dynamic';

// Shell for People. The parent admin layout already gates access to admin/mod/editor; here we
// resolve the role (the Staff tab is admin-only) and the provisional-member badge.
export default async function PeopleLayout({ children }: { children: React.ReactNode }) {
  const session = await verifyUser();
  const isAdmin = atLeast(session?.role, 'admin');

  const clan = await requireClan();
  const provisionalCount = await db
    .select({ c: count() })
    .from(clanRoster)
    .where(and(eq(clanRoster.clanId, clan.id), eq(clanRoster.provisional, 1), isNull(clanRoster.leftAt)))
    .then((r) => r[0]?.c ?? 0);

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
