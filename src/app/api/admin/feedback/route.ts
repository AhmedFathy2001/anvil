import { NextResponse } from 'next/server';
import { db } from '@/db';
import { feedback, users } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { verifyAdminOrModerator } from '@/lib/auth';
import { isElevationAvailable } from '@/lib/feedback-elevation';

// GET /api/admin/feedback — triage list for staff. `canElevate` tells the UI whether this instance
// is managed (elevation to the operator possible) or self-hosted (hidden).
export async function GET() {
  const staff = await verifyAdminOrModerator();
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await db
    .select({
      id: feedback.id,
      kind: feedback.kind,
      subject: feedback.subject,
      body: feedback.body,
      status: feedback.status,
      contact: feedback.contact,
      pageUrl: feedback.pageUrl,
      adminNotes: feedback.adminNotes,
      elevated: feedback.elevated,
      elevatedAt: feedback.elevatedAt,
      createdAt: feedback.createdAt,
      reporter: users.displayName,
    })
    .from(feedback)
    .leftJoin(users, eq(feedback.userId, users.id))
    .orderBy(desc(feedback.createdAt));

  return NextResponse.json({ items: rows, canElevate: isElevationAvailable() });
}
