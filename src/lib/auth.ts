import { cookies } from 'next/headers';
import crypto from 'crypto';
import { db } from '@/db';
import { resolveClanFromRequest } from '@/lib/clanContext';
import { accounts, clanAuditLog, clanMemberships, clanRoster, detectedAccounts, eventEditors, eventParticipants, events, pluginLinks, teams, users } from '@/db/schema';
import { findOrCreateAccount, findOrCreateSeat, findRosterSeat, findRosterSeats, updateAccountOfSeat } from '@/lib/roster';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { requireSecret } from '@/lib/env';
import { applyPendingRole } from '@/lib/pending-role';
import { onCharacterLinked } from '@/lib/identity';

const ADMIN_SESSION_SECRET = requireSecret('ADMIN_SESSION_SECRET', 'dev-admin-secret');
const CAPTAIN_SESSION_SECRET = requireSecret('CAPTAIN_SESSION_SECRET', 'dev-captain-secret');
const PLAYER_SESSION_SECRET = requireSecret('PLAYER_SESSION_SECRET', 'dev-player-secret');

function sign(payload: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const signature = hmac.digest('hex');
  return `${Buffer.from(payload).toString('base64')}.${signature}`;
}

function verify(token: string, secret: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;
  const payload = Buffer.from(encodedPayload, 'base64').toString('utf-8');
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  // Length-check the decoded buffers BEFORE timingSafeEqual — it throws a RangeError on
  // mismatched lengths, and `signature` is attacker-controlled (a crafted cookie can be any
  // length). A bad signature must read as an invalid token (null), never an uncaught 500.
  const sigBuf = Buffer.from(signature, 'hex');
  const expBuf = Buffer.from(expectedSignature, 'hex');
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  return payload;
}

// Session lifetime. Tokens carry `iat` (issued-at, ms). Anything older is rejected even with a
// valid signature, so a leaked/replayed token can't live forever (the cookie's maxAge is only a
// client-side hint the server never saw). Matches the 30-day cookie so normal sessions are
// unaffected. A small negative allowance absorbs clock skew between issuing and verifying hosts.
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function isFreshIat(iat: unknown): boolean {
  if (typeof iat !== 'number' || !Number.isFinite(iat)) return false;
  const age = Date.now() - iat;
  return age <= SESSION_MAX_AGE_MS && age >= -5 * 60 * 1000;
}

// Constant-time compare for shared secrets (cron bearer tokens, etc). Length-guarded so it never
// throws on attacker-sized input.
export function timingSafeStrEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function signUserToken(
  userId: number,
  username: string,
  role: string,
  editorScope: string = 'all',
  canEditTiles: boolean = false,
): string {
  // editorScope rides in the token so middleware (edge, no DB) can tell a board-scoped editor
  // (role 'editor' + scope 'assigned') from a global editor and route them to /admin/events only.
  // Server gates (verifyUser/verifyAdminOrModerator) re-read the live scope from the DB, so a stale
  // token only affects coarse page-routing until the next login.
  return sign(
    JSON.stringify({ userId, username, role, editorScope, canEditTiles, iat: Date.now() }),
    ADMIN_SESSION_SECRET,
  );
}

export function signCaptainToken(teamId: number): string {
  return sign(JSON.stringify({ role: 'captain', teamId, iat: Date.now() }), CAPTAIN_SESSION_SECRET);
}

export interface UserPayload {
  userId: number;
  username: string;
  role: string;
  // Only meaningful for role 'editor': 'all' = global editor (edits every event), 'assigned' =
  // board-scoped editor (edits only granted events). Always present so callers don't branch on
  // undefined; non-editor roles carry 'all' but never consult it. See users.editorScope.
  editorScope: string;
  // Tile authoring, independent of role — see users.canEditTiles. Admins always have it.
  canEditTiles: boolean;
}

export async function verifyUser(): Promise<UserPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_session')?.value;
  if (!token) return null;
  const payload = verify(token, ADMIN_SESSION_SECRET);
  if (!payload) return null;
  try {
    const data = JSON.parse(payload);
    if (!data.userId || !isFreshIat(data.iat)) return null;
    // Re-read the CURRENT role (and existence) from the DB rather than trusting the role baked
    // into the token. A demotion or account deletion then takes effect immediately, instead of
    // lingering until the 30-day cookie is replaced, and sessions for removed users stop working.
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, data.userId),
      columns: { id: true, role: true, banned: true, editorScope: true, canEditTiles: true },
    });
    // A deleted OR banned user has no valid session — the ban takes effect on their very next
    // request, not just next login, so kicking someone is immediate.
    if (!dbUser || dbUser.banned) return null;
    return {
      userId: dbUser.id,
      username: typeof data.username === 'string' ? data.username : 'user',
      role: dbUser.role,
      editorScope: dbUser.editorScope ?? 'all',
      // Admins can always author; for everyone else it's the explicit grant.
      canEditTiles: dbUser.role === 'admin' || dbUser.canEditTiles === true,
    };
  } catch {
    return null;
  }
}

export async function verifyAdmin(): Promise<boolean> {
  const user = await verifyUser();
  return user?.role === 'admin';
}

export async function verifyAdminOrModerator(): Promise<UserPayload | null> {
  const user = await verifyUser();
  if (!user) return null;
  // A board-scoped editor (role 'editor' + scope 'assigned') is NOT mod-tier — they can only
  // author tiles on their granted boards. Exclude them so they can't reach clan/verification/weekly
  // moderator surfaces. A GLOBAL editor (scope 'all') keeps full moderator access.
  if (user.role === 'editor' && user.editorScope === 'assigned') return null;
  // Treasurers and (global) editors do everything moderators can; this gate accepts all mod-tier roles.
  if (user.role === 'admin' || user.role === 'treasurer' || user.role === 'moderator' || user.role === 'editor') {
    return user;
  }
  return null;
}

