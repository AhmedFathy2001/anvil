import { NextResponse } from 'next/server';
import { atLeast, canModify } from '@/lib/clanRoles';
import { eventForRequest } from '@/lib/eventScope';
import { db } from '@/db';
import { eventEditors, events, users, clanAuditLog } from '@/db/schema';
import { and, eq, desc } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { clanGrant, hasClanPresence } from '@/lib/clanGrants';
import { isBannedFromClan } from '@/lib/clanBans';
import { personOf } from '@/lib/roster';
import { getPeopleWithCharacters } from '@/lib/identity';
import { grantEventEditor, revokeEventEditor, type BoardRole } from '@/lib/eventEditors';
import { STAFF_HIDE_GRANT_ERROR, editorGrantBlocked } from '@/lib/raceHideAheadDb';

// Board-scoped staff grants for one event. Admin-only — this hands out authoring or money access.
// GET   → current grants (with their job) + assignable users
// POST  { userId, role? }   → grant 'editor' (tiles) or 'treasurer' (fees + payouts) on this board;
//                             auto-provisions login access for a plain member
// DELETE ?userId=&role=     → revoke one job (or, with no role, every grant this person has here);
//                             auto-demotes a scoped grantee with nothing left back to member

async function loadEvent(eventId: number) {
  // clan-scope: global -- a helper called only from handlers that have already run the event guard above.
  return db.query.events.findFirst({ where: eq(events.id, eventId), columns: { id: true, name: true } });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const session = await verifyUser();
  if (!session || !atLeast(session.role, 'admin')) {
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
      boardRole: eventEditors.role,
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

  // Assignable pool: THIS CLAN'S people — a staff grant or a roster seat here. It used to be every
  // non-banned account on Anvil, names and Discord handles included, shown to any clan admin. The
  // role badge is the one they hold here (lib/identity), not a global column.
  const clan = await requireClan();
  const candidates = (await getPeopleWithCharacters(clan.id))
    .filter((p) => !p.banned)
    .map((p) => ({
      id: p.id,
      displayName: p.displayName,
      discordUsername: p.discordUsername,
      role: p.role || 'member',
      editorScope: p.boardScoped ? 'assigned' : 'all',
    }))
    .sort((a, b) => (a.displayName ?? '').localeCompare(b.displayName ?? ''));

  return NextResponse.json({ editors: grants, candidates });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const session = await verifyUser();
  if (!session || !atLeast(session.role, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  const scoped = await eventForRequest(request, eId);
  if (!scoped) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!Number.isFinite(eId)) return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });
  if (!(await loadEvent(eId))) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const { userId, role } = await request.json().catch(() => ({}));
  if (typeof userId !== 'number' || !Number.isInteger(userId)) {
    return NextResponse.json({ error: 'userId (number) is required' }, { status: 400 });
  }
  if (role !== undefined && role !== 'editor' && role !== 'treasurer') {
    return NextResponse.json({ error: "role must be 'editor' or 'treasurer'" }, { status: 400 });
  }
  const boardRole: BoardRole = role === 'treasurer' ? 'treasurer' : 'editor';
  // Only someone this clan can see — the same rule as every other grant on the People pages.
  if (!(await hasClanPresence((await requireClan()).id, userId))) {
    return NextResponse.json({ error: 'That person isn’t in this clan.' }, { status: 404 });
  }
  const target = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, banned: true },
  });
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (target.banned) return NextResponse.json({ error: 'User is banned' }, { status: 400 });
  // A clan ban took their board grants away (lib/clanBans); handing one back would undo it.
  if (await isBannedFromClan(scoped.clanId, await personOf(userId))) {
    return NextResponse.json({ error: 'That person is banned from this clan' }, { status: 400 });
  }
  // Staff & roles' rule: never act on a peer or a superior.
  if (!canModify(session.role, (await clanGrant(scoped.clanId, userId))?.role ?? 'member')) {
    return NextResponse.json({ error: 'You cannot modify someone at or above your own role' }, { status: 403 });
  }

  // "Also hide from event staff" (lib/raceHideAhead): a tile grant sees through it, so only the owner hands it out.
  if (boardRole === 'editor' && (await editorGrantBlocked([eId], session))) {
    return NextResponse.json({ error: STAFF_HIDE_GRANT_ERROR }, { status: 403 });
  }

  await grantEventEditor(eId, userId, session.userId > 0 ? session.userId : null, boardRole);

  db.insert(clanAuditLog)
    .values({
      eventType: boardRole === 'treasurer' ? 'board_treasurer_granted' : 'editor_granted',
      clanId: scoped.clanId,
      newValue: JSON.stringify({ userId, eventId: eId, role: boardRole }),
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
  if (!session || !atLeast(session.role, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  const scoped = await eventForRequest(request, eId);
  if (!scoped) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!Number.isFinite(eId)) return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });

  const params_ = new URL(request.url).searchParams;
  const userId = parseInt(params_.get('userId') ?? '', 10);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: 'userId query param is required' }, { status: 400 });
  }
  const roleParam = params_.get('role');
  if (roleParam !== null && roleParam !== 'editor' && roleParam !== 'treasurer') {
    return NextResponse.json({ error: "role must be 'editor' or 'treasurer'" }, { status: 400 });
  }
  const boardRole = (roleParam ?? undefined) as BoardRole | undefined;
  // Only touch a grant that actually exists so the audit log stays truthful.
  const existing = await db.query.eventEditors.findFirst({
    where: boardRole
      ? and(eq(eventEditors.eventId, eId), eq(eventEditors.userId, userId), eq(eventEditors.role, boardRole))
      : and(eq(eventEditors.eventId, eId), eq(eventEditors.userId, userId)),
    columns: { id: true },
  });
  if (!existing) return NextResponse.json({ ok: true });
  if (!canModify(session.role, (await clanGrant(scoped.clanId, userId))?.role ?? 'member')) {
    return NextResponse.json({ error: 'You cannot modify someone at or above your own role' }, { status: 403 });
  }

  if (boardRole !== 'treasurer' && (await editorGrantBlocked([eId], session))) {
    return NextResponse.json({ error: STAFF_HIDE_GRANT_ERROR }, { status: 403 });
  }

  await revokeEventEditor(eId, userId, boardRole);

  db.insert(clanAuditLog)
    .values({
      eventType: boardRole === 'treasurer' ? 'board_treasurer_revoked' : 'editor_revoked',
      clanId: scoped.clanId,
      oldValue: JSON.stringify({ userId, eventId: eId, role: boardRole ?? 'all' }),
      actorUserId: session.userId > 0 ? session.userId : null,
    })
    .catch(() => {});

  return NextResponse.json({ ok: true });
}
