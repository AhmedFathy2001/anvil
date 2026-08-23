// Reading who holds what, in which clan.
//
// Separated from lib/clanRoles so the comparators there stay free of a database import: `atLeast` is
// string arithmetic and should not need a connection, least of all in a test.

import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { clanStaff, users } from '@/db/schema';
import { atLeast, type ClanRole, type PlatformRole } from '@/lib/clanRoles';

export interface ClanGrant {
  clanId: number;
  userId: number;
  role: ClanRole;
  canEditTiles: boolean;
  editorScope: 'all' | 'assigned';
  // Per clan, like every other authority field — see the note on clan_staff.treasurer_scope.
  treasurerScope: 'all' | 'assigned';
  isOwner: boolean;
}

/**
 * What this person may do in this clan. Null when they hold no grant here — which is the common
 * case and is not an error: most people are members of one clan and strangers to every other.
 */
export async function clanGrant(clanId: number, userId: number): Promise<ClanGrant | null> {
  const row = await db.query.clanStaff.findFirst({
    where: and(eq(clanStaff.clanId, clanId), eq(clanStaff.userId, userId)),
  });
  if (!row) return null;
  const role = (row.role as ClanRole) ?? 'member';
  return {
    clanId,
    userId,
    role,
    // An admin authors tiles implicitly; the flag is for granting it to lower tiers.
    canEditTiles: row.canEditTiles || atLeast(role, 'admin'),
    editorScope: (row.editorScope as 'all' | 'assigned') ?? 'all',
    treasurerScope: (row.treasurerScope as 'all' | 'assigned') ?? 'all',
    isOwner: role === 'owner',
  };
}

/** True when the person holds at least `min` in this clan. */
export async function hasClanRole(clanId: number, userId: number, min: ClanRole): Promise<boolean> {
  const grant = await clanGrant(clanId, userId);
  return grant != null && atLeast(grant.role, min);
}

/** The caller's platform role, read live from the row rather than trusted from a session. */
export async function platformRoleOf(userId: number): Promise<PlatformRole> {
  const row = await db.query.users.findFirst({ where: eq(users.id, userId) });
  return ((row?.platformRole as PlatformRole) ?? 'none');
}
