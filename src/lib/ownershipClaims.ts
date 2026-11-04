// "This is my account" — a login asking for a character somebody else has claimed on Anvil.
//
// An ANVIL ownership dispute, not account security: who on Anvil the character's history belongs to.
// Nothing moves silently and nothing moves at once. How it can end depends on what the owner has:
//
//   - The owner's claim rests on a NAME (they never played it with the plugin, so Anvil has no
//     account hash from them), and the claimant's plugin is logged into it (X-Account-Hash):
//     'objection' mode. The owner is told (Discord DM + their settings) and has
//     OBJECTION_DAYS to object. If they don't, it moves to the claimant.
//   - The owner's own plugin proved it (the same hash, anchored by their play): 'approval' mode.
//     Only the owner's yes moves it.
//   - Neither side can show the character is logged in (no hash), or the hash differs from the one
//     anchored: not a claim Anvil can weigh — the caller files it with staff instead (wrong-owner
//     report, as before).
//
// A move is a release + claim with the existing primitives (lib/accountRelease, lib/accountClaim):
// the seats and every result recorded under the character stay; only who owns it changes. Until it
// moves the claimant's plugin still can't act for the character (lib/pluginForeign). The claimant
// never learns who the owner is. Every step is in the platform audit log (clan_audit_log, clan null).

import { and, desc, eq, gte, inArray, isNull, lte } from 'drizzle-orm';

import { db } from '@/db';
import { accountOwnershipClaims, accounts, clanAuditLog, clanRoster, users } from '@/db/schema';
import { claimAccountForPerson } from '@/lib/accountClaim';
import { releaseCharacter } from '@/lib/accountRelease';
import { log } from '@/lib/logger';
import { accountForCharacter, type PlayedCharacter } from '@/lib/pluginAccount';
import { findRosterSeats, loginOf, personOfOrCreate, personOf } from '@/lib/roster';

export const OBJECTION_DAYS = 7;
/** New claims one login may open in a day, across all characters. */
export const CLAIMS_PER_DAY = 3;
/** After the owner said no, the same person can't simply ask again — that's staff's to weigh. */
export const RECLAIM_COOLDOWN_DAYS = 30;

const DAY_MS = 86_400_000;

export type ClaimMode = 'objection' | 'approval';
export type ClaimStatus = 'open' | 'approved' | 'transferred' | 'objected' | 'declined' | 'withdrawn' | 'lapsed';
/** Still running: the partial unique index allows one of these per character. */
const LIVE: ClaimStatus[] = ['open', 'approved'];

/** How the current owner's claim was proved with the plugin — their own client, logged in to it. */
const PLUGIN_PROOF = new Set(['plugin', 'plugin_first_use']);

export type FileOutcome =
  | { ok: true; created: boolean; claimId: number; mode: ClaimMode; status: ClaimStatus; deadlineAt: string | null; message: string }
  | {
      ok: false;
      /** `no-hash`, `hash-mismatch` and `cooldown` are for staff: the caller files a report instead. */
      reason: 'not-other' | 'no-hash' | 'hash-mismatch' | 'taken' | 'cooldown' | 'rate-limited';
      error: string;
    };

type ClaimRow = typeof accountOwnershipClaims.$inferSelect;

