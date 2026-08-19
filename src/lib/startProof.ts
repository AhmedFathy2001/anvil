// STARTING SHOT — the anti-stack start proof.
//
// When an event carries `rules.startProof` (lib/eventRules), every enrolled player must upload one
// screenshot taken AFTER the event went live. Two ways to make a shot un-stageable:
//
//   plugin  — the in-game Anvil overlay (team + UTC clock) only renders while the event is live and
//             the player is enrolled, and the plugin bakes the same proof banner into the PNG.
//   mobile  — a per-player KEYWORD typed into the in-game chatbox and screenshotted.
//
// Everyone is also sent to a LOCATION drawn at the start moment, which is the only part that really
// bites: you cannot be parked on stackable content at T0 if you have to be standing somewhere
// nobody could predict. A location pinned on the map picker is checked rather than just read — the
// plugin reports where the account actually stood and we measure the distance.
//
// The rule's third leg is the SESSION WINDOW: hiscores only flush on logout, so a player who never
// logged out has a stale start baseline and their first sweep counts pre-event gains. Requiring a
// session younger than N minutes forces the relog that flushes it, which is what makes the baseline
// (not the screenshot) honest for stat and KC tiles.
//
// Position and session are both CLIENT-REPORTED, like the screenshot itself: they raise the cost of
// cheating, they don't prove anything cryptographically. Treat them as deterrents.
//
// The keyword is an HMAC over the event's `startProofDrawnAt` stamp — a value that does not exist
// until the start transaction runs — so it cannot be precomputed by anyone, admins included. After
// the draw it is derivable from the server secret, which is exactly what lets us VERIFY a claimed
// keyword instead of eyeballing pixels (the old /api/plugin/config codeword was never validated,
// which is why it was pulled from the overlay).
//
// This module is pure (no db, no env at import time) so it unit-tests directly — the one DB write,
// the start-moment draw, lives in lib/eventLifecycle#drawStartProof.

import crypto from 'crypto';
import { requireSecret } from '@/lib/env';
import type { StartProofConfig, StartLocation } from '@/lib/eventRules';
import { DEFAULT_START_RADIUS, START_LOCATIONS } from '@/lib/startLocations';

// Re-exported so every caller keeps importing the starting shot from one place.
export { DEFAULT_START_RADIUS, START_LOCATIONS };

/**
 * Keyword vocabulary. Short, unambiguous words a phone player can read off a screen and re-type
 * without hitting an O/0 or l/1 argument. 64 words × 64 words × 100 = ~410k keywords — far past
 * "write it on a sticky note before the event starts and hope".
 */
export const KEYWORD_WORDS: readonly string[] = [
  'ANVIL', 'AMULET', 'ARROW', 'BARROWS', 'BEACON', 'BONE', 'BREW', 'CANDLE',
  'CAPE', 'CHISEL', 'CLAY', 'COAL', 'COMPASS', 'CORAL', 'CRATE', 'DAGGER',
  'DRAGON', 'EMBER', 'FALADOR', 'FEATHER', 'FLAX', 'FORGE', 'GAUNTLET', 'GEM',
  'GLACOR', 'GRAPE', 'HARPOON', 'HELMET', 'HERB', 'HOPPER', 'HYDRA', 'IRON',
  'JUG', 'KEBAB', 'KELP', 'KILN', 'LANTERN', 'LOBSTER', 'MAPLE', 'MITHRIL',
  'NETTLE', 'OAK', 'ONYX', 'PEARL', 'PICKAXE', 'POTION', 'QUIVER', 'RANGER',
  'RUNE', 'SAPPHIRE', 'SHIELD', 'SHRIMP', 'SILVER', 'SPADE', 'TALON', 'TEAK',
  'TINDER', 'TORCH', 'TUNA', 'VAULT', 'WILLOW', 'WHETSTONE', 'YEW', 'ZULRAH',
];

/** Read lazily, not at import time, so this module stays importable from tests and scripts. */
function keywordSecret(): string {
  return requireSecret('CODEWORD_SECRET', 'dev-codeword-secret');
}

