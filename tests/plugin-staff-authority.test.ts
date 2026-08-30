// May this plugin token write this clan's roster?
//
// It used to ask `users.role === 'admin'` — one global column, on a deployment that serves every
// clan. That is wrong in both directions at once, and this suite pins both.
//
// Too narrow: a clan created on the platform gets `clan_staff.role = 'owner'` and leaves
// `users.role` at 'member', so every clan owner but the genesis account was refused. Roster sync is
// the only path to membership AND to in-game verification, so those clans could not get their
// members in at all — a launch blocker rather than a papercut.
//
// Too wide: anybody who DID hold the global role was, as far as that check went, an admin of every
// clan on the deployment.
//
// The answer is the one the web session already uses: a `clan_staff` grant in THIS clan, or an
// operator's temporary act-as grant. Two answers to one authority question, differing by which
// client asked, is a model with a hole in it.
//
// Run: npx tsx --test tests/plugin-staff-authority.test.ts

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('plugin-staff-authority');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let A: typeof import('../src/lib/auth.ts');

let alpha: number;
let bravo: number;

const iso = (hoursFromNow: number) => new Date(Date.now() + hoursFromNow * 3_600_000).toISOString();

/** A login with a plugin token. `role` is the DEPRECATED global column — set only to prove it is ignored. */
async function person(
  handle: string,
  opts: { role?: string; platformRole?: string } = {},
): Promise<{ userId: number; token: string }> {
  const [p] = await db.insert(s.players).values({ displayName: handle }).returning();
  const token = `tok-${handle}`;
  const [u] = await db
    .insert(s.users)
    .values({
      displayName: handle,
      discordId: `disc-${handle}`,
      pluginToken: token,
      playerId: p.id,
      ...(opts.role ? { role: opts.role } : {}),
      ...(opts.platformRole ? { platformRole: opts.platformRole } : {}),
    })
    .returning();
  return { userId: u.id, token };
}

async function staff(clanId: number, userId: number, role: string) {
  await db.insert(s.clanStaff).values({ clanId, userId, role });
}

function req(token: string | null, host = 'anvilosrs.com', path = '/api/plugin/clan-sync') {
  return new Request(`https://${host}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}`, host } : { host },
  });
}

before(async () => {
  await resetDatabase(DB);
  const loaded = await loadDb();
  pool = loaded.pool;
  db = loaded.db;
  s = loaded.schema;
  A = await import('../src/lib/auth.ts');
});

beforeEach(async () => {
  await db.delete(s.platformActAs);
  await db.delete(s.clanStaff);
  await db.delete(s.pluginLinks);
  await db.delete(s.users);
  await db.delete(s.players);
  await db.delete(s.clans);
  const made = await db
    .insert(s.clans)
    .values([
      { slug: 'alpha', name: 'Alpha', inGameName: 'Alpha CC' },
      { slug: 'bravo', name: 'Bravo', inGameName: 'Bravo CC' },
    ])
    .returning();
  [alpha, bravo] = made.map((c) => c.id);
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

// ── The launch blocker ─────────────────────────────────────────────────────────────────────────

test('a clan OWNER can sync their roster, with no global role at all', async () => {
  // The exact shape lib/clanCreate produces: an owner grant, and users.role left at its default.
  const owner = await person('owner');
  await staff(alpha, owner.userId, 'owner');

  const row = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, owner.userId) });
  assert.equal(row?.role, 'member', 'this is the state a newly created clan leaves its owner in');

  assert.equal(await A.pluginClanAuthority(alpha, owner.userId, 'admin'), true);
});

test('a clan admin can too', async () => {
  const admin = await person('admin');
  await staff(alpha, admin.userId, 'admin');
  assert.equal(await A.pluginClanAuthority(alpha, admin.userId, 'admin'), true);
});

// ── The over-grant, in the other direction ─────────────────────────────────────────────────────

test('the deprecated global role grants nothing on its own', async () => {
  // An imported production admin carries users.role = 'admin'. It must buy them nothing here.
  const legacy = await person('legacy', { role: 'admin' });
  assert.equal(await A.pluginClanAuthority(alpha, legacy.userId, 'admin'), false);
  assert.equal(await A.pluginClanAuthority(bravo, legacy.userId, 'admin'), false);
  assert.equal(await A.staffsAnyClan(legacy.userId, 'admin'), false);
});

test('admin of one clan is admin of exactly one clan', async () => {
  const admin = await person('admin');
  await staff(alpha, admin.userId, 'admin');
  assert.equal(await A.pluginClanAuthority(alpha, admin.userId, 'admin'), true);
  assert.equal(await A.pluginClanAuthority(bravo, admin.userId, 'admin'), false);
});

// ── Where the line sits ────────────────────────────────────────────────────────────────────────

test('a moderator is staff but not an admin, so the roster is not theirs to rewrite', async () => {
  const mod = await person('mod');
  await staff(alpha, mod.userId, 'moderator');
  assert.equal(await A.pluginClanAuthority(alpha, mod.userId, 'admin'), false);
  // …and the sync button must not appear for them either.
  assert.equal(await A.staffsAnyClan(mod.userId, 'admin'), false);
  // The tier itself is real, just lower.
  assert.equal(await A.pluginClanAuthority(alpha, mod.userId, 'moderator'), true);
});

