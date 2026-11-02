import { verifyAdmin } from '@/lib/auth';
import ClanSettingsHeader from './ClanSettingsHeader';

export const dynamic = 'force-dynamic';

// Shell for the Clan settings hub — the clan as a thing, not the people in it (those are
// /admin/people, which is also where "Who can join" lives now). The parent admin layout already gates
// access, and the Profile page checks for an admin itself. The admin-only tabs (Profile, Features,
// Rules & scoring) match: a moderator reaches the Activity log from the sidebar and sees it alone.
export default async function ClanLayout({ children }: { children: React.ReactNode }) {
  const isAdmin = !!(await verifyAdmin());
  return (
    <div>
      <ClanSettingsHeader isAdmin={isAdmin} />
      {children}
    </div>
  );
}
