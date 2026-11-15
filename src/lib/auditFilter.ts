// The activity log's filters: people's actions first, automatic roster-sync rows one click away.
// Pure, so tests/audit-filter.test.ts can run it without a database.

export interface AuditRow {
  eventType: string;
  actorDisplayName: string | null;
  memberRsn: string | null;
  notes: string | null;
}

export type AuditScope = 'people' | 'sync' | 'all';

/** Types the roster sync writes on its own when nobody did it. */
const SYNC_TYPES = new Set([
  'joined',
  'left',
  'returned',
  'renamed',
  'member_left_for_another_clan',
  'member_chose_this_clan',
]);

/** A row the roster sync wrote by itself: a roster-change type with nobody behind it. */
export function isAutomatic(e: Pick<AuditRow, 'eventType' | 'actorDisplayName'>): boolean {
  return !e.actorDisplayName && SYNC_TYPES.has(e.eventType);
}

export function filterAudit<T extends AuditRow>(
  rows: readonly T[],
  opts: { scope: AuditScope; type?: string; query?: string },
): T[] {
  const q = (opts.query ?? '').trim().toLowerCase();
  return rows.filter((e) => {
    if (opts.scope === 'people' && isAutomatic(e)) return false;
    if (opts.scope === 'sync' && !isAutomatic(e)) return false;
    if (opts.type && opts.type !== 'all' && e.eventType !== opts.type) return false;
    if (q) {
      const hay = `${e.memberRsn ?? ''} ${e.actorDisplayName ?? ''} ${e.notes ?? ''} ${e.eventType.replace(/_/g, ' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export const AUDIT_PAGE_SIZE = 25;

/** One page of a list, with the page clamped into range. */
export function pageOf<T>(rows: readonly T[], page: number, size = AUDIT_PAGE_SIZE): { rows: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const p = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  return { rows: rows.slice((p - 1) * size, p * size), page: p, pages };
}
