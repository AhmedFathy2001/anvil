import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { players } from '@/db/schema';
import { verifyUser } from '@/lib/auth';

// PATCH /api/profile/discover-events — { show: boolean }
//
// Whether the apex home shows public boards from clans this person is not in ("Open to everyone").
// On by default; switched from the section itself. Keyed on the caller's own person only.
export async function PATCH(request: Request) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.playerId == null) {
    return NextResponse.json({ error: 'No person on this account yet' }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  if (typeof body?.show !== 'boolean') {
    return NextResponse.json({ error: 'show must be true or false' }, { status: 400 });
  }

  const [row] = await db
    .update(players)
    .set({ discoverEvents: body.show })
    .where(eq(players.id, session.playerId))
    .returning({ show: players.discoverEvents });

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true, show: row.show });
}
