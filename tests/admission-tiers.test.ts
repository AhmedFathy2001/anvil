// The three ways in, end to end against a real database and the real routes.
//
//   plugin  the plugin reported the character (or staff confirmed it): joins at once.
//   xp      the XP check passed: the same for the person, flagged in the clan's Needs review list.
//   manual  asked the clan's staff to vouch: never overrides the clan's door. Where the clan lets
//           guests in freely (`free`) they are admitted but held (a pending entry with no team)
//           until staff vouch; where guests need approval (`host`) it is a join request and no seat
//           until staff accept; a closed clan refuses.
//
// And the clan has to be one the person may address: a members-only or hidden clan named by a
// stranger answers like a clan that does not exist (lib/clanAddress).
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
/** A clan that lets guests in freely: where an unproven (manual) claim is seated. */
let free: number;
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
const askStaff = (who: { userId: number }, rsn: string, slug: string | null = 'free', invite?: string) =>
  callRoute(manualRoute.POST, { userId: who.userId, body: { rsn, ...(slug ? { clan: `/c/${slug}` } : {}), ...(invite ? { invite } : {}) } });
const signUp = (slug: string, eventId: number, who: { userId: number }, seatId: number, inviteToken?: string) =>
  callRoute(signupRoute.POST, { userId: who.userId, slug, params: { eventId: String(eventId) }, body: { clanMemberIds: [seatId], inviteToken } });
const review = (seatId: number, action: 'approve' | 'not_member', slug = 'free') =>
  callRoute(verifyRoute.POST, { userId: staffUser, slug, params: { id: String(seatId) }, body: { action } });
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
  free = await clan('free', { guestPolicy: 'open' });
  await clan('shut', { guestPolicy: 'closed' });
  const staff = await newcomer('none');
  staffUser = staff.userId;
  await db.insert(s.clanStaff).values([
    { clanId: host, userId: staffUser, role: 'moderator' },
    { clanId: free, userId: staffUser, role: 'moderator' },
  ]);
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

test('manual tier, a clan that lets guests in freely: asking staff to vouch gives a guest seat at once, unverified and flagged', async () => {
  const who = await newcomer('none');
  const r = await askStaff(who, 'Vouch Me', 'free');
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const [a] = await db.select().from(s.accounts).where(eq(s.accounts.rsnNormalized, 'vouch me'));
  assert.equal(a.playerId, who.playerId);
  assert.equal(a.verifiedAt, null, 'nothing is proved yet');
  assert.equal(a.provisional, 1);
  assert.equal(a.verificationMethod, 'manual');
  const seat = await seatOf(free, a.id);
  assert.equal(seat.kind, 'guest');
  assert.equal(seat.leftAt, null);
  assert.equal((await requestsOf(free, a.id)).length, 0, 'the clan lets guests in: no request');
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
    // A proven character is seated over `approval` (host); an unproven one only where guests are let in freely.
    const [slug, clanId] = tier === 'manual' ? (['free', free] as const) : (['host', host] as const);
    assert.equal((await apply(slug, who)).json.seated, true);
    const seat = await seatOf(clanId, who.accountId);
    assert.equal((await review(seat.id, 'not_member', slug)).status, 200);

    const again = await apply(slug, who);
    assert.equal(again.status, 202, JSON.stringify(again.json));
    assert.equal(again.json.pending, true);
    assert.ok((await seatOf(clanId, who.accountId)).leftAt, 'the seat stays ended');
    assert.equal((await requestsOf(clanId, who.accountId)).filter((q) => q.status === 'pending').length, 1);
  });
}

test('a banned person cannot ask staff to vouch either, and nothing is claimed', async () => {
  const who = await newcomer('none');
  const { banFromClan } = await import('../src/lib/clanBans.ts');
  await banFromClan({ clanId: host, playerId: who.playerId, byUserId: staffUser });
  const r = await askStaff(who, 'Barred One', 'host');
  assert.equal(r.status, 403);
  assert.equal((await db.select().from(s.accounts).where(eq(s.accounts.rsnNormalized, 'barred one'))).length, 0);
});

