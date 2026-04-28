import { NextResponse } from 'next/server';
import { verifyUser, generatePluginLinkCode } from '@/lib/auth';
import { db } from '@/db';
import { pluginLinkCodes } from '@/db/schema';
import { and, eq, isNull, lt } from 'drizzle-orm';

const CODE_TTL_MS = 10 * 60 * 1000;

// POST — admin generates a fresh one-time link code they paste into the plugin.
export async function POST() {
  const user = await verifyUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (user.userId <= 0) {
    return NextResponse.json(
      { error: 'Legacy admin token cannot generate a plugin link. Log in with a real user account.' },
      { status: 400 },
    );
  }

  // Opportunistic cleanup: purge expired/consumed codes for this user
  const now = new Date();
  await db
    .delete(pluginLinkCodes)
    .where(and(eq(pluginLinkCodes.userId, user.userId), lt(pluginLinkCodes.expiresAt, now.toISOString())));

  // Generate a unique code (retry on collision — alphabet * length gives ~887M, rare)
  let code = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    code = generatePluginLinkCode();
    const existing = await db.query.pluginLinkCodes.findFirst({
      where: and(eq(pluginLinkCodes.code, code), isNull(pluginLinkCodes.consumedAt)),
    });
    if (!existing) break;
    code = '';
  }
  if (!code) {
    return NextResponse.json({ error: 'Could not generate unique code, try again' }, { status: 500 });
  }

  const expiresAt = new Date(now.getTime() + CODE_TTL_MS).toISOString();
  await db.insert(pluginLinkCodes).values({
    userId: user.userId,
    code,
    expiresAt,
  });

  return NextResponse.json({ code, expiresAt, ttlSeconds: CODE_TTL_MS / 1000 });
}
