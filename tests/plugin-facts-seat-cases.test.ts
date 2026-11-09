// One kill fact credits every live board the character is entered on, whatever kind of seat put
// them there — the facts route files each folded-in board at its own submissions route, under the
// clan address liveBoardsForCharacter picked, and that address must resolve the same plugin token:
//
//   home     a member seat in the addressed clan (the live pick)
//   guest    a guest seat in another clan
//   creator  a viewer's EVENT seat in a creator space (Kick/YouTube/Twitch gate entry)
//   friends  an event seat in a friends host (an invite-link entry)
//   cohost   a board hosted by a clan the character has no seat in, entered on the co-host's team
//            through a guest seat in the co-host clan (a team invite link seats the same way)
//   invite   a team-invite entry: a guest seat in the host + a participant row on the invite team
//
// Not credited, by design: a live board the character is not entered on (even in a clan where it
// holds a seat), and a creator board through another event's seat. A banned login gets nothing.
//
// Run: TEST_DATABASE_URL=... npx tsx --test tests/plugin-facts-seat-cases.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
import { tokenHash } from './helpers/tokenHash.ts';

// Next's request storage wants the runtime's AsyncLocalStorage on globalThis (the server sets it).
(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage ??= AsyncLocalStorage;

const DB = useTestDatabase('facts-seat-cases');
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
const RSN = 'Seatcase';
const TOKEN = 'tok-seatcase';
let userId = 0;
const kill = {} as Record<string, number>;
const credited = ['home', 'guest', 'creator', 'friends', 'cohost', 'invite'];
const notCredited = ['stranger', 'otherShow'];

const ago = (s: number) => new Date(Date.now() - s * 1000).toISOString();
const later = new Date(Date.now() + 3 * 86_400_000).toISOString();

// The routes read cookies()/headers(); outside Next there is no request scope, so run in a bare one
// (as tests/proof-after-db.test.ts does): no cookies, the request's own headers.
async function inRequest<T>(req: Request, fn: () => Promise<T>): Promise<T> {
  const { workAsyncStorage } = await import('next/dist/server/app-render/work-async-storage.external.js');
  const { workUnitAsyncStorage } = await import('next/dist/server/app-render/work-unit-async-storage.external.js');
  const { RequestCookiesAdapter } = await import('next/dist/server/web/spec-extension/adapters/request-cookies.js');
  const { HeadersAdapter } = await import('next/dist/server/web/spec-extension/adapters/headers.js');
  const { RequestCookies } = await import('next/dist/server/web/spec-extension/cookies.js');
  const store = { type: 'request', phase: 'render', headers: HeadersAdapter.seal(new Headers(req.headers)), cookies: RequestCookiesAdapter.seal(new RequestCookies(new Headers())) };
  return workAsyncStorage.run({ route: '/test' } as never, () => workUnitAsyncStorage.run(store as never, fn));
}

async function facts() {
  const { POST } = await import('../src/app/api/plugin/facts/route.ts');
  const req = new Request('https://example.test/api/plugin/facts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'X-RSN': RSN,
        'X-Account-Hash': 'hash-seatcase',
        'x-anvil-clan-slug': 'alpha',
        'X-Anvil-Boards': '1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ facts: [{ k: 'kill', n: { Zulrah: 1 } }] }),
    });
  return inRequest(req, () => POST(req));
}

