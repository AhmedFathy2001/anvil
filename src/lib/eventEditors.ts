import { db } from '@/db';
import { eventEditors, users } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

// Board-scoped staff grants (event_editors). A grant lets someone do ONE job on ONE event without
// holding the clan-wide role for it: 'editor' authors that board's tiles, 'treasurer' collects its
// fees and runs its payouts. This module owns the grant lifecycle + the auto-provision side effects;
// the auth gates live in lib/auth (verifyTileEditorForEvent / verifyEventTreasurer).

/** The jobs a board grant can carry. */
export type BoardRole = 'editor' | 'treasurer';

// User ids holding a board-editing grant for this event.
export async function getEventEditorUserIds(eventId: number): Promise<number[]> {
  const rows = await db
    .select({ userId: eventEditors.userId })
    .from(eventEditors)
    .where(and(eq(eventEditors.eventId, eventId), eq(eventEditors.role, 'editor')));
  return rows.map((r) => r.userId);
}

// Event ids this user may edit via a board grant (does NOT include the all-events reach a global
// editor or admin has — this is purely the explicit grant set). Used to scope the admin events list.
export async function assignedEventIdsForUser(userId: number, role?: BoardRole): Promise<number[]> {
  const rows = await db
    .select({ eventId: eventEditors.eventId })
    .from(eventEditors)
    .where(
      role
        ? and(eq(eventEditors.userId, userId), eq(eventEditors.role, role))
        : eq(eventEditors.userId, userId),
    );
  return [...new Set(rows.map((r) => r.eventId))];
}

export async function isEventEditor(userId: number, eventId: number): Promise<boolean> {
  return hasBoardGrant(userId, eventId, 'editor');
}

/** Does this user run the money on this one board? */
export async function isEventTreasurer(userId: number, eventId: number): Promise<boolean> {
  return hasBoardGrant(userId, eventId, 'treasurer');
}

async function hasBoardGrant(userId: number, eventId: number, role: BoardRole): Promise<boolean> {
  const row = await db.query.eventEditors.findFirst({
    where: and(
      eq(eventEditors.eventId, eventId),
      eq(eventEditors.userId, userId),
      eq(eventEditors.role, role),
    ),
    columns: { id: true },
  });
  return !!row;
}

// Grant one board job on `eventId` to `userId`. Idempotent (unique index). Auto-provisions login
// access for a plain member: an editor grant bumps them to role editor + scope assigned, a
// treasurer grant to role treasurer + treasurerScope assigned — enough to reach that board's tab
// and nothing else. Higher roles already authenticate, so they're left as-is; the grant just widens
// what they may touch.
//
// The scoped role is what gets a member through the middleware at all. It goes with a SCOPE of
// 'assigned' precisely so the clan-wide gates (verifyFeeCollector, verifyAdminOrModerator) keep
// refusing them: the role is the door, the grant is the room.
export async function grantEventEditor(
  eventId: number,
  userId: number,
  grantedByUserId: number | null,
  role: BoardRole = 'editor',
): Promise<void> {
  await db.insert(eventEditors).values({ eventId, userId, grantedByUserId, role }).onConflictDoNothing();
  const u = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { role: true },
  });
  if (u && u.role === 'member') {
    await db
      .update(users)
      .set(
        role === 'treasurer'
          ? { role: 'treasurer', treasurerScope: 'assigned' }
          : { role: 'editor', editorScope: 'assigned' },
      )
      .where(eq(users.id, userId));
  }
}

// Revoke a board grant. If that leaves a *scoped* editor (role 'editor' + scope 'assigned') with
// zero grants, reverse the auto-provision back to a plain member so they no longer hold admin
// access. Global editors (scope 'all') and non-editor roles are never touched.
export async function revokeEventEditor(
  eventId: number,
  userId: number,
  role?: BoardRole,
): Promise<void> {
  await db
    .delete(eventEditors)
    .where(
      role
        ? and(eq(eventEditors.eventId, eventId), eq(eventEditors.userId, userId), eq(eventEditors.role, role))
        : and(eq(eventEditors.eventId, eventId), eq(eventEditors.userId, userId)),
    );
  const u = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { role: true, editorScope: true, treasurerScope: true },
  });
  if (!u) return;
  // Deprovision only the scoped flavours, and only once their LAST grant of that job is gone. A
  // global editor or a real clan treasurer is never touched by revoking one board.
  const remainingOfRole = async (r: BoardRole) =>
    !!(await db.query.eventEditors.findFirst({
      where: and(eq(eventEditors.userId, userId), eq(eventEditors.role, r)),
      columns: { id: true },
    }));
  if (u.role === 'editor' && u.editorScope === 'assigned' && !(await remainingOfRole('editor'))) {
    // They may still hold treasurer grants — hand them that door instead of locking them out.
    const nextRole = (await remainingOfRole('treasurer')) ? 'treasurer' : 'member';
    await db.update(users).set({ role: nextRole, editorScope: 'all' }).where(eq(users.id, userId));
  } else if (u.role === 'treasurer' && u.treasurerScope === 'assigned' && !(await remainingOfRole('treasurer'))) {
    const nextRole = (await remainingOfRole('editor')) ? 'editor' : 'member';
    await db
      .update(users)
      .set({ role: nextRole, treasurerScope: 'all', ...(nextRole === 'editor' ? { editorScope: 'assigned' } : {}) })
      .where(eq(users.id, userId));
  }
}

// Replace the full set of boards a user may edit (per-user assignment path). Diffs against current
// grants and routes each change through grant/revoke so the auto-provision/-deprovision side effects
// stay consistent. Additions run before removals so a member is promoted before any final revoke
// could consider demoting them.
export async function setUserAssignedEvents(
  userId: number,
  eventIds: number[],
  grantedByUserId: number | null,
): Promise<void> {
  const current = new Set(await assignedEventIdsForUser(userId, 'editor'));
  const next = new Set(eventIds);
  for (const id of next) {
    if (!current.has(id)) await grantEventEditor(id, userId, grantedByUserId, 'editor');
  }
  for (const id of current) {
    if (!next.has(id)) await revokeEventEditor(id, userId, 'editor');
  }
}
