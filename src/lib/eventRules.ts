// Per-event game rules — the third axis on top of (format, scoringMode). Stored as JSON in
// `events.rules` (NULL = classic behaviour). Rules decide HOW tiles become playable (the reveal
// policy) and how points are awarded per completion (first-team bonus, reveal decay, lockout).
//
// Reveal policies:
//   'all'       — classic: every tile is visible once the event-level tilesRevealed flag flips.
//   'scheduled' — tiles carry a per-tile revealAt time (Tiles tab); the reveal engine flips each
//                 one live as its time passes. DMM All Stars-style "tile of the hour" boards.
//   'interval'  — the engine draws revealBatchSize hidden tiles every revealIntervalMinutes
//                 (random or in position order), starting at event start. "Bingo caller" boards.
//   'bounty'    — exactly one tile is open at a time; the first team to complete it claims it
//                 (tile closes) and the next tile is drawn immediately.
//   'rotating'  — a rolling WINDOW of revealWindowSize open tiles: each interval draw opens new
//                 random tiles and EXPIRES (closes) the oldest so the window stays that size.
//                 Unlike bounty, an open tile can be completed by many players before it expires
//                 (individual ladders). "Rotating tasks" boards.
//
// A tile on a reveal-policy event is member-visible iff tiles.revealedAt is set. The event-level
// tilesRevealed flag stays the master gate: while it's 0 nothing is visible and the engine does
// not run, so hosts still author privately and "arm" the board deliberately (or via start-now).
//
// Scoring modifiers (points-mode only; frozen into completions.awardedPoints at completion time):
//   firstBonus — extra points for the FIRST team to complete each tile.
//   decay      — a tile's points scale linearly from 100% at reveal to `targetPct%` after `hours`,
//                then hold. targetPct < 100 DECAYS (rewards racing; 0 = down to nothing), targetPct
//                > 100 GROWS (rewards patience / clearing older tasks). Independent of expiry — pair
//                with the 'rotating' reveal policy to also close the task, or leave it open.
//   lockout    — first completion locks the tile for every other team (works in tiles mode too;
//                affects gating, not weights).

export type RevealPolicy = 'all' | 'scheduled' | 'interval' | 'bounty' | 'rotating';
export type RevealOrder = 'random' | 'sequential';

// MISSIONS — a subset of a bingo's tiles authored up front but HIDDEN, announced mid-event from
// their own pool (independent of the board's revealPolicy). How/when they drop is the event-level
// `rules.mission` announce policy below; each mission's SCORING (lockout/firstBonus/decay/expiry)
// lives per-tile in `tiles.rules` (see MissionRules). Announcing a mission stamps its `revealedAt`
// (the decay anchor); the board's normal tiles stay visible throughout.
export type MissionAnnounceMode = 'manual' | 'interval' | 'scheduled';

/**
 * One phase of a mission difficulty curve: which tiers may be drawn until `throughPct` of the event
 * has passed. Declared here because this file owns the rule shape and imports nothing — the drawing
 * itself lives in lib/missionRamp, which needs the tier bands.
 */
export interface RampPhase {
  /** 1–100. The share of the event this phase covers up TO; the last phase should end at 100. */
  throughPct: number;
  /** Tier band keys (lib/tileFilter). Empty = no restriction during this phase. */
  tiers: string[];
}

export interface MissionConfig {
  /** manual = admin drops each; interval = every intervalMinutes; scheduled = per-tile revealAt. */
  announceMode: MissionAnnounceMode;
  /** Which hidden mission is drawn next (random, or by board position). */
  order: RevealOrder;
  /** 'interval' mode: minutes between mission drops. */
  intervalMinutes: number;
  /**
   * Difficulty curve over the run: each phase names the tiers eligible up to a share of the event
   * ("first third easy, middle medium and hard, last third ultra"). Empty = one pool, no phases.
   *
   * Shares rather than dates so a board cloned into a fortnight instead of a weekend still means
   * the same thing. See lib/missionRamp — including why an exhausted phase falls back to the whole
   * pool rather than announcing nothing.
   */
  tierRamp: RampPhase[];
}

// STARTING SHOT — the anti-stack start proof. When required, every enrolled player must upload a
// screenshot taken AFTER the event went live: the in-game Anvil overlay (plugin) or a per-player
// keyword typed in-game (mobile), taken at a location drawn at the start moment. See lib/startProof.
// The keyword is derived from `events.startProofDrawnAt`, a value that does not exist until start,
// so nothing about the shot can be staged in advance.
export type StartProofMissing = 'flag' | 'reject';

/**
 * One spot the start location can be drawn from. The label is what everyone reads ("Edgeville
 * bank"); the coordinates are optional and turn the spot from a written instruction into a CHECK —
 * the plugin reports where the player actually stood and the server measures the distance.
 *
 * Coordinate-less entries stay legal (and are what a plain string parses into), so a host can name
 * somewhere the map picker can't express and lose nothing but the automatic check.
 */
