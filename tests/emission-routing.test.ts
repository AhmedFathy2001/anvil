// The emission matrix — one person, several relationships, one social notification, TWO-SIDED gates.
//
// The plan calls this "the probe that matters most for Part II", because a wrong answer here is a
// privacy failure that looks exactly like a working feature: an alt's pet quietly announced to a
// clan that was never told the alt exists. Both sides can say no, so the table is pinned rather than
// trusted to read correctly at the call site.
//
//   member clan       announces (default on); silenced only by an explicit per-clan off.
//   guest + shared    announces by default.
//   guest + unshared  announces NOWHERE but the member clan — the shared floor.
//   clan block        RECEIVER VETO — a clan that refuses guest noise gets none, whitelist or not.
//   user block        the person stops ALL guest emissions, except a whitelisted (account, clan).
//   whitelist         opts one clan back in, past the shared floor and the user block; and points an
//                     ALT at a clan its owner is a member of (even with no seat of its own there).
//
// Run: npx tsx --test tests/emission-routing.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('emission-routing');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let R: typeof import('../src/lib/emissionRouting.ts');

let clanMember: number; // account is a MEMBER here
let clanGuestA: number; // account guests here
let clanGuestB: number; // account guests here too
let clanStranger: number; // the person has NO seat here at all
let sharedAccount: number;
let unsharedAccount: number;
let seatlessAlt: number; // an alt with NO seat anywhere
let person: number;
let login: number;

async function seat(accountId: number, clanId: number, kind: 'member' | 'guest') {
  const { db, schema: s } = await loadDb();
  await db.insert(s.clanMemberships).values({ clanId, accountId, kind });
}
async function clearOverrides() {
  const { db, schema: s } = await loadDb();
  await db.delete(s.accountClanEmission);
  await db.update(s.users).set({ blockGuestEmissions: false }).where(eq(s.users.id, login));
  await db.delete(s.settings);
}

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  R = await import('../src/lib/emissionRouting.ts');

  const [m] = await db.insert(s.clans).values({ slug: 'home', name: 'Home', status: 'active' }).returning();
  const [ga] = await db.insert(s.clans).values({ slug: 'visita', name: 'Visit A', status: 'active' }).returning();
  const [gb] = await db.insert(s.clans).values({ slug: 'visitb', name: 'Visit B', status: 'active' }).returning();
  const [st] = await db.insert(s.clans).values({ slug: 'stranger', name: 'Stranger', status: 'active' }).returning();
  clanMember = m.id;
  clanGuestA = ga.id;
  clanGuestB = gb.id;
  clanStranger = st.id;

  const [pp] = await db.insert(s.players).values({ displayName: 'Player' }).returning();
  person = pp.id;
  const [u] = await db.insert(s.users).values({ playerId: pp.id, displayName: 'Player', discordId: 'p-1' }).returning();
  login = u.id;

  const [shared] = await db
    .insert(s.accounts)
    .values({ playerId: pp.id, rsn: 'Main', rsnNormalized: 'main', shared: true })
    .returning();
  sharedAccount = shared.id;
  await seat(sharedAccount, clanMember, 'member');
  await seat(sharedAccount, clanGuestA, 'guest');
  await seat(sharedAccount, clanGuestB, 'guest');

  const [alt] = await db
    .insert(s.accounts)
    .values({ playerId: pp.id, rsn: 'Iron', rsnNormalized: 'iron', shared: false })
    .returning();
  unsharedAccount = alt.id;
  await seat(unsharedAccount, clanMember, 'member');
  await seat(unsharedAccount, clanGuestA, 'guest');

  // A pure alt with NO seat anywhere — for the "point an alt at a clan you're a member of" case.
  const [pure] = await db
    .insert(s.accounts)
    .values({ playerId: pp.id, rsn: 'Pure', rsnNormalized: 'pure', shared: false })
    .returning();
  seatlessAlt = pure.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

