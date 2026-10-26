import crypto from 'node:crypto';

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// The plugin's pass onto the push socket (push/server.ts). The site decides who may hear what — the
// same resolution /api/plugin/config makes — and signs it into a short-lived ticket; the push server
// only checks the signature and the clock, so it needs no database auth of its own.
//
// Shared by the site (api/plugin/push/ticket) and the push server, so it imports nothing from '@/'.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

export interface PushScope {
  /** The Anvil user the plugin token belongs to. */
  userId: number;
  /** Boards this client may hear about: its seat's event and/or its home board. */
  eventIds: number[];
  /** Its team on the seat's event — team-only changes (a teammate's drop) go to that team alone. */
  teamId: number | null;
}

/** Long enough to cover a reconnect storm, short enough that a lost seat stops listening soon. */
export const TICKET_TTL_MS = 10 * 60_000;

/**
 * The signing key, derived from a secret the site and the push server already share, so running the
 * push server needs no new secret — and a ticket can't be replayed as any other kind of token.
 */
export function ticketKey(sessionSecret: string): Buffer {
  return crypto.createHmac('sha256', sessionSecret).update('anvil-push-ticket:v1').digest();
}

export function signTicket(scope: PushScope, key: Buffer, nowMs: number): { ticket: string; expiresAt: number } {
  const expiresAt = nowMs + TICKET_TTL_MS;
  const body = Buffer.from(JSON.stringify({ u: scope.userId, e: scope.eventIds, t: scope.teamId, x: expiresAt })).toString('base64url');
  return { ticket: `${body}.${mac(body, key)}`, expiresAt };
}

/** The scope a ticket grants, or null when it is malformed, forged or expired. */
export function verifyTicket(ticket: string, key: Buffer, nowMs: number): PushScope | null {
  const dot = ticket.indexOf('.');
  if (dot <= 0) return null;
  const body = ticket.slice(0, dot);
  const given = Buffer.from(ticket.slice(dot + 1));
  const want = Buffer.from(mac(body, key));
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (typeof p.x !== 'number' || p.x <= nowMs) return null;
    if (!Number.isInteger(p.u) || !Array.isArray(p.e)) return null;
    const eventIds = p.e.filter((e: unknown): e is number => Number.isInteger(e));
    return { userId: p.u, eventIds, teamId: Number.isInteger(p.t) ? p.t : null };
  } catch {
    return null;
  }
}

function mac(body: string, key: Buffer): string {
  return crypto.createHmac('sha256', key).update(body).digest('base64url');
}
