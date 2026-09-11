// Which clan a plugin request is for, when the address does not say.
//
// One site now serves every clan, so `anvilosrs.com` is the canonical address and it names no clan
// at all. That is the intended state: a person should not have to know a slug, and should not have
// to change anything when they join a second clan. The clan therefore comes from the TOKEN, which
// names a person, whose seats name their clans.
//
// The per-clan subdomain and the `/c/<slug>` path still resolve, because installed plugins have
// those stored. This suite pins the ORDER — address first, token second — because the failure mode
// is silent either way round: resolve the wrong clan and you serve the wrong board, and nothing
// errors.
//
// Run: npx tsx --test tests/plugin-apex.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('plugin-apex');
const TOKEN = 'apex-test-token';
const RSN = 'Wanderer';

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let A: typeof import('../src/lib/auth.ts');
let alpha: number;
let bravo: number;
let seatAlpha: number;
let seatBravo: number;

const iso = (daysFromNow: number) => new Date(Date.now() + daysFromNow * 86_400_000).toISOString();

/** A request as it arrives on the bare apex: a token, and nothing naming a clan. */
function apexRequest(headers: Record<string, string> = {}) {
  return new Request('https://anvilosrs.com/api/plugin/config', {
    headers: { Authorization: `Bearer ${TOKEN}`, host: 'anvilosrs.com', ...headers },
  });
}

async function liveEventFor(clanId: number, seatId: number, name: string, startsDaysAgo: number) {
  const { db, schema: s } = await loadDb();
  const [ev] = await db
    .insert(s.events)
    .values({
      clanId,
      name,
      startDate: iso(-startsDaysAgo),
      endDate: iso(7),
      boardSize: 25,
    })
    .returning();
  await db.insert(s.eventParticipants).values({ eventId: ev.id, clanMemberId: seatId, name: RSN });
  return ev.id;
}

async function clearEvents() {
  const { db, schema: s } = await loadDb();
  await db.delete(s.eventParticipants);
  await db.delete(s.events);
}

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  A = await import('../src/lib/auth.ts');

  const clans = await db
    .insert(s.clans)
    .values([
      { slug: 'alpha', name: 'Alpha', inGameName: 'Alpha CC' },
      { slug: 'bravo', name: 'Bravo', inGameName: 'Bravo CC' },
    ])
    .returning();
  [alpha, bravo] = clans.map((c) => c.id);

  const [person] = await db.insert(s.players).values({ displayName: RSN }).returning();
  await db
    .insert(s.users)
    .values({ displayName: RSN, discordId: 'disc-apex', pluginToken: TOKEN, playerId: person.id });

  const [acct] = await db
    .insert(s.accounts)
    .values({ playerId: person.id, rsn: RSN, rsnNormalized: RSN.toLowerCase() })
    .returning();

  // One person, a seat in each clan — the case the whole platform exists to serve, and the case a
  // Host-only resolver could never answer on the apex.
  const seats = await db
    .insert(s.clanMemberships)
    .values([
      { clanId: alpha, accountId: acct.id, kind: 'member', source: 'roster' },
      { clanId: bravo, accountId: acct.id, kind: 'guest', source: 'application' },
    ])
    .returning();
  [seatAlpha, seatBravo] = seats.map((m) => m.id);
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

// ── The address still wins, so nothing in the wild breaks ────────────────────────────────────

test('a /c/<slug> path names the clan, even against a live event elsewhere', async () => {
  await clearEvents();
  await liveEventFor(bravo, seatBravo, 'Bravo Bingo', 1);

  const clan = await A.resolvePluginClan(
    apexRequest({ 'x-anvil-clan-slug': 'alpha' }),
  );
  assert.equal(clan?.id, alpha, 'the typed address wins over the token heuristic');
});

test('an old per-clan subdomain still resolves', async () => {
  await clearEvents();
  const req = new Request('https://alpha.anvilosrs.com/api/plugin/config', {
    headers: { Authorization: `Bearer ${TOKEN}`, host: 'alpha.anvilosrs.com' },
  });
  assert.equal((await A.resolvePluginClan(req))?.id, alpha);
});

// ── The apex, where the token is the only thing that can answer ───────────────────────────────

test('on the apex, a live event decides', async () => {
  await clearEvents();
  await liveEventFor(bravo, seatBravo, 'Bravo Bingo', 1);

  const clan = await A.resolvePluginClan(apexRequest());
  assert.equal(clan?.id, bravo, 'the clan they are actually playing for');
});

test('between two live events, YOUR OWN clan wins — a guest board is not your home', async () => {
  await clearEvents();
  await liveEventFor(alpha, seatAlpha, 'Alpha Bingo', 10); // their own clan, started 10 days ago
  await liveEventFor(bravo, seatBravo, 'Bravo Bingo', 1); //  guesting, started yesterday

  const clan = await A.resolvePluginClan(apexRequest());
  // Recency alone used to decide this, which put the panel on the guest clan the moment it started
  // anything: their own clan's board underneath, and Sync roster gone, because admin is per clan.
  assert.equal(clan?.id, alpha, 'the clan they are a MEMBER of, while it has something running');
});

test('with nothing live, they still resolve to a clan rather than nowhere', async () => {
  await clearEvents();
  const clan = await A.resolvePluginClan(apexRequest());
  assert.ok(clan, 'a seat is enough; the schedule and notifications need somewhere to point');
  assert.ok([alpha, bravo].includes(clan!.id));
});

