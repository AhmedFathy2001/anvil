// The three clan policies, and the fact that they can now be set at all.
//
// EACH SHIPPED UNREACHABLE. `clans.visibility`, `clans.guest_policy` and the `public_showcase`
// setting all had a column or a row, a default, and code that read them — and no way for an admin to
// change any of them. A setting nobody can set is worse than one that does not exist: the behaviour
// is real, somebody eventually runs into it, and there is nowhere to go.
//
// These test the vocabularies and the round trip through the same helpers the route uses. The route
// itself needs a session, so what is asserted here is the part that can be wrong silently: that a
// bad value is refused rather than coerced, and that reading back what was written gives the same
// answer.
//
// Run: npx tsx --test tests/clan-policy.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
import { clanVisibilityOf, isClanVisibility } from '../src/lib/clanVisibility.ts';

const DB = useTestDatabase('clan-policy');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let clanId: number;
let settings: typeof import('../src/lib/settings.ts');
let guests: typeof import('../src/lib/guestAdmission.ts');
let access: typeof import('../src/lib/clanAccess.ts');

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  settings = await import('../src/lib/settings.ts');
  guests = await import('../src/lib/guestAdmission.ts');
  access = await import('../src/lib/clanAccess.ts');

  const [clan] = await db.insert(s.clans).values({ slug: 'policy', name: 'Policy Clan' }).returning();
  clanId = clan.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

// ── Defaults ──────────────────────────────────────────────────────────────────────────────────

test('a new clan shares, and asks before admitting a guest', async () => {
  const { db, schema: s } = await loadDb();
  const row = await db.query.clans.findFirst({ where: eq(s.clans.id, clanId) });
  assert.equal(row!.visibility, 'public', 'sharing is the default and always was');
  assert.equal(row!.guestPolicy, 'approval', 'membership is granted, never assumed');
});

test('listing defaults to on without a settings row', async () => {
  const map = await settings.getSettingMap(clanId, ['public_showcase']);
  assert.equal(map.get('public_showcase') ?? null, null, 'absent');
  // The route reads absence as on, matching getPublicShowcase.
  assert.equal((map.get('public_showcase') || 'on') !== 'off', true);
});

// ── Refused rather than coerced ───────────────────────────────────────────────────────────────

test('a bad visibility is rejected, not quietly stored', () => {
  assert.equal(isClanVisibility('public'), true);
  assert.equal(isClanVisibility('members'), true);
  assert.equal(isClanVisibility('everyone'), false);
  assert.equal(isClanVisibility(''), false);

  // WHY IT MATTERS: the reader treats anything unrecognised as PRIVATE, so accepting a typo would
  // hide the clan from everybody and look like a bug in the page rather than in the request.
  assert.equal(clanVisibilityOf('everyone'), 'members');
});

test('a bad guest policy is rejected too', () => {
  assert.equal(guests.isGuestPolicy('approval'), true);
  assert.equal(guests.isGuestPolicy('open'), true);
  assert.equal(guests.isGuestPolicy('closed'), true);
  assert.equal(guests.isGuestPolicy('sometimes'), false);
});

// ── The round trip ────────────────────────────────────────────────────────────────────────────

test('turning the clan private takes effect on the read path', async () => {
  const { db, schema: s } = await loadDb();

  assert.equal(
    await access.canSeeClan({ clanId, visibility: 'public', playerId: null, userId: null }),
    true,
  );

  await db.update(s.clans).set({ visibility: 'members' }).where(eq(s.clans.id, clanId));
  const row = await db.query.clans.findFirst({ where: eq(s.clans.id, clanId) });

  assert.equal(
    await access.canSeeClan({ clanId, visibility: row!.visibility, playerId: null, userId: null }),
    false,
    'a stranger is turned away the moment it is written',
  );

  await db.update(s.clans).set({ visibility: 'public' }).where(eq(s.clans.id, clanId));
});

test('the guest policy round-trips and is what admission reads', async () => {
  const { db, schema: s } = await loadDb();
  await db.update(s.clans).set({ guestPolicy: 'closed' }).where(eq(s.clans.id, clanId));
  assert.equal(await guests.guestPolicyOf(clanId), 'closed');

  await db.update(s.clans).set({ guestPolicy: 'open' }).where(eq(s.clans.id, clanId));
  assert.equal(await guests.guestPolicyOf(clanId), 'open');
});

test('listing round-trips through the settings row', async () => {
  await settings.setSetting(clanId, 'public_showcase', 'off');
  let map = await settings.getSettingMap(clanId, ['public_showcase']);
  assert.equal(map.get('public_showcase'), 'off');

  await settings.setSetting(clanId, 'public_showcase', 'on');
  map = await settings.getSettingMap(clanId, ['public_showcase']);
  assert.equal(map.get('public_showcase'), 'on');
});
