'use client';

import ClanLink, { useClanRelativePath } from '@/components/ClanLink';

interface Props {
  isAdmin: boolean;
  provisionalCount: number;
}

// Tabs for the unified Clan hub. Consolidates what used to be four sidebar items —
// Roster, Verifications, Staff, Audit log — into one surface. Staff is admin-only; the
// rest follow the admin layout's existing admin/mod gate.
export default function ClanTabNav({ isAdmin, provisionalCount }: Props) {
  // Clan-relative: these hrefs are bare paths, and the browser is at /c/<slug>/… ,

  // so comparing against the raw pathname never matches and no tab looks active.

  const pathname = useClanRelativePath();

  const tabs: { href: string; label: string; badge?: number; exact?: boolean; show: boolean }[] = [
    { href: '/admin/clan', label: 'Members', exact: true, show: true },
    { href: '/admin/clan/needs-review', label: 'Needs review', badge: provisionalCount, show: true },
    { href: '/admin/clan/staff', label: 'People', show: isAdmin },
    // The public face at /c/<slug> — tagline, focus, recruiting. Admin-only: what the clan advertises
    // about itself is a clan-level decision.
    { href: '/admin/clan/profile', label: 'Profile', show: isAdmin },
    // Who may see the clan and how guests get in. Admin-only for the same reason People is: it
    // decides who can reach the place, not how an event is run.
    { href: '/admin/clan/policy', label: 'Access', show: isAdmin },
    { href: '/admin/clan/audit', label: 'History', show: true },
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
                <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-yellow-500/20 text-yellow-400">
                  {tab.badge}
                </span>
              )}
              {active && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-gold rounded-full" />}
            </ClanLink>
          );
        })}
      </nav>
      {/* Fade the right edge on small screens to signal the tab strip scrolls horizontally. */}
      <div className="pointer-events-none absolute right-0 top-0 bottom-px w-10 bg-gradient-to-l from-background to-transparent sm:hidden" />
    </div>
  );
}
