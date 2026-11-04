import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanAuditLog, clanRoster } from '@/db/schema';
import { LIVE_EVENT_RELEASE_MESSAGE, releaseCharacter } from '@/lib/accountRelease';
import { verifyUser } from '@/lib/auth';
import { syncRolesForClanMemberFireAndForget } from '@/lib/discord-roles';
import { findRosterSeats } from '@/lib/roster';

/**
 * /api/profile/characters/[accountId] — the settings page's per-character actions, keyed by ACCOUNT.
 *
 * The older /api/profile/accounts/[id] is keyed by a clan seat, because it was written for the clan
 * locker. Settings is not inside a clan, and a character with no seat anywhere (a fresh claim, a
 * solo player) still needs to be made main or removed — so these take the account and check the
 * caller owns it.
 */
async function ownedAccount(rawId: string, playerId: number) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const row = await db.query.accounts.findFirst({
    where: and(eq(accounts.id, id), eq(accounts.playerId, playerId)),
  });
  return row ?? null;
}

// PATCH { primary: true } — make this character the person's main.
export async function PATCH(request: Request, { params }: { params: Promise<{ accountId: string }> }) {
  const session = await verifyUser();
  if (!session?.userId || !session.playerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const account = await ownedAccount((await params).accountId, session.playerId);
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  if (body?.primary !== true) return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });
  if (account.isPrimary === 1) return NextResponse.json({ ok: true });

  const previous = await db.query.accounts.findFirst({
    where: and(eq(accounts.playerId, session.playerId), eq(accounts.isPrimary, 1)),
  });
  await db.update(accounts).set({ isPrimary: 0 }).where(eq(accounts.playerId, session.playerId));
  await db.update(accounts).set({ isPrimary: 1 }).where(eq(accounts.id, account.id));

  // The main leads the Discord nickname in every clan that has a seat for it.
  // clan-scope: global -- the subject is the caller's own character, whose seats span clans by design.
  const seats = await findRosterSeats(and(eq(clanRoster.accountId, account.id), isNull(clanRoster.leftAt)));
  for (const s of seats) {
    syncRolesForClanMemberFireAndForget(s.id);
    db.insert(clanAuditLog)
      .values({
        clanId: s.clanId,
        clanMemberId: s.id,
        eventType: 'primary_changed',
        oldValue: previous ? JSON.stringify({ accountId: previous.id, rsn: previous.rsn }) : null,
        newValue: JSON.stringify({ clanMemberId: s.id, rsn: account.rsn }),
        actorUserId: session.userId,
      })
      .catch(() => {});
  }

  return NextResponse.json({ ok: true });
}

// DELETE — unlink this character from the person (lib/accountRelease).
export async function DELETE(_request: Request, { params }: { params: Promise<{ accountId: string }> }) {
  const session = await verifyUser();
  if (!session?.userId || !session.playerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const account = await ownedAccount((await params).accountId, session.playerId);
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const outcome = await releaseCharacter({
    userId: session.userId,
    playerId: session.playerId,
    accountId: account.id,
    via: 'profile',
  });
  if (!outcome.ok) {
    return outcome.reason === 'live-event'
      ? NextResponse.json({ error: LIVE_EVENT_RELEASE_MESSAGE }, { status: 409 })
      : NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