export interface StartLocation {
  label: string;
  /** Game coordinates of the spot, pinned on the map picker. Null/null = label only, no check. */
  x: number | null;
  y: number | null;
  /** How close counts, in game squares. Null = the built-in default (lib/startProof). */
  radius: number | null;
}

export interface StartProofConfig {
  /** What happens to a submission from a player with no accepted starting shot.
   *  'flag'   — take the submission, stamp submissions.flaggedReason for admin review (default;
   *             never loses evidence for a drop that really happened).
   *  'reject' — 409 `start_proof_required`; the plugin keeps the drop in its pending store. */
  onMissing: StartProofMissing;
  /** Accept a plugin capture outright when the server recomputes its keyword to a match. */
  autoAcceptPlugin: boolean;
  /** Host-supplied location pool to draw the start spot from. Empty = the built-in START_LOCATIONS. */
  locations: StartLocation[];
  /**
   * How fresh the player's game session has to be when they take the shot, in minutes. 0 = off.
   *
   * The point isn't the screenshot: hiscores only flush on LOGOUT, so a player who has been logged
   * in since before the event started has a stale start baseline and their first sweep reads as
   * gains they made before the whistle. Making them log out and back in right before the shot
   * flushes it. The plugin knows when this session began and refuses to file a stale one; the
   * server records the reported age so staff can see it.
   */
  maxSessionMinutes: number;
}

// How much the player-profile engine steers team formation (balance-engine plan, Part C).
// 'off' = current behaviour. 'advisory' = staff see strength bars / badges, nothing enforced.
// 'tiered-snake' = the draft blocks stacking top-tier players while another team has none.
// 'dynamic-order' = the weakest projected team picks next each round instead of fixed serpentine.
// 'spread-cap' = a captain may only take someone whose rating wouldn't push their team further than
//                `balanceSpreadCapPct` above the average roster. The strongest team gets the
//                shortest list; the weakest can take anyone. Strictly stronger than tiered-snake,
//                which only polices the top two tiers.
// 'auto' = teams are built by the greedy balancer ("Balance teams" button); the draft is skipped.
export type BalanceMode = 'off' | 'advisory' | 'tiered-snake' | 'dynamic-order' | 'spread-cap' | 'auto';

export interface EventRules {
  revealPolicy: RevealPolicy;
  /** 'interval' policy: minutes between draws. */
  revealIntervalMinutes: number;
  /** 'interval' / 'rotating' policy: tiles revealed per draw. */
  revealBatchSize: number;
  /** 'rotating' policy: how many tiles stay open at once (older ones expire as new ones draw). */
  revealWindowSize: number;
  /** 'interval' / 'bounty' / 'rotating': which hidden tile is drawn next. */
  revealOrder: RevealOrder;
  /** Extra points for the first team completing a tile. 0 = off. */
  firstBonus: number;
  /** Linear points scaling after reveal: from 100% to `targetPct%` over `hours`, then held. < 100
   *  decays (0 = to nothing), > 100 grows. `floorPct` is the legacy key (still parsed). Null = off. */
  decay: { targetPct: number; hours: number } | null;
  /** First completion locks the tile for all other teams. Implied by 'bounty'. */
  lockout: boolean;
  /** Team-formation steering from player profiles. Never blocks event start; 'off' = classic. */
  balanceMode: BalanceMode;
  /** 'spread-cap' mode: how far above the average roster a team may go, in pct. */
  balanceSpreadCapPct: number;
  /**
   * Seconds a captain gets per pick before the host may take it for them. 0 = no clock, which is
   * the default: a draft where nobody has agreed a time limit shouldn't grow one silently.
   * Expiring never auto-picks — it unlocks the admin's action and says so on both screens.
   */
  pickSeconds: number;
  /** Mission announce policy (how/when hidden mission tiles drop). Null = no missions on this event. */
  mission: MissionConfig | null;
  /** Starting-shot policy. Null = not required (classic). Non-null = every player must upload one. */
  startProof: StartProofConfig | null;
  /**
   * May a team's own captain (and its staff seats) mint invite links for it? Off by default: on a
   * normal clan event the host builds the teams, and a captain handing out seats would be filling a
   * roster nobody approved. On a clan-v-clan it's the whole point — see lib/teamInvites.
   */
  captainInvites: boolean;
  /**
   * Do players choose their own team when they sign up?
   *
   * The alternative to a draft AND to handing out invite links: the host builds the teams up front,
   * sign-ups stay open to everyone, and each applicant names the team they're joining. It is a
   * REQUEST — approving the sign-up is what seats them — so a team can't be filled by strangers
   * picking it off a list. Off by default: a normal clan event drafts.
   */
  teamChoice: boolean;
}

