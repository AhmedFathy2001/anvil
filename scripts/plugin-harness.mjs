#!/usr/bin/env node
/**
 * The plugin round trip, against a real server.
 *
 * WHY THIS IS A SERVER AND NOT A TEST SUITE. The thing most worth proving is which clan a request
 * resolves to, and a third of that answer is decided in middleware: `/c/<slug>` never reaches a
 * route handler as a path — middleware rewrites it and hands the slug along in a header. Calling
 * handlers directly, which is what every suite in tests/ does, skips that entirely and would report
 * the clan-prefixed address as working without ever having exercised it.
 *
 * So this boots the app, seeds a database, and speaks HTTP to it the way the plugin does — through
 * node:http rather than fetch, because the whole point is to control the Host header and fetch
 * treats that as forbidden.
 *
 * WHAT IT COVERS. The same sequence a client actually performs, run against all three addresses a
 * client can hold, in both the shapes the field has:
 *
 *   apex        https://anvilosrs.com/api/…              — canonical; the clan comes from the token
 *   prefixed    https://anvilosrs.com/c/alpha/api/…      — canonical; the clan is in the path
 *   subdomain   https://alpha.anvilosrs.com/api/…        — legacy; the clan comes from the Host
 *
 *   old jar     no token on the reads that never required one (schedule, active-weekly, hello)
 *   new jar     the token everywhere it is accepted
 *
 * Not in run-suites.sh on purpose: it boots Next, which takes tens of seconds, and a suite runner
 * that takes a minute stops being run. This is a release gate, invoked on its own.
 *
 *   npm run harness:plugin              everything
 *   npm run harness:plugin -- --keep    leave the server and database up afterwards
 *
 * Exits non-zero on the first failing expectation, having printed every result up to it.
 */

import { execFileSync, spawn } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import pg from 'pg';

const ADMIN_URL = process.env.TEST_DATABASE_URL || 'postgres://anvil:anvil@127.0.0.1:5439/postgres';
const DB_NAME = 'anvil_harness_plugin';
const APEX = 'anvilosrs.com';
const TOKEN = 'harness-account-token';
const RSN = 'Harness Main';
const KEEP = process.argv.includes('--keep');

const dbUrl = (name) => {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${name}`;
  return u.toString();
};

// ── Reporting ──────────────────────────────────────────────────────────────────────────────────

let passed = 0;
const failures = [];
let currentAddress = '';

function check(name, ok, detail) {
  if (ok) {
    passed++;
    console.log(`    ok    ${name}`);
  } else {
    failures.push(`${currentAddress}: ${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`    FAIL  ${name}${detail ? `  (${detail})` : ''}`);
  }
}

// ── The database ───────────────────────────────────────────────────────────────────────────────