/**
 * The keyword this player must have on screen, e.g. `ANVIL-GRAPE-47`.
 *
 * Deterministic given (event, player, draw stamp) so nothing needs storing, and recomputable
 * server-side so a claimed keyword is checked exactly. `drawnAt` is the un-precomputable part:
 * before the draw there is no stamp, so there is no keyword to leak.
 */
export function startKeyword(eventId: number, playerId: number, drawnAt: string): string {
  const hmac = crypto.createHmac('sha256', keywordSecret());
  hmac.update(`startproof:${eventId}:${playerId}:${drawnAt}`);
  const digest = hmac.digest();
  const len = KEYWORD_WORDS.length;
  const first = digest[0] % len;
  // Never repeat the word — "RUNE-RUNE-12" reads like a typo and invites one.
  let second = digest[1] % len;
  if (second === first) second = (second + 1) % len;
  const number = digest[2] % 100;
  return `${KEYWORD_WORDS[first]}-${KEYWORD_WORDS[second]}-${String(number).padStart(2, '0')}`;
}

/**
 * Canonical form for comparison: uppercase alphanumerics only. Players retype these by hand off a
 * screenshot, so spaces, missing dashes and lowercase all have to compare equal.
 */
export function normalizeKeyword(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Constant-ish comparison of a claimed keyword against the expected one. */
export function keywordMatches(claim: string | null | undefined, expected: string): boolean {
  const a = normalizeKeyword(claim);
  const b = normalizeKeyword(expected);
  return a.length > 0 && a === b;
}

/**
 * Draw the start location. Called once per event, inside the start transaction. `pick` is injectable
 * so tests are deterministic; production passes nothing and gets a uniform crypto draw.
 */
export function drawStartLocation(
  pool: readonly StartLocation[] | null | undefined,
  pick: (max: number) => number = (max) => crypto.randomInt(max),
): StartLocation {
  const options = pool && pool.length > 0 ? pool : START_LOCATIONS;
  return options[pick(options.length)];
}

/** Where the drawn spot is, once the draw has happened. Coordinates are null on a label-only spot. */
export interface StartSpot {
  x: number;
  y: number;
  /** How close counts, in game squares (Chebyshev — the way OSRS measures "within N squares"). */
  radius: number;
}

/**
 * Distance from the drawn spot, in game squares, or null when there's nothing to measure (the spot
 * was never pinned, or the client didn't say where it was — a web upload never does).
 *
 * Chebyshev rather than Euclidean: a radius that means "this many squares in any direction" is what
 * a host drawing a circle on a map expects, and it never refuses someone standing on the diagonal
 * corner of the same building.
 */
export function startDistance(
  spot: StartSpot | null | undefined,
  pos: { x?: number | null; y?: number | null } | null | undefined,
): number | null {
  if (!spot || pos?.x == null || pos?.y == null) return null;
  return Math.max(Math.abs(pos.x - spot.x), Math.abs(pos.y - spot.y));
}

/**
 * How long this game session has been running when the shot was taken, in minutes, as the CLIENT
 * reports it. Null when it didn't say, or said something impossible (a login stamp in the future is
 * a broken clock, not a fresh session, and must never read as "0 minutes old").
 */
export function sessionAgeMinutes(
  loginAt: string | null | undefined,
  atMs: number,
): number | null {
  if (!loginAt) return null;
  const loginMs = Date.parse(loginAt);
  if (!Number.isFinite(loginMs)) return null;
  const deltaMs = atMs - loginMs;
  // Two minutes of slack for clock skew between the client and us; past that it's nonsense.
  if (deltaMs < -120_000) return null;
  return Math.max(0, Math.floor(deltaMs / 60_000));
}

/** The three things we can check about a filed shot. `null` on any of them means "can't tell". */
export interface StartProofChecks {
  /** Did the claimed keyword recompute to this player's? */
  keywordOk: boolean;
  /** Was the client where the spot is? Null = unpinned spot, or a client that didn't report. */
  positionOk: boolean | null;
  /** Squares from the spot, for the admin row. Null when there was nothing to measure. */
  distance: number | null;
  /** Reported session age at capture. Null when the client didn't say. */
  sessionMinutes: number | null;
  /** Was it inside the host's window? Null = not asked for, or not reported. */
  sessionOk: boolean | null;
}

/**
 * Score one filed shot against the event's rule. Pure — the route feeds it what the client claimed
 * and what the draw put on the event row.
 */
export function evaluateStartProof(args: {
  cfg: StartProofConfig | null;
  spot: StartSpot | null;
  keywordOk: boolean;
  claim: { x?: number | null; y?: number | null; loginAt?: string | null };
  atMs: number;
}): StartProofChecks {
  const { cfg, spot, keywordOk, claim, atMs } = args;
  const distance = startDistance(spot, claim);
  const sessionMinutes = sessionAgeMinutes(claim.loginAt, atMs);
  const maxSession = cfg?.maxSessionMinutes ?? 0;
  return {
    keywordOk,
    positionOk: distance == null || !spot ? null : distance <= spot.radius,
    distance,
    sessionMinutes,
    sessionOk: maxSession <= 0 || sessionMinutes == null ? null : sessionMinutes <= maxSession,
  };
}

export type StartProofStatus = 'pending' | 'accepted' | 'rejected';
export type StartProofSource = 'plugin' | 'web';

/** The subset of an `event_start_proofs` row this module reasons about. */
export interface StartProofRecord {
  status: string;
  imageUrl?: string | null;
  source?: string | null;
  keywordOk?: boolean | number | null;
  createdAt?: string | null;
}

/** The subset of an event row this module reasons about. */
export interface StartProofEvent {
  startProofLocation: string | null;
  startProofDrawnAt: string | null;
  /** The drawn spot's coordinates, when the pool entry carried a pin. Null on a label-only draw. */
  startProofX?: number | null;
  startProofY?: number | null;
  startProofRadius?: number | null;
}

/** The drawn spot as coordinates, or null when the draw landed on a label-only entry. */
export function drawnSpot(event: StartProofEvent): StartSpot | null {
  if (event.startProofX == null || event.startProofY == null) return null;
  return {
    x: event.startProofX,
    y: event.startProofY,
    radius: event.startProofRadius ?? DEFAULT_START_RADIUS,
  };
}

/**
 * How long after the start a shot is still worth asking for.
 *
 * The starting shot exists to stop someone parking on stacked content and cashing it in the moment
 * the board opens. That trick needs a session that was already running when the event began — and
 * OSRS logs you out after six hours no matter what, so by then the stack has been broken by the
 * game itself. Everyone who has played since is on a session that started after the event did, and
 * has nothing left to hide.
 *
 * Past the window the requirement lapses: no nag, no flag, no refusal. Credits FLAGGED inside the
 * window stay flagged — that judgement was made at the time and this doesn't rewrite it.
 */
export const START_PROOF_WINDOW_HOURS = 6;

/** When the requirement lapses, or null before the draw (the event isn't live). */
export function startProofWindowEndsAt(event: StartProofEvent): string | null {
  if (!event.startProofDrawnAt) return null;
  const drawn = Date.parse(event.startProofDrawnAt);
  if (!Number.isFinite(drawn)) return null;
  return new Date(drawn + START_PROOF_WINDOW_HOURS * 3_600_000).toISOString();
}

/** Is a starting shot still being asked for? False before the draw and after the window. */
export function startProofWindowOpen(event: StartProofEvent, nowMs: number = Date.now()): boolean {
  const ends = startProofWindowEndsAt(event);
  return ends != null && nowMs < Date.parse(ends);
}

/**
 * What a submission from this player should do. A proof that EXISTS and is not rejected satisfies
 * the gate — holding credits hostage to admin review would punish players for our queue, and the
 * flag/reject decision is about people who never showed up at all.
 */
export type StartProofGate = 'ok' | 'flag' | 'reject';

export function startProofGate(
  cfg: StartProofConfig | null,
  event: StartProofEvent,
  proof: StartProofRecord | null | undefined,
  nowMs: number = Date.now(),
): StartProofGate {
  // Not required, or the event hasn't drawn yet (not live) — nothing to prove.
  if (!cfg || !event.startProofDrawnAt) return 'ok';
  if (proof && proof.status !== 'rejected') return 'ok';
  // Past the window there is no stack left to hide, so a missing shot stops meaning anything.
  if (!startProofWindowOpen(event, nowMs)) return 'ok';
  return cfg.onMissing === 'reject' ? 'reject' : 'flag';
}

/** Written to `submissions.flaggedReason` when a credit lands without a starting shot. */
export const NO_START_PROOF_FLAG = 'no_start_proof';

/** Machine-readable code on the 409 so the plugin can park the drop instead of dropping it. */
export const START_PROOF_REQUIRED_CODE = 'start_proof_required';

export interface StartProofView {
  /** Is a starting shot required on this event at all? */
  required: boolean;
  /** Has the start draw happened (i.e. is the event live)? Before this there is nothing to do. */
  drawn: boolean;
  /** Where to stand. Null until the draw. */
  location: string | null;
  /** The drawn spot's coordinates + radius, when it was pinned on the map. Null until the draw. */
  spot: StartSpot | null;
  /** This player's keyword. Null until the draw. */
  keyword: string | null;
  /** Does this player still owe us a shot? False once the window has closed — see below. */
  needsUpload: boolean;
  /** Is the shot still being asked for at all (START_PROOF_WINDOW_HOURS after the draw)? */
  windowOpen: boolean;
  /** When the requirement lapses. Null until the draw. */
  windowEndsAt: string | null;
  /** Status of the shot on file, or null if none. */
  status: StartProofStatus | null;
  /** The proof image on file, if any. */
  imageUrl: string | null;
  /**
   * How fresh the game session has to be, in minutes (0 = not asked for). The plugin blocks its own
   * button on this and tells the player to log out and back in — hiscores only flush on logout, so a
   * session older than the event start means the start baseline is stale.
   */
  maxSessionMinutes: number;
}

/**
 * Everything a member surface (web card, plugin config, admin row) needs about ONE player, folded
 * into a single shape so the web and the plugin can never drift on what "done" means.
 */
export function startProofState(args: {
  cfg: StartProofConfig | null;
  event: StartProofEvent & { id: number };
  playerId: number;
  proof?: StartProofRecord | null;
  nowMs?: number;
}): StartProofView {
  const { cfg, event, playerId, proof, nowMs = Date.now() } = args;
  const required = cfg != null;
  const drawn = required && event.startProofDrawnAt != null;
  const status = (proof?.status as StartProofStatus | undefined) ?? null;
  const windowOpen = required && startProofWindowOpen(event, nowMs);
  return {
    required,
    drawn,
    location: drawn ? event.startProofLocation : null,
    spot: drawn ? drawnSpot(event) : null,
    keyword: drawn ? startKeyword(event.id, playerId, event.startProofDrawnAt!) : null,
    // Nobody owes a shot once the window has shut: the card, the plugin banner and the chat nudge
    // all read this, so they go quiet together rather than one of them still asking.
    needsUpload: drawn && windowOpen && (status === null || status === 'rejected'),
    windowOpen,
    windowEndsAt: required ? startProofWindowEndsAt(event) : null,
    status,
    imageUrl: proof?.imageUrl ?? null,
    maxSessionMinutes: cfg?.maxSessionMinutes ?? 0,
  };
}

/**
 * Should this upload be accepted outright? Only for a plugin capture whose keyword we recomputed to
 * a match — that combination means an authenticated client, on the enrolled account, echoing a
 * string that did not exist before the event started. Web/mobile uploads always land `pending`:
 * their keyword is retyped by hand, so a match proves the player read the site, not that the
 * screenshot shows it.
 *
 * A check that came back FALSE (wrong side of the world, session older than the window) drops it to
 * `pending` for a human. A check that came back null didn't run — an unpinned spot, a rule that
 * isn't switched on, or a plugin too old to report — and can't be held against the player.
 */
export function autoAcceptDecision(
  cfg: StartProofConfig | null,
  source: StartProofSource,
  checks: Pick<StartProofChecks, 'keywordOk'> & Partial<Pick<StartProofChecks, 'positionOk' | 'sessionOk'>>,
): StartProofStatus {
  if (!cfg?.autoAcceptPlugin || source !== 'plugin' || !checks.keywordOk) return 'pending';
  if (checks.positionOk === false || checks.sessionOk === false) return 'pending';
  return 'accepted';
}