export const DEFAULT_EVENT_RULES: EventRules = {
  revealPolicy: 'all',
  revealIntervalMinutes: 60,
  revealBatchSize: 1,
  revealWindowSize: 3,
  revealOrder: 'random',
  firstBonus: 0,
  decay: null,
  lockout: false,
  balanceMode: 'off',
  balanceSpreadCapPct: 10,
  pickSeconds: 0,
  mission: null,
  startProof: null,
  captainInvites: false,
  teamChoice: false,
};

/**
 * A starting-shot policy with nothing configured — what "just turn it on" stores. The session
 * window ships ON at 15 minutes: turning the rule on and not getting the baseline flush is the
 * strictly worse setting, and a host who wants it off says so. Events that stored a policy BEFORE
 * this field existed parse to 0 (off) and keep behaving exactly as they did.
 */
export const DEFAULT_START_PROOF: StartProofConfig = {
  onMissing: 'flag',
  autoAcceptPlugin: true,
  locations: [],
  maxSessionMinutes: 15,
};

/** Host location pools stay small — this is a list to draw one line from, not a dataset. */
const MAX_START_LOCATIONS = 40;
const MAX_START_LOCATION_LEN = 80;
/** Sanity bounds on a pinned coordinate. Wide enough for every surface region, tight enough that a
 *  fat-fingered number is caught rather than drawn as the spot nobody can stand on. */
const MIN_START_COORD = 1000;
const MAX_START_COORD = 5000;
/** How close counts, in game squares. Generous: a bank is ~10 squares across and the point is the
 *  town, not the tile. */
export const MIN_START_RADIUS = 3;
export const MAX_START_RADIUS = 200;

const REVEAL_POLICIES: RevealPolicy[] = ['all', 'scheduled', 'interval', 'bounty', 'rotating'];
const MISSION_ANNOUNCE_MODES: MissionAnnounceMode[] = ['manual', 'interval', 'scheduled'];
const BALANCE_MODES: BalanceMode[] = ['off', 'advisory', 'tiered-snake', 'dynamic-order', 'spread-cap', 'auto'];
const START_PROOF_MISSING: StartProofMissing[] = ['flag', 'reject'];

/** One coordinate, or null when it's missing/out of the world. Never throws on garbage. */
function cleanCoord(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  const n = Math.round(raw);
  return n >= MIN_START_COORD && n <= MAX_START_COORD ? n : null;
}

/**
 * Trim + de-dupe a host location pool down to the stored shape. Bad entries drop, never throw.
 *
 * A bare string is still accepted — that's the shape every pool stored before the map picker
 * existed, and it stays the shape a host gets by typing a place we have no pin for.
 */
function cleanLocations(raw: unknown): StartLocation[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: StartLocation[] = [];
  for (const entry of raw) {
    const obj = typeof entry === 'string'
      ? { label: entry }
      : (entry && typeof entry === 'object' && !Array.isArray(entry) ? entry as Record<string, unknown> : null);
    if (!obj) continue;
    const label = typeof obj.label === 'string' ? obj.label.trim().slice(0, MAX_START_LOCATION_LEN) : '';
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const x = cleanCoord(obj.x);
    const y = cleanCoord(obj.y);
    out.push({
      label,
      // Half a pin is no pin: a spot is only checkable with both coordinates.
      x: x != null && y != null ? x : null,
      y: x != null && y != null ? y : null,
      radius: x != null && y != null && obj.radius != null
        ? clampInt(obj.radius, MIN_START_RADIUS, MAX_START_RADIUS, 20)
        : null,
    });
    if (out.length >= MAX_START_LOCATIONS) break;
  }
  return out;
}

/** Tolerant parse of a stored ramp: bad phases are dropped, order is enforced, shares are clamped. */
function parseTierRamp(raw: unknown): RampPhase[] {
  if (!Array.isArray(raw)) return [];
  const phases: RampPhase[] = [];
  for (const entry of raw) {
    const phase = entry as { throughPct?: unknown; tiers?: unknown };
    const pct =
      typeof phase?.throughPct === 'number' && Number.isFinite(phase.throughPct)
        ? Math.max(1, Math.min(100, Math.round(phase.throughPct)))
        : null;
    if (pct == null) continue;
    const tiers = Array.isArray(phase?.tiers)
      ? phase.tiers.filter((t): t is string => typeof t === 'string' && t.length > 0)
      : [];
    phases.push({ throughPct: pct, tiers });
  }
  // Ascending, and never two phases ending at the same point — the later one could never be reached.
  const seen = new Set<number>();
  return phases
    .sort((a, b) => a.throughPct - b.throughPct)
    .filter((p) => (seen.has(p.throughPct) ? false : (seen.add(p.throughPct), true)));
}

const clampInt = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : NaN;
  return Number.isNaN(n) ? fallback : Math.max(min, Math.min(max, n));
};

