import { cookies } from 'next/headers';
import { atLeast, type ClanRole } from '@/lib/clanRoles';
import { clanGrant } from '@/lib/clanGrants';
import { liveActAs } from '@/lib/actAs';
import { currentClan } from '@/lib/clanContext';
import crypto from 'crypto';
import { db } from '@/db';
import { resolveClanById, resolveClanFromRequest, type ClanContext } from '@/lib/clanContext';
import { accounts, clanAuditLog, clanMemberships, clanRoster, clanStaff, clans, detectedAccounts, eventEditors, eventParticipants, events, players, pluginLinks, teams, users } from '@/db/schema';
import { findOrCreateAccount, findOrCreateSeat, findRosterSeat, findRosterSeats, personOf, personOfOrCreate, seatsOwnedBy, seatsOwnedByAnywhere, UNCLAIMED_ACCOUNT, updateAccountOfSeat } from '@/lib/roster';
import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
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
  treasurerScope: string = 'all',
): string {
  // editorScope rides in the token so middleware (edge, no DB) can tell a board-scoped editor
  // (role 'editor' + scope 'assigned') from a global editor and route them to /admin/events only.
  // Server gates (verifyUser/verifyAdminOrModerator) re-read the live scope from the DB, so a stale
  // token only affects coarse page-routing until the next login.
  return sign(
    JSON.stringify({ userId, username, role, editorScope, canEditTiles, treasurerScope, iat: Date.now() }),
    ADMIN_SESSION_SECRET,
  );
}

export function signCaptainToken(teamId: number): string {
  return sign(JSON.stringify({ role: 'captain', teamId, iat: Date.now() }), CAPTAIN_SESSION_SECRET);
}

export interface UserPayload {
  userId: number;
  // The PERSON this login belongs to. Distinct from userId and not interchangeable with it: users
  // and players are separate id sequences, so comparing a user id against account ownership matches
  // whichever unrelated person happens to share the number. Anything asking "is this account mine?"
  // means this field.
  playerId: number;
  username: string;
  role: string;
  // Only meaningful for role 'editor': 'all' = global editor (edits every event), 'assigned' =
  // board-scoped editor (edits only granted events). Always present so callers don't branch on
  // undefined; non-editor roles carry 'all' but never consult it. See users.editorScope.
  editorScope: string;
  // 'all' = treasurer of the whole clan; 'assigned' = named boards only. Same shape as
  // editorScope, and like it this comes from the GRANT, not from the user row: a treasurer of one
  // clan must not hold the scope in another.
  treasurerScope: string;
  // Tile authoring, independent of role. A capability, not a tier.
  canEditTiles: boolean;
  // Owner OF THIS CLAN. Undemotable here, and meaningless anywhere else.
  isOwner: boolean;
  // The other axis entirely: capability over the PLATFORM, which no clan role can confer.
  platformRole: string;
  // Set only while an operator is using a temporary borrowed grant in this clan. Present so the UI
  // can say so out loud — someone acting with authority that is not theirs should be able to tell,
  // and so should anyone looking over their shoulder.
  actingAs: { clanId: number; expiresAt: string } | null;
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
      columns: { id: true, playerId: true, displayName: true, banned: true, platformRole: true },
    });
    // A deleted OR banned user has no valid session — the ban takes effect on their very next
    // request, not just next login, so kicking someone is immediate.
    //
    // TWO BANS, TWO LEVELS. `users.banned` bars this login. `players.banned` is the PLATFORM ban and
    // bars the human behind it — the one a clan admin is structurally unable to reach, set only from
    // /staff. Checking only the first left the platform ban documented, writable, and enforced by
    // nothing at all.
    if (!dbUser || dbUser.banned) return null;
    if (dbUser.playerId != null) {
      const person = await db.query.players.findFirst({
        where: eq(players.id, dbUser.playerId),
        columns: { banned: true },
      });
      if (person?.banned) return null;
    }
    // Self-heal a login that predates persons. Cheap, because it only runs while player_id is null,
    // and the alternative is a session whose identity is a number in the wrong id space.
    const playerId = dbUser.playerId ?? (await personOfOrCreate(dbUser.id));

    // AUTHORITY IS PER CLAN, and the clan is whichever one this request's host names.
    //
    // users.role is global. Left as the answer it made every admin an admin of every clan on the
    // deployment, which is the single worst thing a shared app can get wrong. The grant is read
    // live from clan_staff, so a demotion takes effect on the next request rather than whenever the
    // 30-day cookie happens to be replaced.
    //
    // No clan (the apex, or a host that names none) means no clan authority: the apex has no roster
    // to administer, and platform capability is a separate axis that lives on users.platformRole.
    const clan = await currentClan();
    const grant = clan ? await clanGrant(clan.id, dbUser.id) : null;

    // THE ONE EXCEPTION, and it is deliberately narrow.
    //
    // An operator holds no clan authority by being an operator. They can take a temporary, expiring,
    // logged grant in a specific clan when they genuinely have to fix something — see lib/actAs for
    // why that beats the alternatives. It applies only where a real grant is absent, so it can never
    // quietly override what a clan actually decided about someone.
    //
    // Gated on platformRole first so this costs nothing for everyone else: a normal member has no
    // clan_staff row either, and without that check every one of their requests would pay for a
    // lookup that could only ever come back empty.
    const platformRole = dbUser.platformRole ?? 'none';
    const borrowed =
      !grant && clan && platformRole !== 'none' ? await liveActAs(clan.id, dbUser.id) : null;

    return {
      userId: dbUser.id,
      playerId,
      username: typeof data.username === 'string' ? data.username : 'user',
      role: grant?.role ?? borrowed?.role ?? 'member',
      editorScope: grant?.editorScope ?? 'all',
      treasurerScope: grant?.treasurerScope ?? 'all',
      canEditTiles: grant?.canEditTiles === true || borrowed != null,
      // Never. The owner seat is the one thing a borrowed grant must not confer, or an operator can
      // transfer a clan away from the person who owns it.
      isOwner: grant?.isOwner === true,
      platformRole,
      actingAs: borrowed ? { clanId: borrowed.clanId, expiresAt: borrowed.expiresAt } : null,
    };
  } catch {
    return null;
  }
}

