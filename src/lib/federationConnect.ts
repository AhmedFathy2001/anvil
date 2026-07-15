// Site-relayed federation — connect + state orchestration (WIRE §10.2/§10.3).
//
// Ties the persisted cache (lib/federationConnections) and resolved config (lib/pluginConfig +
// lib/federation) into the pure relay (lib/federationRelay). This is the server-side brain behind the
// two plugin-facing endpoints:
//   • POST /api/plugin/federation/connect → connectMember()
//   • GET  /api/plugin/federation/state   → buildState()
//
// The two trust tiers (WIRE §10.3) both funnel through here:
//   • hosted   → broker /vouch (zero-click, the derived credential proves we're an Anvil site),
//   • self-host→ broker device-code login in the member's browser, then /assert.
// Either way the member ends up with a cached set of remote-clan federation tokens; the plugin holds
// none and opens no clan connections.

import { getBrokerBaseUrl, getFederationEnabled } from '@/lib/pluginConfig';
import { getInstanceId, getFederationTier, getInstanceCredential } from '@/lib/federation';
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
  connectViaVouch,
  connectViaBrokerToken,
  aggregateClans,
  type AggregatedClan,
} from '@/lib/federationRelay';
import { federationFetch, safeVerificationUrl } from '@/lib/federationSecurity';

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

  // brokerDevicePoll self-degrades a thrown fetch error to { status:'pending' } (finding #5).
  const poll = await brokerDevicePoll(brokerBaseUrl, session.deviceCode, federationFetch);
  if (poll.status === 'complete') {
    let connections;
    try {
      connections = await connectViaBrokerToken({
        brokerBaseUrl,
        brokerToken: poll.brokerToken,
        ownInstanceId,
        fetchImpl: federationFetch,
      });
    } catch (err) {
      // finding #5: an exchange/assert blip (timeout / SSRF-reject / a clan down) must NOT 500 the
      // connect — keep the device session and let the member poll again ("keep polling").
      log.warn('federation.connect.self-host.exchange-fail', { userId }, err);
      return 'pending';
    }
    await replaceConnectionsForUser(userId, connections);
    await clearDeviceSession(userId);
    log.info('federation.connect.self-host.complete', { userId, clans: connections.length });
    return 'connected';
  }
  if (poll.status === 'denied' || poll.status === 'expired') {
    await clearDeviceSession(userId);
    return 'none';
  }
  return 'pending'; // pending | slow_down — keep the login pending.
}

export interface ConnectResult {
  status: 'connected' | 'login' | 'disabled' | 'unconfigured';
  verificationUrl?: string;
  count?: number;
}

// The POST /connect action (WIRE §10.2). Hosted = zero-click vouch. Self-host = device-code: advance
// an in-flight login, else start one and hand the member a verificationUrl to open in the browser.
export async function connectMember(userId: number, discordId: string): Promise<ConnectResult> {
  if (!(await getFederationEnabled())) return { status: 'disabled' };
  const brokerBaseUrl = await getBrokerBaseUrl();
  if (!brokerBaseUrl) return { status: 'unconfigured' };
  const ownInstanceId = await getInstanceId();
  const tier = getFederationTier();

  if (tier === 'hosted') {
    const credential = getInstanceCredential();
    if (!credential) return { status: 'unconfigured' };
    let connections;
    try {
      connections = await connectViaVouch({
        brokerBaseUrl,
        credential,
        discordId,
        ownInstanceId,
        fetchImpl: federationFetch,
      });
    } catch (err) {
      // finding #5: a broker/vouch blip must not 500 the connect. Keep whatever connections the member
      // already had cached (a re-connect re-mints them next time) and report those.
      log.warn('federation.connect.hosted-fail', { userId }, err);
      const conns = await getConnectionsForUser(userId);
      return { status: 'connected', count: conns.length };
    }
    await replaceConnectionsForUser(userId, connections);
    log.info('federation.connect.hosted', { userId, clans: connections.length });
    return { status: 'connected', count: connections.length };
  }

  // self-host
  const advanced = await advanceSelfHost(userId, brokerBaseUrl, ownInstanceId);
  if (advanced === 'connected') {
    const conns = await getConnectionsForUser(userId);
    return { status: 'connected', count: conns.length };
  }
  if (advanced === 'pending') {
    const session = await getDeviceSession(userId);
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
  const tier = getFederationTier();

  // Self-host: opportunistically advance any in-flight device login (best-effort — never fails /state).
  if (tier === 'self-host' && brokerBaseUrl) {
    await advanceSelfHost(userId, brokerBaseUrl, ownInstanceId).catch(() => {});
  }

  const connections = await getConnectionsForUser(userId);
  const connected = connections.length > 0;

  let needsLogin = false;
  let verificationUrl: string | undefined;
  if (!connected && tier === 'self-host' && brokerBaseUrl) {
    const session = await getDeviceSession(userId);
    if (session) {
      needsLogin = true;
      verificationUrl = safeVerificationUrl(session.verificationUrl, brokerBaseUrl) ?? undefined;
    }
  }

  const clans = connected ? await aggregateClans(connections, federationFetch) : [];
  return { enabled: true, connected, needsLogin, verificationUrl, clans };
}
