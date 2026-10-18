'use client';

import Select from './Select';

export type TileStatus = 'in_progress' | 'not_started' | 'completed';
/** `open` = everything not yet completed (in progress + not started). */
export type StatusFilter = 'all' | 'open' | TileStatus;

export interface StatusCounts {
  all: number;
  open: number;
  inProgress: number;
  notStarted: number;
  completed: number;
}

// Status filter mirroring the plugin's collection-log "Bingo" tab (ALL / IN_PROGRESS / NOT_STARTED /
// COMPLETED). One choice, so a dropdown — a row of five chips ran off the side on a narrow column.
// Order matches the plugin's Status ordinal so incomplete work reads first.
const TABS: { key: StatusFilter; label: string; countKey: keyof StatusCounts; dot?: string }[] = [
  { key: 'all', label: 'All tiles', countKey: 'all' },
  { key: 'open', label: 'Not done', countKey: 'open' },
  { key: 'in_progress', label: 'In progress', countKey: 'inProgress', dot: 'var(--color-gold)' },
  { key: 'not_started', label: 'Not started', countKey: 'notStarted', dot: 'var(--color-text-muted)' },
  { key: 'completed', label: 'Completed', countKey: 'completed', dot: 'var(--color-accent-green)' },
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
    <Select
      value={value}
      onChange={(v) => onChange(v as StatusFilter)}
      options={TABS.map((t) => ({ value: t.key, label: `${t.label} (${counts[t.countKey]})`, dot: t.dot }))}
      ariaLabel="Filter tiles by status"
      className="mb-3 sm:w-56"
    />
  );
}