// Per-event bingo-authoring gate. A caller may build/edit THIS event's tiles (Quick Build grid, CSV
// import, per-tile config, add/remove tiles) when they are:
//   • an admin, or
//   • a global editor (role 'editor' + scope 'all') — edits every event, the classic behavior, or
//   • the holder of an event_editors grant for this specific event (any role, incl. a board-scoped
//     editor or a moderator/treasurer given one board).
// They still cannot create events or manage teams/signups/players/fees — those stay admin-only.
export async function verifyTileEditorForEvent(eventId: number): Promise<UserPayload | null> {
  const user = await verifyUser();
  if (!user) return null;
  if (user.canEditTiles) return user;
  // Legacy: a global 'editor' role from before the capability column existed (migration 0049
  // converts these, but a session minted just before it lands still says 'editor').
  if (user.role === 'editor' && user.editorScope === 'all') return user;
  const grant = await db.query.eventEditors.findFirst({
    where: and(eq(eventEditors.eventId, eventId), eq(eventEditors.userId, user.userId)),
    columns: { id: true },
  });
  return grant ? user : null;
}

// Non-event authoring gate for the shared tile-editor helper APIs (item/NPC/clog/CA search) that
// carry no event-specific data. Passes admins, global editors, and anyone holding at least one
// board grant — i.e. anyone who can author tiles *somewhere* needs these lookups.
export async function verifyTileEditorAnywhere(): Promise<UserPayload | null> {
  const user = await verifyUser();
  if (!user) return null;
  if (user.canEditTiles) return user;
  if (user.role === 'editor' && user.editorScope === 'all') return user; // legacy, see above
  const grant = await db.query.eventEditors.findFirst({
    where: eq(eventEditors.userId, user.userId),
    columns: { id: true },
  });
  return grant ? user : null;
}

// Fee-collection gate. Regular moderators cannot collect sign-up fees — only admins
// and treasurers can. Used by the fee-collection endpoints in the sign-up flow.
export async function verifyFeeCollector(): Promise<UserPayload | null> {
  const user = await verifyUser();
  if (!user) return null;
  if (user.role === 'admin' || user.role === 'treasurer') return user;
  return null;
}

// Unified web-session membership resolver. Given the logged-in Discord user, works out
// their relationship to a specific team in an event: are they its captain, and/or do they
// have a player row on it (a captain is usually also a player). This replaces the old
// captain-password / player-token sessions for the website — the RuneLite plugin still
// uses bearer tokens via verifyPluginToken. Returns null if not logged in or the user has
// no captain/player tie to that team.
export async function resolveTeamMembership(
  eventId: number,
  teamId: number,
): Promise<{ userId: number; isCaptain: boolean; playerId: number | null } | null> {
  const user = await verifyUser();
  if (!user) return null;

  const team = await db.query.teams.findFirst({
    where: and(eq(teams.id, teamId), eq(teams.eventId, eventId)),
  });
  if (!team) return null;

  const isCaptain = team.captainUserId === user.userId;

  let playerId: number | null = null;
  const myMembers = await db
    .select({ id: clanRoster.id })
    .from(clanRoster)
    .where(and(eq(clanRoster.playerId, user.userId), isNull(clanRoster.leftAt)));
  if (myMembers.length > 0) {
    const memberIds = myMembers.map((m) => m.id);
    const playerRow = await db.query.eventParticipants.findFirst({
      where: and(
        eq(eventParticipants.eventId, eventId),
        eq(eventParticipants.teamId, teamId),
        inArray(eventParticipants.clanMemberId, memberIds),
      ),
    });
    playerId = playerRow?.id ?? null;
  }

  if (!isCaptain && playerId == null) return null;
  return { userId: user.userId, isCaptain, playerId };
}

export async function verifyCaptain(): Promise<{ teamId: number } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('captain_session')?.value;
  if (!token) return null;
  const payload = verify(token, CAPTAIN_SESSION_SECRET);
  if (!payload) return null;
  try {
    const data = JSON.parse(payload);
    if (data.role === 'captain' && typeof data.teamId === 'number' && isFreshIat(data.iat)) {
      return { teamId: data.teamId };
    }
    return null;
  } catch {
    return null;
  }
}

export function generatePlayerToken(): string {
  return crypto.randomUUID();
}

export function signPlayerToken(playerId: number, teamId: number): string {
  return sign(JSON.stringify({ role: 'player', playerId, teamId, iat: Date.now() }), PLAYER_SESSION_SECRET);
}

// Lightweight token validation: returns user info if the bearer token matches a
// per-user plugin token, regardless of whether the user has an active event.
// Use this for endpoints that should succeed for any valid token (e.g. "is my
// token working?"). For endpoints that need an event/team/player row, use
// `verifyPluginToken` which additionally resolves the active enrollment.
//
// Only the per-user account token (`users.plugin_token`) is accepted — legacy
// per-event `eventParticipants.player_token`s are no longer a plugin credential.
export async function verifyPluginTokenUser(
  request: Request,
): Promise<{ userId: number } | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  const user = await db.query.users.findFirst({ where: eq(users.pluginToken, token) });
  if (user) return { userId: user.id };
  return null;
}

