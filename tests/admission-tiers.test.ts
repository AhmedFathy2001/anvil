// The three ways in, end to end against a real database and the real routes.
//
//   plugin  the plugin reported the character (or staff confirmed it): joins at once.
//   xp      the XP check passed: the same for the person, flagged in the clan's Needs review list.
//   manual  asked the clan's staff to vouch: admitted, but held (a pending entry with no team)
//           until staff vouch.
//
// A member seat only ever comes from the in-game list; every seat made here is a guest seat.
//
// Run: npm run test:admission

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
import { callRoute } from './helpers/routeCall.ts';

const DB = useTestDatabase('admission-tiers');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let E: typeof import('../src/lib/eventEntry.ts');
let C: typeof import('../src/lib/accountClaim.ts');
let applyRoute: typeof import('../src/app/api/clans/[slug]/apply/route.ts');
let manualRoute: typeof import('../src/app/api/auth/request-manual-review/route.ts');
let signupRoute: typeof import('../src/app/api/events/[eventId]/signup/route.ts');
let verifyRoute: typeof import('../src/app/api/admin/verifications/[id]/route.ts');

let host: number;
let staffUser: number;
let n = 0;
const day = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

type Tier = 'plugin' | 'xp' | 'manual' | 'none';

/** A brand-new Discord login, with a character that came in by `tier` (or no character at all). */
async function newcomer(tier: Tier, rsn = `Rsn${++n}`) {
  n++;
  const [p] = await db.insert(s.players).values({ displayName: `person-${n}` }).returning();
  const [u] = await db.insert(s.users).values({ displayName: `person-${n}`, discordId: `77${String(n).padStart(15, '0')}`, playerId: p.id }).returning();
  let accountId = 0;
  if (tier !== 'none') {
    const now = new Date().toISOString();
    const proof =
      tier === 'plugin'
        ? { verifiedAt: now, provisional: 0, verificationMethod: 'plugin' }
        : tier === 'xp'
          ? { verifiedAt: now, provisional: 1, verificationMethod: 'stat_delta' }
          : { verifiedAt: null, provisional: 1, verificationMethod: 'manual' };
    const [a] = await db
      .insert(s.accounts)
      .values({ playerId: p.id, rsn, rsnNormalized: rsn.toLowerCase(), claimedAt: now, isPrimary: 1, ...proof })
      .returning();
    accountId = a.id;
  }
  return { playerId: p.id, userId: u.id, accountId, rsn };
}

async function clan(slug: string, extra: Partial<typeof s.clans.$inferInsert> = {}) {
  const [c] = await db.insert(s.clans).values({ slug, name: slug, ...extra }).returning();
  return c.id;
}

async function event(clanId: number, name: string, extra: Partial<typeof s.events.$inferInsert> = {}) {
  const [e] = await db
    .insert(s.events)
    .values({ clanId, name, boardSize: 25, visibility: 'public', entry: 'open', startDate: day(7), endDate: day(14), ...extra })
    .returning();
  const [t] = await db.insert(s.teams).values({ eventId: e.id, name: `${name} team`, color: '#aa0000' }).returning();
  return { id: e.id, teamId: t.id };
}

const ALPHABET = 'abcdefghijkmnopqrstuvwxyz23456789';
async function invite(ev: { id: number; teamId: number }, extra: Partial<typeof s.teamInvites.$inferInsert> = {}) {
  n++;
  // Sixteen characters of the invite alphabet, different for every call.
  let token = '';
  for (let i = 0, v = n; i < 16; i++, v = Math.floor(v / ALPHABET.length)) token += ALPHABET[v % ALPHABET.length];
  await db.insert(s.teamInvites).values({ token, teamId: ev.teamId, eventId: ev.id, ...extra });
  return token;
}

const seatOf = async (clanId: number, accountId: number) =>
  (await db.select().from(s.clanMemberships).where(and(eq(s.clanMemberships.clanId, clanId), eq(s.clanMemberships.accountId, accountId))))[0];
const accountRow = async (id: number) => (await db.select().from(s.accounts).where(eq(s.accounts.id, id)))[0];
const requestsOf = async (clanId: number, accountId: number) =>
  db.select().from(s.clanJoinRequests).where(and(eq(s.clanJoinRequests.clanId, clanId), eq(s.clanJoinRequests.accountId, accountId)));
