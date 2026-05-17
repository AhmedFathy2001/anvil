import { cookies } from 'next/headers';
import crypto from 'crypto';
import { db } from '@/db';
import { clanMembers, events, players, pluginLinks, users } from '@/db/schema';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { requireSecret } from '@/lib/env';

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
  if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'))) {
    return null;
  }
  return payload;
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
    if (data.userId && data.username && data.role) {
      return { userId: data.userId, username: data.username, role: data.role };
    }
    return null;
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
  // Treasurers do everything moderators can; this gate accepts all three mod-tier roles.
  if (user.role === 'admin' || user.role === 'treasurer' || user.role === 'moderator') {
    return user;
  }
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

export async function verifyCaptain(): Promise<{ teamId: number } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('captain_session')?.value;
  if (!token) return null;
  const payload = verify(token, CAPTAIN_SESSION_SECRET);
  if (!payload) return null;
  try {
    const data = JSON.parse(payload);
    if (data.role === 'captain' && typeof data.teamId === 'number') {
      return { teamId: data.teamId };
    }
    return null;
  } catch {
    return null;
  }
}

// Legacy SHA-256 password functions (for captain passwords etc.)
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function verifyPassword(password: string, hash: string): boolean {
  const inputHash = crypto.createHash('sha256').update(password).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(inputHash, 'hex'), Buffer.from(hash, 'hex'));
}

export function generatePlayerToken(): string {
  return crypto.randomUUID();
}

export function signPlayerToken(playerId: number, teamId: number): string {
  return sign(JSON.stringify({ role: 'player', playerId, teamId, iat: Date.now() }), PLAYER_SESSION_SECRET);
}

// Plugin auth: resolve playerToken UUID from Authorization: Bearer header.
//
// Two token shapes are accepted, in order:
//
//   1. **Per-user plugin token** (`users.plugin_token`). Long-lived, configured
//      once. The active event/team/player row is resolved server-side using the
//      caller's `clan_members` and the in-game RSN they pass with each call.
//   2. **Legacy per-event token** (`players.player_token`). Bound to a single
//      `players` row, kept working for any plugin/install that hasn't migrated.
//
// `currentRsn` is the in-game name reported by the client. When provided it
// scopes the resolution to the matching clan_member, which is what blocks "drop
// on the wrong account credits the right account" (the multi-RSN-on-one-Jagex
// problem). When omitted, the resolver picks any active-event player row owned
// by the user — convenient for back-compat but loses the cross-account check.
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

  // Path 1 — per-user plugin token.
  const user = await db.query.users.findFirst({ where: eq(users.pluginToken, token) });
  if (user) {
    const memberRows = await db
      .select({
        id: clanMembers.id,
        rsnNormalized: clanMembers.rsnNormalized,
        previousRsns: clanMembers.previousRsns,
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

    const nowIso = new Date().toISOString();
    const live = playerRows.filter(
      (p) => p.teamId && !p.forceEndedAt && (!p.endDate || p.endDate > nowIso),
    );
    if (live.length === 0) return null;

    let pick = null as typeof live[number] | null;
    if (normalizedRsn) {
      // Caller told us their current RSN — match that clan_member (current name OR a previous alias).
      const matchingMember = memberRows.find((m) =>
        memberRsnSets.get(m.id)?.has(normalizedRsn),
      );
      if (!matchingMember) return null; // current account isn't on this user's roster
      pick = live.find((p) => p.clanMemberId === matchingMember.id) ?? null;
      if (!pick) return null; // not signed up under this RSN
    } else {
      // No RSN hint — pick any live event row. Cross-account safety degrades.
      pick = live[0];
    }

    return {
      playerId: pick.id,
      teamId: pick.teamId!,
      eventId: pick.eventId,
      userId: user.id,
      rsn: pick.name,
    };
  }

  // Path 2 — legacy per-event token. RSN check accepts the frozen player.name OR
  // any previous alias on the linked clan_member, so a mid-event rename doesn't lock
  // the user out before the next /hello sync catches up.
  const player = await db.query.players.findFirst({ where: eq(players.playerToken, token) });
  if (!player || !player.teamId) return null;

  let userId: number | null = null;
  if (normalizedRsn) {
    const acceptedNames = new Set<string>([normalizeRsn(player.name)]);
    if (player.clanMemberId) {
      const cm = await db.query.clanMembers.findFirst({ where: eq(clanMembers.id, player.clanMemberId) });
      if (cm) {
        userId = cm.userId;
        acceptedNames.add(cm.rsnNormalized);
        if (cm.previousRsns) {
          try {
            const arr = JSON.parse(cm.previousRsns);
            if (Array.isArray(arr)) {
              for (const prev of arr) if (typeof prev === 'string') acceptedNames.add(normalizeRsn(prev));
            }
          } catch { /* ignore */ }
        }
      }
    }
    if (!acceptedNames.has(normalizedRsn)) return null;
  } else if (player.clanMemberId) {
    const cm = await db.query.clanMembers.findFirst({ where: eq(clanMembers.id, player.clanMemberId) });
    userId = cm?.userId ?? null;
  }

  return {
    playerId: player.id,
    teamId: player.teamId,
    eventId: player.eventId,
    userId,
    rsn: player.name,
  };
}

// Admin plugin token: a long-lived token bound to a user (not an RSN). Authenticates
// admin-only plugin actions like clan-sync from any character the admin plays.
export async function verifyAdminPluginToken(
  request: Request
): Promise<{ userId: number } | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const link = await db.query.pluginLinks.findFirst({
    where: and(eq(pluginLinks.token, token), isNull(pluginLinks.revokedAt)),
  });
  if (!link) return null;

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
  return rsn.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function verifyPlayer(): Promise<{ playerId: number; teamId: number } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('player_session')?.value;
  if (!token) return null;
  const payload = verify(token, PLAYER_SESSION_SECRET);
  if (!payload) return null;
  try {
    const data = JSON.parse(payload);
    if (data.role === 'player' && typeof data.playerId === 'number' && typeof data.teamId === 'number') {
      return { playerId: data.playerId, teamId: data.teamId };
    }
    return null;
  } catch {
    return null;
  }
}
