import { NextResponse } from 'next/server';
import { eventForRequest } from '@/lib/eventScope';
import { db } from '@/db';
import { eventEditors, events, users, clanAuditLog } from '@/db/schema';
import { and, eq, desc } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
import { grantEventEditor, revokeEventEditor } from '@/lib/eventEditors';

// Board-scoped tile-editing grants for one event. Admin-only — this hands out authoring access.
// GET   → current board editors + assignable users
// POST  { userId }  → grant board editing (auto-provisions login access for a plain member)
// DELETE ?userId=   → revoke (auto-demotes a scoped editor with no grants left back to member)

async function loadEvent(eventId: number) {
  return db.query.events.findFirst({ where: eq(events.id, eventId), columns: { id: true, name: true } });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const session = await verifyUser();
  if (session?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, eId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!Number.isFinite(eId)) return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });
  if (!(await loadEvent(eId))) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  // Current grants, joined to the user for display.
  const grants = await db
    .select({
      userId: eventEditors.userId,
      createdAt: eventEditors.createdAt,
      displayName: users.displayName,
      discordUsername: users.discordUsername,
      role: users.role,
      editorScope: users.editorScope,
    })
    .from(eventEditors)
    .innerJoin(users, eq(users.id, eventEditors.userId))
    .where(eq(eventEditors.eventId, eId))
    .orderBy(desc(eventEditors.createdAt));

  // Assignable pool: every non-banned account. The UI badges each by role so an admin can see who
  // already edits everything (global editor / admin) vs who a grant would actually empower.
  const candidates = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      discordUsername: users.discordUsername,
      role: users.role,
      editorScope: users.editorScope,
    })
    .from(users)
    .where(eq(users.banned, false))
    .orderBy(users.displayName);

  return NextResponse.json({ editors: grants, candidates });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const session = await verifyUser();
  if (session?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, eId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!Number.isFinite(eId)) return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });
  if (!(await loadEvent(eId))) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const { userId } = await request.json().catch(() => ({}));
  if (typeof userId !== 'number' || !Number.isInteger(userId)) {
    return NextResponse.json({ error: 'userId (number) is required' }, { status: 400 });
  }
  const target = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, banned: true },
  });
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (target.banned) return NextResponse.json({ error: 'User is banned' }, { status: 400 });

  await grantEventEditor(eId, userId, session.userId > 0 ? session.userId : null);

  db.insert(clanAuditLog)
    .values({
      eventType: 'editor_granted',
      newValue: JSON.stringify({ userId, eventId: eId }),
      actorUserId: session.userId > 0 ? session.userId : null,
    })
    .catch(() => {});

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const session = await verifyUser();
  if (session?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, eId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!Number.isFinite(eId)) return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });

  const userId = parseInt(new URL(request.url).searchParams.get('userId') ?? '', 10);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: 'userId query param is required' }, { status: 400 });
  }
  // Only touch a grant that actually exists so the audit log stays truthful.
  const existing = await db.query.eventEditors.findFirst({
    where: and(eq(eventEditors.eventId, eId), eq(eventEditors.userId, userId)),
    columns: { id: true },
  });
  if (!existing) return NextResponse.json({ ok: true });

  await revokeEventEditor(eId, userId);

  db.insert(clanAuditLog)
    .values({
      eventType: 'editor_revoked',
      oldValue: JSON.stringify({ userId, eventId: eId }),
      actorUserId: session.userId > 0 ? session.userId : null,
    })
    .catch(() => {});

  return NextResponse.json({ ok: true });
}
