// Account-sharing checks, end to end against a real database: real plugin plays in, the footprint
// check over them, and the list staff read (lib/integrityNetwork, lib/footprintCheck, lib/sharingRules).
//
//   1. one person's own accounts on one network: no flag
//   2. a character played through another login's plugin: flagged (and never by the network)
//   3. an account added mid-contest: flagged; strongly once it connects from another country
//   4. different people's accounts on one network: flagged, with who owns them as it stands now
//   5. one account from two countries within hours: flagged, as before
//
// And what is kept: a per-event code and a country, never an address.
//
// Run: TEST_DATABASE_URL=... npx tsx --test tests/sharing-checks-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
import { tokenHash } from './helpers/tokenHash.ts';
import { clanHeaders } from './helpers/clanHeader.ts';
import { callRoute } from './helpers/routeCall.ts';

const DB = useTestDatabase('sharing-checks');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let A: typeof import('../src/lib/auth.ts');
let N: typeof import('../src/lib/integrityNetwork.ts');
let FC: typeof import('../src/lib/footprintCheck.ts');
let route: typeof import('../src/app/api/admin/events/[eventId]/integrity/route.ts');

const HOME = '203.0.113.5';
const ELSEWHERE = '198.51.100.9';
const BASELINE = JSON.stringify({ skills: {}, bosses: {} });
const NOW = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();
const START = NOW - 4 * 86_400_000;

type Login = { token: string; person: number; userId: number };
let n = 0;
let clanId: number;
let eventId: number;
let team: { reds: number; blues: number };
let olive: Login;
let bob: Login;
let sam: Login;
let staff: Login;
/** Enrolment ids by character name. */
const pid: Record<string, number> = {};
const acct: Record<string, number> = {};

async function login(name: string): Promise<Login> {
  n++;
  const token = `tok-sc-${n}`;
  const [person] = await db.insert(s.players).values({ displayName: name }).returning();
  const [user] = await db
    .insert(s.users)
    .values({ displayName: name, discordUsername: `${name}#d`, discordId: `20000000000000${String(n).padStart(4, '0')}`, pluginTokenHash: tokenHash(token), playerId: person.id })
    .returning();
  return { token, person: person.id, userId: user.id };
}

/** A character claimed by `owner`, seated in the clan and enrolled on the board. */
async function enrol(
  owner: Login,
  rsn: string,
  teamId: number,
  opts: { method?: string; provisional?: number; addedAt?: number; event?: number } = {},
): Promise<number> {
  const now = iso(NOW);
  const [a] = await db
    .insert(s.accounts)
    .values({
      playerId: owner.person, rsn, rsnNormalized: rsn.toLowerCase(), accountHash: `h-${rsn.toLowerCase()}`,
      claimedAt: now, verifiedAt: now, verificationMethod: opts.method ?? 'plugin', provisional: opts.provisional ?? 0,
    })
    .returning();
  const [seat] = await db.insert(s.clanMemberships).values({ clanId, accountId: a.id, kind: 'member', source: 'roster' }).returning();
  // There from the start (placed the day before, starting line at the whistle) unless added later.
  const pickedAt = iso(opts.addedAt ?? START - 86_400_000);
  const snapshotAt = iso(opts.addedAt != null ? opts.addedAt + 60_000 : START + 60_000);
  const [p] = await db
    .insert(s.eventParticipants)
    .values({ eventId: opts.event ?? eventId, clanMemberId: seat.id, accountId: a.id, name: rsn, teamId, pickedAt, statsSnapshot: BASELINE, snapshotAt })
    .returning();
  acct[rsn] = a.id;
  pid[rsn] = p.id;
  return p.id;
}

/** One plugin request, as it arrives through Cloudflare: token, character, and the address it came from. */
function play(who: Login, rsn: string, ip: string, country = 'NL') {
  return A.resolvePluginMember(new Request('https://example.test/api/plugin/config', {
    headers: {
      Authorization: `Bearer ${who.token}`, 'X-RSN': rsn, 'X-Account-Hash': `h-${rsn.toLowerCase()}`,
      'x-forwarded-for': ip, 'cf-ipcountry': country, ...clanHeaders('afk'),
    },
  }));
}

const sightings = () => db.select().from(s.integrityNetwork).where(eq(s.integrityNetwork.eventId, eventId));

/** noteNetwork writes after the response; wait for the rows it owes. */
async function settled(count: number) {
  for (let i = 0; i < 100; i++) {
    if ((await sightings()).length >= count) break;
    await new Promise((r) => setTimeout(r, 30));
  }
  await new Promise((r) => setTimeout(r, 100));
  return sightings();
}

