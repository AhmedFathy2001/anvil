import { NextResponse } from 'next/server';
import { requireClanFromRequest } from '@/lib/clanContext';
import { db } from '@/db';
import { events, users, clanAuditLog } from '@/db/schema';
import { desc, eq, inArray } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
import { assignedEventIdsForUser, setUserAssignedEvents } from '@/lib/eventEditors';
import { atLeast } from '@/lib/clanRoles';

// Per-user board-editing assignment (the Users-page counterpart to the per-event editors panel).
// Admin-only. Manages the board grants for role 'member' / scoped 'editor' users; a global editor
// (role 'editor' + scope 'all') or admin already edits every board, so grants there are redundant.
//   GET → { scope, assignedEventIds, events: [{id,name,...}] }
//   PUT { eventIds: number[] } → replace the user's board set

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await verifyUser();
  if (!session || !atLeast(session.role, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { userId } = await params;
  const uId = parseInt(userId, 10);
  if (!Number.isFinite(uId)) return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });

  const target = await db.query.users.findFirst({
    where: eq(users.id, uId),
    columns: { id: true, role: true, editorScope: true },
  });
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const clan = await requireClanFromRequest(request);
  if (!clan) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [assignedEventIds, allEvents] = await Promise.all([
    assignedEventIdsForUser(uId),
    db
      .select({
        id: events.id,
        name: events.name,
        startDate: events.startDate,
        endDate: events.endDate,
        forceEndedAt: events.forceEndedAt,
        createdAt: events.createdAt,
      })
      .from(events)
      .where(eq(events.clanId, clan.id))
      .orderBy(desc(events.createdAt)),
  ]);

  return NextResponse.json({
    role: target.role,
    editorScope: target.editorScope,
    // True when board grants are moot because the user already edits everything.
    editsAllBoards: target.role === 'admin' || (target.role === 'editor' && target.editorScope === 'all'),
    assignedEventIds,
    events: allEvents,
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await verifyUser();
  if (!session || !atLeast(session.role, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { userId } = await params;
  const uId = parseInt(userId, 10);
  if (!Number.isFinite(uId)) return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });

  const target = await db.query.users.findFirst({
    where: eq(users.id, uId),
    columns: { id: true, banned: true, isOwner: true },
  });
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (target.banned) return NextResponse.json({ error: 'User is banned' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const rawIds: unknown = body.eventIds;
  if (!Array.isArray(rawIds) || rawIds.some((n) => typeof n !== 'number' || !Number.isInteger(n))) {
    return NextResponse.json({ error: 'eventIds must be an array of event ids' }, { status: 400 });
  }
  // Only keep ids that reference real events (ignore stale ones rather than 400 the whole set).
  const requested = Array.from(new Set(rawIds as number[]));
  const existing = requested.length
    ? await db.select({ id: events.id }).from(events).where(inArray(events.id, requested))
    : [];
  const validIds = new Set(existing.map((e) => e.id));
  const eventIds = requested.filter((id) => validIds.has(id));

  await setUserAssignedEvents(uId, eventIds, session.userId > 0 ? session.userId : null);

  db.insert(clanAuditLog)
    .values({
      eventType: 'editor_boards_set',
      newValue: JSON.stringify({ userId: uId, eventIds }),
      actorUserId: session.userId > 0 ? session.userId : null,
    })
    .catch(() => {});

  const assignedEventIds = await assignedEventIdsForUser(uId);
  return NextResponse.json({ ok: true, assignedEventIds });
}
