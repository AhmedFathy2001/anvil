// Deleting an account, by the person it belongs to.
//
// ONE FUNCTION, ONE TRANSACTION. Everything Anvil holds about a person is listed in lib/personData
// (PERSON_DATA); this walks that list, so a table cannot be handled here and forgotten there. The
// export (lib/exportPerson) walks the same list.
//
// WHAT IT DOES, in the order it does it:
//   1. Locks the login row. No row = already deleted = success (running it twice is safe).
//   2. Refuses while they own a clan or space, or a paid plan still renews (lib/personData eraseBlockers).
//   3. Keeps a ban working: a ban still in force moves to an empty stand-in that holds only the Discord id.
//   4. Runs every `sql` row of the list, then the named steps the list marks `custom`.
//   5. Characters: one on a clan's roster or in a clan's event stays as an unclaimed name, exactly
//      as lib/accountRelease leaves a released character, with everything personal cleared. One on
//      no clan record is deleted.
//   6. Deletes the login and the person. The schema's ON DELETE does the rest (the `fk` rows).
//   7. Writes one audit entry with counts and nothing that identifies anybody.
// After the commit, the stored images are deleted. A failure there is logged, never fatal: the
// database no longer points at them, and the retention sweep is the backstop.
//
// It never calls the payment provider, Discord, or any streaming service.

import { and, eq, inArray, isNull, ne, or, sql, type SQL } from 'drizzle-orm';

import { db } from '@/db';
import {
  accountMedia,
  accounts,
  billingLedger,
  clanAuditLog,
  clanBans,
  clanMemberships,
  clanStaff,
  clans,
  eventDiscordMembers,
  eventParticipants,
  eventSignups,
  h2hPrefs,
  players,
  profileMedia,
  proofUploads,
  streamHighlights,
  supporterSubscriptions,
  unmatchedPurchases,
  users,
} from '@/db/schema';
import { log } from '@/lib/logger';
import {
  PERSON_DATA,
  eraseBlockers,
  retainedBan,
  type EraseBlocker,
  type EraseFacts,
  type PersonKey,
} from '@/lib/personData';
import { del } from '@/lib/storage';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Reader = Pick<typeof db, 'select'>;

/** Every id a row about this person can be found by. */
export type PersonIds = Record<PersonKey, number[]>;

export interface EraseSummary {
  charactersKept: number;
  charactersDeleted: number;
  seatsKept: number;
  eventEntriesKept: number;
  banRecordKept: boolean;
  storedImages: number;
}

export type EraseResult =
  | { ok: true; alreadyGone: true }
  | { ok: true; alreadyGone: false; summary: EraseSummary }
  | { ok: false; blockers: EraseBlocker[] };

/** The friends host's name once nobody owns it (lib/friendEventRules friendsHostName with no name). */
const OWNERLESS_FRIENDS_HOST_NAME = 'Friends events';

const ident = (name: string) => sql.identifier(name);
const idList = (ids: number[]) => sql.join(ids.map((id) => sql`${id}`), sql`, `);

/** What decides whether this login may delete itself right now. Read-only. */
export async function eraseFactsFor(userId: number, reader: Reader = db): Promise<EraseFacts | null> {
  const [user] = await reader
    .select({ id: users.id, playerId: users.playerId, platformRole: users.platformRole })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return null;
  const [owned, supporterRows, others] = await Promise.all([
    // clan-scope: global -- the subject is one PERSON's owner seats, in every clan and space. The
    // hidden friends host is not a clan anybody else belongs to and goes ownerless instead.
    reader
      .select({ id: clans.id, slug: clans.slug, name: clans.name, kind: clans.kind })
      .from(clanStaff)
      .innerJoin(clans, eq(clans.id, clanStaff.clanId))
      .where(and(eq(clanStaff.userId, userId), eq(clanStaff.role, 'owner'), ne(clans.kind, 'friends'))),
    reader
      .select({ status: supporterSubscriptions.status, gumroadSubscriptionId: supporterSubscriptions.gumroadSubscriptionId })
      .from(supporterSubscriptions)
      .where(eq(supporterSubscriptions.userId, userId)),
    user.playerId == null
      ? Promise.resolve([])
      : reader.select({ id: users.id }).from(users).where(and(eq(users.playerId, user.playerId), ne(users.id, userId))),
  ]);
  return { ownedClans: owned, supporterRows, platformRole: user.platformRole, otherLogins: others.length };
}

