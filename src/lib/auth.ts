import { cookies } from 'next/headers';
import crypto from 'crypto';
import { db } from '@/db';
import { players, pluginLinks } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
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

// Legacy token (backward compat)
export function signAdminToken(): string {
  return sign(JSON.stringify({ role: 'admin', iat: Date.now() }), ADMIN_SESSION_SECRET);
}

// New user-aware token
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
    // New-style token with userId
    if (data.userId && data.username && data.role) {
      return { userId: data.userId, username: data.username, role: data.role };
    }
    // Legacy token (role === 'admin' but no userId)
    if (data.role === 'admin') {
      return { userId: 0, username: 'legacy-admin', role: 'admin' };
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

// Bcrypt password hashing for user accounts
export async function hashPasswordBcrypt(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPasswordBcrypt(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
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

// Plugin auth: resolve playerToken UUID from Authorization: Bearer header
export async function verifyPluginToken(
  request: Request
): Promise<{ playerId: number; teamId: number; eventId: number } | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const player = await db.query.players.findFirst({
    where: eq(players.playerToken, token),
  });

  if (!player || !player.teamId) return null;

  return {
    playerId: player.id,
    teamId: player.teamId,
    eventId: player.eventId,
  };
}

// Admin plugin token: a long-lived token issued via the site's link flow.
// Bound to a users.id + rsn so admin-only plugin actions (clan-sync etc.) are attributable.
export async function verifyAdminPluginToken(
  request: Request
): Promise<{ userId: number; rsn: string; linkId: number } | null> {
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

  return { userId: link.userId, rsn: link.rsn, linkId: link.id };
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