test('a closed clan refuses a request for staff to vouch', async () => {
  const who = await newcomer('none');
  const r = await askStaff(who, 'Shut Out', 'shut');
  assert.equal(r.status, 403);
  const shut = (await db.select().from(s.clans).where(eq(s.clans.slug, 'shut')))[0].id;
  assert.equal((await db.select().from(s.clanMemberships).where(eq(s.clanMemberships.clanId, shut))).length, 0);
  assert.match(String(r.json.error), /not taking guests/);
  assert.equal((await db.select().from(s.clanJoinRequests).where(eq(s.clanJoinRequests.clanId, shut))).length, 0);
  assert.equal((await db.select().from(s.accounts).where(eq(s.accounts.rsnNormalized, 'shut out'))).length, 0, 'and nothing is claimed: no open request nobody will answer');
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
  const ev = await event(free, 'Held');
  const token = await invite(ev);
  const who = await newcomer('none');
  await askStaff(who, 'Held One');
  const [a] = await db.select().from(s.accounts).where(eq(s.accounts.rsnNormalized, 'held one'));
  const seat = await seatOf(free, a.id);
  const r = await signUp('free', ev.id, who, seat.id, token);
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
  const ev = await event(free, 'Displaced');
  const squatter = await newcomer('none');
  await askStaff(squatter, 'Real Owner');
  const [a] = await db.select().from(s.accounts).where(eq(s.accounts.rsnNormalized, 'real owner'));
  const seat = await seatOf(free, a.id);
  assert.equal((await signUp('free', ev.id, squatter, seat.id)).status, 200);

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
  const audit = await db.select().from(s.clanAuditLog).where(and(eq(s.clanAuditLog.clanId, free), eq(s.clanAuditLog.eventType, 'unconfirmed_claim_displaced')));
  assert.ok(audit.some((r) => JSON.parse(r.newValue ?? '{}').accountId === a.id), 'the clan is told');
  assert.ok((await seatOf(free, a.id)).leftAt, 'the seat the unvouched claim was given does not pass to the new owner');
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
  assert.equal((await review((await seatOf(free, a.id)).id, 'approve')).status, 200);
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
  // The same limit where the clan approves its guests: one request, asked twice is still one.
  const other = await newcomer('none');
  assert.equal((await askStaff(other, 'First Wait', 'host')).status, 202);
  assert.equal((await askStaff(other, 'First Wait', 'host')).status, 202);
  const [waiting] = await db.select().from(s.accounts).where(eq(s.accounts.rsnNormalized, 'first wait'));
  assert.equal((await requestsOf(host, waiting.id)).length, 1);
  assert.equal((await askStaff(other, 'Second Wait', 'host')).status, 429);
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
  const r = await askStaff(who, 'Listed One', 'host');
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
  const ev = await event(free, 'Declined');
  const who = await newcomer('none');
  await askStaff(who, 'Not Ours');
  const [a] = await db.select().from(s.accounts).where(eq(s.accounts.rsnNormalized, 'not ours'));
  const seat = await seatOf(free, a.id);
  await signUp('free', ev.id, who, seat.id);
  assert.ok(await boardRow(ev.id, a.id));

  assert.equal((await review(seat.id, 'not_member')).status, 200);
  assert.ok((await seatOf(free, a.id)).leftAt);
  // Asking again on their word does not bring the ended seat back.
  const again = await askStaff(who, 'Not Ours');
  assert.equal(again.status, 403, JSON.stringify(again.json));
  assert.ok((await seatOf(free, a.id)).leftAt, 'the seat staff ended stays ended');
  assert.equal((await requestsOf(free, a.id)).length, 0);
  assert.equal((await signupsOf(ev.id, who.userId))[0].status, 'withdrawn');
  assert.equal(await boardRow(ev.id, a.id), undefined);
});

// ── Staff vouch: everything held completes in the same action ─────────────────────────────────

const noticesOf = async (userId: number) => db.select().from(s.userNotices).where(eq(s.userNotices.userId, userId));

test('staff vouch: the character is confirmed, an invited entry is approved onto its team, a plain one waits for the host, and the person is told', async () => {
  const invited = await event(free, 'Vouch Invited');
  const token = await invite(invited, { maxUses: 3 });
  const plain = await event(free, 'Vouch Plain');
  const who = await newcomer('none');
  await askStaff(who, 'Vouch Both');
  const [a] = await db.select().from(s.accounts).where(eq(s.accounts.rsnNormalized, 'vouch both'));
  const seat = await seatOf(free, a.id);
  assert.equal((await signUp('free', invited.id, who, seat.id, token)).json.held, true);
  assert.equal((await signUp('free', plain.id, who, seat.id)).json.held, true);

  const r = await review(seat.id, 'approve');
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.deepEqual(r.json.entries, { approved: 1, waiting: 1 });

  const after = await accountRow(a.id);
  assert.ok(after.verifiedAt, 'verified by the vouch');
  assert.equal(after.provisional, 0, 'no longer in Needs review');
  assert.equal(after.verifiedByUserId, staffUser);
  const { pathOf } = await import('../src/lib/characterState.ts');
  assert.equal(pathOf(after), 'vouched');

  assert.equal((await signupsOf(invited.id, who.userId))[0].status, 'approved');
  assert.equal((await boardRow(invited.id, a.id)).teamId, invited.teamId, 'on the team the invite named');
  assert.equal((await db.select().from(s.teamInvites).where(eq(s.teamInvites.token, token)))[0].uses, 1, 'the invite seat is spent now');
  assert.equal((await signupsOf(plain.id, who.userId))[0].status, 'pending', 'no invite: the host still answers');
  assert.equal((await boardRow(plain.id, a.id)).teamId, null);

  const told = await noticesOf(who.userId);
  assert.equal(told.length, 1);
  assert.match(told[0].title, /free: staff confirmed Vouch Both/);
  assert.match(told[0].body, /You are on Vouch Invited team in Vouch Invited/);
  assert.match(told[0].body, /Vouch Plain now waits for the host/);
  assert.equal(told[0].readAt, null);

  // And it is in the bell every page carries, until they open it.
  const N = await import('../src/lib/notices.ts');
  const inbox = await N.inboxFor(who.userId);
  const mine = inbox.notices.filter((x) => x.kind === 'personal');
  assert.equal(mine.length, 1);
  assert.match(mine[0].title, /staff confirmed Vouch Both/);
  assert.ok(inbox.unread >= 1);
  await N.markRead(who.userId, [mine[0].id]);
  assert.ok((await noticesOf(who.userId))[0].readAt, 'opening the bell marks it read');
  assert.equal((await N.inboxFor(who.userId)).notices.filter((x) => x.kind === 'personal').length, 0);

  // Vouching twice is refused and completes nothing twice.
  assert.equal((await review(seat.id, 'approve')).status, 400);
  assert.equal((await db.select().from(s.teamInvites).where(eq(s.teamInvites.token, token)))[0].uses, 1);
});

