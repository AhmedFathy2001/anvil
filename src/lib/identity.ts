import { db } from '@/db';
import { users, clanMembers, eventSignups } from '@/db/schema';
import { and, eq, inArray, isNull } from 'drizzle-orm';

// A game account a person owns — their "character". Thin projection of a clan_member for identity UIs.
export interface Character {
  id: number;
  rsn: string;
  isGuest: boolean;
  verified: boolean;
  left: boolean;
}

// The canonical "person + all their characters" aggregate. One place resolves a site user to the
// game accounts they own, so every surface (admin People view, profile, support) presents identity
// the same way instead of re-deriving the user↔clan_member link ad hoc.
export interface PersonWithCharacters {
  id: number;
  displayName: string;
  role: string;
  /** Tile authoring, independent of role — see users.canEditTiles. */
  canEditTiles: boolean;
  isOwner: boolean;
  banned: boolean;
  createdAt: string;
  discordId: string | null;
  discordUsername: string | null;
  discordAvatar: string | null;
  lastLoginAt: string | null;
  characters: Character[];
}

function toCharacter(row: {
  id: number;
  rsn: string;
  isGuest: number;
  verifiedAt: string | null;
  leftAt: string | null;
}): Character {
  return {
    id: row.id,
    rsn: row.rsn,
    isGuest: row.isGuest === 1,
    verified: row.verifiedAt != null,
    left: row.leftAt != null,
  };
}

// Every site user with the characters they own. Sorted person-first for the admin surface.
export async function getPeopleWithCharacters(): Promise<PersonWithCharacters[]> {
  const allUsers = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      role: users.role,
      canEditTiles: users.canEditTiles,
      isOwner: users.isOwner,
      banned: users.banned,
      createdAt: users.createdAt,
      discordId: users.discordId,
      discordUsername: users.discordUsername,
      discordAvatar: users.discordAvatar,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users);

  const userIds = allUsers.map((u) => u.id);
  const chars = userIds.length
    ? await db
        .select({
          id: clanMembers.id,
          rsn: clanMembers.rsn,
          userId: clanMembers.userId,
          isGuest: clanMembers.isGuest,
          verifiedAt: clanMembers.verifiedAt,
          leftAt: clanMembers.leftAt,
        })
        .from(clanMembers)
        .where(inArray(clanMembers.userId, userIds))
    : [];

  const byUser = new Map<number, Character[]>();
  for (const c of chars) {
    if (c.userId == null) continue;
    const list = byUser.get(c.userId) ?? [];
    list.push(toCharacter(c));
    byUser.set(c.userId, list);
  }
  // Active characters first, then verified, then name.
  for (const list of byUser.values()) {
    list.sort(
      (a, b) => Number(a.left) - Number(b.left) || Number(b.verified) - Number(a.verified) || a.rsn.localeCompare(b.rsn),
    );
  }

  return allUsers.map((u) => ({
    ...u,
    isOwner: !!u.isOwner,
    banned: !!u.banned,
    characters: byUser.get(u.id) ?? [],
  }));
}

// When a clan_member (character) becomes owned by a site user, any event sign-ups that were created
// for that character while it was still a GUEST carry a null `userId` — a stale snapshot taken at
// sign-up time that no later link ever backfilled. Left alone they keep rendering as
// "guest · no Discord" in the admin Sign-ups panel even though the People view shows the character
// attached, AND the owner can't manage them from their own account (the self-serve sign-up page finds
// rows by `userId`). Point those rows at the now-known owner so the sign-up follows the person.
//
// Safe against the only unique index on event_signups — (event_id, clan_member_id): there is at most
// one sign-up per (event, character), so adopting its owner can never collide with a sibling row.
// Call this at every place that links a clan_member to a user.
async function linkSignupsToOwner(clanMemberId: number, userId: number): Promise<void> {
  await db
    .update(eventSignups)
    .set({ userId })
    .where(and(eq(eventSignups.clanMemberId, clanMemberId), isNull(eventSignups.userId)));
}

/**
 * The single "this character now belongs to this person" hook. Call it from EVERY place that links a
 * clan_member to a user — plugin auto-link, account-token claim, manual review, admin assignment,
 * Discord link-member. Consolidating the side effects here is what keeps them from drifting apart as
 * new link paths appear.
 *
 * Today that means: adopt the character's guest sign-ups, and (federation) advertise the membership
 * to the broker. The association push used to happen only during Discord login, which reads the
 * membership BEFORE these paths create it — so someone joining a new clan wasn't advertised until
 * their SECOND login there, and until then the clan couldn't appear in their plugin sidebar.
 *
 * Both effects are best-effort: linking a character must never fail because a broker is down.
 */
export async function onCharacterLinked(clanMemberId: number, userId: number): Promise<void> {
  await linkSignupsToOwner(clanMemberId, userId).catch(() => {});
  // Dynamic import: lib/federation pulls in the relay/crypto stack, and this module is imported by
  // lib/auth — the same static-cycle dodge used for discord-roles in lib/auth.ts.
  import('@/lib/federation')
    .then((m) => m.pushMemberAssociations(userId))
    .catch(() => {});
}

// Unowned game accounts (roster members + guests not yet attached to a person, still in the clan).
// The pool an admin picks from when assigning a character — so common cases don't need retyping.
export async function getUnlinkedCharacters(): Promise<{ id: number; rsn: string; isGuest: boolean }[]> {
  const rows = await db
    .select({ id: clanMembers.id, rsn: clanMembers.rsn, isGuest: clanMembers.isGuest })
    .from(clanMembers)
    .where(and(isNull(clanMembers.userId), isNull(clanMembers.leftAt)));
  return rows.map((r) => ({ id: r.id, rsn: r.rsn, isGuest: r.isGuest === 1 }));
}