before(async () => {
  await resetDatabase(DB);
  const loaded = await loadDb();
  pool = loaded.pool;
  const { db, schema: s } = loaded;
  const clan = async (slug: string, kind = 'clan') => (await db.insert(s.clans).values({ slug, name: slug, kind, ...(kind === 'creator' ? { plan: 'creator_free' } : {}) }).returning())[0].id;
  const alpha = await clan('alpha');
  const bravo = await clan('bravo');
  const show = await clan('showhost', 'creator');
  const pals = await clan('pals', 'friends');
  const delta = await clan('delta');
  const echo = await clan('echo');
  const fox = await clan('foxtrot');

  const [person] = await db.insert(s.players).values({ displayName: RSN }).returning();
  [{ id: userId }] = await db.insert(s.users).values({ displayName: RSN, discordId: 'd-seatcase', pluginTokenHash: tokenHash(TOKEN), playerId: person.id }).returning();
  const now = new Date().toISOString();
  const [acct] = await db
    .insert(s.accounts)
    .values({ playerId: person.id, rsn: RSN, rsnNormalized: RSN.toLowerCase(), accountHash: 'hash-seatcase', claimedAt: now, verifiedAt: now, verificationMethod: 'plugin' })
    .returning();
  const seat = async (clanId: number, kind: string, eventId: number | null = null) =>
    (await db.insert(s.clanMemberships).values({ clanId, accountId: acct.id, kind, eventId, source: kind === 'member' ? 'roster' : 'application' }).returning())[0].id;

  let n = 0;
  const board = async (key: string, clanId: number, opts: { teamClanId?: number; seatId?: number | null } = {}) => {
    // Home starts last-but-freshest so it is the live pick at alpha; the rest are folded in.
    const startDate = ago(key === 'home' ? 10 : 1000 + n++ * 10);
    const [ev] = await db.insert(s.events).values({ clanId, name: `Board ${key}`, boardSize: 2, startDate, endDate: later, tilesRevealed: 1 }).returning();
    const [team] = await db.insert(s.teams).values({ eventId: ev.id, name: `Team ${key}`, color: '#fff', clanId: opts.teamClanId ?? null }).returning();
    if (opts.seatId !== undefined) {
      await db.insert(s.eventParticipants).values({ eventId: ev.id, clanMemberId: opts.seatId, accountId: acct.id, name: RSN, teamId: team.id });
    }
    kill[key] = (await db.insert(s.tiles).values({ eventId: ev.id, position: 1, label: `${key} Zulrah`, tileType: 'kill', targetNpcs: '["Zulrah"]', requiredAmount: 50 }).returning())[0].id;
    return ev.id;
  };

  await board('home', alpha, { seatId: await seat(alpha, 'member') });
  const bravoGuest = await seat(bravo, 'guest');
  await board('guest', bravo, { seatId: bravoGuest });
  await board('stranger', bravo); // live in a clan it guests in, but not entered: no credit

  // Creator space: an event seat opens exactly its own event.
  const showEvent = await board('creator', show);
  const showSeat = await seat(show, 'event', showEvent);
  const [showTeam] = await db.select().from(s.teams).where((await import('drizzle-orm')).eq(s.teams.eventId, showEvent));
  await db.insert(s.eventParticipants).values({ eventId: showEvent, clanMemberId: showSeat, accountId: acct.id, name: RSN, teamId: showTeam.id });
  // Another of the streamer's live events: a stale participant row hanging off the FIRST event's seat
  // must not open it (seatOpensEvent) — guards the "never loosen" side.
  const otherShow = await board('otherShow', show);
  const [otherTeam] = await db.select().from(s.teams).where((await import('drizzle-orm')).eq(s.teams.eventId, otherShow));
  await db.insert(s.eventParticipants).values({ eventId: otherShow, clanMemberId: showSeat, accountId: null, name: RSN, teamId: otherTeam.id });

  const palsEvent = await board('friends', pals);
  const palsSeat = await seat(pals, 'event', palsEvent);
  const [palsTeam] = await db.select().from(s.teams).where((await import('drizzle-orm')).eq(s.teams.eventId, palsEvent));
  await db.insert(s.eventParticipants).values({ eventId: palsEvent, clanMemberId: palsSeat, accountId: acct.id, name: RSN, teamId: palsTeam.id });

  // Co-host: hosted by delta (no seat there), echo co-hosts and fields the team.
  const echoGuest = await seat(echo, 'guest');
  const cohostEvent = await board('cohost', delta, { teamClanId: echo, seatId: echoGuest });
  await db.insert(s.eventCohosts).values({ eventId: cohostEvent, clanId: echo, status: 'accepted' });

  // Team invite link: the sign-up seats them through a seat in the host (guest here).
  await board('invite', fox, { seatId: await seat(fox, 'guest') });
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

async function subsFor(tileIds: number[]) {
  const { db, schema: s } = await loadDb();
  const { inArray } = await import('drizzle-orm');
  return db.select().from(s.submissions).where(inArray(s.submissions.tileId, tileIds));
}

test('one kill fact credits every board the character is entered on, whatever the seat', async () => {
  const res = await facts();
  assert.equal(res.status, 200, await res.clone().text());
  const body = (await res.json()) as { credits: { t: number; ok?: boolean; error?: string }[] };
  for (const key of credited) {
    const c = body.credits.find((x) => x.t === kill[key]);
    assert.ok(c, `${key}: no credit in ${JSON.stringify(body)}`);
    assert.notEqual(c.ok, false, `${key} refused: ${JSON.stringify(c)}`);
  }
  const subs = await subsFor(Object.values(kill));
  const got = new Set(subs.map((r) => r.tileId));
  for (const key of credited) assert.ok(got.has(kill[key]), `${key}: no submission`);
  for (const key of notCredited) assert.ok(!got.has(kill[key]), `${key}: must not be credited`);
});

test('a banned login’s token files nothing anywhere', async () => {
  const { db, schema: s } = await loadDb();
  const { eq } = await import('drizzle-orm');
  const before = (await subsFor(Object.values(kill))).length;
  await db.update(s.users).set({ banned: true }).where(eq(s.users.id, userId));
  try {
    const res = await facts();
    assert.notEqual(res.status, 200);
    assert.equal((await subsFor(Object.values(kill))).length, before);
  } finally {
    await db.update(s.users).set({ banned: false }).where(eq(s.users.id, userId));
  }
});


// The board/progress (tracked pin) routes address each board through the clan its /config tag names:
// that address must find the event and resolve the character's own seat on it.
test('every folded-in board resolves the character’s seat through the clan it is tagged with', async () => {
  const { GET } = await import('../src/app/api/plugin/config/route.ts');
  const h = (clan: string) => ({ Authorization: `Bearer ${TOKEN}`, 'X-RSN': RSN, 'X-Account-Hash': 'hash-seatcase', 'x-anvil-clan-slug': clan });
  const req = new Request('https://example.test/api/plugin/config', { headers: { ...h('alpha'), 'X-Anvil-Boards': '1' } });
  const cfg = (await (await inRequest(req, () => GET(req))).json()) as { boards: { eventId: number; clan: string; teamId: number; name: string }[] };
  assert.deepEqual(cfg.boards.map((b) => b.name.replace('Board ', '')).sort(), [...credited].sort());
  const A = await import('../src/lib/auth.ts');
  const S = await import('../src/lib/eventScope.ts');
  for (const b of cfg.boards) {
    const at = new Request('https://example.test/x', { headers: h(b.clan) });
    assert.ok(await S.eventForPluginRequest(at, b.eventId), `${b.name}: event not found via ${b.clan}`);
    const seat = await A.verifyPluginTokenForEvent(at, b.eventId);
    assert.equal(seat?.teamId, b.teamId, `${b.name}: no seat via ${b.clan}`);
  }
});
