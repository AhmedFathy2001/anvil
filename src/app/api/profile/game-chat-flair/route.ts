import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { users } from '@/db/schema';
import { verifyUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Whether other Anvil plugin users see your Supporter colours on your names in normal game chat.
export async function PUT(request: Request) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { on?: unknown } | null;
  if (typeof body?.on !== 'boolean') return NextResponse.json({ error: 'Bad body' }, { status: 400 });
  await db.update(users).set({ gameChatFlair: body.on }).where(eq(users.id, session.userId));
  return NextResponse.json({ on: body.on });
}
