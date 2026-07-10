import { cookies } from 'next/headers';
import crypto from 'crypto';
import { db } from '@/db';
import { clanAuditLog, clanMembers, detectedAccounts, events, players, pluginLinks, teams, users } from '@/db/schema';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { requireSecret } from '@/lib/env';
import { applyPendingRole } from '@/lib/pending-role';

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

export function signUserToken(userId: number, username: string, role: string): string {
  return sign(JSON.stringify({ userId, username, role, iat: Date.now() }), ADMIN_SESSION_SECRET);
}

export function signCaptainToken(teamId: number): string {
  return sign(JSON.stringify({ role: 'captain', teamId, iat: Date.now() }), CAPTAIN_SESSION_SECRET);
}

export interface UserPayload {
  userId: number;
  username: string;
  role: string;
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
      columns: { id: true, role: true },
    });
    if (!dbUser) return null;
    return { userId: dbUser.id, username: typeof data.username === 'string' ? data.username : 'user', role: dbUser.role };
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
  // Treasurers and editors do everything moderators can; this gate accepts all mod-tier roles.
  if (user.role === 'admin' || user.role === 'treasurer' || user.role === 'moderator' || user.role === 'editor') {
    return user;
  }
  return null;
}

// Bingo-authoring gate. Editors are moderators who can additionally build/edit an event's tiles
// (the Quick Build grid, CSV import, per-tile config, add/remove tiles). They cannot create events,
// or manage teams/signups/players/fees — those stay admin-only. Admins pass too.
export async function verifyTileEditor(): Promise<UserPayload | null> {
  const user = await verifyUser();
  if (!user) return null;
  if (user.role === 'admin' || user.role === 'editor') return user;
  return null;
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
    .select({ id: clanMembers.id })
    .from(clanMembers)
    .where(and(eq(clanMembers.userId, user.userId), isNull(clanMembers.leftAt)));
  if (myMembers.length > 0) {
    const memberIds = myMembers.map((m) => m.id);
    const playerRow = await db.query.players.findFirst({
      where: and(
        eq(players.eventId, eventId),
        eq(players.teamId, teamId),
        inArray(players.clanMemberId, memberIds),
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
// per-event `players.player_token`s are no longer a plugin credential.
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
    await db
      .update(clanMembers)
      .set({
        verifiedAt: member.verifiedAt ?? nowIso,
        verificationMethod: 'plugin',
        provisional: 0,
        accountHash: member.accountHash ?? accountHash,
        lastSeenInClan: nowIso,
      })
      .where(eq(clanMembers.id, member.id));

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
    const clash = await db.query.clanMembers.findFirst({
      where: and(eq(clanMembers.rsnNormalized, newNorm), isNull(clanMembers.leftAt)),
    });
    if (clash && clash.id !== memberId) return;

    const member = await db.query.clanMembers.findFirst({ where: eq(clanMembers.id, memberId) });
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

    await db
      .update(clanMembers)
      .set({
        rsn: newRsn,
        rsnNormalized: newNorm,
        previousRsns: JSON.stringify(previous),
        // A detected rename proves the old-name hiscores 404 was a rename, not a ban — re-activate
        // so the weekly cron polls the new name again instead of waiting on the re-probe pass.
        status: member.status === 'unranked' ? 'active' : member.status,
        lastSeenInClan: nowIso,
      })
      .where(eq(clanMembers.id, memberId));

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

// Record a plugin-detected account as an opt-in suggestion on play. We do NOT auto-claim:
// a member may run several accounts (alts, irons, mules) through one RuneLite install and
// only wants some attached to their public profile. So when the token's user plays an
// account that isn't already owned by anyone, we drop a row in `detected_accounts` for them
// to Add or Ignore from /profile. Already-owned accounts (theirs or someone else's) are
// skipped — the caller's `ensurePluginVerifiedOnPlay` handles verifying their own.
//
// A previously Ignored account stays 'dismissed' (we never bump it back to 'pending'), so
// opting out sticks. Best-effort — never blocks plugin auth.
async function ensureAccountDetectedOnPlay(
  userId: number,
  rsn: string,
  normalizedRsn: string,
  accountHash: string | null,
  nowIso: string,
): Promise<void> {
  try {
    // Match any existing clan_member by accountHash (rename-proof) or RSN. If it's owned by
    // anyone, there's nothing to suggest — owned-by-them is already linked, owned-by-someone-
    // -else is not theirs to claim.
    const matchCond = accountHash
      ? or(eq(clanMembers.accountHash, accountHash), eq(clanMembers.rsnNormalized, normalizedRsn))
      : eq(clanMembers.rsnNormalized, normalizedRsn);
    const member = await db.query.clanMembers.findFirst({ where: matchCond });
    if (member && member.userId != null) return;

    const existing = await db.query.detectedAccounts.findFirst({
      where: and(eq(detectedAccounts.userId, userId), eq(detectedAccounts.rsnNormalized, normalizedRsn)),
    });
    if (existing) {
      // Keep an Ignore sticky; just refresh recency + the latest casing/hash otherwise.
      await db
        .update(detectedAccounts)
        .set({ lastSeenAt: nowIso, rsn, accountHash: accountHash ?? existing.accountHash })
        .where(eq(detectedAccounts.id, existing.id));
    } else {
      await db.insert(detectedAccounts).values({
        userId,
        rsn,
        rsnNormalized: normalizedRsn,
        accountHash: accountHash ?? null,
        status: 'pending',
        detectedAt: nowIso,
        lastSeenAt: nowIso,
      });
    }
  } catch {
    // Detection is best-effort — never block plugin auth on it.
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
    ? (await db.query.clanMembers.findFirst({ where: eq(clanMembers.accountHash, accountHash) })) ?? null
    : null;
  const byRsn =
    (await db.query.clanMembers.findFirst({ where: eq(clanMembers.rsnNormalized, normalizedRsn) })) ?? null;
  const existing = byHash ?? byRsn;

  if (existing?.userId != null) {
    if (existing.userId === userId) return { ok: true, clanMemberId: existing.id };
    return { ok: false, reason: 'owned-by-other' };
  }

  // SECURITY: the only caller (detected-accounts "Add") proves account control solely with the
  // RSN the plugin reported via the client-controlled `X-RSN` header — which is forgeable. When a
  // pre-existing row is matched by RSN alone (not the unforgeable account hash), scope the extra
  // proof to ESTABLISHED identities: a roster member (isGuest=0, synced from the in-game clan or
  // admin-added) or an already-verified row. Those carry rank / history and must not be seizable
  // by simply naming them, so they require XP stat-delta or the in-plugin link code. A transient
  // guest row (isGuest=1, unverified) is just a plugin-ping artifact — almost always the claimer's
  // own account auto-registered on first-time play — so let it attach one-click.
  if (existing && !byHash && (existing.isGuest === 0 || existing.verifiedAt != null)) {
    return { ok: false, reason: 'needs-verification' };
  }

  let clanMemberId: number;
  if (existing) {
    // Unowned ghost → claim + verify.
    await db
      .update(clanMembers)
      .set({
        userId,
        accountHash: accountHash ?? existing.accountHash,
        verifiedAt: existing.verifiedAt ?? nowIso,
        verificationMethod: 'plugin',
        provisional: 0,
        source: existing.source === 'manual' ? 'manual' : 'plugin-self',
        claimedAt: existing.claimedAt ?? nowIso,
        // A previously-left ghost that's now linking is treated as returned; manual
        // removals stay marked-left (an admin decision we don't override).
        leftAt: existing.source === 'manual' ? existing.leftAt : null,
        lastSeenInClan: nowIso,
      })
      .where(eq(clanMembers.id, existing.id));
    clanMemberId = existing.id;
  } else {
    // No row anywhere → create one, owned + verified.
    const inserted = await db
      .insert(clanMembers)
      .values({
        rsn,
        rsnNormalized: normalizedRsn,
        accountHash: accountHash ?? null,
        source: 'plugin-self',
        // Verification proves account ownership, not clan membership. Start as a guest;
        // clan-sync promotes to member (isGuest=0) only when the in-game roster includes them.
        isGuest: 1,
        userId,
        verifiedAt: nowIso,
        verificationMethod: 'plugin',
        provisional: 0,
        claimedAt: nowIso,
        isPrimary: 0,
        lastSeenInClan: nowIso,
      })
      .returning({ id: clanMembers.id });
    clanMemberId = inserted[0].id;
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
  const owned = await db.query.clanMembers.findMany({
    where: and(eq(clanMembers.userId, userId), isNull(clanMembers.leftAt)),
    columns: { id: true, isPrimary: true },
  });
  if (owned.length > 0 && !owned.some((a) => a.isPrimary === 1)) {
    await db.update(clanMembers).set({ isPrimary: 1 }).where(eq(clanMembers.id, clanMemberId));
  }

  // Now that the account is attributed to a Discord-authenticated user, apply any
  // pre-assigned pending role and sync Discord roles. Both fire-and-forget; the dynamic
  // import on discord-roles avoids a static import cycle (it imports normalizeRsn here).
  applyPendingRole(clanMemberId, userId, 'plugin').catch(() => {});
  import('@/lib/discord-roles')
    .then((m) => m.syncRolesForClanMemberFireAndForget(clanMemberId))
    .catch(() => {});

  return { ok: true, clanMemberId };
}

// Plugin auth: resolve the active player row from an Authorization: Bearer header.
//
// Only the **per-user account token** (`users.plugin_token`) is accepted. It is
// long-lived and configured once; the active event/team/player row is resolved
// server-side from the caller's `clan_members` and the in-game RSN they pass on
// each call. (Legacy per-event `players.player_token`s are no longer a plugin
// credential — see the trailing comment.)
//
// `currentRsn` (header `X-RSN`, fallback `?rsn=`) is the in-game name reported by
// the client. When provided it scopes the resolution to the matching clan_member,
// which is what blocks "a drop on the wrong account credits the right account"
// (the multi-RSN-on-one-Jagex problem). When omitted, the resolver picks any
// active-event player row owned by the user — convenient but loses that check.
//
// Auto-verify on play: when the RSN matches one of the user's own clan_members,
// that's proof the caller controls the account, so an unverified/provisional row
// is upgraded to verified (`verificationMethod: 'plugin'`). The optional
// `X-Account-Hash` header is captured as the rename-proof identity anchor. This
// makes normal plugin play a verification path — no separate link-code dance.
//
// Returns null when the token is invalid OR when the token is valid but the
// caller has no active event enrollment. Callers that need to distinguish these
// cases should layer `verifyPluginTokenUser` on top.
export async function verifyPluginToken(
  request: Request
): Promise<{ playerId: number; teamId: number; eventId: number; userId: number | null; rsn: string } | null> {
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

  // Path 1 — per-user plugin token.
  const user = await db.query.users.findFirst({ where: eq(users.pluginToken, token) });
  if (user) {
    const nowIso = new Date().toISOString();

    // Opt-in attribution: when the reported in-game account isn't owned by anyone, record a
    // suggestion the user can Add/Ignore from /profile rather than auto-claiming it (a member
    // may run alts/irons/mules through one install and only want some attached). Already-owned
    // accounts are skipped here and verified below by ensurePluginVerifiedOnPlay. Needs the RSN
    // to know which account they're on.
    if (currentRsn && normalizedRsn) {
      await ensureAccountDetectedOnPlay(user.id, currentRsn.trim(), normalizedRsn, accountHash, nowIso);
    }

    const memberRows = await db
      .select({
        id: clanMembers.id,
        rsn: clanMembers.rsn,
        rsnNormalized: clanMembers.rsnNormalized,
        previousRsns: clanMembers.previousRsns,
        verifiedAt: clanMembers.verifiedAt,
        provisional: clanMembers.provisional,
        accountHash: clanMembers.accountHash,
      })
      .from(clanMembers)
      .where(and(eq(clanMembers.userId, user.id), isNull(clanMembers.leftAt)));
    if (memberRows.length === 0) return null;

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

    // Resolve which of the user's members the caller is logged into (when they told us)
    // and capture it BEFORE event resolution: verification and the accountHash anchor
    // must not depend on a live-event enrollment, or the first authenticated hit outside
    // an event captures nothing and the "plugin play verifies the account" promise breaks.
    let matchedMember: typeof memberRows[number] | null = null;
    if (normalizedRsn) {
      // Caller told us their current RSN — match that clan_member (current name OR a previous alias).
      matchedMember =
        memberRows.find((m) => memberRsnSets.get(m.id)?.has(normalizedRsn)) ?? null;
      // Rename fallback: no name matched, but the stable account hash points at one of this
      // user's members whose stored name differs — they renamed to a name we haven't recorded
      // yet. Without this the play would 401 (unknown RSN) and the member's hiscores tracking
      // would 404-park forever until a roster sync or rename request happened to fix the name.
      // Record the rename now (best-effort) so it self-heals the moment they simply play.
      let renamedFrom: string | null = null;
      if (!matchedMember && accountHash) {
        const hashMatch = memberRows.find((m) => m.accountHash && m.accountHash === accountHash);
        if (hashMatch && hashMatch.rsnNormalized !== normalizedRsn) {
          matchedMember = hashMatch;
          renamedFrom = hashMatch.rsn;
        }
      }
      if (!matchedMember) return null; // current account isn't on this user's roster
      if (renamedFrom && currentRsn) {
        await applyRenameOnPlay(matchedMember.id, renamedFrom, currentRsn.trim(), user.id, nowIso);
      }
      // A confirmed RSN match means the caller is logged into an account they own —
      // proof enough to verify it, enrolled anywhere or not. Skip when there's no RSN
      // hint (we can't tell which account they're actually on). Best-effort: never
      // blocks the request, and no-ops once verified with the hash anchored.
      await ensurePluginVerifiedOnPlay(matchedMember, user.id, accountHash, nowIso);
    }

    const memberIds = memberRows.map((m) => m.id);
    const playerRows = await db
      .select({
        id: players.id,
        name: players.name,
        teamId: players.teamId,
        eventId: players.eventId,
        endDate: events.endDate,
        forceEndedAt: events.forceEndedAt,
        clanMemberId: players.clanMemberId,
      })
      .from(players)
      .innerJoin(events, eq(players.eventId, events.id))
      .where(inArray(players.clanMemberId, memberIds));

    const live = playerRows.filter(
      (p) => p.teamId && !p.forceEndedAt && (!p.endDate || p.endDate > nowIso),
    );
    if (live.length === 0) return null;

    let pick = null as typeof live[number] | null;
    if (matchedMember) {
      const memberId = matchedMember.id;
      pick = live.find((p) => p.clanMemberId === memberId) ?? null;
      if (!pick) return null; // not signed up under this RSN
    } else {
      // No RSN hint — we can't tell which of the user's accounts is logged in, so we must NOT
      // guess a live event. Guessing served a user's bingo config (and auto-submit scope) to
      // their OTHER, unenrolled accounts on the same account token — an alt would show the main's
      // tiles and could even auto-submit under the main's team. Return null; the plugin re-fetches
      // with the RSN once it's stamped after login, and a genuinely enrolled account resolves above.
      return null;
    }

    return {
      playerId: pick.id,
      teamId: pick.teamId!,
      eventId: pick.eventId,
      userId: user.id,
      rsn: pick.name,
    };
  }

  // The token didn't match a per-user plugin token. We no longer accept legacy
  // per-event `players.player_token`s here — the plugin authenticates with the single
  // per-user account token only, so a stale per-event token reads as invalid.
  return null;
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
