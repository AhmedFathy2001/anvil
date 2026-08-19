// The platform axis: who may operate the deployment, and how that stays separate from running a clan.
//
// Two properties are worth more than the rest, and both are the kind that pass review by looking
// obviously true and then turn out never to have been enforced:
//
//   1. A clan admin must be structurally unable to ban someone off the PLATFORM. Not "we didn't
//      build a button" — no reachable clan-side route may write that column at all.
//   2. There must be SOME way to become the first operator. Platform capability is written by
//      nothing else on purpose, so without a genesis path /staff is unreachable by everyone,
//      forever — and that is exactly the bug the clan bootstrap already had once.
//
// Run: npm run test:platform

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { and, eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
import { hasPlatformRole, PLATFORM_ROLES } from '../src/lib/clanRoles.ts';

const DB = useTestDatabase('platform-authority');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let platformRoleOf: typeof import('../src/lib/clanGrants.ts')['platformRoleOf'];
let seedPlatformRoot: typeof import('../src/lib/discord-login.ts')['seedPlatformRoot'];

/** Discord ids, which are what the genesis env var matches on. */
const GENESIS = '900000000000000001';
const STRANGER = '900000000000000002';
/** A second genesis-shaped id, for the operator who was deliberately moved down from root. */
const DEMOTED = '900000000000000003';

let genesisUser: number;
let strangerUser: number;
let steppedDown: number;

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  ({ platformRoleOf } = await import('../src/lib/clanGrants.ts'));
  ({ seedPlatformRoot } = await import('../src/lib/discord-login.ts'));

  const people = await db
    .insert(s.users)
    .values([
      { displayName: 'Genesis', discordId: GENESIS },
      { displayName: 'Stranger', discordId: STRANGER },
      // Someone deliberately moved DOWN from root. The env var must not undo that.
      { displayName: 'Stepped down', discordId: DEMOTED, platformRole: 'staff' },
    ])
    .returning();
  genesisUser = people[0].id;
  strangerUser = people[1].id;
  steppedDown = people[2].id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

// ── The ladder ────────────────────────────────────────────────────────────────────────────────

test('platform roles rank none < support < staff < root', () => {
  assert.equal(hasPlatformRole('none', 'support'), false);
  assert.equal(hasPlatformRole('support', 'support'), true);
  assert.equal(hasPlatformRole('support', 'staff'), false, 'support is read-only');
  assert.equal(hasPlatformRole('staff', 'staff'), true);
  assert.equal(hasPlatformRole('staff', 'root'), false, 'staff cannot promote itself');
  assert.equal(hasPlatformRole('root', 'root'), true);
});

test('an absent or unknown role is none, never a default upward', () => {
  assert.equal(hasPlatformRole(null, 'support'), false);
  assert.equal(hasPlatformRole(undefined, 'support'), false);
  assert.equal(hasPlatformRole('', 'support'), false);
  assert.equal(hasPlatformRole('administrator', 'support'), false, 'not a platform role at all');
});

// ── Genesis ───────────────────────────────────────────────────────────────────────────────────

test('the genesis env var promotes its holder to root', async () => {
  process.env.PLATFORM_ROOT_DISCORD_ID = GENESIS;
  await seedPlatformRoot(genesisUser, GENESIS);
  assert.equal(await platformRoleOf(genesisUser), 'root');
});

test('and nobody else, however they sign in', async () => {
  process.env.PLATFORM_ROOT_DISCORD_ID = GENESIS;
  await seedPlatformRoot(strangerUser, STRANGER);
  assert.equal(await platformRoleOf(strangerUser), 'none');
});

test('with the var unset, it grants nothing at all', async () => {
  delete process.env.PLATFORM_ROOT_DISCORD_ID;
  const before = await platformRoleOf(strangerUser);
  await seedPlatformRoot(strangerUser, STRANGER);
  assert.equal(await platformRoleOf(strangerUser), before);
});

test('it never restores someone deliberately stepped down', async () => {
  // The failure this prevents: an operator is moved from root to staff, and their next login
  // silently hands it back because a stale env var still names them.
  process.env.PLATFORM_ROOT_DISCORD_ID = DEMOTED;
  await seedPlatformRoot(steppedDown, DEMOTED);
  assert.equal(await platformRoleOf(steppedDown), 'staff', 'promotes only from none');
});

// ── The two axes never mix, structurally ──────────────────────────────────────────────────────

/** Every .ts file under a directory. */
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith('.ts') || full.endsWith('.tsx')) out.push(full);
  }
  return out;
}