function fmtDay(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** What the claimant is told about their claim — never who the owner is. */
export function claimantLine(c: { mode: string; status: string; deadlineAt: string | null }, rsn: string): string {
  switch (c.status) {
    case 'open':
      return c.mode === 'objection'
        ? `Your claim on ${rsn} is open. The current owner has until ${fmtDay(c.deadlineAt)} to object; if they don't, it moves to you.`
        : `Your claim on ${rsn} is with the current owner. Their own plugin proved this character, so it moves only if they approve.`;
    case 'approved':
      return `Your claim on ${rsn} went through. It moves to you as soon as the event it's playing in ends.`;
    case 'transferred':
      return `${rsn} is yours now.`;
    case 'objected':
    case 'declined':
      return `The current owner turned down your claim on ${rsn}. If you still think it's yours, ask Anvil staff to look.`;
    case 'withdrawn':
      return `You withdrew your claim on ${rsn}.`;
    default:
      return `Your claim on ${rsn} closed: the character changed hands another way.`;
  }
}

async function audit(eventType: string, actorUserId: number | null, value: Record<string, unknown>, notes?: string) {
  // clan-scope: global -- who owns a character is the platform's record, not any clan's.
  await db
    .insert(clanAuditLog)
    .values({ clanId: null, eventType, actorUserId, newValue: JSON.stringify(value), notes: notes ?? null })
    .catch(() => {});
}

/**
 * The login behind `userId` asks for the character it is playing. `character` comes straight from
 * the plugin's headers (lib/pluginAccount playedCharacter); its hash is the only proof considered.
 */
export async function fileOwnershipClaim(input: {
  userId: number;
  character: PlayedCharacter;
  nowIso?: string;
}): Promise<FileOutcome> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const { character } = input;
  const account = await accountForCharacter(character);
  const me = await personOf(input.userId);
  if (!account || account.claimedAt == null || (me != null && account.playerId === me)) {
    return { ok: false, reason: 'not-other', error: 'This character isn’t linked to anyone else.' };
  }
  const claimant = me ?? (await personOfOrCreate(input.userId));

  // clan-scope: global -- one character's claims.
  const live = await db.query.accountOwnershipClaims.findFirst({
    where: and(eq(accountOwnershipClaims.accountId, account.id), inArray(accountOwnershipClaims.status, LIVE)),
  });
  if (live) {
    if (live.claimantPlayerId === claimant) {
      return {
        ok: true,
        created: false,
        claimId: live.id,
        mode: live.mode as ClaimMode,
        status: live.status as ClaimStatus,
        deadlineAt: live.deadlineAt,
        message: claimantLine(live, account.rsn),
      };
    }
  }

  // The owner already said no to this person: not theirs to ask again; staff weigh it.
  const since = new Date(Date.parse(nowIso) - RECLAIM_COOLDOWN_DAYS * DAY_MS).toISOString();
  const refusedBefore = await db.query.accountOwnershipClaims.findFirst({
    where: and(
      eq(accountOwnershipClaims.accountId, account.id),
      eq(accountOwnershipClaims.claimantPlayerId, claimant),
      inArray(accountOwnershipClaims.status, ['objected', 'declined']),
      gte(accountOwnershipClaims.decidedAt, since),
    ),
    columns: { id: true },
  });
  if (refusedBefore) {
    return { ok: false, reason: 'cooldown', error: 'The current owner turned down your claim. Anvil staff will look at it.' };
  }

  if (!character.accountHash) {
    return { ok: false, reason: 'no-hash', error: 'Log in to the character with the plugin first, so Anvil can see it’s really logged in here.' };
  }
  if (account.accountHash && account.accountHash !== character.accountHash) {
    return { ok: false, reason: 'hash-mismatch', error: 'Anvil can’t match this login to the character on record. Anvil staff will look at it.' };
  }

  // One claim at a time per character (somebody else's is open). Asked after the proof checks so a
  // claim Anvil can't weigh still reaches staff.
  if (live) {
    return { ok: false, reason: 'taken', error: 'Somebody already asked for this character — Anvil is waiting on that first.' };
  }

  const dayAgo = new Date(Date.parse(nowIso) - DAY_MS).toISOString();
  const recent = await db
    .select({ id: accountOwnershipClaims.id })
    .from(accountOwnershipClaims)
    .where(and(eq(accountOwnershipClaims.claimantUserId, input.userId), gte(accountOwnershipClaims.createdAt, dayAgo)));
  if (recent.length >= CLAIMS_PER_DAY) {
    return { ok: false, reason: 'rate-limited', error: 'That’s a lot of claims for one day — try again tomorrow.' };
  }


  const mode: ClaimMode =
    account.accountHash != null && PLUGIN_PROOF.has(account.verificationMethod ?? '') ? 'approval' : 'objection';
  const deadlineAt = mode === 'objection' ? new Date(Date.parse(nowIso) + OBJECTION_DAYS * DAY_MS).toISOString() : null;

  const [row] = await db
    .insert(accountOwnershipClaims)
    .values({
      accountId: account.id,
      claimantUserId: input.userId,
      claimantPlayerId: claimant,
      ownerPlayerId: account.playerId!,
      mode,
      status: 'open',
      claimHash: character.accountHash,
      createdAt: nowIso,
      deadlineAt,
    })
    .onConflictDoNothing()
    .returning();
  if (!row) {
    // Another claim landed between the read and the write.
    return { ok: false, reason: 'taken', error: 'Somebody already asked for this character — Anvil is waiting on that first.' };
  }

  await audit('ownership_claim_opened', input.userId, {
    claimId: row.id,
    accountId: account.id,
    rsn: account.rsn,
    mode,
    ownerPlayerId: account.playerId,
    claimantPlayerId: claimant,
    deadlineAt,
  });
  notifyOwnerOfClaim(row, account.rsn).catch((err) => log.warn('ownership-claim.notify-failed', { err: String(err) }));

  return { ok: true, created: true, claimId: row.id, mode, status: 'open', deadlineAt, message: claimantLine(row, account.rsn) };
}

