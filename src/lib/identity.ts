import { db } from '@/db';
import { accounts, clanMemberships, clanRoster, clanStaff, eventSignups, users } from '@/db/schema';
import { and, eq, inArray, isNotNull, isNull, or } from 'drizzle-orm';

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
  kind: string;
  verifiedAt: string | null;
  leftAt: string | null;
}): Character {
  return {
    id: row.id,
    rsn: row.rsn,
    isGuest: row.kind === 'guest',
    verified: row.verifiedAt != null,
    left: row.leftAt != null,
  };
}

/**
 * The people with a presence in this clan, and the characters they own.
 *
 * Scoped twice over, and both matter. Every user on the deployment is not this clan's business —
 * the admin surface would otherwise list every other clan's members by name and Discord handle. And
 * the role shown is the one they hold HERE: a global role would advertise someone's standing
 * elsewhere and, worse, invite an admin to act on it.
 */
export async function getPeopleWithCharacters(clanId: number): Promise<PersonWithCharacters[]> {
  const allUsers = await db
    .selectDistinct({
      id: users.id,
      // The person behind the login. Needed because characters hang off the PERSON, and using the
      // login's id in their place is the bug described below.
      playerId: users.playerId,
      displayName: users.displayName,
      role: clanStaff.role,
      canEditTiles: clanStaff.canEditTiles,
      banned: users.banned,
      createdAt: users.createdAt,
      discordId: users.discordId,
      discordUsername: users.discordUsername,
      discordAvatar: users.discordAvatar,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .leftJoin(clanStaff, and(eq(clanStaff.userId, users.id), eq(clanStaff.clanId, clanId)))
    .leftJoin(accounts, eq(accounts.playerId, users.playerId))
    .leftJoin(
      clanMemberships,
      and(eq(clanMemberships.accountId, accounts.id), eq(clanMemberships.clanId, clanId)),
    )
    // A presence here is either a staff grant or a seat on the roster. Someone with neither is a
    // stranger to this clan and does not belong on its people list.
    .where(or(isNotNull(clanStaff.id), isNotNull(clanMemberships.id)));

  // Keyed by PERSON, and scoped to THIS clan. Two separate bugs lived in the line this replaces.
  //
  // It matched `clanRoster.playerId` — a person id — against `users.id`. Those are different
  // sequences, so the list showed whichever unrelated person happened to share the number: on the
  // live database 59 of 60 users collide, and a member with four characters was displayed with one
  // that was not theirs.
  //
  // And it carried no clan filter, so every character a person holds ANYWHERE would have been listed
  // on one clan's people page — which is precisely what a clan is not entitled to know.
  const personIds = allUsers
    .map((u) => u.playerId)
    .filter((v): v is number => v != null);
  const chars = personIds.length
    ? await db
        .select({
          id: clanRoster.id,
          rsn: clanRoster.rsn,
          personId: clanRoster.playerId,
          kind: clanRoster.kind,
          verifiedAt: clanRoster.verifiedAt,
          leftAt: clanRoster.leftAt,
        })
        .from(clanRoster)
        .where(and(eq(clanRoster.clanId, clanId), inArray(clanRoster.playerId, personIds)))
    : [];

  const byPerson = new Map<number, Character[]>();
  for (const c of chars) {
    if (c.personId == null) continue;
    const list = byPerson.get(c.personId) ?? [];
    list.push(toCharacter(c));
    byPerson.set(c.personId, list);
  }
  // Active characters first, then verified, then name.
  for (const list of byPerson.values()) {
    list.sort(
      (a, b) => Number(a.left) - Number(b.left) || Number(b.verified) - Number(a.verified) || a.rsn.localeCompare(b.rsn),
    );
  }

  return allUsers.map((u) => ({
    ...u,
    // No grant here means no authority here — a plain member of this clan, whatever they hold
    // anywhere else.
    role: u.role ?? 'member',
    canEditTiles: u.canEditTiles === true,
    isOwner: u.role === 'owner',
    banned: !!u.banned,
    characters: u.playerId != null ? byPerson.get(u.playerId) ?? [] : [],
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
 * Today that means: adopt the character's guest sign-ups. Best-effort — linking a character must
 * never fail because a downstream side effect did.
 */
export async function onCharacterLinked(clanMemberId: number, userId: number): Promise<void> {
  await linkSignupsToOwner(clanMemberId, userId).catch(() => {});
}

// Unowned game accounts (roster members + guests not yet attached to a person, still in the clan).
// The pool an admin picks from when assigning a character — so common cases don't need retyping.
export async function getUnlinkedCharacters(clanId: number): Promise<{ id: number; rsn: string; isGuest: boolean }[]> {
  const rows = await db
    .select({ id: clanRoster.id, rsn: clanRoster.rsn, kind: clanRoster.kind })
    .from(clanRoster)
    // This clan's unclaimed seats. An admin assigns accounts on their own roster, not on anyone else's.
    .where(and(eq(clanRoster.clanId, clanId), isNull(clanRoster.claimedAt), isNull(clanRoster.leftAt)));
  return rows.map((r) => ({ id: r.id, rsn: r.rsn, isGuest: r.kind === 'guest' }));
}
