import SectionHeader from '@/components/SectionHeader';

export const dynamic = 'force-dynamic';

// Shell for the Clan hub — the clan as a thing, not the people in it (those are /admin/people, which
// is also where "Who can join" lives now). The parent admin layout already gates access, and the
// Profile page checks for an admin itself.
export default async function ClanLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <SectionHeader
        pages={[
          { href: '/admin/clan', exact: true, group: 'profile', title: 'Clan profile', tab: 'Profile', blurb: 'How the clan looks to everyone else.' },
          { href: '/admin/clan/audit', group: 'log', title: 'Activity log', blurb: 'Who joined, left, changed what, and when.' },
        ]}
      />
      {children}
    </div>
  );
}
