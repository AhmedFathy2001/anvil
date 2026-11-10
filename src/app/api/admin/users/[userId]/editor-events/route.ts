import { NextResponse } from 'next/server';
import { requireClanFromRequest } from '@/lib/clanContext';
import { db } from '@/db';
import { events, users, clanAuditLog } from '@/db/schema';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
import { assignedEventIdsForUser, setUserAssignedEvents } from '@/lib/eventEditors';
import { STAFF_HIDE_GRANT_ERROR, editorGrantBlocked } from '@/lib/raceHideAheadDb';
import { atLeast, canModify } from '@/lib/clanRoles';
import { clanGrant, hasClanPresence } from '@/lib/clanGrants';
import { isBannedFromClan } from '@/lib/clanBans';
import { personOf } from '@/lib/roster';

// Per-user board-editing assignment (the Users-page counterpart to the per-event editors panel).
// Admin-only. Manages the board grants for role 'member' / scoped 'editor' users; a global editor
// (role 'editor' + scope 'all') or admin already edits every board, so grants there are redundant.
//   GET → { scope, assignedEventIds, events: [{id,name,...}] }
//   PUT { eventIds: number[] } → replace the user's board set ON THIS CLAN'S BOARDS
//
// Everything here is THIS clan's: the person must have a presence here, the role shown is the one
// they hold here (clan_staff, not the legacy global users.role), and the set read and replaced is
// their grants on this clan's boards only — other clans' grants are not ours to show or revoke. The
// Staff & roles rank rule applies: never act on a peer or a superior.

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

  const clan = await requireClanFromRequest(request);
  if (!clan) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // Only someone this clan can see — the same rule as every other grant on the People pages.
  if (!(await hasClanPresence(clan.id, uId))) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const grant = await clanGrant(clan.id, uId);
  const role = grant?.role ?? 'member';
  const editorScope = grant?.editorScope ?? 'all';

  const [assignedEventIds, allEvents] = await Promise.all([
    assignedEventIdsForUser(uId, 'editor', clan.id),
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
    role,
    editorScope,
    // True when board grants are moot because the user already edits everything HERE.
    editsAllBoards: atLeast(role, 'admin') || (grant?.canEditTiles === true && editorScope === 'all'),
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

  const clan = await requireClanFromRequest(request);
  if (!clan) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const target = await db.query.users.findFirst({
    where: eq(users.id, uId),
    columns: { id: true, banned: true },
  });
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (target.banned) return NextResponse.json({ error: 'User is banned' }, { status: 400 });
  // In this clan, or not at all: no presence here means no grants from here.
  if (!(await hasClanPresence(clan.id, uId))) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (await isBannedFromClan(clan.id, await personOf(uId))) {
    return NextResponse.json({ error: 'That person is banned from this clan' }, { status: 400 });
  }
  // Never act on a peer or a superior (Staff & roles' rule).
  const grant = await clanGrant(clan.id, uId);
  if (!canModify(session.role, grant?.role ?? 'member')) {
    return NextResponse.json({ error: 'You cannot modify someone at or above your own role' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const rawIds: unknown = body.eventIds;
  if (!Array.isArray(rawIds) || rawIds.some((n) => typeof n !== 'number' || !Number.isInteger(n))) {
    return NextResponse.json({ error: 'eventIds must be an array of event ids' }, { status: 400 });
  }
  // Only keep ids that reference real events (ignore stale ones rather than 400 the whole set).
  const requested = Array.from(new Set(rawIds as number[]));
  // Real events BELONGING TO THIS CLAN. Checking only that an id exists let an admin grant somebody
  // editor rights over another clan's boards — ids are global, and this list arrives in the body.
  const existing = requested.length
    ? await db
        .select({ id: events.id })
        .from(events)
        .where(and(inArray(events.id, requested), eq(events.clanId, clan.id)))
    : [];
  const validIds = new Set(existing.map((e) => e.id));
  const eventIds = requested.filter((id) => validIds.has(id));

  // "Also hide from event staff" (lib/raceHideAhead): a board under it changes hands only by the owner.
  const before = new Set(await assignedEventIdsForUser(uId, 'editor', clan.id));
  const changed = [...eventIds.filter((id) => !before.has(id)), ...[...before].filter((id) => !eventIds.includes(id))];
  if (await editorGrantBlocked(changed, session)) {
    return NextResponse.json({ error: STAFF_HIDE_GRANT_ERROR }, { status: 403 });
  }

  await setUserAssignedEvents(clan.id, uId, eventIds, session.userId > 0 ? session.userId : null);

  db.insert(clanAuditLog)
    .values({
      eventType: 'editor_boards_set',
      clanId: clan.id,
      newValue: JSON.stringify({ userId: uId, eventIds }),
      actorUserId: session.userId > 0 ? session.userId : null,
    })
    .catch(() => {});

  const assignedEventIds = await assignedEventIdsForUser(uId, 'editor', clan.id);
  return NextResponse.json({ ok: true, assignedEventIds });
}
