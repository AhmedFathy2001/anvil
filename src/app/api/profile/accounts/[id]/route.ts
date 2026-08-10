import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanAuditLog, clanMembers, detectedAccounts, events, players } from '@/db/schema';
import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
import { syncRolesForClanMemberFireAndForget } from '@/lib/discord-roles';

// PATCH /api/profile/accounts/[id] — { primary: true }
//
// Promote one of the caller's own accounts to their primary (main), demoting the rest. The primary
// is the person's default representative: the name their team takes in per-person events, the RSN
// that leads their Discord nickname, and what other clans see first over federation. It used to be
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
  const member = await db.query.clanMembers.findFirst({
    where: and(eq(clanMembers.id, id), eq(clanMembers.userId, session.userId), isNull(clanMembers.leftAt)),
  });
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (member.isPrimary === 1) return NextResponse.json({ ok: true });

  const previous = await db.query.clanMembers.findFirst({
    where: and(eq(clanMembers.userId, session.userId), eq(clanMembers.isPrimary, 1), isNull(clanMembers.leftAt)),
    columns: { id: true, rsn: true },
  });

  await db.update(clanMembers).set({ isPrimary: 0 }).where(eq(clanMembers.userId, session.userId));
  await db.update(clanMembers).set({ isPrimary: 1 }).where(eq(clanMembers.id, id));

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
  const member = await db.query.clanMembers.findFirst({
    where: and(eq(clanMembers.id, id), eq(clanMembers.userId, session.userId), isNull(clanMembers.leftAt)),
  });
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Live-event guard: any player row in a non-force-ended event that hasn't ended yet.
  const nowIso = new Date().toISOString();
  const activeRows = await db
    .select({ id: players.id })
    .from(players)
    .innerJoin(events, eq(players.eventId, events.id))
    .where(
      and(
        eq(players.clanMemberId, id),
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
  await db.update(clanMembers).set({ userId: null, isPrimary: 0 }).where(eq(clanMembers.id, id));

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
    const next = await db.query.clanMembers.findFirst({
      where: and(eq(clanMembers.userId, session.userId), isNull(clanMembers.leftAt)),
      orderBy: (m, { desc }) => [desc(m.verifiedAt)],
    });
    if (next) await db.update(clanMembers).set({ isPrimary: 1 }).where(eq(clanMembers.id, next.id));
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
