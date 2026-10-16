import { verifyUser } from '@/lib/auth';
import SectionHeader from '@/components/SectionHeader';
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
      <SectionHeader
        pages={[
          { href: '/admin/clan', exact: true, group: 'profile', title: 'Clan profile', tab: 'Profile', blurb: 'How the clan looks to everyone else.' },
          { href: '/admin/clan/policy', group: 'profile', title: 'Who can join', tab: 'Access', blurb: 'Who may see the clan, and how somebody gets in.', show: isAdmin },
          { href: '/admin/clan/audit', group: 'log', title: 'Activity log', blurb: 'Who joined, left, changed what, and when.' },
        ]}
      />
      {children}
    </div>
  );
}
