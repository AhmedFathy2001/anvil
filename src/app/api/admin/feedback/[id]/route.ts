import { NextResponse } from 'next/server';
import { db } from '@/db';
import { feedback } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyAdminOrModerator } from '@/lib/auth';

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

// PATCH /api/admin/feedback/[id] — staff update a report's status and/or private admin notes.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await verifyAdminOrModerator();
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  let body: { status?: string; adminNotes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const set: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    set.status = body.status;
  }
  if (typeof body.adminNotes === 'string') {
    set.adminNotes = body.adminNotes.trim().slice(0, 2000) || null;
  }
  if (Object.keys(set).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  set.updatedAt = new Date().toISOString();

  await db.update(feedback).set(set).where(eq(feedback.id, id));
  return NextResponse.json({ ok: true });
}
