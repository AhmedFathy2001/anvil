// Renaming a CHARACTER — one OSRS account whose in-game name changed — wherever the rename is noticed.
//
// THE SPLIT THIS EXISTS TO UNDO. Rosters arrive as names. After a rename, the next clan sync sees
// "Bob left, Bobby joined" and seats Bobby as a brand-new account: no event entry, no baseline, no
// owner — while the real character keeps the dead name, so its stat tiles poll a 404 for the rest of
// the event. Every path that later learns the truth (the player's plugin proving it by account hash,
// the sync matching the pair by XP, Anvil staff approving a rename request) used to give up the
// moment the new name was already taken, which after a sync it always is.
//
// So a rename ABSORBS the duplicate holding the new name, when that duplicate is plainly the same
// character seen twice: unclaimed (or claimed by the same person), and not anchored to a different
// account hash. Its seats fold into ours (lib/mergeSeats carries event entries, sign-ups, weekly rows
// and the roster rank across), anything left moves onto our account, and our account takes the name.
// The roster seat ends up on the real character, so the next sync matches it by the new name and
// tracking carries on against the original baseline. A duplicate that is somebody ELSE's character
// is refused — that is a dispute, not a rename.

import { and, eq, inArray, isNotNull, isNull, ne } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanAuditLog, clanMemberships, eventParticipants } from '@/db/schema';
import { normalizeRsn, sanitizeRsn } from '@/lib/auth';
import { mergeSeats } from '@/lib/mergeSeats';
import { memberSeatElsewhere } from '@/lib/guestAdmission';

export type RenameVia = 'plugin' | 'roster' | 'staff';

export type RenameOutcome =
  | { ok: true; changed: boolean; absorbed: number }
  | { ok: false; reason: 'invalid' | 'not_found' | 'owned_by_other' | 'different_account'; error: string };