test('staff vouch: an invite that ran out or was turned off while they waited leaves the entry for the host', async () => {
  const ev = await event(free, 'Vouch Dead Invite');
  const token = await invite(ev);
  const who = await newcomer('none');
  await askStaff(who, 'Vouch Late');
  const [a] = await db.select().from(s.accounts).where(eq(s.accounts.rsnNormalized, 'vouch late'));
  const seat = await seatOf(free, a.id);
  await signUp('free', ev.id, who, seat.id, token);
  await db.update(s.teamInvites).set({ revokedAt: new Date().toISOString() }).where(eq(s.teamInvites.token, token));

  const r = await review(seat.id, 'approve');
  assert.deepEqual(r.json.entries, { approved: 0, waiting: 1 });
  assert.equal((await signupsOf(ev.id, who.userId))[0].status, 'pending');
  assert.equal((await boardRow(ev.id, a.id)).teamId, null);
});

test('staff vouch says nothing about another clan’s events', async () => {
  const other = await clan('other-host');
  const theirs = await event(other, 'Other Clan Event');
  const who = await newcomer('none');
  await askStaff(who, 'Two Clans');
  const [a] = await db.select().from(s.accounts).where(eq(s.accounts.rsnNormalized, 'two clans'));
  // A guest seat in the other clan too, with a held entry there.
  const [otherSeat] = await db.insert(s.clanMemberships).values({ clanId: other, accountId: a.id, kind: 'guest', source: 'application' }).returning();
  assert.equal((await signUp('other-host', theirs.id, who, otherSeat.id)).json.held, true);

  const r = await review((await seatOf(free, a.id)).id, 'approve');
  assert.deepEqual(r.json.entries, { approved: 0, waiting: 0 });
  assert.equal((await signupsOf(theirs.id, who.userId))[0].status, 'pending');
});

test('staff decline: the person is told, in-game name and clan only', async () => {
  const ev = await event(free, 'Decline Told');
  const who = await newcomer('none');
  await askStaff(who, 'Decline Me');
  const [a] = await db.select().from(s.accounts).where(eq(s.accounts.rsnNormalized, 'decline me'));
  const seat = await seatOf(free, a.id);
  await signUp('free', ev.id, who, seat.id);
  const r = await review(seat.id, 'not_member');
  assert.equal(r.json.withdrawn, 1);
  const told = await noticesOf(who.userId);
  assert.equal(told.length, 1);
  assert.match(told[0].title, /staff did not confirm Decline Me/);
  assert.match(told[0].body, /sign-up for Decline Told was withdrawn/);
  assert.doesNotMatch(told[0].title + told[0].body, /person-|77\d{6}/, 'no Discord name or id');
});

test('a flagged XP character confirmed by staff is not told anything was held, because nothing was', async () => {
  const who = await newcomer('xp');
  await apply('host', who);
  const r = await review((await seatOf(host, who.accountId)).id, 'approve', 'host');
  assert.equal(r.json.entries, null);
  assert.equal((await noticesOf(who.userId)).length, 0);
  assert.equal((await accountRow(who.accountId)).provisional, 0);
});

// ── Applying with a name typed on the clan page ───────────────────────────────────────────────

const applyByName = (slug: string, who: { userId: number }, rsn: string, via: string) =>
  callRoute(applyRoute.POST, { userId: who.userId, params: { slug }, body: { rsn, via } });

