import { NextResponse } from 'next/server';
import { verifyUser } from '@/lib/auth';
import { db } from '@/db';
import { clanAuditLog, clanStaff, eventEditors, users } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { atLeast, canGrantRole, canModify, type ClanRole } from '@/lib/clanRoles';
import { clanGrant } from '@/lib/clanGrants';
import { requireClanFromRequest } from '@/lib/clanContext';

const SETTABLE_ROLES = new Set<ClanRole>(['admin', 'treasurer', 'moderator', 'member']);

/**
 * Set someone's role IN THIS CLAN.
 *
 * The grant is a clan_staff row, not a column on the user: being an admin here must confer nothing
 * anywhere else, and a role written onto the person would confer it everywhere at once.
 *
 * Two escalation guards, both server-side because the UI cannot be the check: nobody may hand out a
 * role at or above their own, and nobody may modify someone at or above their own grade. Without the
 * first, a moderator's first act is to promote themselves; without the second, two admins can demote
 * each other.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await verifyUser();
  if (!session || !atLeast(session.role, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clan = await requireClanFromRequest(request);
  if (!clan) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { userId } = await params;
  const targetId = parseInt(userId, 10);
  if (!Number.isInteger(targetId)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  const { displayName, role, canEditTiles } = await request.json();

  if (role !== undefined && !SETTABLE_ROLES.has(role)) {
    return NextResponse.json({ error: 'Role must be admin, treasurer, moderator, or member' }, { status: 400 });
  }

  const existing = await clanGrant(clan.id, targetId);

  // The owner's grant is locked — it moves only through the transfer-ownership flow, so the person
  // who set the clan up cannot be demoted by an admin they appointed.
  if (existing?.isOwner && role !== undefined) {
    return NextResponse.json(
      { error: "Cannot change the owner's role — transfer ownership instead" },
      { status: 403 },
    );
  }

  // Never act on a peer or a superior.
  if (!canModify(session.role, existing?.role ?? 'member')) {
    return NextResponse.json({ error: 'You cannot modify someone at or above your own role' }, { status: 403 });
  }
  // Never hand out a role at or above your own.
  if (role !== undefined && !canGrantRole(session.role, role)) {
    return NextResponse.json({ error: 'You cannot grant a role at or above your own' }, { status: 403 });
  }

  // The clan must keep an admin. Counted within this clan — another clan's admins are no help here.
  if (role !== undefined && role !== 'admin' && existing && atLeast(existing.role, 'admin')) {
    const admins = await db
      .select({ userId: clanStaff.userId })
      .from(clanStaff)
      .where(and(eq(clanStaff.clanId, clan.id), inArray(clanStaff.role, ['admin', 'owner'])));
    if (admins.length <= 1) {
      return NextResponse.json({ error: 'Cannot demote the last admin' }, { status: 400 });
    }
  }

  if (displayName !== undefined) {
    await db.update(users).set({ displayName }).where(eq(users.id, targetId));
  }

  const wantsGrant = role !== undefined || canEditTiles !== undefined;
  if (wantsGrant) {
    const nextRole: ClanRole = (role ?? existing?.role ?? 'member') as ClanRole;
    const nextCanEdit = canEditTiles !== undefined ? canEditTiles === true : existing?.canEditTiles === true;
    await db
      .insert(clanStaff)
      .values({
        clanId: clan.id,
        userId: targetId,
        role: nextRole,
        canEditTiles: nextCanEdit,
        // A manual role pick supersedes board scoping: picking a tier here always means clan-wide
        // reach. Board scoping is established only through the Boards control.
        editorScope: 'all',
      })
      .onConflictDoUpdate({
        target: [clanStaff.clanId, clanStaff.userId],
        set: { role: nextRole, canEditTiles: nextCanEdit, editorScope: 'all' },
      });
  }

  if (!wantsGrant && displayName === undefined) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  // Board grants are purged on any role change: they only make sense for a scoped editor, and a
  // leftover grant on a demoted member would still pass verifyTileEditorForEvent (the tile APIs
  // aren't behind middleware). Board editing must be re-granted afterwards.
  if (role !== undefined && role !== existing?.role) {
    await db.delete(eventEditors).where(eq(eventEditors.userId, targetId));

    db.insert(clanAuditLog)
      .values({
        clanId: clan.id,
        eventType: role === 'member' ? 'demoted' : (existing?.role ?? 'member') === 'member' ? 'promoted' : 'role_changed',
        oldValue: JSON.stringify({ userId: targetId, role: existing?.role ?? 'member' }),
        newValue: JSON.stringify({ userId: targetId, role }),
        actorUserId: session.userId > 0 ? session.userId : null,
      })
      .catch(() => {});
  }

  const [updatedUser] = await db
    .select({ id: users.id, displayName: users.displayName, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, targetId));
  if (!updatedUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const grant = await clanGrant(clan.id, targetId);
  return NextResponse.json({ ...updatedUser, role: grant?.role ?? 'member' });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const currentUser = await verifyUser();
  if (!currentUser || currentUser.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId } = await params;
  const targetId = parseInt(userId, 10);

  // Prevent deleting self
  if (currentUser.userId === targetId) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
  }

  const target = await db.select().from(users).where(eq(users.id, targetId));
  if (target.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // The owner account can never be deleted (by anyone, including the owner themselves) — ownership
  // must be transferred to another admin first. Keeps the instance from being orphaned or hijacked.
  if (target[0].isOwner) {
    return NextResponse.json({ error: 'Cannot delete the owner — transfer ownership first' }, { status: 403 });
  }

  // Prevent deleting last admin
  if (target[0].role === 'admin') {
    const admins = await db.select().from(users).where(eq(users.role, 'admin'));
    if (admins.length <= 1) {
      return NextResponse.json({ error: 'Cannot delete the last admin' }, { status: 400 });
    }
  }

  await db.delete(users).where(eq(users.id, targetId));
  return NextResponse.json({ success: true });
}