// Upgrade a clan_member to plugin-verified when authenticated plugin play confirms
// the caller is logged into that (RSN-matched) account. Only ever upgrades: it sets
// verifiedAt/method/provisional and captures the accountHash anchor, but never
// re-attributes the row to another user (the caller already owns it) and never
// downgrades. No-ops when the row is already fully verified, so the common request
// does zero extra writes. Best-effort — failures (e.g. an accountHash uniqueness
// collision) are swallowed so plugin auth is never blocked by verification.
async function ensurePluginVerifiedOnPlay(
  member: { id: number; verifiedAt: string | null; provisional: number | null; accountHash: string | null },
  userId: number,
  accountHash: string | null,
  nowIso: string,
): Promise<void> {
  const needsVerify = member.verifiedAt == null || member.provisional === 1;
  const needsHash = !!accountHash && !member.accountHash;
  if (!needsVerify && !needsHash) return;

  try {
    await updateAccountOfSeat(member.id, {
      verifiedAt: member.verifiedAt ?? nowIso,
      verificationMethod: 'plugin',
      provisional: 0,
      accountHash: member.accountHash ?? accountHash,
    });
    await db
      .update(clanMemberships)
      .set({ lastSeenInClan: nowIso })
      .where(eq(clanMemberships.id, member.id));

    if (needsVerify) {
      db.insert(clanAuditLog)
        .values({
          clanMemberId: member.id,
          eventType: 'verified',
          newValue: JSON.stringify({
            method: 'plugin',
            via: 'play',
            accountHash: accountHash ?? member.accountHash ?? null,
          }),
          actorUserId: userId,
        })
        .catch(() => {});
    }
  } catch {
    // Verification is best-effort; a failure must not break the plugin request.
  }
}

// Apply an in-game rename detected during plugin play: the caller's stable account hash
// matched a clan_member whose stored RSN differs from the name they're logged in as. Mirrors
// the bookkeeping clan-sync/link already do — updates the display RSN, appends the old name to
// previousRsns, lifts the member out of the `unranked` park (a rename, not a ban, explains the
// old-name 404), writes a `renamed` audit row, and propagates into active weekly_participants so
// leaderboard tracking resumes on the new name. Best-effort: never blocks the plugin request.
//
// Guards the rsn_normalized uniqueness index: if a *different* active member already holds the
// new name (a phantom split an earlier name-only roster sync created), we leave the rows alone
// for the mod-gated suspected-renames → merge flow rather than throw on the update.
async function applyRenameOnPlay(
  memberId: number,
  oldRsn: string,
  newRsnRaw: string,
  userId: number,
  nowIso: string,
): Promise<void> {
  try {
    const newRsn = sanitizeRsn(newRsnRaw);
    const newNorm = normalizeRsn(newRsn);
    if (!newRsn || normalizeRsn(oldRsn) === newNorm) return;

    // Uniqueness guard — another live member already owns the new name → defer to merge.
    const clash = await findRosterSeat(and(eq(clanRoster.rsnNormalized, newNorm), isNull(clanRoster.leftAt)));
    if (clash && clash.id !== memberId) return;

    const member = await findRosterSeat(eq(clanRoster.id, memberId));
    if (!member) return;

    // Append the old name to the alias history (dedup by normalized form).
    let previous: string[] = [];
    if (member.previousRsns) {
      try {
        const parsed = JSON.parse(member.previousRsns);
        if (Array.isArray(parsed)) previous = parsed.filter((p): p is string => typeof p === 'string');
      } catch { /* ignore malformed */ }
    }
    if (member.rsn && !previous.some((p) => normalizeRsn(p) === normalizeRsn(member.rsn))) {
      previous.push(member.rsn);
    }

    await updateAccountOfSeat(memberId, {
      rsn: newRsn,
      rsnNormalized: newNorm,
      previousRsns: JSON.stringify(previous),
      // A detected rename proves the old-name hiscores 404 was a rename, not a ban — re-activate
      // so the weekly cron polls the new name again instead of waiting on the re-probe pass.
      status: member.status === 'unranked' ? 'active' : member.status,
    });
    await db
      .update(clanMemberships)
      .set({ lastSeenInClan: nowIso })
      .where(eq(clanMemberships.id, memberId));

    db.insert(clanAuditLog)
      .values({
        clanMemberId: memberId,
        eventType: 'renamed',
        oldValue: JSON.stringify({ rsn: oldRsn }),
        newValue: JSON.stringify({ rsn: newRsn }),
        notes: 'Detected via plugin play (accountHash matched)',
        actorUserId: userId,
      })
      .catch(() => {});

    // Propagate into active weekly comps (merge/rename participant rows). Dynamic import avoids a
    // static cycle — weekly.ts imports normalizeRsn/sanitizeRsn from this module.
    const { applyRenameToActiveWeeklyParticipants } = await import('@/lib/weekly');
    await applyRenameToActiveWeeklyParticipants(memberId, oldRsn, newRsn).catch(() => {});
  } catch {
    // Rename application is best-effort — a failure must not break the plugin request. The
    // suspected-renames → merge flow and the pendingRenames reviewer remain as backstops.
  }
}