/** The ids every row about this person hangs off: the login, the person, their characters, seats and event entries. */
export async function personIdsFor(userId: number, playerId: number | null, reader: Reader = db): Promise<PersonIds> {
  const accountIds =
    playerId == null ? [] : (await reader.select({ id: accounts.id }).from(accounts).where(eq(accounts.playerId, playerId))).map((r) => r.id);
  // clan-scope: global -- one person's characters hold seats in several clans; all of them are meant.
  const seatIds = accountIds.length
    ? (await reader.select({ id: clanMemberships.id }).from(clanMemberships).where(inArray(clanMemberships.accountId, accountIds))).map((r) => r.id)
    : [];
  const entryWhere: SQL[] = [];
  if (accountIds.length) entryWhere.push(inArray(eventParticipants.accountId, accountIds));
  if (seatIds.length) entryWhere.push(inArray(eventParticipants.clanMemberId, seatIds));
  // clan-scope: global -- the same person's event entries, whichever clan ran the event.
  const participantIds = entryWhere.length
    ? (await reader.select({ id: eventParticipants.id }).from(eventParticipants).where(or(...entryWhere))).map((r) => r.id)
    : [];
  return { user: [userId], player: playerId == null ? [] : [playerId], account: accountIds, seat: seatIds, participant: participantIds };
}

/**
 * Delete this login and the person behind it. Only ever called for the signed-in person themselves
 * (POST /api/profile/delete-account); there is no staff path.
 */
export async function erasePerson(input: { userId: number }): Promise<EraseResult> {
  const storedImages: string[] = [];
  const result = await db.transaction((tx) => erasePersonWith(tx, input.userId, storedImages));

  if (result.ok && !result.alreadyGone && storedImages.length > 0) {
    // After the commit, and not fatal: the rows that pointed at these are gone either way.
    try {
      await del([...new Set(storedImages)]);
    } catch (err) {
      log.warn('account.erase.storage-fail', { images: storedImages.length }, err);
    }
  }
  return result;
}

