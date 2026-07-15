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
import { dedupeConnectionsByInstanceId, type FederationConnection } from '@/lib/federationRelay';
import { encryptSecret, decryptSecret } from '@/lib/federationSecurity';
import { log } from '@/lib/logger';

// §4 The key material for encrypting cached remote-clan tokens at rest. A dedicated env var if set,
// else the already-required ADMIN_SESSION_SECRET (every deploy has one), else a dev fallback. Kept
// server-side only — the encrypted token never leaves the DB except decrypted for a server-to-server
// replay.
function tokenEncKey(): string {
  return (
    process.env.FEDERATION_TOKEN_ENC_KEY?.trim() ||
    process.env.ADMIN_SESSION_SECRET?.trim() ||
    'dev-federation-token-key'
  );
}

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
  const key = tokenEncKey();
  const out: FederationConnection[] = [];
  for (const r of rows) {
    let token: string;
    try {
      token = decryptSecret(r.token, key); // legacy plaintext passes through; forged ciphertext throws
    } catch (err) {
      // A token we can't decrypt (key rotated / corrupt) is unusable — drop that connection rather than
      // replay garbage. The member simply re-connects to re-mint it.
      log.warn('federation.connections.decrypt-fail', { userId, instanceId: r.instanceId }, err);
      continue;
    }
    out.push({
      instanceId: r.instanceId,
      name: r.name ?? r.instanceId,
      baseUrl: r.baseUrl,
      token,
    });
  }
  return out;
}

// Replace the member's whole connection set (a re-connect re-mints every token). Wholesale replace
// keeps the cache honest — a clan the member is no longer vouched for simply drops out. Best-effort.
export async function replaceConnectionsForUser(
  userId: number,
  connections: FederationConnection[],
): Promise<void> {
  // finding #4: DEDUPE by instanceId (keep last) before the bulk insert — a duplicate instanceId would
  // otherwise hit the unique (userId, instanceId) index and blow up the whole insert (0 rows + 500)
  // AFTER the delete already committed, leaving the member with NO connections. And wrap delete+insert
  // in a TRANSACTION so an insert failure rolls the delete back (never a half-applied wipe).
  const deduped = dedupeConnectionsByInstanceId(connections);
  const nowIso = new Date().toISOString();
  const key = tokenEncKey();
  await db.transaction(async (tx) => {
    await tx.delete(federationConnections).where(eq(federationConnections.userId, userId));
    if (deduped.length === 0) return;
    await tx.insert(federationConnections).values(
      deduped.map((c) => ({
        userId,
        instanceId: c.instanceId,
        baseUrl: c.baseUrl,
        name: c.name,
        token: encryptSecret(c.token, key), // §4 encrypt the cached remote-clan token at rest
        lastUsedAt: nowIso,
      })),
    );
  });
}

// §4 Revoke on disconnect: deleting the rows discards the (encrypted) cached remote-clan tokens, so the
// home site can no longer replay them anywhere. A re-connect re-mints fresh tokens. (replaceConnections-
// ForUser with an empty set has the same effect on a full re-sync.)
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