// On authenticated plugin play, AUTO-ADD the account the token's user is on — no manual "Add" step,
// so a member installs the plugin, plays, and their accounts just appear. It's opt-OUT: they Remove
// anything they don't want (an alt/mule), which drops it into a sticky "Ignored" list they can re-add
// from — and once ignored it won't auto-re-add.
//
// SECURITY: we never auto-claim an ESTABLISHED identity (a verified account or a real in-game roster
// member) that was matched only by its public, forgeable RSN — that would let anyone with a plugin
// token claim a verified member by typing their name (potential role/attribution takeover). Such a
// match falls back to an opt-in suggestion so the real owner links it with hash proof (or an admin
// does). Hash-matched established rows are already handled by maybeAutoClaimEstablishedOnPlay before
// this runs. Everything else — a brand-new account, or the user's own unverified ghost row — is safe
// to auto-link (it's their own authenticated play; the worst case is squatting a fresh name, which is
// reversible and already possible via the old play+Add path). Best-effort — never blocks plugin auth.
async function autoLinkOrSuggestOnPlay(
  clanId: number,
  userId: number,
  rsn: string,
  normalizedRsn: string,
  accountHash: string | null,
  nowIso: string,
): Promise<void> {
  try {
    const byHash = accountHash
      ? (await findRosterSeat(eq(clanRoster.accountHash, accountHash))) ?? null
      : null;
    const byRsn =
      (await findRosterSeat(eq(clanRoster.rsnNormalized, normalizedRsn))) ?? null;
    const existing = byHash ?? byRsn;

    // Owned already — theirs (linked) or someone else's (not ours to touch). Nothing to auto-add.
    if (existing?.playerId != null) return;

    // Minimal guard: ONLY a row carrying a pre-assigned role stays opt-in when matched by name alone,
    // so nobody can auto-grant themselves admin/mod by typing a member's public RSN. Every other
    // account auto-links — a wrong link is low-stakes and admin-reversible (and admins can fix links
    // directly from the roster). Surface the guarded case as an opt-in suggestion instead.
    if (existing?.pendingRole && !byHash) {
      const suggestion = await db.query.detectedAccounts.findFirst({
        where: and(eq(detectedAccounts.userId, userId), eq(detectedAccounts.rsnNormalized, normalizedRsn)),
      });
      if (suggestion) {
        await db
          .update(detectedAccounts)
          .set({ lastSeenAt: nowIso, rsn, accountHash: accountHash ?? suggestion.accountHash })
          .where(eq(detectedAccounts.id, suggestion.id));
      } else {
        await db.insert(detectedAccounts).values({
          userId, rsn, rsnNormalized: normalizedRsn, accountHash: accountHash ?? null,
          status: 'pending', detectedAt: nowIso, lastSeenAt: nowIso,
        });
      }
      return;
    }

    // Honour a prior Remove/Ignore: don't auto-re-add an account the user chose to hide.
    const ignored = await db.query.detectedAccounts.findFirst({
      where: and(
        eq(detectedAccounts.userId, userId),
        eq(detectedAccounts.rsnNormalized, normalizedRsn),
        eq(detectedAccounts.status, 'dismissed'),
      ),
    });
    if (ignored) {
      await db.update(detectedAccounts).set({ lastSeenAt: nowIso, rsn }).where(eq(detectedAccounts.id, ignored.id));
      return;
    }

    // Safe to auto-link: a brand-new account, the user's own unverified ghost, or a hash match.
    let clanMemberId: number;
    if (existing) {
      // Ownership and proof belong to the account; where they sit and when we last saw them belong
      // to the seat.
      await db
        .update(accounts)
        .set({
          playerId: userId,
          accountHash: existing.accountHash ?? accountHash,
          verifiedAt: existing.verifiedAt ?? nowIso,
          verificationMethod: 'plugin',
          provisional: 0,
          claimedAt: existing.claimedAt ?? nowIso,
        })
        // Re-assert unowned so a concurrent claim wins cleanly.
        .where(and(eq(accounts.id, existing.accountId), isNull(accounts.playerId)));
      await db
        .update(clanMemberships)
        .set({
          source: existing.source === 'admin' ? 'admin' : 'application',
          leftAt: existing.source === 'admin' ? existing.leftAt : null,
          lastSeenInClan: nowIso,
        })
        .where(eq(clanMemberships.id, existing.id));
      clanMemberId = existing.id;
    } else {
      const account = await findOrCreateAccount({ rsn, rsnNormalized: normalizedRsn, accountHash });
      await db
        .update(accounts)
        .set({
          playerId: userId,
          verifiedAt: nowIso,
          verificationMethod: 'plugin',
          provisional: 0,
          claimedAt: nowIso,
        })
        .where(eq(accounts.id, account.id));
      // Guest: verification proves ownership of the account, not membership of the clan. Only the
      // in-game roster sync promotes a seat to 'member'.
      clanMemberId = await findOrCreateSeat(clanId, account.id, { kind: 'guest' });
      await db
        .update(clanMemberships)
        .set({ lastSeenInClan: nowIso })
        .where(eq(clanMemberships.id, clanMemberId));
    }
    db.insert(clanAuditLog)
      .values({
        clanMemberId,
        eventType: 'claimed',
        newValue: JSON.stringify({ userId, via: 'plugin-play-autolink', method: 'plugin' }),
        actorUserId: userId,
      })
      .catch(() => {});
    // Character now has an owner: adopt its guest sign-ups.
    await onCharacterLinked(clanMemberId, userId);
  } catch {
    // Best-effort — a failure must not break plugin auth.
  }
}

