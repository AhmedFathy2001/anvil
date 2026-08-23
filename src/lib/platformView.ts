// What the platform surfaces read. Every cross-clan query in the app lives here or in the staff
// routes, and nowhere else.
//
// These are the only reads in the codebase that are SUPPOSED to span clans, which is why they are
// gathered rather than scattered: the clan-scope lint rule flags an unfiltered read everywhere else,
// and a file full of `clan-scope: global` escapes elsewhere in the tree would be the tell that
// something had gone wrong. Here it is the job.
//
// Counting rules worth stating once, because the numbers are wrong in quiet ways otherwise:
//   - A person is counted once, however many clans they are in. That is the entire point of the
//     identity remodel and the number nobody could produce before it.
//   - Roster size counts SEATS (accounts on a roster), because that is what a clan's own pages show
//     and a main plus an alt is genuinely two seats.
//   - `leftAt IS NULL` everywhere: a clan's size is who is there now, not who ever was.

import { and, count, countDistinct, desc, eq, isNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships, clanStaff, clans, events as eventsTable, players, users, weeklyCompetitions, eventParticipants } from '@/db/schema';
import { apexDomain } from '@/lib/clanContext';

export interface PlatformTotals {
  clans: number;
  activeClans: number;
  suspendedClans: number;
  archivedClans: number;
  /** Distinct PEOPLE, not seats — one human in four clans is one. */
  people: number;
  accounts: number;
  /** Seats: (clan, account) pairs currently on a roster. Exceeds `people` by design. */
  seats: number;
  logins: number;
  events: number;
  competitions: number;
  bannedPeople: number;
  platformStaff: number;
}

export async function platformTotals(): Promise<PlatformTotals> {
  // clan-scope: global -- the platform overview counts every clan by definition.
  const [
    [clanRows],
    [active],
    [suspended],
    [archived],
    [peopleRow],
    [accountRow],
    [seatRow],
    [loginRow],
    [eventRow],
    [compRow],
    [bannedRow],
    [staffRow],
  ] = await Promise.all([
    db.select({ n: count() }).from(clans),
    db.select({ n: count() }).from(clans).where(eq(clans.status, 'active')),
    db.select({ n: count() }).from(clans).where(eq(clans.status, 'suspended')),
    db.select({ n: count() }).from(clans).where(eq(clans.status, 'archived')),
    db.select({ n: count() }).from(players),
    db.select({ n: count() }).from(accounts),
    db.select({ n: count() }).from(clanMemberships).where(isNull(clanMemberships.leftAt)),
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(eventsTable),
    db.select({ n: count() }).from(weeklyCompetitions),
    db.select({ n: count() }).from(players).where(eq(players.banned, true)),
    db.select({ n: count() }).from(users).where(sql`${users.platformRole} <> 'none'`),
  ]);

  return {
    clans: clanRows?.n ?? 0,
    activeClans: active?.n ?? 0,
    suspendedClans: suspended?.n ?? 0,
    archivedClans: archived?.n ?? 0,
    people: peopleRow?.n ?? 0,
    accounts: accountRow?.n ?? 0,
    seats: seatRow?.n ?? 0,
    logins: loginRow?.n ?? 0,
    events: eventRow?.n ?? 0,
    competitions: compRow?.n ?? 0,
    bannedPeople: bannedRow?.n ?? 0,
    platformStaff: staffRow?.n ?? 0,
  };
}

export interface ClanRow {
  id: number;
  slug: string;
  name: string;
  host: string;
  status: string;
  plan: string;
  memberCap: number | null;
  createdAt: string;
  /** The in-game clan name, and whether anybody has proved it. */
  inGameName: string | null;
  verified: boolean;
  members: number;
  guests: number;
  events: number;
  owner: string | null;
}

/**
 * Every clan, with the numbers you would want before acting on one.
 *
 * Aggregated in SQL rather than per-clan in a loop: the directory did that once and it was 509ms for
 * a handful of clans, which does not survive a hundred.
 */
export async function allClans(): Promise<ClanRow[]> {
  // clan-scope: global -- the clan directory IS the list of every clan.
  const rows = await db
    .select({
      id: clans.id,
      slug: clans.slug,
      name: clans.name,
      customDomain: clans.customDomain,
      status: clans.status,
      plan: clans.plan,
      memberCap: clans.memberCap,
      createdAt: clans.createdAt,
      inGameName: clans.inGameName,
      verifiedAt: clans.ingameNameVerifiedAt,
      // `clans.id` is written out rather than interpolated: drizzle renders an interpolated column
      // unqualified inside a raw fragment, and every one of these subqueries has an `id` of its own,
      // so it comes back as "column reference id is ambiguous" — at run time, from Postgres, since
      // nothing about the fragment is typed.
      members: sql<number>`(
        select count(*) from ${clanMemberships} m
        where m.clan_id = clans.id and m.left_at is null and m.kind = 'member'
      )`,
      guests: sql<number>`(
        select count(*) from ${clanMemberships} m
        where m.clan_id = clans.id and m.left_at is null and m.kind = 'guest'
      )`,
      events: sql<number>`(select count(*) from ${eventsTable} e where e.clan_id = clans.id)`,
      owner: sql<string | null>`(
        select u.display_name from ${clanStaff} cs
        join ${users} u on u.id = cs.user_id
        where cs.clan_id = clans.id and cs.role = 'owner' limit 1
      )`,
    })
    .from(clans)
    .orderBy(clans.name);

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    host: r.customDomain || `${r.slug}.${apexDomain()}`,
    status: r.status,
    plan: r.plan,
    memberCap: r.memberCap,
    createdAt: r.createdAt,
    inGameName: r.inGameName,
    verified: r.verifiedAt != null,
    members: Number(r.members ?? 0),
    guests: Number(r.guests ?? 0),
    events: Number(r.events ?? 0),
    owner: r.owner,
  }));
}

