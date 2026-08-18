import { NextResponse } from 'next/server';
import { eventForRequest } from '@/lib/eventScope';
import { db } from '@/db';
import { tileAuditLog, users } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { verifyTileEditorForEvent } from '@/lib/auth';

// Most recent tile-history entries for an event, newest first. Staff/editor only (same gate as
// the tile-authoring routes). The acting user's display name is joined at read time (the token's
// username is the raw Discord handle — displayName is the nicer one).
const LIMIT = 300;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, eId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const editor = await verifyTileEditorForEvent(eId);
  if (!editor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await db
    .select({
      id: tileAuditLog.id,
      tileId: tileAuditLog.tileId,
      tileLabel: tileAuditLog.tileLabel,
      action: tileAuditLog.action,
      changedFields: tileAuditLog.changedFields,
      oldValue: tileAuditLog.oldValue,
      newValue: tileAuditLog.newValue,
      occurredAt: tileAuditLog.occurredAt,
      actorUserId: tileAuditLog.actorUserId,
      actorName: users.displayName,
    })
    .from(tileAuditLog)
    .leftJoin(users, eq(users.id, tileAuditLog.actorUserId))
    .where(eq(tileAuditLog.eventId, eId))
    .orderBy(desc(tileAuditLog.occurredAt), desc(tileAuditLog.id))
    .limit(LIMIT);

  return NextResponse.json(rows);
}