for (const via of ['plugin', 'xp'] as const) {
  test(`apply with a typed name (${via}): nothing is granted and staff are asked nothing until the character is proved; then the seat is granted`, async () => {
    const who = await newcomer('none');
    const rsn = `Typed ${via}`;
    const r = await applyByName('host', who, rsn, via);
    assert.equal(r.status, 202, JSON.stringify(r.json));
    const [a] = await db.select().from(s.accounts).where(eq(s.accounts.rsnNormalized, rsn.toLowerCase()));
    assert.equal(a.claimedAt, null, 'typing a name claims nothing');
    assert.equal(await seatOf(host, a.id), undefined);
    assert.equal((await requestsOf(host, a.id)).filter((q) => q.status === 'pending').length, 0, 'nothing in the staff queue');
    const { pendingRequests } = await import('../src/lib/guestAdmission.ts');
    assert.equal((await pendingRequests(host)).some((q) => q.rsn === rsn), false);

    // They prove it (first plugin play, or the XP check passing).
    const claim = await C.claimAccountForPerson({
      playerId: who.playerId,
      rsn,
      rsnNormalized: rsn.toLowerCase(),
      method: via === 'plugin' ? 'plugin_first_use' : 'stat_delta',
      provisional: true,
      accountHash: via === 'plugin' ? `hash-${rsn}` : null,
    });
    assert.equal(claim.ok, true);
    const seat = await seatOf(host, a.id);
    assert.equal(seat.kind, 'guest');
    assert.equal(seat.leftAt, null);
    assert.deepEqual((await requestsOf(host, a.id)).map((q) => q.status), ['approved']);
    assert.match((await noticesOf(who.userId))[0].title, /You’re in host/);
  });
}

test('a typed-name application does nothing for somebody else who proves that character', async () => {
  const asker = await newcomer('none');
  const owner = await newcomer('none');
  await applyByName('host', asker, 'Typed Other', 'plugin');
  const claim = await C.claimAccountForPerson({ playerId: owner.playerId, rsn: 'Typed Other', rsnNormalized: 'typed other', method: 'stat_delta', provisional: true });
  assert.equal(claim.ok, true);
  const [a] = await db.select().from(s.accounts).where(eq(s.accounts.rsnNormalized, 'typed other'));
  assert.equal(a.playerId, owner.playerId);
  assert.equal(await seatOf(host, a.id), undefined, 'the real owner never asked this clan for anything');
});

test('a typed-name application: closed clan, ban, bad name, somebody else’s character and a missing choice are refused', async () => {
  const who = await newcomer('none');
  assert.equal((await applyByName('shut', who, 'Typed Shut', 'plugin')).status, 403);
  assert.equal((await applyByName('host', who, 'bad#name', 'plugin')).status, 400);
  assert.equal((await applyByName('host', who, 'Way Too Long Name', 'plugin')).status, 400);
  assert.equal((await applyByName('host', who, 'Typed Ok', 'carrier-pigeon')).status, 400);
  const holder = await newcomer('plugin');
  assert.equal((await applyByName('host', who, holder.rsn, 'plugin')).status, 409);
  const barred = await newcomer('none');
  const { banFromClan } = await import('../src/lib/clanBans.ts');
  await banFromClan({ clanId: host, playerId: barred.playerId, byUserId: staffUser });
  assert.equal((await applyByName('host', barred, 'Typed Barred', 'plugin')).status, 403);
  assert.equal((await db.select().from(s.clanJoinRequests).where(eq(s.clanJoinRequests.status, 'awaiting-proof'))).filter((q) => q.playerId === who.playerId || q.playerId === barred.playerId).length, 0);
});

test('a name on the clan’s in-game list is told so and files no application; the check answers the same as they type', async () => {
  const [ghost] = await db.insert(s.players).values({ displayName: 'On The List' }).returning();
  const [a] = await db.insert(s.accounts).values({ playerId: ghost.id, rsn: 'On The List', rsnNormalized: 'on the list' }).returning();
  await db.insert(s.clanMemberships).values({ clanId: host, accountId: a.id, kind: 'member', source: 'roster' });
  const who = await newcomer('none');
  const r = await applyByName('host', who, 'on the list', 'plugin');
  assert.equal(r.status, 200);
  assert.equal(r.json.onRoster, true);
  assert.equal((await requestsOf(host, a.id)).length, 0);
  const { onInGameList } = await import('../src/lib/applyIntents.ts');
  assert.equal(await onInGameList(host, 'on the list'), true);
  assert.equal(await onInGameList(host, 'nobody at all'), false);
  // Once somebody has linked it, it is no longer "yours to be recognised by": no hint.
  await db.update(s.accounts).set({ claimedAt: new Date().toISOString() }).where(eq(s.accounts.id, a.id));
  assert.equal(await onInGameList(host, 'on the list'), false);
});

test('one typed-name application per clan: a new name replaces the old one', async () => {
  const who = await newcomer('none');
  await applyByName('host', who, 'Typed First', 'plugin');
  await applyByName('host', who, 'Typed Second', 'xp');
  const { applyIntentOf } = await import('../src/lib/applyIntents.ts');
  assert.deepEqual(await applyIntentOf(host, who.playerId), { rsn: 'Typed Second', via: 'xp' });
});