const signupsOf = async (eventId: number, userId: number) =>
  db.select().from(s.eventSignups).where(and(eq(s.eventSignups.eventId, eventId), eq(s.eventSignups.userId, userId)));
const boardRow = async (eventId: number, accountId: number) =>
  (await db.select().from(s.eventParticipants).where(and(eq(s.eventParticipants.eventId, eventId), eq(s.eventParticipants.accountId, accountId))))[0];

const apply = (slug: string, who: { userId: number; accountId: number }) =>
  callRoute(applyRoute.POST, { userId: who.userId, params: { slug }, body: { accountId: who.accountId } });
const askStaff = (who: { userId: number }, rsn: string, slug: string | null = 'host') =>
  callRoute(manualRoute.POST, { userId: who.userId, body: { rsn, ...(slug ? { clan: `/c/${slug}` } : {}) } });
const signUp = (slug: string, eventId: number, who: { userId: number }, seatId: number, inviteToken?: string) =>
  callRoute(signupRoute.POST, { userId: who.userId, slug, params: { eventId: String(eventId) }, body: { clanMemberIds: [seatId], inviteToken } });
const review = (seatId: number, action: 'approve' | 'not_member') =>
  callRoute(verifyRoute.POST, { userId: staffUser, slug: 'host', params: { id: String(seatId) }, body: { action } });
const enter = (eventId: number, who: { playerId: number; userId: number; accountId: number }, inviteToken?: string) =>
  E.enterEvent({ eventId, playerId: who.playerId, accountId: who.accountId, actorUserId: who.userId, inviteToken });

/** Through the door and onto the form, as the pages do it: enter (with the invite), then sign up. */
async function joinByInvite(slug: string, ev: { id: number; teamId: number }, who: Awaited<ReturnType<typeof newcomer>>, token: string) {
  const entered = await enter(ev.id, who, token);
  if (entered.outcome !== 'seated') return { entered, signed: null };
  return { entered, signed: await signUp(slug, ev.id, who, entered.seatId, token) };
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  E = await import('../src/lib/eventEntry.ts');
  C = await import('../src/lib/accountClaim.ts');
  applyRoute = await import('../src/app/api/clans/[slug]/apply/route.ts');
  manualRoute = await import('../src/app/api/auth/request-manual-review/route.ts');
  signupRoute = await import('../src/app/api/events/[eventId]/signup/route.ts');
  verifyRoute = await import('../src/app/api/admin/verifications/[id]/route.ts');

  host = await clan('host');
  await clan('shut', { guestPolicy: 'closed' });
  const staff = await newcomer('none');
  staffUser = staff.userId;
  await db.insert(s.clanStaff).values({ clanId: host, userId: staffUser, role: 'moderator' });
});

after(async () => {
  // Let the fire-and-forget writes (starting stats, audit lines) land before the pool closes.
  await new Promise((r) => setTimeout(r, 500));
  await pool.end();
  await dropDatabase(DB);
});

// ── Applying to a clan ────────────────────────────────────────────────────────────────────────

test('plugin tier: applying gives a guest seat at once, with nothing for staff to review', async () => {
  const who = await newcomer('plugin');
  const r = await apply('host', who);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.seated, true);
  const seat = await seatOf(host, who.accountId);
  assert.equal(seat.kind, 'guest', 'a web application is never a member seat');
  assert.equal(seat.leftAt, null);
  assert.equal((await accountRow(who.accountId)).provisional, 0, 'not in Needs review');
  assert.equal((await requestsOf(host, who.accountId)).length, 0, 'no request for staff to answer');
});

test('xp tier: the same guest seat at once, and the character stays flagged for review', async () => {
  const who = await newcomer('xp');
  const r = await apply('host', who);
  assert.equal(r.json.seated, true, JSON.stringify(r.json));
  const seat = await seatOf(host, who.accountId);
  assert.equal(seat.kind, 'guest');
  const a = await accountRow(who.accountId);
  assert.equal(a.provisional, 1, 'flagged: it shows in Needs review');
  assert.ok(a.verifiedAt, 'and verified, so nothing is held');
  assert.equal((await requestsOf(host, who.accountId)).length, 0);
});

