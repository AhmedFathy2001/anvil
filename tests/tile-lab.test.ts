// The tile lab (lib/lab): a lab session is a board in a hidden clan that the plugin finds for the
// character entered on it, and everything that character pushes outside the board is quarantined.
//
// What must hold:
//   - the plugin resolves the lab board for the entered character (and only them), at whatever clan
//     address it is connected to, and it outranks a real event that started earlier;
//   - personal pushes from that character land in lab_log, never in the real routes;
//   - a replayed scenario (X-Anvil-Scenario) never credits or writes anything real, session or not;
//   - lab boards post to no Discord and drop out of account-wide reads like yearly Wrapped;
//   - the stat simulator completes a stat tile through the real engine, and reset wipes it.
//
// Run: npm run test:lab

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('tile-lab');

// Proofs live on R2; a submission's image must sit under the bucket's public base (lib/storage).
const R2_BASE = 'https://pub-lab.r2.dev';
process.env.S3_PUBLIC_BASE_URL = R2_BASE;

const RSN = 'Lab Rat';
const TOKEN = 'lab-token';
const OTHER_RSN = 'Bystander';
const OTHER_TOKEN = 'other-token';

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let A: typeof import('../src/lib/auth.ts');
let L: typeof import('../src/lib/lab.ts');
let S: typeof import('../src/lib/labStats.ts');
let E: typeof import('../src/lib/eventScope.ts');

let userId: number;
let accountId: number;
let otherAccountId: number;
let realEvent: number;
let labEventId: number;

const iso = (daysFromNow: number) => new Date(Date.now() + daysFromNow * 86_400_000).toISOString();

function pluginRequest(opts: { token?: string; rsn?: string; scenario?: string } = {}) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.token ?? TOKEN}`,
    'X-RSN': opts.rsn ?? RSN,
    'x-anvil-clan-slug': 'alpha',
  };
  if (opts.scenario) headers['X-Anvil-Scenario'] = opts.scenario;
  return new Request('https://anvilosrs.com/api/plugin/config', { headers });
}

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  A = await import('../src/lib/auth.ts');
  L = await import('../src/lib/lab.ts');
  S = await import('../src/lib/labStats.ts');
  E = await import('../src/lib/eventScope.ts');

  const [alpha] = await db.insert(s.clans).values({ slug: 'alpha', name: 'Alpha', inGameName: 'Alpha CC' }).returning();

  const [person] = await db.insert(s.players).values({ displayName: RSN }).returning();
  [{ id: userId }] = await db
    .insert(s.users)
    .values({ displayName: RSN, discordId: 'disc-lab', pluginToken: TOKEN, playerId: person.id })
    .returning();
  const [acct] = await db.insert(s.accounts).values({ playerId: person.id, rsn: RSN, rsnNormalized: RSN.toLowerCase() }).returning();
  accountId = acct.id;
  const [seat] = await db
    .insert(s.clanMemberships)
    .values({ clanId: alpha.id, accountId, kind: 'member', source: 'roster' })
    .returning();

  const [otherPerson] = await db.insert(s.players).values({ displayName: OTHER_RSN }).returning();
  await db.insert(s.users).values({ displayName: OTHER_RSN, discordId: 'disc-other', pluginToken: OTHER_TOKEN, playerId: otherPerson.id });
  const [otherAcct] = await db
    .insert(s.accounts)
    .values({ playerId: otherPerson.id, rsn: OTHER_RSN, rsnNormalized: OTHER_RSN.toLowerCase() })
    .returning();
  otherAccountId = otherAcct.id;
  await db.insert(s.clanMemberships).values({ clanId: alpha.id, accountId: otherAccountId, kind: 'member', source: 'roster' });

  // A real bingo the lab character is already playing, started two days ago.
  const [ev] = await db
    .insert(s.events)
    .values({ clanId: alpha.id, name: 'Real Bingo', startDate: iso(-2), endDate: iso(5), boardSize: 5 })
    .returning();
  realEvent = ev.id;
  const [team] = await db.insert(s.teams).values({ eventId: realEvent, name: 'Reds', color: '#f00' }).returning();
  await db.insert(s.eventParticipants).values({ eventId: realEvent, clanMemberId: seat.id, accountId, name: RSN, teamId: team.id });
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('before any session the plugin resolves the real event, and nothing is quarantined', async () => {
  const auth = await A.verifyPluginToken(pluginRequest());
  assert.equal(auth?.eventId, realEvent);
  assert.equal(await L.labQuarantine(pluginRequest(), accountId, 'notify', { kind: 'pet' }), null);
});

test('a session becomes the entered character\'s active board, at their own clan\'s address', async () => {
  labEventId = await L.createLabSession(userId, { name: 'Pet test', hours: 2, boardSize: 2, accounts: [{ accountId, name: RSN }] });
  assert.ok(await L.labEvent(labEventId), 'it is a lab board');
  assert.equal((await A.verifyPluginToken(pluginRequest()))?.eventId, labEventId, 'fresher than the real event, so it wins');

  const scoped = await E.eventForPluginRequest(pluginRequest(), labEventId);
  assert.deepEqual([scoped?.event.id, scoped?.viaCohost], [labEventId, true]);

  // Somebody else in the same clan reaches neither the board nor a session.
  const other = pluginRequest({ token: OTHER_TOKEN, rsn: OTHER_RSN });
  assert.equal(await E.eventForPluginRequest(other, labEventId), null);
  assert.notEqual((await A.verifyPluginToken(other))?.eventId, labEventId);
});

test('the real /api/plugin/config and /board serve the lab board to the entered character', async () => {
  const config = await import('../src/app/api/plugin/config/route.ts');
  const res = await config.GET(pluginRequest());
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.event?.id, labEventId);
  assert.equal(body.event?.name, 'Pet test');

  const board = await import('../src/app/api/plugin/board/route.ts');
  const b = await board.GET(new Request(`https://anvilosrs.com/api/plugin/board?eventId=${labEventId}`, { headers: pluginRequest().headers }));
  assert.equal(b.status, 200);
  const boardBody = await b.json();
  assert.equal(boardBody.tiles?.length, 4, 'the 2×2 lab board');
});