async function withAdmin(fn) {
  const c = new pg.Client({ connectionString: ADMIN_URL });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

async function resetDatabase() {
  await withAdmin((c) => c.query(`DROP DATABASE IF EXISTS "${DB_NAME}" WITH (FORCE)`));
  await withAdmin((c) => c.query(`CREATE DATABASE "${DB_NAME}"`));
  execFileSync('node', ['scripts/migrate.mjs'], {
    env: { ...process.env, DATABASE_URL: dbUrl(DB_NAME) },
    stdio: 'pipe',
  });
}

/**
 * The fixture, written in SQL rather than through Drizzle.
 *
 * Deliberate: this file must not import the app's own modules. A harness that seeds through the
 * same code the server runs can agree with itself about a shape that is wrong — and the one bug
 * class this exists to catch is exactly that kind of agreement failing in the field.
 */
async function seed() {
  const c = new pg.Client({ connectionString: dbUrl(DB_NAME) });
  await c.connect();
  try {
    const q = async (sql, params) => (await c.query(sql, params)).rows;

    const [alpha] = await q(
      `INSERT INTO clans (slug, name, in_game_name, status, plan, visibility, guest_policy)
       VALUES ('alpha', 'Alpha Clan', 'Alpha CC', 'active', 'free', 'public', 'open') RETURNING id`,
    );
    const [bravo] = await q(
      `INSERT INTO clans (slug, name, in_game_name, status, plan, visibility, guest_policy)
       VALUES ('bravo', 'Bravo Clan', 'Bravo CC', 'active', 'free', 'public', 'open') RETURNING id`,
    );

    const [person] = await q(`INSERT INTO players (display_name) VALUES ($1) RETURNING id`, [RSN]);
    const [user] = await q(
      `INSERT INTO users (display_name, discord_id, plugin_token, player_id)
       VALUES ($1, 'harness-discord', $2, $3) RETURNING id`,
      [RSN, TOKEN, person.id],
    );
    // Staff of alpha only — so /plugin/me and clan-sync must say yes for alpha and no for bravo.
    await q(`INSERT INTO clan_staff (clan_id, user_id, role, can_edit_tiles) VALUES ($1,$2,'owner',true)`,
      [alpha.id, user.id]);

    const [account] = await q(
      `INSERT INTO accounts (player_id, rsn, rsn_normalized) VALUES ($1,$2,$3) RETURNING id`,
      [person.id, RSN, RSN.toLowerCase()],
    );
    const [seatA] = await q(
      `INSERT INTO clan_memberships (clan_id, account_id, kind, source) VALUES ($1,$2,'member','roster') RETURNING id`,
      [alpha.id, account.id],
    );
    await q(
      `INSERT INTO clan_memberships (clan_id, account_id, kind, source) VALUES ($1,$2,'guest','application')`,
      [bravo.id, account.id],
    );

    // A live board in alpha, and a running competition in bravo — so the two clans differ in a way
    // the clan list has to report differently.
    const now = Date.now();
    const iso = (d) => new Date(now + d * 86_400_000).toISOString();
    const [event] = await q(
      `INSERT INTO events (clan_id, name, start_date, end_date, board_size)
       VALUES ($1,'Harness Bingo',$2,$3,25) RETURNING id`,
      [alpha.id, iso(-1), iso(7)],
    );
    const [team] = await q(
      `INSERT INTO teams (event_id, name, color) VALUES ($1,'Reds','#c33') RETURNING id`, [event.id]);
    const [participant] = await q(
      `INSERT INTO event_participants (event_id, clan_member_id, team_id, name)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [event.id, seatA.id, team.id, RSN],
    );
    const tiles = [];
    for (let i = 0; i < 4; i++) {
      const [t] = await q(
        `INSERT INTO tiles (event_id, position, label, points) VALUES ($1,$2,$3,1) RETURNING id`,
        [event.id, i, `Tile ${i}`],
      );
      tiles.push(t.id);
    }
    await q(
      `INSERT INTO weekly_competitions (clan_id, type, metric, title, start_date, end_date, status)
       VALUES ($1,'skill','slayer','Harness SOTW',$2,$3,'active')`,
      [bravo.id, iso(-1), iso(6)],
    );

    return { alpha: alpha.id, bravo: bravo.id, event: event.id, team: team.id, participant: participant.id, tiles };
  } finally {
    await c.end();
  }
}

// ── The server ─────────────────────────────────────────────────────────────────────────────────

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

async function bootServer(port) {
  // The local binary, NOT `npx next` — npx is a wrapper process, and killing it on teardown leaves
  // the server it spawned running. The next run then finds a held .next/dev/lock and dies. Its own
  // process group too, so a SIGTERM reaches everything it started.
  const child = spawn('node_modules/.bin/next', ['dev', '--port', String(port), '--hostname', '127.0.0.1'], {
    detached: true,
    env: {
      ...process.env,
      DATABASE_URL: dbUrl(DB_NAME),
      ANVIL_APEX_DOMAIN: APEX,
      // Without this the apex advertises no canonical URL, and the handshake check below has
      // nothing to assert. It is the same variable production sets.
      APP_URL: `https://${APEX}`,
      NODE_ENV: 'development',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let log = '';
  const tap = (d) => {
    log += d;
    if (process.env.HARNESS_VERBOSE) process.stdout.write(d);
  };
  child.stdout.on('data', tap);
  child.stderr.on('data', tap);
  child.serverLog = () => log;

  // next dev compiles on first request, so readiness is "answers at all", not "is listening".
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    if (child.exitCode != null) {
      throw new Error(`server exited early (${child.exitCode})\n${log}`);
    }
    try {
      const res = await request(port, { host: APEX, path: '/api/version', method: 'GET' });
      if (res.status > 0) return child;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`server never came up\n${log}`);
}

/**
 * Stop the server and everything it started.
 *
 * Signalling the whole process group, because next dev spawns workers that outlive a signal sent to
 * the parent alone — and a survivor holds .next/dev/lock, which makes the NEXT run of this harness
 * fail to boot for a reason that has nothing to do with what it was testing. SIGKILL after a grace
 * period, since a dev server that will not stop is not worth waiting on.
 */
async function stopServer(child) {
  const group = -child.pid;
  try { process.kill(group, 'SIGTERM'); } catch { /* already gone */ }
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline && child.exitCode == null && child.signalCode == null) {
    await new Promise((r) => setTimeout(r, 100));
  }
  try { process.kill(group, 'SIGKILL'); } catch { /* already gone */ }
}

// ── Speaking to it the way the plugin does ─────────────────────────────────────────────────────

/**
 * One request. `host` becomes the Host header — that is the whole reason this is node:http and not
 * fetch, which refuses to let a caller set it.
 */
function request(port, { host, path, method = 'GET', token, body, headers = {} }) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          Host: host,
          // NOT X-Forwarded-Proto: https. Production has Caddy in front and really does send it, but
          // this speaks plain HTTP to a dev server, and Next dev believes the header — it tries to
          // proxy the request onward over TLS to a port that is not speaking it, and every request
          // fails with an SSL record error that looks exactly like an application bug. The redirect
          // builders that read the header are covered by tests/clan-paths instead.
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (d) => { raw += d; });
        res.on('end', () => {
          let json = null;
          try { json = raw ? JSON.parse(raw) : null; } catch { /* not json */ }
          resolve({ status: res.statusCode, json, raw, headers: res.headers });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ── The sequence ───────────────────────────────────────────────────────────────────────────────

/**
 * Is middleware running at all?
 *
 * Asked first and on its own, because every clan-prefixed expectation below silently depends on it:
 * with middleware off, `/c/<slug>/api/...` still reaches the handler — the path just rewrites to
 * nothing and the clan falls back to the token. That reads as "the token resolver works", not as
 * "the canonical clan address is dead", which is the failure this cutover cannot afford.
 *
 * Both redirects are answers ONLY middleware can give: it returns them before routing, so neither
 * needs a page to exist or to compile.
 */
async function checkMiddleware(port) {
  currentAddress = 'middleware';
  console.log('\n  middleware');

  // A platform path under a clan prefix belongs to the apex, not to that clan.
  const platform = await request(port, { host: APEX, path: '/c/alpha/leaderboard' });
  check('a platform path under a clan prefix is redirected out of it',
    platform.status === 308, `status ${platform.status}`);

  // A clan page on the old hostname moves to the one canonical address.
  const legacy = await request(port, { host: `alpha.${APEX}`, path: '/events' });
  check('a page on a legacy subdomain is redirected to the path form',
    legacy.status === 301, `status ${legacy.status}`);
  check('...and it points at the clan prefix on the apex',
    (legacy.headers.location ?? '').includes(`${APEX}/c/alpha/events`), legacy.headers.location);

  // The header is ours, not the caller's: spoofing it must not pick a clan.
  const spoof = await request(port, {
    host: APEX, path: '/api/plugin/config', token: TOKEN,
    headers: { 'x-anvil-clan-slug': 'bravo' },
  });
  check('a spoofed clan header is stripped, not honoured',
    spoof.json?.activeClan?.slug === 'alpha', `got ${spoof.json?.activeClan?.slug}`);
}


/**
 * Every call a client makes, against one address, in one of the two field shapes.
 *
 * `prefix` is what the plugin puts in front of every clan-scoped path once it knows which clan it
 * means — "" while it is letting the token decide, "/c/<slug>" after.
 */
async function runSequence(port, { label, host, prefix, expectClan, newJar, fx }) {
  currentAddress = label;
  console.log(`\n  ${label}`);

  const get = (path, opts = {}) => request(port, { host, path: prefix + path, ...opts });
  const post = (path, body, opts = {}) => request(port, { host, path: prefix + path, method: 'POST', body, ...opts });

  // 1. Sign-in is about a person, so it is never clan-addressed and never carries a token.
  const start = await request(port, { host, path: '/api/plugin/auth/start', method: 'POST' });
  check('auth/start mints a device code', start.status === 200 && !!start.json?.user_code,
    `status ${start.status}`);
  check('auth/start points at this deployment', (start.json?.verification_url ?? '').includes('/link-device'),
    start.json?.verification_url);

  // 2. The config poll — the one read everything else hangs off.
  const cfg = await get('/api/plugin/config', { token: TOKEN });
  check('config answers', cfg.status === 200, `status ${cfg.status}`);
  check('config names the clan it answered for', cfg.json?.activeClan?.slug === expectClan,
    `got ${cfg.json?.activeClan?.slug}`);
  check('config lists both clans for the switcher', (cfg.json?.clans ?? []).length === 2,
    `got ${(cfg.json?.clans ?? []).length}`);
  check('the clan list reports alpha’s board',
    (cfg.json?.clans ?? []).some((c) => c.slug === 'alpha' && c.live?.kind === 'bingo'));
  check('the clan list reports bravo’s competition',
    (cfg.json?.clans ?? []).some((c) => c.slug === 'bravo' && c.live?.kind === 'weekly'));
  check('config advertises the capability handshake',
    Array.isArray(cfg.json?.server?.capabilities) && cfg.json.server.capabilities.includes('clan-switch'));
  check('config advertises where this deployment wants to be called',
    (cfg.json?.server?.canonicalUrl ?? '').includes(APEX), cfg.json?.server?.canonicalUrl);

  // 3. The greeting. Unauthenticated for an old jar — which on the apex leaves nothing to resolve
  //    through, and is exactly the hole the token closes.
  const hello = await post('/api/plugin/hello', { rsn: RSN }, newJar ? { token: TOKEN } : {});
  check('hello is answered, not a 500', hello.status < 500, `status ${hello.status}`);

  // 4. The legacy reads. Empty rather than an error when nothing names a clan.
  const sched = await get('/api/plugin/schedule', newJar ? { token: TOKEN } : {});
  check('schedule answers', sched.status === 200, `status ${sched.status}`);
  const weekly = await get('/api/plugin/active-weekly', newJar ? { token: TOKEN } : {});
  check('active-weekly answers', weekly.status === 200, `status ${weekly.status}`);

  // 5. The board, both ways in.
  const board = await get('/api/plugin/board', { token: TOKEN });
  check('board (token-scoped) answers', board.status === 200, `status ${board.status}`);
  const preview = await get(`/api/plugin/board?eventId=${fx.event}`);
  check('board preview by id answers', preview.status === 200, `status ${preview.status}`);

  // 6. The pushes — the plugin's actual job.
  const stats = await post('/api/plugin/stats', { rsn: RSN, stats: { slayer: 1_000_000 } },
    { token: TOKEN, headers: { 'X-RSN': RSN } });
  check('stats push accepted', stats.status < 400, `status ${stats.status}`);

  const activity = await get('/api/plugin/activity', { token: TOKEN, headers: { 'X-RSN': RSN } });
  check('activity feed answers', activity.status === 200 || activity.status === 304, `status ${activity.status}`);

  // 7. The two staff surfaces. Authority is per clan, so the answer depends on which clan this is.
  const me = await get('/api/plugin/me', { token: TOKEN });
  const shouldBeAdmin = expectClan === 'alpha';
  check(`/me says ${shouldBeAdmin ? 'admin' : 'not admin'} for ${expectClan}`,
    shouldBeAdmin ? me.status === 200 : me.status === 401, `status ${me.status}`);

  // 8. THE ROUTES OUTSIDE /api/plugin. These resolve a clan from the ADDRESS, not the token, which
  //    is why the plugin echoes the slug back. On the bare apex with no prefix they cannot resolve,
  //    and a client that does not address a clan gets a 404 here — the hole this whole cutover is
  //    about. Asserted as "works when addressed" rather than "always works".
  const submission = await post(`/api/events/${fx.event}/submissions`,
    { tileId: fx.tiles[0], teamId: fx.team, amount: 1 }, { token: TOKEN, headers: { 'X-RSN': RSN } });
  const addressed = prefix !== '' || host !== APEX;
  check(addressed ? 'submission filed on an addressed clan' : 'submission on the BARE apex (known hole)',
    addressed ? submission.status < 400 : true, `status ${submission.status}`);
  if (!addressed && submission.status === 404) {
    console.log('          note: 404 as expected — nothing in the URL names a clan');
  }

  const proof = await get(`/api/events/${fx.event}/start-proof`, { token: TOKEN, headers: { 'X-RSN': RSN } });
  check(addressed ? 'start-proof reachable on an addressed clan' : 'start-proof on the BARE apex (known hole)',
    addressed ? proof.status < 400 : true, `status ${proof.status}`);
}

// ── Main ───────────────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Plugin round trip\n');
  process.stdout.write('  seeding… ');
  await resetDatabase();
  const fx = await seed();
  console.log('done');

  const port = await freePort();
  process.stdout.write(`  booting next dev on ${port}… `);
  const server = await bootServer(port);
  console.log('up');

  try {
    await checkMiddleware(port);

    // The three addresses a client in the field can hold, and the two shapes it can speak in.
    await runSequence(port, {
      label: 'apex, new jar (token everywhere)', host: APEX, prefix: '',
      expectClan: 'alpha', newJar: true, fx,
    });
    await runSequence(port, {
      label: 'apex, old jar (anonymous legacy reads)', host: APEX, prefix: '',
      expectClan: 'alpha', newJar: false, fx,
    });
    await runSequence(port, {
      label: 'apex + /c/alpha prefix (what a new jar addresses)', host: APEX, prefix: '/c/alpha',
      expectClan: 'alpha', newJar: true, fx,
    });
    await runSequence(port, {
      label: 'apex + /c/bravo prefix (a clan they are only a guest in)', host: APEX, prefix: '/c/bravo',
      expectClan: 'bravo', newJar: true, fx,
    });
    await runSequence(port, {
      label: 'legacy subdomain alpha.anvilosrs.com', host: `alpha.${APEX}`, prefix: '',
      expectClan: 'alpha', newJar: false, fx,
    });
  } finally {
    // A 5xx is a server-side throw, and the number alone says nothing. Print what it logged.
    if (failures.some((f) => f.includes('status 5'))) {
      const log = server.serverLog();
      const errs = log.split('\n').filter((l) => /Error|error:|⨯|at /.test(l)).slice(0, 25);
      if (errs.length) {
        console.log('\n  server said:');
        for (const l of errs) console.log(`    ${l}`);
      }
    }
    if (!KEEP) {
      await stopServer(server);
      await withAdmin((c) => c.query(`DROP DATABASE IF EXISTS "${DB_NAME}" WITH (FORCE)`)).catch(() => {});
    } else {
      console.log(`\n  --keep: server still on ${port}, database ${DB_NAME} left in place`);
    }
  }

  console.log(`\n  ${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log('\n  failures:');
    for (const f of failures) console.log(`    ${f}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('\nharness aborted:', e.message);
  process.exit(2);
});
