import ClanLink from '@/components/ClanLink';
import type { KindGroup } from '@/lib/pluginUi/feedUi';

/** The Lately tab's filters, the plugin panel Feed's own. */
export const LATELY_FILTERS: { key: 'all' | KindGroup; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'drops', label: 'Drops' },
  { key: 'pets', label: 'Pets' },
  { key: 'achievements', label: 'Achievements' },
  { key: 'deaths', label: 'Deaths' },
  { key: 'milestones', label: 'Milestones' },
];

const href = (f: string, before?: string | null) =>
  `/members?tab=lately${f !== 'all' ? `&f=${f}` : ''}${before ? `&before=${encodeURIComponent(before)}` : ''}`;

/** Filter chips over the Lately feed. */
export function LatelyFilters({ filter }: { filter: string }) {
  return (
    <nav aria-label="Filter the feed" className="mb-4 flex flex-wrap gap-2">
      {LATELY_FILTERS.map((x) => (
        <ClanLink
          key={x.key}
          href={href(x.key)}
          aria-current={x.key === filter ? 'page' : undefined}
          className={
            x.key === filter
              ? 'rounded-lg border border-gold/60 bg-gold/10 px-3 py-1.5 text-sm font-semibold text-gold'
              : 'rounded-lg border border-card-border px-3 py-1.5 text-sm text-text-muted hover:text-foreground'
          }
        >
          {x.label}
        </ClanLink>
      ))}
    </nav>
  );
}

/** Newest / Older under the Lately feed. */
export function LatelyPaging({ filter, before, older }: { filter: string; before: string | null; older: string | null }) {
  if (!before && !older) return null;
  return (
    <div className="mt-4 flex justify-between text-sm">
      {before ? (
        <ClanLink href={href(filter)} className="text-gold hover:text-gold-light">
          ‹ Newest
        </ClanLink>
      ) : (
        <span />
      )}
      {older && (
        <ClanLink href={href(filter, older)} className="text-gold hover:text-gold-light">
          Older ›
        </ClanLink>
      )}
    </div>
  );
}