async function signalsOf(rsn: string, event = eventId) {
  const rows = await db.select().from(s.integritySignals).where(and(eq(s.integritySignals.eventId, event), eq(s.integritySignals.participantId, pid[rsn])));
  return rows.map((r) => r.kind).sort();
}

const sharedWith = (...names: string[]) => names.map((name) => `shared_network:${pid[name]}`).sort();

/** The staff list, as the event Overview fetches it. */
async function staffList() {
  const res = await callRoute(route.GET, { userId: staff.userId, slug: 'afk', method: 'GET', params: { eventId: String(eventId) } });
  assert.equal(res.status, 200);
  return res.json.signals as { id: number; kind: string; rsn: string; detail: string | null; owners?: string }[];
}

let run = 0;
/** The lifecycle cron's footprint pass; each call far enough on to be due again. */
const check = () => FC.runFootprintChecks(NOW + ++run * 31 * 60_000);

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  A = await import('../src/lib/auth.ts');
  N = await import('../src/lib/integrityNetwork.ts');
  FC = await import('../src/lib/footprintCheck.ts');
  route = await import('../src/app/api/admin/events/[eventId]/integrity/route.ts');

  clanId = (await db.insert(s.clans).values({ slug: 'afk', name: 'The AFK Spot', inGameName: 'AFK' }).returning())[0].id;
  olive = await login('Olive');
  bob = await login('Bob');
  sam = await login('Sam');
  staff = await login('Staff');
  await db.insert(s.clanStaff).values({ clanId, userId: staff.userId, role: 'admin' });

  eventId = (await db.insert(s.events).values({
    clanId, name: 'Checked', boardSize: 3, startDate: iso(START), endDate: iso(NOW + 5 * 86_400_000), tilesRevealed: 1, startNotified: 1,
    rules: JSON.stringify({ sharingChecks: true }),
  }).returning())[0].id;
  team = {
    reds: (await db.insert(s.teams).values({ eventId, name: 'Reds', color: '#f00' }).returning())[0].id,
    blues: (await db.insert(s.teams).values({ eventId, name: 'Blues', color: '#00f' }).returning())[0].id,
  };
  await enrol(olive, 'Olive Main', team.reds);
  await enrol(olive, 'Olive Iron', team.reds);
  await enrol(bob, 'Bob Main', team.blues);
  await enrol(sam, 'Sam Main', team.blues);
  await enrol(sam, 'Sam Travels', team.blues);
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('what is kept: a code for this event and a country, for the owner’s own plays only', async () => {
  assert.ok(await play(olive, 'Olive Main', HOME));
  assert.ok(await play(olive, 'Olive Iron', HOME));
  assert.ok(await play(bob, 'Bob Main', HOME));
  // Case 2 in the making: Sam's RuneLite, logged into Olive's character, from another network.
  assert.equal(await play(sam, 'Olive Main', ELSEWHERE, 'PH'), null, 'another login never resolves to the owner’s seat');

  const rows = await settled(3);
  assert.equal(rows.length, 3, 'one row per character played through its own login; the foreign play adds none');
  assert.deepEqual(rows.map((r) => r.participantId).sort(), [pid['Olive Main'], pid['Olive Iron'], pid['Bob Main']].sort());
  for (const r of rows) {
    assert.equal(r.netHash, N.netHash(eventId, HOME));
    assert.equal(r.country, 'NL');
    assert.ok(!JSON.stringify(r).includes(HOME), 'never the address');
  }
  assert.notEqual(N.netHash(eventId, HOME), N.netHash(eventId + 1, HOME), 'the code means nothing on another event');
});

test('who owns what comes from the claim on the account, never from the network', async () => {
  const roster = new Map((await N.sharingRoster(eventId)).map((p) => [p.name, p]));
  assert.deepEqual(roster.get('Olive Main')!.owner, { personId: olive.person, claimed: true, confirmed: true });
  assert.equal(roster.get('Olive Iron')!.owner!.personId, olive.person);
  assert.equal(roster.get('Bob Main')!.owner!.personId, bob.person);
  assert.equal(roster.get('Olive Main')!.teamId, team.reds);

  // A roster placeholder (a person no login belongs to) owns nothing, whatever its claim column says.
  const [ghost] = await db.insert(s.players).values({ displayName: 'placeholder' }).returning();
  const [a] = await db.insert(s.accounts).values({ playerId: ghost.id, rsn: 'Roster Name', rsnNormalized: 'roster name', claimedAt: iso(NOW) }).returning();
  const other = (await db.insert(s.events).values({ clanId, name: 'Other', boardSize: 3, startDate: iso(START), startNotified: 1 }).returning())[0].id;
  await db.insert(s.eventParticipants).values({ eventId: other, accountId: a.id, name: 'Roster Name' });
  await db.insert(s.eventParticipants).values({ eventId: other, name: 'No Account' });
  const loose = new Map((await N.sharingRoster(other)).map((p) => [p.name, p]));
  assert.equal(loose.get('Roster Name')!.owner!.claimed, false);
  assert.equal(loose.get('No Account')!.owner, null);
});

