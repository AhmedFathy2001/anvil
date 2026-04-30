import { NextResponse } from 'next/server';
import { verifyUser, generatePluginLinkCode } from '@/lib/auth';
import { db } from '@/db';
import { pluginLinkCodes } from '@/db/schema';
import { and, eq, isNull, lt } from 'drizzle-orm';

const CODE_TTL_MS = 10 * 60 * 1000;

// POST /api/auth/link-code — any logged-in user generates a one-time code to paste
// into the RuneLite plugin. The plugin then sends {code, rsn, accountHash} to
// /api/plugin/link, which captures the Jagex account hash and marks the clan member
// verified under this user.
export async function POST() {
  const user = await verifyUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (user.userId <= 0) {
    return NextResponse.json(
      { error: 'Legacy session cannot generate a plugin link. Sign in with Discord first.' },
      { status: 400 },
    );
  }

  const now = new Date();
  await db
    .delete(pluginLinkCodes)
    .where(and(eq(pluginLinkCodes.userId, user.userId), lt(pluginLinkCodes.expiresAt, now.toISOString())));

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
