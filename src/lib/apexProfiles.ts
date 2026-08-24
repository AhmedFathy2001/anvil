// The three things the apex can show you without belonging to any clan.
//
//   /c/<slug>   a clan
//   /u/<id>     a person — the human, who owns accounts
//   /p/<rsn>    a character — one OSRS account
//
// The split between the last two is the identity model showing through, and it is worth keeping in
// the URLs: "Ahmed" is a user, "Drenvox mdps" is a character they play, and conflating them is what
// the old one-clan-per-database model did.
//
// WHAT THE APEX MAY SHOW. lib/accountVisibility says a clan sees an account if it holds a seat for
// it or the account is shared. The apex holds no seats — it is nobody's clan — so only the second
// half applies: **on the apex, an account is visible iff it is shared.** That falls out of the rule
// rather than being a second policy, which is the point of having the rule.
//
// Everything here is therefore opt-in, and mostly empty until people opt in. That is the correct
// resting state for cross-clan visibility, not a defect.

import { and, count, desc, eq, gt, gte, inArray, isNull, or, sql } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships, clans, events, memberDailyStats, players, users, eventParticipants } from '@/db/schema';
import { apexDomain } from '@/lib/clanContext';
import { getPublicShowcase } from '@/lib/pluginConfig';

// ── Clans ─────────────────────────────────────────────────────────────────────────────────────

export interface ApexClan {
  id: number;
  slug: string;
  name: string;
  inGameName: string | null;
  host: string;
  members: number;
  guests: number;
  eventsRun: number;
  liveEvents: { id: number; name: string; endDate: string | null }[];
  createdAt: string;
}

/**
 * A clan, as a stranger sees it.
 *
 * Null for a clan that does not serve, or one that opted out of being listed. `public_showcase` is
 * the existing opt-out and is reused deliberately — inventing a second flag for "may the apex show
 * this" would leave two switches that must agree, and they would eventually not.
 */
export async function apexClan(slug: string): Promise<ApexClan | null> {
  // clan-scope: global -- resolving a clan BY slug is what this page is; there is no other clan to
  // scope it to.
  const clan = await db.query.clans.findFirst({ where: eq(clans.slug, slug.toLowerCase()) });
  if (!clan || clan.status === 'suspended') return null;
  if (!(await getPublicShowcase(clan.id))) return null;

  const nowIso = new Date().toISOString();
  const [[members], [guests], [ran], live] = await Promise.all([
    db
      .select({ n: count() })
      .from(clanMemberships)
      .where(
        and(eq(clanMemberships.clanId, clan.id), isNull(clanMemberships.leftAt), eq(clanMemberships.kind, 'member')),
      ),
    db
      .select({ n: count() })
      .from(clanMemberships)
      .where(
        and(eq(clanMemberships.clanId, clan.id), isNull(clanMemberships.leftAt), eq(clanMemberships.kind, 'guest')),
      ),
    db.select({ n: count() }).from(events).where(eq(events.clanId, clan.id)),
    db
      .select({ id: events.id, name: events.name, endDate: events.endDate })
      .from(events)
      .where(
        and(
          eq(events.clanId, clan.id),
          isNull(events.forceEndedAt),
          // Started, and not finished. A board with no start date is still being built and is not
          // the clan's business to advertise.
          sql`${events.startDate} is not null and ${events.startDate} <= ${nowIso}`,
          or(isNull(events.endDate), gt(events.endDate, nowIso)),
        ),
      )
      .orderBy(desc(events.startDate))
      .limit(5),
  ]);

  return {
    id: clan.id,
    slug: clan.slug,
    name: clan.name,
    inGameName: clan.inGameName,
    host: clan.customDomain || `${clan.slug}.${apexDomain()}`,
    members: members?.n ?? 0,
    guests: guests?.n ?? 0,
    eventsRun: ran?.n ?? 0,
    liveEvents: live,
    createdAt: clan.createdAt,
  };
}

// ── People and characters ─────────────────────────────────────────────────────────────────────

export interface ApexCharacter {
  /** The ACCOUNT this page is about — the key every stats table uses. */
  accountId: number;
  rsn: string;
  status: string;
  verified: boolean;
  overallXp: number | null;
  lastSeenAt: string | null;
  /** The clan this character is a MEMBER of — at most one, and only if that clan is listed. */
  clan: { slug: string; name: string } | null;
  /**
   * The person, ONLY if they have agreed to be shown as one — and named by another of their shared
   * RSNs, never by anything from Discord.
   *
   * This field used to carry players.displayName, which is the Discord display name in practice, so
   * a public page about an OSRS account read "played by <their Discord name>". Two disclosures at
   * once, neither asked for: who they are off-game, and that these characters are one person.
   */
  owner: { playerId: number; label: string } | null;
}

/**
 * One character, by RSN.
 *
 * Null unless the account is shared. A character nobody published is not a public page, and saying
 * "this exists but you may not see it" would leak the thing being withheld.
 */
