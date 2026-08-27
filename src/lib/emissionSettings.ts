import { and, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { accountClanEmission, accounts, clanMemberships, clans, userWebhooks, users } from '@/db/schema';

/**
 * The read + write side of a PERSON's emission settings — the /profile surface behind
 * lib/emissionRouting. Everything here is scoped to the caller's own person; there is no path to read
 * or change anyone else's, which is the whole point of it living on the person rather than a clan.
 *
 * The routing engine computes defaults from seats + `shared`; this surface only edits the deviations
 * (the user's global block, the per-(account, clan) overrides, and the personal webhooks). A control
 * that reads "Default" here has no row at all.
 */

export type EmissionState = 'default' | 'always' | 'never';

export interface EmissionClanRow {
  clanId: number;
  name: string;
  /** How this account is attached to the clan, or null for a whitelisted alt with no seat here. */
  seat: 'member' | 'guest' | null;
  state: EmissionState;
}

export interface EmissionAccountRow {
  accountId: number;
  rsn: string;
  shared: boolean;
  /** The clan where this account holds its member seat, if any — shown as context, not editable. */
  memberClan: { clanId: number; name: string } | null;
  /** Guest clans + any whitelisted-elsewhere clan, each with its current override state. */
  clans: EmissionClanRow[];
}

export interface UserWebhookView {
  id: number;
  url: string;
  label: string | null;
  kinds: string[];
  minRarity: number | null;
}

export interface EmissionSettingsView {
  blockGuestEmissions: boolean;
  accounts: EmissionAccountRow[];
  /** Clans the person is a member of — the valid targets for pointing an alt at (the seatless case). */
  memberClans: { clanId: number; name: string }[];
  webhooks: UserWebhookView[];
}

export async function emissionSettingsView(userId: number, playerId: number): Promise<EmissionSettingsView> {
  const [user] = await db
    .select({ block: users.blockGuestEmissions })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const myAccounts = await db
    .select({ id: accounts.id, rsn: accounts.rsn, shared: accounts.shared })
    .from(accounts)
    .where(eq(accounts.playerId, playerId));
  const accountIds = myAccounts.map((a) => a.id);

  // Every seat any of the person's accounts holds, with the clan name.
  const seats = accountIds.length
    ? await db
        .select({
          accountId: clanMemberships.accountId,
          clanId: clanMemberships.clanId,
          kind: clanMemberships.kind,
          clanName: clans.name,
        })
        .from(clanMemberships)
        .innerJoin(clans, eq(clans.id, clanMemberships.clanId))
        .where(and(inArray(clanMemberships.accountId, accountIds), isNull(clanMemberships.leftAt)))
    : [];

  // Every override the person holds.
  const overrides = accountIds.length
    ? await db
        .select({ accountId: accountClanEmission.accountId, clanId: accountClanEmission.clanId, enabled: accountClanEmission.enabled })
        .from(accountClanEmission)
        .where(inArray(accountClanEmission.accountId, accountIds))
    : [];
  const stateOf = (accountId: number, clanId: number): EmissionState => {
    const o = overrides.find((x) => x.accountId === accountId && x.clanId === clanId);
    return o == null ? 'default' : o.enabled ? 'always' : 'never';
  };

  const memberClans = seats
    .filter((s) => s.kind === 'member')
    .map((s) => ({ clanId: s.clanId, name: s.clanName }));
  const memberClanIds = new Set(memberClans.map((c) => c.clanId));
  // Dedup member clans (several accounts could be members of the same clan — impossible under the
  // one-member-seat rule, but the read shouldn't rely on that).
  const memberClansUnique = [...new Map(memberClans.map((c) => [c.clanId, c])).values()];

  const clanNameOf = new Map(seats.map((s) => [s.clanId, s.clanName]));
  // Whitelisted-elsewhere clans need a name too, and they may have no seat, so pull any we're missing.
  const missingClanIds = overrides
    .filter((o) => !clanNameOf.has(o.clanId))
    .map((o) => o.clanId);
  if (missingClanIds.length) {
    const rows = await db.select({ id: clans.id, name: clans.name }).from(clans).where(inArray(clans.id, missingClanIds));
    for (const r of rows) clanNameOf.set(r.id, r.name);
  }

  const accountRows: EmissionAccountRow[] = myAccounts.map((a) => {
    const mine = seats.filter((s) => s.accountId === a.id);
    const memberSeat = mine.find((s) => s.kind === 'member');
    const guestSeats = mine.filter((s) => s.kind === 'guest');

    const rows: EmissionClanRow[] = guestSeats.map((s) => ({
      clanId: s.clanId,
      name: s.clanName,
      seat: 'guest' as const,
      state: stateOf(a.id, s.clanId),
    }));

    // Whitelisted somewhere this account has no seat — a seatless alt pointed at a member clan.
    const seatClanIds = new Set(mine.map((s) => s.clanId));
    for (const o of overrides) {
      if (o.accountId !== a.id || seatClanIds.has(o.clanId)) continue;
      rows.push({
        clanId: o.clanId,
        name: clanNameOf.get(o.clanId) ?? `Clan ${o.clanId}`,
        seat: null,
        state: o.enabled ? 'always' : 'never',
      });
    }

    return {
      accountId: a.id,
      rsn: a.rsn,
      shared: !!a.shared,
      memberClan: memberSeat ? { clanId: memberSeat.clanId, name: memberSeat.clanName } : null,
      clans: rows.sort((x, y) => x.name.localeCompare(y.name)),
    };
  });

  const hooks = await db
    .select()
    .from(userWebhooks)
    .where(eq(userWebhooks.userId, userId))
    .orderBy(userWebhooks.id);

  return {
    blockGuestEmissions: !!user?.block,
    accounts: accountRows.sort((a, b) => a.rsn.localeCompare(b.rsn)),
    memberClans: memberClansUnique.sort((a, b) => a.name.localeCompare(b.name)),
    webhooks: hooks.map((h) => ({
      id: h.id,
      url: h.url,
      label: h.label,
      kinds: safeKinds(h.kinds),
      minRarity: h.minRarity,
    })),
  };
}

function safeKinds(raw: string): string[] {
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p.filter((k): k is string => typeof k === 'string') : [];
  } catch {
    return [];
  }
}