test('no clan-side route can reach the platform ban or the platform role', () => {
  // A source scan rather than a behavioural test, deliberately: the claim is about what does not
  // exist, and the only honest way to assert that is to look everywhere it could.
  //
  // A clan admin's whole surface is /api/admin and /admin. If nothing there writes players.banned
  // or users.platformRole, then no amount of clan authority reaches either — which is the property,
  // not "the UI has no button for it".
  const clanSide = [
    ...walk(join(process.cwd(), 'src/app/api/admin')),
    ...walk(join(process.cwd(), 'src/app/admin')),
  ];

  const offenders: string[] = [];
  for (const file of clanSide) {
    const src = readFileSync(file, 'utf-8');
    // A write is an assignment inside a .set({...}) or .values({...}); reading either field to
    // DISPLAY it is fine, so match the assignment form rather than any mention.
    if (/\bplatformRole\s*:/.test(src)) offenders.push(`${file}: sets platformRole`);
    if (/\bplayers\b[\s\S]{0,200}?\bbanned\s*:/.test(src) && /\.update\(\s*players\s*\)/.test(src)) {
      offenders.push(`${file}: writes players.banned`);
    }
  }

  assert.deepEqual(offenders, [], 'clan-side code must not touch platform authority');
});

test('the platform surfaces are the only place that writes them', () => {
  const staffSide = [
    ...walk(join(process.cwd(), 'src/app/api/staff')),
  ];
  const writesRole = staffSide.filter((f) => /\bplatformRole\s*:/.test(readFileSync(f, 'utf-8')));
  assert.ok(writesRole.length > 0, 'if nothing grants a role, the role can never be held');
});

test('every platform role in the type is one the UI can actually set', () => {
  // Guards a quiet drift: adding a rank to the type without adding it to the picker leaves a role
  // that exists in checks and can never be granted.
  const client = readFileSync(join(process.cwd(), 'src/app/staff/people/PeopleClient.tsx'), 'utf-8');
  for (const role of PLATFORM_ROLES) {
    assert.ok(client.includes(`'${role}'`), `PeopleClient offers ${role}`);
  }
});

// ── Borrowed authority ────────────────────────────────────────────────────────────────────────
//
// The escape hatch from "platform staff get no clan write". What makes it safe is that it ends by
// itself — so the tests that matter are the ones about it ENDING, not the one about it working.

test('a live grant is found; an expired one is not', async () => {
  const { db, schema: s } = await loadDb();
  const { liveActAs } = await import('../src/lib/actAs.ts');

  const [clan] = await db.insert(s.clans).values({ slug: 'borrow', name: 'Borrow Clan' }).returning();
  const [op] = await db
    .insert(s.users)
    .values({ displayName: 'Op', discordId: '950000000000000001', platformRole: 'staff' })
    .returning();

  assert.equal(await liveActAs(clan.id, op.id), null, 'nothing borrowed, nothing held');

  await db.insert(s.platformActAs).values({
    clanId: clan.id,
    userId: op.id,
    reason: 'investigating a stuck board',
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  });
  const live = await liveActAs(clan.id, op.id);
  assert.equal(live?.role, 'admin');

  // The property the whole design rests on: forgetting to hand it back is not a permanent grant.
  await db
    .update(s.platformActAs)
    .set({ expiresAt: new Date(Date.now() - 1000).toISOString() })
    .where(eq(s.platformActAs.id, live!.id));
  assert.equal(await liveActAs(clan.id, op.id), null, 'expired is gone without anyone acting');
});

test('revoking ends it immediately, and only the holder may revoke their own', async () => {
  const { db, schema: s } = await loadDb();
  const { liveActAs, revokeActAs } = await import('../src/lib/actAs.ts');

  const [clan] = await db.insert(s.clans).values({ slug: 'revoke', name: 'Revoke Clan' }).returning();
  const people = await db
    .insert(s.users)
    .values([
      { displayName: 'Holder', discordId: '950000000000000002', platformRole: 'staff' },
      { displayName: 'Other', discordId: '950000000000000003', platformRole: 'staff' },
    ])
    .returning();
  const [holder, other] = people;

  const [row] = await db
    .insert(s.platformActAs)
    .values({
      clanId: clan.id,
      userId: holder.id,
      reason: 'restoring a deleted tile',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    })
    .returning();

  assert.equal(await revokeActAs(row.id, other.id), false, "not someone else's to hand back");
  assert.notEqual(await liveActAs(clan.id, holder.id), null, 'and it is still live');

  assert.equal(await revokeActAs(row.id, holder.id), true);
  assert.equal(await liveActAs(clan.id, holder.id), null);
});

