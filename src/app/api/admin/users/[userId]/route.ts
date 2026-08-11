import { NextResponse } from 'next/server';
import { verifyUser } from '@/lib/auth';
import { db } from '@/db';
import { clanAuditLog, eventEditors, users } from '@/db/schema';
import { eq } from 'drizzle-orm';

const VALID_ROLES = new Set(['admin', 'treasurer', 'editor', 'moderator', 'member']);

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await verifyUser();
  const isAdmin = session?.role === 'admin';
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId } = await params;
  const targetId = parseInt(userId, 10);
  const { displayName, role, canEditTiles } = await request.json();

  if (role !== undefined && !VALID_ROLES.has(role)) {
    return NextResponse.json({ error: 'Role must be admin, treasurer, editor, moderator, or member' }, { status: 400 });
  }

  // The owner's role is locked — it can only change via the transfer-ownership flow. This protects
  // the person who provisioned the instance from being demoted by another admin.
  if (role !== undefined) {
    const target = await db.query.users.findFirst({ where: eq(users.id, targetId) });
    if (target?.isOwner) {
      return NextResponse.json({ error: "Cannot change the owner's role — transfer ownership instead" }, { status: 403 });
    }
  }

  // Prevent demoting last admin
  if (role && role !== 'admin') {
    const admins = await db.select().from(users).where(eq(users.role, 'admin'));
    const target = admins.find((u) => u.id === targetId);
    if (target && admins.length <= 1) {
      return NextResponse.json({ error: 'Cannot demote the last admin' }, { status: 400 });
    }
  }

  // Capture prior role for audit trail.
  const before = role !== undefined ? await db.query.users.findFirst({ where: eq(users.id, targetId) }) : null;

  const updates: Record<string, unknown> = {};
  if (displayName !== undefined) updates.displayName = displayName;
  // Tile authoring is a capability, so it's set independently of the role — that's what makes
  // "a moderator who builds boards" or "a treasurer who does fees and tiles" possible without
  // inventing a role for each combination. Admin-only, like every other grant of power.
  if (canEditTiles !== undefined) updates.canEditTiles = canEditTiles === true;
  // A manual role pick is a coarse decision that supersedes any board-scoped-editor state:
  // reset editorScope to 'all' so picking 'editor' here always means a GLOBAL editor. Board
  // scoping is established only via the Boards control (grantEventEditor sets scope 'assigned').
  if (role !== undefined) {
    updates.role = role;
    updates.editorScope = 'all';
    // 'editor' is no longer offered in the UI — global authoring is the capability, and the role
    // survives only as lib/eventEditors' internal marker for a member holding board grants. If an
    // older client still sends it, express the intent the new way instead of resurrecting it.
    if (role === 'editor') {
      updates.role = 'member';
      updates.canEditTiles = true;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  await db.update(users).set(updates).where(eq(users.id, targetId));

  // Board grants are purged on any role change: they only make sense for a scoped editor, and a
  // leftover grant on a demoted member would still pass verifyTileEditorForEvent (the tile APIs
  // aren't behind middleware). Board editing must be re-granted via the Boards control afterwards.
  if (role !== undefined && before && before.role !== role) {
    await db.delete(eventEditors).where(eq(eventEditors.userId, targetId));
  }

  // Log promotion/demotion so the clan audit log shows the role change.
  if (before && role && before.role !== role) {
    db.insert(clanAuditLog)
      .values({
        eventType: role === 'member' ? 'demoted' : before.role === 'member' ? 'promoted' : 'role_changed',
        oldValue: JSON.stringify({ userId: targetId, role: before.role }),
        newValue: JSON.stringify({ userId: targetId, role }),
        actorUserId: session && session.userId > 0 ? session.userId : null,
      })
      .catch(() => {});
  }

  const updated = await db.select({
    id: users.id,
    displayName: users.displayName,
    role: users.role,
    createdAt: users.createdAt,
  }).from(users).where(eq(users.id, targetId));

  if (updated.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json(updated[0]);
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
