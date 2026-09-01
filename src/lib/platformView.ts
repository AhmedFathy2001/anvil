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

import { and, count, countDistinct, desc, eq, isNull, like, or, sql } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanAuditLog, clanMemberships, clanStaff, clans, events as eventsTable, players, users, weeklyCompetitions } from '@/db/schema';
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
  /**
   * ONE ROW PER CLAN, not per seat.
   *
   * A seat is (account × clan), so somebody playing three characters in one clan holds three seats
   * there — and the page listed each of them as a separate clan. It read "Clans (5)" for a person in
   * two, three of the rows saying "The AFK Spot" with nothing to say which character each was, since
   * the query joined accounts and then never selected the RSN.
   *
   * Authority is folded in for the same reason. It used to be its own list, so a clan somebody runs
   * WITHOUT a roster seat — which is ordinary for staff — appeared under authority and was missing
   * from the clan list entirely, as though they were not involved with it.
   */
  clans: {
    clanId: number;
    clanName: string;
    /** Their seats here, one per character. Empty when they hold only a grant. */
    seats: { rsn: string; kind: string; rank: string | null; left: boolean }[];
    /** Clan authority here, if any. A separate axis from platform role, and from holding a seat. */
    grant: string | null;
  }[];
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
        // THE CHARACTER. The join was already here; the column was not, so every seat row was
        // anonymous and three seats in one clan rendered as three identical lines.
        rsn: accounts.rsn,
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
    clans: groupByClan(seats, grants),
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
    .from(accounts)
    .innerJoin(players, eq(accounts.playerId, players.id))
    .innerJoin(clanMemberships, and(eq(clanMemberships.accountId, accounts.id), isNull(clanMemberships.leftAt)))
    .groupBy(players.id, players.displayName)
    .having(sql`count(distinct ${clanMemberships.clanId}) > 1`)
    .orderBy(desc(countDistinct(clanMemberships.clanId)))
    .limit(limit);
  return rows.map((r) => ({ playerId: r.playerId, name: r.name, clans: Number(r.clans) }));
}


/**
 * Seats and grants, folded into one row per clan.
 *
 * Both lists are keyed by clan and were rendered as two, which made a person look like they were in
 * more clans than they are — and hid the ordinary case of somebody who RUNS a clan without holding a
 * roster seat in it, since that clan appeared only under authority.
 */
function groupByClan(
  seats: { clanId: number; clanName: string; rsn: string; kind: string; rank: string | null; leftAt: string | null }[],
  grants: { clanId: number; clanName: string; role: string }[],
): PersonHit['clans'] {
  const by = new Map<number, PersonHit['clans'][number]>();

  const ensure = (clanId: number, clanName: string) => {
    const found = by.get(clanId);
    if (found) return found;
    const made = { clanId, clanName, seats: [], grant: null };
    by.set(clanId, made);
    return made;
  };

  for (const s of seats) {
    ensure(s.clanId, s.clanName).seats.push({
      rsn: s.rsn,
      kind: s.kind,
      rank: s.rank,
      left: s.leftAt != null,
    });
  }
  for (const g of grants) ensure(g.clanId, g.clanName).grant = g.role;

  return [...by.values()].sort((a, b) => a.clanName.localeCompare(b.clanName));
}

// ── What operators have done ──────────────────────────────────────────────────────────────────

export interface PlatformAction {
  id: number;
  at: string;
  /** 'platform_banned', 'platform_role_changed', … */
  eventType: string;
  /** Who did it. Null only if their login has since been deleted. */
  actor: string | null;
  /** The clan it was done to, when it was done to one. */
  clan: { id: number; slug: string; name: string } | null;
  before: string | null;
  after: string | null;
  notes: string | null;
}

/**
 * Every action taken with platform authority.
 *
 * THE TRAIL ALREADY EXISTED AND NOTHING READ IT. Bans, role grants, owner appointments and borrowed
 * grants have all been writing to `clan_audit_log` since they were built — with `clan_id` NULL when
 * the action belongs to no clan — and there was no page anywhere that showed them. An audit log
 * nobody can read is a log that does not exist: the point of recording who suspended a clan is that
 * somebody can later ask.
 *
 * MATCHED BY PREFIX, not by an enumerated list. Every platform writer names its event
 * `platform_*`, and a list here would silently miss the next one — which is the failure mode an
 * audit view can least afford. `clan_id IS NULL` is kept alongside it as a belt: an entry belonging
 * to no clan is a platform entry whatever it calls itself, and it appears on no clan's own history
 * page, so this is the only place it could ever be seen.
 */
export async function platformActions(limit = 100): Promise<PlatformAction[]> {
  // clan-scope: global -- reading what operators did ACROSS clans is the entire purpose here, and
  // the platform-only entries belong to no clan at all.
  const rows = await db
    .select({
      id: clanAuditLog.id,
      at: clanAuditLog.occurredAt,
      eventType: clanAuditLog.eventType,
      actor: users.displayName,
      clanId: clans.id,
      clanSlug: clans.slug,
      clanName: clans.name,
      before: clanAuditLog.oldValue,
      after: clanAuditLog.newValue,
      notes: clanAuditLog.notes,
    })
    .from(clanAuditLog)
    .leftJoin(users, eq(users.id, clanAuditLog.actorUserId))
    .leftJoin(clans, eq(clans.id, clanAuditLog.clanId))
    .where(or(like(clanAuditLog.eventType, 'platform\\_%'), isNull(clanAuditLog.clanId)))
    .orderBy(desc(clanAuditLog.occurredAt), desc(clanAuditLog.id))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    at: r.at,
    eventType: r.eventType,
    actor: r.actor,
    clan: r.clanId != null ? { id: r.clanId, slug: r.clanSlug!, name: r.clanName! } : null,
    before: r.before,
    after: r.after,
    notes: r.notes,
  }));
}


