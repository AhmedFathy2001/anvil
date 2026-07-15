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
  fetchClanBoard,
  _clearRelayReadCache,
  type FederationConnection,
} from '../src/lib/federationRelay.ts';

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