/** Tolerant parse of the stored `events.rules` JSON. Anything missing/malformed → defaults. */
export function parseEventRules(raw: string | null | undefined): EventRules {
  if (!raw) return DEFAULT_EVENT_RULES;
  let obj: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return DEFAULT_EVENT_RULES;
    obj = parsed as Record<string, unknown>;
  } catch {
    return DEFAULT_EVENT_RULES;
  }
  const policy = REVEAL_POLICIES.includes(obj.revealPolicy as RevealPolicy)
    ? (obj.revealPolicy as RevealPolicy)
    : 'all';
  let decay: EventRules['decay'] = null;
  const d = obj.decay as { targetPct?: unknown; floorPct?: unknown; hours?: unknown } | null | undefined;
  if (d && typeof d === 'object') {
    decay = {
      // Accept the legacy `floorPct` key. Target may exceed 100 for growth (cap 1000% = 10×).
      targetPct: clampInt(d.targetPct ?? d.floorPct, 0, 1000, 50),
      hours: clampInt(d.hours, 1, 720, 24),
    };
  }
  let mission: EventRules['mission'] = null;
  const m = obj.mission as
    | { announceMode?: unknown; order?: unknown; intervalMinutes?: unknown; tierRamp?: unknown }
    | null
    | undefined;
  if (m && typeof m === 'object') {
    mission = {
      announceMode: MISSION_ANNOUNCE_MODES.includes(m.announceMode as MissionAnnounceMode)
        ? (m.announceMode as MissionAnnounceMode)
        : 'manual',
      order: m.order === 'sequential' ? 'sequential' : 'random',
      intervalMinutes: clampInt(m.intervalMinutes, 5, 10080, 60),
      tierRamp: parseTierRamp(m.tierRamp),
    };
  }
  let startProof: EventRules['startProof'] = null;
  const sp = obj.startProof as
    | { onMissing?: unknown; autoAcceptPlugin?: unknown; locations?: unknown; maxSessionMinutes?: unknown }
    | null
    | undefined;
  if (sp && typeof sp === 'object' && !Array.isArray(sp)) {
    startProof = {
      onMissing: START_PROOF_MISSING.includes(sp.onMissing as StartProofMissing)
        ? (sp.onMissing as StartProofMissing)
        : 'flag',
      // Only an explicit false turns auto-accept off — an older/partial object keeps the default.
      autoAcceptPlugin: sp.autoAcceptPlugin !== false,
      locations: cleanLocations(sp.locations),
      // Absent = 0 = off, so a policy stored before this field existed doesn't grow a new demand
      // on its players mid-event. `DEFAULT_START_PROOF` is what a fresh turn-on gets.
      maxSessionMinutes: clampInt(sp.maxSessionMinutes, 0, 720, 0),
    };
  }
  return {
    revealPolicy: policy,
    revealIntervalMinutes: clampInt(obj.revealIntervalMinutes, 5, 10080, 60),
    revealBatchSize: clampInt(obj.revealBatchSize, 1, 50, 1),
    revealWindowSize: clampInt(obj.revealWindowSize, 1, 50, 3),
    revealOrder: obj.revealOrder === 'sequential' ? 'sequential' : 'random',
    firstBonus: clampInt(obj.firstBonus, 0, 100000, 0),
    decay,
    // Bounty is single-claim by definition — treat it as lockout everywhere.
    lockout: obj.lockout === true || policy === 'bounty',
    balanceMode: BALANCE_MODES.includes(obj.balanceMode as BalanceMode)
      ? (obj.balanceMode as BalanceMode)
      : 'off',
    // A cap under ~5% is unhittable once ratings differ at all, and one over 50% never binds.
    balanceSpreadCapPct: clampInt(obj.balanceSpreadCapPct, 5, 50, 10),
    // 0 = off. Below half a minute is a misconfiguration, not a fast draft.
    pickSeconds: obj.pickSeconds === 0 ? 0 : clampInt(obj.pickSeconds, 30, 3600, 0),
    mission,
    startProof,
    captainInvites: obj.captainInvites === true,
    teamChoice: obj.teamChoice === true,
  };
}

/**
 * Validate an API-supplied rules object and return the canonical JSON to store, or an error.
 * Returns `{ rules: null }` when everything is at its default — store NULL, not '{}', so classic
 * events keep a NULL column and old code paths stay bit-identical.
 */
