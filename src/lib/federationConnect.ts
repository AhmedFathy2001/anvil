// Site-relayed federation — connect + state orchestration (WIRE §10.2/§10.3).
//
// Ties the persisted cache (lib/federationConnections) and resolved config (lib/pluginConfig +
// lib/federation) into the pure relay (lib/federationRelay). This is the server-side brain behind the
// two plugin-facing endpoints:
//   • POST /api/plugin/federation/connect → connectMember()
//   • GET  /api/plugin/federation/state   → buildState()
//
// Identity (WIRE §10.3): NO clan vouches — EVERY member does the broker device-code login in their own
// browser, then the site relays /me/instances → /assert → /exchange. The clan's server is only a relay;
// the member ends up with a cached set of remote-clan federation tokens. The plugin holds none and opens
// no clan connections.

import { getBrokerBaseUrl, getFederationEnabled } from '@/lib/pluginConfig';
import { getInstanceId } from '@/lib/federation';
import { log } from '@/lib/logger';
import {
  getConnectionsForUser,
  replaceConnectionsForUser,
  getDeviceSession,
  saveDeviceSession,
  clearDeviceSession,
} from '@/lib/federationConnections';
import {
  brokerDeviceStart,
  brokerDevicePoll,
  connectViaBrokerToken,
  aggregateClans,
  type AggregatedClan,
} from '@/lib/federationRelay';
import { federationFetch, safeVerificationUrl } from '@/lib/federationSecurity';

// Run the /me/instances → /assert → /exchange relay with a broker session token and persist the
// resulting connections. On a broker/exchange blip it returns 'pending' WITHOUT clearing the saved
// brokerToken (finding #15) — the device code is already spent, so recovery is a direct retry of THIS
// step (no re-poll, no re-login), which the next advanceSelfHost performs.
async function finishBrokerToken(
  userId: number,
  brokerBaseUrl: string,
  brokerToken: string,
  ownInstanceId: string,
): Promise<'connected' | 'pending'> {
  let connections;
  try {
    connections = await connectViaBrokerToken({ brokerBaseUrl, brokerToken, ownInstanceId, fetchImpl: federationFetch });
  } catch (err) {
    // A broker/assert blip must NOT strand the flow: the brokerToken stays persisted so the next
    // advance retries the exchange directly. Never a 500, never a re-login (finding #15).
    log.warn('federation.connect.self-host.exchange-fail', { userId }, err);
    return 'pending';
  }
  await replaceConnectionsForUser(userId, connections);
  await clearDeviceSession(userId);
  log.info('federation.connect.self-host.complete', { userId, clans: connections.length });
  return 'connected';
}

// Poll an EXISTING self-host device session and finish the connect if the member completed the
// browser Discord login on the broker's domain. Never STARTS a session (that's the explicit /connect
// action) — so /state can safely call it to auto-advance a pending login. Returns the resulting state.
async function advanceSelfHost(
  userId: number,
  brokerBaseUrl: string,
  ownInstanceId: string,
): Promise<'connected' | 'pending' | 'none'> {
  const session = await getDeviceSession(userId);
  if (!session) return 'none';

  // finding #15: the login already completed on a prior poll (the single-use device code is spent) and
  // we captured the brokerToken, but the exchange relay then failed. Retry the exchange DIRECTLY — never
  // re-poll the consumed device code (that would strand the flow in perpetual 'pending').
  if (session.brokerToken) {
    return finishBrokerToken(userId, brokerBaseUrl, session.brokerToken, ownInstanceId);
  }

  // brokerDevicePoll self-degrades a thrown fetch error to { status:'pending' } (finding #5).
  const poll = await brokerDevicePoll(brokerBaseUrl, session.deviceCode, federationFetch);
  if (poll.status === 'complete') {
    // Persist the brokerToken BEFORE attempting the exchange, so a subsequent exchange failure is
    // recoverable without re-polling the (now-spent) device code (finding #15).
    await saveDeviceSession(userId, { ...session, brokerToken: poll.brokerToken });
    return finishBrokerToken(userId, brokerBaseUrl, poll.brokerToken, ownInstanceId);
  }
  if (poll.status === 'denied' || poll.status === 'expired') {
    await clearDeviceSession(userId);
    return 'none';
  }
  return 'pending'; // pending | slow_down — keep the login pending.
}

