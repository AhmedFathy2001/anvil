// Character reports — a clan asking Anvil to fix a CHARACTER, and the staff tools that do it.
//
// A character (an `accounts` row) belongs to a person, and a person plays in many clans. Every
// clan-admin action that used to change one — attach it to someone, take it off them, reject a link,
// vouch for a claim — wrote the account itself, so one clan's decision changed that person in every
// clan they play in. Clans now own their ROSTER (seats: kick, rank, guest/member, ban) and nothing
// about the character; the rest is raised here and decided by platform staff in /staff/reports.

import { and, desc, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, characterReports, clanAuditLog, clans, detectedAccounts, players, users } from '@/db/schema';
import { claimAccountForPerson } from '@/lib/accountClaim';

export const REPORT_KINDS = ['wrong_owner', 'rename', 'merge', 'claim_review', 'claim_request', 'other'] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export function isReportKind(v: unknown): v is ReportKind {
  return typeof v === 'string' && (REPORT_KINDS as readonly string[]).includes(v);
}

function automaticEvidenceKey(block: string): string | null {
  // The rename sweep can rediscover the same pair on every sync. Its confidence percentage may
  // move slightly as the hiscores update, but that is newer evidence for the same report rather
  // than another operator note. Keep the newest reading in that one evidence slot.
  const rename = block.match(/^Looks like\s+(.+?)\s+renamed to\s+(.+?)\s+\([^\n)]*\)\.\s+Not applied automatically:/i);
  if (!rename) return null;
  const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
  return `automatic-rename:${normalize(rename[1])}:${normalize(rename[2])}`;
}

/**
 * Turn a report's append-only notes into a readable thread. Exact retries appear once, while
 * automatic rename evidence for the same old/new pair is refreshed in place. This also makes old
 * reports that accumulated one paragraph per plugin ping readable as soon as staff reloads them.
 */
export function compactCharacterReportBody(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;

  const blocks: string[] = [];
  const positionByKey = new Map<string, number>();
  for (const raw of value.replace(/\r\n?/g, '\n').split(/\n\s*\n+/)) {
    const block = raw.trim();
    if (!block) continue;
    const automaticKey = automaticEvidenceKey(block);
    const key = automaticKey ?? `note:${block}`;
    const prior = positionByKey.get(key);
    if (prior == null) {
      positionByKey.set(key, blocks.length);
      blocks.push(block);
    } else if (automaticKey) {
      blocks[prior] = block;
    }
  }
  return blocks.join('\n\n') || null;
}

export function mergeCharacterReportBody(
  existing: string | null | undefined,
  incoming: string | null | undefined,
): string | null {
  const next = incoming?.trim().slice(0, 2000) || null;
  return compactCharacterReportBody([existing, next].filter((part): part is string => !!part).join('\n\n'));
}

/**
 * Raise a character with Anvil. Idempotent per (account, kind, claimant) while one is open — a mod
 * pressing the button twice, or two mods of two clans, add to one thread rather than starting a
 * second.
 *
 * The CLAIMANT is part of the key. Two clans vouching for two DIFFERENT people over one character is
 * a dispute, not a duplicate: folded into one report, the second vouch would sit under the first
 * claimant's name and its "Give to …" button — and staff would hand the character to the person
 * neither text was about.
 */
export async function fileCharacterReport(input: {
  accountId: number;
  clanId: number | null;
  reportedByUserId: number | null;
  kind: ReportKind;
  body?: string | null;
  claimantPlayerId?: number | null;
  /** For a 'rename': the name the character should take. Part of the de-duplication key. */
  requestedRsn?: string | null;
}): Promise<{ id: number; created: boolean }> {
  const claimant = input.claimantPlayerId ?? null;
  const requested = input.requestedRsn?.trim() || null;
  const open = await db.query.characterReports.findFirst({
    where: and(
      eq(characterReports.accountId, input.accountId),
      eq(characterReports.kind, input.kind),
      eq(characterReports.status, 'open'),
      claimant == null ? isNull(characterReports.claimantPlayerId) : eq(characterReports.claimantPlayerId, claimant),
      // Two different names asked for one character are two questions, not one.
      requested == null ? isNull(characterReports.requestedRsn) : eq(characterReports.requestedRsn, requested),
    ),
    columns: { id: true, body: true },
  });
  const body = mergeCharacterReportBody(null, input.body);
  if (open) {
    const mergedBody = mergeCharacterReportBody(open.body, body);
    if (mergedBody !== open.body) {
      await db
        .update(characterReports)
        .set({ body: mergedBody })
        .where(eq(characterReports.id, open.id));
    }
    return { id: open.id, created: false };
  }
  const [row] = await db
    .insert(characterReports)
    .values({
      accountId: input.accountId,
      clanId: input.clanId,
      reportedByUserId: input.reportedByUserId,
      claimantPlayerId: input.claimantPlayerId ?? null,
      requestedRsn: requested,
      kind: input.kind,
      body,
    })
    .returning({ id: characterReports.id });
  return { id: row.id, created: true };
}

