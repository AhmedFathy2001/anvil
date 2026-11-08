// The lab's cast: test users staff can put on boards, give tiers, and view the site as.
//
// A test user is a real users/players/accounts trio with two marks no real person can carry: a login
// whose Discord id starts with LAB_DUMMY_LOGIN, and a character name starting "Lab~" (a "~" is not a
// legal game name). They are FOUND BY THE LOGIN MARK ONLY, never by name, so a real character that
// somehow held one of these names is never mistaken for one. Each holds a member seat in the hidden
// lab clan, so lab boards and the lab clan's feed have people in them.

import { and, eq, inArray, like } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships, clanStaff, players, supporterSubscriptions, users } from '@/db/schema';
import { normalizeRsn } from '@/lib/auth';
import { CLAN_ROLES, type ClanRole } from '@/lib/clanRoles';
import { ensureLabClan, labClanId } from '@/lib/lab';
import { LAB_DUMMY_LOGIN } from '@/lib/labRules';
import { supporterState, type SupporterTierId } from '@/lib/supporterTiers';

export interface TestUser {
  userId: number;
  accountId: number;
  rsn: string;
  tier: SupporterTierId | null;
}

/** "Captain 2" → "Lab~Captain2": the lab prefix, letters and digits only, a legal 12 at most. */
export function testUserName(raw: string): string | null {
  const body = raw.replace(/^lab~/i, '').replace(/[^A-Za-z0-9]/g, '').slice(0, 8);
  return body ? `Lab~${body[0].toUpperCase()}${body.slice(1)}` : null;
}

/** Is this login one of the lab's test users? */
export async function isTestUser(userId: number): Promise<boolean> {
  const row = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { discordId: true } });
  return !!row?.discordId?.startsWith(LAB_DUMMY_LOGIN);
}

/**
 * The test user with this name, created on first use, with a member seat in the lab clan. Null when
 * a REAL character already holds the name: it is never adopted.
 */
export async function ensureTestUser(actorUserId: number, name: string): Promise<TestUser | null> {
  const rsn = testUserName(name);
  if (!rsn) return null;
  const key = normalizeRsn(rsn);
  const clanId = await ensureLabClan(actorUserId);
  let login = await db.query.users.findFirst({ where: eq(users.discordId, `${LAB_DUMMY_LOGIN}${key}`), columns: { id: true, playerId: true } });
  if (!login) {
    if (await db.query.accounts.findFirst({ where: eq(accounts.rsnNormalized, key), columns: { id: true } })) return null;
    const [person] = await db.insert(players).values({ displayName: rsn }).returning({ id: players.id });
    [login] = await db
      .insert(users)
      .values({ displayName: rsn, discordId: `${LAB_DUMMY_LOGIN}${key}`, playerId: person.id })
      .returning({ id: users.id, playerId: users.playerId });
  }
  if (login.playerId == null) return null;
  let account = await db.query.accounts.findFirst({
    where: and(eq(accounts.playerId, login.playerId), eq(accounts.rsnNormalized, key)),
    columns: { id: true },
  });
  if (!account) {
    if (await db.query.accounts.findFirst({ where: eq(accounts.rsnNormalized, key), columns: { id: true } })) return null;
    [account] = await db.insert(accounts).values({ playerId: login.playerId, rsn, rsnNormalized: key }).returning({ id: accounts.id });
  }
  await db.insert(clanMemberships).values({ clanId, accountId: account.id, kind: 'member', source: 'lab' }).onConflictDoNothing();
  return { userId: login.id, accountId: account.id, rsn, tier: null };
}

const CHUNK = 500;

function chunks<T>(xs: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += CHUNK) out.push(xs.slice(i, i + CHUNK));
  return out;
}

/**
 * ensureTestUser for many names at once, in bulk: a few chunked selects and inserts for the whole
 * list instead of several queries per name, so a 1000-player field is a handful of round trips.
 *
 * The same rules as the single version: an existing test user is found by its LOGIN MARK and reused;
 * a name a REAL character holds is never adopted (it is left out of the result); every one returned
 * holds a member seat in the lab clan. Returned in the order asked, without the refused ones.
 */
