import { NextResponse } from 'next/server';
import { seatForRequest } from '@/lib/roster';
import { db } from '@/db';
import { accounts, clanRoster, eventParticipants, weeklyParticipants } from '@/db/schema';
import { mergeSeats } from '@/lib/mergeSeats';
import { findRosterSeat, updateAccountOfSeat } from '@/lib/roster';
import { and, eq, ne, sql } from 'drizzle-orm';
import { normalizeRsn, verifyAdminOrModerator } from '@/lib/auth';
import { log } from '@/lib/logger';

// POST /api/admin/clan/[id]/rename — records an OSRS username change.
// Updates the canonical rsn on clan_members and cascades the rename through
// every table that embeds the RSN alongside a clan_member_id FK:
//   - eventParticipants.name (current-event enrollments)
//   - weekly_participants.rsn + rsnNormalized (keeps FK, no re-enrollment)
//
// Merge handling: if the new RSN already exists as a separate seat in this clan (clan-sync
// seats a renamed player's new name as a stranger), that seat is folded into this one first.
// Only refused (409) when the two are claimed by different people.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Roster work is moderation: mods add, edit and remove members like admins do. Nothing here can
  // change what someone can DO on the site — UpdatableFields covers rank/notes/guest/primary only,
  // and site roles + the tile-authoring capability are set through /api/admin/staff, which stays
  // admin-only. So a moderator can never promote themselves or anyone else.
  const user = await verifyAdminOrModerator();
  if (!user) {
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

  const source = await seatForRequest(request, memberId);
  if (!source) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  if (source.rsnNormalized === newNormalized) {
    // Noop: only the casing changed. Still worth refreshing display casing.
    if (source.rsn !== newRsn) {
      await updateAccountOfSeat(memberId, { rsn: newRsn });
    }
    return NextResponse.json({ ok: true, casingOnly: true });
  }

  // Is there already another row for the new RSN?
  const conflict = await findRosterSeat(
    and(
      eq(clanRoster.clanId, source.clanId),
      eq(clanRoster.rsnNormalized, newNormalized),
      ne(clanRoster.id, memberId),
    ),
  );

  if (conflict) {
    // The usual case: clan-sync matches by name, so the new name already arrived as a separate
    // "joined" seat (ranked, maybe enrolled in the week) while this one went "left". That is the
    // same account — fold it into this seat so the history here survives, then rename below.
    const merged = await mergeSeats({
      clanId: source.clanId,
      sourceId: conflict.id,
      targetId: memberId,
      actorUserId: user.userId > 0 ? user.userId : null,
      note: `Rename ${source.rsn} → ${newRsn}`,
    });
    if (!merged.ok) {
      return NextResponse.json(
        { error: 'mergeRequired', message: merged.error, conflictMemberId: conflict.id },
        { status: 409 },
      );
    }
    log.info('clan.rename.merge', {
      adminUserId: user.userId,
      sourceId: memberId,
      mergedId: conflict.id,
      newRsn,
    });
  }

  // The name being given up joins the account's rename history (read AFTER any merge above, which
  // may already have rewritten it), and the new one leaves it.
  const [fresh] = await db
    .select({ rsn: accounts.rsn, previousRsns: accounts.previousRsns })
    .from(accounts)
    .where(eq(accounts.id, source.accountId))
    .limit(1);
  let previous: string[] = [];
  try {
    const parsed = JSON.parse(fresh?.previousRsns ?? '[]');
    if (Array.isArray(parsed)) previous = parsed;
  } catch {
    /* malformed history: start over */
  }
  const previousRsns = Array.from(new Set([...previous, source.rsn, fresh?.rsn ?? source.rsn]))
    .filter((n) => n && normalizeRsn(n) !== newNormalized);

  // Canonical rename on the ACCOUNT — so it is visible in every clan this account plays in, which
  // is the point of accounts being global.
  await updateAccountOfSeat(memberId, {
    rsn: newRsn,
    rsnNormalized: newNormalized,
    previousRsns: previousRsns.length ? JSON.stringify(previousRsns) : null,
  });

  // Cascade the name to every FK-carrying row.
  await db
    .update(eventParticipants)
    .set({ name: newRsn })
    .where(eq(eventParticipants.clanMemberId, memberId));

  // A week both names were enrolled in (the merge above moved the new name's row here) already
  // holds the new name, and (competition, rsn) is unique — leave the old-name row of that week be.
  await db
    .update(weeklyParticipants)
    .set({ rsn: newRsn, rsnNormalized: newNormalized })
    .where(
      and(
        eq(weeklyParticipants.clanMemberId, memberId),
        sql`not exists (select 1 from weekly_participants wp where wp.competition_id = ${sql.raw('"weekly_participants"."competition_id"')} and wp.rsn_normalized = ${newNormalized})`,
      ),
    );

  log.info('clan.rename.ok', {
    adminUserId: user.userId,
    memberId,
    from: source.rsn,
    to: newRsn,
  });

  return NextResponse.json({ ok: true, memberId, rsn: newRsn });
}
