import { NextResponse } from 'next/server';
import { db } from '@/db';
import { accounts, clanAuditLog, clanRoster } from '@/db/schema';
import { findRosterSeat } from '@/lib/roster';
import { and, eq, isNull } from 'drizzle-orm';
import { LIVE_EVENT_RELEASE_MESSAGE, releaseCharacter } from '@/lib/accountRelease';
import { verifyUser } from '@/lib/auth';
import { syncRolesForClanMemberFireAndForget } from '@/lib/discord-roles';

// PATCH /api/profile/accounts/[id] — { primary: true }
//
// Promote one of the caller's own accounts to their primary (main), demoting the rest. The primary
// is the person's default representative: the name their team takes in per-person events, the RSN
// that leads their Discord nickname. It used to be
// implicit (first account linked wins) and only an admin could change it, from the clan roster.
//
// Deliberately not gated on verification — the same as the admin path. Picking an unverified alt is
// harmless (nickname sync only ever lists verified accounts) and instantly reversible.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  if (body?.primary !== true) {
    return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });
  }

  // Scope to the caller's own, still-linked accounts — the only rows they may promote.
  // clan-scope: global -- the subject is a PERSON, and their seats span clans by design; scoped to the caller's own via clanRoster.playerId.
  const member = await findRosterSeat(and(eq(clanRoster.id, id), eq(clanRoster.playerId, session.playerId), isNull(clanRoster.leftAt)));
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (member.isPrimary === 1) return NextResponse.json({ ok: true });

  // clan-scope: global -- the subject is a PERSON, and their seats span clans by design; scoped to the caller's own via clanRoster.playerId.
  const previous = await findRosterSeat(and(eq(clanRoster.playerId, session.playerId), eq(clanRoster.isPrimary, 1), isNull(clanRoster.leftAt)));

  await db.update(accounts).set({ isPrimary: 0 }).where(eq(accounts.playerId, session.playerId));
  // Keyed on the ACCOUNT, not the seat. `id` is a clan_roster/seat id (the URL param, matched as
  // clanRoster.id above); isPrimary lives on `accounts`, a different id space. Passing the seat id
  // as accounts.id set the flag on an unrelated account (often another user's) and left the caller
  // with no primary — the same bug the DELETE path and auth.ts avoid via seat.accountId.
  await db.update(accounts).set({ isPrimary: 1 }).where(eq(accounts.id, member.accountId));

  // The nickname is built from the person's verified RSNs ordered primary-first, so re-sync to put
  // the new main in front. Fire-and-forget: a Discord outage must not fail the change itself.
  syncRolesForClanMemberFireAndForget(id);

  db.insert(clanAuditLog)
    .values({
      clanMemberId: id,
      eventType: 'primary_changed',
      oldValue: previous ? JSON.stringify({ clanMemberId: previous.id, rsn: previous.rsn }) : null,
      newValue: JSON.stringify({ clanMemberId: id, rsn: member.rsn }),
      actorUserId: session.userId,
    })
    .catch(() => {});

  return NextResponse.json({ ok: true });
}

// DELETE /api/profile/accounts/[id]
//
// Unlink one of the caller's RuneScape accounts from their profile. The same act as the plugin's
// "Not my account" — see lib/accountRelease: ownership is detached (the seat and its history stay),
// the account lands in their Ignored list so playing it doesn't re-add it, and anybody else can now
// claim it.
//
// Blocked while the account is on a live or upcoming board: removing it mid-event would orphan its
// team slot and drop tracking. Authoritative check here — the UI also gates the button but never
// trust that alone.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  // Scope to the caller's own, still-linked accounts.
  // clan-scope: global -- the subject is a PERSON, and their seats span clans by design; scoped to the caller's own via clanRoster.playerId.
  const member = await findRosterSeat(and(eq(clanRoster.id, id), eq(clanRoster.playerId, session.playerId), isNull(clanRoster.leftAt)));
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const outcome = await releaseCharacter({
    userId: session.userId,
    playerId: session.playerId,
    accountId: member.accountId,
    via: 'profile',
  });
  if (!outcome.ok) {
    return outcome.reason === 'live-event'
      ? NextResponse.json({ error: LIVE_EVENT_RELEASE_MESSAGE }, { status: 409 })
      : NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
