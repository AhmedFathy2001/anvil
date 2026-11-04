'use client';

import ClanLink, { useClanRelativePath } from '@/components/ClanLink';

// Pages that share one rail item (Clans + Ghost clans, Discord + Event chat, …) keep their own
// addresses — bookmarks, digests and API links still work — and get a tab strip here instead of a
// rail line each. Decided client-side: the staff layout doesn't re-render between its children.

interface Tab {
  href: string;
  label: string;
  badge?: number;
}

export interface StaffSection {
  tabs: Tab[];
  /** Sub-paths of a tab that are their own screen (a clan's detail page) and want no strip. */
  exact?: boolean;
}

export default function StaffSectionTabs({ sections }: { sections: StaffSection[] }) {
  const here = useClanRelativePath();
  const hit = (s: StaffSection, t: Tab) => (s.exact ? here === t.href : here === t.href || here.startsWith(`${t.href}/`));
  const section = sections.find((s) => s.tabs.some((t) => hit(s, t)));
  if (!section) return null;
  return (
    <div className="mb-5 flex gap-1 border-b border-card-border overflow-x-auto">
      {section.tabs.map((t) => {
        const active = hit(section, t);
        return (
          <ClanLink
            key={t.href}
            href={t.href}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors ${
              active ? 'border-gold text-gold-light' : 'border-transparent text-text-muted hover:text-foreground'
            }`}
          >
            {t.label}
            {!!t.badge && (
              <span className="ml-1.5 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold">{t.badge}</span>
            )}
          </ClanLink>
        );
      })}
    </div>
  );
}