/** How many are waiting — the /staff sidebar badge. */
export async function openCharacterReportCount(): Promise<number> {
  const rows = await db.select({ id: characterReports.id }).from(characterReports).where(eq(characterReports.status, 'open'));
  return rows.length;
}

/** Account ids with an open report — for the clan side's "Reported to Anvil" marker. */
export async function openReportAccountIds(accountIds: number[]): Promise<Set<number>> {
  if (accountIds.length === 0) return new Set();
  const rows = await db
    .select({ accountId: characterReports.accountId })
    .from(characterReports)
    .where(and(inArray(characterReports.accountId, accountIds), eq(characterReports.status, 'open')));
  return new Set(rows.map((r) => r.accountId));
}

export interface CharacterReportView {
  id: number;
  kind: string;
  body: string | null;
  /** For a rename: the name asked for. */
  requestedRsn: string | null;
  status: string;
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
  account: { id: number; rsn: string; playerId: number; ownerName: string | null; claimed: boolean; verificationMethod: string | null; provisional: boolean };
  clan: { name: string; slug: string } | null;
  reporter: string | null;
  claimant: { id: number; name: string } | null;
}

/** The staff queue. Open first, newest first. */
export async function listCharacterReports(opts: { status?: 'open' | 'all' } = {}): Promise<CharacterReportView[]> {
  // clan-scope: global -- the PLATFORM's queue; the clan is a column on each report, not a filter.
  const rows = await db
    .select({
      r: characterReports,
      rsn: accounts.rsn,
      playerId: accounts.playerId,
      claimedAt: accounts.claimedAt,
      verificationMethod: accounts.verificationMethod,
      provisional: accounts.provisional,
      ownerName: players.displayName,
      clanName: clans.name,
      clanSlug: clans.slug,
      reporter: users.displayName,
    })
    .from(characterReports)
    .innerJoin(accounts, eq(accounts.id, characterReports.accountId))
    .leftJoin(players, eq(players.id, accounts.playerId))
    .leftJoin(clans, eq(clans.id, characterReports.clanId))
    .leftJoin(users, eq(users.id, characterReports.reportedByUserId))
    .where(opts.status === 'all' ? undefined : eq(characterReports.status, 'open'))
    .orderBy(desc(characterReports.createdAt))
    .limit(500);

  const claimantIds = [...new Set(rows.map((x) => x.r.claimantPlayerId).filter((v): v is number => v != null))];
  const claimants = claimantIds.length
    ? await db.select({ id: players.id, name: players.displayName }).from(players).where(inArray(players.id, claimantIds))
    : [];
  const claimantName = new Map(claimants.map((c) => [c.id, c.name]));

  return rows.map((x) => ({
    id: x.r.id,
    kind: x.r.kind,
    body: compactCharacterReportBody(x.r.body),
    requestedRsn: x.r.requestedRsn,
    status: x.r.status,
    resolution: x.r.resolution,
    createdAt: x.r.createdAt,
    resolvedAt: x.r.resolvedAt,
    account: {
      id: x.r.accountId,
      rsn: x.rsn,
      playerId: x.playerId,
      ownerName: x.claimedAt ? x.ownerName : null,
      claimed: !!x.claimedAt,
      verificationMethod: x.verificationMethod,
      provisional: x.provisional === 1,
    },
    clan: x.clanSlug ? { name: x.clanName ?? x.clanSlug, slug: x.clanSlug } : null,
    reporter: x.reporter,
    claimant: x.r.claimantPlayerId != null ? { id: x.r.claimantPlayerId, name: claimantName.get(x.r.claimantPlayerId) ?? `#${x.r.claimantPlayerId}` } : null,
  }));
}

export async function resolveCharacterReport(
  id: number,
  actorUserId: number,
  status: 'resolved' | 'dismissed',
  resolution?: string | null,
  /** When closing as a side effect of acting on a character: only a report ABOUT that character. */
  forAccountId?: number,
): Promise<boolean> {
  const [row] = await db
    .update(characterReports)
    .set({
      status,
      resolution: resolution?.trim().slice(0, 2000) || null,
      resolvedByUserId: actorUserId,
      resolvedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(characterReports.id, id),
        eq(characterReports.status, 'open'),
        forAccountId != null ? eq(characterReports.accountId, forAccountId) : undefined,
      ),
    )
    .returning({ id: characterReports.id });
  return !!row;
}