export function validateEventRules(input: unknown): { rules: string | null } | { error: string } {
  if (input == null) return { rules: null };
  if (typeof input !== 'object' || Array.isArray(input)) {
    return { error: 'rules must be an object' };
  }
  const o = input as Record<string, unknown>;
  if (o.revealPolicy !== undefined && !REVEAL_POLICIES.includes(o.revealPolicy as RevealPolicy)) {
    return { error: "rules.revealPolicy must be 'all', 'scheduled', 'interval', 'bounty', or 'rotating'" };
  }
  if (o.revealOrder !== undefined && o.revealOrder !== 'random' && o.revealOrder !== 'sequential') {
    return { error: "rules.revealOrder must be 'random' or 'sequential'" };
  }
  for (const [key, min, max] of [
    ['revealIntervalMinutes', 5, 10080],
    ['revealBatchSize', 1, 50],
    ['revealWindowSize', 1, 50],
    ['firstBonus', 0, 100000],
    ['balanceSpreadCapPct', 5, 50],
  ] as const) {
    const v = o[key];
    if (v !== undefined && (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max)) {
      return { error: `rules.${key} must be an integer between ${min} and ${max}` };
    }
  }
  if (o.decay !== undefined && o.decay !== null) {
    const d = o.decay as { targetPct?: unknown; floorPct?: unknown; hours?: unknown };
    const t = d.targetPct ?? d.floorPct; // legacy key accepted
    if (
      typeof d !== 'object' ||
      typeof t !== 'number' || !Number.isInteger(t) || t < 0 || t > 1000 ||
      typeof d.hours !== 'number' || !Number.isFinite(d.hours) || d.hours < 1 || d.hours > 720
    ) {
      return { error: 'rules.decay must be { targetPct: 0–1000, hours: 1–720 } or null' };
    }
  }
  if (o.lockout !== undefined && typeof o.lockout !== 'boolean') {
    return { error: 'rules.lockout must be a boolean' };
  }
  if (o.balanceMode !== undefined && !BALANCE_MODES.includes(o.balanceMode as BalanceMode)) {
    return { error: "rules.balanceMode must be 'off', 'advisory', 'tiered-snake', 'dynamic-order', 'spread-cap', or 'auto'" };
  }
  if (
    o.pickSeconds !== undefined &&
    (typeof o.pickSeconds !== 'number' || !Number.isInteger(o.pickSeconds) ||
      (o.pickSeconds !== 0 && (o.pickSeconds < 30 || o.pickSeconds > 3600)))
  ) {
    return { error: 'rules.pickSeconds must be 0 (off) or an integer between 30 and 3600' };
  }
  if (o.mission !== undefined && o.mission !== null) {
    const m = o.mission as {
      announceMode?: unknown;
      order?: unknown;
      intervalMinutes?: unknown;
      tierRamp?: unknown;
    };
    if (typeof m !== 'object' || Array.isArray(m)) {
      return { error: 'rules.mission must be an object or null' };
    }
    if (m.announceMode !== undefined && !MISSION_ANNOUNCE_MODES.includes(m.announceMode as MissionAnnounceMode)) {
      return { error: "rules.mission.announceMode must be 'manual', 'interval', or 'scheduled'" };
    }
    if (m.order !== undefined && m.order !== 'random' && m.order !== 'sequential') {
      return { error: "rules.mission.order must be 'random' or 'sequential'" };
    }
    const iv = m.intervalMinutes;
    if (iv !== undefined && (typeof iv !== 'number' || !Number.isInteger(iv) || iv < 5 || iv > 10080)) {
      return { error: 'rules.mission.intervalMinutes must be an integer between 5 and 10080' };
    }
    if (m.tierRamp !== undefined) {
      if (!Array.isArray(m.tierRamp)) {
        return { error: 'rules.mission.tierRamp must be an array of phases' };
      }
      let previous = 0;
      for (const raw of m.tierRamp) {
        const phase = raw as { throughPct?: unknown; tiers?: unknown };
        const pct = phase?.throughPct;
        if (typeof pct !== 'number' || !Number.isFinite(pct) || pct < 1 || pct > 100) {
          return { error: 'each tierRamp phase needs a throughPct between 1 and 100' };
        }
        // Ascending, because a phase that ends before the one before it can never be reached.
        if (pct <= previous) {
          return { error: 'tierRamp phases must run in order, each ending later than the last' };
        }
        previous = pct;
        if (!Array.isArray(phase?.tiers) || phase.tiers.some((t) => typeof t !== 'string')) {
          return { error: 'each tierRamp phase needs a tiers array of band keys' };
        }
      }
    }
  }
  if (o.captainInvites !== undefined && typeof o.captainInvites !== 'boolean') {
    return { error: 'rules.captainInvites must be a boolean' };
  }
  if (o.teamChoice !== undefined && typeof o.teamChoice !== 'boolean') {
    return { error: 'rules.teamChoice must be a boolean' };
  }
  if (o.startProof !== undefined && o.startProof !== null) {
    const s = o.startProof as {
      onMissing?: unknown; autoAcceptPlugin?: unknown; locations?: unknown; maxSessionMinutes?: unknown;
    };
    if (typeof s !== 'object' || Array.isArray(s)) {
      return { error: 'rules.startProof must be an object or null' };
    }
    if (s.onMissing !== undefined && !START_PROOF_MISSING.includes(s.onMissing as StartProofMissing)) {
      return { error: "rules.startProof.onMissing must be 'flag' or 'reject'" };
    }
    if (s.autoAcceptPlugin !== undefined && typeof s.autoAcceptPlugin !== 'boolean') {
      return { error: 'rules.startProof.autoAcceptPlugin must be a boolean' };
    }
    if (s.locations !== undefined && !Array.isArray(s.locations)) {
      return { error: 'rules.startProof.locations must be an array of places' };
    }
    // A pin that lands outside the world would be silently dropped by the parser and the host would
    // never learn why their spot stopped being checked — so say it here instead.
    if (Array.isArray(s.locations)) {
      for (const entry of s.locations) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
        const e = entry as { x?: unknown; y?: unknown };
        for (const key of ['x', 'y'] as const) {
          const v = e[key];
          if (v == null) continue;
          if (typeof v !== 'number' || !Number.isFinite(v) || v < MIN_START_COORD || v > MAX_START_COORD) {
            return { error: `rules.startProof.locations[].${key} must be a game coordinate between ${MIN_START_COORD} and ${MAX_START_COORD}` };
          }
        }
      }
    }
    const ms = s.maxSessionMinutes;
    if (ms !== undefined && (typeof ms !== 'number' || !Number.isInteger(ms) || ms < 0 || ms > 720)) {
      return { error: 'rules.startProof.maxSessionMinutes must be an integer between 0 (off) and 720' };
    }
  }
  // Canonicalise through the parser so what we store is exactly what reads produce.
  const canonical = parseEventRules(JSON.stringify(o));
  const isDefault =
    canonical.revealPolicy === 'all' &&
    canonical.firstBonus === 0 &&
    canonical.decay === null &&
    !canonical.lockout &&
    canonical.balanceMode === 'off' &&
    canonical.balanceSpreadCapPct === 10 &&
    canonical.pickSeconds === 0 &&
    canonical.mission === null &&
    canonical.startProof === null &&
    !canonical.captainInvites &&
    !canonical.teamChoice;
  return { rules: isDefault ? null : JSON.stringify(canonical) };
}