export interface ConnectResult {
  // `retry` = a transient broker/exchange failure that is NOT a false success and NOT a re-login
  // (findings #7 + #15). The plugin should retry /connect shortly.
  status: 'connected' | 'login' | 'retry' | 'disabled' | 'unconfigured';
  verificationUrl?: string;
  count?: number;
}

// The POST /connect action (WIRE §10.2/§10.3). Device-code for EVERY member — no clan vouches for
// identity; the member proves their own Discord in the browser on the broker's domain. Advance an
// in-flight login, else start one and hand the member a verificationUrl to open.
export async function connectMember(userId: number): Promise<ConnectResult> {
  if (!(await getFederationEnabled())) return { status: 'disabled' };
  const brokerBaseUrl = await getBrokerBaseUrl();
  if (!brokerBaseUrl) return { status: 'unconfigured' };
  const ownInstanceId = await getInstanceId();

  const advanced = await advanceSelfHost(userId, brokerBaseUrl, ownInstanceId);
  if (advanced === 'connected') {
    const conns = await getConnectionsForUser(userId);
    return { status: 'connected', count: conns.length };
  }
  if (advanced === 'pending') {
    // Distinguish "still waiting for the browser Discord login" (needs the verificationUrl) from "login
    // done, retrying the exchange" — the latter must NOT re-show the spent login URL (findings #15/#7).
    const session = await getDeviceSession(userId);
    if (session?.brokerToken) return { status: 'retry' };
    return { status: 'login', verificationUrl: safeVerificationUrl(session?.verificationUrl, brokerBaseUrl) ?? undefined };
  }
  // none in flight → start a fresh device login. A broker blip here degrades to "keep polling" login
  // (finding #5) rather than a 500 — the plugin retries /connect|/state.
  let start;
  try {
    start = await brokerDeviceStart(brokerBaseUrl, federationFetch);
  } catch (err) {
    log.warn('federation.connect.self-host.start-fail', { userId }, err);
    return { status: 'login' };
  }
  // §8: pin the broker-returned verificationUrl to HTTPS + the broker's own host before it is ever
  // persisted or handed to the plugin to open — a rogue/compromised broker response can't redirect the
  // member's browser at a phishing Discord login.
  const verificationUrl = safeVerificationUrl(start.verification_url, brokerBaseUrl);
  if (!verificationUrl) {
    log.warn('federation.connect.self-host.bad-verification-url', { userId });
    return { status: 'unconfigured' };
  }
  await saveDeviceSession(userId, {
    deviceCode: start.device_code,
    verificationUrl,
    interval: start.interval > 0 ? start.interval : 5,
    expiresAt: new Date(Date.now() + (start.expires_in > 0 ? start.expires_in : 600) * 1000).toISOString(),
  });
  log.info('federation.connect.self-host.started', { userId });
  return { status: 'login', verificationUrl };
}

export interface StateResult {
  enabled: boolean;
  connected: boolean;
  needsLogin: boolean;
  verificationUrl?: string;
  clans: AggregatedClan[];
}

// The GET /state shape (WIRE §10.2). Aggregates every connected clan's board + activity
// server-to-server (short-TTL/ETag cached in the relay). For a self-host with a pending device login,
// it auto-advances the poll so the sidebar flips to connected without a second explicit /connect.
export async function buildState(userId: number): Promise<StateResult> {
  if (!(await getFederationEnabled())) {
    return { enabled: false, connected: false, needsLogin: false, clans: [] };
  }
  const brokerBaseUrl = await getBrokerBaseUrl();
  const ownInstanceId = await getInstanceId();
  // Opportunistically advance any in-flight device login (best-effort — never fails /state).
  if (brokerBaseUrl) {
    await advanceSelfHost(userId, brokerBaseUrl, ownInstanceId).catch(() => {});
  }

  const connections = await getConnectionsForUser(userId);
  const connected = connections.length > 0;

  let needsLogin = false;
  let verificationUrl: string | undefined;
  if (!connected && brokerBaseUrl) {
    const session = await getDeviceSession(userId);
    // A session mid-exchange-retry (brokerToken captured) is NOT "needs login" — the member already
    // completed the browser Discord login; we're just retrying the server-side exchange (finding #15).
    if (session && !session.brokerToken) {
      needsLogin = true;
      verificationUrl = safeVerificationUrl(session.verificationUrl, brokerBaseUrl) ?? undefined;
    }
  }

  const clans = connected ? await aggregateClans(connections, federationFetch) : [];
  return { enabled: true, connected, needsLogin, verificationUrl, clans };
}
