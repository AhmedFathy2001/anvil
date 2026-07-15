// Site-relayed federation relay tests (WIRE §10) — MOCK broker + a MOCK 2nd clan site, both as
// in-process node:http servers. Exercises the PURE relay core (lib/federationRelay) end-to-end over
// real HTTP: the hosted vouch path, the self-host device-code path, server-side fan-out (incl.
// `exclusive`), the aggregated /state `clans[]` shape, and the read-cache/ETag behaviour.
//
// Run: node --experimental-strip-types --test tests/federation-relay.test.ts
// (lib/federationRelay imports nothing from `@/`, so Node's native TS type-stripping runs it directly
//  with no bundler, DB, or Next runtime.)

/* eslint-disable @typescript-eslint/no-explicit-any -- mock HTTP payloads + JSON bodies are untyped by nature in a test harness */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } from 'jose';
import {
  brokerVouch,
  brokerDeviceStart,
  brokerDevicePoll,
  brokerAssert,
  brokerMeInstances,
  brokerRegister,
  connectViaVouch,
  connectViaBrokerToken,
  aggregateClans,
  fanOutCredit,
  computeServerFanout,
  dedupeConnectionsByInstanceId,
  fetchClanBoard,
  _clearRelayReadCache,
  _primeRelayReadCache,
  type FederationConnection,
} from '../src/lib/federationRelay.ts';
import {
  guardedFetch,
  federationFetch,
  assertSafeFederationUrl,
  isDisallowedRedirect,
  isPrivateIp,
  encryptSecret,
  decryptSecret,
  sanitizeFederatedBoard,
  sanitizeFederatedActivity,
  safeVerificationUrl,
  getClientIp,
  CAP_LABEL,
  CAP_TILES,
} from '../src/lib/federationSecurity.ts';
import {
  decideCredit,
  tileAtCapacity,
  clampCreditAmount,
  homeCreditGate,
  federatedProofSatisfied,
  guestConflictExhausted,
  gateReplayThenBudget,
  planGuestConflict,
  exchangeRateLimitKey,
  guestRateLimitKey,
} from '../src/lib/federationDecisions.ts';
import {
  createGuardedRemoteJWKSet,
  verifyBrokerAssertion,
  _clearJwksCache,
} from '../src/lib/federationJwks.ts';

const FED = '/api/federation/v1';
const CREDENTIAL = 'derived-instance-credential';
const BROKER_TOKEN = 'broker-session-token';
const HOME_ID = 'home-instance';
const CLANB_ID = 'clanB-instance';

function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}
function send(res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(JSON.stringify(body));
}
function bearer(req: http.IncomingMessage): string | null {
  const h = req.headers['authorization'];
  return typeof h === 'string' && h.startsWith('Bearer ') ? h.slice(7) : null;
}

// ── State the mock servers expose to assertions ──────────────────────────────
let brokerBase = '';
let clanBBase = '';
let devicePolls = 0; // device/poll returns pending once, then complete
let clanBExclusive = false; // toggles clan B's sharedCredit policy
let clanBAcceptWrites = true; // toggles clan B's acceptFederatedWrites opt-out (§3)
const clanBEvents: any[] = []; // credited events recorded at clan B
let boardHits = 0; // how many times clan B actually served a fresh board body

let brokerServer: http.Server;
let clanBServer: http.Server;

