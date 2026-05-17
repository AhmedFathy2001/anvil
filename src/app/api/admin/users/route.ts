import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';

export async function GET() {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const allUsers = await db.select({
    id: users.id,
    displayName: users.displayName,
    role: users.role,
    createdAt: users.createdAt,
    discordId: users.discordId,
    discordUsername: users.discordUsername,
    discordAvatar: users.discordAvatar,
    lastLoginAt: users.lastLoginAt,
  }).from(users);

  return NextResponse.json(allUsers);
}