// Re-attach an established account the caller is CRYPTOGRAPHICALLY proven to control. We match ONLY
// by the account hash already anchored on the row — never by RSN. A display name is public and the
// X-Account-Hash header is attacker-controllable from a modified client, so an RSN match is not proof
// of control; auto-claiming on it would let anyone with a plugin token forge `currentRsn = <victim>`
// and steal any unowned verified/roster account (incl. one carrying a pendingRole). Matching on an
// already-anchored hash is safe: an attacker can't produce a hash that's already stored against a
// specific row unless they actually control that account.
//
// This covers the legitimate re-link case (e.g. an account whose verification was revoked kept its
// hash, or a split left an unowned row that still carries the real hash). Accounts with NO anchored
// hash — a manually-verified member who never played — are intentionally left to the opt-in
// detected-accounts "Add" flow, whose suggestion is generated from the user's OWN real play and is
// therefore trustworthy. Audit-logged and admin-reversible. Best-effort: never blocks plugin auth.
async function maybeAutoClaimEstablishedOnPlay(
  userId: number,
  accountHash: string,
  nowIso: string,
): Promise<void> {
  try {
    const existing = await findRosterSeat(eq(clanRoster.accountHash, accountHash));
    if (!existing) return; // no row anchored to this hash — opt-in flow handles the rest
    if (existing.playerId != null) return; // already owned (theirs or someone else's) — never steal
    // Only an ESTABLISHED identity auto-links: a verified account, or a real in-game roster member.
    if (existing.verifiedAt == null && existing.kind !== 'member') return;

    const result = await db
      .update(accounts)
      .set({
        playerId: userId,
        verifiedAt: existing.verifiedAt ?? nowIso,
        verificationMethod: 'plugin',
        provisional: 0,
        claimedAt: existing.claimedAt ?? nowIso,
      })
      // Re-assert unowned in the WHERE so a concurrent claim wins cleanly instead of being clobbered.
      // On the ACCOUNT, which is where ownership lives — guarding the seat would not be a guard at
      // all, since two clans' seats over one account could each pass it.
      .where(and(eq(accounts.id, existing.accountId), isNull(accounts.playerId)))
      // Row COUNT is the guard, and it has to be read portably: the driver-specific field this used
      // to read (rowsAffected) is absent on other drivers and came back undefined, which compiled
      // fine and silently disabled the check.
      .returning({ id: clanRoster.id });

    if (result.length === 0) return;

    db.insert(clanAuditLog)
      .values({
        clanMemberId: existing.id,
        eventType: 'claimed',
        newValue: JSON.stringify({ userId, via: 'plugin-play', method: 'plugin', accountHash }),
        actorUserId: userId,
      })
      .catch(() => {});
    // Character now has an owner: adopt its guest sign-ups.
    await onCharacterLinked(existing.id, userId);
  } catch {
    // Best-effort — a failure must not break plugin auth.
  }
}

