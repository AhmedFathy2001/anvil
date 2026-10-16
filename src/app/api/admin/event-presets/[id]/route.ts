import { NextResponse } from 'next/server';
import { db } from '@/db';
import { eventPresets } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { requireClanFromRequest } from '@/lib/clanContext';
import { verifyAdmin } from '@/lib/auth';

// Delete a saved event template. Admin-only.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin only' }, { status: 401 });
  }

  const { id } = await params;
  const presetId = parseInt(id, 10);
  if (!Number.isFinite(presetId)) {
    return NextResponse.json({ error: 'Invalid preset id' }, { status: 400 });
  }

  const clan = await requireClanFromRequest(request);
  if (!clan) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // This clan's templates only — the id is global, and admin of any clan is not admin of all.
  await db.delete(eventPresets).where(and(eq(eventPresets.id, presetId), eq(eventPresets.clanId, clan.id)));
  return NextResponse.json({ success: true });
}