test('a token nobody holds resolves to no clan at all', async () => {
  const req = new Request('https://anvilosrs.com/api/plugin/config', {
    headers: { Authorization: 'Bearer not-a-real-token', host: 'anvilosrs.com' },
  });
  assert.equal(await A.resolvePluginClan(req), null);
});

test('no token and no address is not somebody else’s clan', async () => {
  const req = new Request('https://anvilosrs.com/api/plugin/config', { headers: { host: 'anvilosrs.com' } });
  assert.equal(await A.resolvePluginClan(req), null, 'an anonymous apex call names nobody');
});

// ── The roster push, which writes, and so gets an exact answer ────────────────────────────────

test('a roster sync resolves by the IN-GAME clan name it carries', async () => {
  await clearEvents();
  // Bravo has the live event, so every heuristic below would choose Bravo.
  await liveEventFor(bravo, seatBravo, 'Bravo Bingo', 1);

  const clan = await A.resolvePluginClan(apexRequest(), null, { inGameClanName: 'Alpha CC' });
  assert.equal(clan?.id, alpha, 'the roster you sent names its own clan; that beats the guess');
});

test('and the match ignores case, because a clan name is typed by people', async () => {
  const clan = await A.resolvePluginClan(apexRequest(), null, { inGameClanName: 'aLpHa cC' });
  assert.equal(clan?.id, alpha);
});

test('an in-game name matching none of their seats falls back rather than guessing wrong', async () => {
  await clearEvents();
  await liveEventFor(bravo, seatBravo, 'Bravo Bingo', 1);

  // A clan they hold no seat in must never resolve — that would let a roster push write somewhere
  // the pusher does not belong.
  const clan = await A.resolvePluginClan(apexRequest(), null, { inGameClanName: 'Someone Else CC' });
  assert.equal(clan?.id, bravo, 'falls through to the live-event answer, not to the named stranger');
});

// ── The lockout, which is what happens when every branch needs a seat ──────────────────────────
//
// Each branch above resolves through seats, which quietly made an active seat a prerequisite for
// admin capability through the plugin — and the roster sync is itself the thing that can remove one.
// That closed a loop on 2026-09-11: a client posted an empty member list, all 144 members were
// departed, and the owner's own seat went with them. The only tool that could repair the roster was
// the tool the damage had disabled, and an admin can never escape it by luck — an admin is a member,
// so an admin is in the list that went missing.
//
// A roster push NAMES its clan, so it does not have to be guessed from a seat. These pin that the
// grant answers when the seat cannot, and that it answers nothing else.

/** Depart every seat this person holds — the state the empty-roster sync left the owner in. */
async function departAllSeats() {
  const { db, schema: s } = await loadDb();
  await db.update(s.clanMemberships).set({ leftAt: iso(0) });
}

async function restoreSeats() {
  const { db, schema: s } = await loadDb();
  await db.update(s.clanMemberships).set({ leftAt: null });
}

async function grantStaff(clanId: number, role: string) {
  const { db, schema: s } = await loadDb();
  const user = await db.query.users.findFirst({ where: eq(s.users.pluginToken, TOKEN) });
  await db.insert(s.clanStaff).values({ clanId, userId: user!.id, role });
}

async function clearStaff() {
  const { db, schema: s } = await loadDb();
  await db.delete(s.clanStaff);
}

test('a named clan resolves from a STAFF GRANT when the seat is gone', async () => {
  await clearEvents();
  await departAllSeats();
  await grantStaff(alpha, 'owner');

  const clan = await A.resolvePluginClan(apexRequest(), null, { inGameClanName: 'Alpha CC' });
  assert.equal(clan?.id, alpha, 'the owner can still name their own clan, and so can still fix it');

  await clearStaff();
  await restoreSeats();
});

test('a seat still wins over a grant, so nothing about the ordinary path moved', async () => {
  await clearEvents();
  // Staff of Bravo, seated in Alpha, and the push names Alpha: the seat is the better answer and
  // must remain the one taken.
  await grantStaff(bravo, 'admin');

  const clan = await A.resolvePluginClan(apexRequest(), null, { inGameClanName: 'Alpha CC' });
  assert.equal(clan?.id, alpha);

  await clearStaff();
});

test('a grant never answers a request that named no clan', async () => {
  await clearEvents();
  await liveEventFor(bravo, seatBravo, 'Bravo Bingo', 1);
  await grantStaff(alpha, 'owner');

  // Branch 1 only. The heuristics choose which BOARD to show a player, and "a clan I staff" is a
  // worse answer there than "a clan I am in" — someone who runs one clan and plays in another
  // should still get their own board.
  const clan = await A.resolvePluginClan(apexRequest());
  assert.equal(clan?.id, bravo, 'the live board they are actually playing, not the clan they run');

  await clearStaff();
});

test('no seat and no grant still resolves nothing — belonging is still required', async () => {
  await clearEvents();
  await departAllSeats();

  // The rule the grant relaxes is "which clan", never "may I write to it". Someone who holds
  // neither a seat nor a grant must still name nobody, or a roster push could write to a stranger.
  const clan = await A.resolvePluginClan(apexRequest(), null, { inGameClanName: 'Alpha CC' });
  assert.equal(clan, null);

  await restoreSeats();
});