export type RespondOutcome = { ok: true; status: ClaimStatus } | { ok: false; error: string; status?: number };

/** The owner's answer: approve (it moves) or decline / object (it stays, and the claim closes). */
export async function respondToClaim(input: {
  claimId: number;
  userId: number;
  playerId: number;
  action: 'approve' | 'decline';
  nowIso?: string;
}): Promise<RespondOutcome> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const claim = await db.query.accountOwnershipClaims.findFirst({ where: eq(accountOwnershipClaims.id, input.claimId) });
  if (!claim || claim.ownerPlayerId !== input.playerId) return { ok: false, error: 'Not found', status: 404 };
  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, claim.accountId) });
  // Still theirs to answer for: the character hasn't changed hands some other way.
  if (!account || account.claimedAt == null || account.playerId !== input.playerId) return { ok: false, error: 'Not found', status: 404 };
  if (claim.status !== 'open') return { ok: false, error: 'This claim is already settled.', status: 409 };

  if (input.action === 'decline') {
    const status: ClaimStatus = claim.mode === 'approval' ? 'declined' : 'objected';
    const done = await db
      .update(accountOwnershipClaims)
      .set({ status, decidedAt: nowIso, decidedByUserId: input.userId })
      .where(and(eq(accountOwnershipClaims.id, claim.id), eq(accountOwnershipClaims.status, 'open')))
      .returning({ id: accountOwnershipClaims.id });
    if (done.length === 0) return { ok: false, error: 'This claim is already settled.', status: 409 };
    await audit(`ownership_claim_${status}`, input.userId, { claimId: claim.id, accountId: claim.accountId, rsn: account.rsn });
    claimNotify.send(claim.claimantUserId, {
      title: `Your claim on ${account.rsn} was turned down`,
      description: claimantLine({ ...claim, status }, account.rsn),
    }).catch(() => {});
    return { ok: true, status };
  }

  const approved = await db
    .update(accountOwnershipClaims)
    .set({ status: 'approved', decidedAt: nowIso, decidedByUserId: input.userId })
    .where(and(eq(accountOwnershipClaims.id, claim.id), eq(accountOwnershipClaims.status, 'open')))
    .returning();
  if (approved.length === 0) return { ok: false, error: 'This claim is already settled.', status: 409 };
  await audit('ownership_claim_approved', input.userId, { claimId: claim.id, accountId: claim.accountId, rsn: account.rsn });
  const status = await transferClaim(approved[0], nowIso, 'owner-approved');
  return { ok: true, status };
}

/** The claimant changes their mind. */
export async function withdrawClaim(input: { claimId: number; userId: number; nowIso?: string }): Promise<RespondOutcome> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const me = await personOf(input.userId);
  const claim = await db.query.accountOwnershipClaims.findFirst({ where: eq(accountOwnershipClaims.id, input.claimId) });
  if (!claim || me == null || claim.claimantPlayerId !== me) return { ok: false, error: 'Not found', status: 404 };
  const done = await db
    .update(accountOwnershipClaims)
    .set({ status: 'withdrawn', decidedAt: nowIso, decidedByUserId: input.userId })
    .where(and(eq(accountOwnershipClaims.id, claim.id), inArray(accountOwnershipClaims.status, LIVE)))
    .returning({ id: accountOwnershipClaims.id });
  if (done.length === 0) return { ok: false, error: 'This claim is already settled.', status: 409 };
  await audit('ownership_claim_withdrawn', input.userId, { claimId: claim.id, accountId: claim.accountId });
  return { ok: true, status: 'withdrawn' };
}

/**
 * Move the character from the owner to the claimant: release (the owner's proof goes with them,
 * their login stops auto-linking it) then claim for the claimant, with the claimant's hash anchored.
 * A live event holding the character defers it ('approved', retried by the settle sweep).
 */