function clanIds(list: { clanId: number }[]): number[] {
  return list.map((c) => c.clanId).sort((a, b) => a - b);
}

// ── Defaults ────────────────────────────────────────────────────────────────────────────────────

test('a shared account announces to its member clan and every clan it guests in', async () => {
  await clearOverrides();
  const targets = await R.socialEmissionClans(sharedAccount);
  assert.deepEqual(clanIds(targets), [clanMember, clanGuestA, clanGuestB].sort((a, b) => a - b));
  assert.equal(targets.find((t) => t.clanId === clanMember)!.kind, 'member');
});

test('a brand-new person is QUIET in guest clans, and loud in their own', async () => {
  // THE DEFAULT ITSELF, which the cases either side of it deliberately override. Sharing became the
  // default in drizzle/0080, and `shared` gates two different disclosures: who may SEE a character,
  // and which clans ANNOUNCE its drops. Left alone, flipping the first would have started posting
  // everybody's drops into every clan they had ever guested in — so users.block_guest_emissions
  // flipped with it. Nothing here is configured; this is what somebody gets for doing nothing.
  const { db, schema: s } = await loadDb();
  const [person] = await db.insert(s.players).values({ displayName: 'Fresh' }).returning();
  await db.insert(s.users).values({ playerId: person.id, displayName: 'Fresh', discordId: 'fresh-1' });
  const [acct] = await db
    .insert(s.accounts)
    .values({ playerId: person.id, rsn: 'Fresh One', rsnNormalized: 'fresh one' })
    .returning();
  assert.equal(acct.shared, true, 'sharing is the default');

  await db.insert(s.clanMemberships).values([
    { clanId: clanMember, accountId: acct.id, kind: 'member', source: 'roster' },
    { clanId: clanGuestA, accountId: acct.id, kind: 'guest', source: 'application' },
  ]);

  const targets = await R.socialEmissionClans(acct.id);
  assert.deepEqual(clanIds(targets), [clanMember], 'their own clan announces; the guest clan does not');
  assert.equal(targets[0].kind, 'member');
});

test('a clanless account routes to NO clan — not to whichever one addressed it', async () => {
  // The abuse this closes. /api/plugin/notify authenticates with verifyPluginTokenUser, which checks
  // only that the bearer token maps to a user — no seat, no membership. The route then fell back to
  // "post to the clan the URL named" whenever routing came back empty, which was harmless while the
  // plugin pointed at its own clan and became a cross-clan write the moment /c/<slug>/ made the URL
  // chooseable: any signed-in account with no seat could put body-supplied content into any clan's
  // Discord, 30 a minute.
  //
  // Routing is the whole answer now, so a person with no clan has no clan destination — their own
  // webhooks still fire, which is what a clanless player configured.
  const { db, schema: s } = await loadDb();
  const [person] = await db.insert(s.players).values({ displayName: 'Nomad' }).returning();
  await db.insert(s.users).values({ playerId: person.id, displayName: 'Nomad', discordId: 'nomad-1' });
  const [acct] = await db
    .insert(s.accounts)
    .values({ playerId: person.id, rsn: 'No Clan Here', rsnNormalized: 'no clan here' })
    .returning();

  assert.deepEqual(await R.socialEmissionClans(acct.id), [], 'no seats anywhere means no destinations');
});

test('an UNSHARED account announces to its member clan only', async () => {
  await clearOverrides();
  const targets = await R.socialEmissionClans(unsharedAccount);
  assert.deepEqual(clanIds(targets), [clanMember]);
  assert.equal(targets[0].kind, 'member');
});

// ── Per-clan silence ──────────────────────────────────────────────────────────────────────────

