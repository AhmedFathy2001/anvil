'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Props {
  eventId: number;
  // Bingo editors author tiles only — they see just the Tiles tab (the other surfaces are
  // admin-only and their write APIs reject editors anyway).
  tilesOnly?: boolean;
  /** What this board calls its entries (lib/tileAuthoring) — a ladder's are Tasks, not Tiles. */
  taskNounPlural?: string;
}

// Independent sub-route tabs for an event. Each tab is its own route with its own
// data load and client component, so the surfaces no longer depend on one another.
const TABS = [
  { slug: '', label: 'Overview' },
  { slug: 'tiles', label: 'Tiles' },
  { slug: 'teams', label: 'Teams & Draft' },
  { slug: 'signups', label: 'Sign-ups' },
  { slug: 'stats', label: 'Stats' },
  { slug: 'payouts', label: 'Payouts' },
  { slug: 'survey', label: 'Survey' },
] as const;

export default function EventTabNav({ eventId, tilesOnly = false, taskNounPlural = 'Tiles' }: Props) {
  const pathname = usePathname();
  const base = `/admin/events/${eventId}`;
  const tabs = (tilesOnly ? TABS.filter((t) => t.slug === 'tiles') : TABS).map((t) =>
    t.slug === 'tiles' ? { ...t, label: taskNounPlural } : t,
  );

  return (
    <div className="relative -mx-1 mb-8">
      <nav className="flex items-center gap-1 border-b border-card-border overflow-x-auto overflow-y-hidden px-1">
      {tabs.map((tab) => {
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
      {/* Fade the right edge on small screens to signal the tab strip scrolls horizontally. */}
      <div className="pointer-events-none absolute right-0 top-0 bottom-px w-10 bg-gradient-to-l from-background to-transparent sm:hidden" />
    </div>
  );
}
