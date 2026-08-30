import { db } from '@/db';
import { clanRoster, eventSignups, players } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { parseProfile, type SignupProfile } from './signup';

// Frozen sign-up answers, keyed by the RSN (clanMemberId) the member chose to play with.
// Draft surfaces join their `players` rows against this so captains/admins can read the
// form answers (hours, bosses, skills, notes, timezone) right where they draft — instead
// of only on the Sign-ups / Applicants pages. Read-time join keeps `eventSignups` the
// single source of truth (edits before the deadline show through, no denormalized copy).
//
// A clan member has at most one active sign-up per event, but withdrawn/rejected rows can
// coexist with a later re-join — prefer a non-terminal answer so a stale withdrawal never
// masks the real one.
const TERMINAL_STATUSES = new Set(['withdrawn', 'rejected']);

export async function loadEventProfiles(eventId: number): Promise<Map<number, SignupProfile>> {
  const rows = await db
    .select({
      clanMemberId: eventSignups.clanMemberId,
      userId: eventSignups.userId,
      profileData: eventSignups.profileData,
      status: eventSignups.status,
    })
    .from(eventSignups)
    .where(eq(eventSignups.eventId, eventId));

  // Per clan member, keep the best raw row (prefer a non-terminal answer over a stale withdrawal).
  const rawByMember = new Map<number, { profileData: string; terminal: boolean; userId: number | null }>();
  for (const row of rows) {
    const isTerminal = TERMINAL_STATUSES.has(row.status);
    const existing = rawByMember.get(row.clanMemberId);
    const canOverwrite = !existing || (existing.terminal && !isTerminal);
    if (canOverwrite) {
      rawByMember.set(row.clanMemberId, { profileData: row.profileData, terminal: isTerminal, userId: row.userId });
    }
  }

  // One profile PER PERSON (multi-account): the real answers live on the primary account's row while
  // sibling rows carry '{}'. Find each user's non-empty profile so siblings can inherit it below.
  const profileByUser = new Map<number, SignupProfile>();
  for (const r of rawByMember.values()) {
    if (r.userId != null && r.profileData && r.profileData !== '{}' && !profileByUser.has(r.userId)) {
      profileByUser.set(r.userId, parseProfile(r.profileData));
    }
  }

  const map = new Map<number, SignupProfile>();
  for (const [memberId, r] of rawByMember) {
    if (r.profileData && r.profileData !== '{}') {
      map.set(memberId, parseProfile(r.profileData));
    } else if (r.userId != null && profileByUser.has(r.userId)) {
      // Sibling account: inherit the person's profile from their primary row.
      map.set(memberId, profileByUser.get(r.userId)!);
    } else {
      map.set(memberId, parseProfile(r.profileData));
    }
  }
  return map;
}

// Owner (site user) per player, so multi-account surfaces can group a person's account rows for the
// 'per-person' team-size + MVP rollup. Maps playerId → userId (null for guests / unlinked accounts).
export async function loadPlayerOwners<T extends { id: number; clanMemberId: number | null }>(
  players: T[],
): Promise<Map<number, number | null>> {
  const memberIds = [...new Set(players.map((p) => p.clanMemberId).filter((x): x is number => x != null))];
  const rows = memberIds.length
    // clan-scope: global -- takes an entity id whose caller has already settled the clan — the 'one hop, never a copy' rule in lib/eventScope. Every route and page that reaches this is verified scoped.
    ? await db.select({ id: clanRoster.id, userId: clanRoster.playerId }).from(clanRoster).where(inArray(clanRoster.id, memberIds))
    : [];
  const byMember = new Map(rows.map((r) => [r.id, r.userId]));
  return new Map(players.map((p) => [p.id, p.clanMemberId != null ? byMember.get(p.clanMemberId) ?? null : null]));
}

// Attach ownerUserId to each player row (from loadPlayerOwners) so it serializes to client components.
export function attachOwners<T extends { id: number }>(
  players: T[],
  owners: Map<number, number | null>,
): (T & { ownerUserId: number | null })[] {
  return players.map((p) => ({ ...p, ownerUserId: owners.get(p.id) ?? null }));
}

// Attach the matching frozen profile to each player row (null when unlinked / no sign-up).
export function attachProfiles<T extends { clanMemberId: number | null }>(
  players: T[],
  profiles: Map<number, SignupProfile>,
): (T & { profile: SignupProfile | null })[] {
  return players.map((p) => ({
    ...p,
    profile: p.clanMemberId != null ? profiles.get(p.clanMemberId) ?? null : null,
  }));
}