export interface PersonHit {
  playerId: number;
  displayName: string | null;
  banned: boolean;
  bannedReason: string | null;
  /** Every OSRS account this person owns, across every clan. */
  accounts: { id: number; rsn: string; status: string; verified: boolean }[];
  /** Where they sit, and as what. The answer the old model could not give at all. */
  memberships: { clanId: number; clanName: string; kind: string; rank: string | null; left: boolean }[];
  /** Clan authority, per clan. Separate axis from platform role. */
  grants: { clanId: number; clanName: string; role: string }[];
  discordId: string | null;
  platformRole: string;
  userId: number | null;
}

/**
 * Find people by RSN, Discord name, display name, or Discord id.
 *
 * Searches ACCOUNTS and LOGINS and resolves both to the person, because the operator asking has one
 * of those strings and not the other: a clan reports an RSN, a Discord report names a handle, and
 * they are the same human.
 */
export async function findPeople(query: string, limit = 25): Promise<PersonHit[]> {
  const q = query.trim();
  if (!q) return [];
  const like = `%${q.toLowerCase()}%`;

  // clan-scope: global -- finding a person across every clan is the whole purpose of this tool.
  const ids = await db
    .select({ id: players.id })
    .from(players)
    .leftJoin(accounts, eq(accounts.playerId, players.id))
    .leftJoin(users, eq(users.playerId, players.id))
    .where(
      sql`lower(${players.displayName}) like ${like}
        or lower(${accounts.rsn}) like ${like}
        or lower(${accounts.rsnNormalized}) like ${like}
        or lower(${users.displayName}) like ${like}
        or lower(${users.discordUsername}) like ${like}
        or ${users.discordId} = ${q}`,
    )
    .groupBy(players.id)
    .limit(limit);

  return Promise.all(ids.map((r) => personDetail(r.id))).then((rows) =>
    rows.filter((r): r is PersonHit => r != null),
  );
}

/** One person, fully assembled: their accounts, their seats, their clan grants. */
export async function personDetail(playerId: number): Promise<PersonHit | null> {
  const person = await db.query.players.findFirst({ where: eq(players.id, playerId) });
  if (!person) return null;

  // clan-scope: global -- a person's accounts and seats span clans by definition; that is the point.
  const [accts, seats, grants, login] = await Promise.all([
    db
      .select({
        id: accounts.id,
        rsn: accounts.rsn,
        status: accounts.status,
        verifiedAt: accounts.verifiedAt,
      })
      .from(accounts)
      .where(eq(accounts.playerId, playerId))
      .orderBy(desc(accounts.isPrimary), accounts.rsn),
    db
      .select({
        clanId: clanMemberships.clanId,
        clanName: clans.name,
        kind: clanMemberships.kind,
        rank: clanMemberships.rank,
        leftAt: clanMemberships.leftAt,
      })
      .from(clanMemberships)
      .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
      .innerJoin(clans, eq(clans.id, clanMemberships.clanId))
      .where(eq(accounts.playerId, playerId))
      .orderBy(clans.name),
    db
      .select({ clanId: clanStaff.clanId, clanName: clans.name, role: clanStaff.role })
      .from(clanStaff)
      .innerJoin(users, eq(users.id, clanStaff.userId))
      .innerJoin(clans, eq(clans.id, clanStaff.clanId))
      .where(eq(users.playerId, playerId))
      .orderBy(clans.name),
    db.query.users.findFirst({ where: eq(users.playerId, playerId) }),
  ]);

  return {
    playerId,
    displayName: person.displayName,
    banned: person.banned,
    bannedReason: person.bannedReason,
    accounts: accts.map((a) => ({
      id: a.id,
      rsn: a.rsn,
      status: a.status,
      verified: a.verifiedAt != null,
    })),
    memberships: seats.map((s) => ({
      clanId: s.clanId,
      clanName: s.clanName,
      kind: s.kind,
      rank: s.rank,
      left: s.leftAt != null,
    })),
    grants: grants.map((g) => ({ clanId: g.clanId, clanName: g.clanName, role: g.role })),
    discordId: login?.discordId ?? null,
    platformRole: login?.platformRole ?? 'none',
    userId: login?.id ?? null,
  };
}

/**
 * People in more than one clan — the population the whole conversion exists to serve, and the
 * cheapest sanity check that identity actually merged rather than duplicating.
 */
export async function multiClanPeople(limit = 20): Promise<{ playerId: number; name: string | null; clans: number }[]> {
  // clan-scope: global -- "how many clans is this person in" is not answerable within one.
  const rows = await db
    .select({
      playerId: players.id,
      name: players.displayName,
      clans: countDistinct(clanMemberships.clanId),
    })
    .from(eventParticipants)
    .innerJoin(players, eq(accounts.playerId, players.id))
    .innerJoin(clanMemberships, and(eq(clanMemberships.accountId, accounts.id), isNull(clanMemberships.leftAt)))
    .groupBy(players.id, players.displayName)
    .having(sql`count(distinct ${clanMemberships.clanId}) > 1`)
    .orderBy(desc(countDistinct(clanMemberships.clanId)))
    .limit(limit);
  return rows.map((r) => ({ playerId: r.playerId, name: r.name, clans: Number(r.clans) }));
}
