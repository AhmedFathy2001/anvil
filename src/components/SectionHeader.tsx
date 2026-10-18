'use client';

import ClanLink, { useClanRelativePath } from '@/components/ClanLink';

export interface SectionPage {
  href: string;
  title: string;
  blurb: string;
  /** Matches the path exactly instead of as a prefix. */
  exact?: boolean;
  /** Pages that share a tab strip. A page alone in its group gets a heading and no tabs. */
  group: string;
  /** Short tab label, when the title is too long for a tab. */
  tab?: string;
  badge?: number;
  show?: boolean;
}

/**
 * The heading for a section shared by several sidebar entries (People, Clan): it names the page you
 * are on, and shows tabs only for its siblings — the pages that really are one job. Each sidebar
 * entry used to land on one hub page whose tabs repeated the other sidebar entries.
 */
export default function SectionHeader({ pages }: { pages: SectionPage[] }) {
  const pathname = useClanRelativePath();
  const visible = pages.filter((p) => p.show !== false);
  const matches = (p: SectionPage) => (p.exact ? pathname === p.href : pathname.startsWith(p.href));
  // The most specific match wins: /admin/people/staff over /admin/people.
  const here =
    [...visible].sort((a, b) => b.href.length - a.href.length).find(matches) ?? visible[0];
  const siblings = visible.filter((p) => p.group === here.group);

  return (
    <>
      <header className="mb-6">
        <h1 className="display display-lg text-4xl sm:text-[44px] font-semibold leading-tight">{here.title}</h1>
        <p className="text-text-muted mt-2 text-[15px]">{here.blurb}</p>
      </header>
      {siblings.length > 1 && (
        <div className="relative -mx-1 mb-8">
          <nav className="flex items-center gap-1 border-b border-card-border overflow-x-auto overflow-y-hidden px-1">
            {siblings.map((p) => {
              const active = p === here;
              return (
                <ClanLink
                  key={p.href}
                  href={p.href}
                  className={`relative px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
                    active ? 'text-gold-light' : 'text-text-muted hover:text-foreground'
                  }`}
                >
                  {p.tab ?? p.title}
                  {p.badge != null && p.badge > 0 && (
                    <span className="rounded-full bg-gold/20 px-1.5 py-0.5 text-[11px] font-semibold text-gold">{p.badge}</span>
                  )}
                  {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gold" />}
                </ClanLink>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}