/**
 * Take a character off whoever holds it. STAFF ONLY.
 *
 * The account goes back to a placeholder person of its own — the state every unclaimed roster entry
 * is in — with its proof cleared, so a later claim starts from nothing. A first-use claim anchored
 * the claimant's client hash; that hash was theirs, not the account's, so it goes too. And the
 * previous holder's plugin must not simply take it again on its next request: first-use auto-claim
 * honours a dismissed suggestion, so one is recorded. They can still prove it with the XP check.
 */
export async function detachCharacter(accountId: number, actorUserId: number, note?: string | null): Promise<boolean> {
  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, accountId) });
  if (!account || !account.claimedAt) return false;

  const formerLogin = account.playerId
    ? (await db.query.users.findFirst({ where: eq(users.playerId, account.playerId), columns: { id: true } }))?.id ?? null
    : null;

  const [person] = await db.insert(players).values({ displayName: account.rsn }).returning();
  await db
    .update(accounts)
    .set({
      playerId: person.id,
      isPrimary: 0,
      provisional: 0,
      verifiedAt: null,
      verificationMethod: null,
      verifiedByUserId: null,
      claimedAt: null,
      ...(account.verificationMethod === 'plugin_first_use' ? { accountHash: null } : {}),
    })
    .where(eq(accounts.id, accountId));

  if (formerLogin != null) {
    const nowIso = new Date().toISOString();
    await db
      .insert(detectedAccounts)
      .values({
        userId: formerLogin,
        rsn: account.rsn,
        rsnNormalized: account.rsnNormalized,
        status: 'dismissed',
        detectedAt: nowIso,
        lastSeenAt: nowIso,
      })
      .onConflictDoUpdate({
        target: [detectedAccounts.userId, detectedAccounts.rsnNormalized],
        set: { status: 'dismissed', accountHash: null },
      });
  }

  await db
    .insert(clanAuditLog)
    .values({
      clanId: null,
      eventType: 'platform_character_detached',
      oldValue: JSON.stringify({ accountId, playerId: account.playerId, method: account.verificationMethod }),
      actorUserId,
      notes: note?.trim() || null,
    })
    .catch(() => {});
  return true;
}

/**
 * Give a character to a person. STAFF ONLY — detaches it from any current holder first, then claims
 * it for the target with staff as the vouching login.
 */
export async function reassignCharacter(
  accountId: number,
  toPlayerId: number,
  actorUserId: number,
  note?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, accountId) });
  if (!account) return { ok: false, error: 'No such character' };
  const target = await db.query.players.findFirst({ where: eq(players.id, toPlayerId), columns: { id: true } });
  if (!target) return { ok: false, error: 'No such person' };
  if (account.claimedAt && account.playerId === toPlayerId) return { ok: true };

  if (account.claimedAt) await detachCharacter(accountId, actorUserId, note);

  const outcome = await claimAccountForPerson({
    playerId: toPlayerId,
    rsn: account.rsn,
    rsnNormalized: account.rsnNormalized,
    method: 'manual',
    provisional: false,
    verifiedByUserId: actorUserId,
    actorUserId,
  });
  if (!outcome.ok) return { ok: false, error: outcome.error };

  await db
    .insert(clanAuditLog)
    .values({
      clanId: null,
      eventType: 'platform_character_reassigned',
      newValue: JSON.stringify({ accountId, toPlayerId }),
      actorUserId,
      notes: note?.trim() || null,
    })
    .catch(() => {});
  return { ok: true };
}

/**
 * Close the player's own rename-request rows (pending_renames, which their profile lists) for this
 * character, once Anvil has decided — so "pending" on their profile turns into the answer.
 * `newRsn` null = every pending request for the character.
 */
export async function settleRenameRequests(
  accountId: number,
  newRsn: string | null,
  status: 'approved' | 'denied',
  resolution: string,
): Promise<void> {
  const { clanMemberships, pendingRenames } = await import('@/db/schema');
  const { normalizeRsn } = await import('@/lib/auth');
  // clan-scope: global -- one character's seats in every clan; a rename is a fact about the character.
  const seatIds = (
    await db.select({ id: clanMemberships.id }).from(clanMemberships).where(eq(clanMemberships.accountId, accountId))
  ).map((s) => s.id);
  if (seatIds.length === 0) return;
  await db
    .update(pendingRenames)
    .set({ status, resolution, reviewedAt: new Date().toISOString() })
    .where(
      and(
        inArray(pendingRenames.clanMemberId, seatIds),
        eq(pendingRenames.status, 'pending'),
        newRsn ? eq(pendingRenames.newRsnNormalized, normalizeRsn(newRsn)) : undefined,
      ),
    );
}
