import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { clanStaff, users } from '@/db/schema';

// Authority in a clan: what someone may do, and where.
//
// This is the one definition. Before the multi-clan conversion the staff-role list existed in four
// places — lib/auth, middleware, the admin layout and the roster client — and the only ordering
// helper in the codebase was a private never-downgrade guard inside lib/pending-role. Four copies of
// "who counts as staff" is three chances to disagree.
//
// The rule that makes multi-clan safe: authority comes from a `clan_staff` ROW, not from the person.
// No row means no authority in that clan, whatever they hold anywhere else.

export const CLAN_ROLES = ['member', 'moderator', 'treasurer', 'admin', 'owner'] as const;
export type ClanRole = (typeof CLAN_ROLES)[number];

/**
 * Rank for comparison. Treasurer and moderator deliberately tie: they are the same tier with
 * different extra capabilities (fees / moderation), not a ladder.
 */
const RANK: Record<ClanRole, number> = {
  member: 0,
  moderator: 1,
  treasurer: 1,
  admin: 2,
  owner: 3,
};

export function rankOf(role: string | null | undefined): number {
  return RANK[(role ?? 'member') as ClanRole] ?? 0;
}

export function atLeast(role: string | null | undefined, min: ClanRole): boolean {
  return rankOf(role) >= RANK[min];
}

/** Roles that see the admin area at all. */
export function isStaffRole(role: string | null | undefined): boolean {
  return rankOf(role) >= RANK.moderator;
}

export interface ClanGrant {
  clanId: number;
  userId: number;
  role: ClanRole;
  canEditTiles: boolean;
  editorScope: 'all' | 'assigned';
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
    isOwner: role === 'owner',
  };
}

/** True when the person holds at least `min` in this clan. */
export async function hasClanRole(clanId: number, userId: number, min: ClanRole): Promise<boolean> {
  const grant = await clanGrant(clanId, userId);
  return grant != null && atLeast(grant.role, min);
}

// ── Escalation guards ────────────────────────────────────────────────────────────────────────
//
// Both are about the same failure: someone with partial staff access using it to acquire more. A
// moderator who can edit staff rows is one request away from being an admin, so the check cannot
// live in the UI.

/**
 * May `actor` grant (or set) the role `target` in this clan?
 *
 * You can never hand out a role at or above your own — otherwise the first thing any moderator does
 * is promote themselves. Owner is never grantable; it moves only through an explicit transfer.
 */
export function canGrantRole(actorRole: string | null | undefined, targetRole: ClanRole): boolean {
  if (targetRole === 'owner') return false;
  return rankOf(actorRole) > rankOf(targetRole);
}

/**
 * May `actor` modify the person currently holding `subjectRole`?
 *
 * Strictly greater, so peers cannot demote each other and nobody can demote the person above them.
 */
export function canModify(actorRole: string | null | undefined, subjectRole: string | null | undefined): boolean {
  return rankOf(actorRole) > rankOf(subjectRole);
}

// ── Platform authority ───────────────────────────────────────────────────────────────────────
//
// A separate axis on purpose. A clan role never grants platform capability, and platform staff never
// implicitly get clan-admin powers — writing into a clan's data stays an explicit, logged act rather
// than something the operator silently always had.

export const PLATFORM_ROLES = ['none', 'support', 'staff', 'root'] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

const PLATFORM_RANK: Record<PlatformRole, number> = { none: 0, support: 1, staff: 2, root: 3 };

export function hasPlatformRole(role: string | null | undefined, min: PlatformRole): boolean {
  return (PLATFORM_RANK[(role ?? 'none') as PlatformRole] ?? 0) >= PLATFORM_RANK[min];
}

/** The caller's platform role, read live from the row rather than trusted from a session. */
export async function platformRoleOf(userId: number): Promise<PlatformRole> {
  const row = await db.query.users.findFirst({ where: eq(users.id, userId) });
  return ((row?.platformRole as PlatformRole) ?? 'none');
}