test('a per-clan OFF silences one guest clan and no other', async () => {
  await clearOverrides();
  const { db, schema: s } = await loadDb();
  await db.insert(s.accountClanEmission).values({ accountId: sharedAccount, clanId: clanGuestA, enabled: false });
  const targets = await R.socialEmissionClans(sharedAccount);
  assert.deepEqual(clanIds(targets), [clanMember, clanGuestB].sort((a, b) => a - b));
});

test('a per-clan OFF can silence even the MEMBER clan', async () => {
  await clearOverrides();
  const { db, schema: s } = await loadDb();
  await db.insert(s.accountClanEmission).values({ accountId: sharedAccount, clanId: clanMember, enabled: false });
  const targets = await R.socialEmissionClans(sharedAccount);
  assert.equal(targets.some((t) => t.clanId === clanMember), false);
});

// ── The user block + whitelist ────────────────────────────────────────────────────────────────

test('the user block stops ALL guest emissions — member clan still announces', async () => {
  await clearOverrides();
  const { db, schema: s } = await loadDb();
  await db.update(s.users).set({ blockGuestEmissions: true }).where(eq(s.users.id, login));
  const targets = await R.socialEmissionClans(sharedAccount);
  assert.deepEqual(clanIds(targets), [clanMember], 'guests silenced, home stays');
});

test('a whitelist opts one guest clan back in past the user block', async () => {
  await clearOverrides();
  const { db, schema: s } = await loadDb();
  await db.update(s.users).set({ blockGuestEmissions: true }).where(eq(s.users.id, login));
  await db.insert(s.accountClanEmission).values({ accountId: sharedAccount, clanId: clanGuestA, enabled: true });
  const targets = await R.socialEmissionClans(sharedAccount);
  assert.deepEqual(clanIds(targets), [clanMember, clanGuestA].sort((a, b) => a - b), 'A whitelisted back in, B stays blocked');
});

test('a whitelist opts an UNSHARED guest in — overriding the shared floor', async () => {
  await clearOverrides();
  const { db, schema: s } = await loadDb();
  // unsharedAccount guests in A; a whitelist announces it there despite shared=false.
  await db.insert(s.accountClanEmission).values({ accountId: unsharedAccount, clanId: clanGuestA, enabled: true });
  const targets = await R.socialEmissionClans(unsharedAccount);
  assert.deepEqual(clanIds(targets), [clanMember, clanGuestA].sort((a, b) => a - b));
});

// ── The clan receiver veto ──────────────────────────────────────────────────────────────────

test('a clan that blocks guest emissions gets none — even a shared account', async () => {
  await clearOverrides();
  const { db, schema: s } = await loadDb();
  await db.insert(s.settings).values({ clanId: clanGuestA, key: R.CLAN_BLOCK_GUEST_EMISSIONS_KEY, value: 'true' });
  const targets = await R.socialEmissionClans(sharedAccount);
  assert.deepEqual(clanIds(targets), [clanMember, clanGuestB].sort((a, b) => a - b), 'A refuses guests');
});

test('the clan veto beats a whitelist — the clan is refusing, and it is its channel', async () => {
  await clearOverrides();
  const { db, schema: s } = await loadDb();
  await db.insert(s.settings).values({ clanId: clanGuestA, key: R.CLAN_BLOCK_GUEST_EMISSIONS_KEY, value: 'true' });
  await db.insert(s.accountClanEmission).values({ accountId: sharedAccount, clanId: clanGuestA, enabled: true });
  const targets = await R.socialEmissionClans(sharedAccount);
  assert.equal(targets.some((t) => t.clanId === clanGuestA), false, 'whitelist cannot override the receiver');
});

test('the clan veto does NOT affect that clan’s own members', async () => {
  await clearOverrides();
  const { db, schema: s } = await loadDb();
  // Home blocks guest emissions; the account is a MEMBER of Home, so it is unaffected.
  await db.insert(s.settings).values({ clanId: clanMember, key: R.CLAN_BLOCK_GUEST_EMISSIONS_KEY, value: 'true' });
  const targets = await R.socialEmissionClans(sharedAccount);
  assert.equal(targets.some((t) => t.clanId === clanMember && t.kind === 'member'), true);
});