// Attribute a RuneScape account to a user — the explicit opt-in "Add" action behind a
// detected-accounts suggestion (or any server-side claim). Mirrors /api/plugin/link:
// match an existing clan_member by accountHash (strongest, survives renames) then by
// rsnNormalized (ghosts / roster rows):
//   • already owned by this user → no-op success (idempotent);
//   • owned by a different user  → refused (never steals);
//   • unowned ghost              → claim it (userId) + plugin-verify;
//   • no row at all              → create one, owned + plugin-verified.
// The first account a user attributes becomes their primary. Returns the outcome so the
// caller can surface a 409 on a cross-user conflict.
export async function claimAccountForUser(
  clanId: number,
  userId: number,
  rsn: string,
  normalizedRsn: string,
  accountHash: string | null,
): Promise<{ ok: true; clanMemberId: number } | { ok: false; reason: 'owned-by-other' | 'needs-verification' }> {
  const nowIso = new Date().toISOString();

  // Match by account hash first — the strong, rename-proof, UNFORGEABLE signal (an attacker can't
  // produce another player's Jagex account hash). The RSN lookup only tells us whether a row
  // already exists; on its own it proves nothing about who controls the account.
  const byHash = accountHash
    ? (await findRosterSeat(eq(clanRoster.accountHash, accountHash))) ?? null
    : null;
  const byRsn =
    (await findRosterSeat(eq(clanRoster.rsnNormalized, normalizedRsn))) ?? null;
  const existing = byHash ?? byRsn;

  if (existing?.playerId != null) {
    if (existing.playerId === userId) return { ok: true, clanMemberId: existing.id };
    return { ok: false, reason: 'owned-by-other' };
  }

  // A row carrying a PRE-ASSIGNED ROLE must be claimed with real proof — a hash match, or the
  // explicit XP/link-code check — never by a forgeable name alone. Otherwise typing a member's
  // public RSN could hand their pending admin/mod role to a stranger. This is the one guard we keep
  // strict; everything else auto-links freely.
  if (existing && existing.pendingRole && !byHash) {
    return { ok: false, reason: 'needs-verification' };
  }

  // Trust the account hash as proof of control: it's a per-account secret you only get by being
  // logged into the account in-game, so a hash captured during authenticated plugin play is enough
  // to attach even an established identity (roster member / verified row) one-click. We only fall
  // back to the XP-drop / link-code check when there's NO hash to trust at all AND the target is an
  // established identity — e.g. linking from the website with no plugin session behind it. A guest
  // row (isGuest=1, unverified) is a plugin-ping artifact — usually the claimer's own account — so
  // it attaches even without a hash.
  //
  // Residual risk (accepted): a *modified* client can put any hash on the wire, so a member willing
  // to mod their plugin — or someone with a leaked account hash — could claim a member who has
  // never played (no hash anchored yet). It's audit-logged and admin-reversible, and once a member
  // has played once their real hash is anchored, after which only that hash (or the owner) matches.
  if (existing && !byHash && !accountHash && (existing.kind === 'member' || existing.verifiedAt != null)) {
    return { ok: false, reason: 'needs-verification' };
  }

  let clanMemberId: number;
  if (existing) {
    // Unowned ghost → claim + verify. Ownership and proof are account facts.
    await db
      .update(accounts)
      .set({
        playerId: userId,
        accountHash: accountHash ?? existing.accountHash,
        verifiedAt: existing.verifiedAt ?? nowIso,
        verificationMethod: 'plugin',
        provisional: 0,
        claimedAt: existing.claimedAt ?? nowIso,
      })
      .where(eq(accounts.id, existing.accountId));
    await db
      .update(clanMemberships)
      .set({
        source: existing.source === 'admin' ? 'admin' : 'application',
        // A previously-left ghost that's now linking is treated as returned; admin
        // removals stay marked-left (a decision we don't override).
        leftAt: existing.source === 'admin' ? existing.leftAt : null,
        lastSeenInClan: nowIso,
      })
      .where(eq(clanMemberships.id, existing.id));
    clanMemberId = existing.id;
  } else {
    // Nothing anywhere → an account, owned + verified, and a seat to put it in.
    const account = await findOrCreateAccount({ rsn, rsnNormalized: normalizedRsn, accountHash });
    await db
      .update(accounts)
      .set({
        playerId: userId,
        verifiedAt: nowIso,
        verificationMethod: 'plugin',
        provisional: 0,
        claimedAt: nowIso,
        isPrimary: 0,
      })
      .where(eq(accounts.id, account.id));
    // Verification proves account ownership, not clan membership. Seated as a guest; only the
    // in-game roster sync promotes a seat to 'member'.
    clanMemberId = await findOrCreateSeat(clanId, account.id, { kind: 'guest' });
    await db
      .update(clanMemberships)
      .set({ lastSeenInClan: nowIso })
      .where(eq(clanMemberships.id, clanMemberId));
  }

  db.insert(clanAuditLog)
    .values({
      clanMemberId,
      eventType: 'claimed',
      newValue: JSON.stringify({ userId, via: 'opt-in', method: 'plugin', accountHash: accountHash ?? null, rsn }),
      actorUserId: userId,
    })
    .catch(() => {});

  // First account a user attributes becomes their primary.
  const owned = await findRosterSeats(and(eq(clanRoster.playerId, userId), isNull(clanRoster.leftAt)));
  if (owned.length > 0 && !owned.some((a) => a.isPrimary === 1)) {
    await db.update(accounts).set({ isPrimary: 1 }).where(eq(clanMemberships.id, clanMemberId));
  }

  // Now that the account is attributed to a Discord-authenticated user, apply any
  // pre-assigned pending role and sync Discord roles. Both fire-and-forget; the dynamic
  // import on discord-roles avoids a static import cycle (it imports normalizeRsn here).
  applyPendingRole(clanMemberId, userId, 'plugin').catch(() => {});
  import('@/lib/discord-roles')
    .then((m) => m.syncRolesForClanMemberFireAndForget(clanMemberId))
    .catch(() => {});
  // Character now has an owner: adopt its guest sign-ups.
  onCharacterLinked(clanMemberId, userId).catch(() => {});

  return { ok: true, clanMemberId };
}

