import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { accounts } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { setGameClanHidden } from '@/lib/gameClans';

// PATCH /api/profile/accounts/[id]/game-clan — { hidden: boolean }
//
// Show or hide the in-game clan the plugin reported for one of your own characters (lib/gameClans).
// Hidden, it leaves the character's profile and that clan's ghost page. Scoped to the caller's own
// person, the same as the share switch beside it.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const body = await request.json().catch(() => null);
  if (typeof body?.hidden !== 'boolean') {
    return NextResponse.json({ error: 'hidden must be true or false' }, { status: 400 });
  }

  const [own] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.playerId, session.playerId)))
    .limit(1);
  if (!own) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await setGameClanHidden(own.id, body.hidden);
  return NextResponse.json({ ok: true, hidden: body.hidden });
}
