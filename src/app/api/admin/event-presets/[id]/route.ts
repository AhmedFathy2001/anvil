import { NextResponse } from 'next/server';
import { db } from '@/db';
import { eventPresets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';

// Delete a saved event template. Admin-only.
export async function DELETE(
  _request: Request,
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

  await db.delete(eventPresets).where(eq(eventPresets.id, presetId));
  return NextResponse.json({ success: true });
}