// Plugin identity: resolve which of a caller's owned clan_members they're logged into, from an
// Authorization: Bearer header — WITHOUT requiring a live bingo event. This is the shared identity
// core: `verifyPluginToken` layers event resolution on top, and the live-stats ingest credits weekly
// SOTW/BOTW by clan member even when the caller isn't in any bingo.
//
// Only the **per-user account token** (`users.plugin_token`) is accepted; legacy per-event
// `eventParticipants.player_token`s are not a plugin credential. `currentRsn` (header `X-RSN`, fallback
// `?rsn=`) is the in-game name reported by the client; it scopes resolution to the matching
// clan_member — the check that blocks "a drop on the wrong account credits the right account" (the
// multi-RSN-on-one-Jagex problem). The optional `X-Account-Hash` is the rename-proof anchor.
//
// Side effects (same as before, all best-effort): hash-only auto-claim of an established owned row,
// opt-in detection of an unowned reported account, rename-on-play, and plugin auto-verify (a
// confirmed RSN match proves account control, so an unverified/provisional row is upgraded — no
// separate link-code dance).
//
// Returns null when: the token is invalid, the user owns no members, NO RSN hint was sent (we can't
// tell which of the user's accounts is logged in, so we must not guess), or the reported account
// isn't on this user's roster.
export async function resolvePluginMember(
  request: Request
): Promise<{ userId: number; clanMemberId: number; rsn: string } | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  // Pull the RSN hint from header (preferred), then ?rsn= query param.
  let currentRsn = request.headers.get('X-RSN')?.trim() || null;
  if (!currentRsn) {
    try { currentRsn = new URL(request.url).searchParams.get('rsn'); } catch { /* not a URL we can parse */ }
  }
  const normalizedRsn = currentRsn ? normalizeRsn(currentRsn) : null;

  // Stable Jagex identifier (client.getAccountHash()), captured for auto-verify so
  // a later in-game rename stays anchored to the same clan_member.
  const accountHash = request.headers.get('X-Account-Hash')?.trim() || null;

  const user = await db.query.users.findFirst({ where: eq(users.pluginToken, token) });
  if (!user) return null;

  // Which clan is this plugin talking to? The token identifies the PERSON; the Host identifies the
  // clan, and a member row belongs to the pair. A request whose host names no clan cannot resolve a
  // member, because there is no roster to resolve against.
  const clan = await resolveClanFromRequest(request);
  if (!clan) return null;

  const nowIso = new Date().toISOString();

  // Re-link an established account this caller cryptographically controls: if the (unforgeable)
  // account hash is already anchored to an unowned verified/roster row, attach it to them now, so
  // the freshly-claimed row flows through the normal owned-rows path below. Deliberately hash-only
  // — an RSN is public and not proof of control (see helper); RSN-only accounts stay on the opt-in
  // "Add" flow.
  if (accountHash) {
    await maybeAutoClaimEstablishedOnPlay(user.id, accountHash, nowIso);
  }

  // Auto-add the account they're on (opt-out): safe cases link immediately, the forge-risky
  // established-by-RSN case falls back to an opt-in suggestion. Needs the RSN to know which account.
  if (currentRsn && normalizedRsn) {
    await autoLinkOrSuggestOnPlay(clan.id, user.id, currentRsn.trim(), normalizedRsn, accountHash, nowIso);
  }

  const memberRows = await db
    .select({
      id: clanRoster.id,
      rsn: clanRoster.rsn,
      rsnNormalized: clanRoster.rsnNormalized,
      previousRsns: clanRoster.previousRsns,
      verifiedAt: clanRoster.verifiedAt,
      provisional: clanRoster.provisional,
      accountHash: clanRoster.accountHash,
    })
    .from(clanRoster)
    .where(and(eq(clanRoster.playerId, user.id), isNull(clanRoster.leftAt)));
  if (memberRows.length === 0) return null;

  // No RSN hint — we can't tell which of the user's accounts is logged in, so we must NOT guess.
  // Guessing would serve one account's bingo config / auto-submit scope (and now weekly credit) to
  // the user's OTHER accounts on the same token. The plugin re-calls with the RSN once it's stamped
  // after login.
  if (!currentRsn || !normalizedRsn) return null;

  // Build a per-member set of every RSN that's ever been theirs — covers in-game
  // renames where the plugin reports the new name before the next /hello sync has
  // had a chance to update clan_members.
  const memberRsnSets = new Map<number, Set<string>>(
    memberRows.map((m) => {
      const aliases = new Set<string>([m.rsnNormalized]);
      if (m.previousRsns) {
        try {
          const arr = JSON.parse(m.previousRsns);
          if (Array.isArray(arr)) {
            for (const prev of arr) {
              if (typeof prev === 'string') aliases.add(normalizeRsn(prev));
            }
          }
        } catch { /* ignore malformed */ }
      }
      return [m.id, aliases];
    }),
  );

  // Hash-FIRST identity. The account hash is the stable, unforgeable, rename-proof anchor, so when
  // the client sends one we match on it BEFORE the (mutable, public) RSN. This makes an in-game
  // rename a non-event: the member resolves by hash and we record the new name, instead of the play
  // 401-parking tracking (unknown RSN) until a roster sync or rename request happens to fix the
  // stored name. RSN is only the fallback for members whose hash isn't captured yet — linked via
  // XP/manual/link-code, or last seen on a pre-hash plugin build.
  let matchedMember: (typeof memberRows)[number] | null = null;
  let renamedFrom: string | null = null;
  if (accountHash) {
    const hashMatch = memberRows.find((m) => m.accountHash && m.accountHash === accountHash) ?? null;
    if (hashMatch) {
      matchedMember = hashMatch;
      // Same account (proven by hash), different stored name → they renamed. Record it so the
      // display RSN + previousRsns alias set catch up; applyRenameOnPlay guards the RSN-unique
      // index and defers to the mod merge flow if another row already holds the new name.
      if (hashMatch.rsnNormalized !== normalizedRsn) {
        renamedFrom = hashMatch.rsn;
      }
    }
  }
  // No hash anchor yet (or none sent) — fall back to the RSN alias set (current name or a previously
  // recorded one). Once this play anchors the hash (below), future renames resolve hash-first.
  if (!matchedMember) {
    matchedMember = memberRows.find((m) => memberRsnSets.get(m.id)?.has(normalizedRsn)) ?? null;
  }
  if (!matchedMember) return null; // current account isn't on this user's roster (by hash or name)
  if (renamedFrom) {
    await applyRenameOnPlay(matchedMember.id, renamedFrom, currentRsn.trim(), user.id, nowIso);
  }
  // A confirmed RSN match means the caller is logged into an account they own — proof enough to
  // verify it, enrolled anywhere or not. Best-effort: never blocks, no-ops once verified + anchored.
  await ensurePluginVerifiedOnPlay(matchedMember, user.id, accountHash, nowIso);

  return { userId: user.id, clanMemberId: matchedMember.id, rsn: currentRsn.trim() };
}

