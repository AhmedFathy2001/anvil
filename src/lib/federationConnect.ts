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
import { getInstanceId, pushAssociation } from '@/lib/federation';
import { log } from '@/lib/logger';
import {
  getConnectionsForUser,
  replaceConnectionsForUser,
  clearConnectionsForUser,
  getDeviceSession,
  saveDeviceSession,
  clearDeviceSession,
  markFederationLinked,
  clearFederationLinked,
  isFederationLinked,
  getUserDiscordId,
  saveBrokerSession,
  getBrokerSessionInfo,
  markFederationSynced,
  clearBrokerSession,
} from '@/lib/federationConnections';
import {
  brokerDeviceStart,
  brokerDevicePoll,
  connectViaBrokerToken,
  aggregateClans,
  type AggregatedClan,
} from '@/lib/federationRelay';
import { federationFetch, safeVerificationUrl } from '@/lib/federationSecurity';

// How long a member's synced connection set is considered fresh before /state re-runs the relay.
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

// Bootstrap the mesh: tell the broker "this member is a member HERE" so THIS clan appears in the
// member's /me/instances at their OTHER homes. Without it a first-ever connect finds an empty
// directory everywhere and no association can ever form (the /exchange- and /token-side pushes only
// fire for clans already in /me/instances — a chicken-and-egg). Fire-and-forget; pushAssociation
// itself gates on the clan's associationPush consent + the provisioned FEDERATION_ASSOC_SECRET.
async function pushHomeAssociation(userId: number, brokerBaseUrl: string): Promise<void> {
  try {
    const discordId = await getUserDiscordId(userId);
    if (discordId) await pushAssociation(discordId, brokerBaseUrl);
  } catch (err) {
    log.warn('federation.assoc.push-fail', { userId }, err);
  }
}

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
  // Durable "signed in" marker — set even when connections is empty (the member federated their
  // Discord but is in no OTHER clan yet), so /state reports a persistent signedIn and the plugin
  // shows Disconnect rather than re-offering Connect on reload.
  await markFederationLinked(userId);
  // Keep the broker session (encrypted) instead of discarding it with the device session: it powers
  // the background refresh that folds in clans the member connects at AFTER this one.
  await saveBrokerSession(userId, brokerToken);
  await markFederationSynced(userId);
  await clearDeviceSession(userId);
  void pushHomeAssociation(userId, brokerBaseUrl);
  log.info('federation.connect.self-host.complete', { userId, clans: connections.length });
  return 'connected';
}

// Background re-sync of the member's connection set: re-run the /me/instances → /assert → /exchange
// relay with the persisted broker session, so a clan the member connected at LATER shows up on this
// home's sidebar without a manual disconnect/re-connect here. Throttled by federationSyncedAt;
// best-effort (a blip keeps the cached set and waits for the next window). A broker 401 means the
// 30-day session expired or was revoked — drop it so we stop retrying; the cached connections and
// the signed-in marker stay (the member re-connects only when they next need a refresh).
async function refreshConnections(
  userId: number,
  brokerBaseUrl: string,
  ownInstanceId: string,
): Promise<void> {
  const { brokerSession, syncedAt } = await getBrokerSessionInfo(userId);
  if (!brokerSession) return;
  if (syncedAt && Date.now() - Date.parse(syncedAt) < SYNC_INTERVAL_MS) return;
  // Stamp BEFORE the relay so concurrent /state polls can't stampede the broker — a failed attempt
  // simply waits out the next window.
  await markFederationSynced(userId);
  try {
    const connections = await connectViaBrokerToken({
      brokerBaseUrl,
      brokerToken: brokerSession,
      ownInstanceId,
      fetchImpl: federationFetch,
    });
    await replaceConnectionsForUser(userId, connections);
    log.info('federation.state.refreshed', { userId, clans: connections.length });
  } catch (err) {
    if (String(err).includes('(401)')) {
      await clearBrokerSession(userId);
      log.info('federation.state.broker-session-expired', { userId });
    } else {
      log.warn('federation.state.refresh-fail', { userId }, err);
    }
  }
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
  // The broker's short device code the member types into the verification page. Returned only when a
  // fresh login is started (that's when the broker hands it to us); the plugin displays it.
  userCode?: string;
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
  return { status: 'login', verificationUrl, userCode: start.user_code || undefined };
}

export interface StateResult {
  enabled: boolean;
  connected: boolean;
  // The member has an established federation identity (completed a device login), even if it resolved
  // to zero remote clans. Durable across reloads — drives the plugin's "Disconnect" affordance.
  signedIn: boolean;
  needsLogin: boolean;
  verificationUrl?: string;
  clans: AggregatedClan[];
}

// The POST /disconnect action — a full federation logout. Discards the member's cached remote-clan
// tokens (so the site can no longer replay them), clears the durable signed-in marker, and drops any
// in-flight device session. Idempotent: safe to call when not connected.
export async function disconnectMember(userId: number): Promise<void> {
  await clearConnectionsForUser(userId);
  await clearFederationLinked(userId);
  await clearBrokerSession(userId).catch(() => {});
  await clearDeviceSession(userId).catch(() => {});
  log.info('federation.disconnect', { userId });
}

// The GET /state shape (WIRE §10.2). Aggregates every connected clan's board + activity
// server-to-server (short-TTL/ETag cached in the relay). For a self-host with a pending device login,
// it auto-advances the poll so the sidebar flips to connected without a second explicit /connect.
export async function buildState(userId: number): Promise<StateResult> {
  if (!(await getFederationEnabled())) {
    return { enabled: false, connected: false, signedIn: false, needsLogin: false, clans: [] };
  }
  const brokerBaseUrl = await getBrokerBaseUrl();
  const ownInstanceId = await getInstanceId();
  // Opportunistically advance any in-flight device login, then re-sync the connection set off the
  // persisted broker session (both best-effort — never fail /state).
  if (brokerBaseUrl) {
    await advanceSelfHost(userId, brokerBaseUrl, ownInstanceId).catch(() => {});
    await refreshConnections(userId, brokerBaseUrl, ownInstanceId).catch(() => {});
  }

  const connections = await getConnectionsForUser(userId);
  const connected = connections.length > 0;
  // Signed in = a completed device login (durable marker) OR having live connections. The marker
  // covers the "federated but in no other clan" case where connected is false yet the member IS in.
  const signedIn = connected || (await isFederationLinked(userId));

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
  return { enabled: true, connected, signedIn, needsLogin, verificationUrl, clans };
}