// ── Joining by invite is a press, never a page load ───────────────────────────────────────────

test('opening an invite changes nothing; the join happens only through the POST, with a valid token, from this site', async () => {
  const enterRoute = await import('../src/app/api/events/[eventId]/enter/route.ts');
  const ev = await event(host, 'Press To Join');
  const token = await invite(ev, { maxUses: 5 });
  const who = await newcomer('plugin');
  const params = { eventId: String(ev.id) };

  // What the page does on load: a read. It says the invite is good and names what Join would do.
  const look = await callRoute(enterRoute.GET, { userId: who.userId, slug: 'host', method: 'GET', params, query: `invite=${token}` });
  assert.equal(look.status, 200);
  assert.deepEqual(look.json.invite, { ok: true, message: '', teamName: 'Press To Join team', eventName: 'Press To Join', hostName: 'host' });
  assert.equal(await seatOf(host, who.accountId), undefined, 'reading takes no seat');
  assert.equal((await requestsOf(host, who.accountId)).length, 0, 'and files no request');
  assert.equal((await signupsOf(ev.id, who.userId)).length, 0);
  assert.equal((await db.select().from(s.teamInvites).where(eq(s.teamInvites.token, token)))[0].uses, 0);

  // Another site cannot press it for them.
  const forged = await callRoute(enterRoute.POST, { userId: who.userId, slug: 'host', params, body: { accountId: who.accountId, inviteToken: token }, headers: { 'sec-fetch-site': 'cross-site' } });
  assert.equal(forged.status, 403);
  assert.equal(await seatOf(host, who.accountId), undefined);

  // Signed out: nothing.
  assert.equal((await callRoute(enterRoute.POST, { slug: 'host', params, body: { accountId: who.accountId, inviteToken: token } })).status, 401);

  // A token that is not this event's invite does not seat them: they are asking, like anyone.
  const bad = await callRoute(enterRoute.POST, { userId: who.userId, slug: 'host', params, body: { accountId: who.accountId, inviteToken: 'zzzzzzzzzzzzzzzz' }, headers: { 'sec-fetch-site': 'same-origin' } });
  assert.equal(bad.status, 202);
  assert.equal(await seatOf(host, who.accountId), undefined);

  // The press, from this site, with the real token.
  const other = await newcomer('plugin');
  const ok = await callRoute(enterRoute.POST, { userId: other.userId, slug: 'host', params, body: { accountId: other.accountId, inviteToken: token }, headers: { 'sec-fetch-site': 'same-origin' } });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  assert.equal((await seatOf(host, other.accountId)).kind, 'guest');
});

test('the page is told plainly why an invite cannot be used, before any button is shown', async () => {
  const enterRoute = await import('../src/app/api/events/[eventId]/enter/route.ts');
  const who = await newcomer('plugin');
  const look = async (ev: { id: number }, token: string) =>
    (await callRoute(enterRoute.GET, { userId: who.userId, slug: 'host', method: 'GET', params: { eventId: String(ev.id) }, query: `invite=${token}` })).json.invite as { ok: boolean; message: string; teamName: string | null };

  const ev = await event(host, 'Reasons');
  for (const [extra, expected] of [[{ expiresAt: day(-1) }, /expired/], [{ revokedAt: day(-1) }, /turned off/], [{ maxUses: 1, uses: 1 }, /full/]] as const) {
    const r = await look(ev, await invite(ev, extra));
    assert.equal(r.ok, false);
    assert.match(r.message, expected);
    assert.equal(r.teamName, null, 'a dead link names nothing');
  }
  const elsewhere = await event(host, 'Reasons Elsewhere');
  assert.match((await look(ev, await invite(elsewhere))).message, /different event/);
  const off = await event(host, 'Reasons Off', { signupsEnabled: false });
  assert.match((await look(off, await invite(off))).message, /adds players to this event by hand/);
  const over = await event(host, 'Reasons Over', { startDate: day(-9), endDate: day(-2) });
  assert.match((await look(over, await invite(over))).message, /finished/);
  assert.match((await look(ev, 'not-a-token')).message, /not valid/);
  // And the entry itself refuses the same ones: a good token on a switched-off event seats nobody.
  const entered = await enter(off.id, who, await invite(off));
  assert.notEqual(entered.outcome, 'seated');
});

// ── The clan's door is the clan's: an unproven claim never overrides it ───────────────────────

const accountByName = async (rsn: string) => (await db.select().from(s.accounts).where(eq(s.accounts.rsnNormalized, rsn.toLowerCase())))[0];

