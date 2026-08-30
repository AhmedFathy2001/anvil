import { db } from '@/db';
import { atLeast, rankOf } from '@/lib/clanRoles';
import { clanGrant } from '@/lib/clanGrants';
import { clanAuditLog, clanMemberships, clanRoster, clanStaff, users } from '@/db/schema';
import { findRosterSeat } from '@/lib/roster';
import { eq } from 'drizzle-orm';

const PENDING_ROLES = new Set(['admin', 'moderator', 'treasurer']);

/**
 * Applies a pre-assigned `pending_role` from a clan_member onto its linked user.
 * Idempotent — safe to call multiple times. Won't downgrade if the user already
 * has a higher role.
 *
 * Trust gating happens at the call site:
 *   - Plugin link (high trust) → call immediately on claim
 *   - Stat-delta / manual (provisional) → call only when a mod approves the
 *     verification, never on the initial claim. The pending role stays in the
 *     clan_members row until then.
 *
 * Returns true if a role change was applied.
 */
export async function applyPendingRole(
  clanMemberId: number,
  userId: number,
  source: 'plugin' | 'manual_approval',
): Promise<boolean> {
  // clan-scope: global -- keyed by a SEAT, and a seat belongs to exactly one clan, so the clan rides along with the id.
  const member = await findRosterSeat(eq(clanRoster.id, clanMemberId));
  if (!member?.pendingRole) return false;
  const pending = member.pendingRole;
  if (!PENDING_ROLES.has(pending)) {
    // Unknown value — clear it so it doesn't keep re-firing on repeat calls.
    await db.update(clanMemberships).set({ pendingRole: null }).where(eq(clanMemberships.id, clanMemberId));
    return false;
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return false;

  // The role lands in THIS clan — the one whose roster the pending role was set on. A pre-assigned
  // role is a clan's decision about its own staff; granting it globally would make an invitation
  // from one clan into authority over every other.
  const existing = await clanGrant(member.clanId, userId);
  if (!atLeast(pending, 'moderator') || rankOf(pending) <= rankOf(existing?.role)) {
    // Already at or above the pending role — clear and exit.
    await db.update(clanMemberships).set({ pendingRole: null }).where(eq(clanMemberships.id, clanMemberId));
    return false;
  }

  await db
    .insert(clanStaff)
    .values({
      clanId: member.clanId,
      userId,
      role: pending,
      canEditTiles: existing?.canEditTiles ?? false,
      editorScope: existing?.editorScope ?? 'all',
    })
    .onConflictDoUpdate({
      target: [clanStaff.clanId, clanStaff.userId],
      set: { role: pending },
    });
  await db.update(clanMemberships).set({ pendingRole: null }).where(eq(clanMemberships.id, clanMemberId));

  db.insert(clanAuditLog)
    .values({
      clanMemberId,
      eventType: source === 'plugin' ? 'role_auto_promoted' : 'role_promoted_on_approval',
      clanId: member.clanId,
      oldValue: JSON.stringify({ userId, role: existing?.role ?? 'member' }),
      newValue: JSON.stringify({ userId, role: pending }),
      actorUserId: userId,
      notes: source === 'plugin'
        ? 'Plugin-verified claim — pre-assigned role applied immediately'
        : 'Mod approved provisional verification — pre-assigned role applied',
    })
    .catch(() => {});

  return true;
}
