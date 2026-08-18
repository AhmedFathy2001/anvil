import { db } from '@/db';
import { clanRoster } from '@/db/schema';
import { and, count, eq, isNull } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
import ClanTabNav from './ClanTabNav';

export const dynamic = 'force-dynamic';

// Shell for the unified Clan hub. The parent admin layout already gates access to
// admin/mod/editor; here we just resolve the role (Staff tab is admin-only) and the
// provisional-member badge, then render the tab nav above whichever sub-route is active.
export default async function ClanLayout({ children }: { children: React.ReactNode }) {
  const session = await verifyUser();
  const isAdmin = session?.role === 'admin';

  const provisionalCount = await db
    .select({ c: count() })
    .from(clanRoster)
    .where(and(eq(clanRoster.provisional, 1), isNull(clanRoster.leftAt)))
    .then((r) => r[0]?.c ?? 0);

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-2xl sm:text-3xl font-bold text-gold">Clan</h1>
        <p className="text-text-muted text-sm mt-0.5">Members, staff roles, and clan history in one place.</p>
      </header>
      <ClanTabNav isAdmin={isAdmin} provisionalCount={provisionalCount} />
      {children}
    </div>
  );
}