test('manual tier, a clan whose guests need approval: a join request that says so, NO seat, and a 202 for the caller', async () => {
  const who = await newcomer('none');
  const r = await askStaff(who, 'Wait Here', 'host');
  assert.equal(r.status, 202, JSON.stringify(r.json));
  assert.equal(r.json.requested, true);
  assert.equal(r.json.error, undefined, 'a request filed is a success, not an error');
  assert.match(String(r.json.message), /Your request is with host’s staff/);
  const a = await accountByName('Wait Here');
  assert.equal(a.playerId, who.playerId, 'the claim is theirs');
  assert.equal(a.verifiedAt, null);
  assert.equal(await seatOf(host, a.id), undefined, 'no seat on nothing but their word');
  const asked = await requestsOf(host, a.id);
  assert.deepEqual(asked.map((q) => q.status), ['pending']);
  assert.match(String(asked[0].message), /Asks staff to vouch for Wait Here/);
  const { pendingRequests } = await import('../src/lib/guestAdmission.ts');
  assert.ok((await pendingRequests(host)).some((q) => q.rsn === 'Wait Here' && /Asks staff to vouch/.test(q.message ?? '')), 'staff see it flagged in their queue');
});

test('manual tier: the other doors do not override either (apply with the claimed character, entering an event)', async () => {
  const who = await newcomer('manual');
  const applied = await apply('host', who);
  assert.equal(applied.status, 202, JSON.stringify(applied.json));
  assert.equal(await seatOf(host, who.accountId), undefined);
  const asked = await requestsOf(host, who.accountId);
  assert.equal(asked.length, 1);
  assert.match(String(asked[0].message), /Asks staff to vouch/);

  // Where the clan lets guests in freely, the clan's own setting seats them.
  assert.equal((await apply('free', who)).json.seated, true);
  assert.equal((await seatOf(free, who.accountId)).kind, 'guest');

  const other = await newcomer('manual');
  const ev = await event(host, 'Manual Enters');
  const entered = await enter(ev.id, other);
  assert.equal(entered.outcome, 'pending', JSON.stringify(entered));
  assert.equal(await seatOf(host, other.accountId), undefined);
});

test('manual tier, approval clan: no sign-up without a seat; staff accept, they are told, the sign-up is held, the vouch completes it', async () => {
  const G = await import('../src/lib/guestAdmission.ts');
  const enterRoute = await import('../src/app/api/events/[eventId]/enter/route.ts');
  const ev = await event(host, 'After Approval');
  const who = await newcomer('none');
  assert.equal((await askStaff(who, 'Sign Later', 'host')).status, 202);
  const a = await accountByName('Sign Later');
  const me = { ...who, accountId: a.id };

  // The event's door says the same thing, files no second request and gives no seat.
  const entered = await enter(ev.id, me);
  assert.equal(entered.outcome, 'pending');
  assert.match(entered.outcome === 'pending' ? entered.message : '', /Your request is with host’s staff\. You can sign up as soon as they accept it/);
  assert.equal(await seatOf(host, a.id), undefined);
  assert.equal((await requestsOf(host, a.id)).length, 1);
  // The page is told they are waiting, and on whom.
  const look = await callRoute(enterRoute.GET, { userId: who.userId, slug: 'host', method: 'GET', params: { eventId: String(ev.id) } });
  assert.ok(look.json.pendingSince);
  assert.equal(look.json.hostName, 'host');
  // No seat, so nothing can be signed up: not with no seat, not with somebody else's.
  const stranger = await newcomer('plugin');
  await apply('host', stranger);
  for (const ids of [[], [(await seatOf(host, stranger.accountId)).id]]) {
    const r = await callRoute(signupRoute.POST, { userId: who.userId, slug: 'host', params: { eventId: String(ev.id) }, body: { clanMemberIds: ids } });
    assert.notEqual(r.status, 200, JSON.stringify(r.json));
  }
  assert.equal((await signupsOf(ev.id, who.userId)).length, 0);
  assert.equal(await boardRow(ev.id, a.id), undefined);

  // Staff accept the request: a guest seat, still unverified, and the person is told on the site.
  const [req] = await requestsOf(host, a.id);
  const yes = await G.approveRequest(req.id, host, staffUser);
  assert.equal(yes.ok, true);
  const seat = await seatOf(host, a.id);
  assert.equal(seat.kind, 'guest');
  assert.equal((await accountRow(a.id)).verifiedAt, null, 'accepting a guest is not vouching for the character');
  const told = await noticesOf(who.userId);
  assert.equal(told.length, 1);
  assert.match(told[0].title, /host accepted your request/);
  assert.match(told[0].body, /you can sign up for its events/);
  assert.doesNotMatch(told[0].title + told[0].body, /person-|77\d{6}/, 'no Discord name or id');

  // One press on the sign-up they came for: held, like any unvouched entry.
  const signed = await signUp('host', ev.id, who, seat.id);
  assert.equal(signed.status, 200, JSON.stringify(signed.json));
  assert.equal(signed.json.held, true);
  assert.equal((await boardRow(ev.id, a.id)).teamId, null);

  // The vouch completes it, as it always did.
  const vouched = await review(seat.id, 'approve', 'host');
  assert.deepEqual(vouched.json.entries, { approved: 0, waiting: 1 });
  assert.ok((await accountRow(a.id)).verifiedAt);
});

