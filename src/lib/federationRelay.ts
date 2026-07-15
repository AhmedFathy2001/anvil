// Anvil site-relayed federation — the server-to-server relay client (WIRE §10).
//
// THE PLUGIN NEVER TALKS TO THE BROKER OR TO OTHER CLAN SITES. It only calls its own home site.
// This module is everything the home site does *on the member's behalf*, server-to-server:
//   • talk to the broker (`/vouch` for a trusted/hosted home; `/device/*` + `/assert` for self-host),
//   • exchange broker assertions at each remote clan's `/exchange` for a per-clan federation token,
//   • aggregate each connected clan's board + activity for the plugin's sidebar,
//   • fan a credit out to the member's OTHER clans' `/events` (WIRE §10.4).
//
// DESIGN: deliberately DEPENDENCY-INJECTED and free of any `@/` import (DB, Next, config). Every
// function takes explicit URLs/tokens and an optional `fetch`, so the whole relay is unit-testable
// against in-process mock servers with no database. The route handlers (which DO import the DB) wire
// the persisted connection cache + resolved config into these pure functions.
//
// SECURITY: the broker URL and every remote-clan URL/token live ONLY on the server. Nothing here is
// ever returned to the plugin; the plugin only ever sees the aggregated { clans } shape from /state.
//
// SSRF (FEDERATION_SECURITY.md §1): every outbound call goes through the injected `fetchImpl`.
// PRODUCTION MUST inject `guardedFetch` (lib/federationSecurity) at every call site — the route
// handlers do. The bare-`fetch` default exists ONLY for the in-process mock-server unit tests (which
// dial loopback and would be blocked by the guard). A federated URL must never be reached with raw fetch.

import {
  sanitizeFederatedBoard,
  sanitizeFederatedActivity,
  type SafeBoard,
  type SafeActivity,
} from './federationSecurity.ts';

type FetchLike = typeof fetch;

const FED = '/api/federation/v1';

// A live outbound connection to ONE remote clan: the member's federation token there + how to reach it.
export interface FederationConnection {
  instanceId: string;
  name: string;
  baseUrl: string;
  token: string; // the remote clan minted this at its /exchange; a secret we hold and replay.
}

// finding #4: collapse a connection list to at most one entry per instanceId (KEEP LAST — a re-connect
// re-mints the token, so the newest wins). replaceConnectionsForUser deletes-all then bulk-inserts;
// two rows with the same instanceId would hit the unique (userId, instanceId) index AFTER the delete
// committed → 0 rows + 500. De-duping up front makes the bulk insert collision-free. Pure + testable.
export function dedupeConnectionsByInstanceId(connections: FederationConnection[]): FederationConnection[] {
  const byId = new Map<string, FederationConnection>();
  for (const c of connections) byId.set(c.instanceId, c); // last write wins
  return [...byId.values()];
}

// A directory/vouch entry — a clan the member could connect to.
export interface BrokerInstance {
  instanceId: string;
  name: string;
  baseUrl: string;
}

// One short-lived, single-use, aud-pinned EdDSA JWT per target instance (WIRE §2).
export interface BrokerAssertion {
  instanceId: string;
  assertion: string;
  exp?: number;
}

export interface DeviceStart {
  device_code: string;
  user_code: string;
  verification_url: string;
  interval: number;
  expires_in: number;
}

export type DevicePoll =
  | { status: 'pending' | 'slow_down' | 'denied' | 'expired' }
  | { status: 'complete'; brokerToken: string; expiresIn?: number };

// Per-clan fan-out target the plugin declares: which tile on which clan a game event matched. The
// plugin resolved these client-side from each clan's board (aggregated via /state), so the home site
// does NO server-side tile matching — it just routes each target to its clan. (WIRE §5/§10.4.)
export interface FanoutTarget {
  instanceId: string;
  eventId: number;
  tileId: number;
}

// The credit payload common to every clan (mirrors the /events body minus tile/event ids).
export interface CreditPayload {
  amount?: number;
  imageUrl?: string | null;
  note?: string | null;
  itemId?: number | null;
  durationSeconds?: number | null;
}

