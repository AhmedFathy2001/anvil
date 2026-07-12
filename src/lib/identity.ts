import { db } from '@/db';
import { users, clanMembers } from '@/db/schema';
import { inArray } from 'drizzle-orm';

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