/** True when the event reveals tiles per-tile (any policy other than classic 'all'). */
export function hasRevealPolicy(rules: EventRules): boolean {
  return rules.revealPolicy !== 'all';
}

/** True when this event has a mission announce policy configured. */
export function hasMissions(rules: EventRules): boolean {
  return rules.mission != null;
}

/** True when players must upload a starting shot before their credits count (lib/startProof). */
export function requiresStartProof(rules: EventRules): boolean {
  return rules.startProof != null;
}

type RevealStateTile = {
  revealAt?: string | null;
  revealedAt?: string | null;
  closedAt?: string | null;
  mission?: boolean | number | null;
};

/** A mission tile (hidden until announced), across the DB int (0/1) and boolean shapes. */
export function isMissionTile(tile: { mission?: boolean | number | null }): boolean {
  return tile.mission === true || tile.mission === 1;
}

/**
 * Member-visibility of one tile. A MISSION tile is visible only once announced (`revealedAt` set),
 * regardless of the board's policy — so a classic bingo can hide missions while its normal tiles show.
 * A non-mission tile follows the board: always visible on classic, else visible once revealed.
 */
export function isTileRevealed(rules: EventRules, tile: RevealStateTile): boolean {
  if (isMissionTile(tile)) return tile.revealedAt != null;
  return !hasRevealPolicy(rules) || tile.revealedAt != null;
}

/**
 * The BOARD: the tiles an event is actually scored on, missions excluded.
 *
 * A mission is not a board tile that happens to be hidden — it's a separate kind of thing. It drops
 * mid-event from its own pool, carries its own scoring (lockout, first-clear bonus, decay), can
 * expire unclaimed, and is a bonus on top of the board rather than part of it. Counting one toward
 * "14 / 25 tiles" or "116 pts on the board" moves the denominator under everyone the moment it's
 * announced, and quietly changes what a completion percentage means mid-event.
 *
 * So every board total, progress bar and tile count runs through this; missions are surfaced and
 * scored on their own.
 */
export function boardTiles<T extends { mission?: boolean | number | null }>(tiles: T[]): T[] {
  return tiles.filter((t) => !isMissionTile(t));
}

/** The mission subset — the other half of {@link boardTiles}. */
export function missionTiles<T extends { mission?: boolean | number | null }>(tiles: T[]): T[] {
  return tiles.filter(isMissionTile);
}

/** The member-visible subset of an event's tiles. Closed (claimed/expired) tiles stay visible. */
export function visibleTiles<T extends RevealStateTile>(rules: EventRules, tiles: T[]): T[] {
  // Fast path: classic board with no mission tiles → everything is visible (bit-identical to before).
  if (!hasRevealPolicy(rules) && !tiles.some(isMissionTile)) return tiles;
  return tiles.filter((t) => isTileRevealed(rules, t));
}

