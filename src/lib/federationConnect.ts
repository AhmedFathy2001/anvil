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

  const poll = await brokerDevicePoll(brokerBaseUrl, session.deviceCode);
  if (poll.status === 'complete') {
    const connections = await connectViaBrokerToken({
      brokerBaseUrl,
      brokerToken: poll.brokerToken,
      ownInstanceId,
    });
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
    const connections = await connectViaVouch({ brokerBaseUrl, credential, discordId, ownInstanceId });
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
    return { status: 'login', verificationUrl: session?.verificationUrl };
  }
  // none in flight → start a fresh device login.
  const start = await brokerDeviceStart(brokerBaseUrl);
  await saveDeviceSession(userId, {
    deviceCode: start.device_code,
    verificationUrl: start.verification_url,
    interval: start.interval > 0 ? start.interval : 5,
    expiresAt: new Date(Date.now() + (start.expires_in > 0 ? start.expires_in : 600) * 1000).toISOString(),
  });
  log.info('federation.connect.self-host.started', { userId });
  return { status: 'login', verificationUrl: start.verification_url };
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
  if (!connected && tier === 'self-host') {
    const session = await getDeviceSession(userId);
    if (session) {
      needsLogin = true;
      verificationUrl = session.verificationUrl;
    }
  }

  const clans = connected ? await aggregateClans(connections) : [];
  return { enabled: true, connected, needsLogin, verificationUrl, clans };
}
