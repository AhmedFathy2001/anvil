import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { users } from '@/db/schema';
import { verifyUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Whether the Anvil Discord announces you when your Supporter membership starts (lib/anvilDiscord).
export async function PUT(request: Request) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { announce?: unknown } | null;
  if (typeof body?.announce !== 'boolean') return NextResponse.json({ error: 'Bad body' }, { status: 400 });
  await db.update(users).set({ announceSupporter: body.announce }).where(eq(users.id, session.userId));
  return NextResponse.json({ announce: body.announce });
}
