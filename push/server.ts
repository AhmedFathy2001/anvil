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
import type { Duplex } from 'node:stream';
import pg from 'pg';
import { WebSocketServer, type WebSocket } from 'ws';

import { ViewHub, parseChange, parseFeed, parseRows } from '../src/lib/push/hub.ts';
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

/** The event an overlay key opens, or null (unknown, reset, removed, or the site didn't answer). */
async function overlayEvent(overlayKey: string): Promise<number | null> {
  try {
    const res = await fetch(`${site}/api/internal/push/overlay?key=${encodeURIComponent(overlayKey)}`, {
      headers: { 'x-push-secret': siteSecret },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { eventId?: unknown };
    return Number.isInteger(body.eventId) ? (body.eventId as number) : null;
  } catch {
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
    res.end(JSON.stringify({ ok: true, clients: hub.size, overlays: hub.watching, db: listening }));
    return;
  }
  res.writeHead(404).end();
});

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '/', 'http://push');
  const auth = req.headers.authorization ?? '';
  const ticket = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  // A stream overlay (a browser: it can't send the plugin's Authorization header) on the same path.
  const overlayKey = url.searchParams.get('overlay');
  if (url.pathname === PATH && !ticket && overlayKey != null) {
    void acceptOverlay(req, socket, head, overlayKey);
    return;
  }
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

// ── Stream overlays ──────────────────────────────────────────────────────────────────────────────
//
// The overlay key is the overlay's whole permission and it only ever earns a nudge (lib/push/hub,
// watchers), so the worst a stolen key does here is learn WHEN a board moves — which its public
// overlay already shows. Each socket is capped in lifetime so a reset key's sockets drop within
// hours even if the page never fetches; the page reconnects and is checked again.

const OVERLAY_KEY = /^[A-Za-z0-9_-]{32}$/;
const OVERLAY_MAX_MS = 6 * 60 * 60_000;
/** Sockets per address: a scene has a handful of overlays, not hundreds. */
const OVERLAYS_PER_IP = 20;
/** Every overlay socket on this server, and key checks running at once against the site. */
const OVERLAYS_MAX = 5_000;
const LOOKUPS_MAX = 32;
/** A refused key stays refused this long without asking the site again. */
const REFUSED_TTL_MS = 60_000;
const overlaysByIp = new Map<string, number>();
const refused = new Map<string, number>();
let overlaysOpen = 0;
let lookups = 0;

/**
 * The caller's address. Every public request reaches the box through the Cloudflare tunnel, and
 * Cloudflare SETS CF-Connecting-IP at its edge (a client's own value is replaced), so that is the
 * one header trusted. X-Forwarded-For's leftmost entry is whatever the client wrote; only the
 * rightmost — added by the proxy in front of this server — is used when CF's is missing.
 */
function clientIp(req: http.IncomingMessage): string {
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf) return cf.trim();
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd) {
    const parts = fwd.split(',');
    return parts[parts.length - 1].trim();
  }
  return req.socket.remoteAddress ?? '?';
}

function isRefused(overlayKey: string): boolean {
  const until = refused.get(overlayKey);
  if (until == null) return false;
  if (until > Date.now()) return true;
  refused.delete(overlayKey);
  return false;
}

function refuse(overlayKey: string): void {
  // Bounded: an attacker cycling random keys can't grow this past a few thousand entries.
  if (refused.size >= 5_000) refused.delete(refused.keys().next().value as string);
  refused.set(overlayKey, Date.now() + REFUSED_TTL_MS);
}

async function acceptOverlay(req: http.IncomingMessage, socket: Duplex, head: Buffer, overlayKey: string) {
  const ip = clientIp(req);
  const open = overlaysByIp.get(ip) ?? 0;
  if (!OVERLAY_KEY.test(overlayKey) || isRefused(overlayKey)) {
    socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    return;
  }
  if (open >= OVERLAYS_PER_IP || overlaysOpen >= OVERLAYS_MAX || lookups >= LOOKUPS_MAX) {
    socket.end('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n');
    return;
  }
  overlaysByIp.set(ip, open + 1);
  overlaysOpen++;
  // Released once, by whichever comes first: the raw socket closing (before, during or after the
  // upgrade, errors included) or the websocket closing. Counting on the ws callback alone leaked a
  // slot for every socket that died before its upgrade finished.
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    overlaysOpen--;
    const n = (overlaysByIp.get(ip) ?? 1) - 1;
    if (n <= 0) overlaysByIp.delete(ip);
    else overlaysByIp.set(ip, n);
  };
  socket.once('close', release);
  socket.once('error', release);
  lookups++;
  let eventId: number | null;
  try {
    eventId = await overlayEvent(overlayKey);
  } finally {
    lookups--;
  }
  if (eventId == null) refuse(overlayKey);
  if (eventId == null || socket.destroyed) {
    release();
    if (!socket.destroyed) socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    alive.add(ws);
    ws.on('pong', () => alive.add(ws));
    ws.on('message', () => ws.close(1003, 'listen only'));
    ws.send(JSON.stringify({ t: 'hello' }));
    const stop = hub.watch(eventId, { send: (m) => ws.readyState === ws.OPEN && ws.send(m) });
    const expiry = setTimeout(() => ws.close(4001, 'reconnect'), OVERLAY_MAX_MS);
    ws.on('close', () => {
      clearTimeout(expiry);
      stop();
      release();
    });
  });
}

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
    if (!n.payload) return;
    const rows = parseRows(n.payload);
    if (rows) {
      hub.deliverRows(rows);
      return;
    }
    const feed = parseFeed(n.payload);
    if (feed) {
      hub.deliver(feed);
      return;
    }
    const change = parseChange(n.payload);
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