// ── The seatless alt ──────────────────────────────────────────────────────────────────────────

test('a whitelisted alt announces to a clan its OWNER is a member of, with no seat of its own', async () => {
  await clearOverrides();
  const { db, schema: s } = await loadDb();
  // The pure alt has no seat anywhere; the person is a member of Home (via Main). Whitelist it there.
  await db.insert(s.accountClanEmission).values({ accountId: seatlessAlt, clanId: clanMember, enabled: true });
  const targets = await R.socialEmissionClans(seatlessAlt);
  assert.deepEqual(clanIds(targets), [clanMember], 'the alt reaches the owner’s member clan');
});

test('a whitelisted alt CANNOT be pointed at a clan its owner is not a member of', async () => {
  await clearOverrides();
  const { db, schema: s } = await loadDb();
  // Whitelist the pure alt to a clan the person has no member seat in — must be refused.
  await db.insert(s.accountClanEmission).values({ accountId: seatlessAlt, clanId: clanStranger, enabled: true });
  const targets = await R.socialEmissionClans(seatlessAlt);
  assert.equal(targets.length, 0, 'no member connection → no emission, whitelist or not');
});

// ── Seats ─────────────────────────────────────────────────────────────────────────────────────

test('a departed seat is not a destination', async () => {
  await clearOverrides();
  const { db, schema: s } = await loadDb();
  await db.update(s.clanMemberships).set({ leftAt: new Date().toISOString() }).where(eq(s.clanMemberships.clanId, clanGuestB));
  const targets = await R.socialEmissionClans(sharedAccount);
  assert.equal(targets.some((t) => t.clanId === clanGuestB), false);
  await db.update(s.clanMemberships).set({ leftAt: null }).where(eq(s.clanMemberships.clanId, clanGuestB));
});

// ── Personal webhooks ───────────────────────────────────────────────────────────────────────────

test('a personal webhook receives only the kinds it asked for', async () => {
  const { db, schema: s } = await loadDb();
  await db.delete(s.userWebhooks).where(eq(s.userWebhooks.userId, login));
  await db.insert(s.userWebhooks).values({ userId: login, url: 'https://d.example/a', kinds: '["rareDrops","deaths"]' });
  assert.deepEqual((await R.personalWebhookTargets(login, 'rareDrops')).map((t) => t.url), ['https://d.example/a']);
  assert.deepEqual((await R.personalWebhookTargets(login, 'deaths')).map((t) => t.url), ['https://d.example/a']);
  assert.deepEqual(await R.personalWebhookTargets(login, 'pvpKills'), []);
});

test('min_rarity gates the drop-shaped kinds, and only when a value is known', async () => {
  const { db, schema: s } = await loadDb();
  await db.delete(s.userWebhooks).where(eq(s.userWebhooks.userId, login));
  await db.insert(s.userWebhooks).values({ userId: login, url: 'https://d.example/big', kinds: '["rareDrops"]', minRarity: 1_000_000 });
  assert.deepEqual((await R.personalWebhookTargets(login, 'rareDrops', 5_000_000)).map((t) => t.url), ['https://d.example/big']);
  assert.deepEqual(await R.personalWebhookTargets(login, 'rareDrops', 50_000), []);
  assert.deepEqual((await R.personalWebhookTargets(login, 'rareDrops')).map((t) => t.url), ['https://d.example/big']);
});

test('a corrupt kinds column is read as "wants nothing", not a crash', () => {
  assert.deepEqual(R.parseKinds('not json'), []);
  assert.deepEqual(R.parseKinds('{"rareDrops":true}'), []);
  assert.deepEqual(R.parseKinds('["rareDrops",5,"deaths"]'), ['rareDrops', 'deaths']);
  assert.deepEqual(R.parseKinds(null), []);
});
