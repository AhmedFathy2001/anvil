'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Props {
  eventId: number;
}

// Independent sub-route tabs for an event. Each tab is its own route with its own
// data load and client component, so the surfaces no longer depend on one another.
const TABS = [
  { slug: '', label: 'Overview' },
  { slug: 'tiles', label: 'Tiles' },
  { slug: 'teams', label: 'Teams & Draft' },
  { slug: 'signups', label: 'Sign-ups' },
  { slug: 'stats', label: 'Stats' },
] as const;

export default function EventTabNav({ eventId }: Props) {
  const pathname = usePathname();
  const base = `/admin/events/${eventId}`;

  return (
    <nav className="flex items-center gap-1 border-b border-card-border mb-8 -mx-1 overflow-x-auto">
      {TABS.map((tab) => {
        const href = tab.slug ? `${base}/${tab.slug}` : base;
        // Overview is active only on the exact base path; other tabs match their
        // prefix so deeper routes (e.g. teams/[teamId]) keep their tab highlighted.
        const active = tab.slug
          ? pathname.startsWith(href)
          : pathname === base;
        return (
          <Link
            key={tab.slug || 'overview'}
            href={href}
            className={`relative px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
              active
                ? 'text-gold'
                : 'text-text-muted hover:text-foreground'
            }`}
          >
            {tab.label}
            {active && (
              <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-gold rounded-full" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
