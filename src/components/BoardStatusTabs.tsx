'use client';

export type TileStatus = 'in_progress' | 'not_started' | 'completed';
export type StatusFilter = 'all' | TileStatus;

export interface StatusCounts {
  all: number;
  inProgress: number;
  notStarted: number;
  completed: number;
}

// Segmented status filter mirroring the plugin's collection-log "Bingo" tab (ALL / IN_PROGRESS /
// NOT_STARTED / COMPLETED). Order matches the plugin's Status ordinal so incomplete work reads first.
const TABS: { key: StatusFilter; label: string; countKey: keyof StatusCounts; dot?: string }[] = [
  { key: 'all', label: 'All', countKey: 'all' },
  { key: 'in_progress', label: 'In progress', countKey: 'inProgress', dot: 'bg-gold' },
  { key: 'not_started', label: 'Not started', countKey: 'notStarted', dot: 'bg-text-muted' },
  { key: 'completed', label: 'Completed', countKey: 'completed', dot: 'bg-accent-green' },
];

export default function BoardStatusTabs({
  value,
  onChange,
  counts,
}: {
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
  counts: StatusCounts;
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-0.5 mb-3" role="tablist" aria-label="Filter tiles by status">
      {TABS.map((t) => {
        const active = value === t.key;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={`shrink-0 text-xs px-2.5 py-1.5 rounded-lg border transition-colors inline-flex items-center gap-1.5 ${
              active ? 'bg-gold/20 border-gold text-gold' : 'border-card-border text-text-muted hover:border-gold/40'
            }`}
          >
            {t.dot && <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} aria-hidden />}
            {t.label}
            <span className={active ? 'text-gold/80' : 'text-text-muted/70'}>{counts[t.countKey]}</span>
          </button>
        );
      })}
    </div>
  );
}
