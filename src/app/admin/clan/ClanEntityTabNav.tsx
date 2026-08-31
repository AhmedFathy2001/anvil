'use client';

import ClanLink, { useClanRelativePath } from '@/components/ClanLink';

interface Props {
  isAdmin: boolean;
}

/**
 * Tabs for the Clan itself — its public face, its door, its wiring and its record.
 *
 * The other half of the old "Members & staff" hub, which held two nouns under a name for one of
 * them. People moved to /admin/people; what stays here is the clan as a thing rather than the people
 * in it.
 *
 * Settings arrives from the dissolved "System" group. It was always clan configuration — Discord,
 * webhooks, notifications, fees, board defaults — and its own page admitted the split it caused, in
 * a line telling readers that the clan name lives under a different menu entirely.
 */
export default function ClanEntityTabNav({ isAdmin }: Props) {
  // Clan-relative: these hrefs are bare paths, and the browser is at /c/<slug>/… ,

  // so comparing against the raw pathname never matches and no tab looks active.

  const pathname = useClanRelativePath();

  const tabs: { href: string; label: string; badge?: number; exact?: boolean; show: boolean }[] = [
    // The public face at /c/<slug> — tagline, focus, recruiting.
    { href: '/admin/clan', label: 'Profile', exact: true, show: true },
    // Who may see the clan and how guests get in.
    { href: '/admin/clan/policy', label: 'Access', show: isAdmin },
    // Everything the clan talks to. Was System → Advanced settings.
    { href: '/admin/integrations', label: 'Settings', show: isAdmin },
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
