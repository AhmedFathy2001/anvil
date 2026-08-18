import { NextResponse } from 'next/server';
import { verifyAdminOrModerator } from '@/lib/auth';
import { db } from '@/db';
import { accounts, clanMemberships, clanRoster } from '@/db/schema';
import { findRosterSeat } from '@/lib/roster';
import { eq } from 'drizzle-orm';

type UpdatableFields = Partial<{
  rank: string | null;
  discordId: string | null;
  isGuest: boolean;
  notes: string | null;
  rejoin: boolean;
  // Promote this account to the person's primary (main), demoting their other accounts. Drives the
  // default "which account represents this person" for per-person events + team naming.
  setPrimary: boolean;
}>;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  if (!Number.isInteger(memberId)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  let body: UpdatableFields;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const existing = await findRosterSeat(eq(clanRoster.id, memberId));
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Set-primary: demote the person's other accounts, promote this one. Only meaningful for a linked
  // account (a person is a users row) — a ghost/unlinked account has no siblings to be primary among.
  if (body.setPrimary) {
    if (existing.playerId == null) {
      return NextResponse.json({ error: 'Only a linked account can be set as the main.' }, { status: 400 });
    }
    // Across every account this person owns, in every clan — a main is a main everywhere.
    await db.update(accounts).set({ isPrimary: 0 }).where(eq(accounts.playerId, existing.playerId));
    await db.update(accounts).set({ isPrimary: 1 }).where(eq(accounts.id, existing.accountId));
    return NextResponse.json({ ok: true });
  }

  // Split by where each field lives: the Discord id belongs to the account, everything else to
  // this clan's seat. An admin editing their own roster must not be able to reach past it.
  const seatPatch: Record<string, unknown> = {};
  if (body.rank !== undefined) seatPatch.rank = body.rank;
  if (body.isGuest !== undefined) seatPatch.kind = body.isGuest ? 'guest' : 'member';
  if (body.notes !== undefined) seatPatch.notes = body.notes;
  if (body.rejoin) seatPatch.leftAt = null;

  const accountPatch: Record<string, unknown> = {};
  if (body.discordId !== undefined) accountPatch.discordId = body.discordId;

  if (Object.keys(seatPatch).length === 0 && Object.keys(accountPatch).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  if (Object.keys(seatPatch).length > 0) {
    await db.update(clanMemberships).set(seatPatch).where(eq(clanMemberships.id, memberId));
  }
  if (Object.keys(accountPatch).length > 0) {
    await db.update(accounts).set(accountPatch).where(eq(accounts.id, existing.accountId));
  }
  return NextResponse.json({ ok: true });
}

// DELETE — soft-delete (mark as left). Preserves historical references.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  if (!Number.isInteger(memberId)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  await db
    .update(clanMemberships)
    .set({ leftAt: new Date().toISOString() })
    .where(eq(clanMemberships.id, memberId));

  return NextResponse.json({ ok: true });
}
