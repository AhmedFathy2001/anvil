import { NextResponse } from 'next/server';
import { db } from '@/db';
import { feedback, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
import { elevateToAdmin, isElevationAvailable } from '@/lib/feedback-elevation';
import { atLeast } from '@/lib/clanRoles';

// POST /api/admin/feedback/[id]/elevate — admin sends a report up to the central Anvil.Admin so the
// operator sees it. Admin-only, and only where elevation is configured (managed hosting).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await verifyUser();
  if (!actor || !atLeast(actor.role, 'admin')) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  if (!isElevationAvailable()) {
    return NextResponse.json({ error: 'Elevation isn’t available on this instance.' }, { status: 400 });
  }

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const row = await db.query.feedback.findFirst({ where: eq(feedback.id, id) });
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (row.elevated) return NextResponse.json({ ok: true, alreadyElevated: true });

  const reporter = row.userId
    ? (await db.query.users.findFirst({ where: eq(users.id, row.userId), columns: { displayName: true } }))?.displayName ?? null
    : null;

  const result = await elevateToAdmin({
    id: row.id,
    kind: row.kind,
    subject: row.subject,
    body: row.body,
    reporter,
    contact: row.contact,
    pageUrl: row.pageUrl,
    createdAt: row.createdAt,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });

  const nowIso = new Date().toISOString();
  await db.update(feedback).set({ elevated: true, elevatedAt: nowIso, updatedAt: nowIso }).where(eq(feedback.id, id));
  return NextResponse.json({ ok: true });
}