export async function verifyAdmin(): Promise<boolean> {
  const user = await verifyUser();
  return atLeast(user?.role, 'admin');
}

export async function verifyAdminOrModerator(): Promise<UserPayload | null> {
  const user = await verifyUser();
  if (!user) return null;
  // Moderator-tier and up in THIS clan. Treasurer ties with moderator by rank — same tier,
  // different extra capability — so one comparison covers both.
  //
  // SCOPED grants are not tiers. Someone given one board to author, or one event's money to run,
  // must not reach the roster, verification or weekly moderation surfaces through it.
  if (user.role === 'editor' && user.editorScope === 'assigned') return null;
  if (user.role === 'treasurer' && user.treasurerScope === 'assigned') return null;
  // A GLOBAL editor does everything a moderator can. Named explicitly because lib/clanRoles does not
  // rank 'editor' — it is a capability, not a tier — so atLeast() reads it as 'member'.
  if (user.role === 'editor') return user;
  return atLeast(user.role, 'moderator') ? user : null;
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
  // The capability, held in this clan.
  if (user.canEditTiles && user.editorScope === 'all') return user;
  // Or a grant on this specific board. The board belongs to one clan, so a grant on it is already
  // clan-scoped — a stranger holding no grant here reaches nothing.
  const grant = await db.query.eventEditors.findFirst({
    where: and(
      eq(eventEditors.eventId, eventId),
      eq(eventEditors.userId, user.userId),
      // A treasurer grant on the same board buys nothing here: money and tiles are separate jobs.
      eq(eventEditors.role, 'editor'),
    ),
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
  const grant = await db.query.eventEditors.findFirst({
    where: and(eq(eventEditors.userId, user.userId), eq(eventEditors.role, 'editor')),
    columns: { id: true },
  });
  return grant ? user : null;
}

// Fee-collection gate. Regular moderators cannot collect sign-up fees — only admins
// and treasurers can. Used by the fee-collection endpoints in the sign-up flow.
export async function verifyFeeCollector(): Promise<UserPayload | null> {
  const user = await verifyUser();
  if (!user) return null;
  // A BOARD treasurer is not a clan treasurer: their reach is one event, checked by the
  // event-scoped gate. This one answers for the whole clan.
  if (user.role === 'treasurer' && user.treasurerScope === 'assigned') return null;
  // Treasurer or admin IN THIS CLAN. Moderators are mod-tier but deliberately excluded: collecting
  // money is the treasurer's job, and rank alone does not confer it.
  if (user.role === 'treasurer' || atLeast(user.role, 'admin')) return user;
  return null;
}

/**
 * Money on ONE event: collecting its sign-up fees, running its payouts.
 *
 * Passes an admin, a clan treasurer (every event), and the holder of a per-board treasurer grant
 * for this event. The board grant exists for the case a clan-wide treasurer role can't express —
 * "this person handles the money for the September bingo and nothing else" — which is how a visiting
 * clan's own treasurer runs their side of a clan-v-clan without being handed the whole ledger.
 */
export async function verifyEventTreasurer(eventId: number): Promise<UserPayload | null> {
  const user = await verifyUser();
  if (!user) return null;
  if (user.role === 'admin') return user;
  if (user.role === 'treasurer' && user.treasurerScope !== 'assigned') return user;
  const grant = await db.query.eventEditors.findFirst({
    where: and(
      eq(eventEditors.eventId, eventId),
      eq(eventEditors.userId, user.userId),
      eq(eventEditors.role, 'treasurer'),
    ),
    columns: { id: true },
  });
  return grant ? user : null;
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
  // clan-scope: global -- the subject is a PERSON, whose seats span clans by design; scoped to their own.
  const myMembers = await db
    .select({ id: clanRoster.id })
    .from(clanRoster)
    .where(and(eq(clanRoster.playerId, user.playerId), isNull(clanRoster.leftAt)));
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
/**
 * The clan a plugin request is for.
 *
 * THE ADDRESS FIRST, THE TOKEN AS THE ANSWER.
 *
 * `anvilosrs.com` is the canonical address of the whole platform: one site, every clan. A request
 * arriving there names no clan, and that is the intended state rather than a missing detail — a
 * person should not have to know a slug, and should not have to change anything when they join a
 * second clan.
 *
 * So the order is:
 *
 *   1. `/c/<slug>/…`     — someone typed it, so it wins
 *   2. the Host          — the per-clan subdomains installed plugins still have stored
 *   3. the TOKEN         — the canonical path, resolving through the person to their seats
 *
 * Steps 1 and 2 exist only for URLs already in the wild. Anything new should be on the apex, where
 * this falls through to the token every time.
 *
 * WHY A TOKEN CAN ANSWER AT ALL: it identifies the PERSON, and a person's seats say which clans
 * they belong to. That was always true; it simply was not asked, because a deployment used to be a
 * clan and the Host was free.
 */
export async function resolvePluginClan(
  request: Request,
  userId?: number | null,
  opts?: { inGameClanName?: string | null },
): Promise<ClanContext | null> {
  const addressed = await resolveClanFromRequest(request);
  if (addressed) return addressed;

  let id = userId ?? null;
  if (id == null) {
    const header = request.headers.get('Authorization');
    if (!header?.startsWith('Bearer ')) return null;
    const token = header.slice(7).trim();
    if (!token) return null;
    const user = await userByPluginToken(token);
    if (!user) return null;
    id = user.id;
  }

  return clanOfPerson(id, opts?.inGameClanName ?? null);
}

/** As resolvePluginClan, but throws when nothing names a clan — the same standing requireClanFromRequest had. */
export async function requirePluginClan(
  request: Request,
  opts?: { inGameClanName?: string | null },
): Promise<ClanContext> {
  const clan = await resolvePluginClan(request, null, opts);
  if (!clan) throw new Error('No clan for this plugin request');
  return clan;
}

/**
 * Which of a person's clans a clanless request means.
 *
 * A live event wins, because that is what a plugin is for: someone playing a bingo wants that
 * clan's board, whatever else they have a seat in. Between two live events the LATEST START wins —
 * deliberately the same tie-break verifyPluginToken already applies to one clan running two events,
 * since "the freshest board is almost always the one being played" does not stop being true because
 * the second board belongs to a different clan.
 *
 * With nothing live, their most recently joined seat: the clan they most recently chose to be in is
 * the better guess about who they mean, and it keeps notifications and the schedule pointing
 * somewhere sensible between events.
 */
async function clanOfPerson(
  userId: number,
  inGameClanName: string | null = null,
): Promise<ClanContext | null> {
  // An exact answer beats every heuristic below. A roster push names the IN-GAME clan it came from,
  // and that names one of the person's seats outright — so a member of two Anvil clans syncs the
  // right roster instead of whichever had the most recent event. Matters more here than anywhere
  // else on this path, because a roster sync WRITES.
  if (inGameClanName?.trim()) {
    const named = await db
      .select({ clanId: clanRoster.clanId })
      .from(clanRoster)
      .innerJoin(clans, eq(clans.id, clanRoster.clanId))
      .where(
        and(
          await seatsOwnedByAnywhere(userId),
          isNull(clanRoster.leftAt),
          sql`lower(${clans.inGameName}) = lower(${inGameClanName.trim()})`,
        ),
      )
      .limit(1);
    if (named.length > 0) return resolveClanById(named[0].clanId);
  }

  const nowIso = new Date().toISOString();

  const live = await db
    .select({ clanId: clanRoster.clanId, startDate: events.startDate })
    .from(clanRoster)
    .innerJoin(eventParticipants, eq(eventParticipants.clanMemberId, clanRoster.id))
    .innerJoin(events, eq(events.id, eventParticipants.eventId))
    .where(
      and(
        await seatsOwnedByAnywhere(userId),
        isNull(clanRoster.leftAt),
        isNull(events.forceEndedAt),
        or(isNull(events.startDate), lte(events.startDate, nowIso)),
        or(isNull(events.endDate), gte(events.endDate, nowIso)),
      ),
    )
    .orderBy(desc(events.startDate))
    .limit(1);

  if (live.length > 0) return resolveClanById(live[0].clanId);

  // Nothing live: default to their HOME clan — the one they're a MEMBER of — before any guest seat.
  // An account holds at most one member seat (the exclusivity index), so this is a single, correct
  // answer: "my clan", not "whichever clan I most recently guested in". Before this, someone who
  // guested into another clan after joining their own had the plugin quietly point at the guest clan
  // — which for a member with events elsewhere means an empty board, exactly the LFL-vs-theafkspot
  // case. Member-first, then most-recently-joined as the tie-break among seats of the same kind.
  const seat = await db
    .select({ clanId: clanRoster.clanId })
    .from(clanRoster)
    .where(and(await seatsOwnedByAnywhere(userId), isNull(clanRoster.leftAt)))
    .orderBy(desc(sql`(${clanRoster.kind} = 'member')`), desc(clanRoster.joinedAt))
    .limit(1);

  return seat.length > 0 ? resolveClanById(seat[0].clanId) : null;
}

/**
 * The login a plugin token belongs to — whichever token it is.
 *
 * A person accumulates tokens: one per instance that ever issued them one, plus any device links.
 * `users.pluginToken` holds the newest, and `plugin_links` holds the rest, so both are checked and
 * an older one keeps working. This matters most right after a clan is imported, when somebody in
 * two clans is one login holding two tokens and their client only knows the one it was given.
 */
async function userByPluginToken(token: string) {
  const direct = await db.query.users.findFirst({ where: eq(users.pluginToken, token) });
  if (direct) return direct;

  const link = await db.query.pluginLinks.findFirst({
    where: and(eq(pluginLinks.token, token), isNull(pluginLinks.revokedAt)),
    columns: { userId: true },
  });
  if (!link) return undefined;
  return db.query.users.findFirst({ where: eq(users.id, link.userId) });
}

export async function verifyPluginTokenUser(
  request: Request,
): Promise<{ userId: number } | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  const user = await userByPluginToken(token);
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
    // clan-scope: global -- identity is global — one OSRS account is one account however many clans roster it.
    const clash = await findRosterSeat(and(eq(clanRoster.rsnNormalized, newNorm), isNull(clanRoster.leftAt)));
    if (clash && clash.id !== memberId) return;

    // clan-scope: global -- identity is global — one OSRS account is one account however many clans roster it.
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
/**
 * May the caller AUTO-CLAIM this existing account row, or must they prove control first?
 *
 * One distinction the old code blurred, and the whole security model rests on it.
 *
 *   PROOF OF CONTROL is an account hash ALREADY ANCHORED to this row — `matchedByHash`. A modified
 *   RuneLite can put any 64-bit value on the wire (`client.getAccountHash()` is not authenticated),
 *   so a hash that matches nothing proves nothing, and a hash that is merely PRESENT must never lower
 *   the bar. The one thing an attacker cannot do is produce a hash that already sits on a row they do
 *   not control — that, and only that, is proof.
 *
 *   A PUBLIC RSN is not proof. "The plugin said I'm playing as X" is a claim, and X's name is known
 *   to everyone. Auto-claiming an ESTABLISHED account on a name match is the hostile takeover this
 *   exists to stop: send a victim's RSN plus a random hash and the account was yours — demonstrated
 *   against a real roster member before this landed.
 *
 * So an established account — a real in-game roster member, a verified account, or one carrying a
 * pre-assigned role — auto-claims ONLY when matched by an anchored hash. Otherwise ownership needs
 * the XP-delta check or a moderator's approval. A bare unclaimed ghost (a guest artifact from a prior
 * ping, nobody's proven identity) still links freely: there is no victim and no identity to steal.
 *
 * The `!accountHash` waiver this replaces was itself the bug in the careful path — a non-matching
 * hash set `accountHash` truthy and skipped the guard, so sending a random hash *disabled* the very
 * check meant to stop the takeover.
 */
export function autoClaimAllowed(
  existing: { kind: string; verifiedAt: string | null; pendingRole: string | null },
  matchedByHash: boolean,
): boolean {
  if (matchedByHash) return true;
  const established =
    existing.kind === 'member' || existing.verifiedAt != null || !!existing.pendingRole;
  return !established;
}

async function autoLinkOrSuggestOnPlay(
  clanId: number,
  userId: number,
  rsn: string,
  normalizedRsn: string,
  accountHash: string | null,
  nowIso: string,
): Promise<void> {
  try {
    // OWNERSHIP IS GLOBAL, THE SEAT IS NOT — two questions, and this asked one query for both.
    //
    // "Has anybody claimed this character?" is about the ACCOUNT, which is one row platform-wide.
    // Asking a roster instead would miss an owner who plays for another clan, and the create branch
    // below would then take their account.
    const ownedAccount = accountHash
      ? await db.query.accounts.findFirst({ where: eq(accounts.accountHash, accountHash) })
      : null;
    const ownedByRsn =
      ownedAccount ?? (await db.query.accounts.findFirst({ where: eq(accounts.rsnNormalized, normalizedRsn) }));

    // Owned already — theirs (linked) or someone else's (not ours to touch). Nothing to auto-add.
    // Claimed, not "has a person": every account has a person, so player_id says nothing about
    // whether anyone has claimed it, and testing it here stopped this path linking anything at all.
    if (ownedByRsn?.claimedAt != null) return;

    // "Do they already have a seat HERE?" is about this clan, and only this clan. Unscoped, the
    // branch below reached whatever seat it found: someone playing with their plugin pointed at clan
    // A, who had a departed seat in clan B, had B's seat REVIVED (leftAt back to null), stamped as
    // seen and written into B's audit log — while clan A, the one they were actually playing for,
    // got no seat at all. The `clanId` parameter was passed in and then used by only one branch,
    // which is the tell.
    const byHash = accountHash
      ? (await findRosterSeat(and(eq(clanRoster.clanId, clanId), eq(clanRoster.accountHash, accountHash)))) ?? null
      : null;
    const byRsn =
      (await findRosterSeat(and(eq(clanRoster.clanId, clanId), eq(clanRoster.rsnNormalized, normalizedRsn)))) ?? null;
    const existing = byHash ?? byRsn;

    // THE GATE. Established rows (member / verified / role-carrying) need proof of control — an
    // anchored hash — and a public RSN is not it. This was `existing?.pendingRole && !byHash`, which
    // guarded only role rows; every other established member auto-linked on a name, which is exactly
    // the takeover. When refused, the character becomes an opt-in SUGGESTION in the caller's own
    // inbox, from where "Add" runs claimAccountForUser — which applies the same gate and routes them
    // to the XP-delta check. The real owner clears it; an attacker's suggestion clears nothing.
    if (existing && !autoClaimAllowed(existing, !!byHash)) {
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
          playerId: await personOfOrCreate(userId),
          accountHash: existing.accountHash ?? accountHash,
          verifiedAt: existing.verifiedAt ?? nowIso,
          verificationMethod: 'plugin',
          provisional: 0,
          claimedAt: existing.claimedAt ?? nowIso,
        })
        // Re-assert unowned so a concurrent claim wins cleanly.
        .where(and(eq(accounts.id, existing.accountId), UNCLAIMED_ACCOUNT));
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
          playerId: await personOfOrCreate(userId),
          verifiedAt: nowIso,
          verificationMethod: 'plugin',
          provisional: 0,
          claimedAt: nowIso,
        })
        // UNCLAIMED, same as the sibling branch above, which had it and this one did not.
        // findOrCreateAccount resolves by hash then by RSN and returns the GLOBAL row, so without
        // this a claim landing between the check and here would be overwritten — and the check is
        // the only thing standing between "no seat in this clan" and "take this account".
        .where(and(eq(accounts.id, account.id), UNCLAIMED_ACCOUNT));
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
    // clan-scope: global -- identity is global — one OSRS account is one account however many clans roster it.
    const existing = await findRosterSeat(eq(clanRoster.accountHash, accountHash));
    if (!existing) return; // no row anchored to this hash — opt-in flow handles the rest
    if (existing.claimedAt != null) return; // already claimed (theirs or someone else's) — never steal
    // Only an ESTABLISHED identity auto-links: a verified account, or a real in-game roster member.
    if (existing.verifiedAt == null && existing.kind !== 'member') return;

    const result = await db
      .update(accounts)
      .set({
        playerId: await personOfOrCreate(userId),
        verifiedAt: existing.verifiedAt ?? nowIso,
        verificationMethod: 'plugin',
        provisional: 0,
        claimedAt: existing.claimedAt ?? nowIso,
      })
      // Re-assert unowned in the WHERE so a concurrent claim wins cleanly instead of being clobbered.
      // On the ACCOUNT, which is where ownership lives — guarding the seat would not be a guard at
      // all, since two clans' seats over one account could each pass it.
      .where(and(eq(accounts.id, existing.accountId), UNCLAIMED_ACCOUNT))
      // Row COUNT is the guard, and it has to be read portably: the driver-specific field this used
      // to read (rowsAffected) is absent on other drivers and came back undefined, which compiled
      // fine and silently disabled the check.
      //
      // RETURNING the ACCOUNT's own column, not the view's. Naming the view here is rejected by
      // Postgres at parse time — the update never applies — and this function swallows its own
      // errors, so it fails as a silent no-op rather than anything you could notice.
      .returning({ id: accounts.id });

    if (result.length === 0) return;

    db.insert(clanAuditLog)
      .values({
        clanMemberId: existing.id,
        eventType: 'claimed',
        // hadHash, not the hash itself. The account hash is the credential the whole takeover fix
        // treats as proof; writing it here put it in plaintext in an audit trail the /staff feed
        // surfaces, so a platform operator could read one and replay it. The boolean keeps the
        // "was there hash proof" signal without persisting the secret.
        newValue: JSON.stringify({ userId, via: 'plugin-play', method: 'plugin', hadHash: !!accountHash }),
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
    // clan-scope: global -- identity is global — one OSRS account is one account however many clans roster it.
    ? (await findRosterSeat(eq(clanRoster.accountHash, accountHash))) ?? null
    : null;
  const byRsn =
    // clan-scope: global -- identity is global — one OSRS account is one account however many clans roster it.
    (await findRosterSeat(eq(clanRoster.rsnNormalized, normalizedRsn))) ?? null;
  const existing = byHash ?? byRsn;

  if (existing?.claimedAt != null) {
    if (existing.playerId === (await personOf(userId))) return { ok: true, clanMemberId: existing.id };
    return { ok: false, reason: 'owned-by-other' };
  }

  // THE GATE, one condition for every established row (see autoClaimAllowed).
  //
  // This used to be two checks, and the second carried the bug: `!byHash && !accountHash && …`. A
  // present-but-non-matching hash made `!accountHash` false and skipped it, so an attacker who sent a
  // RANDOM hash alongside a victim's RSN waived the very guard meant to stop them. Proof is an
  // ANCHORED hash (`byHash`), never the mere presence of one. A hash-anchored match still one-clicks;
  // everything established-but-unproven goes to the XP-delta / link-code check.
  if (existing && !autoClaimAllowed(existing, !!byHash)) {
    return { ok: false, reason: 'needs-verification' };
  }

  let clanMemberId: number;
  if (existing) {
    // Unowned ghost → claim + verify. Ownership and proof are account facts.
    await db
      .update(accounts)
      .set({
        playerId: await personOfOrCreate(userId),
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
        playerId: await personOfOrCreate(userId),
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
      newValue: JSON.stringify({ userId, via: 'opt-in', method: 'plugin', hadHash: !!accountHash, rsn }),
      actorUserId: userId,
    })
    .catch(() => {});

  // First account a user attributes becomes their primary.
  //
  // ANYWHERE on purpose: `isPrimary` lives on the account, which is global, so "do they already have
  // a primary" is a question about the person and not about this clan. Scoping it would hand someone
  // a second primary the moment they joined a second clan.
  // clan-scope: global -- identity is global — one OSRS account is one account however many clans roster it.
  const owned = await findRosterSeats(and(await seatsOwnedByAnywhere(userId), isNull(clanRoster.leftAt)));
  if (owned.length > 0 && !owned.some((a) => a.isPrimary === 1)) {
    // KEYED ON THE ACCOUNT, not the seat. This was `.where(eq(clanMemberships.id, clanMemberId))` —
    // an UPDATE on `accounts` keyed on a column of `clan_memberships`, which Postgres rejects
    // outright ("missing FROM-clause entry"). Same bug, same table, as the one in accountClaim.ts:
    // it threw on exactly the case its own condition selects — a user's FIRST attributed account.
    // clan-scope: global -- identity is global — one OSRS account is one account however many clans roster it.
    const seat = await findRosterSeat(eq(clanRoster.id, clanMemberId));
    if (seat) await db.update(accounts).set({ isPrimary: 1 }).where(eq(accounts.id, seat.accountId));
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
): Promise<{ userId: number; clanMemberId: number; accountId: number; rsn: string } | null> {
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

  const user = await userByPluginToken(token);
  if (!user) return null;

  // Which clan is this plugin talking to? The address answers when it names one, and the TOKEN
  // answers when it does not — see resolvePluginClan. A person with no seat anywhere still cannot
  // resolve a member, because there is no roster to resolve against.
  const clan = await resolvePluginClan(request, user.id);
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
      accountId: clanRoster.accountId,
      rsn: clanRoster.rsn,
      rsnNormalized: clanRoster.rsnNormalized,
      previousRsns: clanRoster.previousRsns,
      verifiedAt: clanRoster.verifiedAt,
      provisional: clanRoster.provisional,
      accountHash: clanRoster.accountHash,
    })
    .from(clanRoster)
    // Scoped to the clan this plugin request named. The token identifies the PERSON, so unscoped
    // this hands back every seat they hold anywhere — and the code below picks one of them to serve
    // config, auto-submit scope and weekly credit for. That is the same leak the RSN-hint check
    // further down exists to prevent, one level up.
    .where(and(await seatsOwnedBy(clan.id, user.id), isNull(clanRoster.leftAt)));
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

  // Both, deliberately: the SEAT is this clan's roster row, the ACCOUNT is what Jagex tracks and
  // what every stat, best and collection-log row hangs off — one history per account, not per clan.
  return {
    userId: user.id,
    clanMemberId: matchedMember.id,
    accountId: matchedMember.accountId,
    rsn: currentRsn.trim(),
  };
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
  // clan-scope: global -- identity is global — one OSRS account is one account however many clans roster it.
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

// ── Staff actions over the plugin (roster sync) ─────────────────────────────────────────────
//
// WHO is asking and WHAT THEY MAY DO are two questions here, and they have to be asked in that
// order, because the clan is not known until the second one.
//
// They used to be one question, answered by `users.role === 'admin'`. That column is deprecated —
// the schema says so in as many words — and on a platform it cannot express the thing it is being
// asked: with many clans on one deployment, a global role makes every admin an admin everywhere.
// It also made roster sync unreachable for the people who actually run the clans. A clan created
// here gets `clan_staff.role = 'owner'` and leaves `users.role` at 'member', so every clan except
// the genesis account's was refused — and roster sync is the only path to membership AND to
// in-game verification, which meant a new clan could not get its members in at all.
//
// `clan-sync` is why these are split rather than one clan-aware call. It resolves its clan from the
// IN-GAME NAME in the body, deliberately, because that is an exact answer where every other signal
// is a guess and this endpoint writes a roster. So the body has to be parsed before the clan is
// known, and the caller has to be authenticated before the body is parsed.

/**
 * WHO — the person behind a plugin bearer token. Says nothing about what they may do.
 *
 * Transition: a legacy dedicated admin link token (`pluginLinks`) is still accepted so existing
 * installs keep working until they switch to sending the account token. Drop that fallback once
 * every install has migrated.
 */
export async function pluginTokenPerson(request: Request): Promise<{ userId: number } | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  // Preferred: the per-user account token.
  const user = await userByPluginToken(token);
  if (user) return { userId: user.id };

  const link = await db.query.pluginLinks.findFirst({
    where: and(eq(pluginLinks.token, token), isNull(pluginLinks.revokedAt)),
  });
  if (!link) return null;

  // The legacy token still has to name a live user; authority is asked for separately below, so a
  // revoked grant stops it just as it stops the account-token path.
  const linkUser = await db.query.users.findFirst({
    where: eq(users.id, link.userId),
    columns: { id: true },
  });
  if (!linkUser) return null;

  // Fire-and-forget lastUsedAt bump — ok if it races
  db.update(pluginLinks)
    .set({ lastUsedAt: new Date().toISOString() })
    .where(eq(pluginLinks.id, link.id))
    .catch(() => {});

  return { userId: link.userId };
}

/**
 * WHAT — does this person hold at least `min` in THIS clan?
 *
 * The same rule `verifyUser` applies to a web session, and deliberately so: an authority model with
 * two answers depending on which client asked is a model with a hole in it. A real `clan_staff`
 * grant first; failing that, an operator's temporary, expiring, logged act-as grant — which is
 * gated on `platformRole` first so a normal member never pays for a lookup that could only come
 * back empty.
 */
export async function pluginClanAuthority(
  clanId: number,
  userId: number,
  min: ClanRole = 'admin',
): Promise<boolean> {
  const grant = await clanGrant(clanId, userId);
  if (grant) return atLeast(grant.role, min);

  const row = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { platformRole: true },
  });
  if ((row?.platformRole ?? 'none') === 'none') return false;
  const borrowed = await liveActAs(clanId, userId);
  return borrowed != null && atLeast(borrowed.role, min);
}

/**
 * Is this person staff anywhere at all, at `min` or better?
 *
 * For the plugin's "should I show the sync button?" probe, which happens before any clan is named:
 * the roster push that follows carries its own clan name and is authorised against THAT clan, so
 * this only has to answer whether the button could ever do anything.
 */
export async function staffsAnyClan(userId: number, min: ClanRole = 'admin'): Promise<boolean> {
  const rows = await db
    .select({ role: clanStaff.role })
    .from(clanStaff)
    .where(eq(clanStaff.userId, userId));
  return rows.some((r) => atLeast(r.role, min));
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
