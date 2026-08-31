'use client';

import ClanLink, { useClanRelativePath } from '@/components/ClanLink';

interface Props {
  isAdmin: boolean;
  provisionalCount: number;
}

/**
 * Tabs for People — who is in the clan, who is asking in, and who holds authority.
 *
 * Split out of the old "Members & staff" hub, which had grown to six tabs spanning two different
 * nouns: the PEOPLE (roster, review queue, staff seats) and the CLAN ITSELF (its public face, who
 * may see it, its history). One name could only ever describe half of that, and the half it named
 * kept getting longer as the other half grew.
 */
export default function PeopleTabNav({ isAdmin, provisionalCount }: Props) {
  const pathname = useClanRelativePath();

  const tabs: { href: string; label: string; badge?: number; exact?: boolean; show: boolean }[] = [
    { href: '/admin/people', label: 'Roster', exact: true, show: true },
    { href: '/admin/people/needs-review', label: 'Needs review', badge: provisionalCount, show: true },
    // Who can act for the clan. Admin-only, as it always was: handing out authority is not
    // roster work.
    { href: '/admin/people/staff', label: 'Staff', show: isAdmin },
  ];

  return (
    <div className="relative -mx-1 mb-8">
      <nav className="flex items-center gap-1 border-b border-card-border overflow-x-auto overflow-y-hidden px-1">
        {tabs
          .filter((t) => t.show)
          .map((tab) => {
            const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
            return (
              <ClanLink
                key={tab.href}
                href={tab.href}
                className={`relative px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
                  active ? 'text-gold' : 'text-text-muted hover:text-foreground'
                }`}
              >
                {tab.label}
                {tab.badge != null && tab.badge > 0 && (
                  <span className="rounded-full bg-gold/20 px-1.5 py-0.5 text-[11px] font-semibold text-gold">
                    {tab.badge}
                  </span>
                )}
                {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gold" />}
              </ClanLink>
            );
          })}
      </nav>
    </div>
  );
}
