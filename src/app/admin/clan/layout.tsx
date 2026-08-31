import { verifyUser } from '@/lib/auth';
import ClanEntityTabNav from './ClanEntityTabNav';
import { atLeast } from '@/lib/clanRoles';

export const dynamic = 'force-dynamic';

// Shell for the Clan hub — the clan as a thing, not the people in it (those are /admin/people).
// The parent admin layout already gates access; here we resolve the role, since everything except
// History is an admin decision about how the clan presents itself and who may reach it.
export default async function ClanLayout({ children }: { children: React.ReactNode }) {
  const session = await verifyUser();
  const isAdmin = atLeast(session?.role, 'admin');

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-2xl sm:text-3xl font-bold text-gold">Clan</h1>
        <p className="text-text-muted text-sm mt-0.5">
          How the clan presents itself, who may reach it, what it is wired to, and what it has done.
        </p>
      </header>
      <ClanEntityTabNav isAdmin={isAdmin} />
      {children}
    </div>
  );
}