before(async () => {
  // ---- Mock BROKER ----------------------------------------------------------
  brokerServer = http.createServer(async (req, res) => {
    const url = (req.url || '').split('?')[0];
    if (req.method === 'POST' && url === `${FED}/vouch`) {
      if (bearer(req) !== CREDENTIAL) return send(res, 401, { error: 'bad credential' });
      const body = await readBody(req);
      assert.equal(typeof body.discordId, 'string');
      return send(res, 200, {
        // Include this site's OWN instance + clan B — the relay must SKIP its own home.
        instances: [
          { instanceId: HOME_ID, name: 'Home', baseUrl: 'https://home.example' },
          { instanceId: CLANB_ID, name: 'Clan B', baseUrl: clanBBase },
        ],
        assertions: [
          { instanceId: HOME_ID, assertion: 'assert-HOME', exp: 0 },
          { instanceId: CLANB_ID, assertion: 'assert-B-vouch', exp: 0 },
        ],
      });
    }
    if (req.method === 'POST' && url === `${FED}/device/start`) {
      devicePolls = 0;
      return send(res, 200, {
        device_code: 'dev-code-123',
        user_code: 'WXYZ-1234',
        verification_url: `${brokerBase}/federation/device`,
        interval: 1,
        expires_in: 600,
      });
    }
    if (req.method === 'POST' && url === `${FED}/device/poll`) {
      const body = await readBody(req);
      assert.equal(body.device_code, 'dev-code-123');
      devicePolls += 1;
      if (devicePolls < 2) return send(res, 200, { status: 'pending' });
      return send(res, 200, { status: 'complete', brokerToken: BROKER_TOKEN, expiresIn: 3600 });
    }
    if (req.method === 'GET' && url === `${FED}/me/instances`) {
      if (bearer(req) !== BROKER_TOKEN) return send(res, 401, { error: 'bad broker token' });
      return send(res, 200, {
        version: 1,
        instances: [
          { instanceId: HOME_ID, name: 'Home', baseUrl: 'https://home.example' },
          { instanceId: CLANB_ID, name: 'Clan B', baseUrl: clanBBase },
        ],
      });
    }
    if (req.method === 'POST' && url === `${FED}/assert`) {
      if (bearer(req) !== BROKER_TOKEN) return send(res, 401, { error: 'bad broker token' });
      const body = await readBody(req);
      const ids: string[] = body.instanceIds || [];
      return send(res, 200, {
        assertions: ids.map((id) => ({ instanceId: id, assertion: `assert-${id}-device`, exp: 0 })),
        errors: [],
      });
    }
    if (req.method === 'POST' && url === `${FED}/register`) {
      return send(res, 200, { verificationToken: 'verif-tok', state: 'verified' });
    }
    if (req.method === 'GET' && url === `${FED}/jwks.json`) {
      return send(res, 200, { keys: [] });
    }
    return send(res, 404, { error: 'not found' });
  });

  // ---- Mock CLAN B ----------------------------------------------------------
  clanBServer = http.createServer(async (req, res) => {
    const url = (req.url || '').split('?')[0];
    if (req.method === 'POST' && url === `${FED}/exchange`) {
      const body = await readBody(req);
      assert.equal(typeof body.assertion, 'string');
      // A real clan validates the JWT vs the broker JWKS; this mock just mints a token so the RELAY
      // plumbing (exchange each assertion at the right clan, cache the token) is what's under test.
      return send(res, 200, {
        token: `B-token-${body.assertion}`,
        tokenId: 'tid-1',
        scopes: ['board:read', 'events:write'],
        instanceId: CLANB_ID,
        guest: false,
        memberId: 7,
      });
    }
    if (req.method === 'GET' && url === `${FED}/board`) {
      if (!bearer(req)?.startsWith('B-token-')) return send(res, 401, { error: 'bad token' });
      const etag = 'W/"board-v1"';
      if (req.headers['if-none-match'] === etag) return send(res, 304, {}, { ETag: etag });
      boardHits += 1;
      return send(
        res,
        200,
        { eventId: 99, name: 'Clan B Bingo', boardSize: 5, tiles: [{ tileId: 1, label: 'Zulrah' }] },
        { ETag: etag },
      );
    }
    if (req.method === 'GET' && url === `${FED}/activity`) {
      if (!bearer(req)?.startsWith('B-token-')) return send(res, 401, { error: 'bad token' });
      return send(res, 200, {
        eventId: 99,
        teamId: 3,
        teamName: 'Bees',
        items: [{ tileId: 1, label: 'Zulrah', points: 10, completedAt: '2026-07-15T00:00:00Z' }],
      });
    }
    if (req.method === 'POST' && url === `${FED}/events`) {
      if (!bearer(req)?.startsWith('B-token-')) return send(res, 401, { error: 'bad token' });
      const body = await readBody(req);
      // Faithful mock of the receiver contract (FEDERATION_SECURITY.md §3): a clan may opt OUT of
      // inbound relayed writes → clean { credited:false }.
      if (!clanBAcceptWrites) {
        return send(res, 200, { credited: false, reason: 'federation-writes-disabled' });
      }
      // Faithful mock of the /events sharedCredit contract (WIRE §5): exclusive refuses count>1.
      if (clanBExclusive && Number(body?.fanout?.count) > 1) {
        return send(res, 200, { credited: false, reason: 'exclusive' });
      }
      clanBEvents.push(body);
      return send(res, 201, { credited: true, instanceId: CLANB_ID, submissionId: clanBEvents.length });
    }
    return send(res, 404, { error: 'not found' });
  });

  await new Promise<void>((r) => brokerServer.listen(0, r));
  await new Promise<void>((r) => clanBServer.listen(0, r));
  brokerBase = `http://127.0.0.1:${(brokerServer.address() as AddressInfo).port}`;
  clanBBase = `http://127.0.0.1:${(clanBServer.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((r) => brokerServer.close(() => r()));
  await new Promise<void>((r) => clanBServer.close(() => r()));
});

// ─────────────────────────────────────────────────────────────────────────────

test('hosted vouch path → connections populated (own home skipped) + board/activity aggregated', async () => {
  _clearRelayReadCache();
  const connections = await connectViaVouch({
    brokerBaseUrl: brokerBase,
    credential: CREDENTIAL,
    discordId: 'discord-abc',
    ownInstanceId: HOME_ID,
  });

  // Own home was in the vouch response but must be skipped; only clan B remains.
  assert.equal(connections.length, 1);
  const conn = connections[0];
  assert.equal(conn.instanceId, CLANB_ID);
  assert.equal(conn.name, 'Clan B');
  assert.equal(conn.baseUrl, clanBBase);
  assert.equal(conn.token, 'B-token-assert-B-vouch');

  // /state's clans[] aggregation shape (WIRE §10.2).
  const clans = await aggregateClans(connections);
  assert.equal(clans.length, 1);
  const c = clans[0];
  assert.deepEqual(Object.keys(c).sort(), ['activity', 'board', 'id', 'name']);
  assert.equal(c.id, CLANB_ID);
  assert.equal(c.name, 'Clan B');
  assert.equal((c.board as any).eventId, 99);
  assert.equal((c.board as any).name, 'Clan B Bingo');
  assert.equal((c.activity as any).items[0].label, 'Zulrah');
});

test('hosted vouch rejects a bad instance credential', async () => {
  await assert.rejects(
    () => brokerVouch(brokerBase, 'wrong-secret', 'discord-abc'),
    /vouch failed \(401\)/,
  );
});

test('self-host device path → login (pending) → poll complete → connected', async () => {
  _clearRelayReadCache();
  // Step 1: start the device login (what /connect returns as { status:'login', verificationUrl }).
  const start = await brokerDeviceStart(brokerBase);
  assert.equal(start.device_code, 'dev-code-123');
  assert.match(start.verification_url, /\/federation\/device$/);

  // Step 2: first poll is still pending (member hasn't finished the browser login yet).
  const p1 = await brokerDevicePoll(brokerBase, start.device_code);
  assert.equal(p1.status, 'pending');

  // Step 3: second poll completes and hands us the broker session token.
  const p2 = await brokerDevicePoll(brokerBase, start.device_code);
  assert.equal(p2.status, 'complete');
  assert.equal((p2 as any).brokerToken, BROKER_TOKEN);

  // Step 4: me/instances + assert + exchange → the same cached connection set as the hosted path.
  const instances = await brokerMeInstances(brokerBase, BROKER_TOKEN);
  assert.deepEqual(instances.map((i) => i.instanceId).sort(), [CLANB_ID, HOME_ID].sort());

  const { assertions } = await brokerAssert(brokerBase, BROKER_TOKEN, [CLANB_ID]);
  assert.equal(assertions.length, 1);

  const connections = await connectViaBrokerToken({
    brokerBaseUrl: brokerBase,
    brokerToken: BROKER_TOKEN,
    ownInstanceId: HOME_ID,
  });
  assert.equal(connections.length, 1);
  assert.equal(connections[0].instanceId, CLANB_ID);
  assert.equal(connections[0].token, `B-token-assert-${CLANB_ID}-device`);
});

test('fan-out relay → 2nd clan credited with the declared target', async () => {
  clanBEvents.length = 0;
  clanBExclusive = false;
  const connections: FederationConnection[] = [
    { instanceId: CLANB_ID, name: 'Clan B', baseUrl: clanBBase, token: 'B-token-x' },
  ];
  const results = await fanOutCredit({
    tier: 'hosted',
    connections,
    targets: [{ instanceId: CLANB_ID, eventId: 99, tileId: 1 }],
    payload: { amount: 3, note: 'zul kc' },
    fanoutCount: 2,
    instanceIds: [HOME_ID, CLANB_ID],
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].instanceId, CLANB_ID);
  assert.equal(results[0].credited, true);

  assert.equal(clanBEvents.length, 1);
  assert.equal(clanBEvents[0].tileId, 1);
  assert.equal(clanBEvents[0].eventId, 99);
  assert.equal(clanBEvents[0].amount, 3);
  assert.equal(clanBEvents[0].fanout.count, 2);
  assert.deepEqual(clanBEvents[0].fanout.instanceIds, [HOME_ID, CLANB_ID]);
  // Loop guard: a relayed event must NOT carry `targets` (else the target would re-fan-out).
  assert.equal(clanBEvents[0].fanout.targets, undefined);
});

test('fan-out relay → 2nd clan `exclusive` refuses count>1 but credits count==1', async () => {
  clanBEvents.length = 0;
  clanBExclusive = true;
  const connections: FederationConnection[] = [
    { instanceId: CLANB_ID, name: 'Clan B', baseUrl: clanBBase, token: 'B-token-x' },
  ];

  // count>1 → exclusive clan refuses; nothing recorded.
  const refused = await fanOutCredit({
    tier: 'hosted',
    connections,
    targets: [{ instanceId: CLANB_ID, eventId: 99, tileId: 1 }],
    payload: { amount: 1 },
    fanoutCount: 2,
    instanceIds: [HOME_ID, CLANB_ID],
  });
  assert.equal(refused[0].credited, false);
  assert.equal(refused[0].reason, 'exclusive');
  assert.equal(clanBEvents.length, 0);

  // count==1 → exclusive does not apply; credited.
  const credited = await fanOutCredit({
    tier: 'hosted',
    connections,
    targets: [{ instanceId: CLANB_ID, eventId: 99, tileId: 1 }],
    payload: { amount: 1 },
    fanoutCount: 1,
    instanceIds: [CLANB_ID],
  });
  assert.equal(credited[0].credited, true);
  assert.equal(clanBEvents.length, 1);
});

test('fan-out skips targets with no cached connection (isolated, no throw)', async () => {
  clanBEvents.length = 0;
  clanBExclusive = false;
  const results = await fanOutCredit({
    tier: 'hosted',
    connections: [{ instanceId: CLANB_ID, name: 'Clan B', baseUrl: clanBBase, token: 'B-token-x' }],
    targets: [
      { instanceId: CLANB_ID, eventId: 99, tileId: 1 },
      { instanceId: 'unknown-clan', eventId: 5, tileId: 2 }, // no connection → skipped
    ],
    payload: { amount: 1 },
    fanoutCount: 2,
    instanceIds: [HOME_ID, CLANB_ID, 'unknown-clan'],
  });
  assert.equal(results.length, 1); // only the known clan produced a result
  assert.equal(results[0].instanceId, CLANB_ID);
  assert.equal(clanBEvents.length, 1);
});

test('board read-cache: a 2nd fetch inside the TTL is served without hitting the clan', async () => {
  _clearRelayReadCache();
  boardHits = 0;
  const conn: FederationConnection = { instanceId: CLANB_ID, name: 'Clan B', baseUrl: clanBBase, token: 'B-token-x' };
  const b1 = await fetchClanBoard(conn);
  const b2 = await fetchClanBoard(conn);
  assert.equal((b1 as any).eventId, 99);
  assert.deepEqual(b1, b2);
  assert.equal(boardHits, 1); // second read came from the short-TTL cache, not the clan
});

test('brokerRegister returns the verification token (register-on-enable)', async () => {
  const res = await brokerRegister(
    brokerBase,
    { instanceId: HOME_ID, baseUrl: 'https://home.example', name: 'Home', type: 'self-host' },
    null,
  );
  assert.equal(res?.verificationToken, 'verif-tok');
  assert.equal(res?.state, 'verified');
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY HARDENING (docs/FEDERATION_SECURITY.md)
// ═══════════════════════════════════════════════════════════════════════════════

// ── priority #1: cross-clan WRITES are restricted to trusted (hosted) homes ──────
test('§trust-tiers: a SELF-HOST home does NOT write-relay (read-only in the mesh)', async () => {
  clanBEvents.length = 0;
  clanBExclusive = false;
  clanBAcceptWrites = true;
  const results = await fanOutCredit({
    tier: 'self-host', // ← the whole point: a self-host never relays a cross-clan write
    connections: [{ instanceId: CLANB_ID, name: 'Clan B', baseUrl: clanBBase, token: 'B-token-x' }],
    targets: [{ instanceId: CLANB_ID, eventId: 99, tileId: 1 }],
    payload: { amount: 5 },
    fanoutCount: 2,
    instanceIds: [HOME_ID, CLANB_ID],
  });
  assert.deepEqual(results, []); // nothing relayed
  assert.equal(clanBEvents.length, 0); // clan B was never written to
});

// ── §3: a receiving clan may OPT OUT of relayed writes (acceptFederatedWrites=false) ──
test('§3: relaying to a clan that opted out surfaces credited:false / disabled', async () => {
  clanBEvents.length = 0;
  clanBAcceptWrites = false; // clan B refuses inbound relayed writes
  const results = await fanOutCredit({
    tier: 'hosted',
    connections: [{ instanceId: CLANB_ID, name: 'Clan B', baseUrl: clanBBase, token: 'B-token-x' }],
    targets: [{ instanceId: CLANB_ID, eventId: 99, tileId: 1 }],
    payload: { amount: 1 },
    fanoutCount: 2,
    instanceIds: [HOME_ID, CLANB_ID],
  });
  assert.equal(results[0].credited, false);
  assert.equal(results[0].reason, 'federation-writes-disabled');
  assert.equal(clanBEvents.length, 0); // no credit recorded
  clanBAcceptWrites = true; // reset for later tests
});

// ── §7: server-authoritative fanout — a LYING plugin count/targets is overridden ──
test('§7: computeServerFanout ignores a lying plugin count and validates targets', async () => {
  const conns: FederationConnection[] = [
    { instanceId: HOME_ID, name: 'Home', baseUrl: 'https://home.example', token: 'h' },
    { instanceId: CLANB_ID, name: 'Clan B', baseUrl: clanBBase, token: 'b' },
    { instanceId: 'clanC', name: 'Clan C', baseUrl: 'https://c.example', token: 'c' },
  ];
  // The tampered plugin declares count:1 (to slip past an exclusive clan) but two real targets.
  const fan = computeServerFanout({
    ownInstanceId: HOME_ID,
    tier: 'hosted',
    isOrigin: true,
    relayTargets: [
      { instanceId: CLANB_ID, eventId: 99, tileId: 1 },
      { instanceId: 'clanC', eventId: 7, tileId: 2 },
      { instanceId: HOME_ID, eventId: 1, tileId: 1 }, // own home — never a target
      { instanceId: 'ghost', eventId: 3, tileId: 3 }, // no cached connection — dropped
    ],
    connections: conns,
    declaredCount: 1, // ← the lie
    declaredInstanceIds: [CLANB_ID], // ← also a lie
  });
  assert.equal(fan.count, 3); // 1 home + 2 REAL distinct targets — NOT the declared 1
  assert.deepEqual(fan.instanceIds.sort(), [HOME_ID, CLANB_ID, 'clanC'].sort());
  assert.deepEqual(fan.validTargets.map((t) => t.instanceId).sort(), [CLANB_ID, 'clanC'].sort());
  assert.equal(fan.relayConnections.some((c) => c.instanceId === HOME_ID), false); // own home excluded
});

test('§7: a self-host origin computes count 1 (never relays) regardless of declared targets', () => {
  const fan = computeServerFanout({
    ownInstanceId: HOME_ID,
    tier: 'self-host',
    isOrigin: true,
    relayTargets: [{ instanceId: CLANB_ID, eventId: 99, tileId: 1 }],
    connections: [{ instanceId: CLANB_ID, name: 'B', baseUrl: clanBBase, token: 'b' }],
    declaredCount: 5,
    declaredInstanceIds: [HOME_ID, CLANB_ID],
  });
  assert.equal(fan.count, 1);
  assert.deepEqual(fan.validTargets, []);
});

// ── §1 SSRF: guardedFetch / assertSafeFederationUrl reject unsafe federation URLs ──
test('§1: assertSafeFederationUrl rejects http, credentials, and non-standard ports', async () => {
  await assert.rejects(() => assertSafeFederationUrl('http://clan.example/board'), /HTTPS required/);
  await assert.rejects(() => assertSafeFederationUrl('https://u:p@clan.example/'), /credentials/);
  await assert.rejects(() => assertSafeFederationUrl('https://clan.example:8443/'), /non-standard port/);
});

test('§1: assertSafeFederationUrl rejects private / loopback / CGNAT / metadata / mapped-v6 addresses', async () => {
  await assert.rejects(() => assertSafeFederationUrl('https://127.0.0.1/board'), /private/);
  await assert.rejects(() => assertSafeFederationUrl('https://10.0.0.5/board'), /private/);
  await assert.rejects(() => assertSafeFederationUrl('https://192.168.1.1/board'), /private/);
  await assert.rejects(() => assertSafeFederationUrl('https://100.64.0.1/board'), /private/); // CGNAT
  await assert.rejects(() => assertSafeFederationUrl('https://169.254.169.254/latest/meta-data'), /private/); // cloud metadata
  await assert.rejects(() => assertSafeFederationUrl('https://[::1]/board'), /private/); // ipv6 loopback
  await assert.rejects(() => assertSafeFederationUrl('https://[::ffff:10.0.0.1]/board'), /private/); // ipv4-mapped-v6
  // A public literal passes the guard (no connection is made by the validator).
  const ok = await assertSafeFederationUrl('https://8.8.8.8/board');
  assert.equal(ok.host, '8.8.8.8');
});

test('§1: isPrivateIp covers the blocked families and lets public through', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.0.1', '100.64.1.2', '169.254.169.254', '0.0.0.0', '::1', 'fd00::1', 'fe80::1']) {
    assert.equal(isPrivateIp(ip), true, `${ip} should be private`);
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '2606:4700:4700::1111']) {
    assert.equal(isPrivateIp(ip), false, `${ip} should be public`);
  }
});

test('§1: isDisallowedRedirect flags real redirects but allows 200/201/304', () => {
  for (const s of [301, 302, 303, 307, 308]) assert.equal(isDisallowedRedirect(s), true, `${s}`);
  for (const s of [200, 201, 304, 404, 500]) assert.equal(isDisallowedRedirect(s), false, `${s}`);
});

test('§1: guardedFetch (as fetchImpl) BLOCKS the loopback/http broker — every outbound is guarded', async () => {
  // Wiring guardedFetch as the relay fetchImpl (exactly as production does) turns the loopback http
  // mock broker into a hard rejection — proving no federation outbound can reach an http/private URL.
  await assert.rejects(
    () => connectViaVouch({ brokerBaseUrl: brokerBase, credential: CREDENTIAL, discordId: 'd', ownInstanceId: HOME_ID, fetchImpl: federationFetch }),
    /HTTPS required|private/,
  );
  // And guardedFetch itself rejects a plain private-IP dial.
  await assert.rejects(() => guardedFetch('https://127.0.0.1/x'), /private/);
});

// ── §2/§9: federated data is validated + clamped + depth-guarded before store/relay ──
test('§2/§9: sanitizeFederatedBoard clamps oversized strings + arrays and drops junk', () => {
  const hostile = {
    eventId: 99,
    name: 'X'.repeat(500), // > CAP_NAME
    boardSize: 5,
    evil: '<script>alert(1)</script>', // unknown field → dropped
    tiles: [
      ...Array.from({ length: CAP_TILES + 250 }, (_, i) => ({ tileId: i, label: 'L'.repeat(400), secret: 'drop-me' })),
      { label: 'no id — dropped' }, // missing tileId → dropped
      'not-an-object',
    ],
  };
  const safe = sanitizeFederatedBoard(hostile);
  assert.equal(safe.eventId, 99);
  assert.equal(safe.name.length, 64); // clamped to CAP_NAME
  assert.ok(safe.tiles.length <= CAP_TILES); // array bounded
  assert.ok(safe.tiles.every((t) => t.label.length <= CAP_LABEL)); // labels clamped
  assert.equal((safe as any).evil, undefined); // unknown field dropped
  assert.equal((safe.tiles[0] as any).secret, undefined); // unknown tile field dropped
});

test('§2/§9: sanitizers reject a malformed / non-object / over-deep payload → empty safe object', () => {
  assert.deepEqual(sanitizeFederatedBoard(null), { eventId: null, name: '', boardSize: null, tiles: [] });
  assert.deepEqual(sanitizeFederatedBoard('nope'), { eventId: null, name: '', boardSize: null, tiles: [] });
  assert.deepEqual(sanitizeFederatedActivity(42), { eventId: null, teamId: null, teamName: '', items: [] });
  // Build a pathologically deep object (JSON-bomb shape) → depth guard collapses it to empty.
  let deep: any = 'leaf';
  for (let i = 0; i < 30; i++) deep = { nested: deep };
  assert.deepEqual(sanitizeFederatedBoard(deep), { eventId: null, name: '', boardSize: null, tiles: [] });
  assert.equal(sanitizeFederatedBoard({ eventId: 1, tiles: [deep] }).tiles.length, 0); // deep tile → whole payload rejected
});

// ── §4: cached tokens round-trip through encryption; a tamper is rejected ──
test('§4: encryptSecret/decryptSecret round-trip; ciphertext is opaque; tamper throws', () => {
  const key = 'server-side-encryption-key';
  const token = 'B-token-super-secret-value';
  const enc = encryptSecret(token, key);
  assert.notEqual(enc, token); // not stored in the clear
  assert.ok(enc.startsWith('fde1:'));
  assert.equal(decryptSecret(enc, key), token); // round-trips
  // Wrong key / tampered ciphertext → GCM auth failure throws (never returns garbage).
  assert.throws(() => decryptSecret(enc, 'different-key'));
  assert.throws(() => decryptSecret(enc.slice(0, -4) + 'AAAA', key));
  // Legacy plaintext (no prefix) passes through untouched (additive rollout).
  assert.equal(decryptSecret('legacy-plain-token', key), 'legacy-plain-token');
});

// ── §8: verificationUrl is pinned to https + the broker host ──
test('§8: safeVerificationUrl allows only https on the broker host', () => {
  const broker = 'https://broker.anvilosrs.com';
  assert.equal(safeVerificationUrl('https://broker.anvilosrs.com/federation/device', broker), 'https://broker.anvilosrs.com/federation/device');
  assert.equal(safeVerificationUrl('http://broker.anvilosrs.com/federation/device', broker), null); // not https
  assert.equal(safeVerificationUrl('https://evil.example/federation/device', broker), null); // wrong host (phish)
  assert.equal(safeVerificationUrl(undefined, broker), null);
});

// ═══════════════════════════════════════════════════════════════════════════════
// CODE-REVIEW HARDENING PASS (P0–P3 findings)
// ═══════════════════════════════════════════════════════════════════════════════

// ── #2: an exclusive ORIGIN skips only its own credit and STILL fans out (never drops the mesh) ──
test('#2: decideCredit — exclusive origin skips home credit but STILL fans out; a leaf just refuses', () => {
  // exclusive + multi-clan + ORIGIN: don't credit ourselves, but DO relay onward to the other clans.
  assert.deepEqual(decideCredit({ sharedCredit: 'exclusive', fanoutCount: 2, isOrigin: true }), {
    creditHome: false,
    fanOut: true,
    refusal: 'exclusive',
  });
  // exclusive + multi-clan + LEAF: refuse; a leaf never fans out (only the origin home does).
  assert.deepEqual(decideCredit({ sharedCredit: 'exclusive', fanoutCount: 2, isOrigin: false }), {
    creditHome: false,
    fanOut: false,
    refusal: 'exclusive',
  });
  // accept → credit; an origin still fans out to the others.
  assert.deepEqual(decideCredit({ sharedCredit: 'accept', fanoutCount: 2, isOrigin: true }), {
    creditHome: true,
    fanOut: true,
  });
  // exclusive but single-clan (count 1) → not blocked at all.
  assert.deepEqual(decideCredit({ sharedCredit: 'exclusive', fanoutCount: 1, isOrigin: true }), {
    creditHome: true,
    fanOut: true,
  });
  // A leaf that IS credited (accept) does not fan out.
  assert.deepEqual(decideCredit({ sharedCredit: 'accept', fanoutCount: 2, isOrigin: false }), {
    creditHome: true,
    fanOut: false,
  });
});

// ── #1: over-submission cap — a tile already at/over its threshold is not credited again ──
test('#1: tileAtCapacity mirrors the native cap across every submission-backed mode', () => {
  // simple count tile: cumulative sum vs required.
  assert.equal(tileAtCapacity({ tileType: 'kill', requiredAmount: 5, simpleTotal: 5 }), true); // exactly at
  assert.equal(tileAtCapacity({ tileType: 'kill', requiredAmount: 5, simpleTotal: 6 }), true); // over
  assert.equal(tileAtCapacity({ tileType: 'kill', requiredAmount: 5, simpleTotal: 4 }), false); // under → allowed
  // valuetotal: cumulative sum toward the target.
  assert.equal(tileAtCapacity({ tileType: 'valuetotal', requiredAmount: 100, simpleTotal: 120 }), true);
  assert.equal(tileAtCapacity({ tileType: 'valuetotal', requiredAmount: 100, simpleTotal: 50 }), false);
  // value: BEST single haul, not the running sum (a 90m haul on a 100m tile is under even if summed).
  assert.equal(tileAtCapacity({ tileType: 'value', requiredAmount: 100, bestHaul: 100 }), true);
  assert.equal(tileAtCapacity({ tileType: 'value', requiredAmount: 100, bestHaul: 90, simpleTotal: 9999 }), false);
  // per-item: caps on that item's own required amount.
  assert.equal(tileAtCapacity({ tileType: 'drop', requiredAmount: null, itemRequired: 3, itemTotal: 3 }), true);
  assert.equal(tileAtCapacity({ tileType: 'drop', requiredAmount: null, itemRequired: 3, itemTotal: 2 }), false);
  // no threshold → never "complete" by amount alone (e.g. a count-up tile with no requiredAmount).
  assert.equal(tileAtCapacity({ tileType: 'kill', requiredAmount: null, simpleTotal: 9999 }), false);
});

// ── #6: the broker JWKS fetch is routed through the SSRF guard (admin-editable jwksUrl) ──
test('#6: createGuardedRemoteJWKSet routes the JWKS fetch through guardedFetch (private URL blocked)', async () => {
  _clearJwksCache();
  const jwks = createGuardedRemoteJWKSet('https://127.0.0.1/jwks.json'); // loopback — must be refused
  // Using the key set triggers the JWKS fetch → guardedFetch rejects the private/loopback address, so
  // no assertion signed by a key at a private URL can ever be validated (SSRF-safe, §1).
  await assert.rejects(
    () => (jwks as any)({ alg: 'EdDSA', kid: 'whatever' }, {} as any),
    /private|blocked|resolves/,
  );
});

// ── #7: assertion verify bounds token age (maxTokenAge) + requires exp/iat/jti/aud/iss/sub ──
test('#7: verifyBrokerAssertion accepts a fresh assertion but rejects a held / far-future-exp / no-exp one', async () => {
  const { publicKey, privateKey } = await generateKeyPair('Ed25519', { extractable: true });
  const pub = { ...(await exportJWK(publicKey)), alg: 'EdDSA', kid: 'k1', use: 'sig' };
  const jwks = createLocalJWKSet({ keys: [pub] });
  const iss = 'https://broker.example';
  const aud = 'home-instance';
  const now = Math.floor(Date.now() / 1000);
  const mk = (claims: Record<string, unknown>) =>
    new SignJWT(claims).setProtectedHeader({ alg: 'EdDSA', kid: 'k1' });

  // A FRESH assertion (iat now, exp iat+60) verifies and yields its sub.
  const fresh = await mk({ sub: 'discord-1', jti: 'j1' })
    .setIssuer(iss).setAudience(aud).setIssuedAt(now).setExpirationTime(now + 60).sign(privateKey);
  const { payload } = await verifyBrokerAssertion(fresh, jwks, { issuer: iss, audience: aud });
  assert.equal(payload.sub, 'discord-1');

  // A HELD / far-future-exp assertion (iat 200s ago, exp a year out): signature + exp are individually
  // fine, but maxTokenAge:'90s' rejects it — a stale assertion can't be replayed long after issuance.
  const held = await mk({ sub: 'discord-1', jti: 'j2' })
    .setIssuer(iss).setAudience(aud).setIssuedAt(now - 200).setExpirationTime(now + 31_536_000).sign(privateKey);
  await assert.rejects(() => verifyBrokerAssertion(held, jwks, { issuer: iss, audience: aud }));

  // A token with NO exp claim is rejected by requiredClaims (can't smuggle a never-expiring assertion).
  const noExp = await mk({ sub: 'discord-1', jti: 'j3' })
    .setIssuer(iss).setAudience(aud).setIssuedAt(now).sign(privateKey);
  await assert.rejects(() => verifyBrokerAssertion(noExp, jwks, { issuer: iss, audience: aud }));
});

// ── #10: sanitizer ids — null/false/''/[] are DROPPED, not coerced to 0 ──
test('#10: clampInt (via sanitizeFederatedBoard) drops null/false/empty ids instead of surfacing id 0', () => {
  const board = sanitizeFederatedBoard({
    eventId: null, // → null, NOT 0
    boardSize: '', // → null, NOT 0
    name: 'B',
    tiles: [
      { tileId: null, label: 'null id' }, // dropped
      { tileId: false, label: 'bool id' }, // dropped
      { tileId: '', label: 'empty id' }, // dropped
      { tileId: [], label: 'array id' }, // dropped
      { tileId: 1.5, label: 'float id' }, // dropped (non-integer)
      { tileId: 7, label: 'real id' }, // kept
      { tileId: '8', label: 'numeric string id' }, // kept
    ],
  });
  assert.equal(board.eventId, null); // finding #10: a null id must NOT become 0
  assert.equal(board.boardSize, null);
  assert.deepEqual(board.tiles.map((t) => t.tileId).sort((a, b) => a - b), [7, 8]);
});

// ── #4: replaceConnectionsForUser dedup — duplicate instanceId collapsed → no unique-index 500 ──
test('#4: dedupeConnectionsByInstanceId collapses duplicate instanceIds (keep last)', () => {
  const dupes: FederationConnection[] = [
    { instanceId: CLANB_ID, name: 'B old', baseUrl: 'https://b.example', token: 'old' },
    { instanceId: 'clanC', name: 'C', baseUrl: 'https://c.example', token: 'c' },
    { instanceId: CLANB_ID, name: 'B new', baseUrl: 'https://b.example', token: 'new' }, // dup wins
  ];
  const out = dedupeConnectionsByInstanceId(dupes);
  assert.equal(out.length, 2); // one row per instanceId — the bulk insert can't hit the unique index
  const b = out.find((c) => c.instanceId === CLANB_ID)!;
  assert.equal(b.token, 'new'); // keep LAST — a re-connect re-mints, newest token wins
  assert.equal(b.name, 'B new');
  // Empty + already-unique inputs are pass-throughs.
  assert.deepEqual(dedupeConnectionsByInstanceId([]), []);
});

// ── #5: a thrown fetch error on device-poll degrades to "keep polling", never a 500 ──
test('#5: brokerDevicePoll degrades a THROWN / rejected fetch to { status:pending }', async () => {
  const throwingFetch = (() => {
    throw new Error('SSRF blocked');
  }) as unknown as typeof fetch;
  assert.deepEqual(await brokerDevicePoll('https://broker.example', 'dev-code', throwingFetch), { status: 'pending' });

  const rejectingFetch = (() => Promise.reject(new Error('timeout'))) as unknown as typeof fetch;
  assert.deepEqual(await brokerDevicePoll('https://broker.example', 'dev-code', rejectingFetch), { status: 'pending' });
});

// ── #11: a departed (leftAt) guest is never reused as-is (reactivate, don't mint for a leftAt member) ──
test('#11: planGuestConflict — active guest reused, departed guest reactivated (not returned as-is)', () => {
  assert.equal(planGuestConflict({ leftAt: null }), 'reuse'); // active → reuse
  assert.equal(planGuestConflict({ leftAt: '2026-01-01T00:00:00Z' }), 'reactivate'); // departed → NOT reused as-is
  assert.equal(planGuestConflict(null), 'missing');
  assert.equal(planGuestConflict(undefined), 'missing');
});

// ── #14: exchange + guest-creation rate limits are keyed per MEMBER (sub), not per home-clan IP ──
test('#14: rate-limit keys are per-member (sub) — different members never share a bucket', () => {
  assert.equal(exchangeRateLimitKey('discordA'), exchangeRateLimitKey('discordA')); // stable per member
  assert.notEqual(exchangeRateLimitKey('discordA'), exchangeRateLimitKey('discordB')); // fair share across members
  assert.notEqual(guestRateLimitKey('discordA'), guestRateLimitKey('discordB'));
  assert.notEqual(exchangeRateLimitKey('discordA'), guestRateLimitKey('discordA')); // separate budgets
  assert.ok(exchangeRateLimitKey('discordA').includes('discordA')); // derived from the member id only
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECOND HARDENING PASS (docs/FEDERATION_SECURITY.md — federation-review findings)
// ═══════════════════════════════════════════════════════════════════════════════

// ── #1: a proof-required LEAF write with NO proof reference is rejected (not silently credited) ──
test('#1: federatedProofSatisfied enforces proof on the LEAF path, not just the origin', () => {
  // Count-only tiles never require proof — either side, image or not.
  assert.equal(federatedProofSatisfied({ isCountOnly: true, isOrigin: false, hasOwnImage: false, hasFederatedProof: false }), true);
  // Proof-required LEAF: the origin's federated proof ref is REQUIRED. Missing → REJECT (the bug).
  assert.equal(federatedProofSatisfied({ isCountOnly: false, isOrigin: false, hasOwnImage: false, hasFederatedProof: false }), false);
  // Proof-required LEAF WITH the origin's proof ref → allowed.
  assert.equal(federatedProofSatisfied({ isCountOnly: false, isOrigin: false, hasOwnImage: false, hasFederatedProof: true }), true);
  // A leaf must NOT be satisfied by an origin-only image field — only the federated proof ref counts.
  assert.equal(federatedProofSatisfied({ isCountOnly: false, isOrigin: false, hasOwnImage: true, hasFederatedProof: false }), false);
  // Proof-required ORIGIN: needs its own uploaded (managed) image.
  assert.equal(federatedProofSatisfied({ isCountOnly: false, isOrigin: true, hasOwnImage: true, hasFederatedProof: false }), true);
  assert.equal(federatedProofSatisfied({ isCountOnly: false, isOrigin: true, hasOwnImage: false, hasFederatedProof: false }), false);
});

// ── #2: getClientIp trusts the PROXY-APPENDED value (x-real-ip / last XFF), never the leftmost ──
test('#2: getClientIp uses the appended IP, never the spoofable leftmost XFF entry', () => {
  const req = (headers: Record<string, string>) => ({ headers: new Headers(headers) });
  // A spoofed leftmost + the real appended rightmost → we take the RIGHTMOST (what our proxy added).
  assert.equal(getClientIp(req({ 'x-forwarded-for': '1.2.3.4, 9.9.9.9' })), '9.9.9.9');
  // x-real-ip (Caddy) wins over XFF entirely.
  assert.equal(getClientIp(req({ 'x-real-ip': '9.9.9.9', 'x-forwarded-for': '1.2.3.4, 8.8.8.8' })), '9.9.9.9');
  // Single-entry XFF → that entry (the proxy added it).
  assert.equal(getClientIp(req({ 'x-forwarded-for': '5.5.5.5' })), '5.5.5.5');
  // Whitespace + trailing commas tolerated; still rightmost.
  assert.equal(getClientIp(req({ 'x-forwarded-for': 'aa , bb , cc ' })), 'cc');
  // No proxy header → a single shared 'unknown' bucket (a direct/local call), never a spoofed value.
  assert.equal(getClientIp(req({})), 'unknown');
});

// ── #3: a home-side "can't credit here" condition SKIPS the home credit on the ORIGIN but still relays;
//        a LEAF aborts (nothing to relay) ──
test('#3: homeCreditGate — origin skips-and-relays, leaf aborts, no block credits', () => {
  // No block → credit normally.
  assert.equal(homeCreditGate({ isOrigin: true, blockedReason: null }), 'credit');
  assert.equal(homeCreditGate({ isOrigin: false, blockedReason: null }), 'credit');
  // A force-ended / not-enrolled / tile-not-found HOME on the ORIGIN skips its own credit but keeps
  // fanning out — it must NOT abort the whole request (the bug: a live clan would lose the credit).
  for (const reason of ['not-enrolled', 'event-ended', 'tile-not-found', 'itemId-not-tracked']) {
    assert.equal(homeCreditGate({ isOrigin: true, blockedReason: reason }), 'skip-relay');
    assert.equal(homeCreditGate({ isOrigin: false, blockedReason: reason }), 'abort'); // leaf: nothing to relay
  }
});

// ── #5: a replay is rejected BEFORE the per-member budget is consumed (victim bucket untouched) ──
test('#5: gateReplayThenBudget — a replay never consumes the member budget', async () => {
  let budgetCalls = 0;
  // Replay (recordJti → false): consumeBudget must NEVER run → the victim's bucket is untouched.
  const replay = await gateReplayThenBudget({
    recordJti: async () => false,
    consumeBudget: async () => {
      budgetCalls += 1;
      return { ok: true };
    },
    budgetOk: (b) => b.ok,
  });
  assert.equal(replay.outcome, 'replay');
  assert.equal(budgetCalls, 0); // ← the whole point of #5

  // Fresh assertion: budget consumed exactly once, outcome 'ok'.
  const ok = await gateReplayThenBudget({
    recordJti: async () => true,
    consumeBudget: async () => {
      budgetCalls += 1;
      return { ok: true };
    },
    budgetOk: (b) => b.ok,
  });
  assert.equal(ok.outcome, 'ok');
  assert.equal(budgetCalls, 1);

  // Fresh but over budget → 'rate-limited' (still surfaces the budget for its headers).
  const limited = await gateReplayThenBudget({
    recordJti: async () => true,
    consumeBudget: async () => ({ ok: false, remaining: 0 }),
    budgetOk: (b) => b.ok,
  });
  assert.equal(limited.outcome, 'rate-limited');
  assert.equal((limited as { budget: { remaining: number } }).budget.remaining, 0);
});

// ── #8: cachedGet serves the STALE cached value on a THROWN fetch (not only a non-ok Response) ──
test('#8: a thrown fetch (SSRF-reject / timeout) serves the stale board, not an empty one', async () => {
  _clearRelayReadCache();
  // Seed a cache entry aged past the TTL (15s) but within the absolute lifetime (10m) so the next fetch
  // revalidates — and that revalidation THROWS (guardedFetch-style rejection / network blip).
  _primeRelayReadCache('https://clanB.example', `${FED}/board`, 'B-token-x', { eventId: 7, name: 'Stale B', boardSize: 5, tiles: [] }, 60_000);
  const throwing = (() => {
    throw new Error('SSRF blocked / timeout');
  }) as unknown as typeof fetch;
  const conn: FederationConnection = { instanceId: CLANB_ID, name: 'Clan B', baseUrl: 'https://clanB.example', token: 'B-token-x' };
  const board = await fetchClanBoard(conn, throwing);
  assert.equal((board as any).eventId, 7); // stale value served on throw, not null/empty
  assert.equal((board as any).name, 'Stale B');

  // A COLD miss (no cached value) + a throw has nothing to serve → the error surfaces (aggregateClans
  // isolates it per clan) rather than silently returning stale-from-nowhere.
  _clearRelayReadCache();
  await assert.rejects(() => fetchClanBoard(conn, throwing), /SSRF blocked/);
});

// ── #9: over-submission REMAINDER clamp — credit only up to the remaining need (home AND leaf) ──
test('#9: clampCreditAmount clamps to the remaining need (mirrors the native submissions cap)', () => {
  // Simple count tile 0/3, amount 5 → credits 3 (the bug wrote 5/3).
  assert.equal(clampCreditAmount({ requestedAmount: 5, tileType: 'kill', requiredAmount: 3, simpleTotal: 0 }), 3);
  // 1/3 already, amount 5 → 2 remaining.
  assert.equal(clampCreditAmount({ requestedAmount: 5, tileType: 'kill', requiredAmount: 3, simpleTotal: 1 }), 2);
  // Under and within → unchanged.
  assert.equal(clampCreditAmount({ requestedAmount: 2, tileType: 'kill', requiredAmount: 5, simpleTotal: 1 }), 2);
  // Already complete → 0 (the caller's tileAtCapacity also refuses, but clamp is 0 defensively).
  assert.equal(clampCreditAmount({ requestedAmount: 5, tileType: 'kill', requiredAmount: 3, simpleTotal: 3 }), 0);
  // Per-item: clamps to the item's own remaining.
  assert.equal(clampCreditAmount({ requestedAmount: 9, tileType: 'drop', requiredAmount: null, itemRequired: 4, itemTotal: 1 }), 3);
  // value + valuetotal: hauls are independent / may overshoot the aggregate → NEVER clamped.
  assert.equal(clampCreditAmount({ requestedAmount: 90_000_000, tileType: 'value', requiredAmount: 100_000_000, simpleTotal: 0 }), 90_000_000);
  assert.equal(clampCreditAmount({ requestedAmount: 10_000_000, tileType: 'valuetotal', requiredAmount: 20_000_000, simpleTotal: 15_000_000 }), 10_000_000);
  // No threshold → never clamped.
  assert.equal(clampCreditAmount({ requestedAmount: 42, tileType: 'kill', requiredAmount: null, simpleTotal: 999 }), 42);
});

// ── #12: the auto-guest find-or-create retry is BOUNDED (no unbounded recursion) ──
test('#12: guestConflictExhausted bounds the guest find-or-create retry', () => {
  assert.equal(guestConflictExhausted(0), false); // first attempt may retry once
  assert.equal(guestConflictExhausted(1), true); // after one retry → exhausted (loop terminates)
  assert.equal(guestConflictExhausted(2), true);
});
