import { NextResponse } from 'next/server';
import { db } from '@/db';
import { accounts, clanAuditLog, clanRoster, detectedAccounts, eventParticipants, events } from '@/db/schema';
import { findRosterSeat, unclaimAccountOfSeat, updateAccountOfSeat } from '@/lib/roster';
import { and, desc, eq, gt, isNull, or } from 'drizzle-orm';
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
  await db.update(accounts).set({ isPrimary: 1 }).where(eq(accounts.id, id));

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
// Unlink one of the caller's RuneScape accounts from their profile — detaches ownership
// (userId → null) without deleting the clan_member, so clan roster/history survives and the
// account can be re-added later (playing it re-surfaces it in the detected-accounts inbox).
//
// Blocked while the account is in a LIVE event: removing it mid-event would orphan its team
// slot and drop tracking. Ended/upcoming events don't block. Authoritative check here — the
// UI also gates the button but never trust that alone.
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

  // Live-event guard: any player row in a non-force-ended event that hasn't ended yet.
  const nowIso = new Date().toISOString();
  // clan-scope: global -- the subject is a PERSON, whose seats span clans by design; scoped to their own.
  const activeRows = await db
    .select({ id: eventParticipants.id })
    .from(eventParticipants)
    .innerJoin(events, eq(eventParticipants.eventId, events.id))
    .where(
      and(
        eq(eventParticipants.clanMemberId, id),
        isNull(events.forceEndedAt),
        or(isNull(events.endDate), gt(events.endDate, nowIso)),
      ),
    )
    .limit(1);
  if (activeRows.length > 0) {
    return NextResponse.json(
      { error: 'This account is in an active event — you can remove it once the event ends.' },
      { status: 409 },
    );
  }

  // Detach ownership. Keep the row (and its verification/accountHash) so a future re-add
  // cleanly re-claims it.
  await unclaimAccountOfSeat(id);

  // Drop a sticky "Ignored" marker so the auto-link-on-play doesn't immediately re-add the account
  // the user just removed. It shows in the collapsed Ignored list on their profile, re-addable there.
  const marker = await db.query.detectedAccounts.findFirst({
    where: and(eq(detectedAccounts.userId, session.userId), eq(detectedAccounts.rsnNormalized, member.rsnNormalized)),
  });
  if (marker) {
    await db
      .update(detectedAccounts)
      .set({ status: 'dismissed', rsn: member.rsn, accountHash: member.accountHash ?? marker.accountHash, lastSeenAt: nowIso })
      .where(eq(detectedAccounts.id, marker.id));
  } else {
    await db.insert(detectedAccounts).values({
      userId: session.userId,
      rsn: member.rsn,
      rsnNormalized: member.rsnNormalized,
      accountHash: member.accountHash ?? null,
      status: 'dismissed',
      detectedAt: nowIso,
      lastSeenAt: nowIso,
    });
  }

  // If we just removed the primary, promote another owned account so the user still has one.
  if (member.isPrimary === 1) {
    // clan-scope: global -- the subject is a PERSON, and their seats span clans by design; scoped to the caller's own via clanRoster.playerId.
    const [next] = await db
      .select()
      .from(clanRoster)
      .where(and(eq(clanRoster.playerId, session.playerId), isNull(clanRoster.leftAt)))
      .orderBy(desc(clanRoster.verifiedAt))
      .limit(1);
    if (next) await db.update(accounts).set({ isPrimary: 1 }).where(eq(accounts.id, next.accountId));
  }

  db.insert(clanAuditLog)
    .values({
      clanMemberId: id,
      eventType: 'unclaimed',
      oldValue: JSON.stringify({ userId: session.userId, rsn: member.rsn }),
      actorUserId: session.userId,
    })
    .catch(() => {});

  return NextResponse.json({ ok: true });
}
