import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { verifyUser } from '@/lib/auth';

// GET — returns the caller's plugin token, generating one on first read so legacy
// users get a token without an explicit "create" step. POST rotates it.
export async function GET() {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (user.pluginToken) return NextResponse.json({ token: user.pluginToken });

  const token = crypto.randomUUID();
  await db.update(users).set({ pluginToken: token }).where(eq(users.id, user.id));
  return NextResponse.json({ token });
}

export async function POST() {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const token = crypto.randomUUID();
  await db.update(users).set({ pluginToken: token }).where(eq(users.id, session.userId));
  return NextResponse.json({ token });
}
