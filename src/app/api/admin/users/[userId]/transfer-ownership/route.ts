import { NextResponse } from 'next/server';
import { clanGrant } from '@/lib/clanGrants';
import { requireClanFromRequest } from '@/lib/clanContext';
import { verifyUser } from '@/lib/auth';
import { db } from '@/db';
import { clanAuditLog, clanStaff, users } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

// Transfer the protected owner flag to another admin. Only the current owner may call this — it is
// the sole path that moves ownership (the role-change and delete endpoints refuse to touch the owner
// row). The new owner must already be an admin: you don't hand the crown to someone who has never
// held staff access.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await verifyUser();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Ownership is OF A CLAN, so the clan comes from the host and the caller must own that one.
  const clan = await requireClanFromRequest(request);
  if (!clan) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Read live from the grant rather than the session, so a stale token cannot seize ownership.
  const callerGrant = await clanGrant(clan.id, session.userId);
  if (!callerGrant?.isOwner) {
    return NextResponse.json({ error: 'Only the current owner can transfer ownership' }, { status: 403 });
  }
  const caller = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId } = await params;
  const targetId = parseInt(userId, 10);
  if (!Number.isFinite(targetId)) {
    return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
  }
  if (targetId === caller.id) {
    return NextResponse.json({ error: 'You are already the owner' }, { status: 400 });
  }

  const target = await db.query.users.findFirst({ where: eq(users.id, targetId) });
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  const targetGrant = await clanGrant(clan.id, targetId);
  if (targetGrant?.role !== 'admin') {
    return NextResponse.json({ error: 'Ownership can only be transferred to an admin' }, { status: 400 });
  }

  try {
    await db.transaction(async (tx) => {
      // Crown the target first (still requiring they're an admin), and bail out if that matched no
      // row — that means they were demoted out from under us, and rolling back keeps the current
      // owner in place rather than leaving the instance with zero owners.
      const crowned = await tx
        .update(clanStaff)
        .set({ role: 'owner' })
        .where(and(eq(clanStaff.clanId, clan.id), eq(clanStaff.userId, targetId), eq(clanStaff.role, 'admin')))
        .returning({ id: clanStaff.id });
      if (crowned.length !== 1) {
        throw new Error('target-not-admin');
      }
      // Then demote the outgoing owner to a plain admin, in the same transaction — so the clan is
      // never left with two owners or none.
      await tx
        .update(clanStaff)
        .set({ role: 'admin' })
        .where(and(eq(clanStaff.clanId, clan.id), eq(clanStaff.userId, caller.id)));
    });
  } catch {
    return NextResponse.json({ error: 'Ownership can only be transferred to an admin' }, { status: 400 });
  }

  db.insert(clanAuditLog)
    .values({
      clanId: clan.id,
      eventType: 'ownership_transferred',
      actorUserId: caller.id,
      oldValue: JSON.stringify({ userId: caller.id }),
      newValue: JSON.stringify({ userId: targetId }),
      notes: `Ownership transferred from ${caller.displayName} to ${target.displayName}`,
    })
    .catch(() => {});

  return NextResponse.json({ success: true });
}
