import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { players } from '@/db/schema';
import { verifyUser } from '@/lib/auth';

// PATCH /api/profile/link-accounts — { link: boolean }
//
// Whether the apex may say that your shared characters are the same person.
//
// A SECOND decision, not a consequence of the first. `accounts.shared` publishes one character;
// this publishes the connection between them. Before it existed, sharing a second character
// silently announced that both belonged to one human — and that is the fact people are most likely
// to want kept, which is exactly why sharing is per-account. A main and an ironman can each be
// public without their owner wanting them tied together.
//
// Off by default, and instantly reversible: nothing is copied anywhere, so turning it off removes
// the person page and the "also plays" line and that is the whole of it.
//
// Keyed on the caller's own person. There is no path here to link somebody else's accounts, and no
// clan-side route may set this at all — a clan does not get to publish who its members are.
export async function PATCH(request: Request) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.playerId == null) {
    return NextResponse.json({ error: 'No person on this account yet' }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  if (typeof body?.link !== 'boolean') {
    return NextResponse.json({ error: 'link must be true or false' }, { status: 400 });
  }

  const [row] = await db
    .update(players)
    .set({ linkAccountsPublicly: body.link })
    .where(eq(players.id, session.playerId))
    .returning({ id: players.id, link: players.linkAccountsPublicly });

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true, link: row.link });
}