export async function apexCharacter(rsn: string): Promise<ApexCharacter | null> {
  const normalized = rsn.trim().toLowerCase().replace(/[\s_]+/g, ' ');

  // clan-scope: global -- a character belongs to a person, not to a clan; that is the whole point of
  // the account being global.
  const acct = await db.query.accounts.findFirst({ where: eq(accounts.rsnNormalized, normalized) });
  if (!acct || !acct.shared) return null;

  // Their clan, if they are a member of one and that clan is listed. A member seat is unique per
  // account (one clan at a time), so this is at most one row.
  const seat = await db
    .select({ slug: clans.slug, name: clans.name, clanId: clans.id })
    .from(clanMemberships)
    .innerJoin(clans, eq(clans.id, clanMemberships.clanId))
    .where(
      and(
        eq(clanMemberships.accountId, acct.id),
        eq(clanMemberships.kind, 'member'),
        isNull(clanMemberships.leftAt),
        eq(clans.status, 'active'),
      ),
    )
    .limit(1)
    .then((r) => r[0] ?? null);

  const owner = acct.playerId != null
    ? await db.query.players.findFirst({ where: eq(players.id, acct.playerId) })
    : null;

  // Named by their primary shared RSN, and only when linking is on — so the label is a name they
  // published and the link is one they agreed to. Falls away entirely otherwise: this character
  // stays public, and nothing here says whose it is.
  let ownerOut: { playerId: number; label: string } | null = null;
  if (owner && !owner.banned && owner.linkAccountsPublicly) {
    const primary = await db
      .select({ rsn: accounts.rsn })
      .from(accounts)
      .where(and(eq(accounts.playerId, owner.id), eq(accounts.shared, true)))
      .orderBy(desc(accounts.isPrimary), accounts.rsn)
      .limit(1)
      .then((r) => r[0] ?? null);
    if (primary) ownerOut = { playerId: owner.id, label: primary.rsn };
  }

  return {
    accountId: acct.id,
    rsn: acct.rsn,
    status: acct.status,
    verified: acct.verifiedAt != null,
    overallXp: acct.statsOverallXp,
    lastSeenAt: acct.liveStatsAt,
    clan: seat && (await getPublicShowcase(seat.clanId)) ? { slug: seat.slug, name: seat.name } : null,
    owner: ownerOut,
  };
}

export interface ApexPerson {
  playerId: number;
  /**
   * What to call them in public: their primary shared RSN.
   *
   * NOT players.displayName, which is the Discord display name in all but name — every path that
   * creates a person from a login seeds it from there, and on the real data it matches
   * users.display_name for every row that has one. A page about an OSRS account has no business
   * publishing what someone called themselves on Discord. An RSN they chose to share is a name they
   * published on purpose.
   */
  label: string;
  /**
   * Only the shared ones. The rest are not this page's to mention.
   *
   * Carries enough to be worth reading. The page was a column of names and a clan beside each, which
   * said nothing a search result would not; these are the account's own numbers — the same ones
   * /p/<rsn> opens with — so the person page is a way IN to the characters rather than an index of
   * them.
   */
  characters: {
    rsn: string;
    clan: string | null;
    overallXp: number | null;
    xpThisWeek: number;
  }[];
}

/**
 * One person, by id.
 *
 * Null when they have published nothing — and also when they have not agreed to be shown as one
 * person at all. A page listing someone's name and then no characters would confirm they exist and
 * are keeping quiet, which is not a thing the apex should say about someone.
 *
 * Keyed by id rather than a handle because a person has no unique name: display names collide, and
 * an RSN names a CHARACTER — which is what /p/ is for.
 */
export async function apexPerson(playerId: number): Promise<ApexPerson | null> {
  const person = await db.query.players.findFirst({ where: eq(players.id, playerId) });
  if (!person || person.banned) return null;

  // The linkage switch, which is not the sharing switch. Sharing publishes a character; this says
  // two characters are the same human. Off means there is no person page — the characters remain
  // individually visible and nothing on the apex ties them together.
  if (!person.linkAccountsPublicly) return null;

  // clan-scope: global -- a person's published characters are global by definition.
  const shared = await db
    .select({ id: accounts.id, rsn: accounts.rsn, overallXp: accounts.statsOverallXp })
    .from(accounts)
    .where(and(eq(accounts.playerId, playerId), eq(accounts.shared, true)))
    .orderBy(desc(accounts.isPrimary), accounts.rsn);

  if (shared.length === 0) return null;

  // ONE grouped query for the week, not one per character. Somebody with eight published accounts
  // should not cost eight round trips to draw a column.
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const weekRows = await db
    .select({ accountId: memberDailyStats.accountId, n: sql<number>`sum(${memberDailyStats.xpGained})` })
    .from(memberDailyStats)
    .where(
      and(
        inArray(
          memberDailyStats.accountId,
          shared.map((a) => a.id),
        ),
        gte(memberDailyStats.day, weekAgo),
      ),
    )
    .groupBy(memberDailyStats.accountId);
  const weekBy = new Map(weekRows.map((r) => [r.accountId, Number(r.n ?? 0)]));

  const characters = await Promise.all(
    shared.map(async (a) => {
      const seat = await db
        .select({ name: clans.name, clanId: clans.id })
        .from(clanMemberships)
        .innerJoin(clans, eq(clans.id, clanMemberships.clanId))
        .where(
          and(
            eq(clanMemberships.accountId, a.id),
            eq(clanMemberships.kind, 'member'),
            isNull(clanMemberships.leftAt),
            eq(clans.status, 'active'),
          ),
        )
        .limit(1)
        .then((r) => r[0] ?? null);
      const visible = seat && (await getPublicShowcase(seat.clanId));
      return {
        rsn: a.rsn,
        clan: visible ? seat!.name : null,
        overallXp: a.overallXp,
        xpThisWeek: weekBy.get(a.id) ?? 0,
      };
    }),
  );

  // Ordered primary-first above, so the first shared RSN is the one they'd want to be known by.
  return { playerId: person.id, label: shared[0].rsn, characters };
}

/** The person behind a login, for linking a signed-in visitor to their own page. */
export async function personIdForUser(userId: number): Promise<number | null> {
  const row = await db.query.users.findFirst({ where: eq(users.id, userId) });
  return row?.playerId ?? null;
}
