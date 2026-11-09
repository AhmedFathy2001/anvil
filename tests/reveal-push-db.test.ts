// lib/revealPush against a real database: when the reveal engine flips tiles or drops a mission, every
// player on that board — and only them — gets a chat-feed push with the lines, naming only tiles they
// may now see. A player on two boards hears both; a "Reveals & missions" opt-out hears nothing.
//
// Run: TEST_DATABASE_URL=postgres://… npx tsx --test tests/reveal-push-db.test.ts

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('reveal-push');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let P: typeof import('../src/lib/revealPush.ts');
let E: typeof import('../src/lib/revealEngine.ts');
let F: typeof import('../src/lib/chatFeed.ts');
let R: typeof import('../src/lib/chatFeedRules.ts');
let listener: pg.Client;
let heard: { k: string; u: number[]; m: { t: string; kind: string; tag: string; tone: string; text: string } }[] = [];

let n = 0;
async function person(name: string) {
  n += 1;
  const [pl] = await db.insert(s.players).values({ displayName: name }).returning();
  const [a] = await db.insert(s.accounts).values({ playerId: pl.id, rsn: name, rsnNormalized: name.toLowerCase() }).returning();
  const [u] = await db.insert(s.users).values({ playerId: pl.id, displayName: name, discordId: `99700000000000${String(n).padStart(4, '0')}` }).returning();
  return { userId: u.id, accountId: a.id };
}

/** Lines each user was sent (NOTIFYs arrive after commit). */
async function linesByUser(): Promise<Map<number, string[]>> {
  await new Promise((r) => setTimeout(r, 200));
  const out = new Map<number, string[]>();
  for (const h of heard) for (const u of h.u) out.set(u, [...(out.get(u) ?? []), h.m.text]);
  return out;
}

const past = new Date(Date.now() - 3_600_000).toISOString();
let clanId: number;
let ada: { userId: number; accountId: number };
let bo: { userId: number; accountId: number };
let cy: { userId: number; accountId: number };
let outsider: { userId: number; accountId: number };

async function board(name: string, rules: object, tilesRevealed = 1) {
  const [ev] = await db
    .insert(s.events)
    .values({ clanId, name, boardSize: 5, rules: JSON.stringify(rules), startDate: past, tilesRevealed, scoringMode: 'points' })
    .returning();
  const [red, blue] = await db.insert(s.teams).values([{ eventId: ev.id, name: 'Red', color: '#cc0000' }, { eventId: ev.id, name: 'Blue', color: '#0000cc' }]).returning();
  return { ev, red: red.id, blue: blue.id };
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  P = await import('../src/lib/revealPush.ts');
  E = await import('../src/lib/revealEngine.ts');
  F = await import('../src/lib/chatFeed.ts');
  R = await import('../src/lib/chatFeedRules.ts');
  listener = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await listener.connect();
  listener.on('notification', (m) => {
    const p = JSON.parse(m.payload ?? '{}');
    if (p.k === 'feed' && p.m?.kind === 'reveal') heard.push(p);
  });
  await listener.query('LISTEN anvil_push');
  const [clan] = await db.insert(s.clans).values({ slug: 'lab', name: 'Lab' }).returning();
  clanId = clan.id;
  ada = await person('Ada');
  bo = await person('Bo');
  cy = await person('Cy');
  outsider = await person('Outsider');
});

beforeEach(() => {
  heard = [];
});

after(async () => {
  await listener?.end();
  await pool?.end();
  await dropDatabase(DB);
});

test('a scheduled reveal reaches both teams on the board with only the tiles that opened', async () => {
  const { ev, red, blue } = await board('Lab session #14', { revealPolicy: 'scheduled' });
  await db.insert(s.eventParticipants).values([
    { eventId: ev.id, name: 'Ada', accountId: ada.accountId, teamId: red },
    { eventId: ev.id, name: 'Bo', accountId: bo.accountId, teamId: blue },
  ]);
  await db.insert(s.tiles).values([
    { eventId: ev.id, position: 0, label: 'Wintertodt crate', points: 5, revealAt: past },
    { eventId: ev.id, position: 1, label: 'Not yet', points: 5, revealAt: new Date(Date.now() + 3_600_000).toISOString() },
    { eventId: ev.id, position: 2, label: 'Secret mission', points: 9, mission: 1 },
  ]);
  await E.processTileReveals();
  const got = await linesByUser();
  assert.deepEqual(got.get(ada.userId), ['New tile: Wintertodt crate · Lab session #14 (5 pts)']);
  assert.deepEqual(got.get(bo.userId), ['New tile: Wintertodt crate · Lab session #14 (5 pts)']);
  assert.equal(got.has(outsider.userId), false);
  const msg = heard[0].m;
  assert.equal(msg.t, 'feed');
  assert.equal(msg.tag, '');
  assert.equal(msg.tone, 'near');
});

test('an unannounced mission, a closed tile and a still-private board never reach the chat', async () => {
  const { ev, red } = await board('Bounty', { revealPolicy: 'bounty' });
  await db.insert(s.eventParticipants).values({ eventId: ev.id, name: 'Ada', accountId: ada.accountId, teamId: red });
  const now = new Date().toISOString();
  const [open, hiddenMission, closed] = await db
    .insert(s.tiles)
    .values([
      { eventId: ev.id, position: 0, label: 'Open', points: 3, revealedAt: now },
      { eventId: ev.id, position: 1, label: 'Hidden mission', points: 3, mission: 1 },
      { eventId: ev.id, position: 2, label: 'Closed', points: 3, revealedAt: now, closedAt: now },
    ])
    .returning();
  await P.pushReveals(ev, [open.id, hiddenMission.id, closed.id]);
  assert.deepEqual((await linesByUser()).get(ada.userId), ['New tile: Open · Bounty (3 pts)']);

  heard = [];
  const priv = await board('Private', { revealPolicy: 'interval' }, 0);
  await db.insert(s.eventParticipants).values({ eventId: priv.ev.id, name: 'Ada', accountId: ada.accountId, teamId: priv.red });
  const [t] = await db.insert(s.tiles).values({ eventId: priv.ev.id, position: 0, label: 'Early', points: 1, revealedAt: now }).returning();
  assert.equal(await P.pushReveals(priv.ev, [t.id]), 0);
  assert.equal((await linesByUser()).size, 0);
});

test('a dropped mission: one line with its end, to a player seated on other boards too; opt-outs hear nothing', async () => {
  const { ev, red, blue } = await board('Mission night', { mission: { mode: 'manual' } });
  await db.insert(s.eventParticipants).values([
    { eventId: ev.id, name: 'Ada', accountId: ada.accountId, teamId: red },
    { eventId: ev.id, name: 'Cy', accountId: cy.accountId, teamId: blue },
  ]);
  await F.setChatFeedPrefs(cy.userId, { ...R.DEFAULT_PREFS, reveals: false });
  const [m] = await db
    .insert(s.tiles)
    .values({ eventId: ev.id, position: 0, label: 'Kill Vorkath', points: 10, mission: 1, rules: JSON.stringify({ lockout: true }) })
    .returning();
  assert.deepEqual(await E.announceMissionTile(ev.id, m.id), { announced: 1 });
  await new Promise((r) => setTimeout(r, 300)); // pushReveals is fire-and-forget after the flip
  const got = await linesByUser();
  assert.deepEqual(got.get(ada.userId), ['Mission live: Kill Vorkath · Mission night — first team takes it']);
  assert.equal(got.has(cy.userId), false);
});
