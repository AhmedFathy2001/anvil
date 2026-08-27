import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { userWebhooks } from '@/db/schema';
import { verifyUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const KINDS = ['rareDrops', 'deaths', 'combatAchievements', 'pvpKills'] as const;

/** DELETE /api/profile/webhooks/[id] — remove one of the caller's own destinations. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  // Scoped to the caller: the WHERE, not a check-then-delete, is what makes another person's id a
  // no-op rather than a deletion.
  const gone = await db
    .delete(userWebhooks)
    .where(and(eq(userWebhooks.id, id), eq(userWebhooks.userId, session.userId)))
    .returning({ id: userWebhooks.id });
  if (gone.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

/** PATCH /api/profile/webhooks/[id] — change which kinds / floor a destination wants. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Bad body' }, { status: 400 });

  const set: { kinds?: string; minRarity?: number | null; label?: string | null } = {};
  if (Array.isArray(body.kinds)) {
    const kinds = body.kinds.filter(
      (k: unknown): k is string => typeof k === 'string' && (KINDS as readonly string[]).includes(k),
    );
    if (kinds.length === 0) return NextResponse.json({ error: 'Pick at least one kind.' }, { status: 400 });
    set.kinds = JSON.stringify(kinds);
  }
  if ('minRarity' in body) {
    set.minRarity = body.minRarity == null || body.minRarity === '' ? null : Math.max(0, Math.floor(Number(body.minRarity) || 0));
  }
  if ('label' in body) {
    set.label = typeof body.label === 'string' && body.label.trim() ? body.label.trim().slice(0, 60) : null;
  }
  if (Object.keys(set).length === 0) return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });

  const updated = await db
    .update(userWebhooks)
    .set(set)
    .where(and(eq(userWebhooks.id, id), eq(userWebhooks.userId, session.userId)))
    .returning({ id: userWebhooks.id });
  if (updated.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
