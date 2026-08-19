// Authority in a clan: what someone may do, and where.
//
// PURE. No database, no imports — so the comparators can be used by edge code and by tests that
// should not need a connection to check that a moderator cannot promote themselves. The lookups
// that read clan_staff live in lib/clanGrants.
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
