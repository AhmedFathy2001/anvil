import { NextResponse } from 'next/server';
import { verifyUser, hashPasswordBcrypt } from '@/lib/auth';
import { db } from '@/db';
import { clanAuditLog, users } from '@/db/schema';
import { eq } from 'drizzle-orm';

const VALID_ROLES = new Set(['admin', 'treasurer', 'moderator', 'member']);

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
  const { displayName, password, role } = await request.json();

  if (role !== undefined && !VALID_ROLES.has(role)) {
    return NextResponse.json({ error: 'Role must be admin, treasurer, moderator, or member' }, { status: 400 });
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
  if (role !== undefined) updates.role = role;
  if (password) {
    updates.passwordHash = await hashPasswordBcrypt(password);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  await db.update(users).set(updates).where(eq(users.id, targetId));

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
    username: users.username,
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

  // Prevent deleting last admin
  const target = await db.select().from(users).where(eq(users.id, targetId));
  if (target.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (target[0].role === 'admin') {
    const admins = await db.select().from(users).where(eq(users.role, 'admin'));
    if (admins.length <= 1) {
      return NextResponse.json({ error: 'Cannot delete the last admin' }, { status: 400 });
    }
  }

  await db.delete(users).where(eq(users.id, targetId));
  return NextResponse.json({ success: true });
}
