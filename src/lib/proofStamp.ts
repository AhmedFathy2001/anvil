// Site-drawn proof stamps (the banner that used to be baked in by the plugin).
//
// The plugin now uploads the CLEAN frame and sends what the banner should say; the site draws it
// (lib/proofStampImage) and keeps both files, so a viewer can hide the stamp and see what was under
// it. Everything here is pure — parsing what the client claimed, picking the game lines worth
// showing, and the text of the stamp.
//
// TRUST. Everything in `ProofClaims` is self-reported by a public, modifiable client. The stamp is
// evidence for a human looking at it, never a verdict; the only facts on it the client can't
// influence are the server's received time, the proof id and the image hash.

/** What the plugin sends alongside a clean proof image. Every field is optional and clamped. */
export interface ProofClaims {
  title: string;
  detail: string;
  /** IANA zone of the player's PC, e.g. "Africa/Cairo". */
  tz: string | null;
  /** The player's PC clock at capture, epoch ms. */
  capturedAt: number | null;
  /** Game tick the credit happened on; game lines are measured against it. */
  tick: number | null;
  /** Two stacked frames (at drop / moments later): where the second starts, as a fraction of height. */
  split: number | null;
  chat: ChatLine[];
}

export interface ChatLine {
  tick: number;
  /** RuneLite ChatMessageType name. */
  type: string;
  text: string;
}

/**
 * Message types a player cannot type into. Public, private, friends and clan CHAT are deliberately
 * absent: someone typing "Valuable drop: Infernal cape" must never reach a proof.
 */
const GAME_TYPES = new Set([
  'GAMEMESSAGE', 'SPAM', 'MESBOX', 'ENGINE', 'BROADCAST', 'FRIENDSCHATNOTIFICATION',
  'CLAN_MESSAGE', 'CLAN_GIM_MESSAGE', 'CLAN_GUEST_MESSAGE',
]);

/**
 * Jagex's own wording for the lines a proof is about. Anything else — including every plugin's own
 * chat output, which RuneLite posts as GAMEMESSAGE too — is dropped.
 */
const GAME_LINES: RegExp[] = [
  /^Valuable drop: /,
  /^Untradeable drop: /,
  / received a drop: /,
  /^New item added to your collection log: /,
  /^Your .+ (?:kill|completion|completed|lap|success|subdued|opened|harvest)?\s*count is: [\d,]+/i,
  /^Your completed .+ count is: [\d,]+/i,
  /(?:Fight|Challenge|Raid|Delve)? ?(?:duration|completion time): ?[\d:.]+/i,
  /^You have a funny feeling like you(?:'re| would have been) being followed/,
  /^You feel something weird sneaking into your backpack/,
  /^Congratulations, you've completed an? .+ combat task/,
  /^Well done! You have completed an? .+ task in the .+ area/,
  /^You have defeated /,
  /^You are victorious!/,
];

/** How far before the credit tick a game line may be (≈15s: drop coalescing + the dual frame). */
const LINE_WINDOW_BEFORE = 25;
const LINE_WINDOW_AFTER = 2;
const MAX_LINES = 6;

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : '';
}

function int(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : null;
}

function validZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Strip Jagex markup (<col=..>, <img=..>, <br>) and RuneLite's nbsp. */
export function plainText(raw: string): string {
  return raw.replace(/<br>/gi, ' ').replace(/<[^>]*>/g, '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

/** Null when the body carries no `proof` object — an older plugin that baked its own banner. */
export function parseProofClaims(raw: unknown): ProofClaims | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const tz = str(r.tz, 64);
  const split = typeof r.split === 'number' && r.split > 0.1 && r.split < 0.9 ? r.split : null;
  const chat = Array.isArray(r.chat)
    ? r.chat.slice(-40).flatMap((c): ChatLine[] => {
        if (!c || typeof c !== 'object') return [];
        const o = c as Record<string, unknown>;
        const tick = int(o.tick);
        const text = str(o.text, 300);
        return tick != null && text ? [{ tick, type: str(o.type, 40), text }] : [];
      })
    : [];
  return {
    title: str(r.title, 40) || 'BINGO PROOF',
    detail: str(r.detail, 90),
    tz: tz && validZone(tz) ? tz : null,
    capturedAt: int(r.capturedAt),
    tick: int(r.tick),
    split,
    chat,
  };
}

/**
 * The game lines worth printing on the stamp: game-only types, Jagex's wording, near the credit.
 * Returned with their tick offset so the stamp reads "-3t" rather than a wall clock the client set.
 */
export function gameLines(claims: ProofClaims): { offset: number; text: string }[] {
  const at = claims.tick;
  if (at == null) return [];
  return claims.chat
    .filter((c) => GAME_TYPES.has(c.type) && c.tick >= at - LINE_WINDOW_BEFORE && c.tick <= at + LINE_WINDOW_AFTER)
    .map((c) => ({ offset: c.tick - at, text: plainText(c.text) }))
    .filter((c) => c.text && !c.text.startsWith('[Anvil]') && GAME_LINES.some((re) => re.test(c.text)))
    .slice(-MAX_LINES);
}

/** Flag reasons this module can raise (submissions.flaggedReason). Flags never block a credit. */
export const PROOF_IMAGE_MISMATCH_FLAG = 'proof_image_mismatch';
export const CAPTURED_BEFORE_START_FLAG = 'captured_before_start';
export const CLOCK_AHEAD_FLAG = 'capture_clock_ahead';

/** Tolerance for a PC clock running fast before "captured in the future" means something. */
const CLOCK_SKEW_MS = 2 * 60_000;

/**
 * Is anything about the capture worth a human look? A capture dated long before it arrived is
 * normal (the plugin keeps proofs through an outage and retries), so only two things count: a clock
 * that claims the future, and a capture from before the event began.
 */
export function captureFlag(claims: ProofClaims, receivedAt: number, eventStartMs: number | null): string | null {
  if (claims.capturedAt == null) return null;
  if (claims.capturedAt > receivedAt + CLOCK_SKEW_MS) return CLOCK_AHEAD_FLAG;
  if (eventStartMs != null && claims.capturedAt < eventStartMs - CLOCK_SKEW_MS) return CAPTURED_BEFORE_START_FLAG;
  return null;
}

function fmt(ms: number, tz: string): string {
  // en-CA gives an ISO-shaped yyyy-mm-dd; the time part is 24h.
  const d = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).format(new Date(ms));
  return d.replace(',', '');
}

function zoneOffset(ms: number, tz: string): string {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
    .formatToParts(new Date(ms))
    .find((p) => p.type === 'timeZoneName')?.value;
  return part === 'GMT' ? 'UTC+0' : (part ?? '').replace('GMT', 'UTC');
}

function gap(ms: number): string {
  const s = Math.round(Math.abs(ms) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${Math.round(s / 360) / 10}h`;
}

export interface StampModel {
  title: string;
  detail: string;
  meta: string[];
  lines: string[];
  footer: string;
  split: number | null;
}

/** The text of the stamp. Server-only facts (received, id, hash) go in the footer. */
export function stampModel(input: {
  claims: ProofClaims;
  rsn: string | null;
  team: string | null;
  event: string | null;
  receivedAt: number;
  submissionId: number;
  sha256: string | null;
}): StampModel {
  const { claims, receivedAt } = input;
  const meta: string[] = [];
  if (input.rsn) meta.push(`RSN: ${input.rsn}`);
  if (input.team) meta.push(`Team: ${input.team}`);
  if (input.event) meta.push(`Event: ${input.event}`);
  const at = claims.capturedAt ?? receivedAt;
  meta.push(`Captured: ${fmt(at, 'UTC')} UTC`);
  if (claims.tz && claims.tz !== 'UTC') {
    meta.push(`Local: ${fmt(at, claims.tz)} (${claims.tz}, ${zoneOffset(at, claims.tz)}) · captured timezone`);
  }
  const delta = receivedAt - at;
  meta.push(`Received: ${fmt(receivedAt, 'UTC')} UTC${claims.capturedAt != null && Math.abs(delta) >= 1000 ? ` (${delta >= 0 ? '+' : '−'}${gap(delta)})` : ''}`);
  const lines = gameLines(claims).map((l) => `${l.offset === 0 ? ' 0t' : `${l.offset}t`.padStart(3)}  ${l.text}`);
  const hash = input.sha256 ? ` · sha256 ${input.sha256.slice(0, 12)}` : '';
  return {
    title: claims.title,
    detail: claims.detail,
    meta,
    lines,
    footer: `Proof #${input.submissionId}${hash} · stamped by Anvil`,
    split: claims.split,
  };
}
