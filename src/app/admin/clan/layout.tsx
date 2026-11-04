import { verifyAdmin } from '@/lib/auth';
import ClanSettingsHeader from './ClanSettingsHeader';
import { requireClan } from '@/lib/clanContext';
import { isCreatorSpace } from '@/lib/creatorSpaces';

export const dynamic = 'force-dynamic';

// Shell for the Clan settings hub — the clan as a thing, not the people in it (those are
// /admin/people, which is also where "Who can join" lives now). The parent admin layout already gates
// access, and the Profile page checks for an admin itself. The admin-only tabs (Profile, Features,
// Rules & scoring) match: a moderator reaches the Activity log from the sidebar and sees it alone.
export default async function ClanLayout({ children }: { children: React.ReactNode }) {
  const isAdmin = !!(await verifyAdmin());
  // A creator space has one settings page (name, channel links, "Advertise on Anvil"); the clan
  // tabs — features, rules & scoring, profile — stay off its screen (lib/creatorSpaces).
  const creator = isCreatorSpace(await requireClan());
  return (
    <div>
      {!creator && <ClanSettingsHeader isAdmin={isAdmin} />}
      {children}
    </div>
  );
}
