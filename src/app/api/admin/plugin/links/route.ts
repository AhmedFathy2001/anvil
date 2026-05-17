import { NextResponse } from 'next/server';
import { verifyUser } from '@/lib/auth';
import { db } from '@/db';
import { pluginLinks, users } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

// GET — list all plugin links (admin view). Admins see everyone's; moderators see only their own.
export async function GET() {
  const user = await verifyUser();
  if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await db
    .select({
      id: pluginLinks.id,
      userId: pluginLinks.userId,
      username: users.discordUsername,
      displayName: users.displayName,
      createdAt: pluginLinks.createdAt,
      lastUsedAt: pluginLinks.lastUsedAt,
      revokedAt: pluginLinks.revokedAt,
    })
    .from(pluginLinks)
    .leftJoin(users, eq(pluginLinks.userId, users.id))
    .orderBy(desc(pluginLinks.createdAt));

  const scoped = user.role === 'admin' ? rows : rows.filter((r) => r.userId === user.userId);
  return NextResponse.json(scoped);
}
