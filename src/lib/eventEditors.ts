import { db } from '@/db';
import { clanGrant } from '@/lib/clanGrants';
import { clanStaff, eventEditors, events, users } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

// Board-scoped tile-editing grants (event_editors). A grant lets someone author one event's tiles
// without the all-events 'editor' role. This module owns the grant lifecycle + the auto-provision
// side effects; the auth gate lives in lib/auth (verifyTileEditorForEvent / verifyTileEditorAnywhere).

// User ids holding a board-editing grant for this event.
export async function getEventEditorUserIds(eventId: number): Promise<number[]> {
  const rows = await db
    .select({ userId: eventEditors.userId })
    .from(eventEditors)
    .where(eq(eventEditors.eventId, eventId));
  return rows.map((r) => r.userId);
}

// Event ids this user may edit via a board grant (does NOT include the all-events reach a global
// editor or admin has — this is purely the explicit grant set). Used to scope the admin events list.
export async function assignedEventIdsForUser(userId: number): Promise<number[]> {
  const rows = await db
    .select({ eventId: eventEditors.eventId })
    .from(eventEditors)
    .where(eq(eventEditors.userId, userId));
  return rows.map((r) => r.eventId);
}

export async function isEventEditor(userId: number, eventId: number): Promise<boolean> {
  const row = await db.query.eventEditors.findFirst({
    where: and(eq(eventEditors.eventId, eventId), eq(eventEditors.userId, userId)),
    columns: { id: true },
  });
  return !!row;
}

// Grant board-editing on `eventId` to `userId`. Idempotent (unique index). Auto-provisions login
// access for a plain member: bumps role member→editor + scope→assigned so they can reach this
// board's admin Tiles tab (and only their granted boards). Higher roles already authenticate, so
// they're left as-is — the grant just widens what they may edit.
export async function grantEventEditor(
  eventId: number,
  userId: number,
  grantedByUserId: number | null,
): Promise<void> {
  await db.insert(eventEditors).values({ eventId, userId, grantedByUserId }).onConflictDoNothing();

  // The capability is provisioned IN THE BOARD'S CLAN. A board belongs to exactly one clan, so
  // granting someone one board there must not make them an authoring member of any other.
  const [event] = await db.select({ clanId: events.clanId }).from(events).where(eq(events.id, eventId));
  if (!event) return;

  const existing = await clanGrant(event.clanId, userId);
  if (!existing) {
    await db
      .insert(clanStaff)
      .values({ clanId: event.clanId, userId, role: 'member', canEditTiles: true, editorScope: 'assigned' })
      .onConflictDoNothing();
  } else if (!existing.canEditTiles) {
    await db
      .update(clanStaff)
      .set({ canEditTiles: true, editorScope: 'assigned' })
      .where(and(eq(clanStaff.clanId, event.clanId), eq(clanStaff.userId, userId)));
  }
}

// Revoke a board grant. If that leaves a *scoped* editor (role 'editor' + scope 'assigned') with
// zero grants, reverse the auto-provision back to a plain member so they no longer hold admin
// access. Global editors (scope 'all') and non-editor roles are never touched.
export async function revokeEventEditor(eventId: number, userId: number): Promise<void> {
  await db
    .delete(eventEditors)
    .where(and(eq(eventEditors.eventId, eventId), eq(eventEditors.userId, userId)));
  const [event] = await db.select({ clanId: events.clanId }).from(events).where(eq(events.id, eventId));
  if (!event) return;

  // Reverse the auto-provision only for a scoped grant with nothing left to reach. A clan-wide
  // authoring capability, or any real tier, was somebody's deliberate decision and is not ours to
  // undo because one board grant went away.
  const existing = await clanGrant(event.clanId, userId);
  if (existing && existing.role === 'member' && existing.editorScope === 'assigned') {
    const remaining = await db.query.eventEditors.findFirst({
      where: eq(eventEditors.userId, userId),
      columns: { id: true },
    });
    if (!remaining) {
      await db
        .delete(clanStaff)
        .where(and(eq(clanStaff.clanId, event.clanId), eq(clanStaff.userId, userId)));
    }
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
  const current = new Set(await assignedEventIdsForUser(userId));
  const next = new Set(eventIds);
  for (const id of next) {
    if (!current.has(id)) await grantEventEditor(id, userId, grantedByUserId);
  }
  for (const id of current) {
    if (!next.has(id)) await revokeEventEditor(id, userId);
  }
}
