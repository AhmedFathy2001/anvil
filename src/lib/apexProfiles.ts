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
// WHAT THE APEX MAY SHOW. Every character is public on the apex, unless its owner is banned from
// the platform. Tying characters together into one PERSON is still opt-in
// (players.linkAccountsPublicly), and so is everything that names the human behind them.

import { notPractice } from '@/lib/practiceScope';
import { clanBeforeSpace, slugWhere } from '@/lib/clanSlugLookup';
import type { AddressKind } from '@/lib/clanScopedPaths';
import { and, count, desc, eq, gt, gte, inArray, isNull, ne, or, sql } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships, clans, eventParticipants, events, memberDailyStats, players, settings, users } from '@/db/schema';
import { apexDomain } from '@/lib/clanContext';
import { getPublicShowcase } from '@/lib/pluginConfig';
import { clanVisibilityOf } from '@/lib/clanVisibility';
import { listedClanWhere, showcaseJoinOn } from '@/lib/clanListing';
import { isErasedStandIn } from '@/lib/erasedCharacters';

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
export async function apexClan(slug: string, kind: AddressKind | null = null): Promise<ApexClan | null> {
  // clan-scope: global -- resolving a clan BY slug is what this page is; there is no other clan to
  // scope it to. `kind` is the namespace the address named (/c/ vs /s/); without one the clan wins.
  const clan = await db.query.clans.findFirst({ where: slugWhere(slug.toLowerCase(), kind), orderBy: [clanBeforeSpace] });
  if (!clan || clan.status === 'suspended') return null;
  // NOT READABLE BY STRANGERS ⇒ NOT NAMED TO THEM. This asked only about the showcase opt-out, so a
  // clan set to `members` was still described here — name, member count, what it was running — on a
  // page whose whole audience is people with no seat in it. See lib/clanListing.
  if (clanVisibilityOf(clan.visibility) !== 'public') return null;
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
    db.select({ n: count() }).from(events).where(and(eq(events.clanId, clan.id), notPractice())),
    db
      .select({ id: events.id, name: events.name, endDate: events.endDate })
      .from(events)
      .where(
        and(
          eq(events.clanId, clan.id),
          notPractice(),
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
  clan: { slug: string; kind?: string | null; name: string; logoUrl: string | null; joinedOn: string | null } | null;
  /**
   * The person, ONLY if they have agreed to be shown as one — and named by another of their
   * RSNs, never by anything from Discord.
   *
   * This field used to carry players.displayName, which is the Discord display name in practice, so
   * a public page about an OSRS account read "played by <their Discord name>". Two disclosures at
   * once, neither asked for: who they are off-game, and that these characters are one person.
   */
  owner: { playerId: number; label: string } | null;
  /**
   * Whether the person reading this owns the character: the owner needs the one control nobody else
   * does — the link to hand somebody.
   */
  viewerOwns: boolean;
  /**
   * The person behind it (players.id), for reads that must find their login — never rendered. Their
   * own avatar, banner and display case hang off it (lib/profileMedia, lib/displayCase).
   */
  personId: number | null;
  /** They agreed to be shown as one person (players.linkAccountsPublicly), so person-level things
      like their own avatar and banner may appear here without tying characters together unasked. */
  personPublic: boolean;
  /** Their own uploaded avatar/banner may show here: on by default for anyone not banned. */
  personMedia: boolean;
}

/**
 * One character, by RSN.
 *
 * Null for an unknown RSN, one whose owner is banned from the platform, or one left behind by an
 * account deletion.
 */
export async function apexCharacter(rsn: string, viewerPlayerId?: number | null): Promise<ApexCharacter | null> {
  const normalized = rsn.trim().toLowerCase().replace(/[\s_]+/g, ' ');

  // clan-scope: global -- a character belongs to a person, not to a clan; that is the whole point of
  // the account being global.
  const acct = await db.query.accounts.findFirst({ where: eq(accounts.rsnNormalized, normalized) });
  if (!acct) return null;
  // Left behind by "Delete me": the person asked to be gone (lib/erasedCharacters).
  if (isErasedStandIn(acct)) return null;
  const ownedByViewer = viewerPlayerId != null && acct.playerId === viewerPlayerId;
  // A person banned from the platform has no public page (lib/bannedPeople). They cannot sign in, so
  // there is no owner's view to keep.
  // clan-scope: global -- a ban is the platform's.
  const owner0 = await db.query.players.findFirst({ where: eq(players.id, acct.playerId), columns: { banned: true } });
  if (owner0?.banned) return null;

  // Their clan, if they are a member of one AND that clan is listed. A member seat is unique per
  // account (one clan at a time), so this is at most one row.
  //
  // The "and that clan is listed" half was a comment rather than a filter: this asked only about
  // `status`, so a public page about a character named the private clan they play for — on the one
  // page whose entire audience is people with no seat in it. The shared predicate is the same one
  // the directory and the leaderboard use; see lib/clanListing.
  const seat = await db
    .select({ slug: clans.slug, kind: clans.kind, name: clans.name, logoUrl: clans.logoUrl, clanId: clans.id, joinedOn: clanMemberships.ingameJoinedOn })
    .from(clanMemberships)
    .innerJoin(clans, eq(clans.id, clanMemberships.clanId))
    .leftJoin(settings, showcaseJoinOn())
    .where(
      and(
        eq(clanMemberships.accountId, acct.id),
        eq(clanMemberships.kind, 'member'),
        isNull(clanMemberships.leftAt),
        listedClanWhere(),
      ),
    )
    .limit(1)
    .then((r) => r[0] ?? null);

  const owner = acct.playerId != null
    ? await db.query.players.findFirst({ where: eq(players.id, acct.playerId) })
    : null;

  // Named by ANOTHER of their RSNs, and only when linking is on — so the link is one they agreed
  // to. Falls away entirely otherwise: this character
  // stays public, and nothing here says whose it is.
  //
  // ANOTHER, not their primary. The primary is simply first in the list, and it is very often THIS
  // character — it is both the account most likely to be published and the one most likely to be
  // looked up — so the page said "Drenvox mdps · also plays Drenvox mdps". Excluding the account
  // being viewed is the fix; hiding the line when the names happened to match was papering over it,
  // and still picked a useless label whenever a person had three accounts and you were on the
  // primary.
  //
  // Null when there is no other. Somebody with one character has no "also", and the person
  // page behind the link would list only the character you are already reading.
  let ownerOut: { playerId: number; label: string } | null = null;
  if (owner && !owner.banned && owner.linkAccountsPublicly) {
    const other = await db
      .select({ rsn: accounts.rsn })
      .from(accounts)
      .where(
        and(eq(accounts.playerId, owner.id), ne(accounts.id, acct.id)),
      )
      .orderBy(desc(accounts.isPrimary), accounts.rsn)
      .limit(1)
      .then((r) => r[0] ?? null);
    if (other) ownerOut = { playerId: owner.id, label: other.rsn };
  }

  return {
    accountId: acct.id,
    rsn: acct.rsn,
    status: acct.status,
    verified: acct.verifiedAt != null,
    overallXp: acct.statsOverallXp,
    lastSeenAt: acct.liveStatsAt,
    clan: seat && (await getPublicShowcase(seat.clanId)) ? { slug: seat.slug, kind: seat.kind, name: seat.name, logoUrl: seat.logoUrl ?? null, joinedOn: seat.joinedOn ?? null } : null,
    owner: ownerOut,
    viewerOwns: ownedByViewer,
    personId: acct.playerId ?? null,
    personPublic: !!owner && !owner.banned && !!owner.linkAccountsPublicly,
    personMedia: ownedByViewer || (!!owner && !owner.banned),
  };
}

export interface ApexPerson {
  playerId: number;
  /**
   * What to call them in public: their primary RSN.
   *
   * NOT players.displayName, which is the Discord display name in all but name — every path that
   * creates a person from a login seeds it from there, and on the real data it matches
   * users.display_name for every row that has one. A page about an OSRS account has no business
   * publishing what someone called themselves on Discord. An RSN is already public: it is on the
   * hiscores and above the player's head.
   */
  label: string;
  /**
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
 * Null when they have no characters — and also when they have not agreed to be shown as one
 * person at all. A page listing someone's name and then no characters would confirm they exist and
 * are keeping quiet, which is not a thing the apex should say about someone.
 *
 * Keyed by id rather than a handle because a person has no unique name: display names collide, and
 * an RSN names a CHARACTER — which is what /p/ is for.
 */
export async function apexPerson(playerId: number): Promise<ApexPerson | null> {
  const person = await db.query.players.findFirst({ where: eq(players.id, playerId) });
  if (!person || person.banned) return null;

  // The linkage switch: it says two characters are the same human. Off means there is no person page — the characters remain
  // individually visible and nothing on the apex ties them together.
  if (!person.linkAccountsPublicly) return null;

  // clan-scope: global -- a person's characters are global by definition.
  const owned = await db
    .select({ id: accounts.id, rsn: accounts.rsn, overallXp: accounts.statsOverallXp })
    .from(accounts)
    .where(eq(accounts.playerId, playerId))
    .orderBy(desc(accounts.isPrimary), accounts.rsn);

  if (owned.length === 0) return null;

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
          owned.map((a) => a.id),
        ),
        gte(memberDailyStats.day, weekAgo),
      ),
    )
    .groupBy(memberDailyStats.accountId);
  const weekBy = new Map(weekRows.map((r) => [r.accountId, Number(r.n ?? 0)]));

  const characters = await Promise.all(
    owned.map(async (a) => {
      const seat = await db
        .select({ name: clans.name, clanId: clans.id })
        .from(clanMemberships)
        .innerJoin(clans, eq(clans.id, clanMemberships.clanId))
        .leftJoin(settings, showcaseJoinOn())
        .where(
          and(
            eq(clanMemberships.accountId, a.id),
            eq(clanMemberships.kind, 'member'),
            isNull(clanMemberships.leftAt),
            // The same predicate the character page above uses (lib/clanListing): active, not hidden
            // by the platform, PUBLIC, and listed. This asked about status and the showcase switch
            // only, so a members-only clan was named on a person's public page.
            listedClanWhere(),
          ),
        )
        .limit(1)
        .then((r) => r[0] ?? null);
      return {
        rsn: a.rsn,
        clan: seat ? seat.name : null,
        overallXp: a.overallXp,
        xpThisWeek: weekBy.get(a.id) ?? 0,
      };
    }),
  );

  // Ordered primary-first above, so the first RSN is the one they'd want to be known by.
  return { playerId: person.id, label: owned[0].rsn, characters };
}

/** The person behind a login, for linking a signed-in visitor to their own page. */
export async function personIdForUser(userId: number): Promise<number | null> {
  const row = await db.query.users.findFirst({ where: eq(users.id, userId) });
  return row?.playerId ?? null;
}
