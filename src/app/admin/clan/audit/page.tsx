import { db } from '@/db';
import { requireClan } from '@/lib/clanContext';
import { rosterClanSeat } from '@/lib/seatScope';
import { clanRoster } from '@/db/schema';
import { and, desc, eq, isNull, ne } from 'drizzle-orm';
import { loadAuditEntries } from '@/lib/auditLoad';
import AuditLogClient, { type LeftMember, type JoinedMember } from './AuditLogClient';

export const dynamic = 'force-dynamic';

export default async function ClanAuditPage() {
  const clan = await requireClan();
  const { entries, hasMore } = await loadAuditEntries(clan.id);

  // Separate lists of recently-left and recently-joined members for the merge UI.
  // "Recently" = the last 30 days of soft-deleted/created rows.
  const recentLeft = await db
    .select({ id: clanRoster.id, rsn: clanRoster.rsn, leftAt: clanRoster.leftAt, rank: clanRoster.rank })
    .from(clanRoster)
    // An event player's seat is not a roster seat: it closes when its event ends, never merges.
    .where(and(eq(clanRoster.clanId, clan.id), ne(clanRoster.leftAt, ''), rosterClanSeat()))
    .orderBy(desc(clanRoster.leftAt))
    .limit(50);

  const recentActive = await db
    .select({ id: clanRoster.id, rsn: clanRoster.rsn, joinedAt: clanRoster.joinedAt, rank: clanRoster.rank })
    .from(clanRoster)
    .where(and(eq(clanRoster.clanId, clan.id), isNull(clanRoster.leftAt), rosterClanSeat()))
    .orderBy(desc(clanRoster.joinedAt))
    .limit(100);

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
        What people changed in the clan, newest first. Automatic roster-sync joins and leaves are one click away under Roster sync. Use the merge tool
        to reconcile a left/joined pair when it&apos;s actually the same player who renamed.
      </p>

      <AuditLogClient entries={entries} hasMore={hasMore} leftMembers={left} activeMembers={active} />
    </div>
  );
}
