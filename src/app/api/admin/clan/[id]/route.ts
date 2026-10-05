import { NextResponse } from 'next/server';
import { seatForRequest } from '@/lib/roster';
import { verifyAdminOrModerator } from '@/lib/auth';
import { db } from '@/db';
import { accounts, clanMemberships } from '@/db/schema';
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

  const existing = await seatForRequest(request, memberId);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Set-primary is the PERSON's choice — a main is a main in every clan, so one clan's staff picking
  // it for them reached into all the others. They set it on their own profile.
  if (body.setPrimary) {
    return NextResponse.json(
      { error: 'A player picks their own main on their profile. Clan staff manage the roster, not the character.' },
      { status: 403 },
    );
  }

  // Split by where each field lives: the Discord id belongs to the account, everything else to
  // this clan's seat. An admin editing their own roster must not be able to reach past it.
  const seatPatch: Record<string, unknown> = {};
  if (body.rank !== undefined) seatPatch.rank = body.rank;
  if (body.isGuest !== undefined) seatPatch.kind = body.isGuest ? 'guest' : 'member';
  if (body.notes !== undefined) seatPatch.notes = body.notes;
  if (body.rejoin) seatPatch.leftAt = null;

  // The Discord id is a name-match CACHE on an unclaimed roster entry. Once a person has claimed the
  // character their own Discord login is the answer, and a clan overwriting it would be one clan
  // editing that person everywhere.
  const accountPatch: Record<string, unknown> = {};
  if (body.discordId !== undefined) {
    if (existing.claimedAt != null) {
      return NextResponse.json(
        { error: 'This character belongs to a player — their Discord comes from their own login. Report it to Anvil if it is wrong.' },
        { status: 403 },
      );
    }
    accountPatch.discordId = body.discordId;
  }

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
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  // Whose seat is this? The id came from the URL, and removing someone from a roster is not
  // something an admin of a different clan gets to do.
  if (!(await seatForRequest(request, memberId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await db
    .update(clanMemberships)
    .set({ leftAt: new Date().toISOString() })
    .where(eq(clanMemberships.id, memberId));

  return NextResponse.json({ ok: true });
}