/** True when a tile can still accept completions under the rules (revealed and not claimed/expired). */
export function isTileOpen(rules: EventRules, tile: RevealStateTile): boolean {
  if (!isTileRevealed(rules, tile)) return false;
  return tile.closedAt == null;
}

/**
 * When the next tile(s) will appear, for countdowns. Null when nothing further is scheduled
 * (no hidden tiles left, bounty policy — where the next draw is completion-driven — or classic).
 */
export function nextRevealAt(
  event: { startDate: string | null; rules?: string | null },
  rules: EventRules,
  tiles: RevealStateTile[],
  nowMs: number = Date.now(),
): string | null {
  if (!hasRevealPolicy(rules)) return null;
  const hidden = tiles.filter((t) => t.revealedAt == null);
  if (hidden.length === 0) return null;
  if (rules.revealPolicy === 'scheduled') {
    const planned = hidden
      .map((t) => t.revealAt)
      .filter((v): v is string => !!v)
      .sort();
    return planned[0] ?? null;
  }
  if (rules.revealPolicy === 'interval' || rules.revealPolicy === 'rotating') {
    const lastRevealed = tiles
      .map((t) => t.revealedAt)
      .filter((v): v is string => !!v)
      .sort()
      .pop();
    const anchor = lastRevealed ?? event.startDate;
    if (!anchor) return null;
    const anchorMs = Date.parse(anchor);
    if (!Number.isFinite(anchorMs)) return null;
    const stepMs = rules.revealIntervalMinutes * 60_000;
    // First draw fires AT start; afterwards one interval after the previous draw. If we're
    // somehow past due (engine lag), show now-ish rather than a time in the past.
    const next = lastRevealed ? anchorMs + stepMs : anchorMs;
    return new Date(Math.max(next, nowMs)).toISOString();
  }
  return null; // bounty: next draw fires on completion, not on a clock
}

/**
 * When each currently-open tile will ROTATE OUT, on a 'rotating' board.
 *
 * The window holds `revealWindowSize` tiles: every draw opens `revealBatchSize` new ones and closes
 * the same number of oldest ones to make room. So the oldest open tile expires at the next draw,
 * the next-oldest one draw later, and so on — which means a member can be told how long a task has
 * left without the engine having to write an expiry column it would then have to keep in sync.
 *
 * Empty for every other policy: a lucky-draw tile stays open forever, a bounty closes on a claim,
 * and a scheduled board doesn't take anything away.
 */
export function rotationExpiries(
  rules: EventRules,
  openTiles: { id: number; revealedAt?: string | null }[],
  nextRevealAt: string | null,
): Map<number, string> {
  const out = new Map<number, string>();
  if (rules.revealPolicy !== 'rotating' || !nextRevealAt) return out;
  const nextMs = Date.parse(nextRevealAt);
  if (!Number.isFinite(nextMs)) return out;
  const stepMs = rules.revealIntervalMinutes * 60_000;
  const batch = Math.max(1, rules.revealBatchSize);
  const oldestFirst = [...openTiles]
    .filter((t) => !!t.revealedAt)
    .sort((a, b) => (a.revealedAt! < b.revealedAt! ? -1 : a.revealedAt! > b.revealedAt! ? 1 : a.id - b.id));
  oldestFirst.forEach((t, i) => {
    out.set(t.id, new Date(nextMs + Math.floor(i / batch) * stepMs).toISOString());
  });
  return out;
}

/**
 * When the next MISSION drops, for the in-game countdown. Mirrors {@link nextRevealAt} but over the
 * mission pool + `rules.mission` announce policy: scheduled → earliest hidden mission's revealAt;
 * interval → one interval after the last announced mission (or event start); manual/none → null.
 */
export function nextMissionAt(
  event: { startDate?: string | null },
  rules: EventRules,
  tiles: RevealStateTile[],
  nowMs: number = Date.now(),
): string | null {
  const cfg = rules.mission;
  if (!cfg) return null;
  const missionTiles = tiles.filter(isMissionTile);
  const hidden = missionTiles.filter((t) => t.revealedAt == null);
  if (hidden.length === 0) return null;
  if (cfg.announceMode === 'scheduled') {
    const earliest = hidden.map((t) => t.revealAt).filter((v): v is string => !!v).sort()[0];
    if (!earliest) return null;
    const at = Date.parse(earliest);
    return Number.isFinite(at) ? new Date(Math.max(at, nowMs)).toISOString() : null;
  }
  if (cfg.announceMode === 'interval') {
    const lastAnnounced = missionTiles
      .map((t) => t.revealedAt)
      .filter((v): v is string => !!v)
      .sort()
      .pop();
    const anchor = lastAnnounced ?? event.startDate;
    if (!anchor) return null;
    const anchorMs = Date.parse(anchor);
    if (!Number.isFinite(anchorMs)) return null;
    const next = lastAnnounced ? anchorMs + cfg.intervalMinutes * 60_000 : anchorMs;
    return new Date(Math.max(next, nowMs)).toISOString();
  }
  return null; // manual
}

