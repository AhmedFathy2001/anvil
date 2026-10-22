import SectionHeader from '@/components/SectionHeader';
import { verifyAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Shell for the Clan hub — the clan as a thing, not the people in it (those are /admin/people, which
// is also where "Who can join" lives now). The parent admin layout already gates access, and the
// Profile page checks for an admin itself. The Profile tab is admin-only to match: a moderator
// reaches the Activity log from the sidebar and sees it alone.
export default async function ClanLayout({ children }: { children: React.ReactNode }) {
  const isAdmin = await verifyAdmin();
  return (
    <div>
      <SectionHeader
        pages={[
          { href: '/admin/clan', exact: true, title: 'Clan profile', tab: 'Profile', blurb: 'How the clan looks to everyone else.', show: isAdmin },
          { href: '/admin/clan/audit', title: 'Activity log', blurb: 'Who joined, left, changed what, and when.' },
        ]}
      />
      {children}
    </div>
  );
}
