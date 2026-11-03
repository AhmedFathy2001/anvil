import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { users } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { supporterForUser, validateSupporterStyle } from '@/lib/supporter';

export const dynamic = 'force-dynamic';

// Your Supporter name colours (lib/supporterStyle): a preset for a Champion, a preset or your own
// stops for a Patron. Checked against the tier in force NOW, whatever the picker in the browser
// allowed; the answer is the style as it will be worn everywhere (site, plugin panel, Discord).

export async function PUT(request: Request) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const body = await request.json().catch(() => undefined);
  if (body === undefined) return NextResponse.json({ error: 'Bad body' }, { status: 400 });
  const supporter = await supporterForUser(session.userId);
  const check = validateSupporterStyle(body, supporter?.tier.id ?? null);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
  await db
    .update(users)
    .set({ supporterStyle: check.style ? JSON.stringify(check.style) : null })
    .where(eq(users.id, session.userId));
  return NextResponse.json({ style: check.style, tier: supporter?.tier.id ?? null });
}
