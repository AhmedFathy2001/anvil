import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { clanStaff, users } from '@/db/schema';
import { personOf } from '@/lib/roster';
import { verifyUser } from '@/lib/auth';
import { requireClanFromRequest } from '@/lib/clanContext';
import { banFromClan, liftClanBan } from '@/lib/clanBans';

// POST /api/admin/users/[userId]/ban   Body: { banned: boolean, reason?: string }
//
// Bars someone from THIS CLAN. Their seats here are emptied and they cannot rejoin until it is
// lifted. Everything else about them is untouched: they keep their account, their profile, their
// history — here and everywhere — and they stay signed in to every other clan they belong to.
//
// This used to write `users.banned`, which verifyUser refuses a session on. That made a clan
// moderator's "ban" a platform ban: the person lost every clan on the deployment and the platform
// with it. Barring someone from the platform is /staff's, and a clan surface must be structurally
// unable to reach it — see tests/platform-authority.test.ts, which fails the build if this file
// ever writes that column again.
export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const actor = await verifyUser();
  if (actor?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  // The clan doing the barring is the one whose site this is.
  const clan = await requireClanFromRequest(request);
  if (!clan) return NextResponse.json({ error: 'Not found' }, { status: 404 });

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
    columns: { id: true },
  });
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // The owner OF THIS CLAN is unbannable here. Read from the grant rather than a flag on the user:
  // being owner of some other clan is no protection in this one, and should not be.
  const targetGrant = await db.query.clanStaff.findFirst({
    where: eq(clanStaff.userId, targetId),
    columns: { role: true, clanId: true },
  });
  if (targetGrant?.clanId === clan.id && targetGrant.role === 'owner') {
    return NextResponse.json({ error: 'The clan owner cannot be banned' }, { status: 400 });
  }

  const playerId = await personOf(targetId);
  if (playerId == null) {
    return NextResponse.json({ error: 'That login has no person to ban' }, { status: 400 });
  }

  if (!banned) {
    const lifted = await liftClanBan(clan.id, playerId, actor.userId);
    return NextResponse.json({ ok: true, banned: false, lifted });
  }

  const result = await banFromClan({
    clanId: clan.id,
    playerId,
    reason: body.reason ?? null,
    byUserId: actor.userId,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ ok: true, banned: true, seatsCleared: result.seatsCleared });
}
