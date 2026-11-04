// Another login playing a character it doesn't own.
//
// The Account Token names a LOGIN; X-RSN / X-Account-Hash name the CHARACTER. These pin:
//   - the hard rule: a token whose login doesn't own the character can do NOTHING for it — every
//     plugin write family refuses with one clear message, and nothing is written;
//   - sightings: recorded per (character, login, UTC day), deduped, hash vs name-only, never for the
//     owner's own login; the owner's settings only ever name a hash-confirmed one;
//   - the event fair-play flag: only for a character on a team in the event, only for sightings
//     inside the event window, upserted (days count), staff dismissal respected, and the integrity
//     route answers only for the event's own clan;
//   - "This is my account": a name-only owner → 7-day objection window → transfer (audited, hash
//     anchored, history kept); an owner with plugin proof → only their yes moves it; an objection
//     stops it; a live event defers it; rate limits; one open claim per character; the claimant never
//     sees who the owner is.
//
// Run: TEST_DATABASE_URL=... npx tsx --test tests/other-login.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
import { tokenHash } from './helpers/tokenHash.ts';

const DB = useTestDatabase('other-login');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let A: typeof import('../src/lib/auth.ts');
let F: typeof import('../src/lib/pluginForeign.ts');
let OC: typeof import('../src/lib/ownershipClaims.ts');
let accountRoute: typeof import('../src/app/api/plugin/account/route.ts');

let clanId: number;
let otherClanId: number;
let n = 0;
const ids = {} as Record<string, number>;
const sent: { userId: number; title: string; description: string }[] = [];

const day = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

type Login = { token: string; person: number; userId: number; name: string };

async function login(name?: string): Promise<Login> {
  n++;
  const token = `tok-ol-${n}`;
  const display = name ?? `login-${n}`;
  const [person] = await db.insert(s.players).values({ displayName: display }).returning();
  const [user] = await db
    .insert(s.users)
    .values({ displayName: display, discordUsername: `${display}#d`, discordId: `10000000000000${String(n).padStart(4, "0")}`, pluginTokenHash: tokenHash(token), playerId: person.id })
    .returning();
  return { token, person: person.id, userId: user.id, name: display };
}

/** A character claimed by `owner`, seated in the clan. */
async function character(owner: Login, rsn: string, hash: string | null, method = 'plugin') {
  const now = new Date().toISOString();
  const [acct] = await db
    .insert(s.accounts)
    .values({ playerId: owner.person, rsn, rsnNormalized: rsn.toLowerCase(), accountHash: hash, claimedAt: now, verifiedAt: now, verificationMethod: method })
    .returning();
  const [seat] = await db.insert(s.clanMemberships).values({ clanId, accountId: acct.id, kind: 'member', source: 'roster' }).returning();
  return { accountId: acct.id, seatId: seat.id };
}

function headers(token: string, rsn: string, hash: string | null, extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { Authorization: `Bearer ${token}`, 'X-RSN': rsn, 'x-anvil-clan-slug': 'afk', ...extra };
  if (hash) h['X-Account-Hash'] = hash;
  return h;
}

