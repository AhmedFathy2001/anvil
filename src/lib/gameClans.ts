// Ghost clans: which in-game clan each character is in, built member by member from what each
// player's own plugin reports — the way WOM and RuneProfile show a player's clan, for clans that
// have never heard of Anvil.
//
// WHAT IT IS. A fact about a CHARACTER (Anvil owns characters), surfaced on the character's profile
// and gathered onto a hidden, unlisted page per clan. Only Anvil users appear, only their own rows,
// only while their account is shared and they have not hidden it.
//
// WHAT IT IS NOT. Membership. Nothing here creates a seat, a staff grant or any access in an Anvil
// clan — those come from a roster sync or an admin, and a client-reported clan name is exactly the
// kind of claim that must not move them. When the in-game clan IS on Anvil (a verified
// `clans.in_game_name`), it is matched by name key at read time and the Anvil clan's own page
// takes over.

import { and, desc, eq, gte, inArray, isNotNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import { accountGameClans, accounts, clans, gameClans, settings } from '@/db/schema';
import { listedClanWhere, showcaseJoinOn } from '@/lib/clanListing';
import {
  GAME_CLAN_RESTAMP_MS,
  GAME_CLAN_STALE_DAYS,
  gameClanKey,
  type GameClanReport,
} from '@/lib/gameClanReport';

function freshSince(): string {
  return new Date(Date.now() - GAME_CLAN_STALE_DAYS * 86_400_000).toISOString();
}

/**
 * Store what the plugin said. `report` null = it looked and the character is in no clan.
 * Writes nothing when the sighting repeats the last one and was stamped within the day.
 */
export async function recordGameClan(
  accountId: number,
  report: GameClanReport | null,
  nowIso = new Date().toISOString(),
): Promise<{ stored: boolean }> {
  let gameClanId: number | null = null;
  if (report) {
    const key = gameClanKey(report.name);
    const [row] = await db
      .insert(gameClans)
      .values({ nameKey: key, name: report.name, firstSeenAt: nowIso, lastSeenAt: nowIso })
      .onConflictDoUpdate({
        target: gameClans.nameKey,
        set: { name: report.name, lastSeenAt: nowIso },
        // A busy clan's logins would otherwise rewrite this row all evening.
        setWhere: sql`${gameClans.name} is distinct from ${report.name} or ${gameClans.lastSeenAt} < ${new Date(Date.parse(nowIso) - GAME_CLAN_RESTAMP_MS).toISOString()}`,
      })
      .returning({ id: gameClans.id });
    gameClanId =
      row?.id ??
      (await db.select({ id: gameClans.id }).from(gameClans).where(eq(gameClans.nameKey, key)).limit(1))[0]?.id ??
      null;
    if (gameClanId == null) return { stored: false };
  }

  const next = {
    gameClanId,
    rank: report?.rank ?? null,
    title: report?.title ?? null,
    joinedOn: report?.joinedOn ?? null,
  };
  const [current] = await db
    .select()
    .from(accountGameClans)
    .where(eq(accountGameClans.accountId, accountId))
    .limit(1);
  if (
    current &&
    current.gameClanId === next.gameClanId &&
    current.rank === next.rank &&
    current.title === next.title &&
    current.joinedOn === next.joinedOn &&
    Date.parse(nowIso) - Date.parse(current.observedAt) < GAME_CLAN_RESTAMP_MS
  ) {
    return { stored: false };
  }

  await db
    .insert(accountGameClans)
    .values({ accountId, ...next, observedAt: nowIso })
    // `hidden` is left alone: the owner's choice outlives a clan change.
    .onConflictDoUpdate({ target: accountGameClans.accountId, set: { ...next, observedAt: nowIso } });
  return { stored: true };
}

export type AnvilClanRef = { slug: string; name: string; logoUrl: string | null };

/**
 * The Anvil clan behind each in-game name key: a VERIFIED in-game name only (a typed one proves
 * nothing). `listed` false = it exists but chose to stay off public surfaces, so nothing public may
 * point at it or describe its members.
 */
async function anvilClansByKey(keys: string[]): Promise<Map<string, AnvilClanRef & { listed: boolean }>> {
  const out = new Map<string, AnvilClanRef & { listed: boolean }>();
  if (keys.length === 0) return out;
  // clan-scope: global -- matching an in-game name to WHICHEVER clan verified it; settings joined per clan row (showcaseJoinOn).
  const rows = await db
    .select({
      key: sql<string>`lower(trim(regexp_replace(${clans.inGameName}, '[\\s_\\u00a0]+', ' ', 'g')))`,
      slug: clans.slug,
      name: clans.name,
      logoUrl: clans.logoUrl,
      listed: sql<boolean>`coalesce(${listedClanWhere()}, false)`,
    })
    .from(clans)
    .leftJoin(settings, showcaseJoinOn())
    .where(
      and(
        isNotNull(clans.ingameNameVerifiedAt),
        inArray(sql`lower(trim(regexp_replace(${clans.inGameName}, '[\\s_\\u00a0]+', ' ', 'g')))`, keys),
      ),
    );
  for (const r of rows) out.set(r.key, { slug: r.slug, name: r.name, logoUrl: r.logoUrl, listed: !!r.listed });
  return out;
}

export type CharacterGameClan = {
  name: string;
  key: string;
  title: string | null;
  rank: number | null;
  joinedOn: string | null;
  hidden: boolean;
  /** The Anvil clan this is, when it is one and is listed. */
  anvilClan: AnvilClanRef | null;
  /** An Anvil clan that keeps itself off public pages: name the clan, link nowhere. */
  anvilClanUnlisted: boolean;
};

/** A character's in-game clan for its profile, or null when unknown or stale. Hidden rows are returned (the owner sees them). */
export async function gameClanForAccount(accountId: number): Promise<CharacterGameClan | null> {
  const [row] = await db
    .select({
      name: gameClans.name,
      key: gameClans.nameKey,
      title: accountGameClans.title,
      rank: accountGameClans.rank,
      joinedOn: accountGameClans.joinedOn,
      hidden: accountGameClans.hidden,
    })
    .from(accountGameClans)
    .innerJoin(gameClans, eq(gameClans.id, accountGameClans.gameClanId))
    .where(and(eq(accountGameClans.accountId, accountId), gte(accountGameClans.observedAt, freshSince())))
    .limit(1);
  if (!row) return null;
  const anvil = (await anvilClansByKey([row.key])).get(row.key);
  return {
    ...row,
    anvilClan: anvil?.listed ? { slug: anvil.slug, name: anvil.name, logoUrl: anvil.logoUrl } : null,
    anvilClanUnlisted: !!anvil && !anvil.listed,
  };
}

export async function setGameClanHidden(accountId: number, hidden: boolean): Promise<void> {
  await db.update(accountGameClans).set({ hidden }).where(eq(accountGameClans.accountId, accountId));
}

export type GhostClanMember = { rsn: string; title: string | null; rank: number | null; joinedOn: string | null };

export type GhostClanPage =
  | { kind: 'anvil'; slug: string }
  | { kind: 'ghost'; name: string; firstSeenAt: string; members: GhostClanMember[] };

/**
 * The hidden page for one in-game clan. Null = nothing to show (unknown, nobody visible, or an
 * Anvil clan that keeps itself private — a page listing its members would undo that choice).
 */
export async function ghostClanPage(rawKey: string): Promise<GhostClanPage | null> {
  const key = gameClanKey(rawKey);
  if (!key) return null;
  const anvil = (await anvilClansByKey([key])).get(key);
  if (anvil) return anvil.listed ? { kind: 'anvil', slug: anvil.slug } : null;

  const [clan] = await db.select().from(gameClans).where(eq(gameClans.nameKey, key)).limit(1);
  if (!clan) return null;

  const members = await db
    .select({
      rsn: accounts.rsn,
      title: accountGameClans.title,
      rank: accountGameClans.rank,
      joinedOn: accountGameClans.joinedOn,
    })
    .from(accountGameClans)
    .innerJoin(accounts, eq(accounts.id, accountGameClans.accountId))
    .where(
      and(
        eq(accountGameClans.gameClanId, clan.id),
        eq(accountGameClans.hidden, false),
        eq(accounts.shared, true),
        gte(accountGameClans.observedAt, freshSince()),
      ),
    )
    .orderBy(sql`${accountGameClans.rank} desc nulls last`, accounts.rsn)
    .limit(500);
  if (members.length === 0) return null;
  return { kind: 'ghost', name: clan.name, firstSeenAt: clan.firstSeenAt, members };
}

export type GhostClanLead = { key: string; name: string; members: number; lastSeenAt: string };

/**
 * Staff's lead list: in-game clans with Anvil players in them that are not on Anvil yet, biggest
 * first. Counts every fresh sighting, hidden or not — this is platform staff, not a public page.
 */
export async function ghostClanLeads(limit = 100): Promise<GhostClanLead[]> {
  const rows = await db
    .select({
      key: gameClans.nameKey,
      name: gameClans.name,
      lastSeenAt: gameClans.lastSeenAt,
      members: sql<number>`count(*)::int`,
    })
    .from(accountGameClans)
    .innerJoin(gameClans, eq(gameClans.id, accountGameClans.gameClanId))
    .where(gte(accountGameClans.observedAt, freshSince()))
    .groupBy(gameClans.id)
    .orderBy(desc(sql`count(*)`), desc(gameClans.lastSeenAt))
    .limit(limit * 2);
  const onAnvil = await anvilClansByKey(rows.map((r) => r.key));
  return rows.filter((r) => !onAnvil.has(r.key)).slice(0, limit);
}