test('cases 1, 2, 4 and 5: the footprint check over those plays', async () => {
  // Case 5: one account from two countries an hour apart.
  await db.insert(s.integrityNetwork).values([
    { eventId, participantId: pid['Sam Travels'], netHash: N.netHash(eventId, '192.0.2.1'), country: 'EG', firstSeenAt: iso(NOW - 3 * 3_600_000), lastSeenAt: iso(NOW - 2 * 3_600_000) },
    { eventId, participantId: pid['Sam Travels'], netHash: N.netHash(eventId, '192.0.2.2'), country: 'DE', firstSeenAt: iso(NOW - 3_600_000), lastSeenAt: iso(NOW) },
  ]);
  await check();

  // Case 1: Olive's two characters share her network and nothing says so.
  assert.deepEqual(await signalsOf('Olive Iron'), [`shared_network:${pid['Bob Main']}`]);
  // Case 4: Bob is somebody else on that network. Case 2: Sam's login played Olive Main.
  assert.deepEqual(await signalsOf('Olive Main'), [`other_login:${sam.userId}`, `shared_network:${pid['Bob Main']}`]);
  assert.deepEqual(await signalsOf('Bob Main'), sharedWith('Olive Iron', 'Olive Main'));
  // Case 5.
  assert.deepEqual(await signalsOf('Sam Travels'), ['two_countries']);
  assert.deepEqual(await signalsOf('Sam Main'), []);

  const list = await staffList();
  const line = list.find((x) => x.rsn === 'Bob Main' && x.kind === `shared_network:${pid['Olive Main']}`)!;
  assert.equal(line.owners, 'different');
  assert.deepEqual(JSON.parse(line.detail!), { other: 'Olive Main', sameTeam: false });
  const two = list.find((x) => x.kind === 'two_countries')!;
  assert.deepEqual(JSON.parse(two.detail!), { countries: ['EG', 'DE'] });
  assert.equal(two.owners, undefined);
  assert.ok(list.some((x) => x.rsn === 'Olive Main' && x.kind === `other_login:${sam.userId}`));
  // Nothing staff are sent carries a network code or an address.
  const sent = JSON.stringify(list);
  assert.ok(!sent.includes(HOME) && !sent.includes(N.netHash(eventId, HOME)));
});

test('case 1: a same-person line raised before the rule changed is left out of the staff list', async () => {
  const [legacy] = await db
    .insert(s.integritySignals)
    .values({ eventId, participantId: pid['Olive Main'], kind: `shared_network:${pid['Olive Iron']}`, detail: JSON.stringify({ other: 'Olive Iron', sameTeam: true }) })
    .returning();
  const list = await staffList();
  assert.ok(!list.some((x) => x.id === legacy.id), 'one person’s own confirmed accounts: not shown');
  assert.ok(list.some((x) => x.rsn === 'Olive Main' && x.kind === `shared_network:${pid['Bob Main']}`), 'the other-person line still is');
});

test('case 4: a link the plugin made by itself is not yet "the same person"; confirming it clears the line', async () => {
  // A character first seen on Olive's RuneLite, linked to her on first play, nobody has confirmed.
  await enrol(olive, 'Olive Maybe', team.reds, { method: 'plugin_first_use', provisional: 1 });
  assert.ok(await play(olive, 'Olive Maybe', HOME));
  await settled(6);
  await check();
  assert.deepEqual(await signalsOf('Olive Maybe'), sharedWith('Bob Main', 'Olive Iron', 'Olive Main'));
  const own = (await staffList()).find((x) => x.rsn === 'Olive Maybe' && x.kind === `shared_network:${pid['Olive Main']}`)!;
  assert.equal(own.owners, 'same_unconfirmed');

  // Staff confirm the link (People → Needs review): it is hers, and the line is gone at once.
  await db.update(s.accounts).set({ provisional: 0, verificationMethod: 'plugin' }).where(eq(s.accounts.id, acct['Olive Maybe']));
  const list = await staffList();
  assert.ok(!list.some((x) => x.rsn === 'Olive Maybe' && x.kind === `shared_network:${pid['Olive Main']}`));
  assert.equal(list.find((x) => x.rsn === 'Olive Maybe' && x.kind === `shared_network:${pid['Bob Main']}`)!.owners, 'different');
});

