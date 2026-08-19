import { db } from '@/db';
import { requireClan } from '@/lib/clanContext';
import { clanAuditLog, clanRoster, users } from '@/db/schema';
import { and, desc, eq, isNull, ne } from 'drizzle-orm';
import AuditLogClient, { type AuditEntry, type LeftMember, type JoinedMember } from './AuditLogClient';

export const dynamic = 'force-dynamic';

const AUDIT_LIMIT = 200;

export default async function ClanAuditPage() {
  const clan = await requireClan();
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
      memberRsn: clanRoster.rsn,
      actorDisplayName: users.displayName,
    })
    .from(clanAuditLog)
    .leftJoin(clanRoster, eq(clanAuditLog.clanMemberId, clanRoster.id))
    .leftJoin(users, eq(clanAuditLog.actorUserId, users.id))
    .where(eq(clanAuditLog.clanId, clan.id))
    .orderBy(desc(clanAuditLog.occurredAt))
    .limit(AUDIT_LIMIT);

  // Separate lists of recently-left and recently-joined members for the merge UI.
  // "Recently" = the last 30 days of soft-deleted/created rows.
  const recentLeft = await db
    .select({ id: clanRoster.id, rsn: clanRoster.rsn, leftAt: clanRoster.leftAt, rank: clanRoster.rank })
    .from(clanRoster)
    .where(and(eq(clanRoster.clanId, clan.id), ne(clanRoster.leftAt, '')))
    .orderBy(desc(clanRoster.leftAt))
    .limit(50);

  const recentActive = await db
    .select({ id: clanRoster.id, rsn: clanRoster.rsn, joinedAt: clanRoster.joinedAt, rank: clanRoster.rank })
    .from(clanRoster)
    .where(and(eq(clanRoster.clanId, clan.id), isNull(clanRoster.leftAt)))
    .orderBy(desc(clanRoster.joinedAt))
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
    <div>
      <p className="text-sm text-text-muted mb-4">
        Joins, leaves, renames, claims, and merges across the clan roster. Use the merge tool
        to reconcile a left/joined pair when it&apos;s actually the same player who renamed.
      </p>

      <AuditLogClient entries={entries} leftMembers={left} activeMembers={active} />
    </div>
  );
}