test('a plugin submission credits the lab tile; a replay aimed at the real board is dropped', async () => {
  const { db, schema: s } = await loadDb();
  const { and, eq } = await import('drizzle-orm');
  const [tile] = await db
    .update(s.tiles)
    .set({ label: 'Pet', tileType: 'drop', requiredAmount: 1 })
    .where(and(eq(s.tiles.eventId, labEventId), eq(s.tiles.position, 1)))
    .returning();
  const [team] = await db.select().from(s.teams).where(eq(s.teams.eventId, labEventId));
  const route = await import('../src/app/api/events/[eventId]/submissions/route.ts');
  const post = (eventId: number, body: object, scenario?: string) => {
    const headers = new Headers(pluginRequest({ scenario }).headers);
    headers.set('Content-Type', 'application/json');
    return route.POST(
      new Request(`https://anvilosrs.com/api/events/${eventId}/submissions`, { method: 'POST', headers, body: JSON.stringify(body) }),
      { params: Promise.resolve({ eventId: String(eventId) }) },
    );
  };

  const res = await post(labEventId, { tileId: tile.id, teamId: team.id, amount: 1, note: 'Vorki', imageUrl: `${R2_BASE}/proofs/pet.png` }, 'boss-pet');
  assert.ok(res.status < 300, `lab submission accepted (${res.status} ${await res.clone().text()})`);
  const subs = await db.select().from(s.submissions).where(eq(s.submissions.tileId, tile.id));
  assert.equal(subs.length, 1);

  const [realTeam] = await db.select().from(s.teams).where(eq(s.teams.eventId, realEvent));
  const before = (await db.select().from(s.submissions).where(eq(s.submissions.teamId, realTeam.id))).length;
  const replay = await post(realEvent, { tileId: tile.id, teamId: realTeam.id, amount: 1 }, 'boss-pet');
  assert.equal((await replay.json()).dropped, 'not a lab board');
  assert.equal((await db.select().from(s.submissions).where(eq(s.submissions.teamId, realTeam.id))).length, before);
});

test('the lab clan is hidden and owned by the staffer who opened it', async () => {
  const { db, schema: s } = await loadDb();
  const labId = await L.labClanId();
  const [clan] = await db.select().from(s.clans).where((await import('drizzle-orm')).eq(s.clans.id, labId!));
  assert.equal(clan.slug, L.LAB_CLAN_SLUG);
  assert.equal(clan.visibility, 'members', 'closed, which keeps it off every listing');
  assert.equal(clan.inGameName, null, 'no roster sync can ever land in it');
});