export async function ensureTestUsers(actorUserId: number, names: string[]): Promise<TestUser[]> {
  const wanted: { rsn: string; key: string; login: string }[] = [];
  const seenKeys = new Set<string>();
  for (const n of names) {
    const rsn = testUserName(n);
    if (!rsn) continue;
    const key = normalizeRsn(rsn);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    wanted.push({ rsn, key, login: `${LAB_DUMMY_LOGIN}${key}` });
  }
  if (!wanted.length) return [];
  const clanId = await ensureLabClan(actorUserId);

  // 1. Logins that already exist, by the mark.
  const logins = new Map<string, { id: number; playerId: number | null }>();
  for (const part of chunks(wanted)) {
    const rows = await db
      .select({ id: users.id, playerId: users.playerId, discordId: users.discordId })
      .from(users)
      .where(inArray(users.discordId, part.map((w) => w.login)));
    for (const r of rows) logins.set(r.discordId!, { id: r.id, playerId: r.playerId });
  }

  // 2. Accounts already holding these names, and whose they are.
  const accountByKey = new Map<string, { id: number; playerId: number | null }>();
  for (const part of chunks(wanted)) {
    const rows = await db
      .select({ id: accounts.id, playerId: accounts.playerId, key: accounts.rsnNormalized })
      .from(accounts)
      .where(inArray(accounts.rsnNormalized, part.map((w) => w.key)));
    for (const r of rows) accountByKey.set(r.key, { id: r.id, playerId: r.playerId });
  }
  // A name held by an account that is not this test user's is a real character's: never adopted.
  const isReal = (w: (typeof wanted)[number]) => {
    const acct = accountByKey.get(w.key);
    if (!acct) return false;
    const login = logins.get(w.login);
    return !login || login.playerId == null || acct.playerId !== login.playerId;
  };

  // 3. New people + logins for the names nobody holds yet.
  const fresh = wanted.filter((w) => !logins.has(w.login) && !accountByKey.has(w.key));
  for (const part of chunks(fresh)) {
    const people = await db.insert(players).values(part.map((w) => ({ displayName: w.rsn }))).returning({ id: players.id });
    const made = await db
      .insert(users)
      .values(part.map((w, i) => ({ displayName: w.rsn, discordId: w.login, playerId: people[i].id })))
      .onConflictDoNothing()
      .returning({ id: users.id, playerId: users.playerId, discordId: users.discordId });
    for (const r of made) logins.set(r.discordId!, { id: r.id, playerId: r.playerId });
    // Lost a race to another fill: drop the spare people and read the winner's logins.
    const lost = part.filter((w) => !made.some((m) => m.discordId === w.login));
    if (lost.length) {
      const used = new Set(made.map((m) => m.playerId));
      const spare = people.map((p) => p.id).filter((id) => !used.has(id));
      if (spare.length) await db.delete(players).where(inArray(players.id, spare));
      const rows = await db
        .select({ id: users.id, playerId: users.playerId, discordId: users.discordId })
        .from(users)
        .where(inArray(users.discordId, lost.map((w) => w.login)));
      for (const r of rows) logins.set(r.discordId!, { id: r.id, playerId: r.playerId });
    }
  }

  // 4. Accounts for logins that have none yet.
  const needAccount = wanted.filter((w) => logins.get(w.login)?.playerId != null && !accountByKey.has(w.key));
  for (const part of chunks(needAccount)) {
    const made = await db
      .insert(accounts)
      .values(part.map((w) => ({ playerId: logins.get(w.login)!.playerId!, rsn: w.rsn, rsnNormalized: w.key })))
      .onConflictDoNothing()
      .returning({ id: accounts.id, playerId: accounts.playerId, key: accounts.rsnNormalized });
    for (const r of made) accountByKey.set(r.key, { id: r.id, playerId: r.playerId });
  }

  const out: TestUser[] = [];
  for (const w of wanted) {
    const login = logins.get(w.login);
    const acct = accountByKey.get(w.key);
    if (!login || login.playerId == null || !acct || isReal(w)) continue;
    out.push({ userId: login.id, accountId: acct.id, rsn: w.rsn, tier: null });
  }

  // 5. Member seats in the lab clan.
  for (const part of chunks(out)) {
    await db
      .insert(clanMemberships)
      .values(part.map((u) => ({ clanId, accountId: u.accountId, kind: 'member', source: 'lab' })))
      .onConflictDoNothing();
  }
  return out;
}

/** Every test user, with the Supporter tier each holds right now. */
export async function listTestUsers(): Promise<TestUser[]> {
  const rows = await db
    .select({ userId: users.id, accountId: accounts.id, rsn: accounts.rsn })
    .from(users)
    .innerJoin(accounts, eq(accounts.playerId, users.playerId))
    .where(like(users.discordId, `${LAB_DUMMY_LOGIN}%`))
    .orderBy(accounts.rsn);
  const subs = rows.length
    ? await db
        .select({
          userId: supporterSubscriptions.userId,
          tier: supporterSubscriptions.tier,
          status: supporterSubscriptions.status,
          currentPeriodEnd: supporterSubscriptions.currentPeriodEnd,
          startedAt: supporterSubscriptions.startedAt,
        })
        .from(supporterSubscriptions)
        .innerJoin(users, eq(users.id, supporterSubscriptions.userId))
        .where(like(users.discordId, `${LAB_DUMMY_LOGIN}%`))
    : [];
  return rows.map((r) => ({ ...r, tier: supporterState(subs.filter((s) => s.userId === r.userId))?.tier.id ?? null }));
}

/** Your own role in the lab clan: owner down to plain member. */
export async function setLabClanRole(actorUserId: number, role: ClanRole): Promise<void> {
  if (!CLAN_ROLES.includes(role)) throw new Error('unknown role');
  const clanId = await ensureLabClan(actorUserId);
  // 'member' is kept as a row, not deleted: a member row holds no authority (lib/auth), and starting
  // a session (ensureLabClan) only grants admin to someone with NO row, so the choice sticks.
  await db
    .insert(clanStaff)
    .values({ clanId, userId: actorUserId, role, canEditTiles: role === 'owner' || role === 'admin' })
    .onConflictDoUpdate({
      target: [clanStaff.clanId, clanStaff.userId],
      set: { role, canEditTiles: role === 'owner' || role === 'admin' },
    });
}

/** Your role in the lab clan right now ('member' when you hold no grant). */
export async function labClanRole(actorUserId: number): Promise<ClanRole> {
  // A read: never creates the lab clan or grants anything (that is ensureLabClan's, on a write).
  const clanId = await labClanId();
  if (clanId == null) return 'member';
  const row = await db.query.clanStaff.findFirst({ where: and(eq(clanStaff.clanId, clanId), eq(clanStaff.userId, actorUserId)), columns: { role: true } });
  return (row?.role as ClanRole) ?? 'member';
}
