import { NextResponse } from 'next/server';
import { verifyUser } from '@/lib/auth';
import { db } from '@/db';
import { clanMembers, users } from '@/db/schema';
import { desc, eq, inArray } from 'drizzle-orm';
import { normalizeRsn } from '@/lib/auth';

// GET — list all clan members (active + departed) for the admin roster view.
export async function GET() {
  const user = await verifyUser();
  if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(clanMembers)
    .orderBy(desc(clanMembers.joinedAt));

  // Tag each row with whether its linked site user is banned, so the roster can show/toggle it.
  const userIds = [...new Set(rows.map((r) => r.userId).filter((v): v is number => v != null))];
  const bannedIds = userIds.length
    ? new Set(
        (
          await db
            .select({ id: users.id, banned: users.banned })
            .from(users)
            .where(inArray(users.id, userIds))
        )
          .filter((u) => u.banned)
          .map((u) => u.id),
      )
    : new Set<number>();

  return NextResponse.json(
    rows.map((r) => ({ ...r, userBanned: r.userId != null && bannedIds.has(r.userId) })),
  );
}

// POST — manual add (admin entering a guest / member the plugin can't reach).
export async function POST(request: Request) {
  const user = await verifyUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { rsn?: string; discordId?: string; rank?: string; isGuest?: boolean; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const rsn = (body.rsn || '').trim();
  if (!rsn) return NextResponse.json({ error: 'rsn required' }, { status: 400 });

  const rsnNormalized = normalizeRsn(rsn);
  const existing = await db.query.clanMembers.findFirst({
    where: eq(clanMembers.rsnNormalized, rsnNormalized),
  });
  if (existing && !existing.leftAt) {
    return NextResponse.json({ error: 'Already in roster', id: existing.id }, { status: 409 });
  }
  if (existing && existing.leftAt) {
    await db
      .update(clanMembers)
      .set({
        rsn,
        leftAt: null,
        rank: body.rank ?? existing.rank,
        discordId: body.discordId ?? existing.discordId,
        isGuest: body.isGuest ? 1 : 0,
        notes: body.notes ?? existing.notes,
      })
      .where(eq(clanMembers.id, existing.id));
    return NextResponse.json({ id: existing.id, reactivated: true });
  }

  const inserted = await db
    .insert(clanMembers)
    .values({
      rsn,
      rsnNormalized,
      rank: body.rank ?? null,
      discordId: body.discordId ?? null,
      isGuest: body.isGuest ? 1 : 0,
      source: 'manual',
      notes: body.notes ?? null,
    })
    .returning();

  return NextResponse.json(inserted[0]);
}
