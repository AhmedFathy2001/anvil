import { NextResponse } from 'next/server';
import { verifyAdminOrModerator } from '@/lib/auth';
import { db } from '@/db';
import { clanMembers } from '@/db/schema';
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

  const existing = await db.query.clanMembers.findFirst({ where: eq(clanMembers.id, memberId) });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Set-primary: demote the person's other accounts, promote this one. Only meaningful for a linked
  // account (a person is a users row) — a ghost/unlinked account has no siblings to be primary among.
  if (body.setPrimary) {
    if (existing.userId == null) {
      return NextResponse.json({ error: 'Only a linked account can be set as the main.' }, { status: 400 });
    }
    await db.update(clanMembers).set({ isPrimary: 0 }).where(eq(clanMembers.userId, existing.userId));
    await db.update(clanMembers).set({ isPrimary: 1 }).where(eq(clanMembers.id, memberId));
    return NextResponse.json({ ok: true });
  }

  const update: Record<string, unknown> = {};
  if (body.rank !== undefined) update.rank = body.rank;
  if (body.discordId !== undefined) update.discordId = body.discordId;
  if (body.isGuest !== undefined) update.isGuest = body.isGuest ? 1 : 0;
  if (body.notes !== undefined) update.notes = body.notes;
  if (body.rejoin) update.leftAt = null;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  await db.update(clanMembers).set(update).where(eq(clanMembers.id, memberId));
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
    .update(clanMembers)
    .set({ leftAt: new Date().toISOString() })
    .where(eq(clanMembers.id, memberId));

  return NextResponse.json({ ok: true });
}