async function transferClaim(claim: ClaimRow, nowIso: string, via: 'owner-approved' | 'no-objection'): Promise<ClaimStatus> {
  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, claim.accountId) });
  if (!account || account.claimedAt == null || account.playerId !== claim.ownerPlayerId) {
    await lapse(claim, nowIso, 'owner-changed');
    return 'lapsed';
  }
  const ownerLogin = await loginOf(claim.ownerPlayerId);
  const released = await releaseCharacter({
    userId: ownerLogin,
    playerId: claim.ownerPlayerId,
    accountId: account.id,
    nowIso,
    via: 'ownership-claim',
  });
  if (!released.ok) {
    if (released.reason === 'live-event') {
      if (claim.status !== 'approved') {
        await db
          .update(accountOwnershipClaims)
          .set({ status: 'approved', decidedAt: claim.decidedAt ?? nowIso })
          .where(eq(accountOwnershipClaims.id, claim.id));
      }
      return 'approved';
    }
    await lapse(claim, nowIso, 'owner-changed');
    return 'lapsed';
  }

  const moved = await claimAccountForPerson({
    playerId: claim.claimantPlayerId,
    rsn: account.rsn,
    rsnNormalized: account.rsnNormalized,
    method: 'plugin',
    accountHash: claim.claimHash,
    verified: true,
    provisional: false,
    actorUserId: claim.claimantUserId,
  });
  if (!moved.ok) {
    // Somebody else's plugin took it in the moment it was free. Never silent: it's in the log.
    await lapse(claim, nowIso, 'taken-on-release');
    return 'lapsed';
  }
  // The claimant's client was logged into it: that hash is the anchor from here on (a first-use
  // hash of the old owner's was dropped by the release).
  if (claim.claimHash) {
    await db
      .update(accounts)
      .set({ accountHash: claim.claimHash })
      .where(and(eq(accounts.id, account.id), isNull(accounts.accountHash)))
      .catch(() => {});
  }
  await db
    .update(accountOwnershipClaims)
    .set({ status: 'transferred', decidedAt: claim.decidedAt ?? nowIso })
    .where(eq(accountOwnershipClaims.id, claim.id));
  await audit(
    'ownership_claim_transferred',
    via === 'owner-approved' ? claim.decidedByUserId : null,
    {
      claimId: claim.id,
      accountId: account.id,
      rsn: account.rsn,
      fromPlayerId: claim.ownerPlayerId,
      toPlayerId: claim.claimantPlayerId,
      mode: claim.mode,
      via,
    },
  );
  claimNotify.send(claim.claimantUserId, { title: `${account.rsn} is yours now`, description: claimantLine({ ...claim, status: 'transferred' }, account.rsn) }).catch(() => {});
  if (ownerLogin != null) {
    claimNotify.send(ownerLogin, {
      title: `${account.rsn} moved to the player who claimed it`,
      description:
        via === 'owner-approved'
          ? `You approved the claim, so ${account.rsn} is no longer on your Anvil account. Everything it earned stays where it was recorded.`
          : `Nobody objected within ${OBJECTION_DAYS} days, so ${account.rsn} moved to the Anvil player whose plugin is logged into it. Everything it earned stays where it was recorded. If this is wrong, contact Anvil staff.`,
    }).catch(() => {});
  }
  return 'transferred';
}

async function lapse(claim: ClaimRow, nowIso: string, why: string) {
  await db
    .update(accountOwnershipClaims)
    .set({ status: 'lapsed', decidedAt: claim.decidedAt ?? nowIso })
    .where(eq(accountOwnershipClaims.id, claim.id));
  await audit('ownership_claim_lapsed', null, { claimId: claim.id, accountId: claim.accountId, why });
}

/**
 * The sweep (lifecycle tick): an objection window that ran out with no objection moves the
 * character; an approved claim waiting on a live event tries again; a claim whose character changed
 * hands some other way closes. Never throws per claim.
 */
