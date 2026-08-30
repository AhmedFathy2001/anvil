import { NextResponse } from 'next/server';
import { db } from '@/db';
import { feedback, users } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { verifyAdminOrModerator } from '@/lib/auth';
import { isElevationAvailable } from '@/lib/feedback-elevation';
import { requireClanFromRequest } from '@/lib/clanContext';

// GET /api/admin/feedback — triage list for staff. `canElevate` tells the UI whether this instance
// is managed (elevation to the operator possible) or self-hosted (hidden).
export async function GET(request: Request) {
  const staff = await verifyAdminOrModerator();
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // This clan's feedback. Unscoped, the triage list handed every clan's staff every other clan's
  // reports — which carry a `contact` and a free-text body, so it was people's words as well as
  // their addresses.
  const clan = await requireClanFromRequest(request);
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
    .where(eq(feedback.clanId, clan.id))
    .orderBy(desc(feedback.createdAt));

  return NextResponse.json({ items: rows, canElevate: isElevationAvailable() });
}
