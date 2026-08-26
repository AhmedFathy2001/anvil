import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { accountClanEmission, accounts, clanMemberships, userWebhooks } from '@/db/schema';

/**
 * Where a person's SOCIAL notifications go — a pet, a death, a random unique, a combat achievement —
 * once one account can hold a seat in several clans at once.
 *
 * This is the half of H5 that decides fan-out. The other half — EVIDENCE, a drop or KC that completes
 * a tile or a competition metric — is not routed here at all: it always reaches the clan running that
 * board, whatever the seat and whatever these toggles say, because the clan judging the proof has to
 * see it. This file is only ever asked about the announcement.
 *
 * THE MODEL, and it is a privacy rule as much as a routing one, so it is spelled out rather than
 * inferred at the call site:
 *
 *   member clan   the one clan where this account holds a member seat — announce, on by default. The
 *                 plugin's own global notification toggles are the kill switch for all of it.
 *   guest clans   a clan the account only guests in — announce ONLY IF the account is `shared`. An
 *                 unshared account announces nowhere but its member clan, because guesting somewhere
 *                 with an alt is not telling that clan about it. This gate is absolute: a per-clan
 *                 opt-in cannot open it, or `shared` would mean nothing.
 *   per clan      `account_clan_emission` overrides one clan — `enabled=false` silences it. It can
 *                 turn a clan OFF; it cannot turn the shared gate ON for a guest (see above).
 *
 * The default is computed from seats + `accounts.shared`, so the common case — nothing configured —
 * routes correctly with no rows at all. The table only holds the exceptions.
 */

export interface EmissionClan {
  clanId: number;
  /** Why this clan is in the list — a member seat, or a shared guest seat. */
  kind: 'member' | 'guest';
}

export async function socialEmissionClans(accountId: number): Promise<EmissionClan[]> {
  const [account] = await db
    .select({ shared: accounts.shared })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);
  if (!account) return [];

  // Live seats only — a departed seat is not somewhere this account announces.
  const seats = await db
    .select({ clanId: clanMemberships.clanId, kind: clanMemberships.kind })
    .from(clanMemberships)
    .where(and(eq(clanMemberships.accountId, accountId), isNull(clanMemberships.leftAt)));

  const toggleRows = await db
    .select({ clanId: accountClanEmission.clanId, enabled: accountClanEmission.enabled })
    .from(accountClanEmission)
    .where(eq(accountClanEmission.accountId, accountId));
  const toggleOf = new Map(toggleRows.map((t) => [t.clanId, t.enabled]));

  const out: EmissionClan[] = [];
  for (const seat of seats) {
    if (toggleOf.get(seat.clanId) === false) continue; // explicitly silenced for this clan
    if (seat.kind === 'member') {
      out.push({ clanId: seat.clanId, kind: 'member' });
    } else if (account.shared) {
      out.push({ clanId: seat.clanId, kind: 'guest' });
    }
    // guest + not shared → nothing; the shared gate is the whole point.
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
