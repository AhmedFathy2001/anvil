import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, clanAuditLog, clanRoster } from '@/db/schema';
import { findRosterSeat, personOf, seatsOwnedBy } from '@/lib/roster';
import { eq } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';

// POST /api/admin/users/[userId]/ban   Body: { banned: boolean, reason?: string }
//
// Admin-only. Bans/unbans a site user: a banned user gets no authenticated session (verifyUser →
// null on their next request) and is refused a session on Discord login. The clan owner can never
// be banned, and you can't ban yourself.
export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const actor = await verifyUser();
  if (actor?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { userId: idParam } = await params;
  const targetId = Number(idParam);
  if (!Number.isInteger(targetId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  if (targetId === actor.userId) return NextResponse.json({ error: 'You cannot ban yourself' }, { status: 400 });

  let body: { banned?: boolean; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const banned = body.banned === true;

  const target = await db.query.users.findFirst({
    where: eq(users.id, targetId),
    columns: { id: true, isOwner: true },
  });
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (target.isOwner) return NextResponse.json({ error: 'The clan owner cannot be banned' }, { status: 400 });

  const nowIso = new Date().toISOString();
  await db
    .update(users)
    .set({
      banned,
      bannedAt: banned ? nowIso : null,
      bannedReason: banned ? body.reason?.trim().slice(0, 500) || null : null,
      bannedByUserId: banned ? actor.userId : null,
    })
    .where(eq(users.id, targetId));

  // Audit against one of the user's clan members (if any) so it shows in the clan history.
  const cm = await findRosterSeat(await seatsOwnedBy(targetId));
  if (cm) {
    db.insert(clanAuditLog)
      .values({
        clanMemberId: cm.id,
        eventType: banned ? 'banned' : 'unbanned',
        newValue: JSON.stringify({ userId: targetId, reason: body.reason ?? null }),
        actorUserId: actor.userId,
      })
      .catch(() => {});
  }

  return NextResponse.json({ ok: true, banned });
}