// ── Disputed names ────────────────────────────────────────────────────────────────────────────

export interface NameCollision {
  /** The in-game name two or more clans are claiming, as the verified holder spells it. */
  inGameName: string;
  clans: {
    id: number;
    slug: string;
    name: string;
    verified: boolean;
    /** Refused claims recorded against this clan for this name. */
    refusedAttempts: number;
  }[];
}

/**
 * Where two clans claim one in-game clan.
 *
 * S6 refuses the second claimant with a 409 and points them at /staff — and until now /staff had
 * nothing to point AT. The mechanism to resolve a dispute existed (verify or unverify by hand); the
 * dispute itself was invisible, so an operator could only act on one somebody emailed them about.
 *
 * MATCHED CASE-INSENSITIVELY, because that is how the claim check matches. An impersonator picking
 * "the afk spot" against "The AFK Spot" is exactly the case worth catching, and a case-sensitive
 * grouping would show two tidy rows and no collision.
 *
 * Unverified clans are included on purpose. A name held by nobody but claimed by three is not a
 * dispute the 409 has fired on yet, and it is the moment an operator would rather hear about it.
 *
 * AND THE REFUSALS, which is the case this missed entirely. `clans.in_game_name` is written by a
 * SUCCESSFUL claim and by nothing else — the settings form writes the setting, not the column — so a
 * clan turned away from a name it really owns never gets the column set, the group has one member,
 * and the squat that caused the refusal is invisible here. Which is the exact shape a squatter
 * produces: they claim first, the real clan is refused, and the only trace was an audit row nothing
 * read. The refusal log is therefore a second source of contested names, not merely an annotation on
 * names found some other way.
 */
export async function nameCollisions(): Promise<NameCollision[]> {
  // clan-scope: global -- a collision is by definition between clans; there is no clan to scope to.
  const rows = await db
    .select({
      id: clans.id,
      slug: clans.slug,
      name: clans.name,
      inGameName: clans.inGameName,
      verifiedAt: clans.ingameNameVerifiedAt,
    })
    .from(clans)
    .where(sql`${clans.inGameName} is not null and ${clans.inGameName} <> ''`);

  const byName = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = (r.inGameName ?? '').trim().toLowerCase();
    if (!key) continue;
    byName.set(key, [...(byName.get(key) ?? []), r]);
  }

  // Every refusal, with the name it was refused for. clan_id is the clan that ATTEMPTED; the name
  // and the holder ride in the payload.
  //
  // clan-scope: global -- a refusal is a fact about two clans, and the operator arbitrating is the
  // one surface that is allowed to see both.
  const refusals = await db
    .select({ clanId: clanAuditLog.clanId, newValue: clanAuditLog.newValue })
    .from(clanAuditLog)
    .where(eq(clanAuditLog.eventType, 'ingame_name_claim_refused'));

  const attemptsBy = new Map<number, number>();
  const refusedNameFor = new Map<string, string>();
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const r of refusals) {
    if (r.clanId != null) {
      attemptsBy.set(r.clanId, (attemptsBy.get(r.clanId) ?? 0) + 1);
    }
    let name = '';
    try {
      name = String((JSON.parse(r.newValue ?? '{}') as { inGameName?: unknown }).inGameName ?? '');
    } catch {
      continue; // a payload we cannot read is not a dispute we can describe
    }
    const key = name.trim().toLowerCase();
    if (!key || r.clanId == null) continue;
    // Remember how the refusal spelled it, so a group assembled purely from refusals still has a
    // name to show — the attempter's own row carries none, that being the point.
    if (!refusedNameFor.has(key)) refusedNameFor.set(key, name.trim());

    // Fold the refused clan into the group for that name. It has no in_game_name of its own — being
    // refused is precisely why — so it is carried here with a null one and reads as unverified,
    // which is what it is.
    const group = byName.get(key) ?? [];
    if (!group.some((g) => g.id === r.clanId)) {
      const known = byId.get(r.clanId);
      if (known) {
        byName.set(key, [...group, known]);
      } else {
        const [row] = await db
          .select({
            id: clans.id,
            slug: clans.slug,
            name: clans.name,
            inGameName: clans.inGameName,
            verifiedAt: clans.ingameNameVerifiedAt,
          })
          .from(clans)
          .where(eq(clans.id, r.clanId))
          .limit(1);
        if (row) {
          byId.set(row.id, row);
          byName.set(key, [...group, row]);
        }
      }
    }
  }

  // Keyed, not just grouped: the key IS the lowercased name, so a group assembled purely from
  // refusals still knows what it is called even though no member row carries the name.
  const contested = [...byName.entries()].filter(([, g]) => g.length > 1);
  if (contested.length === 0) return [];

  return contested.map(([key, group]) => ({
    // Spelled as the verified holder spells it; then as anybody holding it does; then as the refusal
    // recorded it. The last one carries a group whose only members were turned away.
    inGameName:
      (group.find((g) => g.verifiedAt) ?? group.find((g) => g.inGameName))?.inGameName ??
      refusedNameFor.get(key) ??
      '',
    clans: group
      .map((g) => ({
        id: g.id,
        slug: g.slug,
        name: g.name,
        verified: g.verifiedAt != null,
        refusedAttempts: attemptsBy.get(g.id) ?? 0,
      }))
      // The holder first; it is the one an operator is deciding for or against.
      .sort((a, b) => Number(b.verified) - Number(a.verified) || a.name.localeCompare(b.name)),
  }));
}