test('manual tier: asking staff to vouch gives a guest seat at once, unverified and flagged', async () => {
  const who = await newcomer('none');
  const r = await askStaff(who, 'Vouch Me');
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const [a] = await db.select().from(s.accounts).where(eq(s.accounts.rsnNormalized, 'vouch me'));
  assert.equal(a.playerId, who.playerId);
  assert.equal(a.verifiedAt, null, 'nothing is proved yet');
  assert.equal(a.provisional, 1);
  assert.equal(a.verificationMethod, 'manual');
  const seat = await seatOf(host, a.id);
  assert.equal(seat.kind, 'guest');
  assert.equal(seat.leftAt, null);
});

for (const tier of ['plugin', 'xp', 'manual'] as const) {
  test(`${tier} tier: a closed clan grants nothing and queues nothing`, async () => {
    const who = await newcomer(tier);
    const shut = (await db.select().from(s.clans).where(eq(s.clans.slug, 'shut')))[0].id;
    const r = await apply('shut', who);
    assert.equal(r.status, 403);
    assert.equal(await seatOf(shut, who.accountId), undefined);
    assert.equal((await requestsOf(shut, who.accountId)).length, 0);
  });

  test(`${tier} tier: a banned person is refused`, async () => {
    const who = await newcomer(tier);
    const { banFromClan } = await import('../src/lib/clanBans.ts');
    await banFromClan({ clanId: host, playerId: who.playerId, byUserId: staffUser });
    const r = await apply('host', who);
    assert.equal(r.status, 403);
    assert.match(String(r.json.error), /barred/);
    assert.equal(await seatOf(host, who.accountId), undefined);
  });

  test(`${tier} tier: a seat staff removed is not granted again, it becomes a request`, async () => {
    const who = await newcomer(tier);
    assert.equal((await apply('host', who)).json.seated, true);
    const seat = await seatOf(host, who.accountId);
    assert.equal((await review(seat.id, 'not_member')).status, 200);

    const again = await apply('host', who);
    assert.equal(again.status, 202, JSON.stringify(again.json));
    assert.equal(again.json.pending, true);
    assert.ok((await seatOf(host, who.accountId)).leftAt, 'the seat stays ended');
    assert.equal((await requestsOf(host, who.accountId)).filter((q) => q.status === 'pending').length, 1);
  });
}

test('a banned person cannot ask staff to vouch either, and nothing is claimed', async () => {
  const who = await newcomer('none');
  const { banFromClan } = await import('../src/lib/clanBans.ts');
  await banFromClan({ clanId: host, playerId: who.playerId, byUserId: staffUser });
  const r = await askStaff(who, 'Barred One');
  assert.equal(r.status, 403);
  assert.equal((await db.select().from(s.accounts).where(eq(s.accounts.rsnNormalized, 'barred one'))).length, 0);
});

test('a closed clan refuses a request for staff to vouch', async () => {
  const who = await newcomer('none');
  const r = await askStaff(who, 'Shut Out', 'shut');
  assert.equal(r.status, 403);
  const shut = (await db.select().from(s.clans).where(eq(s.clans.slug, 'shut')))[0].id;
  assert.equal((await db.select().from(s.clanMemberships).where(eq(s.clanMemberships.clanId, shut))).length, 0);
});

// ── Signing up for an event ───────────────────────────────────────────────────────────────────

test('plugin and xp tiers: a sign-up with no invite waits for the host, in the pool', async () => {
  const ev = await event(host, 'Plain');
  for (const tier of ['plugin', 'xp'] as const) {
    const who = await newcomer(tier);
    await apply('host', who);
    const seat = await seatOf(host, who.accountId);
    const r = await signUp('host', ev.id, who, seat.id);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.held, false);
    assert.equal((await signupsOf(ev.id, who.userId))[0].status, 'pending');
    assert.equal((await boardRow(ev.id, who.accountId)).teamId, null);
  }
});