// ── Writes, all scoped to the caller's person ──────────────────────────────────────────────────

/** Does this account belong to this person? Every write below gates on it. */
export async function accountBelongsToPerson(accountId: number, playerId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.playerId, playerId)))
    .limit(1);
  return !!row;
}

/**
 * Whether (accountId, clanId) is a valid emission target for this person to set an override on:
 * a clan the account has a live seat in, OR a clan the person is a member of (the alt case). Anything
 * else is refused so a whitelist can't point an account at a clan it has no connection to.
 */
export async function isValidEmissionTarget(accountId: number, clanId: number, playerId: number): Promise<boolean> {
  const [ownSeat] = await db
    .select({ id: clanMemberships.id })
    .from(clanMemberships)
    .where(and(eq(clanMemberships.accountId, accountId), eq(clanMemberships.clanId, clanId), isNull(clanMemberships.leftAt)))
    .limit(1);
  if (ownSeat) return true;

  const [memberSeat] = await db
    .select({ id: clanMemberships.id })
    .from(clanMemberships)
    .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
    .where(
      and(
        eq(accounts.playerId, playerId),
        eq(clanMemberships.clanId, clanId),
        eq(clanMemberships.kind, 'member'),
        isNull(clanMemberships.leftAt),
      ),
    )
    .limit(1);
  return !!memberSeat;
}

/** Set (or clear) the per-(account, clan) override. `state='default'` deletes the row. */
export async function setAccountClanEmission(accountId: number, clanId: number, state: EmissionState): Promise<void> {
  if (state === 'default') {
    await db
      .delete(accountClanEmission)
      .where(and(eq(accountClanEmission.accountId, accountId), eq(accountClanEmission.clanId, clanId)));
    return;
  }
  const enabled = state === 'always';
  await db
    .insert(accountClanEmission)
    .values({ accountId, clanId, enabled })
    .onConflictDoUpdate({
      target: [accountClanEmission.accountId, accountClanEmission.clanId],
      set: { enabled, updatedAt: new Date().toISOString() },
    });
}
