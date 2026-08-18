import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanRoster, clanAuditLog } from '@/db/schema';
import { findRosterSeat, personOf, seatsOwnedBy, unclaimAccountOfSeat, updateAccountOfSeat } from '@/lib/roster';
import { and, eq } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';

// DELETE /api/admin/users/[userId]/characters/[memberId]
//
// Admin detaches a character from a site user — unlinks ownership (userId → null) without deleting
// the clan_member, so roster/history survives and it can be re-linked. Scoped to that user's own
// characters so an admin can't accidentally unlink from the wrong person via a mismatched id.
export async function DELETE(_request: Request, { params }: { params: Promise<{ userId: string; memberId: string }> }) {
  const actor = await verifyUser();
  if (actor?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { userId: userParam, memberId: memberParam } = await params;
  const targetId = Number(userParam);
  const memberId = Number(memberParam);
  if (!Number.isInteger(targetId) || !Number.isInteger(memberId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const member = await findRosterSeat(and(eq(clanRoster.id, memberId), await seatsOwnedBy(targetId)));
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await unclaimAccountOfSeat(memberId);

  db.insert(clanAuditLog)
    .values({
      clanMemberId: memberId,
      eventType: 'unclaimed',
      oldValue: JSON.stringify({ userId: targetId, rsn: member.rsn, via: 'admin' }),
      actorUserId: actor.userId,
    })
    .catch(() => {});

  return NextResponse.json({ ok: true });
}