const req = (path: string, h: Record<string, string>, body?: unknown, method = 'POST') =>
  new Request(`https://example.test${path}`, {
    method,
    headers: body === undefined ? h : { ...h, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

function play(token: string, rsn: string, hash: string | null) {
  return A.resolvePluginMember(req('/api/plugin/config', headers(token, rsn, hash), undefined, 'GET'));
}

async function claimViaPlugin(who: Login, rsn: string, hash: string | null) {
  const res = await accountRoute.POST(req('/api/plugin/account', headers(who.token, rsn, hash), { action: 'dispute' }));
  return { status: res.status, body: await res.json() };
}

const accountById = async (id: number) => (await db.select().from(s.accounts).where(eq(s.accounts.id, id)))[0];

let owner: Login;
let sibling: Login;
let main: { accountId: number; seatId: number };

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  A = await import('../src/lib/auth.ts');
  F = await import('../src/lib/pluginForeign.ts');
  OC = await import('../src/lib/ownershipClaims.ts');
  accountRoute = await import('../src/app/api/plugin/account/route.ts');
  OC.claimNotify.send = async (userId, msg) => {
    sent.push({ userId, ...msg });
    return true;
  };
  const [clan] = await db.insert(s.clans).values({ slug: 'afk', name: 'The AFK Spot', inGameName: 'AFK' }).returning();
  clanId = clan.id;
  const [other] = await db.insert(s.clans).values({ slug: 'elsewhere', name: 'Elsewhere', inGameName: 'ELSE' }).returning();
  otherClanId = other.id;

  owner = await login('Owner Olive');
  sibling = await login('Sibling Sam');
  main = await character(owner, 'Main Guy', 'h-main');

  // A running board with Main Guy on a team, and its tiles.
  ids.event = (await db.insert(s.events).values({ clanId, name: 'Running', boardSize: 3, startDate: day(-1), endDate: day(5), tilesRevealed: 1, startNotified: 1 }).returning())[0].id;
  ids.team = (await db.insert(s.teams).values({ eventId: ids.event, name: 'Reds', color: '#f00' }).returning())[0].id;
  ids.player = (await db.insert(s.eventParticipants).values({ eventId: ids.event, clanMemberId: main.seatId, accountId: main.accountId, name: 'Main Guy', teamId: ids.team }).returning())[0].id;
  ids.kill = (await db.insert(s.tiles).values({ eventId: ids.event, position: 1, label: 'Zulrah', tileType: 'kill', targetNpcs: '["Zulrah"]', requiredAmount: 5 }).returning())[0].id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

// ── Sightings ──────────────────────────────────────────────────────────────────────────────────

test('another login playing a claimed character: nothing resolves, one sighting per day', async () => {
  assert.equal(await play(sibling.token, 'Main Guy', 'h-main'), null, 'never resolves to the owner’s seat');
  await play(sibling.token, 'Main Guy', 'h-main');
  await play(sibling.token, 'Main Guy', 'h-main');
  const days = await db.select().from(s.accountSightingDays).where(eq(s.accountSightingDays.accountId, main.accountId));
  assert.equal(days.length, 1, 'deduped to one row per (character, login, day)');
  assert.equal(days[0].userId, sibling.userId);
  assert.equal(days[0].hashMatched, 1);
  const agg = await db.select().from(s.accountSightings).where(eq(s.accountSightings.accountId, main.accountId));
  assert.equal(agg.length, 1);

  // The owner's own plays are never sightings.
  assert.ok(await play(owner.token, 'Main Guy', 'h-main'));
  const after = await db.select().from(s.accountSightingDays).where(eq(s.accountSightingDays.accountId, main.accountId));
  assert.equal(after.length, 1);
});

test('name-only sightings are kept as the weaker kind; a mismatched hash or none is not a sighting', async () => {
  const nameOnly = await character(owner, 'Name Only', null, 'stat_delta');
  await play(sibling.token, 'Name Only', 'h-whatever');
  const [row] = await db.select().from(s.accountSightingDays).where(eq(s.accountSightingDays.accountId, nameOnly.accountId));
  assert.equal(row.hashMatched, 0);

  const anchored = await character(owner, 'Anchored', 'h-anchored');
  await play(sibling.token, 'Anchored', 'h-not-it');
  await play(sibling.token, 'Anchored', null);
  assert.equal((await db.select().from(s.accountSightingDays).where(eq(s.accountSightingDays.accountId, anchored.accountId))).length, 0);

  // The owner's settings name only hash-confirmed logins (a bare name is free to spoof).
  const { alsoPlayedFromByAccount } = await import('../src/lib/accountSightings.ts');
  const seen = await alsoPlayedFromByAccount([main.accountId, nameOnly.accountId], owner.userId);
  assert.deepEqual(seen.get(main.accountId)?.map((x) => x.name), ['Sibling Sam']);
  assert.equal(seen.has(nameOnly.accountId), false);
});

// ── The hard rule ──────────────────────────────────────────────────────────────────────────────

async function counts() {
  const tables = {
    submissions: s.submissions,
    moments: s.moments,
    pbs: s.memberPersonalBests,
    clog: s.memberClogItems,
    tileClaims: s.tileClaims,
    goals: s.playerGoals,
    uploads: s.proofUploads,
    seats: s.clanMemberships,
    reactions: s.momentReactions,
    rsvps: s.clanEventRsvps,
    coffer: s.cofferEntries,
    weekly: s.weeklyParticipants,
    reports: s.characterReports,
  };
  const out: Record<string, number> = {};
  for (const [k, t] of Object.entries(tables)) out[k] = (await db.select().from(t)).length;
  const acct = await accountById(main.accountId);
  out.liveStatsAt = acct.liveStatsAt ? 1 : 0;
  out.owner = acct.playerId!;
  return out;
}

const FOREIGN = 'This character belongs to another Anvil player — nothing is sent for it.';

async function expectRefused(label: string, res: Response) {
  assert.equal(res.status, 403, `${label}: ${res.status} ${await res.clone().text()}`);
  const body = await res.json();
  assert.equal(body.error, FOREIGN, label);
}

test('every plugin write family refuses a foreign character, and nothing is written', async () => {
  const before = await counts();
  const h = (extra: Record<string, string> = {}) => headers(sibling.token, 'Main Guy', 'h-main', extra);
  const call = async (label: string, path: string, mod: string, body: unknown = {}, params?: Record<string, string>) => {
    const route = await import(mod);
    const res: Response = params
      ? await route.POST(req(path, h(), body), { params: Promise.resolve(params) })
      : await route.POST(req(path, h(), body));
    await expectRefused(label, res);
  };

  // Stats / KC / XP, progress, counters.
  await call('stats', '/api/plugin/stats', '../src/app/api/plugin/stats/route.ts', { skills: { attack: 1 } });
  await call('progress', '/api/plugin/progress', '../src/app/api/plugin/progress/route.ts', { tiles: [] });
  await call('counters', '/api/plugin/counters', '../src/app/api/plugin/counters/route.ts', { counters: {} });
  // Moments / drops / Discord posts / clips.
  await call('moments', '/api/plugin/moments', '../src/app/api/plugin/moments/route.ts', { moments: [] });
  await call('notify', '/api/plugin/notify', '../src/app/api/plugin/notify/route.ts', { channel: 'drops', content: 'x' });
  await call('mode-lines', '/api/plugin/mode-lines', '../src/app/api/plugin/mode-lines/route.ts', { lines: [] });
  {
    const { POST } = await import('../src/app/api/plugin/clip/route.ts');
    await expectRefused('clip', await POST(new Request('https://example.test/api/plugin/clip', { method: 'POST', headers: h(), body: new FormData() })));
  }
  // Collection log / PBs / in-game clan / presence.
  await call('clog', '/api/plugin/clog', '../src/app/api/plugin/clog/route.ts', { pages: [] });
  await call('pb', '/api/plugin/pb', '../src/app/api/plugin/pb/route.ts', { bests: [] });
  await call('game-clan', '/api/plugin/game-clan', '../src/app/api/plugin/game-clan/route.ts', { name: 'X' });
  await call('presence', '/api/plugin/presence', '../src/app/api/plugin/presence/route.ts', {});
  // Coffer.
  await call('coffer', '/api/plugin/coffer', '../src/app/api/plugin/coffer/route.ts', { entries: [] });
  await call('coffer-broadcast', '/api/plugin/coffer/broadcast', '../src/app/api/plugin/coffer/broadcast/route.ts', { lines: [] });
  // Goals.
  await call('goals', '/api/plugin/goals', '../src/app/api/plugin/goals/route.ts', { kind: 'skill', metric: 'attack', target: 99 });
  // Event: submissions, uploads, starting shots.
  await call('submission', `/api/events/${ids.event}/submissions`, '../src/app/api/events/[eventId]/submissions/route.ts', { tileId: ids.kill, teamId: ids.team, amount: 1 }, { eventId: String(ids.event) });
  await call('start-proof', `/api/events/${ids.event}/start-proof`, '../src/app/api/events/[eventId]/start-proof/route.ts', { imageUrl: '/x.png' }, { eventId: String(ids.event) });
  {
    const { POST } = await import('../src/app/api/upload/route.ts');
    await expectRefused('upload', await POST(new Request('https://example.test/api/upload', { method: 'POST', headers: h(), body: new FormData() })));
  }
  // Tile claims (route).
  {
    const { POST } = await import('../src/app/api/plugin/claims/route.ts');
    const res = await POST(req('/api/plugin/claims', h(), { eventId: ids.event, tileId: ids.kill }));
    assert.equal(res.status, 403);
    assert.equal((await res.json()).error, FOREIGN, 'tile claims');
  }
  // Roster sync, hello, weekly enrol: through the character, by name in the body.
  await call('clan-sync', '/api/plugin/clan-sync', '../src/app/api/plugin/clan-sync/route.ts', { clanName: 'AFK', members: [{ rsn: 'Main Guy', rank: 'owner', accountHash: 'h-main' }] });
  await call('hello', '/api/plugin/hello', '../src/app/api/plugin/hello/route.ts', { rsn: 'Main Guy' });
  await call('weekly-enroll', '/api/plugin/weekly/enroll', '../src/app/api/plugin/weekly/enroll/route.ts', { rsn: 'Main Guy' });

  // The panel's actions: every one answers with the refusal, none acts.
  const ui = await import('../src/app/api/plugin/ui/route.ts');
  for (const body of [
    { act: 'goal-add', args: { kind: 'skill' }, fields: { metric: 'attack', target: '99' } },
    { act: 'claim', args: { ev: String(ids.event), tile: String(ids.kill) } },
    { act: 'react', args: { slug: 'afk', id: '1', kind: 'gz' } },
    { act: 'h2h-accept', args: { id: '1' } },
    { act: 'chat-send', args: { s: `event:${ids.event}` }, fields: { msg: 'hi' } },
    { act: 'clan-event-going', args: { clan: 'afk', id: '1', going: '1' } },
  ]) {
    const res = await ui.POST(req('/api/plugin/ui', h(), body));
    assert.equal(res.status, 200, body.act);
    assert.ok(JSON.stringify(await res.json()).includes(FOREIGN), `panel action ${body.act} is refused`);
  }

  assert.deepEqual(await counts(), before, 'not one row written for the character, or for the login');
});

test('the refusal also covers a character this login let go of, and one linked to nobody', async () => {
  const brother = await login();
  // Ignored: a brand-new character played, then "Not my account".
  await play(brother.token, 'Brother Alt', 'h-balt');
  const rel = await accountRoute.POST(req('/api/plugin/account', headers(brother.token, 'Brother Alt', 'h-balt'), { action: 'release' }));
  assert.equal(rel.status, 200);
  const ignored = await F.pluginCharacterRefusal(req('/x', headers(brother.token, 'Brother Alt', 'h-balt')));
  assert.equal(ignored?.reason, 'ignored-character');
  // Its own character, after the first play: allowed.
  await play(brother.token, 'Brother Main', 'h-bmain');
  assert.equal(await F.pluginCharacterRefusal(req('/x', headers(brother.token, 'Brother Main', 'h-bmain'))), null);
  // The owner on their own character: allowed.
  assert.equal(await F.pluginCharacterRefusal(req('/x', headers(owner.token, 'Main Guy', 'h-main'))), null);
  // No character named: the login acting as itself, judged by the route.
  assert.equal(await F.pluginCharacterRefusal(new Request('https://example.test/x', { headers: { Authorization: `Bearer ${brother.token}` } })), null);
});

// ── Event fair-play flag ───────────────────────────────────────────────────────────────────────

test('fair-play: a team player in the running event, played by another login inside the window, is flagged', async () => {
  const FC = await import('../src/lib/footprintCheck.ts');
  const ev = (await db.select().from(s.events).where(eq(s.events.id, ids.event)))[0];
  const window = { startMs: Date.parse(ev.startDate!), endMs: Date.parse(ev.endDate!) };
  const players = await db
    .select({ id: s.eventParticipants.id, accountId: s.eventParticipants.accountId, teamId: s.eventParticipants.teamId })
    .from(s.eventParticipants)
    .where(eq(s.eventParticipants.eventId, ids.event));
  assert.equal(await FC.raiseOtherLoginSignals(ids.event, window, players), 1);
  const [sig] = await db.select().from(s.integritySignals).where(eq(s.integritySignals.eventId, ids.event));
  assert.equal(sig.participantId, ids.player);
  assert.equal(sig.kind, `other_login:${sibling.userId}`);
  assert.deepEqual(JSON.parse(sig.detail!), { seenAt: JSON.parse(sig.detail!).seenAt, days: 1, hashMatched: true });

  // Another day's sighting updates the same signal (one per login per event)...
  await db.insert(s.accountSightingDays).values({ accountId: main.accountId, userId: sibling.userId, day: day(1).slice(0, 10), hashMatched: 1, firstAt: day(1), lastAt: day(1) });
  await FC.raiseOtherLoginSignals(ids.event, window, players);
  const rows = await db.select().from(s.integritySignals).where(eq(s.integritySignals.eventId, ids.event));
  assert.equal(rows.length, 1);
  assert.equal(JSON.parse(rows[0].detail!).days, 2);
  // ...unless staff marked it fine.
  await db.update(s.integritySignals).set({ dismissedAt: 'x', detail: 'kept' }).where(eq(s.integritySignals.id, rows[0].id));
  await FC.raiseOtherLoginSignals(ids.event, window, players);
  assert.equal((await db.select().from(s.integritySignals).where(eq(s.integritySignals.id, rows[0].id)))[0].detail, 'kept');
});

test('fair-play: nothing outside the window, off a team, or in another event', async () => {
  const FC = await import('../src/lib/footprintCheck.ts');
  // An event that ended a week ago with Main Guy on a team: today's sighting is outside it.
  const past = (await db.insert(s.events).values({ clanId, name: 'Past', boardSize: 3, startDate: day(-20), endDate: day(-7), startNotified: 1 }).returning())[0].id;
  const pastTeam = (await db.insert(s.teams).values({ eventId: past, name: 'Old', color: '#000' }).returning())[0].id;
  const pastPlayer = (await db.insert(s.eventParticipants).values({ eventId: past, clanMemberId: main.seatId, accountId: main.accountId, name: 'Main Guy', teamId: pastTeam }).returning())[0];
  assert.equal(await FC.raiseOtherLoginSignals(past, { startMs: Date.parse(day(-20)), endMs: Date.parse(day(-7)) }, [pastPlayer]), 0);
  // Signed up but on no team.
  const loose = (await db.insert(s.events).values({ clanId, name: 'Loose', boardSize: 3, startDate: day(-1), endDate: day(3), startNotified: 1 }).returning())[0].id;
  const loosePlayer = (await db.insert(s.eventParticipants).values({ eventId: loose, clanMemberId: main.seatId, accountId: main.accountId, name: 'Main Guy', teamId: null }).returning())[0];
  assert.equal(await FC.raiseOtherLoginSignals(loose, { startMs: Date.parse(day(-1)), endMs: Date.parse(day(3)) }, [loosePlayer]), 0);
  assert.equal((await db.select().from(s.integritySignals).where(eq(s.integritySignals.eventId, past))).length, 0);
  assert.equal((await db.select().from(s.integritySignals).where(eq(s.integritySignals.eventId, loose))).length, 0);
});

test('fair-play: the integrity list answers only through the event’s own clan', async () => {
  const route = await import('../src/app/api/admin/events/[eventId]/integrity/route.ts');
  const res = await route.GET(
    new Request(`https://example.test/api/admin/events/${ids.event}/integrity`, { headers: { 'x-anvil-clan-slug': 'elsewhere' } }),
    { params: Promise.resolve({ eventId: String(ids.event) }) },
  );
  assert.equal(res.status, 404, 'another clan’s staff never see it');
  void otherClanId;
});

// ── "This is my account" ───────────────────────────────────────────────────────────────────────

test('claim on a name-only owner: owner told, 7-day window, then it moves (audited, history kept)', async () => {
  const realOwner = await login('Real Rita');
  const named = await character(owner, 'Rita Main', null, 'stat_delta');
  sent.length = 0;

  const r = await claimViaPlugin(realOwner, 'Rita Main', 'h-rita');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.claim, true);
  assert.match(r.body.message, /7 days|until/);
  // Nothing about the owner reaches the claimant.
  for (const leak of ['Owner Olive', 'Owner Olive#d']) assert.ok(!JSON.stringify(r.body).includes(leak), `leaked ${leak}`);

  const [claim] = await db.select().from(s.accountOwnershipClaims).where(eq(s.accountOwnershipClaims.accountId, named.accountId));
  assert.equal(claim.mode, 'objection');
  assert.equal(claim.status, 'open');
  const deadline = Date.parse(claim.deadlineAt!);
  assert.ok(Math.abs(deadline - (Date.now() + 7 * 86_400_000)) < 60_000);

  // The owner is told: a DM and the settings list, naming who is asking.
  await new Promise((r) => setTimeout(r, 50));
  const dm = sent.find((m) => m.userId === owner.userId);
  assert.ok(dm && dm.title.includes('Real Rita') && dm.description.includes('Rita Main'), JSON.stringify(sent));
  const onMine = await OC.claimsOnMyCharacters(owner.person);
  assert.ok(onMine.some((c) => c.id === claim.id && c.claimantName === 'Real Rita'));

  // Until it moves, the claimant still can't act for it.
  const still = await F.pluginCharacterRefusal(req('/x', headers(realOwner.token, 'Rita Main', 'h-rita')));
  assert.equal(still?.reason, 'foreign-character');
  // Pressing again is the same claim, not a second one.
  const again = await claimViaPlugin(realOwner, 'Rita Main', 'h-rita');
  assert.equal(again.body.alreadyOpen, true);

  // Before the deadline the sweep leaves it; after, it moves.
  await OC.settleOwnershipClaims(Date.now() + 6 * 86_400_000);
  assert.equal((await accountById(named.accountId)).playerId, owner.person);
  assert.equal(await OC.settleOwnershipClaims(Date.now() + 8 * 86_400_000), 1);
  const moved = await accountById(named.accountId);
  assert.equal(moved.playerId, realOwner.person);
  assert.equal(moved.accountHash, 'h-rita', 'the claimant’s hash anchors it');
  assert.equal(moved.verificationMethod, 'plugin');
  assert.equal((await db.select().from(s.clanMemberships).where(eq(s.clanMemberships.id, named.seatId))).length, 1, 'the seat (and its history) stays');
  assert.equal((await db.select().from(s.accountOwnershipClaims).where(eq(s.accountOwnershipClaims.id, claim.id)))[0].status, 'transferred');
  assert.equal(await F.pluginCharacterRefusal(req('/x', headers(realOwner.token, 'Rita Main', 'h-rita'))), null, 'now theirs to act for');
  const marker = await db.query.detectedAccounts.findFirst({ where: and(eq(s.detectedAccounts.userId, owner.userId), eq(s.detectedAccounts.rsnNormalized, 'rita main')) });
  assert.equal(marker?.status, 'released', 'the old owner’s plugin won’t re-link it');
  const audits = (await db.select().from(s.clanAuditLog)).filter((a) => (a.newValue ?? '').includes(`"claimId":${claim.id}`)).map((a) => a.eventType);
  for (const e of ['ownership_claim_opened', 'ownership_claim_unopposed', 'ownership_claim_transferred']) assert.ok(audits.includes(e), `${e} in ${audits}`);
  assert.ok(sent.some((m) => m.userId === owner.userId && m.title.includes('moved')), 'the owner is told it moved');
});

test('an objection stops the move; asking again goes to staff instead', async () => {
  const claimant = await login('Claimant Cal');
  const named = await character(owner, 'Cal Main', null, 'manual');
  const r = await claimViaPlugin(claimant, 'Cal Main', 'h-cal');
  assert.equal(r.body.claim, true);
  const [claim] = await db.select().from(s.accountOwnershipClaims).where(eq(s.accountOwnershipClaims.accountId, named.accountId));

  // Only the owner may answer.
  assert.equal((await OC.respondToClaim({ claimId: claim.id, userId: claimant.userId, playerId: claimant.person, action: 'approve' })).ok, false);
  const out = await OC.respondToClaim({ claimId: claim.id, userId: owner.userId, playerId: owner.person, action: 'decline' });
  assert.deepEqual(out, { ok: true, status: 'objected' });
  await OC.settleOwnershipClaims(Date.now() + 8 * 86_400_000);
  assert.equal((await accountById(named.accountId)).playerId, owner.person, 'stays put');

  const mine = await OC.myOwnershipClaims(claimant.userId);
  assert.equal(mine[0].status, 'objected');
  assert.ok(!JSON.stringify(mine).includes('Owner Olive'));

  const reportsBefore = (await db.select().from(s.characterReports)).length;
  const again = await claimViaPlugin(claimant, 'Cal Main', 'h-cal');
  assert.equal(again.body.claim, false);
  assert.equal((await db.select().from(s.characterReports)).length, reportsBefore + 1, 'filed with staff');
});

test('an owner with plugin proof: only their yes moves it, and a live event defers the move', async () => {
  const claimant = await login('Proof Pat');
  const proven = await character(owner, 'Proven Main', 'h-proven', 'plugin');
  const r = await claimViaPlugin(claimant, 'Proven Main', 'h-proven');
  assert.equal(r.body.claim, true);
  const [claim] = await db.select().from(s.accountOwnershipClaims).where(eq(s.accountOwnershipClaims.accountId, proven.accountId));
  assert.equal(claim.mode, 'approval');
  assert.equal(claim.deadlineAt, null);

  await OC.settleOwnershipClaims(Date.now() + 60 * 86_400_000);
  assert.equal((await accountById(proven.accountId)).playerId, owner.person, 'no window: time alone never moves it');

  // On a live board: the yes is recorded, the move waits for the end.
  const ev = (await db.insert(s.events).values({ clanId, name: 'Live', boardSize: 3, startDate: day(-1), endDate: day(2) }).returning())[0].id;
  const team = (await db.insert(s.teams).values({ eventId: ev, name: 'T', color: '#fff' }).returning())[0].id;
  await db.insert(s.eventParticipants).values({ eventId: ev, clanMemberId: proven.seatId, accountId: proven.accountId, name: 'Proven Main', teamId: team });
  const yes = await OC.respondToClaim({ claimId: claim.id, userId: owner.userId, playerId: owner.person, action: 'approve' });
  assert.deepEqual(yes, { ok: true, status: 'approved' });
  assert.equal((await accountById(proven.accountId)).playerId, owner.person);

  await db.update(s.events).set({ endDate: day(-1) }).where(eq(s.events.id, ev));
  assert.equal(await OC.settleOwnershipClaims(), 1);
  assert.equal((await accountById(proven.accountId)).playerId, claimant.person);
  assert.equal((await accountById(proven.accountId)).accountHash, 'h-proven');
});

test('claims Anvil can’t weigh go to staff: no hash, or a hash that isn’t the one on record', async () => {
  const claimant = await login();
  await character(owner, 'Hashed Main', 'h-real-one', 'plugin');
  const before = (await db.select().from(s.characterReports)).length;
  const noHash = await claimViaPlugin(claimant, 'Hashed Main', null);
  assert.equal(noHash.body.claim, false);
  const wrong = await claimViaPlugin(claimant, 'Hashed Main', 'h-something-else');
  assert.equal(wrong.body.claim, false);
  assert.equal((await db.select().from(s.characterReports)).length, before + 1, 'one open report, not two');
  assert.equal((await db.select().from(s.accountOwnershipClaims).where(eq(s.accountOwnershipClaims.claimantUserId, claimant.userId))).length, 0);
});

test('one open claim per character, a daily limit per login, and no owner identity either way', async () => {
  const first = await login('First Fay');
  const second = await login('Second Sid');
  await character(owner, 'Contested', null, 'stat_delta');
  assert.equal((await claimViaPlugin(first, 'Contested', 'h-contested')).body.claim, true);
  const taken = await claimViaPlugin(second, 'Contested', 'h-contested');
  assert.equal(taken.status, 409);
  assert.ok(!JSON.stringify(taken.body).includes('Owner Olive') && !JSON.stringify(taken.body).includes('First Fay'));

  const greedy = await login('Greedy Gus');
  for (let i = 0; i < OC.CLAIMS_PER_DAY; i++) {
    await character(owner, `Spare ${i}`, null, 'stat_delta');
    assert.equal((await claimViaPlugin(greedy, `Spare ${i}`, `h-spare-${i}`)).body.claim, true);
  }
  await character(owner, 'Spare X', null, 'stat_delta');
  const limited = await claimViaPlugin(greedy, 'Spare X', 'h-spare-x');
  assert.equal(limited.status, 429);

  // A withdrawn claim closes, and only its claimant may withdraw it.
  const mine = await OC.myOwnershipClaims(greedy.userId);
  assert.equal((await OC.withdrawClaim({ claimId: mine[0].id, userId: first.userId })).ok, false);
  assert.deepEqual(await OC.withdrawClaim({ claimId: mine[0].id, userId: greedy.userId }), { ok: true, status: 'withdrawn' });
});

test('the plugin panel shows the claim state and offers "This is my account" on somebody else’s character', async () => {
  const ui = await import('../src/app/api/plugin/ui/route.ts');
  const viewer = await login('Panel Pam');
  await character(owner, 'Panel Main', null, 'stat_delta');
  const h = headers(viewer.token, 'Panel Main', 'h-panel');
  const view = async () => JSON.stringify(await (await ui.GET(new Request('https://example.test/api/plugin/ui?v=you', { headers: h }))).json());

  const before = await view();
  assert.ok(before.includes('belongs to another Anvil player'), before);
  assert.ok(before.includes('This is my account'));
  assert.ok(before.includes('"act":"ownership-claim"'));
  assert.ok(!before.includes('Owner Olive'));

  const res = await ui.POST(req('/api/plugin/ui', h, { act: 'ownership-claim' }));
  const after = JSON.stringify(await res.json());
  assert.ok(after.includes('Your claim on Panel Main is open'), after);
  assert.ok(!after.includes('This is my account'), 'no second button while one is open');
  assert.ok(!after.includes('Owner Olive'));
});