test('case 3: an account added mid-contest is flagged; strongly once it connects from another country', async () => {
  // Olive adds a second alt two days in. It plays from her own network: the mild case.
  await enrol(olive, 'Olive Late', team.reds, { addedAt: START + 2 * 86_400_000 });
  assert.ok(await play(olive, 'Olive Late', HOME));
  await settled(7);
  await check();
  assert.deepEqual(await signalsOf('Olive Late'), ['late_account', `shared_network:${pid['Bob Main']}`]);
  const mild = (await staffList()).find((x) => x.rsn === 'Olive Late' && x.kind === 'late_account')!;
  const detail = JSON.parse(mild.detail!);
  assert.equal(detail.lateHours, 48);
  assert.ok(['Olive Main', 'Olive Iron', 'Olive Maybe'].includes(detail.sameNetworkAs), 'names one of her other characters');

  // Staff mark the plain line fine. Then the account starts connecting from the Philippines.
  const fine = await callRoute(route.PATCH, { userId: staff.userId, slug: 'afk', method: 'PATCH', params: { eventId: String(eventId) }, body: { signalId: mild.id } });
  assert.equal(fine.status, 200);
  assert.ok(await play(olive, 'Olive Late', ELSEWHERE, 'PH'));
  await settled(8);
  await check();
  // (Both countries inside a few hours here, so the unchanged two-countries line fires as well.)
  assert.deepEqual(await signalsOf('Olive Late'), ['late_account', 'late_account_far', `shared_network:${pid['Bob Main']}`, 'two_countries']);
  const list = await staffList();
  const far = list.find((x) => x.rsn === 'Olive Late' && x.kind === 'late_account_far')!;
  assert.deepEqual(JSON.parse(far.detail!), { lateHours: 48, countries: ['PH'], against: 'owner' }, 'its own country only');
  assert.ok(!list.some((x) => x.rsn === 'Olive Late' && x.kind === 'late_account'), 'the dismissed plain line stays dismissed');

  // Nobody who was there from the start is "added late", and nothing was blocked or removed.
  assert.ok(!(await signalsOf('Olive Main')).some((k) => k.startsWith('late_account')));
  assert.equal((await db.select().from(s.eventParticipants).where(eq(s.eventParticipants.id, pid['Olive Late'])))[0].teamId, team.reds);
});

test('case 3: marking the far line fine covers the plain one, and neither comes back', async () => {
  await enrol(bob, 'Bob Late', team.blues, { addedAt: START + 3 * 86_400_000 });
  await db.insert(s.integrityNetwork).values({ eventId, participantId: pid['Bob Late'], netHash: N.netHash(eventId, '192.0.2.77'), country: 'VE', firstSeenAt: iso(NOW), lastSeenAt: iso(NOW) });
  await check();
  assert.deepEqual(await signalsOf('Bob Late'), ['late_account', 'late_account_far']);
  const far = (await staffList()).find((x) => x.rsn === 'Bob Late' && x.kind === 'late_account_far')!;
  await callRoute(route.PATCH, { userId: staff.userId, slug: 'afk', method: 'PATCH', params: { eventId: String(eventId) }, body: { signalId: far.id } });
  await check();
  assert.ok(!(await staffList()).some((x) => x.rsn === 'Bob Late'));
});

test('a board that did not opt in records no network and raises none of this', async () => {
  const quiet = (await db.insert(s.events).values({ clanId, name: 'Quiet', boardSize: 3, startDate: iso(START), endDate: iso(NOW + 5 * 86_400_000), tilesRevealed: 1, startNotified: 1 }).returning())[0].id;
  const quietTeam = (await db.insert(s.teams).values({ eventId: quiet, name: 'Only', color: '#0f0' }).returning())[0].id;
  for (const name of ['Q One', 'Q Two', 'Q Three']) await enrol(bob, name, quietTeam, { event: quiet });
  await enrol(bob, 'Q Late', quietTeam, { event: quiet, addedAt: START + 2 * 86_400_000 });
  assert.ok(await play(bob, 'Q One', HOME));
  await new Promise((r) => setTimeout(r, 300));
  assert.equal((await db.select().from(s.integrityNetwork).where(eq(s.integrityNetwork.eventId, quiet))).length, 0);
  await check();
  assert.deepEqual(await db.select().from(s.integritySignals).where(eq(s.integritySignals.eventId, quiet)), []);
});
