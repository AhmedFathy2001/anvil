// ─────────────────────────────────────────────────────────────────────────────────────────────────
// anvil-push: the plugin's live channel. Postgres NOTIFY 'anvil_push' (migration 0149's triggers and
// lib/pushNotify) says what moved; src/lib/push/hub asks the site for each affected view ONCE
// (api/internal/push/view → lib/push/views) and sends that same text to every plugin subscribed to it.
// It holds no state worth keeping and does no auth of its own beyond checking the ticket the site
// signed (src/lib/push/ticket), so it can restart at any time: plugins reconnect and get it all again.
//
// Its own container, off the site image (Dockerfile copies push/ and src/lib/push/):
//   node --experimental-strip-types push/server.ts
// so a blue-green site deploy doesn't drop every socket. Env: DATABASE_URL, PLAYER_SESSION_SECRET
// (the site's own — both keys derive from it), SITE_INTERNAL_URL (http://anvil-site:3000),
// PUSH_PORT (3100), PUSH_MIN_GAP_MS.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

import http from 'node:http';
import pg from 'pg';
import { WebSocketServer, type WebSocket } from 'ws';

import { ViewHub, parseChange } from '../src/lib/push/hub.ts';
import { internalSecret, ticketKey, verifyTicket } from '../src/lib/push/ticket.ts';

const PATH = '/api/plugin/push/ws';
const CHANNEL = 'anvil_push';
/** Under Cloudflare's 100 s idle cut, with room for a slow pong. */
const HEARTBEAT_MS = 25_000;

const port = Number(process.env.PUSH_PORT || 3100);
const dbUrl = process.env.DATABASE_URL;
const secret = process.env.PLAYER_SESSION_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-player-secret');
if (!dbUrl || !secret) {
  console.error('[push] DATABASE_URL and PLAYER_SESSION_SECRET are required');
  process.exit(1);
}
const key = ticketKey(secret);
const site = (process.env.SITE_INTERNAL_URL || 'http://anvil-site:3000').replace(/\/$/, '');
const siteSecret = internalSecret(secret);

/** One view from the site, or null (unknown/hidden key, or the site didn't answer in time). */
async function fetchView(viewKey: string): Promise<string | null> {
  try {
    const res = await fetch(`${site}/api/internal/push/view?key=${encodeURIComponent(viewKey)}`, {
      headers: { 'x-push-secret': siteSecret },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      if (res.status !== 404) log('push.view-failed', { key: viewKey, status: res.status });
      return null;
    }
    return await res.text();
  } catch (err) {
    log('push.view-failed', { key: viewKey, message: (err as Error).message });
    return null;
  }
}

const hub = new ViewHub({ fetchView, minGapMs: Number(process.env.PUSH_MIN_GAP_MS) || undefined });

function log(event: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ at: new Date().toISOString(), event, ...fields }));
}

// ── Sockets ──────────────────────────────────────────────────────────────────────────────────────

const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });
const alive = new WeakSet<WebSocket>();

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, clients: hub.size, db: listening }));
    return;
  }
  res.writeHead(404).end();
});

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '/', 'http://push');
  const auth = req.headers.authorization ?? '';
  const ticket = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const scope = url.pathname === PATH && ticket ? verifyTicket(ticket, key, Date.now()) : null;
  if (!scope) {
    socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    alive.add(ws);
    ws.on('pong', () => alive.add(ws));
    // Nothing comes the other way; the plugin only listens.
    ws.on('message', () => ws.close(1003, 'listen only'));
    // Hello first: the views follow, the cached ones straight away.
    ws.send(JSON.stringify({ t: 'hello' }));
    const remove = hub.add({
      scope,
      send: (m) => ws.readyState === ws.OPEN && ws.send(m),
      rescope: () => ws.close(4001, 'roster changed'),
    });
    // The ticket's scope was true when it was signed. At its expiry the plugin reconnects with a fresh
    // one, so a seat that changed (event over, team moved) re-scopes within the ticket's lifetime.
    const expiry = setTimeout(() => ws.close(4001, 'ticket expired'), Math.max(1_000, ticketExpiry(ticket) - Date.now()));
    ws.on('close', () => {
      clearTimeout(expiry);
      remove();
    });
  });
});

function ticketExpiry(ticket: string): number {
  try {
    return JSON.parse(Buffer.from(ticket.split('.')[0], 'base64url').toString('utf8')).x;
  } catch {
    return Date.now();
  }
}

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!alive.has(ws)) {
      ws.terminate();
      continue;
    }
    alive.delete(ws);
    ws.ping();
  }
}, HEARTBEAT_MS);

// ── Database ─────────────────────────────────────────────────────────────────────────────────────

let listening = false;
let db: pg.Client | null = null;
let retryMs = 1_000;
let everListened = false;

async function listen(): Promise<void> {
  const client = new pg.Client({ connectionString: dbUrl });
  client.on('notification', (n) => {
    const change = n.payload ? parseChange(n.payload) : null;
    if (change) hub.dispatch(change);
  });
  client.on('error', (err) => log('push.db-error', { message: err.message }));
  client.on('end', () => {
    if (db !== client) return;
    db = null;
    listening = false;
    log('push.db-lost', { retryMs });
    setTimeout(() => void listen(), retryMs);
    retryMs = Math.min(retryMs * 2, 30_000);
  });
  try {
    await client.connect();
    await client.query(`LISTEN ${CHANNEL}`);
  } catch (err) {
    log('push.db-connect-failed', { message: (err as Error).message, retryMs });
    void client.end().catch(() => {});
    setTimeout(() => void listen(), retryMs);
    retryMs = Math.min(retryMs * 2, 30_000);
    return;
  }
  db = client;
  listening = true;
  retryMs = 1_000;
  log('push.db-listening');
  // Changes made while the listener was down were never heard: everyone refetches once.
  if (everListened) hub.refreshAll();
  everListened = true;
}

// ── Lifecycle ────────────────────────────────────────────────────────────────────────────────────

function shutdown() {
  log('push.stopping', { clients: hub.size });
  clearInterval(heartbeat);
  // 1012 = service restart: the plugin reconnects with its usual backoff.
  for (const ws of wss.clients) ws.close(1012, 'restarting');
  server.close();
  const client = db;
  db = null;
  void (client ? client.end() : Promise.resolve()).finally(() => process.exit(0));
  setTimeout(() => process.exit(0), 5_000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server.listen(port, () => log('push.started', { port }));
void listen();
