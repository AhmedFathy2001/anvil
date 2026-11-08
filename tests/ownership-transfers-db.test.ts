// Clan ownership transfer requests against a real database (lib/ownershipTransfers).
//
// What must hold: only the owner asks, and only for an admin with a verified login; one pending per
// clan; nothing moves before the hold runs out; the tick moves it with the seats and the row in one
// step, once; the owner cancels, the target declines, staff block — each only on their own clan's
// request; a target who lost admin makes it lapse; both people get a notice at each step and every
// step is in the clan's audit log.
//
// Run: TEST_DATABASE_URL=... npx tsx --test tests/ownership-transfers-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('ownership-transfers');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let T: typeof import('../src/lib/ownershipTransfers.ts');

const HOUR = 3_600_000;
const t0 = Date.parse('2026-11-08T12:00:00.000Z');
const dms: { userId: number; title: string }[] = [];
let n = 0;

async function person(name: string, verified = true) {
  n++;
  const [u] = await db
    .insert(s.users)
    .values({ displayName: name, discordId: verified ? `1000000000000000${n.toString().padStart(2, '0')}` : `lab-${name}` })
    .returning();
  return u.id;
}
async function clanWith(slug: string) {
  const [c] = await db.insert(s.clans).values({ slug, name: slug.toUpperCase() }).returning();
  return c.id;
}
async function grant(clanId: number, userId: number, role: string) {
  await db.insert(s.clanStaff).values({ clanId, userId, role });
}
async function roleOf(clanId: number, userId: number) {
  const row = await db.query.clanStaff.findFirst({ where: and(eq(s.clanStaff.clanId, clanId), eq(s.clanStaff.userId, userId)) });
  return row?.role ?? null;
}
async function auditTypes(clanId: number) {
  const rows = await db.select().from(s.clanAuditLog).where(eq(s.clanAuditLog.clanId, clanId));
  return rows.map((r) => r.eventType);
}
async function noticesOf(userId: number) {
  return db.select().from(s.userNotices).where(eq(s.userNotices.userId, userId));
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  T = await import('../src/lib/ownershipTransfers.ts');
  T.transferDeps.dm = async (userId, msg) => {
    dms.push({ userId, title: msg.title });
    return true;
  };
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('ask, wait out the hold, and the tick moves it once', async () => {
  const clan = await clanWith('alpha');
  const own = await person('Owner');
  const adm = await person('Admin');
  const mod = await person('Mod');
  await grant(clan, own, 'owner');
  await grant(clan, adm, 'admin');
  await grant(clan, mod, 'moderator');

  // Not the owner; not an admin; yourself.
  assert.equal((await T.requestOwnershipTransfer({ clanId: clan, fromUserId: adm, toUserId: own, nowMs: t0 })).ok, false);
  const toMod = await T.requestOwnershipTransfer({ clanId: clan, fromUserId: own, toUserId: mod, nowMs: t0 });
  assert.equal(!toMod.ok && toMod.status, 400);
  assert.equal((await T.requestOwnershipTransfer({ clanId: clan, fromUserId: own, toUserId: own, nowMs: t0 })).ok, false);

  const r = await T.requestOwnershipTransfer({ clanId: clan, fromUserId: own, toUserId: adm, nowMs: t0 });
  assert.ok(r.ok);
  assert.equal(r.transfer.completesAt, '2026-11-11T12:00:00.000Z');
  // One pending per clan.
  const again = await T.requestOwnershipTransfer({ clanId: clan, fromUserId: own, toUserId: adm, nowMs: t0 + 1 });
  assert.equal(!again.ok && again.status, 409);

  // Both told; staff queue sees it.
  assert.equal((await noticesOf(own)).length, 1);
  assert.equal((await noticesOf(adm)).length, 1);
  assert.equal(await T.unreviewedTransferCount(), 1);
  assert.equal((await T.pendingTransferForClan(clan))?.toName, 'Admin');

  // Nothing moves before the hold runs out.
  assert.equal(await T.settleOwnershipTransfers(t0 + 71 * HOUR), 0);
  assert.equal(await roleOf(clan, own), 'owner');

  assert.equal(await T.settleOwnershipTransfers(t0 + 72 * HOUR), 1);
  assert.equal(await roleOf(clan, own), 'admin');
  assert.equal(await roleOf(clan, adm), 'owner');
  // Idempotent: a second tick does nothing.
  assert.equal(await T.settleOwnershipTransfers(t0 + 73 * HOUR), 0);
  assert.equal(await roleOf(clan, adm), 'owner');
  assert.equal(await T.pendingTransferForClan(clan), null);

  const types = await auditTypes(clan);
  assert.ok(types.includes('ownership_transfer_requested'));
  assert.ok(types.includes('ownership_transferred'));
  assert.equal((await noticesOf(own)).length, 2);
  assert.equal((await noticesOf(adm)).length, 2);
  assert.ok(dms.some((d) => d.userId === adm && /now owns/.test(d.title)));
});

test('the owner cancels, the target declines, staff block — each on their own clan only', async () => {
  const clan = await clanWith('beta');
  const other = await clanWith('gamma');
  const own = await person('BOwner');
  const adm = await person('BAdmin');
  const stranger = await person('GOwner');
  const staffer = await person('Staffer');
  await grant(clan, own, 'owner');
  await grant(clan, adm, 'admin');
  await grant(other, stranger, 'owner');

  assert.ok((await T.requestOwnershipTransfer({ clanId: clan, fromUserId: own, toUserId: adm, nowMs: t0 })).ok);
  // The target cannot cancel; the owner cannot decline; another clan's owner sees nothing to cancel.
  assert.equal((await T.actOnOwnershipTransfer({ action: 'cancel', actorUserId: adm, isPlatformStaff: false, clanId: clan })).ok, false);
  assert.equal((await T.actOnOwnershipTransfer({ action: 'decline', actorUserId: own, isPlatformStaff: false, clanId: clan })).ok, false);
  const cross = await T.actOnOwnershipTransfer({ action: 'cancel', actorUserId: stranger, isPlatformStaff: false, clanId: other });
  assert.equal(!cross.ok && cross.status, 404);
  // A clan admin is not platform staff.
  assert.equal((await T.actOnOwnershipTransfer({ action: 'block', actorUserId: own, isPlatformStaff: false, clanId: clan })).ok, false);

  const c = await T.actOnOwnershipTransfer({ action: 'cancel', actorUserId: own, isPlatformStaff: false, clanId: clan, nowMs: t0 + HOUR });
  assert.ok(c.ok && c.transfer.status === 'cancelled');
  assert.equal(await T.settleOwnershipTransfers(t0 + 100 * HOUR), 0);
  assert.equal(await roleOf(clan, own), 'owner');

  // Ask again: the target declines.
  assert.ok((await T.requestOwnershipTransfer({ clanId: clan, fromUserId: own, toUserId: adm, nowMs: t0 })).ok);
  const d = await T.actOnOwnershipTransfer({ action: 'decline', actorUserId: adm, isPlatformStaff: false, clanId: clan });
  assert.ok(d.ok && d.transfer.status === 'declined');

  // Ask again: staff let it through (still pending), then block it with a reason.
  const r = await T.requestOwnershipTransfer({ clanId: clan, fromUserId: own, toUserId: adm, nowMs: t0 });
  assert.ok(r.ok);
  const cl = await T.actOnOwnershipTransfer({ action: 'clear', actorUserId: staffer, isPlatformStaff: true, clanId: null, transferId: r.transfer.id });
  assert.ok(cl.ok && cl.transfer.status === 'pending' && cl.transfer.staffClearedAt);
  assert.equal(await T.unreviewedTransferCount(), 0);
  const b = await T.actOnOwnershipTransfer({ action: 'block', actorUserId: staffer, isPlatformStaff: true, clanId: null, transferId: r.transfer.id, reason: 'Owner login reported stolen' });
  assert.ok(b.ok && b.transfer.status === 'blocked' && b.transfer.reason === 'Owner login reported stolen');
  assert.equal(await T.settleOwnershipTransfers(t0 + 100 * HOUR), 0);
  assert.equal(await roleOf(clan, own), 'owner');

  const types = await auditTypes(clan);
  for (const t of ['ownership_transfer_cancelled', 'ownership_transfer_declined', 'ownership_transfer_blocked', 'platform_ownership_transfer_blocked', 'platform_ownership_transfer_cleared']) {
    assert.ok(types.includes(t), t);
  }
  assert.ok((await noticesOf(adm)).some((x) => /stopped/.test(x.title)));
});

test('a target who lost admin, or never verified, makes it lapse instead of moving', async () => {
  const clan = await clanWith('delta');
  const own = await person('DOwner');
  const adm = await person('DAdmin');
  await grant(clan, own, 'owner');
  await grant(clan, adm, 'admin');
  assert.ok((await T.requestOwnershipTransfer({ clanId: clan, fromUserId: own, toUserId: adm, nowMs: t0 })).ok);
  await db.update(s.clanStaff).set({ role: 'moderator' }).where(and(eq(s.clanStaff.clanId, clan), eq(s.clanStaff.userId, adm)));

  assert.equal(await T.settleOwnershipTransfers(t0 + 72 * HOUR), 0);
  assert.equal(await roleOf(clan, own), 'owner');
  assert.equal(await roleOf(clan, adm), 'moderator');
  const [row] = await db.select().from(s.clanOwnershipTransfers).where(eq(s.clanOwnershipTransfers.clanId, clan));
  assert.equal(row.status, 'cancelled');
  assert.match(row.reason ?? '', /no longer an admin/);
  assert.ok((await auditTypes(clan)).includes('ownership_transfer_lapsed'));

  // A target with no real Discord login can't be asked for at all.
  const lab = await person('LabAdmin', false);
  await grant(clan, lab, 'admin');
  const r = await T.requestOwnershipTransfer({ clanId: clan, fromUserId: own, toUserId: lab, nowMs: t0 });
  assert.equal(!r.ok && r.status, 400);
});