/**
 * Points actually earned by a completion, or null when nothing rule-driven applies (classic
 * points/tiles events stay on live tile weights). Frozen into completions.awardedPoints.
 */
export function completionAward(args: {
  scoringMode: string | null | undefined;
  rules: EventRules;
  tilePoints: number | null | undefined;
  tileRevealedAt: string | null | undefined;
  isFirst: boolean;
  nowMs?: number;
}): number | null {
  if (args.scoringMode !== 'points') return null;
  const { rules } = args;
  if (rules.firstBonus <= 0 && rules.decay == null) return null;
  let pts = decayedPoints(args.tilePoints, args.tileRevealedAt, rules.decay, args.nowMs);
  if (args.isFirst && rules.firstBonus > 0) pts += rules.firstBonus;
  return pts;
}

/**
 * What a tile is worth RIGHT NOW under a decay/growth ramp — linear from 100% at reveal to
 * `targetPct%` after `hours`, then held.
 *
 * Split out of {@link completionAward} because the board shows this number live, ticking, while a
 * task is open. Anything that displays a value has to compute it the same way the award does, or
 * the site advertises a number it won't pay out.
 */
export function decayedPoints(
  points: number | null | undefined,
  revealedAt: string | null | undefined,
  decay: EventRules['decay'],
  nowMs?: number,
): number {
  const base = points ?? 0;
  if (!decay || !revealedAt) return base;
  const revealedMs = Date.parse(revealedAt);
  const now = nowMs ?? Date.now();
  if (!Number.isFinite(revealedMs) || now <= revealedMs) return base;
  const frac = Math.min(1, (now - revealedMs) / (decay.hours * 3_600_000));
  const target = decay.targetPct / 100; // < 1 decays toward it, > 1 grows toward it
  return Math.max(0, Math.round(base * (1 - (1 - target) * frac)));
}

/** How far through its decay/growth ramp a tile is, 0–1. 0 when nothing ramps. */
export function decayProgress(
  revealedAt: string | null | undefined,
  decay: EventRules['decay'],
  nowMs?: number,
): number {
  if (!decay || !revealedAt) return 0;
  const revealedMs = Date.parse(revealedAt);
  const now = nowMs ?? Date.now();
  if (!Number.isFinite(revealedMs) || now <= revealedMs) return 0;
  return Math.min(1, (now - revealedMs) / (decay.hours * 3_600_000));
}

// ---- Per-mission scoring (tiles.rules) --------------------------------------------------------
// Each mission tile carries its own lockout / first-clear bonus / decay-or-grow / auto-expiry. These
// are the SAME modifiers as the event-level rules, but scoped to one mission and merged over the event
// rules in the completion gate. Decay + firstBonus only bite in a points-scoring event (completionAward
// gates on scoringMode); lockout works anywhere. `expiryHours` auto-closes an unclaimed mission.
export interface MissionRules {
  lockout: boolean;
  firstBonus: number;
  decay: { targetPct: number; hours: number } | null;
  /** Hours after announce a mission auto-closes if unclaimed. Null = never (open till claimed/end). */
  expiryHours: number | null;
}

export const DEFAULT_MISSION_RULES: MissionRules = { lockout: false, firstBonus: 0, decay: null, expiryHours: null };

/** Tolerant parse of a tile's `rules` JSON. Anything missing/malformed → the no-modifier default. */
export function parseTileMissionRules(raw: string | null | undefined): MissionRules {
  if (!raw) return DEFAULT_MISSION_RULES;
  let o: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return DEFAULT_MISSION_RULES;
    o = parsed as Record<string, unknown>;
  } catch {
    return DEFAULT_MISSION_RULES;
  }
  let decay: MissionRules['decay'] = null;
  const d = o.decay as { targetPct?: unknown; floorPct?: unknown; hours?: unknown } | null | undefined;
  if (d && typeof d === 'object') {
    decay = { targetPct: clampInt(d.targetPct ?? d.floorPct, 0, 1000, 50), hours: clampInt(d.hours, 1, 720, 24) };
  }
  return {
    lockout: o.lockout === true,
    firstBonus: clampInt(o.firstBonus, 0, 100000, 0),
    decay,
    expiryHours: o.expiryHours == null ? null : clampInt(o.expiryHours, 1, 8760, 24),
  };
}

/**
 * Canonical JSON for a tile's mission rules, or null when everything is at its default (store NULL so
 * a non-mission tile keeps a NULL `rules` column). Used by the tile-edit API + CSV import.
 */
export function serializeTileMissionRules(input: Partial<MissionRules> | null | undefined): string | null {
  if (!input) return null;
  const m = parseTileMissionRules(JSON.stringify(input));
  const isDefault = !m.lockout && m.firstBonus === 0 && m.decay === null && m.expiryHours === null;
  return isDefault ? null : JSON.stringify(m);
}