async function erasePersonWith(tx: Tx, userId: number, storedImages: string[]): Promise<EraseResult> {
  // The lock is what makes two clicks one deletion: the second waits here, then finds no row.
  const [user] = await tx.select().from(users).where(eq(users.id, userId)).for('update');
  if (!user) return { ok: true, alreadyGone: true };

  const facts = await eraseFactsFor(userId, tx);
  const blockers = facts ? eraseBlockers(facts) : [];
  if (blockers.length > 0) return { ok: false, blockers };

  const playerId = user.playerId;
  const person = playerId == null ? null : ((await tx.select().from(players).where(eq(players.id, playerId)))[0] ?? null);
  const ids = await personIdsFor(userId, playerId, tx);
  const discordId = user.discordId?.trim() || null;
  const email = user.email?.trim() || null;

  // ── Stored images to delete once this commits ─────────────────────────────────────────────────
  const media = [
    ...(await tx.select().from(profileMedia).where(eq(profileMedia.userId, userId))),
    ...(ids.account.length || playerId != null
      ? await tx
          .select()
          .from(accountMedia)
          .where(or(ids.account.length ? inArray(accountMedia.accountId, ids.account) : undefined, playerId != null ? eq(accountMedia.ownerPlayerId, playerId) : undefined))
      : []),
  ];
  for (const m of media) storedImages.push(...[m.avatarUrl, m.avatarStillUrl, m.bannerUrl, m.bannerStillUrl].filter((u): u is string => !!u));
  // The fee proof on a clan calendar sign-up of theirs: the row cannot stay (see the list), so its
  // image goes too, unless another person's sign-up shows the same picture.
  // clan-scope: global -- their own sign-ups, in whichever clan.
  const feeProofs = (
    await tx.execute(sql`
      select s.proof_url as url from clan_event_signups s
      where s.user_id = ${userId} and s.proof_url is not null
        and not exists (select 1 from clan_event_signups o where o.proof_url = s.proof_url and o.user_id <> ${userId})
    `)
  ).rows as { url: string }[];
  storedImages.push(...feeProofs.map((r) => r.url));

  // ── A ban survives ────────────────────────────────────────────────────────────────────────────
  // clan-scope: global -- every clan that has barred this person; each ban must go on working.
  const liveBans = playerId == null ? [] : await tx.select({ id: clanBans.id }).from(clanBans).where(and(eq(clanBans.playerId, playerId), isNull(clanBans.liftedAt)));
  const keep = retainedBan({
    discordId,
    userBanned: user.banned,
    userBannedAt: user.bannedAt,
    playerBanned: person?.banned ?? false,
    playerBannedAt: person?.bannedAt ?? null,
    liveClanBanIds: liveBans.map((b) => b.id),
  });
  let standInPlayerId: number | null = null;
  if (keep) {
    const [standIn] = await tx.insert(players).values(keep.player).returning({ id: players.id });
    standInPlayerId = standIn.id;
    if (keep.clanBanIds.length > 0) {
      // Moved off the person before the person is deleted (the column cascades). The reason and the
      // character that prompted it are about the person, not needed to enforce it, and are cleared.
      await tx.update(clanBans).set({ playerId: standIn.id, accountId: null, reason: null }).where(inArray(clanBans.id, keep.clanBanIds));
    }
  }

  // ── Their private friends host: nobody's now, and no longer named after them ──────────────────
  // clan-scope: this clan -- the person's own hidden host, by its owner column.
  await tx
    .update(clans)
    .set({ friendsOwnerUserId: null, name: OWNERLESS_FRIENDS_HOST_NAME })
    .where(and(eq(clans.friendsOwnerUserId, userId), eq(clans.kind, 'friends')));

  // ── Named steps that must run before the generic ones or the final delete ─────────────────────
  // Proof uploads. One a clan's event uses stays, without the uploader. One nothing uses is deleted.
  const unused = (
    await tx.execute(sql`
      select u.url from proof_uploads u
      where u.user_id = ${userId}
        and u.event_id is null
        and u.url like '%/submissions/%'
        and not exists (select 1 from submissions s where s.image_url = u.url or s.clean_image_url = u.url)
        and not exists (select 1 from submission_attachments a where a.url = u.url)
        and not exists (select 1 from event_start_proofs p where p.image_url = u.url)
        and not exists (select 1 from signup_fees f where f.proof_blob_url = u.url)
        and not exists (select 1 from payouts p where p.proof_blob_url = u.url)
        and not exists (select 1 from coffer_entries c where c.proof_blob_url = u.url)
        and not exists (select 1 from clan_event_payouts p where p.proof_url = u.url)
        and not exists (select 1 from clan_event_signups g where g.proof_url = u.url and g.user_id <> ${userId})
    `)
  ).rows as { url: string }[];
  if (unused.length > 0) {
    const urls = unused.map((r) => r.url);
    await tx.delete(proofUploads).where(inArray(proofUploads.url, urls));
    storedImages.push(...urls);
  }
  await tx.update(proofUploads).set({ userId: null }).where(eq(proofUploads.userId, userId));

  // Event sign-ups: the schema would delete them with the login. They are the clan's record of who
  // entered (team, status, fees), so they are detached first and the answers they typed are emptied.
  // clan-scope: global -- their own sign-ups, in whichever clan.
  await tx.update(eventSignups).set({ userId: null, profileData: '{}' }).where(eq(eventSignups.userId, userId));

  // Event entries stay under the in-game name; what the person typed about themselves does not.
  if (ids.participant.length > 0) {
    // clan-scope: global -- their own event entries, in whichever clan.
    await tx.update(eventParticipants).set({ discord: null, timezone: null, playerToken: null }).where(inArray(eventParticipants.id, ids.participant));
  }

  // Their Discord id, wherever it was copied to.
  // clan-scope: global -- one person's rows across every event.
  await tx
    .delete(eventDiscordMembers)
    .where(or(eq(eventDiscordMembers.userId, userId), discordId ? eq(eventDiscordMembers.discordId, discordId) : undefined));
  if (discordId) {
    await tx.update(accounts).set({ discordId: null }).where(eq(accounts.discordId, discordId));
    // A log row that spells out their Discord id (a claim, a sign-up) cannot be made anonymous by
    // clearing who did it, so it goes. Discord ids are 17+ digit numbers: a text match is exact enough.
    // clan-scope: global -- the platform log and every clan's, for this one person's id.
    const needle = `%${discordId}%`;
    await tx
      .delete(clanAuditLog)
      .where(or(sql`${clanAuditLog.oldValue} like ${needle}`, sql`${clanAuditLog.newValue} like ${needle}`, sql`${clanAuditLog.notes} like ${needle}`));
  }

  if (playerId != null) {
    // A merge entry records the display name of each side (lib/mergePeople), keyed by person id.
    // clan-scope: global -- the platform log's own rows about this person.
    const mergedAs = `{"playerId":${playerId},%`;
    await tx
      .delete(clanAuditLog)
      .where(and(eq(clanAuditLog.eventType, 'platform_people_merged'), or(sql`${clanAuditLog.oldValue} like ${mergedAs}`, sql`${clanAuditLog.newValue} like ${mergedAs}`)));
  }

  // Clips from their own channel name their streaming account. A clip on the host's channel is the
  // host's; the schema clears the pointer to them when the login goes.
  // clan-scope: global -- their own clips, in whichever event.
  await tx.delete(streamHighlights).where(and(eq(streamHighlights.userId, userId), eq(streamHighlights.channelOwner, 'player')));

  // Payment lines stay for the books, without the email.
  const subscriptionIds = (
    await tx.select({ id: supporterSubscriptions.gumroadSubscriptionId }).from(supporterSubscriptions).where(eq(supporterSubscriptions.userId, userId))
  )
    .map((r) => r.id)
    .filter((id): id is string => !!id);
  const ledgerWhere = or(
    email ? sql`lower(${billingLedger.buyerEmail}) = ${email.toLowerCase()}` : undefined,
    subscriptionIds.length ? inArray(billingLedger.subscriptionId, subscriptionIds) : undefined,
  );
  if (ledgerWhere) await tx.update(billingLedger).set({ buyerEmail: null }).where(ledgerWhere);
  await tx
    .update(unmatchedPurchases)
    .set({ buyerEmail: null })
    .where(or(eq(unmatchedPurchases.attachedUserId, userId), email ? sql`lower(${unmatchedPurchases.buyerEmail}) = ${email.toLowerCase()}` : undefined));

  // Other people's challenge block lists drop this person (lib/mergePeople does the same on a merge).
  if (playerId != null) {
    // clan-scope: global -- people, not a clan's rows; the LIKE only narrows, the parse decides.
    const others = await tx.select({ playerId: h2hPrefs.playerId, blocked: h2hPrefs.blocked }).from(h2hPrefs).where(sql`${h2hPrefs.blocked} like ${`%${playerId}%`}`);
    for (const row of others) {
      const list = blockList(row.blocked);
      if (!list.includes(playerId)) continue;
      const next = list.filter((id) => id !== playerId);
      await tx.update(h2hPrefs).set({ blocked: next.length ? JSON.stringify(next) : null }).where(eq(h2hPrefs.playerId, row.playerId));
    }
  }

  // ── The list: every row marked `sql` ──────────────────────────────────────────────────────────
  for (const entry of PERSON_DATA) {
    if (entry.via !== 'sql') continue;
    const keyIds = ids[entry.key];
    if (keyIds.length === 0) continue;
    const where = sql`${ident(entry.column)} in (${idList(keyIds)})`;
    if (entry.handling === 'delete') {
      await tx.execute(sql`delete from ${ident(entry.table)} where ${where}`);
    } else if (entry.handling === 'detach') {
      const sets = [entry.column, ...(entry.scrub ?? [])].map((c) => sql`${ident(c)} = null`);
      await tx.execute(sql`update ${ident(entry.table)} set ${sql.join(sets, sql`, `)} where ${where}`);
    }
  }

  // ── Characters ────────────────────────────────────────────────────────────────────────────────
  let charactersKept = 0;
  let charactersDeleted = 0;
  if (ids.account.length > 0) {
    const mine = await tx.select().from(accounts).where(inArray(accounts.id, ids.account));
    // clan-scope: global -- is this character on ANY clan's roster or in any clan's event.
    const seated = new Set(
      (await tx.select({ accountId: clanMemberships.accountId }).from(clanMemberships).where(inArray(clanMemberships.accountId, ids.account))).map((r) => r.accountId),
    );
    const entered = new Set(
      (await tx.select({ accountId: eventParticipants.accountId }).from(eventParticipants).where(inArray(eventParticipants.accountId, ids.account))).map((r) => r.accountId),
    );
    for (const account of mine) {
      if (!seated.has(account.id) && !entered.has(account.id)) {
        // On no clan's record: the character is the person's alone, and goes (its rows cascade).
        await tx.delete(accounts).where(eq(accounts.id, account.id));
        charactersDeleted++;
        continue;
      }
      // The clan's record of an in-game name stays; the person leaves it. The same shape
      // lib/accountRelease leaves behind (a stand-in person named after the RSN, unclaimed, proof
      // gone), and further: the account hash, Discord id, name look and plugin-pushed stats are
      // theirs too. `shared` goes off so "delete me" does not leave a public profile page; the
      // clans that seat the name still see it (lib/accountVisibility).
      const [placeholder] = await tx.insert(players).values({ displayName: account.rsn }).returning({ id: players.id });
      await tx
        .update(accounts)
        .set({
          playerId: placeholder.id,
          isPrimary: 0,
          claimedAt: null,
          provisional: 0,
          verifiedAt: null,
          verificationMethod: null,
          verifiedByUserId: null,
          accountHash: null,
          discordId: null,
          supporterStyle: null,
          shared: false,
          liveStats: null,
          liveStatsAt: null,
          liveStatKeyTimes: null,
        })
        .where(eq(accounts.id, account.id));
      charactersKept++;
    }
  }

  // ── The login and the person. The schema's ON DELETE carries out every `fk` row of the list. ──
  await tx.delete(users).where(eq(users.id, userId));
  if (playerId != null) {
    // THE ONE DELETE THAT COULD TAKE A CLAN'S RECORDS WITH IT. `accounts.player_id` cascades, and a
    // seat cascades from its account, so a character still on this person here would lose its roster
    // seat and event history. Every character was moved or deleted above; if one turned up since (a
    // claim landing mid-deletion), stop and undo everything rather than guess.
    const stillHeld = await tx.select({ id: accounts.id }).from(accounts).where(eq(accounts.playerId, playerId)).limit(1);
    if (stillHeld.length > 0) throw new Error('erasePerson: a character was attached to the person during deletion; rolled back');
    await tx.delete(players).where(eq(players.id, playerId));
  }

  // The stand-in login, after the real one is gone (the Discord id is unique). It carries the id and
  // the ban flags and nothing else; signing in with that Discord account lands on it, still banned.
  if (keep && standInPlayerId != null) {
    await tx.insert(users).values({ ...keep.user, playerId: standInPlayerId });
  }

  const summary: EraseSummary = {
    charactersKept,
    charactersDeleted,
    seatsKept: ids.seat.length,
    eventEntriesKept: ids.participant.length,
    banRecordKept: keep != null,
    storedImages: storedImages.length,
  };

  // One entry in the platform log (no clan). Counts only: no id, name, or anything else that could
  // say who this was. There is no actor to record either; the login that did it no longer exists.
  await tx.insert(clanAuditLog).values({
    clanId: null,
    eventType: 'platform_account_deleted',
    actorUserId: null,
    oldValue: null,
    newValue: JSON.stringify(summary),
    notes: 'Deleted by the account holder',
  });

  return { ok: true, alreadyGone: false, summary };
}

/** `blocked` is a JSON array of player ids; anything else reads as none. */
function blockList(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((n): n is number => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
}
