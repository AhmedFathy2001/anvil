// The legacy per-event player session (`player_session` cookie, once minted by /api/player/login from
// an event_participants.player_token link — that login is retired and mints nothing now; what is left
// here makes sure no cookie minted before then is still honoured). Pure: no database, so the decision is testable on its own;
// lib/auth verifyPlayer does the one row read and hands it here.
//
// The cookie used to be trusted on its signature alone for the shared 30-day session window, so a
// player moved to another team, removed from the event, or whose link was regenerated kept a working
// session for the old team (uploads, filing and deleting submissions). Now the session carries a short
// hash of the token it was minted from, and every check re-reads the participant row: gone, on another
// team, or re-tokened all end the session. A session minted before this change has no hash and is
// refused — the player just opens their link again.

import crypto from 'crypto';

/** The player cookie's own maxAge; the shared 30-day session constant is for others. */
export const PLAYER_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;

/** Short, domain-separated hash of a player_token: identifies which link minted a session. */
export function playerTokenHash(token: string): string {
  return crypto.createHash('sha256').update(`player-token:${token}`).digest('hex').slice(0, 32);
}

export type PlayerSessionClaims = { playerId: number; teamId: number; tk: string };

/** The signed payload's claims, or null if it is malformed, too old, from the future, or has no token hash. */
export function parsePlayerSessionPayload(data: unknown, now: number = Date.now()): PlayerSessionClaims | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (d.role !== 'player') return null;
  if (typeof d.playerId !== 'number' || typeof d.teamId !== 'number') return null;
  if (typeof d.iat !== 'number' || !Number.isFinite(d.iat)) return null;
  const age = now - d.iat;
  if (age > PLAYER_SESSION_MAX_AGE_MS || age < -CLOCK_SKEW_MS) return null;
  if (typeof d.tk !== 'string' || d.tk.length === 0) return null;
  return { playerId: d.playerId, teamId: d.teamId, tk: d.tk };
}

/** Is the session still good against the participant row as it stands now (null = row gone)? */
export function playerSessionMatchesRow(
  session: PlayerSessionClaims,
  row: { teamId: number | null; playerToken: string | null } | null | undefined,
): boolean {
  if (!row) return false;
  if (row.teamId == null || row.teamId !== session.teamId) return false;
  if (!row.playerToken) return false;
  return playerTokenHash(row.playerToken) === session.tk;
}