// Plugin auth for event-scoped actions: resolve the active player row from the account token.
// Delegates identity to `resolvePluginMember`, then layers on live-event resolution. Returns null
// when the token is invalid, no RSN was sent, the account isn't on the roster, OR the caller has no
// active event enrollment. Callers that need to distinguish "no event" from "bad token" layer
// `verifyPluginTokenUser` on top.
export async function verifyPluginToken(
  request: Request
): Promise<{ playerId: number; teamId: number; eventId: number; userId: number | null; rsn: string } | null> {
  const member = await resolvePluginMember(request);
  if (!member) return null;

  const nowIso = new Date().toISOString();
  const playerRows = await db
    .select({
      id: eventParticipants.id,
      name: eventParticipants.name,
      teamId: eventParticipants.teamId,
      eventId: eventParticipants.eventId,
      startDate: events.startDate,
      endDate: events.endDate,
      forceEndedAt: events.forceEndedAt,
    })
    .from(eventParticipants)
    .innerJoin(events, eq(eventParticipants.eventId, events.id))
    .where(eq(eventParticipants.clanMemberId, member.clanMemberId));

  // A member in two concurrent events resolves to ONE — the plugin scopes to a single active event
  // (until the multi-enrollment rework lands). The pick is DETERMINISTIC, not row order: events
  // already RUNNING beat upcoming ones the member is merely pre-drafted into, and among running
  // events the latest start wins (the freshest board is almost always the one being played).
  const candidates = playerRows.filter(
    (p) => p.teamId && !p.forceEndedAt && (!p.endDate || p.endDate > nowIso),
  );
  const started = (p: (typeof candidates)[number]) => !!p.startDate && p.startDate <= nowIso;
  candidates.sort((a, b) => {
    if (started(a) !== started(b)) return started(a) ? -1 : 1;
    return (b.startDate ?? '').localeCompare(a.startDate ?? '');
  });
  const pick = candidates[0];
  if (!pick) return null;

  return {
    playerId: pick.id,
    teamId: pick.teamId!,
    eventId: pick.eventId,
    userId: member.userId,
    rsn: pick.name,
  };
}

// Authenticates admin-only plugin actions like clan-sync. There is no separate
// admin-linked token to manage anymore: an admin simply uses their single per-user
// account token (`users.plugin_token`), and authority comes from their *site* role.
//
// Transition: a legacy dedicated admin link token (`pluginLinks`) is still accepted so
// existing installs keep working until they switch to sending the account token. Drop
// that fallback once every install has migrated.
export async function verifyAdminPluginToken(
  request: Request
): Promise<{ userId: number } | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  // Preferred: the per-user account token, authorized by the user's admin role.
  const user = await db.query.users.findFirst({ where: eq(users.pluginToken, token) });
  if (user) return user.role === 'admin' ? { userId: user.id } : null;

  // Legacy: dedicated admin link token. Temporary back-compat during the cutover.
  const link = await db.query.pluginLinks.findFirst({
    where: and(eq(pluginLinks.token, token), isNull(pluginLinks.revokedAt)),
  });
  if (!link) return null;

  // Re-check the linked user's CURRENT role — a legacy admin token must stop granting admin power
  // the moment the user is demoted, matching the account-token path above.
  const linkUser = await db.query.users.findFirst({
    where: eq(users.id, link.userId),
    columns: { id: true, role: true },
  });
  if (linkUser?.role !== 'admin') return null;

  // Fire-and-forget lastUsedAt bump — ok if it races
  db.update(pluginLinks)
    .set({ lastUsedAt: new Date().toISOString() })
    .where(eq(pluginLinks.id, link.id))
    .catch(() => {});

  return { userId: link.userId };
}

export function generatePluginLinkCode(): string {
  // 6 chars from an unambiguous alphabet (no 0/O/1/I/L)
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  let out = '';
  for (let i = 0; i < 6; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function generateAdminPluginToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function normalizeRsn(rsn: string): string {
  // OSRS treats space and underscore as the same character in a name: display names
  // render with spaces, but logins, hiscores lookups, and older/manually-entered rows
  // use underscores. Collapse both to a single space so "GIM_nisbro" and "GIM Nisbro"
  // normalize identically — otherwise a roster sync sees them as two different accounts
  // and reports one "left" + one "joined" for what is really the same person.
  // NOTE: existing rsn_normalized columns must be backfilled when this changes —
  // see scripts/backfill-rsn-normalized.ts.
  return rsn.trim().toLowerCase().replace(/[\s_]+/g, ' ');
}

/**
 * Display-side cleanup for an RSN: collapses any Unicode whitespace (notably U+00A0
 * non-breaking space, which is how OSRS in-game names encode their spaces to avoid
 * line-wrap) to ASCII space and trims edges. Preserves casing.
 *
 * Why this matters: the OSRS Hiscores library validates with /^[a-zA-Z0-9 _-]+$/,
 * which only accepts 0x20 — an NBSP-bearing RSN throws "RSN contains invalid character"
 * before the HTTP request goes out. Use this at every site that writes an RSN into a
 * column we'll later feed to Hiscores, and at the read site as defense in depth.
 */
export function sanitizeRsn(rsn: string): string {
  return rsn.replace(/\s+/g, ' ').trim();
}

/**
 * Could this string be an actual OSRS account name? Jagex allows 1-12 characters of letters, digits,
 * space, underscore and hyphen — nothing else.
 *
 * This exists because RuneLite hands us placeholders for clan members it can't resolve a name for
 * ("#Player1404"), and sanitizeRsn only collapses whitespace, so they were being stored as real
 * members: guest, unranked, permanently statless, and cluttering every roster view. A name with a
 * `#` in it can never be looked up on the hiscores, so there is nothing to gain by keeping it.
 */
export function isPlausibleRsn(rsn: string): boolean {
  return /^[A-Za-z0-9 _-]{1,12}$/.test(rsn);
}

export async function verifyPlayer(): Promise<{ playerId: number; teamId: number } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('player_session')?.value;
  if (!token) return null;
  const payload = verify(token, PLAYER_SESSION_SECRET);
  if (!payload) return null;
  try {
    const data = JSON.parse(payload);
    if (data.role === 'player' && typeof data.playerId === 'number' && typeof data.teamId === 'number' && isFreshIat(data.iat)) {
      return { playerId: data.playerId, teamId: data.teamId };
    }
    return null;
  } catch {
    return null;
  }
}