test("the session character's personal pushes go to the lab log, nobody else's do", async () => {
  const { db, schema: s } = await loadDb();
  const { eq } = await import('drizzle-orm');
  const res = await L.labQuarantine(pluginRequest(), accountId, 'notify', { channel: 'drops', kind: 'pet' });
  assert.ok(res);
  assert.deepEqual(await res.json(), { ok: true, lab: true, quarantined: 'notify' });
  const rows = await db.select().from(s.labLog).where(eq(s.labLog.eventId, labEventId));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].endpoint, 'notify');
  assert.deepEqual(rows[0].payload, { channel: 'drops', kind: 'pet' });

  assert.equal(await L.labQuarantine(pluginRequest(), otherAccountId, 'notify', {}), null);
  // The resolver form is only called when there is a lab at all, and works the same.
  const viaResolver = await L.labQuarantine(pluginRequest(), async () => accountId, 'clip', { moment: 'x' });
  assert.ok(viaResolver);
});

test('a replayed scenario is dropped outside the lab, session or not', async () => {
  // No session for this character, but the push says it is a replay: dropped, not delivered.
  const other = pluginRequest({ token: OTHER_TOKEN, rsn: OTHER_RSN, scenario: 'boss-pet' });
  const dropped = await L.labQuarantine(other, otherAccountId, 'notify', { kind: 'pet' });
  assert.equal((await dropped?.json())?.dropped, 'notify');

  // A replay may credit the lab board, and nothing else.
  assert.ok(await L.replayOutsideLab(other, realEvent));
  assert.equal(await L.replayOutsideLab(other, labEventId), null);
  assert.equal(await L.replayOutsideLab(pluginRequest(), realEvent), null, 'not a replay: carry on');

  // Filed under the session when there is one, with the scenario named.
  const { db, schema: s } = await loadDb();
  const { eq } = await import('drizzle-orm');
  await L.labQuarantine(pluginRequest({ scenario: 'boss-pet' }), accountId, 'moments', { moments: [] });
  const rows = await db.select().from(s.labLog).where(eq(s.labLog.eventId, labEventId));
  assert.ok(rows.some((r) => r.endpoint === 'moments · boss-pet'));
});

test('lab boards drop out of account-wide reads', async () => {
  const { db, schema: s } = await loadDb();
  const { and, eq } = await import('drizzle-orm');
  const rows = await db
    .select({ id: s.events.id })
    .from(s.eventParticipants)
    .innerJoin(s.events, eq(s.events.id, s.eventParticipants.eventId))
    .where(and(eq(s.eventParticipants.accountId, accountId), L.notLabClan(s.events.clanId)));
  assert.deepEqual(rows.map((r) => r.id), [realEvent]);
});

test('the stat simulator completes a stat tile through the real engine; reset wipes it', async () => {
  const { db, schema: s } = await loadDb();
  const { and, eq } = await import('drizzle-orm');
  const [tile] = await db
    .update(s.tiles)
    .set({ label: '10 Vorkath', trackedStat: 'vorkath', statType: 'boss', statGoal: 10 })
    .where(and(eq(s.tiles.eventId, labEventId), eq(s.tiles.position, 0)))
    .returning();
  const [p] = await db.select().from(s.eventParticipants).where(eq(s.eventParticipants.eventId, labEventId));

  const half = await S.simulateStatGain(labEventId, { participantId: p.id, statType: 'boss', key: 'vorkath', baseline: 100, gain: 5 });
  assert.equal(half.gain, 5);
  assert.deepEqual(half.completed, []);

  const rest = await S.simulateStatGain(labEventId, { participantId: p.id, statType: 'boss', key: 'vorkath', gain: 5 });
  assert.equal(rest.gain, 10, 'gains add up across runs');
  assert.deepEqual(rest.completed, ['10 Vorkath']);
  const done = await db.select().from(s.completions).where(eq(s.completions.tileId, tile.id));
  assert.equal(done.length, 1);

  await L.resetLabSession(labEventId);
  assert.equal((await db.select().from(s.completions).where(eq(s.completions.tileId, tile.id))).length, 0);
  assert.equal((await db.select().from(s.labLog).where(eq(s.labLog.eventId, labEventId))).length, 0);
  const [after] = await db.select().from(s.eventParticipants).where(eq(s.eventParticipants.id, p.id));
  assert.equal(after.frozenAt, null);
  assert.equal(after.statsSnapshot, null);
});

test('ending the session hands the character back to the real event and stops quarantining', async () => {
  await L.setLabSessionEnd(labEventId, null);
  assert.equal((await A.verifyPluginToken(pluginRequest()))?.eventId, realEvent);
  assert.equal(await L.labSessionFor(accountId), null);
  assert.equal(await L.labQuarantine(pluginRequest(), accountId, 'notify', {}), null);
});