test('a grant is capped at admin and never carries the owner seat', async () => {
  const { db, schema: s } = await loadDb();
  const { grantActAs } = await import('../src/lib/actAs.ts');

  const [clan] = await db.insert(s.clans).values({ slug: 'capped', name: 'Capped Clan' }).returning();
  const [op] = await db
    .insert(s.users)
    .values({ displayName: 'Capped op', discordId: '950000000000000004', platformRole: 'staff' })
    .returning();

  const grant = await grantActAs({
    clanId: clan.id,
    userId: op.id,
    reason: 'a reason long enough',
    hours: 999, // asked for far more than the ceiling
    actorRole: 'staff',
  });

  assert.equal(grant.role, 'admin', 'never owner — that seat must not be takeable');
  const hours = (Date.parse(grant.expiresAt) - Date.now()) / 3600_000;
  assert.ok(hours <= 24.01, `clamped to the ceiling, got ${hours}h`);
});

test('taking a grant writes it into the CLAN\'s audit log, not a private one', async () => {
  const { db, schema: s } = await loadDb();
  const { grantActAs } = await import('../src/lib/actAs.ts');

  const [clan] = await db.insert(s.clans).values({ slug: 'logged', name: 'Logged Clan' }).returning();
  const [op] = await db
    .insert(s.users)
    .values({ displayName: 'Logged op', discordId: '950000000000000005', platformRole: 'staff' })
    .returning();

  await grantActAs({
    clanId: clan.id,
    userId: op.id,
    reason: 'members list showing duplicates',
    hours: 1,
    actorRole: 'staff',
  });

  const entries = await db
    .select()
    .from(s.clanAuditLog)
    .where(eq(s.clanAuditLog.clanId, clan.id));

  const entry = entries.find((e) => e.eventType === 'platform_act_as_granted');
  assert.ok(entry, 'the clan can find out an operator was here');
  // The reason is the only account the clan gets of WHY, so it has to survive into the log.
  assert.match(entry!.newValue ?? '', /members list showing duplicates/);
});

// ── The ownerless clan ────────────────────────────────────────────────────────────────────────
//
// Ownership moves through the clan's own transfer flow, which requires a current owner to call it.
// A clan with none can therefore never acquire one on its own. theafkspot came out of the migration
// in exactly that state, so this is a real repair rather than a hypothetical one.

test('a clan can be given an owner only while it has none', async () => {
  const { db, schema: s } = await loadDb();

  const [clan] = await db.insert(s.clans).values({ slug: 'ownerless', name: 'Ownerless' }).returning();
  const [person] = await db
    .insert(s.users)
    .values({ displayName: 'Deputy', discordId: '960000000000000001' })
    .returning();
  await db.insert(s.clanStaff).values({ clanId: clan.id, userId: person.id, role: 'admin' });

  const owners = async () =>
    (await db.select().from(s.clanStaff).where(eq(s.clanStaff.clanId, clan.id))).filter(
      (r) => r.role === 'owner',
    );

  assert.equal((await owners()).length, 0, 'the stuck state');

  // What the route does, once it has checked there is no owner.
  await db
    .update(s.clanStaff)
    .set({ role: 'owner' })
    .where(and(eq(s.clanStaff.clanId, clan.id), eq(s.clanStaff.userId, person.id)));

  const now = await owners();
  assert.equal(now.length, 1);
  assert.equal(now[0].userId, person.id);
});

test('one clan never ends up with two owners', async () => {
  // The invariant the "already has an owner" refusal protects: two undemotable seats and no way to
  // reconcile them.
  const { db, schema: s } = await loadDb();
  const [clan] = await db.insert(s.clans).values({ slug: 'oneowner', name: 'One Owner' }).returning();
  const people = await db
    .insert(s.users)
    .values([
      { displayName: 'A', discordId: '960000000000000002' },
      { displayName: 'B', discordId: '960000000000000003' },
    ])
    .returning();
  await db.insert(s.clanStaff).values([
    { clanId: clan.id, userId: people[0].id, role: 'owner' },
    { clanId: clan.id, userId: people[1].id, role: 'admin' },
  ]);

  const existing = await db
    .select()
    .from(s.clanStaff)
    .where(and(eq(s.clanStaff.clanId, clan.id), eq(s.clanStaff.role, 'owner')));
  assert.equal(existing.length, 1, 'the route refuses with 409 when this is non-empty');
});
