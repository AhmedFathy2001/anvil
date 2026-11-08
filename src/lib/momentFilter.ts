// The website feed's filter chips, as a pure kind -> keep rule (no database, so it is testable).
// Same idea as the RuneLite panel's Feed tab: "milestone" rows are stored as moment kind `milestone`.

export type MomentFilter = 'all' | 'drops' | 'deaths' | 'milestones';

export const MOMENT_FILTERS: readonly { key: MomentFilter; label: string }[] = [
  { key: 'all', label: 'Everything' },
  { key: 'drops', label: 'Drops' },
  { key: 'deaths', label: 'Deaths' },
  { key: 'milestones', label: 'Milestones' },
];

const DROP_KINDS = new Set(['pet', 'unique', 'loot', 'clog']);

export function momentMatchesFilter(kind: string, filter: MomentFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'drops':
      return DROP_KINDS.has(kind);
    case 'deaths':
      return kind === 'death';
    case 'milestones':
      return kind === 'milestone';
  }
}

export function filterMoments<T extends { kind: string }>(rows: T[], filter: MomentFilter): T[] {
  return filter === 'all' ? rows : rows.filter((r) => momentMatchesFilter(r.kind, filter));
}