test('a proven character accepted by staff is not sent the manual notice', async () => {
  const G = await import('../src/lib/guestAdmission.ts');
  const who = await newcomer('plugin');
  const ev = await event(host, 'Plain Request');
  assert.equal((await enter(ev.id, who)).outcome, 'pending');
  const [req] = await requestsOf(host, who.accountId);
  assert.equal((await G.approveRequest(req.id, host, staffUser)).ok, true);
  assert.equal((await noticesOf(who.userId)).length, 0);
});

// ── A clan that is not theirs to address ──────────────────────────────────────────────────────

let quiet: number;
let quietOpen: number;
let unlisted: number;
async function privateClans() {
  if (quiet) return;
  quiet = await clan('quiet', { visibility: 'members' });
  quietOpen = await clan('quiet-open', { visibility: 'members', guestPolicy: 'open' });
  unlisted = await clan('unlisted', { platformHidden: true, guestPolicy: 'open' });
}

test('manual tier: a members-only or hidden clan named by a stranger answers exactly like a clan that does not exist', async () => {
  await privateClans();
  // A new person per call: the route allows five an hour each, and that limit is not what is tested.
  const ask = async (slug: string, token?: string) => askStaff(await newcomer('none'), 'Probe One', slug, token);
  const missing = await ask('no-such-clan');
  assert.equal(missing.status, 400);
  for (const slug of ['quiet', 'quiet-open', 'unlisted']) {
    const r = await ask(slug);
    assert.equal(r.status, missing.status, slug);
    assert.deepEqual(r.json, missing.json, `${slug}: the same words as a slug that matches nothing`);
    // Named by the request's own address instead of the body: the same.
    const byPath = await callRoute(manualRoute.POST, { userId: (await newcomer('none')).userId, slug, body: { rsn: 'Probe One' } });
    assert.equal(byPath.status, missing.status, slug);
    assert.deepEqual(byPath.json, missing.json);
  }
  assert.equal(await accountByName('Probe One'), undefined, 'nothing is claimed');
  for (const id of [quiet, quietOpen, unlisted]) {
    assert.equal((await db.select().from(s.clanMemberships).where(eq(s.clanMemberships.clanId, id))).length, 0);
    assert.equal((await db.select().from(s.clanJoinRequests).where(eq(s.clanJoinRequests.clanId, id))).length, 0);
  }
  // A dead invite, or a good invite to some other clan's event, is no tie to this clan.
  const theirs = await event(quiet, 'Quiet Event');
  const elsewhere = await event(host, 'Elsewhere Event');
  for (const token of [await invite(theirs, { revokedAt: day(-1) }), await invite(theirs, { expiresAt: day(-1) }), await invite(elsewhere), 'zzzzzzzzzzzzzzzz']) {
    const r = await ask('quiet', token);
    assert.deepEqual([r.status, r.json], [missing.status, missing.json]);
  }
});

test('manual tier: an unproven character cannot use the other doors of a members-only clan either', async () => {
  await privateClans();
  const who = await newcomer('manual');
  for (const slug of ['quiet', 'quiet-open', 'unlisted']) {
    const r = await apply(slug, who);
    assert.equal(r.status, 404, `${slug}: ${JSON.stringify(r.json)}`);
  }
  const ev = await event(quietOpen, 'Quiet Open Event');
  const entered = await enter(ev.id, who);
  assert.equal(entered.outcome, 'refused');
  assert.equal(entered.outcome === 'refused' ? entered.status : 0, 404);
  for (const id of [quiet, quietOpen, unlisted]) assert.equal(await seatOf(id, who.accountId), undefined);
  assert.equal((await requestsOf(quiet, who.accountId)).length, 0);
});