export async function settleOwnershipClaims(nowMs = Date.now()): Promise<number> {
  const nowIso = new Date(nowMs).toISOString();
  // clan-scope: global -- ownership claims are the platform's, across every clan.
  const due = await db
    .select()
    .from(accountOwnershipClaims)
    .where(inArray(accountOwnershipClaims.status, LIVE))
    .limit(200);
  let moved = 0;
  for (const claim of due) {
    try {
      if (claim.status === 'open') {
        const account = await db.query.accounts.findFirst({ where: eq(accounts.id, claim.accountId), columns: { playerId: true, claimedAt: true } });
        if (!account || account.claimedAt == null || account.playerId !== claim.ownerPlayerId) {
          await lapse(claim, nowIso, 'owner-changed');
          continue;
        }
        if (claim.mode !== 'objection' || !claim.deadlineAt || claim.deadlineAt > nowIso) continue;
        const [ripe] = await db
          .update(accountOwnershipClaims)
          .set({ status: 'approved', decidedAt: nowIso })
          .where(and(eq(accountOwnershipClaims.id, claim.id), eq(accountOwnershipClaims.status, 'open'), lte(accountOwnershipClaims.deadlineAt, nowIso)))
          .returning();
        if (!ripe) continue;
        await audit('ownership_claim_unopposed', null, { claimId: claim.id, accountId: claim.accountId });
        if ((await transferClaim(ripe, nowIso, 'no-objection')) === 'transferred') moved++;
      } else if ((await transferClaim(claim, nowIso, claim.decidedByUserId != null ? 'owner-approved' : 'no-objection')) === 'transferred') {
        moved++;
      }
    } catch (err) {
      log.warn('ownership-claim.settle-failed', { claimId: claim.id, err: String(err) });
    }
  }
  return moved;
}

// ── Reads ──────────────────────────────────────────────────────────────────────────────────────

export type OwnerClaimView = {
  id: number;
  accountId: number;
  rsn: string;
  mode: ClaimMode;
  status: ClaimStatus;
  createdAt: string;
  deadlineAt: string | null;
  /** The claimant's display name: the owner may know who is asking. */
  claimantName: string;
};

/** Claims waiting on this person as the owner (open ones; approved-and-waiting ones too). */
export async function claimsOnMyCharacters(playerId: number): Promise<OwnerClaimView[]> {
  const rows = await db
    .select({
      id: accountOwnershipClaims.id,
      accountId: accountOwnershipClaims.accountId,
      rsn: accounts.rsn,
      mode: accountOwnershipClaims.mode,
      status: accountOwnershipClaims.status,
      createdAt: accountOwnershipClaims.createdAt,
      deadlineAt: accountOwnershipClaims.deadlineAt,
      displayName: users.displayName,
      discordUsername: users.discordUsername,
    })
    .from(accountOwnershipClaims)
    .innerJoin(accounts, eq(accounts.id, accountOwnershipClaims.accountId))
    .innerJoin(users, eq(users.id, accountOwnershipClaims.claimantUserId))
    .where(
      and(
        eq(accountOwnershipClaims.ownerPlayerId, playerId),
        eq(accounts.playerId, playerId),
        inArray(accountOwnershipClaims.status, LIVE),
      ),
    )
    .orderBy(desc(accountOwnershipClaims.createdAt));
  return rows.map((r) => ({
    id: r.id,
    accountId: r.accountId,
    rsn: r.rsn,
    mode: r.mode as ClaimMode,
    status: r.status as ClaimStatus,
    createdAt: r.createdAt,
    deadlineAt: r.deadlineAt,
    claimantName: r.displayName || r.discordUsername || 'another Anvil player',
  }));
}

export type ClaimantClaimView = {
  id: number;
  rsn: string;
  mode: ClaimMode;
  status: ClaimStatus;
  createdAt: string;
  deadlineAt: string | null;
  line: string;
};

/** This login's person's own claims, newest first — never naming an owner. */
export async function myOwnershipClaims(userId: number, limit = 20): Promise<ClaimantClaimView[]> {
  const me = await personOf(userId);
  if (me == null) return [];
  const rows = await db
    .select({
      id: accountOwnershipClaims.id,
      rsn: accounts.rsn,
      mode: accountOwnershipClaims.mode,
      status: accountOwnershipClaims.status,
      createdAt: accountOwnershipClaims.createdAt,
      deadlineAt: accountOwnershipClaims.deadlineAt,
    })
    .from(accountOwnershipClaims)
    .innerJoin(accounts, eq(accounts.id, accountOwnershipClaims.accountId))
    .where(eq(accountOwnershipClaims.claimantPlayerId, me))
    .orderBy(desc(accountOwnershipClaims.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    ...r,
    mode: r.mode as ClaimMode,
    status: r.status as ClaimStatus,
    line: claimantLine(r, r.rsn),
  }));
}

