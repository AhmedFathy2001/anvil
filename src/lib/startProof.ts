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
// nobody could predict.
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
import type { StartProofConfig } from '@/lib/eventRules';

/** Where players are sent for the shot. Towns and bank steps only — never next to stackable content. */
export const START_LOCATIONS: readonly string[] = [
  'Lumbridge castle courtyard',
  'Grand Exchange centre',
  'Varrock fountain',
  'Falador east bank',
  'Draynor Village market',
  'Al Kharid bank',
  'Edgeville bank',
  'Barbarian Village bridge',
  'Port Sarim docks',
  'Catherby bank',
  "Seers' Village bank",
  'Camelot castle entrance',
  'Ardougne market',
  'Yanille bank',
  'Taverley bank',
  'Burthorpe castle steps',
  'Canifis bank',
  'Shilo Village bank',
  'Kourend castle courtyard',
  'Hosidius market',
  'Piscarilius fishing docks',
  'Prifddinas central fountain',
  'Woodcutting Guild entrance',
  'Farming Guild entrance',
];

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
  pool: readonly string[] | null | undefined,
  pick: (max: number) => number = (max) => crypto.randomInt(max),
): string {
  const options = pool && pool.length > 0 ? pool : START_LOCATIONS;
  return options[pick(options.length)];
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
): StartProofGate {
  // Not required, or the event hasn't drawn yet (not live) — nothing to prove.
  if (!cfg || !event.startProofDrawnAt) return 'ok';
  if (proof && proof.status !== 'rejected') return 'ok';
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
  /** This player's keyword. Null until the draw. */
  keyword: string | null;
  /** Does this player still owe us a shot? */
  needsUpload: boolean;
  /** Status of the shot on file, or null if none. */
  status: StartProofStatus | null;
  /** The proof image on file, if any. */
  imageUrl: string | null;
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
}): StartProofView {
  const { cfg, event, playerId, proof } = args;
  const required = cfg != null;
  const drawn = required && event.startProofDrawnAt != null;
  const status = (proof?.status as StartProofStatus | undefined) ?? null;
  return {
    required,
    drawn,
    location: drawn ? event.startProofLocation : null,
    keyword: drawn ? startKeyword(event.id, playerId, event.startProofDrawnAt!) : null,
    needsUpload: drawn && (status === null || status === 'rejected'),
    status,
    imageUrl: proof?.imageUrl ?? null,
  };
}

/**
 * Should this upload be accepted outright? Only for a plugin capture whose keyword we recomputed to
 * a match — that combination means an authenticated client, on the enrolled account, echoing a
 * string that did not exist before the event started. Web/mobile uploads always land `pending`:
 * their keyword is retyped by hand, so a match proves the player read the site, not that the
 * screenshot shows it.
 */
export function autoAcceptDecision(
  cfg: StartProofConfig | null,
  source: StartProofSource,
  keywordOk: boolean,
): StartProofStatus {
  if (cfg?.autoAcceptPlugin && source === 'plugin' && keywordOk) return 'accepted';
  return 'pending';
}
