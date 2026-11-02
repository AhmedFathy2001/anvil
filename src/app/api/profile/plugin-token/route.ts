import { NextResponse } from 'next/server';
import { and, count, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { pluginLinks, users } from '@/db/schema';
import { mintDeviceToken, verifyUser } from '@/lib/auth';

// The person's plugin tokens, from their profile.
//
// SHOWN ONCE. Tokens are stored only as hashes (0138/0166), so the site can no longer show a token it
// issued earlier — it never kept it. What it can do is tell you whether you have any, mint another
// (shown this once, for pasting into a client), or revoke them all.

/** GET — how many live tokens this person has. Never the tokens themselves. */
export async function GET() {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
    columns: { pluginTokenHash: true },
  });
  const [links] = await db
    .select({ n: count() })
    .from(pluginLinks)
    .where(and(eq(pluginLinks.userId, session.userId), isNull(pluginLinks.revokedAt)));
  return NextResponse.json({ tokens: (user?.pluginTokenHash ? 1 : 0) + Number(links?.n ?? 0) });
}

/**
 * POST { action: 'new' }    — mint a token for one more client and return it, once.
 * POST { action: 'revoke' } — end every token this person holds: every client signs out.
 */
export async function POST(request: Request) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { action?: unknown } | null;

  if (body?.action === 'revoke') {
    await db.update(users).set({ pluginToken: null, pluginTokenHash: null }).where(eq(users.id, session.userId));
    await db
      .update(pluginLinks)
      .set({ revokedAt: new Date().toISOString() })
      .where(and(eq(pluginLinks.userId, session.userId), isNull(pluginLinks.revokedAt)));
    return NextResponse.json({ ok: true, tokens: 0 });
  }

  return NextResponse.json({ token: await mintDeviceToken(session.userId) });
}
