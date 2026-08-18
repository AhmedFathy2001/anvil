// A link that puts someone straight onto one team.
//
// Clan-v-clan is the case this exists for. The visiting side fields its own roster, and until now
// the host had to collect a dozen RSNs by hand, sign each one up, and then drag them onto the right
// team — for a clan whose own moderator was standing right there able to do it.
//
// team_staff already handed that moderator their own roster, their own submissions and their own
// fees (lib/teamStaff). The missing piece was the way IN: an invite the host mints once, the other
// clan shares among its players, and which lands each of them on that team rather than in the draft
// pool.
//
// What an invite is NOT: a login, or a way around verification. Whoever opens it still signs in with
// Discord and still needs a verified RSN in the roster, exactly like any other sign-up. All the
// invite decides is which team the resulting sign-up belongs to, and that it needs no approval.
//
// Pure and dependency-free (no `@/` imports) so tests/team-invites.test.ts can run it directly with
// Node type-stripping, the same way lib/eventStage and lib/feeRules do. Every refusal is decided
// here so the join page, the sign-up route and the admin panel can't disagree about whether a link
// is still good.

/** Characters that survive being read aloud, double-clicked, and pasted out of Discord. */
const TOKEN_ALPHABET = 'abcdefghijkmnopqrstuvwxyz23456789';

/** 16 chars of this alphabet is ~80 bits — far past guessing, still one line in a chat message. */
export const TOKEN_LENGTH = 16;

export type InviteRefusal =
  /** The host revoked it. */
  | 'revoked'
  /** Past its expiry. */
  | 'expired'
  /** Every seat the host allowed has been taken. */
  | 'exhausted'
  /** Sign-ups for the event aren't open (not yet, closed, or the event has ended). */
  | 'closed'
  /** The token exists but not for the event in the URL — a copy/paste crossing two boards. */
  | 'wrong-event';

export interface InviteRecord {
  token: string;
  teamId: number;
  eventId: number;
  /** null = unlimited. */
  maxUses: number | null;
  uses: number;
  /** ISO, or null for no expiry. */
  expiresAt: string | null;
  /** ISO once revoked. */
  revokedAt: string | null;
}

export interface InviteContext {
  now: number;
  /** The event id from the URL the visitor actually opened. */
  eventId: number;
  /** Whether the event is accepting sign-ups at all — lib/signup's window decides this. */
  signupsOpen: boolean;
}

export interface InviteCheck {
  ok: boolean;
  refusal?: InviteRefusal;
  /** Shown to whoever opened the link. Says what happened and who can fix it. */
  message: string;
  /** Seats left, or null when the host set no limit. Only meaningful when ok. */
  seatsLeft: number | null;
}

/**
 * Whether a link may still be used, and if not, why.
 *
 * Order matters: a revoked link says "revoked" even after it also expired, because that is the one
 * the host will be asked about. Closed sign-ups are checked last, since it is the only refusal that
 * can come back on its own.
 */
export function checkInvite(
  invite: InviteRecord | null | undefined,
  ctx: InviteContext,
): InviteCheck {
  const seatsLeft = invite?.maxUses == null ? null : Math.max(0, invite.maxUses - invite.uses);

  if (!invite) {
    return {
      ok: false,
      refusal: 'revoked',
      message: 'That invite link is not valid. Ask whoever sent it for a new one.',
      seatsLeft: null,
    };
  }
  if (invite.eventId !== ctx.eventId) {
    return {
      ok: false,
      refusal: 'wrong-event',
      message: 'That invite belongs to a different event.',
      seatsLeft,
    };
  }
  if (invite.revokedAt) {
    return { ok: false, refusal: 'revoked', message: message('revoked'), seatsLeft };
  }
  if (invite.expiresAt && Date.parse(invite.expiresAt) <= ctx.now) {
    return { ok: false, refusal: 'expired', message: message('expired'), seatsLeft };
  }
  if (invite.maxUses != null && invite.uses >= invite.maxUses) {
    return { ok: false, refusal: 'exhausted', message: message('exhausted'), seatsLeft: 0 };
  }
  if (!ctx.signupsOpen) {
    return { ok: false, refusal: 'closed', message: message('closed'), seatsLeft };
  }

  return { ok: true, message: '', seatsLeft };
}

function message(refusal: InviteRefusal): string {
  switch (refusal) {
    case 'revoked':
      return 'This invite has been turned off. Ask whoever sent it for a new link.';
    case 'expired':
      return 'This invite has expired. Ask whoever sent it for a new link.';
    case 'exhausted':
      return 'This invite is full — every seat it allowed has been taken.';
    case 'closed':
      return 'Sign-ups for this event are not open.';
    case 'wrong-event':
      return 'That invite belongs to a different event.';
  }
}

/**
 * Mint a token.
 *
 * `randomBytes` is injected rather than imported so this module stays dependency-free and the test
 * can pin an exact output. Callers pass Node's crypto.
 */
export function generateInviteToken(randomBytes: (n: number) => Uint8Array): string {
  // Rejection-free: 32 is a factor of 256, so masking to 5 bits is uniform over the alphabet.
  const bytes = randomBytes(TOKEN_LENGTH);
  let out = '';
  for (let i = 0; i < TOKEN_LENGTH; i++) {
    out += TOKEN_ALPHABET[bytes[i] & 31];
  }
  return out;
}

/** Shape check before touching the database, so a junk path never becomes a query. */
export function isWellFormedToken(token: string | null | undefined): boolean {
  if (!token || token.length !== TOKEN_LENGTH) return false;
  for (const ch of token) {
    if (!TOKEN_ALPHABET.includes(ch)) return false;
  }
  return true;
}

/** The link the host copies. Relative, so it works on whatever domain the clan is hosted at. */
export function invitePath(eventId: number, token: string): string {
  return `/events/${eventId}/join/${token}`;
}

/** One line for the admin panel: how much of the invite is left. */
export function describeInvite(invite: InviteRecord, now: number): string {
  if (invite.revokedAt) return 'Turned off';
  if (invite.expiresAt && Date.parse(invite.expiresAt) <= now) return 'Expired';
  const used = `${invite.uses} joined`;
  if (invite.maxUses == null) return `${used} · no limit`;
  const left = Math.max(0, invite.maxUses - invite.uses);
  return left === 0 ? `${used} · full` : `${used} · ${left} of ${invite.maxUses} seats left`;
}
