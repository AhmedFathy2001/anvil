import { db } from '@/db';
import { clanAuditLog, clanMembers, users } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Rank for the "never downgrade on apply" guard. Editor and treasurer are both moderator-tier +
// one capability, so they share rank 2 (a pending sibling won't replace the other — use the Users
// page for a direct swap). member < moderator < {editor, treasurer} < admin.
const ROLE_RANK: Record<string, number> = { member: 0, moderator: 1, editor: 2, treasurer: 2, admin: 3 };
const PENDING_ROLES = new Set(['admin', 'moderator', 'editor', 'treasurer']);

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
  const member = await db.query.clanMembers.findFirst({ where: eq(clanMembers.id, clanMemberId) });
  if (!member?.pendingRole) return false;
  const pending = member.pendingRole;
  if (!PENDING_ROLES.has(pending)) {
    // Unknown value — clear it so it doesn't keep re-firing on repeat calls.
    await db.update(clanMembers).set({ pendingRole: null }).where(eq(clanMembers.id, clanMemberId));
    return false;
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return false;

  const currentRank = ROLE_RANK[user.role] ?? 0;
  const pendingRank = ROLE_RANK[pending] ?? 0;
  if (pendingRank <= currentRank) {
    // Already at or above the pending role — clear and exit.
    await db.update(clanMembers).set({ pendingRole: null }).where(eq(clanMembers.id, clanMemberId));
    return false;
  }

  await db.update(users).set({ role: pending }).where(eq(users.id, userId));
  await db.update(clanMembers).set({ pendingRole: null }).where(eq(clanMembers.id, clanMemberId));

  db.insert(clanAuditLog)
    .values({
      clanMemberId,
      eventType: source === 'plugin' ? 'role_auto_promoted' : 'role_promoted_on_approval',
      oldValue: JSON.stringify({ userId, role: user.role }),
      newValue: JSON.stringify({ userId, role: pending }),
      actorUserId: userId,
      notes: source === 'plugin'
        ? 'Plugin-verified claim — pre-assigned role applied immediately'
        : 'Mod approved provisional verification — pre-assigned role applied',
    })
    .catch(() => {});

  return true;
}
