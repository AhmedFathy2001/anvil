import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { accountClanEmission, accounts, clanMemberships, userWebhooks, users } from '@/db/schema';
import { getSetting } from '@/lib/settings';

/** The clan setting key for "refuse social emissions from accounts that only guest here". */
export const CLAN_BLOCK_GUEST_EMISSIONS_KEY = 'block_guest_emissions';

/** A clan refuses incoming guest social emissions. Stored by ToggleSetting as 'true' | '1'. */
export async function clanBlocksGuestEmissions(clanId: number): Promise<boolean> {
  const raw = await getSetting(clanId, CLAN_BLOCK_GUEST_EMISSIONS_KEY);
  return raw === 'true' || raw === '1';
}

/** The person's own "don't broadcast to clans I guest in" preference (default: don't block). */
async function personBlocksGuestEmissions(playerId: number): Promise<boolean> {
  const rows = await db
    .select({ block: users.blockGuestEmissions })
    .from(users)
    .where(eq(users.playerId, playerId));
  // Any login of this person having it on is enough — a person has one today, but "on wins" is the
  // safe reading if that ever changes.
  return rows.some((r) => r.block);
}

/** Clans where this PERSON holds a live member seat, via ANY of their accounts. */
async function memberClanIdsOfPerson(playerId: number): Promise<Set<number>> {
  const rows = await db
    .select({ clanId: clanMemberships.clanId })
    .from(clanMemberships)
    .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
    .where(
      and(
        eq(accounts.playerId, playerId),
        eq(clanMemberships.kind, 'member'),
        isNull(clanMemberships.leftAt),
      ),
    );
  return new Set(rows.map((r) => r.clanId));
}

/**
 * Where a person's SOCIAL notifications go — a pet, a death, a random unique, a combat achievement —
 * once one account can hold a seat in several clans at once.
 *
 * This is the half of H5 that decides fan-out. The other half — EVIDENCE, a drop or KC that completes
 * a tile or a competition metric — is not routed here at all: it always reaches the clan running that
 * board, whatever the seat and whatever these controls say, because the clan judging the proof has to
 * see it. This file is only ever asked about the announcement.
 *
 * THE MODEL — a privacy rule as much as a routing one, and TWO-SIDED, so both the clan and the
 * person can say no. Spelled out rather than inferred at the call site.
 *
 *   member clan   the one clan where this account holds a member seat — announces, on by default.
 *                 The clan cannot block its own members, and the person silences it only with an
 *                 explicit per-clan off.
 *   guest clans   a clan the account only guests in. A guest emission survives EVERY gate:
 *                   1. the clan's own `block_guest_emissions` (RECEIVER VETO — absolute; a clan that
 *                      refuses guest noise gets none, whitelist or not),
 *                   2. an explicit per-(account, clan) silence (`enabled=false`),
 *                   3. an explicit per-(account, clan) whitelist (`enabled=true`) — which opts one
 *                      clan back in past the person's global block, and is how an ALT is pointed at a
 *                      clan its owner is a member of (a whitelisted alt may reach a clan it holds no
 *                      seat in, but only one its owner is a member of),
 *                   4. otherwise: the person's global "block emitting to guest clans" preference, and
 *                      then the `shared` floor — an unshared account never announces to a clan it
 *                      only guests in.
 *
 * The default is computed from seats + `accounts.shared`, so the common case — nothing configured —
 * routes correctly with no rows at all. The clan setting, the user column and account_clan_emission
 * hold only the deviations.
 */

export interface EmissionClan {
  clanId: number;
  /** Why this clan is in the list — a member seat, or a shared guest seat. */
  kind: 'member' | 'guest';
}

export async function socialEmissionClans(accountId: number): Promise<EmissionClan[]> {
  const [account] = await db
    .select({ shared: accounts.shared, playerId: accounts.playerId })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);
  if (!account) return [];

  // Live seats only — a departed seat is not somewhere this account announces.
  const seats = await db
    .select({ clanId: clanMemberships.clanId, kind: clanMemberships.kind })
    .from(clanMemberships)
    .where(and(eq(clanMemberships.accountId, accountId), isNull(clanMemberships.leftAt)));
  const seatKindOf = new Map(seats.map((s) => [s.clanId, s.kind]));

  // Per-(account, clan) overrides: enabled=false silences, enabled=true whitelists.
  const toggleRows = await db
    .select({ clanId: accountClanEmission.clanId, enabled: accountClanEmission.enabled })
    .from(accountClanEmission)
    .where(eq(accountClanEmission.accountId, accountId));
  const toggleOf = new Map(toggleRows.map((t) => [t.clanId, t.enabled]));

  const userBlocksGuests =
    account.playerId != null ? await personBlocksGuestEmissions(account.playerId) : false;
  // The "connected to a member" set: a whitelisted alt may announce to a clan it has no seat of its
  // own in, but only one its OWNER is a member of — never an arbitrary clan.
  const personMemberClans =
    account.playerId != null ? await memberClanIdsOfPerson(account.playerId) : new Set<number>();

  // Candidates: every clan the account has a seat in, plus any clan it is whitelisted to where the
  // person is a member (the alt case).
  const candidates = new Set<number>(seats.map((s) => s.clanId));
  for (const [clanId, enabled] of toggleOf) {
    if (enabled && personMemberClans.has(clanId)) candidates.add(clanId);
  }

  const out: EmissionClan[] = [];
  for (const clanId of candidates) {
    const kind = seatKindOf.get(clanId); // 'member' | 'guest' | undefined (whitelisted, no seat here)
    const e = toggleOf.get(clanId); // true (whitelist) | false (silence) | undefined (default)

    if (kind === 'member') {
      // The member clan is your home: it announces unless YOU explicitly silence it. A clan cannot
      // block its own members, and its guest setting does not apply to them.
      if (e !== false) out.push({ clanId, kind: 'member' });
      continue;
    }

    // A guest here, or a whitelisted alt with no seat of its own — either way, not a member.
    if (e === false) continue; // explicit silence
    // RECEIVER VETO, and it is absolute — a clan that refuses guest noise gets none, even one this
    // person whitelisted, because it is the clan's channel and its call.
    if (await clanBlocksGuestEmissions(clanId)) continue;
    if (e === true) {
      out.push({ clanId, kind: 'guest' }); // explicit whitelist — the person opted this one in
      continue;
    }
    // No explicit entry: the person's global block, then the shared default.
    if (userBlocksGuests) continue;
    if (account.shared) out.push({ clanId, kind: 'guest' });
    // guest + unshared + no whitelist → nothing; the shared gate is still the floor.
  }
  return out;
}

export interface PersonalTarget {
  url: string;
  label: string | null;
}

/** A person's own destinations that want `channel` — independent of any clan, gated by min_rarity. */
export async function personalWebhookTargets(
  userId: number,
  channel: string,
  gpValue?: number | null,
): Promise<PersonalTarget[]> {
  const hooks = await db.select().from(userWebhooks).where(eq(userWebhooks.userId, userId));
  const out: PersonalTarget[] = [];
  for (const h of hooks) {
    if (!parseKinds(h.kinds).includes(channel)) continue;
    // A gp floor only bites when we actually know the value — an unpriced kind (a death) passes.
    if (h.minRarity != null && gpValue != null && gpValue < h.minRarity) continue;
    out.push({ url: h.url, label: h.label });
  }
  return out;
}

/** The `kinds` JSON array, tolerant of anything that is not the array it should be. */
export function parseKinds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : [];
  } catch {
    return [];
  }
}
