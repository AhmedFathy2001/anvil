import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { accounts } from '@/db/schema';
import { verifyUser } from '@/lib/auth';

// PATCH /api/profile/accounts/[id]/share — { shared: boolean }
//
// Publish one of your own characters on the platform, or stop.
//
// WHAT THIS IS NOT, any more: it is not how a clan comes to see a character. That is a SEAT, which
// the clan's own door grants (lib/guestAdmission) — and a seat is also what lets the character play
// their events. This flag was doing both jobs and could only ever do one of them, so a person who
// ticked it was told their character was visible to clans that had never heard of it.
//
// What it decides is the PLATFORM's half: whether the character appears on its own profile and the
// cross-clan boards. On by default, and turning it off is how an ironman or a PK alt stays out of
// the public pages without giving up the clans it actually plays for.
//
// Per account rather than per person, because "my main is public, my ironman is nobody's business"
// is the actual want. New accounts are shared by default; ones that predate that default are not,
// which is what the prompt on the person page exists to ask about rather than assume.
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
