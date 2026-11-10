import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { users } from '@/db/schema';
import { verifyUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Whether you appear on the public supporters wall on /supporter (lib/supporterWall).
export async function PUT(request: Request) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { shown?: unknown } | null;
  if (typeof body?.shown !== 'boolean') return NextResponse.json({ error: 'Bad body' }, { status: 400 });
  await db.update(users).set({ supporterWall: body.shown }).where(eq(users.id, session.userId));
  return NextResponse.json({ shown: body.shown });
}