test('manual tier: somebody with a seat, a waiting request or a good invite there may ask a members-only clan', async () => {
  await privateClans();
  // A seat: a guest of the clan asks its staff to vouch for another character of theirs.
  const guest = await newcomer('plugin');
  await db.insert(s.clanMemberships).values({ clanId: quiet, accountId: guest.accountId, kind: 'guest', source: 'application' });
  const bySeat = await askStaff(guest, 'Seat Alt', 'quiet');
  assert.equal(bySeat.status, 202, JSON.stringify(bySeat.json));
  assert.equal(await seatOf(quiet, (await accountByName('Seat Alt')).id), undefined, 'approval there: a request, no seat');

  // A good invite to one of that clan's events.
  const ev = await event(quiet, 'Quiet Invited');
  const token = await invite(ev);
  const invited = await newcomer('none');
  const byInvite = await askStaff(invited, 'Invite Ask', 'quiet', token);
  assert.equal(byInvite.status, 202, JSON.stringify(byInvite.json));
  const a = await accountByName('Invite Ask');
  assert.equal(await seatOf(quiet, a.id), undefined);
  assert.equal((await requestsOf(quiet, a.id)).length, 1);
  assert.equal((await db.select().from(s.teamInvites).where(eq(s.teamInvites.token, token)))[0].uses, 0, 'naming the clan does not spend the invite');

  // A request already waiting there: asking again (no invite this time) is answered, not hidden.
  const again = await askStaff(invited, 'Invite Ask', 'quiet');
  assert.equal(again.status, 202);
  assert.equal((await requestsOf(quiet, a.id)).length, 1);

  // Where that clan lets guests in freely, a person it already knows is seated, flagged.
  const known = await newcomer('plugin');
  await db.insert(s.clanMemberships).values({ clanId: quietOpen, accountId: known.accountId, kind: 'guest', source: 'application' });
  assert.equal((await askStaff(known, 'Known Alt', 'quiet-open')).status, 200);
  assert.equal((await seatOf(quietOpen, (await accountByName('Known Alt')).id)).kind, 'guest');
});

// ── Tiers 1 and 2: granted at once only at a clan they may address ────────────────────────────

for (const tier of ['plugin', 'xp'] as const) {
  test(`${tier} tier: a members-only or hidden clan named by a stranger grants nothing by itself; its own guest setting decides`, async () => {
    await privateClans();
    const who = await newcomer(tier);
    const r = await apply('quiet', who);
    assert.equal(r.status, 202, JSON.stringify(r.json));
    assert.equal(r.json.pending, true);
    assert.equal(await seatOf(quiet, who.accountId), undefined, 'no seat: its guests need approval');
    assert.equal((await requestsOf(quiet, who.accountId)).filter((q) => q.status === 'pending').length, 1);

    // Its event, entered by id: the same.
    const other = await newcomer(tier);
    const ev = await event(quiet, `Quiet ${tier}`);
    assert.equal((await enter(ev.id, other)).outcome, 'pending');
    assert.equal(await seatOf(quiet, other.accountId), undefined);

    // Hidden by the platform, guests let in freely: that is the clan's own setting, so it stands.
    const third = await newcomer(tier);
    assert.equal((await apply('unlisted', third)).json.seated, true);

    // With a request waiting there they are no longer a stranger, but the request still decides: no seat.
    assert.equal((await apply('quiet', who)).status, 202);
    assert.equal(await seatOf(quiet, who.accountId), undefined);
  });

  test(`${tier} tier: a name typed at a members-only clan, then proved, is a request there and not a seat`, async () => {
    await privateClans();
    const who = await newcomer('none');
    const rsn = `Quiet ${tier} typed`.slice(0, 12);
    assert.equal((await applyByName('quiet', who, rsn, tier)).status, 202);
    const claim = await C.claimAccountForPerson({ playerId: who.playerId, rsn, rsnNormalized: rsn.toLowerCase(), method: tier === 'plugin' ? 'plugin_first_use' : 'stat_delta', provisional: true, accountHash: tier === 'plugin' ? `hash-${rsn}` : null });
    assert.equal(claim.ok, true);
    const a = await accountByName(rsn);
    assert.equal(await seatOf(quiet, a.id), undefined);
    assert.equal((await requestsOf(quiet, a.id)).filter((q) => q.status === 'pending').length, 1);
  });

  test(`${tier} tier: entering a closed clan's event grants nothing, a ban refuses, and a seat staff removed is asked for again`, async () => {
    const shut = (await db.select().from(s.clans).where(eq(s.clans.slug, 'shut')))[0].id;
    const who = await newcomer(tier);
    const shutEvent = await event(shut, `Shut ${tier}`);
    assert.equal((await enter(shutEvent.id, who)).outcome, 'refused');
    assert.equal(await seatOf(shut, who.accountId), undefined);
    assert.equal((await requestsOf(shut, who.accountId)).length, 0);

    const { banFromClan } = await import('../src/lib/clanBans.ts');
    const barred = await newcomer(tier);
    await banFromClan({ clanId: host, playerId: barred.playerId, byUserId: staffUser });
    const ev = await event(host, `Door ${tier}`);
    const refused = await enter(ev.id, barred, await invite(ev));
    assert.equal(refused.outcome, 'refused', 'an invite does not get a barred person in');
    assert.equal(await seatOf(host, barred.accountId), undefined);

    const removed = await newcomer(tier);
    assert.equal((await apply('host', removed)).json.seated, true);
    assert.equal((await review((await seatOf(host, removed.accountId)).id, 'not_member', 'host')).status, 200);
    assert.equal((await enter(ev.id, removed)).outcome, 'pending');
    assert.ok((await seatOf(host, removed.accountId)).leftAt, 'the seat stays ended');
  });
}
