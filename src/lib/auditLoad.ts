import { db } from '@/db';
import { clanAuditLog, clanRoster, users } from '@/db/schema';
import { and, desc, eq, lt } from 'drizzle-orm';
import { auditValuesForClient } from '@/lib/auditView';

export const AUDIT_LIMIT = 500;

export interface AuditEntryRow {
  id: number;
  clanMemberId: number | null;
  eventType: string;
  oldValue: string | null;
  newValue: string | null;
  actorDisplayName: string | null;
  notes: string | null;
  occurredAt: string;
  memberRsn: string | null;
}

/**
 * One slice of a clan's activity log, newest first, `beforeId` being the oldest id already shown. Rows
 * are trimmed to what the list draws (lib/auditView): no stored JSON, no Discord ids. One reader for the
 * page's first slice and the "Load older" call, so they cannot drift apart.
 */
export async function loadAuditEntries(clanId: number, beforeId?: number | null): Promise<{ entries: AuditEntryRow[]; hasMore: boolean }> {
  const rows = await db
    .select({
      id: clanAuditLog.id,
      clanMemberId: clanAuditLog.clanMemberId,
      eventType: clanAuditLog.eventType,
      oldValue: clanAuditLog.oldValue,
      newValue: clanAuditLog.newValue,
      notes: clanAuditLog.notes,
      occurredAt: clanAuditLog.occurredAt,
      memberRsn: clanRoster.rsn,
      actorDisplayName: users.displayName,
    })
    .from(clanAuditLog)
    .leftJoin(clanRoster, eq(clanAuditLog.clanMemberId, clanRoster.id))
    .leftJoin(users, eq(clanAuditLog.actorUserId, users.id))
    .where(beforeId ? and(eq(clanAuditLog.clanId, clanId), lt(clanAuditLog.id, beforeId)) : eq(clanAuditLog.clanId, clanId))
    .orderBy(desc(clanAuditLog.id))
    .limit(AUDIT_LIMIT + 1);
  const hasMore = rows.length > AUDIT_LIMIT;
  return {
    hasMore,
    entries: rows.slice(0, AUDIT_LIMIT).map((r) => ({
      id: r.id,
      clanMemberId: r.clanMemberId,
      eventType: r.eventType,
      ...auditValuesForClient(r),
      actorDisplayName: r.actorDisplayName,
      notes: r.notes,
      occurredAt: r.occurredAt,
      memberRsn: r.memberRsn,
    })),
  };
}
