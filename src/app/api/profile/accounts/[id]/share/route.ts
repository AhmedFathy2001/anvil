import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { accounts } from '@/db/schema';
import { verifyUser } from '@/lib/auth';

// PATCH /api/profile/accounts/[id]/share — { shared: boolean }
//
// Publish one of your own accounts, or stop.
//
// Clans you are IN can always see the accounts you are in them with — a seat is that clan already
// knowing. Sharing is about the others: it lets a clan you are not in see this account, which is
// what makes a guest application, a cross-clan event entry or a public profile show a name instead
// of a blank.
//
// Off by default, and per account rather than per person, because "my main is public, my ironman is
// nobody's business" is the actual want.
//
// Keyed on the ACCOUNT and scoped to the caller's own person — there is no path here to publish
// somebody else's account, and no clan-side route may set this at all. It is the person's to give.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (typeof body?.shared !== 'boolean') {
    return NextResponse.json({ error: 'shared must be true or false' }, { status: 400 });
  }

  // The account itself, owned by the caller's person. Not via a seat: an account with no seat
  // anywhere is exactly the one someone most wants to publish or keep back, and routing this through
  // the roster would make those unreachable.
  const [updated] = await db
    .update(accounts)
    .set({ shared: body.shared })
    .where(and(eq(accounts.id, id), eq(accounts.playerId, session.playerId)))
    .returning({ id: accounts.id, rsn: accounts.rsn, shared: accounts.shared });

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ ok: true, account: updated });
}
