import { NextResponse } from 'next/server';
import { verifyUser } from '@/lib/auth';
import { db } from '@/db';
import { clanMembers } from '@/db/schema';
import { eq } from 'drizzle-orm';

type UpdatableFields = Partial<{
  rank: string | null;
  discordId: string | null;
  isGuest: boolean;
  notes: string | null;
  rejoin: boolean;
}>;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const memberId = Number(id);
  if (!Number.isInteger(memberId)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  let body: UpdatableFields;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const existing = await db.query.clanMembers.findFirst({ where: eq(clanMembers.id, memberId) });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const update: Record<string, unknown> = {};
  if (body.rank !== undefined) update.rank = body.rank;
  if (body.discordId !== undefined) update.discordId = body.discordId;
  if (body.isGuest !== undefined) update.isGuest = body.isGuest ? 1 : 0;
  if (body.notes !== undefined) update.notes = body.notes;
  if (body.rejoin) update.leftAt = null;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  await db.update(clanMembers).set(update).where(eq(clanMembers.id, memberId));
  return NextResponse.json({ ok: true });
}

// DELETE — soft-delete (mark as left). Preserves historical references.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const memberId = Number(id);
  if (!Number.isInteger(memberId)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  await db
    .update(clanMembers)
    .set({ leftAt: new Date().toISOString() })
    .where(eq(clanMembers.id, memberId));

  return NextResponse.json({ ok: true });
}