test('manual tier: a sign-up is held as pending with no team, even through an invite', async () => {
  const ev = await event(host, 'Held');
  const token = await invite(ev);
  const who = await newcomer('none');
  await askStaff(who, 'Held One');
  const [a] = await db.select().from(s.accounts).where(eq(s.accounts.rsnNormalized, 'held one'));
  const seat = await seatOf(host, a.id);
  const r = await signUp('host', ev.id, who, seat.id, token);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.held, true);
  assert.equal((await signupsOf(ev.id, who.userId))[0].status, 'pending');
  assert.equal((await boardRow(ev.id, a.id)).teamId, null, 'no team until staff vouch');
  assert.equal((await db.select().from(s.teamInvites).where(eq(s.teamInvites.token, token)))[0].uses, 0, 'the invite seat is not spent yet');
});

test('a character nobody has claimed or proved cannot sign up', async () => {
  const ev = await event(host, 'Unproved');
  const who = await newcomer('none');
  const [a] = await db.insert(s.accounts).values({ playerId: who.playerId, rsn: 'Typed Only', rsnNormalized: 'typed only' }).returning();
  const [seat] = await db.insert(s.clanMemberships).values({ clanId: host, accountId: a.id, kind: 'guest', source: 'application' }).returning();
  const r = await signUp('host', ev.id, who, seat.id);
  assert.equal(r.status, 403);
});

// ── Invites ───────────────────────────────────────────────────────────────────────────────────

for (const [label, dates] of [
  ['an upcoming', { startDate: day(7), endDate: day(14) }],
  ['a running', { startDate: day(-1), endDate: day(7) }],
] as const) {
  for (const tier of ['plugin', 'xp'] as const) {
    test(`a valid invite puts an off-roster ${tier} person on its team on ${label} event, with no host approval`, async () => {
      const ev = await event(host, `Invite ${label} ${tier}`, dates);
      const token = await invite(ev);
      const who = await newcomer(tier);
      const { entered, signed } = await joinByInvite('host', ev, who, token);
      assert.equal(entered.outcome, 'seated', JSON.stringify(entered));
      assert.equal(signed!.status, 200, JSON.stringify(signed!.json));
      assert.equal((await seatOf(host, who.accountId)).kind, 'guest');
      assert.equal((await requestsOf(host, who.accountId)).length, 0, 'nobody is asked');
      assert.equal((await signupsOf(ev.id, who.userId))[0].status, 'approved');
      assert.equal((await boardRow(ev.id, who.accountId)).teamId, ev.teamId);
      assert.equal((await db.select().from(s.teamInvites).where(eq(s.teamInvites.token, token)))[0].uses, 1);
    });
  }
}

test('without an invite, an off-roster person asks and waits for the host', async () => {
  const ev = await event(host, 'No Invite');
  const who = await newcomer('plugin');
  const entered = await enter(ev.id, who);
  assert.equal(entered.outcome, 'pending');
  assert.equal(await seatOf(host, who.accountId), undefined);
});

for (const [label, make, expected] of [
  ['an expired', (ev: { id: number; teamId: number }) => invite(ev, { expiresAt: day(-1) }), /expired/],
  ['a revoked', (ev: { id: number; teamId: number }) => invite(ev, { revokedAt: day(-1) }), /turned off/],
  ['a used-up', (ev: { id: number; teamId: number }) => invite(ev, { maxUses: 1, uses: 1 }), /full/],
] as const) {
  for (const running of [false, true]) {
    test(`${label} invite admits nobody (${running ? 'running' : 'upcoming'} event)`, async () => {
      const ev = await event(host, `Bad ${label} ${running}`, running ? { startDate: day(-1), endDate: day(7) } : {});
      const token = await make(ev);
      const who = await newcomer('plugin');
      const entered = await enter(ev.id, who, token);
      assert.equal(entered.outcome, 'pending', 'the dead link is no consent: they ask like anyone else');
      assert.equal(await seatOf(host, who.accountId), undefined);

      // And for somebody who already holds a seat, the form refuses the link in plain words.
      const insider = await newcomer('plugin');
      await apply('host', insider);
      const r = await signUp('host', ev.id, insider, (await seatOf(host, insider.accountId)).id, token);
      assert.equal(r.status, 403);
      assert.match(String(r.json.error), expected);
      assert.equal((await signupsOf(ev.id, insider.userId)).length, 0);
    });
  }
}

