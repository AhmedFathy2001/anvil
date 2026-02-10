import { NextResponse } from 'next/server';
import { verifyAdmin, verifyUser, hashPasswordBcrypt } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId } = await params;
  const targetId = parseInt(userId, 10);
  const { displayName, password, role } = await request.json();

  // Prevent demoting last admin
  if (role && role !== 'admin') {
    const admins = await db.select().from(users).where(eq(users.role, 'admin'));
    const target = admins.find(u => u.id === targetId);
    if (target && admins.length <= 1) {
      return NextResponse.json({ error: 'Cannot demote the last admin' }, { status: 400 });
    }
  }

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