export interface FanoutRelayResult {
  instanceId: string;
  ok: boolean;
  credited: boolean;
  reason?: string; // e.g. 'exclusive', or an error string
  status?: number;
}

const DEFAULT_TIMEOUT_MS = 6000;

function trimUrl(u: string): string {
  return u.replace(/\/+$/, '');
}

async function postJson(
  url: string,
  body: unknown,
  opts: { bearer?: string; timeoutMs?: number; fetchImpl?: FetchLike } = {},
): Promise<{ status: number; json: unknown }> {
  const f = opts.fetchImpl ?? fetch;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.bearer) headers.Authorization = `Bearer ${opts.bearer}`;
  const res = await f(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

// ─────────────────────────────────────────────────────────────────────────────
// Broker client (server-to-server). All under `<broker>/api/federation/v1/`.
// ─────────────────────────────────────────────────────────────────────────────

// Trusted/hosted path (WIRE §10.3): the broker trusts Anvil sites (shared derived instance
// credential), so the home site vouches for its already-authenticated member and gets assertions back
// with zero member interaction. `credential` is this site's FEDERATION_ASSOC_SECRET.
export async function brokerVouch(
  brokerBaseUrl: string,
  credential: string,
  discordId: string,
  fetchImpl?: FetchLike,
): Promise<{ instances: BrokerInstance[]; assertions: BrokerAssertion[] }> {
  const { status, json } = await postJson(
    `${trimUrl(brokerBaseUrl)}${FED}/vouch`,
    { discordId },
    { bearer: credential, fetchImpl },
  );
  if (status !== 200 || !json || typeof json !== 'object') {
    throw new Error(`broker /vouch failed (${status})`);
  }
  const j = json as { instances?: unknown; assertions?: unknown };
  return {
    instances: Array.isArray(j.instances) ? (j.instances as BrokerInstance[]) : [],
    assertions: Array.isArray(j.assertions) ? (j.assertions as BrokerAssertion[]) : [],
  };
}

// Self-host device-code login (WIRE §9.1/§10.3), step 1.
export async function brokerDeviceStart(brokerBaseUrl: string, fetchImpl?: FetchLike): Promise<DeviceStart> {
  const { status, json } = await postJson(`${trimUrl(brokerBaseUrl)}${FED}/device/start`, {}, { fetchImpl });
  if (status !== 200 || !json || typeof json !== 'object') {
    throw new Error(`broker /device/start failed (${status})`);
  }
  return json as DeviceStart;
}

// Self-host device-code login, step 3 — poll for the member finishing the browser Discord login.
export async function brokerDevicePoll(
  brokerBaseUrl: string,
  deviceCode: string,
  fetchImpl?: FetchLike,
): Promise<DevicePoll> {
  let status: number;
  let json: unknown;
  try {
    ({ status, json } = await postJson(
      `${trimUrl(brokerBaseUrl)}${FED}/device/poll`,
      { device_code: deviceCode },
      { fetchImpl },
    ));
  } catch {
    // finding #5: a THROWN fetch error (timeout / SSRF-reject / transport blip) must degrade to "keep
    // polling", NOT propagate up to a 500 on /connect. The member simply polls again.
    return { status: 'pending' };
  }
  if (status !== 200 || !json || typeof json !== 'object') {
    // A non-200 / non-object broker response is likewise "keep polling" rather than hard-failing.
    return { status: 'pending' };
  }
  return json as DevicePoll;
}

// The member's connectable instances (WIRE §9.4). Bearer is the brokerToken from device-poll.
export async function brokerMeInstances(
  brokerBaseUrl: string,
  brokerToken: string,
  fetchImpl?: FetchLike,
): Promise<BrokerInstance[]> {
  const f = fetchImpl ?? fetch;
  const res = await f(`${trimUrl(brokerBaseUrl)}${FED}/me/instances`, {
    headers: { Authorization: `Bearer ${brokerToken}` },
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`broker /me/instances failed (${res.status})`);
  const json = (await res.json().catch(() => null)) as { instances?: unknown } | null;
  return json && Array.isArray(json.instances) ? (json.instances as BrokerInstance[]) : [];
}

// Mint one assertion per target instance (WIRE §9.5). Bearer is the brokerToken.
export async function brokerAssert(
  brokerBaseUrl: string,
  brokerToken: string,
  instanceIds: string[],
  fetchImpl?: FetchLike,
): Promise<{ assertions: BrokerAssertion[]; errors: { instanceId: string; error: string }[] }> {
  const { status, json } = await postJson(
    `${trimUrl(brokerBaseUrl)}${FED}/assert`,
    { instanceIds },
    { bearer: brokerToken, fetchImpl },
  );
  if (status !== 200 || !json || typeof json !== 'object') {
    throw new Error(`broker /assert failed (${status})`);
  }
  const j = json as { assertions?: unknown; errors?: unknown };
  return {
    assertions: Array.isArray(j.assertions) ? (j.assertions as BrokerAssertion[]) : [],
    errors: Array.isArray(j.errors) ? (j.errors as { instanceId: string; error: string }[]) : [],
  };
}

// Register this instance with the broker (WIRE §6/§10.1). Hosted reconciles (Bearer credential);
// self-host registers self-service and gets a verificationToken to echo at /.well-known.
export async function brokerRegister(
  brokerBaseUrl: string,
  body: { instanceId: string; baseUrl: string; name: string; type: 'hosted' | 'self-host' },
  credential: string | null,
  fetchImpl?: FetchLike,
): Promise<{ verificationToken?: string; state?: string } | null> {
  const { status, json } = await postJson(`${trimUrl(brokerBaseUrl)}${FED}/register`, body, {
    bearer: credential ?? undefined,
    fetchImpl,
  });
  if (status < 200 || status >= 300 || !json || typeof json !== 'object') return null;
  return json as { verificationToken?: string; state?: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// Remote-clan client (server-to-server). All under `<clan>/api/federation/v1/`.
// ─────────────────────────────────────────────────────────────────────────────

// Exchange one broker assertion at its target clan for a federation token (WIRE §2/§8). Returns null
// on any non-token response (422 re-fetch, 409 already-spent, 403 policy) — the caller drops that clan
// from the connection set rather than failing the whole connect.
export async function exchangeAssertion(
  baseUrl: string,
  assertion: string,
  fetchImpl?: FetchLike,
): Promise<{ token: string; instanceId?: string; guest?: boolean } | null> {
  const { status, json } = await postJson(`${trimUrl(baseUrl)}${FED}/exchange`, { assertion }, { fetchImpl });
  if (status !== 200 || !json || typeof json !== 'object') return null;
  const j = json as { token?: unknown; instanceId?: unknown; guest?: unknown; status?: unknown };
  if (typeof j.token !== 'string' || !j.token) return null; // e.g. { status: 'request-to-join' }
  return {
    token: j.token,
    instanceId: typeof j.instanceId === 'string' ? j.instanceId : undefined,
    guest: j.guest === true,
  };
}

// --- Short-TTL + weak-ETag cache for read fetches (WIRE §7/§10.2). The plugin polls /state often; an
// unchanged remote board/activity must not be re-shipped every poll. We cache the last body+ETag per
// (baseUrl, token, kind) and, once the TTL lapses, do a conditional GET (If-None-Match) → a 304 costs
// no body. ---
interface ReadCacheEntry {
  etag: string | null;
  body: unknown;
  ts: number;
}
// finding #15: BOUNDED cache. The key is `(url|token)`, and tokens ROTATE on every re-connect, so an
// unbounded Map would accumulate one orphan entry per rotated token forever. We bound it two ways:
// a hard TTL (an entry older than READ_CACHE_MAX_AGE_MS is never served and is pruned), and a hard
// size cap with LRU eviction (oldest-touched key dropped once over READ_CACHE_MAX_ENTRIES).
const readCache = new Map<string, ReadCacheEntry>();
const READ_TTL_MS = 15_000; // conditional-GET revalidation interval (a fresh entry is served as-is)
const READ_CACHE_MAX_AGE_MS = 10 * 60_000; // absolute lifetime — an entry past this is an orphan, dropped
const READ_CACHE_MAX_ENTRIES = 500; // hard cap → LRU-evict the oldest-touched entry once exceeded

// Exposed for tests to isolate cases; a no-op in production between deploys.
export function _clearRelayReadCache(): void {
  readCache.clear();
}

// Touch = move to the end (Map preserves insertion order → the FIRST key is the LRU one). Used on both
// read hits and writes so eviction drops the genuinely least-recently-used entry.
function cacheTouch(key: string, entry: ReadCacheEntry): void {
  readCache.delete(key);
  readCache.set(key, entry);
  while (readCache.size > READ_CACHE_MAX_ENTRIES) {
    const oldest = readCache.keys().next().value;
    if (oldest === undefined) break;
    readCache.delete(oldest);
  }
}

async function cachedGet(
  baseUrl: string,
  path: string,
  token: string,
  fetchImpl?: FetchLike,
): Promise<unknown> {
  const f = fetchImpl ?? fetch;
  const url = `${trimUrl(baseUrl)}${path}`;
  const key = `${url}|${token}`;
  const now = Date.now();
  let hit = readCache.get(key);
  // Orphan past its absolute lifetime → drop it and treat as a miss (a rotated token never re-reads).
  if (hit && now - hit.ts >= READ_CACHE_MAX_AGE_MS) {
    readCache.delete(key);
    hit = undefined;
  }
  if (hit && now - hit.ts < READ_TTL_MS) {
    cacheTouch(key, hit); // fresh: serve as-is but mark recently-used
    return hit.body;
  }

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (hit?.etag) headers['If-None-Match'] = hit.etag;
  const res = await f(url, { headers, signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS) });

  if (res.status === 304 && hit) {
    hit.ts = now; // still current — extend the TTL, reuse the body.
    cacheTouch(key, hit);
    return hit.body;
  }
  if (!res.ok) {
    if (hit) return hit.body; // serve stale over nothing on a transient failure
    return null;
  }
  const body = await res.json().catch(() => null);
  cacheTouch(key, { etag: res.headers.get('etag'), body, ts: now });
  return body;
}

export function fetchClanBoard(conn: FederationConnection, fetchImpl?: FetchLike): Promise<unknown> {
  return cachedGet(conn.baseUrl, `${FED}/board`, conn.token, fetchImpl);
}

export function fetchClanActivity(conn: FederationConnection, fetchImpl?: FetchLike): Promise<unknown> {
  return cachedGet(conn.baseUrl, `${FED}/activity`, conn.token, fetchImpl);
}

// ─────────────────────────────────────────────────────────────────────────────
// Orchestration (still pure — deps injected). Route handlers persist the returned
// connections into the DB cache and read them back for /state + fan-out.
// ─────────────────────────────────────────────────────────────────────────────

// Turn a set of instances + their assertions into live connections by exchanging each assertion at
// its clan. Skips this instance itself (`ownInstanceId`) — you never federate with your own home —
// and any instance the broker returned no/failed assertion for. Isolated per clan.
async function exchangeAll(
  instances: BrokerInstance[],
  assertions: BrokerAssertion[],
  ownInstanceId: string,
  fetchImpl?: FetchLike,
): Promise<FederationConnection[]> {
  const byId = new Map(instances.map((i) => [i.instanceId, i]));
  const out: FederationConnection[] = [];
  for (const a of assertions) {
    if (a.instanceId === ownInstanceId) continue; // never our own home
    const inst = byId.get(a.instanceId);
    if (!inst) continue;
    try {
      const res = await exchangeAssertion(inst.baseUrl, a.assertion, fetchImpl);
      if (res?.token) {
        out.push({ instanceId: inst.instanceId, name: inst.name, baseUrl: inst.baseUrl, token: res.token });
      }
    } catch {
      // isolated: one clan being down/rejecting must not sink the rest.
    }
  }
  return out;
}

// Trusted/hosted connect (WIRE §10.3) — zero-click. Vouch → assertions → exchange each clan.
export async function connectViaVouch(deps: {
  brokerBaseUrl: string;
  credential: string;
  discordId: string;
  ownInstanceId: string;
  fetchImpl?: FetchLike;
}): Promise<FederationConnection[]> {
  const { instances, assertions } = await brokerVouch(
    deps.brokerBaseUrl,
    deps.credential,
    deps.discordId,
    deps.fetchImpl,
  );
  return exchangeAll(instances, assertions, deps.ownInstanceId, deps.fetchImpl);
}

// Self-host connect after the device login completes (WIRE §10.3) — me/instances → assert → exchange.
export async function connectViaBrokerToken(deps: {
  brokerBaseUrl: string;
  brokerToken: string;
  ownInstanceId: string;
  fetchImpl?: FetchLike;
}): Promise<FederationConnection[]> {
  const instances = await brokerMeInstances(deps.brokerBaseUrl, deps.brokerToken, deps.fetchImpl);
  const targets = instances.map((i) => i.instanceId).filter((id) => id !== deps.ownInstanceId);
  if (targets.length === 0) return [];
  const { assertions } = await brokerAssert(deps.brokerBaseUrl, deps.brokerToken, targets, deps.fetchImpl);
  return exchangeAll(instances, assertions, deps.ownInstanceId, deps.fetchImpl);
}

export interface AggregatedClan {
  id: string;
  name: string;
  board: SafeBoard;
  activity: SafeActivity;
}

// Build the plugin-facing `clans[]` for /state: fetch each connected clan's board + activity
// server-to-server (short-TTL/ETag cached), isolated per clan (a down clan yields empties, not a throw).
// Every remote payload is schema-validated + clamped + depth-guarded (§2/§9) here before it can reach
// the plugin — untrusted clan strings (names/labels) never pass through raw. The clan `name` is from the
// broker directory but clamped defensively too.
export async function aggregateClans(
  connections: FederationConnection[],
  fetchImpl?: FetchLike,
): Promise<AggregatedClan[]> {
  return Promise.all(
    connections.map(async (conn) => {
      const [board, activity] = await Promise.all([
        fetchClanBoard(conn, fetchImpl).catch(() => null),
        fetchClanActivity(conn, fetchImpl).catch(() => null),
      ]);
      return {
        id: conn.instanceId,
        name: conn.name,
        board: sanitizeFederatedBoard(board),
        activity: sanitizeFederatedActivity(activity),
      };
    }),
  );
}

// §7 SERVER-AUTHORITATIVE fan-out computation. The plugin's declared `count`/`targets` are UNTRUSTED
// (a tampered client could report count:1 to slip past an `exclusive` clan while multi-crediting). Given
// the member's REAL cached connections, this derives the authoritative fan-out:
//   • self-host home → read-only in the mesh: NEVER relays → count 1, no targets.
//   • leaf ingest (not origin) → trust the relaying hosted home's already-server-computed descriptor.
//   • hosted origin → count = 1 (home) + #distinct declared targets that map to a REAL connection;
//     targets validated against those connections; own instance never a target.
// Pure + deps-injected so it is unit-testable with no DB.
export interface ServerFanout {
  count: number;
  instanceIds: string[];
  validTargets: FanoutTarget[];
  relayConnections: FederationConnection[]; // the member's OTHER clans (own home excluded)
}
export function computeServerFanout(deps: {
  ownInstanceId: string;
  tier: 'hosted' | 'self-host';
  isOrigin: boolean;
  relayTargets: FanoutTarget[];
  connections: FederationConnection[]; // the member's ALL cached connections
  declaredCount: number;
  declaredInstanceIds: string[];
}): ServerFanout {
  const relayConnections = deps.connections.filter((c) => c.instanceId !== deps.ownInstanceId);
  if (deps.isOrigin && deps.tier === 'hosted') {
    const connIds = new Set(relayConnections.map((c) => c.instanceId));
    const validTargets = deps.relayTargets.filter(
      (t) => t.instanceId !== deps.ownInstanceId && connIds.has(t.instanceId),
    );
    const distinct = [...new Set(validTargets.map((t) => t.instanceId))];
    return {
      count: 1 + distinct.length,
      instanceIds: [deps.ownInstanceId, ...distinct],
      validTargets,
      relayConnections,
    };
  }
  if (deps.isOrigin) {
    // self-host origin: credits only itself
    return { count: 1, instanceIds: [deps.ownInstanceId], validTargets: [], relayConnections };
  }
  // leaf / relayed write — the relaying hosted home already computed this authoritatively.
  return {
    count: deps.declaredCount,
    instanceIds: deps.declaredInstanceIds,
    validTargets: [],
    relayConnections,
  };
}

// Server-side fan-out (WIRE §10.4). The plugin submitted ONE game event to its home site, declaring
// per-clan `targets` (which tile on which clan it matched, resolved client-side). The home already
// credited itself; here we relay the SAME credit to the member's OTHER cached clans, each with that
// clan's own token + a fanout descriptor so a receiving `exclusive` clan can refuse. Best-effort and
// isolated per clan — a failing/absent clan never blocks the others or the home credit.
export async function fanOutCredit(deps: {
  tier: 'hosted' | 'self-host'; // FEDERATION_SECURITY.md priority #1 — only a TRUSTED (hosted) home writes cross-clan
  connections: FederationConnection[]; // the member's cached OTHER clans (home already excluded)
  targets: FanoutTarget[]; // server-validated per-clan tile matches (each has a real cached connection)
  payload: CreditPayload;
  fanoutCount: number; // SERVER-authoritative clan count (home + others) — drives `exclusive`
  instanceIds: string[]; // all instanceIds in the fan-out (incl. home)
  fetchImpl?: FetchLike;
}): Promise<FanoutRelayResult[]> {
  // §trust-tiers: a self-host home is READ-ONLY in the mesh — it aggregates boards but NEVER relays a
  // write to another clan. Cross-clan credit writes are restricted to trusted (hosted) homes we run.
  // (NOTE: a *modified* self-host client is still bounded by the RECEIVING clan's proof/hiscores
  // anti-cheat + the receiver's rate-limit/tag/opt-out controls — this gate is the outbound half.)
  if (deps.tier !== 'hosted') return [];
  const connById = new Map(deps.connections.map((c) => [c.instanceId, c]));
  const results: FanoutRelayResult[] = [];
  for (const target of deps.targets) {
    const conn = connById.get(target.instanceId);
    if (!conn) continue; // not a clan we hold a token for — skip silently
    try {
      const { status, json } = await postJson(
        `${trimUrl(conn.baseUrl)}${FED}/events`,
        {
          eventId: target.eventId,
          tileId: target.tileId,
          amount: deps.payload.amount,
          imageUrl: deps.payload.imageUrl ?? undefined,
          note: deps.payload.note ?? undefined,
          itemId: deps.payload.itemId ?? undefined,
          durationSeconds: deps.payload.durationSeconds ?? undefined,
          fanout: { count: deps.fanoutCount, instanceIds: deps.instanceIds },
        },
        { bearer: conn.token, fetchImpl: deps.fetchImpl },
      );
      const j = (json ?? {}) as { credited?: unknown; reason?: unknown; error?: unknown };
      const ok = status >= 200 && status < 300;
      results.push({
        instanceId: target.instanceId,
        ok,
        credited: ok && j.credited === true,
        reason:
          typeof j.reason === 'string'
            ? j.reason
            : typeof j.error === 'string'
              ? j.error
              : undefined,
        status,
      });
    } catch (err) {
      results.push({
        instanceId: target.instanceId,
        ok: false,
        credited: false,
        reason: err instanceof Error ? err.message : 'relay-failed',
      });
    }
  }
  return results;
}