test('an invite for another event admits nobody', async () => {
  const mine = await event(host, 'Mine');
  const other = await event(host, 'Other');
  const token = await invite(other);
  const who = await newcomer('plugin');
  assert.equal((await enter(mine.id, who, token)).outcome, 'pending');
  assert.equal(await seatOf(host, who.accountId), undefined);

  const insider = await newcomer('plugin');
  await apply('host', insider);
  const r = await signUp('host', mine.id, insider, (await seatOf(host, insider.accountId)).id, token);
  assert.equal(r.status, 403);
  assert.match(String(r.json.error), /different event/);
});

test('a one-seat invite seats one person; the second is told it is used up', async () => {
  const ev = await event(host, 'One Seat');
  const token = await invite(ev, { maxUses: 1 });
  const first = await newcomer('plugin');
  assert.equal((await joinByInvite('host', ev, first, token)).signed!.status, 200);
  const second = await newcomer('plugin');
  const r = await joinByInvite('host', ev, second, token);
  assert.equal(r.entered.outcome, 'pending');
  assert.equal((await signupsOf(ev.id, second.userId)).length, 0);
});

test('the host switched the form off: the invite says so plainly, on a running event too', async () => {
  for (const dates of [{}, { startDate: day(-1), endDate: day(7) }]) {
    const ev = await event(host, `Off ${n++}`, { signupsEnabled: false, ...dates });
    const token = await invite(ev);
    const who = await newcomer('plugin');
    await apply('host', who);
    const r = await signUp('host', ev.id, who, (await seatOf(host, who.accountId)).id, token);
    assert.equal(r.status, 403);
    assert.match(String(r.json.error), /adds players to this event by hand/);
    assert.equal((await signupsOf(ev.id, who.userId)).length, 0);
  }
});

test('an invite to a finished event adds nobody', async () => {
  const ev = await event(host, 'Over', { startDate: day(-9), endDate: day(-2) });
  const token = await invite(ev);
  const who = await newcomer('plugin');
  await apply('host', who);
  const r = await signUp('host', ev.id, who, (await seatOf(host, who.accountId)).id, token);
  assert.equal(r.status, 403);
  assert.match(String(r.json.error), /finished/);
});

// ── A proven claim against an unvouched one ───────────────────────────────────────────────────

test('a proven claim takes the character from an unvouched manual claim: sign-ups withdrawn, audit written', async () => {
  const ev = await event(host, 'Displaced');
  const squatter = await newcomer('none');
  await askStaff(squatter, 'Real Owner');
  const [a] = await db.select().from(s.accounts).where(eq(s.accounts.rsnNormalized, 'real owner'));
  const seat = await seatOf(host, a.id);
  assert.equal((await signUp('host', ev.id, squatter, seat.id)).status, 200);

  const owner = await newcomer('none');
  const claim = await C.claimAccountForPerson({
    playerId: owner.playerId,
    rsn: 'Real Owner',
    rsnNormalized: 'real owner',
    method: 'stat_delta',
    provisional: true,
    actorUserId: owner.userId,
  });
  assert.equal(claim.ok, true);

  const after = await accountRow(a.id);
  assert.equal(after.playerId, owner.playerId);
  assert.ok(after.verifiedAt);
  assert.equal(after.verificationMethod, 'stat_delta');
  assert.equal((await signupsOf(ev.id, squatter.userId))[0].status, 'withdrawn');
  assert.equal(await boardRow(ev.id, a.id), undefined, 'and they are off the board');
  const audit = await db.select().from(s.clanAuditLog).where(and(eq(s.clanAuditLog.clanId, host), eq(s.clanAuditLog.eventType, 'unconfirmed_claim_displaced')));
  assert.ok(audit.some((r) => JSON.parse(r.newValue ?? '{}').accountId === a.id), 'the clan is told');
  assert.ok((await seatOf(host, a.id)).leftAt, 'the seat the unvouched claim was given does not pass to the new owner');
});

test('never the reverse: an unvouched claim cannot take a character anybody else holds', async () => {
  for (const tier of ['plugin', 'xp', 'manual'] as const) {
    const holder = await newcomer(tier);
    const taker = await newcomer('none');
    const r = await askStaff(taker, holder.rsn);
    assert.equal(r.status, 409, `${tier}: ${JSON.stringify(r.json)}`);
    assert.equal((await accountRow(holder.accountId)).playerId, holder.playerId);
    // Nor through the claim itself, were a caller to skip the route's own check.
    const direct = await C.claimAccountForPerson({ playerId: taker.playerId, rsn: holder.rsn, rsnNormalized: holder.rsn.toLowerCase(), method: 'manual', verified: false, provisional: true });
    assert.equal(direct.ok, false);
  }
});