function parsePrevious(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Rename `accountId` to `newRsnRaw`, absorbing a duplicate that already holds the new name when it is
 * the same character seen twice. Idempotent: renaming to the current name is a no-op.
 */
export async function renameCharacter(
  accountId: number,
  newRsnRaw: string,
  opts: { actorUserId: number | null; via: RenameVia; note?: string | null },
): Promise<RenameOutcome> {
  const newRsn = sanitizeRsn(newRsnRaw);
  const newNorm = normalizeRsn(newRsn);
  if (!newRsn || !newNorm) return { ok: false, reason: 'invalid', error: 'That is not a valid RuneScape name.' };

  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, accountId) });
  if (!account) return { ok: false, reason: 'not_found', error: 'No such character.' };
  const oldRsn = account.rsn;

  // ── The duplicate holding the new name, if any ───────────────────────────────────────────────
  let absorbed = 0;
  const holder = await db.query.accounts.findFirst({
    where: and(eq(accounts.rsnNormalized, newNorm), ne(accounts.id, accountId)),
  });
  if (holder) {
    // Somebody else's character: not a duplicate, a dispute. Same person (their plugin minted a copy
    // before the rename was known) is fine to fold.
    if (holder.claimedAt && (!account.claimedAt || holder.playerId !== account.playerId)) {
      return { ok: false, reason: 'owned_by_other', error: `${holder.rsn} belongs to another player on Anvil.` };
    }
    // Two different account hashes are two different Jagex accounts, whatever their names say.
    if (holder.accountHash && account.accountHash && holder.accountHash !== account.accountHash) {
      return { ok: false, reason: 'different_account', error: `${holder.rsn} is a different account (its hash differs).` };
    }

    // Fold each of the holder's seats into ours. Same clan → mergeSeats (moves event entries,
    // sign-ups, weekly rows, audit, and takes the roster's rank/presence if the holder is the side
    // the in-game roster lists). Another clan → the seat simply moves onto our account.
    const holderSeats = await db
      .select({
        id: clanMemberships.id,
        clanId: clanMemberships.clanId,
        kind: clanMemberships.kind,
        rank: clanMemberships.rank,
        source: clanMemberships.source,
        leftAt: clanMemberships.leftAt,
        lastSeenInClan: clanMemberships.lastSeenInClan,
      })
      .from(clanMemberships)
      .where(eq(clanMemberships.accountId, holder.id));
    for (const seat of holderSeats) {
      const [ours] = await db
        .select({ id: clanMemberships.id })
        .from(clanMemberships)
        .where(and(eq(clanMemberships.accountId, accountId), eq(clanMemberships.clanId, seat.clanId)))
        .limit(1);
      if (ours) {
        const res = await mergeSeats({
          clanId: seat.clanId,
          sourceId: seat.id,
          targetId: ours.id,
          actorUserId: opts.actorUserId,
          note: `rename ${oldRsn} → ${newRsn} (${opts.via})`,
        });
        if (!res.ok) return { ok: false, reason: 'different_account', error: res.error };
        // THE ROSTER'S VIEW COMES FROM THE STRANGER. It is the seat the in-game roster just listed
        // (under the new name); ours was the one it dropped — often kept live as a guest, which
        // mergeSeats reads as "current" and would keep. Take the listed side's membership and rank.
        if (seat.leftAt == null) {
          const kind =
            seat.kind === 'member' && (await memberSeatElsewhere(seat.clanId, accountId)) != null ? 'guest' : seat.kind;
          await db
            .update(clanMemberships)
            .set({ kind, rank: seat.rank, source: seat.source, leftAt: null, lastSeenInClan: seat.lastSeenInClan })
            .where(eq(clanMemberships.id, ours.id));
        }
      } else {
        // One member seat per account: a member seat that would collide with ours elsewhere arrives
        // as a guest (lib/guestAdmission — a membership never moves between clans on its own).
        const kind = seat.kind === 'member' && (await memberSeatElsewhere(seat.clanId, accountId)) != null ? 'guest' : seat.kind;
        await db.update(clanMemberships).set({ accountId, kind }).where(eq(clanMemberships.id, seat.id));
      }
      absorbed++;
    }

    // Whatever still points at the holder account moves to ours, then the empty duplicate goes —
    // it holds the name our account is about to take (rsn_normalized is unique).
    const stillThere = await db.query.accounts.findFirst({ where: eq(accounts.id, holder.id), columns: { id: true } });
    if (stillThere) {
      await db.update(eventParticipants).set({ accountId }).where(eq(eventParticipants.accountId, holder.id));
      await db.delete(accounts).where(eq(accounts.id, holder.id));
    }
  }

  // ── Our account takes the name ────────────────────────────────────────────────────────────────
  // mergeSeats may already have given it the new name (when the holder's seat was the roster's
  // current one); re-read rather than assume.
  const now = await db.query.accounts.findFirst({ where: eq(accounts.id, accountId) });
  if (!now) return { ok: false, reason: 'not_found', error: 'No such character.' };
  const changed = now.rsnNormalized !== newNorm || now.rsn !== newRsn || normalizeRsn(oldRsn) !== newNorm;

  // Never list the name it now has among the names it used to have (mergeSeats may have added it).
  const previous = parsePrevious(now.previousRsns).filter((p) => normalizeRsn(p) !== newNorm);
  for (const name of [oldRsn, now.rsn]) {
    if (name && normalizeRsn(name) !== newNorm && !previous.some((p) => normalizeRsn(p) === normalizeRsn(name))) {
      previous.push(name);
    }
  }
  await db
    .update(accounts)
    .set({
      rsn: newRsn,
      rsnNormalized: newNorm,
      previousRsns: previous.length ? JSON.stringify(previous) : null,
      // The old name's hiscores 404 was this rename, not a ban — poll the new name again.
      status: now.status === 'unranked' ? 'active' : now.status,
    })
    .where(eq(accounts.id, accountId));

  // ── Everything that displays or matches by name ──────────────────────────────────────────────
  const seats = await db
    .select({ id: clanMemberships.id, clanId: clanMemberships.clanId })
    .from(clanMemberships)
    .where(and(eq(clanMemberships.accountId, accountId), isNull(clanMemberships.leftAt)));
  // clan-scope: global -- one character's seats in every clan; a rename is a fact about the character.
  const allSeatIds = (
    await db.select({ id: clanMemberships.id }).from(clanMemberships).where(eq(clanMemberships.accountId, accountId))
  ).map((s) => s.id);
  // Event rows carry a name of their own: boards, Discord posts and co-op matching (teammates report
  // the NEW name) all read it.
  await db.update(eventParticipants).set({ name: newRsn }).where(eq(eventParticipants.accountId, accountId));
  if (allSeatIds.length) {
    await db.update(eventParticipants).set({ name: newRsn }).where(inArray(eventParticipants.clanMemberId, allSeatIds));
  }
  if (normalizeRsn(oldRsn) !== newNorm) {
    const { applyRenameToActiveWeeklyParticipants } = await import('@/lib/weekly');
    for (const seat of seats) {
      await applyRenameToActiveWeeklyParticipants(seat.id, oldRsn, newRsn).catch(() => {});
    }
  }

  if (changed) {
    await db
      .insert(clanAuditLog)
      .values(
        (seats.length ? seats : [{ id: null as number | null, clanId: null as number | null }]).map((s) => ({
          clanId: s.clanId,
          clanMemberId: s.id,
          eventType: 'renamed',
          oldValue: JSON.stringify({ rsn: oldRsn }),
          newValue: JSON.stringify({ rsn: newRsn, absorbed }),
          notes: opts.note ?? `via ${opts.via}`,
          actorUserId: opts.actorUserId,
        })),
      )
      .catch(() => {});
  }
  return { ok: true, changed, absorbed };
}

/**
 * The character a player's plugin is really playing, when it shows up under a name they don't own
 * yet and no account carries its hash: one of their OWN characters, linked by the XP check or a mod
 * vouch (so never hash-anchored), renamed before their plugin first reported it.
 *
 * Without this the plugin mints a second account for the new name and the original — the one in the
 * event, with the baseline — sits on a dead name. The evidence has to rule out "it's a new alt":
 * exactly one hashless character of theirs, and its old name has gone from the hiscores (`unranked`).
 * A new alt does not make your main's name disappear. Anything less certain returns null and the
 * normal path runs; a rename request to Anvil staff covers the rest.
 */
export async function hashlessRenameCandidate(playerId: number, newNorm: string): Promise<number | null> {
  const hashless = await db
    .select({ id: accounts.id, rsnNormalized: accounts.rsnNormalized, status: accounts.status })
    .from(accounts)
    .where(and(eq(accounts.playerId, playerId), isNull(accounts.accountHash), isNotNull(accounts.claimedAt)));
  const gone = hashless.filter((a) => a.rsnNormalized !== newNorm && a.status === 'unranked');
  return gone.length === 1 ? gone[0].id : null;
}
