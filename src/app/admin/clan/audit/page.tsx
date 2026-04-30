import Link from 'next/link';
import { db } from '@/db';
import { clanAuditLog, clanMembers, users } from '@/db/schema';
import { desc, eq, isNull, ne } from 'drizzle-orm';
import AuditLogClient, { type AuditEntry, type LeftMember, type JoinedMember } from './AuditLogClient';

export const dynamic = 'force-dynamic';

const AUDIT_LIMIT = 200;

export default async function ClanAuditPage() {
  const rows = await db
    .select({
      id: clanAuditLog.id,
      clanMemberId: clanAuditLog.clanMemberId,
      eventType: clanAuditLog.eventType,
      oldValue: clanAuditLog.oldValue,
      newValue: clanAuditLog.newValue,
      actorUserId: clanAuditLog.actorUserId,
      notes: clanAuditLog.notes,
      occurredAt: clanAuditLog.occurredAt,
      memberRsn: clanMembers.rsn,
      actorDisplayName: users.displayName,
    })
    .from(clanAuditLog)
    .leftJoin(clanMembers, eq(clanAuditLog.clanMemberId, clanMembers.id))
    .leftJoin(users, eq(clanAuditLog.actorUserId, users.id))
    .orderBy(desc(clanAuditLog.occurredAt))
    .limit(AUDIT_LIMIT);

  // Separate lists of recently-left and recently-joined members for the merge UI.
  // "Recently" = the last 30 days of soft-deleted/created rows.
  const recentLeft = await db
    .select({ id: clanMembers.id, rsn: clanMembers.rsn, leftAt: clanMembers.leftAt, rank: clanMembers.rank })
    .from(clanMembers)
    .where(ne(clanMembers.leftAt, ''))
    .orderBy(desc(clanMembers.leftAt))
    .limit(50);

  const recentActive = await db
    .select({ id: clanMembers.id, rsn: clanMembers.rsn, joinedAt: clanMembers.joinedAt, rank: clanMembers.rank })
    .from(clanMembers)
    .where(isNull(clanMembers.leftAt))
    .orderBy(desc(clanMembers.joinedAt))
    .limit(100);

  const entries: AuditEntry[] = rows.map((r) => ({
    id: r.id,
    clanMemberId: r.clanMemberId,
    eventType: r.eventType,
    oldValue: r.oldValue,
    newValue: r.newValue,
    actorDisplayName: r.actorDisplayName,
    notes: r.notes,
    occurredAt: r.occurredAt,
    memberRsn: r.memberRsn,
  }));

  const left: LeftMember[] = recentLeft
    .filter((m) => m.leftAt)
    .map((m) => ({ id: m.id, rsn: m.rsn, leftAt: m.leftAt!, rank: m.rank }));

  const active: JoinedMember[] = recentActive.map((m) => ({
    id: m.id,
    rsn: m.rsn,
    joinedAt: m.joinedAt,
    rank: m.rank,
  }));

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="w-1 h-7 bg-gold rounded-full" />
          <h1 className="text-3xl font-bold text-gold">Clan Audit Log</h1>
        </div>
        <Link
          href="/admin/clan"
          className="text-sm text-text-muted hover:text-foreground underline-offset-2 hover:underline"
        >
          ← Back to roster
        </Link>
      </div>

      <p className="text-sm text-text-muted mb-4">
        Joins, leaves, renames, claims, and merges across the clan roster. Use the merge tool
        to reconcile a left/joined pair when it&apos;s actually the same player who renamed.
      </p>

      <AuditLogClient entries={entries} leftMembers={left} activeMembers={active} />
    </div>
  );
}