test('a proven claim does not take a character staff have already vouched for', async () => {
  const first = await newcomer('none');
  await askStaff(first, 'Vouched Char');
  const [a] = await db.select().from(s.accounts).where(eq(s.accounts.rsnNormalized, 'vouched char'));
  assert.equal((await review((await seatOf(host, a.id)).id, 'approve')).status, 200);
  const second = await newcomer('none');
  const claim = await C.claimAccountForPerson({ playerId: second.playerId, rsn: 'Vouched Char', rsnNormalized: 'vouched char', method: 'stat_delta', provisional: true });
  assert.equal(claim.ok, false);
  assert.equal((await accountRow(a.id)).playerId, first.playerId);
});

// ── Limits on asking staff ────────────────────────────────────────────────────────────────────

test('one open request for staff per person; asking again for the same character is fine', async () => {
  const who = await newcomer('none');
  assert.equal((await askStaff(who, 'First Ask')).status, 200);
  assert.equal((await askStaff(who, 'First Ask')).status, 200, 'the same one again is not a second request');
  const second = await askStaff(who, 'Second Ask');
  assert.equal(second.status, 429);
  assert.equal((await db.select().from(s.accounts).where(eq(s.accounts.rsnNormalized, 'second ask'))).length, 0);
});

test('asking staff to vouch needs a clan: refused on the apex, nothing claimed', async () => {
  const who = await newcomer('none');
  const r = await askStaff(who, 'No Clan', null);
  assert.equal(r.status, 400);
  assert.equal((await db.select().from(s.accounts).where(eq(s.accounts.rsnNormalized, 'no clan'))).length, 0);
});

test('a character on the clan’s in-game list cannot be taken by asking staff', async () => {
  const [ghost] = await db.insert(s.players).values({ displayName: 'Listed' }).returning();
  const [a] = await db.insert(s.accounts).values({ playerId: ghost.id, rsn: 'Listed One', rsnNormalized: 'listed one' }).returning();
  await db.insert(s.clanMemberships).values({ clanId: host, accountId: a.id, kind: 'member', source: 'roster' });
  const who = await newcomer('none');
  const r = await askStaff(who, 'Listed One');
  assert.equal(r.status, 409);
  assert.equal((await accountRow(a.id)).claimedAt, null);
});

test('nor a character on ANOTHER clan’s in-game list: asking here would hand over that clan’s member seat', async () => {
  const elsewhere = await clan('elsewhere');
  const [ghost] = await db.insert(s.players).values({ displayName: 'Listed Away' }).returning();
  const [a] = await db.insert(s.accounts).values({ playerId: ghost.id, rsn: 'Listed Away', rsnNormalized: 'listed away' }).returning();
  await db.insert(s.clanMemberships).values({ clanId: elsewhere, accountId: a.id, kind: 'member', source: 'roster' });
  const who = await newcomer('none');
  const r = await askStaff(who, 'Listed Away');
  assert.equal(r.status, 409, JSON.stringify(r.json));
  const after = await accountRow(a.id);
  assert.equal(after.claimedAt, null);
  assert.equal(after.playerId, ghost.id);
});

// ── Staff decline ─────────────────────────────────────────────────────────────────────────────

test('staff decline a manual request: the seat ends and the held sign-up is withdrawn and off the board', async () => {
  const ev = await event(host, 'Declined');
  const who = await newcomer('none');
  await askStaff(who, 'Not Ours');
  const [a] = await db.select().from(s.accounts).where(eq(s.accounts.rsnNormalized, 'not ours'));
  const seat = await seatOf(host, a.id);
  await signUp('host', ev.id, who, seat.id);
  assert.ok(await boardRow(ev.id, a.id));

  assert.equal((await review(seat.id, 'not_member')).status, 200);
  assert.ok((await seatOf(host, a.id)).leftAt);
  assert.equal((await signupsOf(ev.id, who.userId))[0].status, 'withdrawn');
  assert.equal(await boardRow(ev.id, a.id), undefined);
});
