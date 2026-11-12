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
  /** The plugin's chat-feed switch is on: it hears feed lines addressed to this user (lib/chatFeed). */
  feed?: boolean;
  /**
   * The plugin understands panel rows and looks ({"t":"rows"|"rowsdel"|"rowslock"|"look"}). Only these
   * clients are sent them: a released plugin before the Feed tab reads every push as a board change
   * and logs a warning for each one it can't parse.
   */
  rows?: boolean;
  /** The plugin applies Supporter-list deltas ({"t":"flair"}, lib/chatFlairWire); older ones aren't sent them. */
  flair?: boolean;
  /**
   * More team rooms on the first board, beyond `teamId`: rows only (never a team's view). For staff
   * who read every team's chat on the website's Feed & chat page (api/events/[id]/live/ticket). The
   * site lists each team it grants; a team not listed is never heard.
   */
  teamIds?: number[];
  /**
   * A browser (the website's Feed & chat page), not a plugin: it hears panel rows only, never a board
   * or tile view, and only such a ticket may come in the address (`?ticket=`) — a browser can't send
   * the plugin's Authorization header.
   */
  web?: boolean;
  /**
   * Chat relay (lib/push/relay): this plugin may send its own chat lines and hear others' — signed in,
   * with staff's switch on. The character it speaks as (its Anvil name), its account-type icon, its
   * roster clan and the world it asked from: the rooms it is in come from here, never from the socket.
   */
  relay?: { name: string; icon: number | null; clanId: number | null; world: number | null; fc?: string | null; guest?: string | null };
}

/** Long enough to cover a reconnect storm, short enough that a lost seat stops listening soon. */
export const TICKET_TTL_MS = 10 * 60_000;
/** A browser's ticket: shorter, since it rides in the address (and so in proxy logs). */
export const WEB_TICKET_TTL_MS = 5 * 60_000;
/** Bounds what one ticket carries. */
export const MAX_TICKET_TEAMS = 64;

/**
 * The signing key, derived from a secret the site and the push server already share, so running the
 * push server needs no new secret — and a ticket can't be replayed as any other kind of token.
 */
export function ticketKey(sessionSecret: string): Buffer {
  return crypto.createHmac('sha256', sessionSecret).update('anvil-push-ticket:v1').digest();
}

export function signTicket(scope: PushScope, key: Buffer, nowMs: number, ttlMs: number = TICKET_TTL_MS): { ticket: string; expiresAt: number } {
  const expiresAt = nowMs + Math.min(ttlMs, TICKET_TTL_MS);
  // The newer fields only when set, so a plugin's ticket is byte for byte what it always was.
  const teams = (scope.teamIds ?? []).filter((t) => Number.isInteger(t) && t !== scope.teamId).slice(0, MAX_TICKET_TEAMS);
  const body = Buffer.from(JSON.stringify({ u: scope.userId, e: scope.eventIds, t: scope.teamId, ...(scope.feed ? { f: 1 } : {}), ...(scope.rows ? { r: 1 } : {}), ...(scope.flair ? { l: 1 } : {}), ...(teams.length ? { ts: teams } : {}), ...(scope.web ? { w: 1 } : {}), ...(scope.relay ? { rl: [scope.relay.name, scope.relay.icon, scope.relay.clanId, scope.relay.world, scope.relay.fc ?? null, ...(scope.relay.guest ? [scope.relay.guest] : [])] } : {}), x: expiresAt })).toString('base64url');
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
    const teamIds = Array.isArray(p.ts) ? p.ts.filter((t: unknown): t is number => Number.isInteger(t)).slice(0, MAX_TICKET_TEAMS) : [];
    return {
      userId: p.u,
      eventIds,
      teamId: Number.isInteger(p.t) ? p.t : null,
      ...(p.f === 1 ? { feed: true } : {}),
      ...(p.r === 1 ? { rows: true } : {}),
      ...(p.l === 1 ? { flair: true } : {}),
      ...(teamIds.length ? { teamIds } : {}),
      ...(p.w === 1 ? { web: true } : {}),
      ...(Array.isArray(p.rl) && typeof p.rl[0] === 'string' && p.rl[0]
        ? { relay: { name: p.rl[0], icon: Number.isInteger(p.rl[1]) ? p.rl[1] : null, clanId: Number.isInteger(p.rl[2]) ? p.rl[2] : null, world: Number.isInteger(p.rl[3]) ? p.rl[3] : null, ...(typeof p.rl[4] === 'string' ? { fc: p.rl[4] } : {}), ...(typeof p.rl[5] === 'string' ? { guest: p.rl[5] } : {}) } }
        : {}),
    };
  } catch {
    return null;
  }
}

function mac(body: string, key: Buffer): string {
  return crypto.createHmac('sha256', key).update(body).digest('base64url');
}

/**
 * The push server's pass onto the site's internal view route (api/internal/push/view), from the same
 * shared secret under another label: nothing a plugin holds can open it.
 */
export function internalSecret(sessionSecret: string): string {
  return crypto.createHmac('sha256', sessionSecret).update('anvil-push-internal:v1').digest('base64url');
}
