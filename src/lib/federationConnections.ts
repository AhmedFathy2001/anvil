// Site-relayed federation — the server-side connection + device-session cache (WIRE §10.3/§10.4).
//
// This is the DB-backed persistence layer the pure relay (lib/federationRelay.ts) is deliberately
// free of: it holds, per home member, the set of remote-clan federation tokens the site minted at
// each clan's /exchange, plus any in-flight self-host device-code login. The plugin never sees any of
// this — it only ever receives the aggregated { clans } shape from /state.

import { db } from '@/db';
import { federationConnections, federationDeviceSessions, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyPluginTokenUser } from '@/lib/auth';
import type { FederationConnection } from '@/lib/federationRelay';

// Resolve the plugin caller's federation identity from its existing account token (WIRE §10.2). The
// broker vouches for a Discord identity, so we need (userId, discordId): the account token → users
// row is the authenticated identity. Unlike resolvePluginMember this needs NO RSN hint / roster
// match — federation is per-Discord-identity, not per-in-game-account — so it works before the member
// is fully rostered. Returns null on a bad token or a user with no linked Discord id.
export async function resolveFederationMember(
  request: Request,
): Promise<{ userId: number; discordId: string } | null> {
  const tokenUser = await verifyPluginTokenUser(request);
  if (!tokenUser) return null;
  const user = await db.query.users.findFirst({
    where: eq(users.id, tokenUser.userId),
    columns: { id: true, discordId: true, banned: true },
  });
  if (!user || user.banned || !user.discordId) return null;
  return { userId: user.id, discordId: user.discordId };
}

// The member's cached OUTBOUND connections to other clans (the tokens we replay server-to-server).
export async function getConnectionsForUser(userId: number): Promise<FederationConnection[]> {
  const rows = await db
    .select({
      instanceId: federationConnections.instanceId,
      name: federationConnections.name,
      baseUrl: federationConnections.baseUrl,
      token: federationConnections.token,
    })
    .from(federationConnections)
    .where(eq(federationConnections.userId, userId));
  return rows.map((r) => ({
    instanceId: r.instanceId,
    name: r.name ?? r.instanceId,
    baseUrl: r.baseUrl,
    token: r.token,
  }));
}

// Replace the member's whole connection set (a re-connect re-mints every token). Wholesale replace
// keeps the cache honest — a clan the member is no longer vouched for simply drops out. Best-effort.
export async function replaceConnectionsForUser(
  userId: number,
  connections: FederationConnection[],
): Promise<void> {
  await db.delete(federationConnections).where(eq(federationConnections.userId, userId));
  if (connections.length === 0) return;
  const nowIso = new Date().toISOString();
  await db.insert(federationConnections).values(
    connections.map((c) => ({
      userId,
      instanceId: c.instanceId,
      baseUrl: c.baseUrl,
      name: c.name,
      token: c.token,
      lastUsedAt: nowIso,
    })),
  );
}

export async function clearConnectionsForUser(userId: number): Promise<void> {
  await db.delete(federationConnections).where(eq(federationConnections.userId, userId));
}

// --- Self-host device-code login session (one in-flight per member) ---------------------------

export interface DeviceSession {
  deviceCode: string;
  verificationUrl: string;
  interval: number;
  expiresAt: string;
}

export async function getDeviceSession(userId: number): Promise<DeviceSession | null> {
  const row = await db.query.federationDeviceSessions.findFirst({
    where: eq(federationDeviceSessions.userId, userId),
  });
  if (!row) return null;
  // Expired handle: treat as gone (and GC it) so the next /connect starts a fresh device login.
  if (row.expiresAt <= new Date().toISOString()) {
    await clearDeviceSession(userId).catch(() => {});
    return null;
  }
  return {
    deviceCode: row.deviceCode,
    verificationUrl: row.verificationUrl,
    interval: row.interval,
    expiresAt: row.expiresAt,
  };
}

export async function saveDeviceSession(userId: number, s: DeviceSession): Promise<void> {
  const existing = await db.query.federationDeviceSessions.findFirst({
    where: eq(federationDeviceSessions.userId, userId),
  });
  const values = {
    deviceCode: s.deviceCode,
    verificationUrl: s.verificationUrl,
    interval: s.interval,
    expiresAt: s.expiresAt,
  };
  if (existing) {
    await db.update(federationDeviceSessions).set(values).where(eq(federationDeviceSessions.userId, userId));
  } else {
    await db.insert(federationDeviceSessions).values({ userId, ...values });
  }
}

export async function clearDeviceSession(userId: number): Promise<void> {
  await db.delete(federationDeviceSessions).where(eq(federationDeviceSessions.userId, userId));
}
