// The lab's cast: test users staff can put on boards, give tiers, and view the site as.
//
// A test user is a real users/players/accounts trio with two marks no real person can carry: a login
// whose Discord id starts with LAB_DUMMY_LOGIN, and a character name starting "Lab~" (a "~" is not a
// legal game name). They are FOUND BY THE LOGIN MARK ONLY, never by name, so a real character that
// somehow held one of these names is never mistaken for one. Each holds a member seat in the hidden
// lab clan, so lab boards and the lab clan's feed have people in them.

import { and, eq, like } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships, clanStaff, players, supporterSubscriptions, users } from '@/db/schema';
import { normalizeRsn } from '@/lib/auth';
import { CLAN_ROLES, type ClanRole } from '@/lib/clanRoles';
import { ensureLabClan } from '@/lib/lab';
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
  const clanId = await ensureLabClan(actorUserId);
  const row = await db.query.clanStaff.findFirst({ where: and(eq(clanStaff.clanId, clanId), eq(clanStaff.userId, actorUserId)), columns: { role: true } });
  return (row?.role as ClanRole) ?? 'member';
}
