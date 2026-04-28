import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanMembers, players, pluginLinks, weeklyParticipants } from '@/db/schema';
import { and, eq, ne } from 'drizzle-orm';
import { normalizeRsn, verifyUser } from '@/lib/auth';
import { log } from '@/lib/logger';

// POST /api/admin/clan/[id]/rename — records an OSRS username change.
// Updates the canonical rsn on clan_members and cascades the rename through
// every table that embeds the RSN alongside a clan_member_id FK:
//   - players.name (current-event enrollments)
//   - weekly_participants.rsn + rsnNormalized (keeps FK, no re-enrollment)
//   - plugin_links.rsn + rsnNormalized (admin's linked RSN follows them)
//
// Merge handling: if the new RSN already exists as a separate clan member,
// we only auto-merge when that target is an unused guest (no players, no
// weekly participants, no plugin links). Otherwise we refuse with 409 so
// an admin can reconcile manually rather than lose history.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await verifyUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const memberId = Number(id);
  if (!Number.isInteger(memberId)) {
    return NextResponse.json({ error: 'Bad id' }, { status: 400 });
  }

  let body: { newRsn?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const newRsn = (body.newRsn || '').trim();
  if (!newRsn) {
    return NextResponse.json({ error: 'newRsn required' }, { status: 400 });
  }
  if (newRsn.length > 32) {
    return NextResponse.json({ error: 'newRsn too long' }, { status: 400 });
  }
  const newNormalized = normalizeRsn(newRsn);

  const source = await db.query.clanMembers.findFirst({
    where: eq(clanMembers.id, memberId),
  });
  if (!source) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  if (source.rsnNormalized === newNormalized) {
    // Noop: only the casing changed. Still worth refreshing display casing.
    if (source.rsn !== newRsn) {
      await db.update(clanMembers).set({ rsn: newRsn }).where(eq(clanMembers.id, memberId));
    }
    return NextResponse.json({ ok: true, casingOnly: true });
  }

  // Is there already another row for the new RSN?
  const conflict = await db.query.clanMembers.findFirst({
    where: and(
      eq(clanMembers.rsnNormalized, newNormalized),
      ne(clanMembers.id, memberId),
    ),
  });

  if (conflict) {
    const [conflictPlayers, conflictWeekly, conflictLinks] = await Promise.all([
      db.select({ id: players.id }).from(players).where(eq(players.clanMemberId, conflict.id)),
      db.select({ id: weeklyParticipants.id }).from(weeklyParticipants).where(eq(weeklyParticipants.clanMemberId, conflict.id)),
      db.select({ id: pluginLinks.id }).from(pluginLinks).where(eq(pluginLinks.rsnNormalized, newNormalized)),
    ]);

    const isUnusedGuest =
      conflict.isGuest === 1
      && conflictPlayers.length === 0
      && conflictWeekly.length === 0
      && conflictLinks.length === 0;

    if (!isUnusedGuest) {
      return NextResponse.json(
        {
          error: 'mergeRequired',
          message: 'A clan member with that RSN already exists and has activity. Resolve manually.',
          conflictMemberId: conflict.id,
          conflictCounts: {
            players: conflictPlayers.length,
            weeklyParticipants: conflictWeekly.length,
            pluginLinks: conflictLinks.length,
          },
        },
        { status: 409 },
      );
    }

    // Unused guest: drop it so the rename can proceed.
    await db.delete(clanMembers).where(eq(clanMembers.id, conflict.id));
    log.info('clan.rename.merge', {
      adminUserId: user.userId,
      sourceId: memberId,
      mergedId: conflict.id,
      newRsn,
    });
  }

  // Canonical rename on clan_members.
  await db
    .update(clanMembers)
    .set({ rsn: newRsn, rsnNormalized: newNormalized })
    .where(eq(clanMembers.id, memberId));

  // Cascade the name to every FK-carrying row.
  await db
    .update(players)
    .set({ name: newRsn })
    .where(eq(players.clanMemberId, memberId));

  await db
    .update(weeklyParticipants)
    .set({ rsn: newRsn, rsnNormalized: newNormalized })
    .where(eq(weeklyParticipants.clanMemberId, memberId));

  // Admin plugin links are bound to the RSN string; follow the rename so the
  // admin doesn't have to re-link after changing their own name.
  await db
    .update(pluginLinks)
    .set({ rsn: newRsn, rsnNormalized: newNormalized })
    .where(eq(pluginLinks.rsnNormalized, source.rsnNormalized));

  log.info('clan.rename.ok', {
    adminUserId: user.userId,
    memberId,
    from: source.rsn,
    to: newRsn,
  });

  return NextResponse.json({ ok: true, memberId, rsn: newRsn });
}