/** For the plugin panel: this login's latest claim on the character it is playing, if any. */
export async function myClaimOn(userId: number, character: PlayedCharacter): Promise<ClaimantClaimView | null> {
  const me = await personOf(userId);
  if (me == null) return null;
  const account = await accountForCharacter(character);
  if (!account) return null;
  const row = await db.query.accountOwnershipClaims.findFirst({
    where: and(eq(accountOwnershipClaims.accountId, account.id), eq(accountOwnershipClaims.claimantPlayerId, me)),
    orderBy: desc(accountOwnershipClaims.createdAt),
  });
  if (!row) return null;
  return {
    id: row.id,
    rsn: account.rsn,
    mode: row.mode as ClaimMode,
    status: row.status as ClaimStatus,
    createdAt: row.createdAt,
    deadlineAt: row.deadlineAt,
    line: claimantLine(row, account.rsn),
  };
}

// ── Telling people ────────────────────────────────────────────────────────────────────────────

async function notifyOwnerOfClaim(claim: ClaimRow, rsn: string): Promise<void> {
  const ownerLogin = await loginOf(claim.ownerPlayerId);
  if (ownerLogin == null) return;
  const claimant = await db.query.users.findFirst({
    where: eq(users.id, claim.claimantUserId),
    columns: { displayName: true, discordUsername: true },
  });
  const who = claimant?.displayName || claimant?.discordUsername || 'Another Anvil player';
  await claimNotify.send(ownerLogin, {
    title: `${who} says ${rsn} is their character`,
    description:
      claim.mode === 'objection'
        ? `${who}'s RuneLite plugin is logged into **${rsn}**, which is linked to your Anvil account by name only. ` +
          `If you don't object by **${fmtDay(claim.deadlineAt)}**, it moves to them (everything it earned stays where it was recorded). ` +
          `Answer in Settings → Ownership claims.`
        : `${who}'s RuneLite plugin is logged into **${rsn}**. Your own plugin proved it, so it moves only if you approve. ` +
          `Answer in Settings → Ownership claims.`,
  });
}

/** Swappable so a test can see what would be sent without a Discord bot. */
export const claimNotify = {
  send: (userId: number, msg: { title: string; description: string }): Promise<boolean> => notifyLogin(userId, msg),
};

/**
 * Discord DM to a login, through Anvil's own bot or else the bot of a clan they sit in (a bot can
 * only DM someone it shares a server with). Best effort; the settings page is the record.
 */
async function notifyLogin(userId: number, msg: { title: string; description: string }): Promise<boolean> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { discordId: true, playerId: true } });
  const { isRealDiscordId } = await import('@/lib/anvilDiscordRoles');
  if (!isRealDiscordId(user?.discordId)) return false;
  const { getBotTokenOnly, sharedBotToken } = await import('@/lib/discord-roles');
  const { sendDm } = await import('@/lib/onboardingNudge');
  const { ANVIL_LOGO_URL, EMBED_COLOR, POWERED_BY } = await import('@/lib/discordEmbeds');
  const { absoluteUrl } = await import('@/lib/seo');
  const tokens = new Set<string>();
  const shared = sharedBotToken();
  if (shared) tokens.add(shared);
  if (user!.playerId != null) {
    // clan-scope: global -- the person's own seats, to find a bot that shares a server with them.
    const seats = await findRosterSeats(and(eq(clanRoster.playerId, user!.playerId), isNull(clanRoster.leftAt)));
    for (const clanId of [...new Set(seats.map((s) => s.clanId))].slice(0, 3)) {
      const bot = await getBotTokenOnly(clanId).catch(() => null);
      if (bot) tokens.add(bot.token);
    }
  }
  const body = {
    embeds: [
      {
        title: msg.title,
        description: msg.description,
        url: absoluteUrl('/settings/claims'),
        color: EMBED_COLOR.amber,
        footer: { text: POWERED_BY, icon_url: ANVIL_LOGO_URL },
      },
    ],
  };
  for (const token of tokens) {
    if (await sendDm(token, user!.discordId!, body).catch(() => false)) return true;
  }
  return false;
}