test('a treasurer ties with a moderator rather than outranking one', async () => {
  const t = await person('treasurer');
  await staff(alpha, t.userId, 'treasurer');
  assert.equal(await A.pluginClanAuthority(alpha, t.userId, 'admin'), false);
});

test('an ordinary member with no grant is refused', async () => {
  const nobody = await person('nobody');
  assert.equal(await A.pluginClanAuthority(alpha, nobody.userId, 'admin'), false);
  assert.equal(await A.staffsAnyClan(nobody.userId, 'admin'), false);
});

// ── The operator exception, same shape as the web session's ────────────────────────────────────

test('an operator with a live act-as grant may act, and only while it lives', async () => {
  const op = await person('operator', { platformRole: 'operator' });
  assert.equal(await A.pluginClanAuthority(alpha, op.userId, 'admin'), false, 'platform role alone is not clan authority');

  const [grant] = await db
    .insert(s.platformActAs)
    .values({ clanId: alpha, userId: op.userId, role: 'admin', reason: 'fixing a stuck sync', expiresAt: iso(1) })
    .returning();
  assert.equal(await A.pluginClanAuthority(alpha, op.userId, 'admin'), true);
  assert.equal(await A.pluginClanAuthority(bravo, op.userId, 'admin'), false, 'the grant names one clan');

  const { eq } = await import('drizzle-orm');
  await db.update(s.platformActAs).set({ revokedAt: new Date().toISOString() }).where(eq(s.platformActAs.id, grant.id));
  assert.equal(await A.pluginClanAuthority(alpha, op.userId, 'admin'), false, 'revoked');
});

test('an expired grant is dead even though nobody revoked it — that is the point of it', async () => {
  const op = await person('operator', { platformRole: 'operator' });
  await db
    .insert(s.platformActAs)
    .values({ clanId: alpha, userId: op.userId, role: 'admin', reason: 'yesterday', expiresAt: iso(-1) });
  assert.equal(await A.pluginClanAuthority(alpha, op.userId, 'admin'), false);
});

test('a real grant is read before any borrowed one is looked for', async () => {
  // Somebody who is BOTH an operator and genuinely staff here holds what the clan gave them.
  const both = await person('both', { platformRole: 'operator' });
  await staff(alpha, both.userId, 'moderator');
  await db
    .insert(s.platformActAs)
    .values({ clanId: alpha, userId: both.userId, role: 'admin', reason: 'ignored', expiresAt: iso(1) });
  assert.equal(
    await A.pluginClanAuthority(alpha, both.userId, 'admin'),
    false,
    'the clan said moderator; an act-as grant must not quietly overrule what the clan decided',
  );
});

// ── Who is asking ──────────────────────────────────────────────────────────────────────────────

test('the account token names its person and says nothing about authority', async () => {
  const p = await person('someone');
  assert.deepEqual(await A.pluginTokenPerson(req(p.token)), { userId: p.userId });
});

test('no token, an unknown token, and a malformed header all name nobody', async () => {
  await person('someone');
  assert.equal(await A.pluginTokenPerson(req(null)), null);
  assert.equal(await A.pluginTokenPerson(req('not-a-real-token')), null);
  assert.equal(
    await A.pluginTokenPerson(
      new Request('https://anvilosrs.com/api/plugin/clan-sync', { headers: { Authorization: 'Bearer   ' } }),
    ),
    null,
  );
});

test('a legacy link token still names its person, and a revoked one names nobody', async () => {
  const p = await person('legacyinstall');
  await db.insert(s.pluginLinks).values({ userId: p.userId, token: 'legacy-token' });
  assert.deepEqual(await A.pluginTokenPerson(req('legacy-token')), { userId: p.userId });

  const { eq } = await import('drizzle-orm');
  await db
    .update(s.pluginLinks)
    .set({ revokedAt: new Date().toISOString() })
    .where(eq(s.pluginLinks.token, 'legacy-token'));
  assert.equal(await A.pluginTokenPerson(req('legacy-token')), null);
});

test('a legacy token carries no authority of its own either', async () => {
  // It used to be accepted only for a global admin, so the token itself read as an admin credential.
  // Now it identifies somebody, and that somebody has to hold a grant like anyone else.
  const p = await person('legacyinstall', { role: 'admin' });
  await db.insert(s.pluginLinks).values({ userId: p.userId, token: 'legacy-token' });

  const who = await A.pluginTokenPerson(req('legacy-token'));
  assert.ok(who);
  assert.equal(await A.pluginClanAuthority(alpha, who.userId, 'admin'), false);

  await staff(alpha, p.userId, 'admin');
  assert.equal(await A.pluginClanAuthority(alpha, who.userId, 'admin'), true);
});

// ── The "show the button?" probe ───────────────────────────────────────────────────────────────

test('staff anywhere is enough to offer the button, because the push names its own clan', async () => {
  const admin = await person('admin');
  await staff(bravo, admin.userId, 'admin');
  // Nothing in alpha at all, but the button should still appear: the roster they push will name
  // bravo, and THAT is what the write is authorised against.
  assert.equal(await A.staffsAnyClan(admin.userId, 'admin'), true);
  assert.equal(await A.pluginClanAuthority(alpha, admin.userId, 'admin'), false);
});

test('an owner counts as staff for the probe, since owner outranks admin', async () => {
  const owner = await person('owner');
  await staff(alpha, owner.userId, 'owner');
  assert.equal(await A.staffsAnyClan(owner.userId, 'admin'), true);
});
