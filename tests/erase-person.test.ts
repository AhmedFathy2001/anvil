// Deleting an account, and downloading its data, against a real database.
//
// The pure half (tests/person-data-inventory.test.ts, tests/erase-rules.test.ts) checks the list and
// the rules. This checks what the list DOES: a person with a login, two characters, a seat, an event
// entry with a submission, a staff role, plugin sign-ins, goals, pictures and two bans is deleted,
// and afterwards the person is gone and the clan's records are exactly where they were. Then the
// bans: they survive in banned_discord_ids (no stand-in login), staff can see and lift them, and the
// same Discord account signing in again is banned again.
//
// Needs the test database (tests/helpers/testDb.ts). Run: npm run test:erasedb

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq, inArray, isNull } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('erase-person');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let erasePerson: typeof import('../src/lib/erasePerson.ts')['erasePerson'];
let exportPerson: typeof import('../src/lib/exportPerson.ts')['exportPerson'];
let bans: typeof import('../src/lib/deletedAccountBans.ts');
let completeDiscordLogin: typeof import('../src/lib/discord-login.ts')['completeDiscordLogin'];
let isBannedFromClan: typeof import('../src/lib/clanBans.ts')['isBannedFromClan'];

let clanId: number;
let otherClanId: number;
let eventId: number;
let teamId: number;
let tileId: number;

const DISCORD_ID = '223344556677889900';

const person = async (name: string) => (await db.insert(s.players).values({ displayName: name }).returning())[0].id;
const account = async (playerId: number, rsn: string, extra: Record<string, unknown> = {}) =>
  (await db.insert(s.accounts).values({ playerId, rsn, rsnNormalized: rsn.toLowerCase(), ...extra }).returning())[0].id;
const login = async (playerId: number, name: string, extra: Record<string, unknown> = {}) =>
  (await db.insert(s.users).values({ displayName: name, playerId, ...extra }).returning())[0].id;

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  ({ erasePerson } = await import('../src/lib/erasePerson.ts'));
  ({ exportPerson } = await import('../src/lib/exportPerson.ts'));
  bans = await import('../src/lib/deletedAccountBans.ts');
  ({ completeDiscordLogin } = await import('../src/lib/discord-login.ts'));
  ({ isBannedFromClan } = await import('../src/lib/clanBans.ts'));

  const [clan] = await db.insert(s.clans).values({ slug: 'afk', name: 'The AFK Spot' }).returning();
  clanId = clan.id;
  const [other] = await db.insert(s.clans).values({ slug: 'iron', name: 'Iron Foundry' }).returning();
  otherClanId = other.id;
  const [ev] = await db.insert(s.events).values({ clanId, name: 'Bingo', boardSize: 25 }).returning();
  eventId = ev.id;
  const [team] = await db.insert(s.teams).values({ eventId, name: 'Red', color: '#f00' }).returning();
  teamId = team.id;
  const [tile] = await db.insert(s.tiles).values({ eventId, position: 0, label: 'Any pet' }).returning();
  tileId = tile.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

/** A full person: everything the deletion has to decide about, in one place. */
async function plantPerson(name: string, discordId: string) {
  const playerId = await person(name);
  const userId = await login(playerId, name, {
    discordId,
    discordUsername: `${name}#1`,
    email: `${name}@example.test`,
    pluginTokenHash: `hash-${name}`,
  });
  // A character on a clan's roster and in its event, and one on no clan record at all.
  const seated = await account(playerId, `${name}Main`, {
    accountHash: `acct-${name}`,
    discordId,
    claimedAt: '2026-01-01 00:00:00',
    verifiedAt: '2026-01-01 00:00:00',
    verificationMethod: 'plugin',
    isPrimary: 1,
    supporterStyle: '{"preset":"gold"}',
  });
  const loose = await account(playerId, `${name}Alt`);
  const [seat] = await db.insert(s.clanMemberships).values({ clanId, accountId: seated }).returning();
  const [entry] = await db
    .insert(s.eventParticipants)
    .values({ eventId, name: `${name}Main`, accountId: seated, clanMemberId: seat.id, teamId, discord: `${name}#1`, timezone: 'Europe/London', playerToken: `pt-${name}` })
    .returning();
  const [submission] = await db
    .insert(s.submissions)
    .values({ tileId, teamId, playerId: entry.id, imageUrl: `https://media.example.test/c/afk/submissions/${name}.webp` })
    .returning();
  const [signup] = await db
    .insert(s.eventSignups)
    .values({ eventId, userId, clanMemberId: seat.id, profileData: '{"timezone":"Europe/London"}' })
    .returning();

  await db.insert(s.clanStaff).values({ clanId, userId, role: 'admin' });
  await db.insert(s.pluginLinks).values({ userId, tokenHash: `link-${name}` });
  await db.insert(s.profileMedia).values({ userId, avatarUrl: `https://media.example.test/avatars/${name}.webp` });
  await db.insert(s.accountMedia).values({ accountId: seated, bannerUrl: `https://media.example.test/banners/${name}.webp`, ownerPlayerId: playerId });
  await db.insert(s.playerGoals).values({ accountId: seated, kind: 'level', metric: 'attack', target: 99, createdAt: '2026-01-01' });
  await db.insert(s.userWebhooks).values({ userId, url: `https://discord.example.test/webhooks/${name}` });
  await db.insert(s.supporterSubscriptions).values({ userId, tier: 'supporter', status: 'ended', startedAt: '2026-01-01 00:00:00', gumroadSubscriptionId: `sub-${name}` });
  await db.insert(s.clanAuditLog).values({ clanId, clanMemberId: seat.id, eventType: 'claimed', actorUserId: userId, newValue: JSON.stringify({ userId, discordId }) });
  return { playerId, userId, seated, loose, seatId: seat.id, entryId: entry.id, submissionId: submission.id, signupId: signup.id };
}

test('the person goes; the clan’s roster seat and event history stay under the in-game name', async () => {
  const p = await plantPerson('Zezima', DISCORD_ID);
  // A ban still in force in another clan, and one that was lifted long ago.
  await db
    .insert(s.clanBans)
    .values({ clanId: otherClanId, playerId: p.playerId, accountId: p.seated, reason: `Zezima#1 (${DISCORD_ID}) was rude to new members`, bannedAt: '2026-03-03 12:00:00' });
  await db.insert(s.clanBans).values({ clanId, playerId: p.playerId, reason: 'old', liftedAt: '2026-02-01 00:00:00' });
  // The other clan's own record of banning them, written by its moderator and naming their Discord id.
  const modPlayer = await person('Mod');
  const mod = await login(modPlayer, 'Mod');
  const [banLog] = await db
    .insert(s.clanAuditLog)
    .values({
      clanId: otherClanId,
      eventType: 'clan_banned',
      actorUserId: mod,
      oldValue: JSON.stringify({ discordUsername: 'Zezima#1' }),
      newValue: JSON.stringify({ discordId: DISCORD_ID, reason: 'was rude' }),
      notes: `banned ${DISCORD_ID}`,
    })
    .returning();
  // A row that only CONTAINS those digits inside a longer number is about something else.
  const [lookalike] = await db
    .insert(s.clanAuditLog)
    .values({ clanId, eventType: 'webhook_added', newValue: JSON.stringify({ webhookId: `9${DISCORD_ID}1` }) })
    .returning();
  const [merge] = await db
    .insert(s.clanAuditLog)
    .values({
      clanId: null,
      eventType: 'platform_people_merged',
      oldValue: JSON.stringify({ playerId: 987654, displayName: 'ghost' }),
      newValue: JSON.stringify({ playerId: p.playerId, displayName: 'Zezima', moved: { accounts: 1 }, reason: null }),
    })
    .returning();
  const logRowsBefore = (await db.select().from(s.clanAuditLog)).length;
  // Somebody else, who must not be touched.
  const bystander = await plantPerson('Durial', '998877665544332211');

  const r = await erasePerson({ userId: p.userId });
  assert.ok(r.ok && !r.alreadyGone, JSON.stringify(r));
  assert.equal(r.summary.charactersKept, 1);
  assert.equal(r.summary.charactersDeleted, 1);
  assert.equal(r.summary.banRecordKept, true);

  // Removed completely.
  assert.equal((await db.select().from(s.users).where(eq(s.users.id, p.userId))).length, 0, 'the login');
  assert.equal((await db.select().from(s.players).where(eq(s.players.id, p.playerId))).length, 0, 'the person');
  assert.equal((await db.select().from(s.accounts).where(eq(s.accounts.id, p.loose))).length, 0, 'a character on no clan record');
  assert.equal((await db.select().from(s.clanStaff).where(eq(s.clanStaff.userId, p.userId))).length, 0, 'staff roles');
  assert.equal((await db.select().from(s.pluginLinks).where(eq(s.pluginLinks.userId, p.userId))).length, 0, 'plugin sign-ins');
  assert.equal((await db.select().from(s.profileMedia).where(eq(s.profileMedia.userId, p.userId))).length, 0, 'profile pictures');
  assert.equal((await db.select().from(s.accountMedia).where(eq(s.accountMedia.accountId, p.seated))).length, 0, 'character pictures');
  assert.equal((await db.select().from(s.playerGoals).where(eq(s.playerGoals.accountId, p.seated))).length, 0, 'goals');
  assert.equal((await db.select().from(s.userWebhooks).where(eq(s.userWebhooks.userId, p.userId))).length, 0, 'webhooks');
  assert.equal((await db.select().from(s.supporterSubscriptions).where(eq(s.supporterSubscriptions.userId, p.userId))).length, 0, 'Supporter rows');

  // The clan's records stay, and stop pointing at the person.
  const [kept] = await db.select().from(s.accounts).where(eq(s.accounts.id, p.seated));
  assert.ok(kept, 'the seated character stays as a name');
  assert.equal(kept.rsn, 'ZezimaMain');
  assert.notEqual(kept.playerId, p.playerId);
  assert.equal(kept.claimedAt, null);
  assert.equal(kept.verifiedAt, null);
  assert.equal(kept.accountHash, null);
  assert.equal(kept.discordId, null);
  assert.equal(kept.supporterStyle, null);
  assert.equal(kept.isPrimary, 0);
  const [placeholder] = await db.select().from(s.players).where(eq(s.players.id, kept.playerId));
  assert.equal(placeholder.displayName, 'ZezimaMain', 'held by a stand-in named after the RSN, as a released character is');
  assert.equal((await db.select().from(s.users).where(eq(s.users.playerId, kept.playerId))).length, 0, 'which nobody signs in as');

  assert.equal((await db.select().from(s.clanMemberships).where(eq(s.clanMemberships.id, p.seatId))).length, 1, 'the seat');
  const [entry] = await db.select().from(s.eventParticipants).where(eq(s.eventParticipants.id, p.entryId));
  assert.equal(entry.name, 'ZezimaMain');
  assert.equal(entry.accountId, p.seated);
  assert.equal(entry.discord, null);
  assert.equal(entry.timezone, null);
  assert.equal(entry.playerToken, null);
  const [submission] = await db.select().from(s.submissions).where(eq(s.submissions.id, p.submissionId));
  assert.ok(submission?.imageUrl, 'the proof stays as the clan’s evidence');
  const [signup] = await db.select().from(s.eventSignups).where(eq(s.eventSignups.id, p.signupId));
  assert.equal(signup.userId, null);
  assert.equal(signup.profileData, '{}');

  // The ban still in force survives as ONE ROW OF banned_discord_ids, and nothing else: no stand-in
  // login, no stand-in person, no clan_bans row left pointing at anybody.
  assert.equal((await db.select().from(s.users).where(eq(s.users.discordId, DISCORD_ID))).length, 0, 'no login holds their Discord id');
  assert.equal((await db.select().from(s.users).where(eq(s.users.displayName, ''))).length, 0, 'no nameless login for staff lists to show');
  assert.equal((await db.select().from(s.players).where(isNull(s.players.displayName))).length, 0, 'no nameless person');
  assert.equal((await db.select().from(s.clanBans)).length, 0, 'the ban rows went with the person, lifted one included');
  const keptBans = await db.select().from(s.bannedDiscordIds).where(eq(s.bannedDiscordIds.discordId, DISCORD_ID));
  assert.equal(keptBans.length, 1);
  assert.equal(keptBans[0].scope, 'clan');
  assert.equal(keptBans[0].clanId, otherClanId);
  assert.equal(keptBans[0].bannedAt, '2026-03-03 12:00:00', 'the clan’s own date');
  // The clan's reason is kept; the person's Discord name and id inside it are not.
  assert.equal(keptBans[0].reason, '[deleted] ([deleted]) was rude to new members');
  assert.equal((await db.select().from(s.bannedDiscordIds)).length, 1, 'a lifted ban is not kept, and nobody else’s is touched');

  // THE LOG IS NEVER DELETED FROM. The clan's ban entry is still there, same action, clan, actor
  // and reason; only the id and the Discord name inside it are gone.
  const [banAfter] = await db.select().from(s.clanAuditLog).where(eq(s.clanAuditLog.id, banLog.id));
  assert.ok(banAfter, 'a clan’s moderation history survives the person it is about');
  assert.equal(banAfter.eventType, 'clan_banned');
  assert.equal(banAfter.clanId, otherClanId);
  assert.equal(banAfter.actorUserId, mod);
  assert.equal(banAfter.occurredAt, banLog.occurredAt);
  assert.deepEqual(JSON.parse(banAfter.newValue!), { discordId: '[deleted]', reason: 'was rude' });
  assert.deepEqual(JSON.parse(banAfter.oldValue!), { discordUsername: '[deleted]' });
  assert.equal(banAfter.notes, 'banned [deleted]');
  const [lookalikeAfter] = await db.select().from(s.clanAuditLog).where(eq(s.clanAuditLog.id, lookalike.id));
  assert.equal(lookalikeAfter.newValue, lookalike.newValue, 'digits inside a longer number are not their id');
  const [mergeAfter] = await db.select().from(s.clanAuditLog).where(eq(s.clanAuditLog.id, merge.id));
  assert.deepEqual(JSON.parse(mergeAfter.newValue!), { playerId: null, displayName: '[deleted]', moved: { accounts: 1 }, reason: null });
  assert.equal(mergeAfter.oldValue, merge.oldValue, 'the other side of the merge is somebody else');
  const claimedRows = (await db.select().from(s.clanAuditLog).where(eq(s.clanAuditLog.clanMemberId, p.seatId))).filter((l) => l.eventType === 'claimed');
  assert.equal(claimedRows.length, 1, 'their own claim entry stays');
  assert.equal(claimedRows[0].actorUserId, null);
  assert.equal(JSON.parse(claimedRows[0].newValue!).discordId, '[deleted]');

  // One audit entry, and nothing in the log that says who.
  const log = await db.select().from(s.clanAuditLog);
  // Every row from before is still there; the bystander's one and the deletion entry were added.
  assert.equal(log.length, logRowsBefore + 2);
  const deleted = log.filter((l) => l.eventType === 'platform_account_deleted');
  assert.equal(deleted.length, 1);
  assert.equal(deleted[0].actorUserId, null);
  assert.equal(deleted[0].clanId, null);
  for (const l of log) {
    if (l.id === lookalike.id) continue; // holds those digits inside a longer number, on purpose
    const text = `${l.oldValue ?? ''}${l.newValue ?? ''}${l.notes ?? ''}`;
    assert.ok(!text.includes(DISCORD_ID), 'no log row carries the Discord id');
    assert.ok(!text.includes('Zezima@example.test'));
  }

  // Nobody else was touched.
  assert.equal((await db.select().from(s.users).where(eq(s.users.id, bystander.userId))).length, 1);
  assert.equal((await db.select().from(s.accounts).where(inArray(s.accounts.id, [bystander.seated, bystander.loose]))).length, 2);
  const [theirs] = await db.select().from(s.accounts).where(eq(s.accounts.id, bystander.seated));
  assert.equal(theirs.playerId, bystander.playerId);
  assert.equal(theirs.discordId, '998877665544332211');
  assert.equal((await db.select().from(s.pluginLinks).where(eq(s.pluginLinks.userId, bystander.userId))).length, 1);
  assert.equal((await db.select().from(s.playerGoals).where(eq(s.playerGoals.accountId, bystander.seated))).length, 1);
  assert.equal((await db.select().from(s.clanStaff).where(eq(s.clanStaff.userId, bystander.userId))).length, 1);

  // Twice is the same as once.
  const again = await erasePerson({ userId: p.userId });
  assert.deepEqual(again, { ok: true, alreadyGone: true });
  assert.equal((await db.select().from(s.clanAuditLog).where(eq(s.clanAuditLog.eventType, 'platform_account_deleted'))).length, 1);
});

test('an owner cannot delete until the clan is handed over, and nothing is touched', async () => {
  const playerId = await person('Owner');
  const userId = await login(playerId, 'Owner', { discordId: '111111111111111111' });
  const [mine] = await db.insert(s.clans).values({ slug: 'owned', name: 'Owned Clan' }).returning();
  await db.insert(s.clanStaff).values({ clanId: mine.id, userId, role: 'owner' });

  const r = await erasePerson({ userId });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.deepEqual(r.blockers.map((b) => b.kind), ['owns-clan']);
    assert.match(r.blockers[0].message, /Owned Clan/);
  }
  assert.equal((await db.select().from(s.users).where(eq(s.users.id, userId))).length, 1);
  assert.equal((await db.select().from(s.clanStaff).where(eq(s.clanStaff.userId, userId))).length, 1);

  // Handed over (an ordinary admin now): it goes through.
  await db.update(s.clanStaff).set({ role: 'admin' }).where(eq(s.clanStaff.userId, userId));
  const ok = await erasePerson({ userId });
  assert.ok(ok.ok && !ok.alreadyGone);
  assert.equal((await db.select().from(s.clans).where(eq(s.clans.id, mine.id))).length, 1, 'the clan is not the person’s to take with them');
});

test('a paid plan that still renews blocks; once the site sees it cancelled, it does not', async () => {
  const playerId = await person('Payer');
  const userId = await login(playerId, 'Payer', { discordId: '222222222222222222' });
  const [sub] = await db
    .insert(s.supporterSubscriptions)
    .values({ userId, tier: 'supporter', status: 'active', startedAt: '2026-01-01 00:00:00', gumroadSubscriptionId: 'sub-live' })
    .returning();

  const r = await erasePerson({ userId });
  assert.equal(r.ok, false);
  if (!r.ok) assert.deepEqual(r.blockers.map((b) => b.kind), ['active-plan']);
  assert.equal((await db.select().from(s.users).where(eq(s.users.id, userId))).length, 1);

  await db.update(s.supporterSubscriptions).set({ status: 'cancelling' }).where(eq(s.supporterSubscriptions.id, sub.id));
  const ok = await erasePerson({ userId });
  assert.ok(ok.ok && !ok.alreadyGone);
  assert.equal(ok.summary.banRecordKept, false);
  assert.equal((await db.select().from(s.users).where(eq(s.users.discordId, '222222222222222222'))).length, 0);
  assert.equal(
    (await db.select().from(s.bannedDiscordIds).where(eq(s.bannedDiscordIds.discordId, '222222222222222222'))).length,
    0,
    'no ban, so nothing about them is left in the ban table',
  );
});

test('the export holds their own rows, as links and dates, and never a token or anyone else', async () => {
  const p = await plantPerson('Exporter', '333333333333333333');
  const other = await plantPerson('Stranger', '444444444444444444');

  const out = await exportPerson(p.userId);
  assert.ok(out);
  const text = JSON.stringify(out);

  assert.equal(out.data.account?.[0]?.email, 'Exporter@example.test');
  assert.equal(out.data.account?.[0]?.discord_id, '333333333333333333');
  assert.deepEqual(out.data.characters?.map((c) => c.rsn).sort(), ['ExporterAlt', 'ExporterMain']);
  assert.equal(out.data.clan_memberships?.length, 1);
  assert.equal(out.data.roles?.[0]?.role, 'admin');
  assert.equal(out.data.event_entries?.[0]?.name, 'ExporterMain');
  assert.match(String(out.data.proofs_submitted?.[0]?.image_url), /^https:\/\//);
  assert.equal(out.data.goals?.length, 1);
  assert.equal(out.data.supporter?.[0]?.tier, 'supporter');
  assert.deepEqual(Object.keys(out.data.plugin_sign_ins?.[0] ?? {}).sort(), ['_from', 'created_at', 'id', 'last_used_at', 'revoked_at']);

  // Never a secret.
  for (const secret of ['hash-Exporter', 'link-Exporter', 'acct-Exporter', 'pt-Exporter', 'discord.example.test/webhooks']) {
    assert.ok(!text.includes(secret), `${secret} must not be in the export`);
  }
  // Never somebody else.
  for (const theirs of ['Stranger', '444444444444444444']) assert.ok(!text.includes(theirs), `${theirs} must not be in the export`);
  assert.equal(await exportPerson(other.userId + 100_000), null);
});

test('a character taken over from someone else does not bring their answers into the export', async () => {
  // The first holder: signs up with answers, asks to join a clan with a message, sets a goal, sends a proof.
  const first = await person('First');
  const firstLogin = await login(first, 'First', { discordId: '555555555555555555' });
  const acct = await account(first, 'SharedName', { claimedAt: '2026-01-01 00:00:00' });
  const [seat] = await db.insert(s.clanMemberships).values({ clanId, accountId: acct }).returning();
  const [entry] = await db
    .insert(s.eventParticipants)
    .values({ eventId, name: 'SharedName', accountId: acct, clanMemberId: seat.id, teamId, discord: 'first-holder#9', timezone: 'Pacific/Auckland' })
    .returning();
  await db.insert(s.eventSignups).values({ eventId, userId: firstLogin, clanMemberId: seat.id, profileData: '{"about":"first holder secret answer"}' });
  await db.insert(s.clanJoinRequests).values({ clanId: otherClanId, accountId: acct, playerId: first, message: 'first holder private message' });
  await db.insert(s.playerGoals).values({ accountId: acct, kind: 'level', metric: 'first-holder-goal', target: 50, createdAt: '2026-02-01 00:00:00' });
  await db
    .insert(s.submissions)
    .values({ tileId, teamId, playerId: entry.id, imageUrl: 'https://media.example.test/c/afk/submissions/first-holder.webp', note: 'first holder note', createdAt: '2026-02-01 00:00:00' });

  // The character changes hands: released, then claimed by somebody new, later.
  const second = await person('Second');
  const secondLogin = await login(second, 'Second', { discordId: '666666666666666666' });
  await db.update(s.accounts).set({ playerId: second, claimedAt: '2026-06-01 00:00:00' }).where(eq(s.accounts.id, acct));
  // What the new holder did themselves, after.
  await db.insert(s.playerGoals).values({ accountId: acct, kind: 'level', metric: 'second-holder-goal', target: 99, createdAt: '2026-06-02 00:00:00' });
  await db
    .insert(s.submissions)
    .values({ tileId, teamId, playerId: entry.id, imageUrl: 'https://media.example.test/c/afk/submissions/second-holder.webp', note: 'second holder note', createdAt: '2026-06-02T10:00:00.000Z' });
  await db.insert(s.clanJoinRequests).values({ clanId: otherClanId, accountId: acct, playerId: second, message: 'second holder message', status: 'withdrawn' });

  const out = await exportPerson(secondLogin);
  assert.ok(out);
  const text = JSON.stringify(out);

  // Theirs.
  assert.deepEqual(out.data.characters?.map((c) => c.rsn), ['SharedName']);
  assert.equal(out.data.clan_memberships?.length, 1, 'the seat itself: ids and dates');
  assert.deepEqual(out.data.goals?.map((g) => g.metric), ['second-holder-goal']);
  assert.deepEqual(out.data.proofs_submitted?.map((r) => r.note), ['second holder note']);
  assert.deepEqual(out.data.clan_join_requests?.map((r) => r.message), ['second holder message']);
  assert.equal(out.data.event_entries?.[0]?.name, 'SharedName');

  // Never the previous holder's.
  for (const leaked of ['first holder', 'first-holder', 'Pacific/Auckland', '555555555555555555']) {
    assert.ok(!text.includes(leaked), `"${leaked}" is the previous holder’s and must not be in the export`);
  }
  assert.equal(out.data.event_signups, undefined, 'a sign-up somebody else wrote is not theirs');
  for (const row of out.data.event_entries ?? []) {
    assert.ok(!('discord' in row) && !('timezone' in row), 'an event entry carries no personal column');
  }

  // And the first holder still gets their own answers.
  const theirs = JSON.stringify(await exportPerson(firstLogin));
  assert.ok(theirs.includes('first holder secret answer'));
  assert.ok(!theirs.includes('second holder'));
});

// ── Bans that outlive the account ─────────────────────────────────────────────────────────────

/** Sign in with a Discord account, the way the OAuth callback does once Discord has vouched for it. */
const signIn = (discordId: string, username: string) =>
  completeDiscordLogin(
    { id: discordId, username, globalName: username, avatar: null, email: null } as Parameters<typeof completeDiscordLogin>[0],
    { returnTo: '/', request: new Request('http://localhost/api/auth/discord/callback') },
  );
const sessionCookie = (res: Response) => res.headers.getSetCookie().find((c) => c.startsWith('admin_session='));

test('a clan-banned person who deletes: the clan sees "Deleted account" with its reason, and can lift it', async () => {
  const DISCORD = '700000000000000001';
  const playerId = await person('Griefer');
  const userId = await login(playerId, 'Griefer', { discordId: DISCORD, discordUsername: 'griefer99' });
  const modPerson = await person('BanMod');
  const mod = await login(modPerson, 'BanMod');
  // The other clan already holds a kept ban from an earlier deletion; it must be left alone.
  const otherBefore = (await bans.deletedAccountClanBans(otherClanId)).length;
  await db.insert(s.clanBans).values({ clanId, playerId, reason: 'griefer99 crashed three raids', bannedByUserId: mod, bannedAt: '2026-05-05 08:00:00' });
  await db.insert(s.clanBans).values({ clanId: otherClanId, playerId, reason: null, bannedAt: '2026-05-06 08:00:00' });

  const r = await erasePerson({ userId });
  assert.ok(r.ok && !r.alreadyGone && r.summary.banRecordKept);
  assert.equal((await db.select().from(s.users).where(eq(s.users.discordId, DISCORD))).length, 0, 'no stand-in login');

  // The clan's ban list: no name, no Discord id, the clan's date and reason.
  const list = await bans.deletedAccountClanBans(clanId);
  assert.equal(list.length, 1);
  assert.deepEqual(Object.keys(list[0]).sort(), ['bannedAt', 'id', 'kind', 'reason']);
  assert.equal(list[0].kind, 'deleted');
  assert.equal(list[0].bannedAt, '2026-05-05 08:00:00');
  assert.equal(list[0].reason, '[deleted] crashed three raids');
  const [row] = await db.select().from(s.bannedDiscordIds).where(eq(s.bannedDiscordIds.id, list[0].id));
  assert.equal(row.bannedByUserId, mod, 'who set it is still on record');

  // Another clan cannot lift it, and a made-up id lifts nothing.
  assert.equal(await bans.liftDeletedAccountClanBan(otherClanId, list[0].id, mod), false);
  assert.equal(await bans.liftDeletedAccountClanBan(clanId, 999_999, mod), false);
  assert.equal((await bans.deletedAccountClanBans(clanId)).length, 1);

  // Lifting removes the row, and only that clan's.
  assert.equal(await bans.liftDeletedAccountClanBan(clanId, list[0].id, mod), true);
  assert.equal((await bans.deletedAccountClanBans(clanId)).length, 0);
  assert.equal((await bans.deletedAccountClanBans(otherClanId)).length, otherBefore + 1, 'the other clan’s bans are its own');
  const lifted = await db.select().from(s.clanAuditLog).where(and(eq(s.clanAuditLog.clanId, clanId), eq(s.clanAuditLog.eventType, 'clan_unbanned')));
  assert.equal(lifted.at(-1)?.actorUserId, mod, 'and it is on the clan’s record');

  // They come back: banned again where the ban was kept, free where it was lifted.
  const res = await signIn(DISCORD, 'griefer99');
  assert.ok(sessionCookie(res), 'a clan ban does not stop them signing in');
  const [back] = await db.select().from(s.users).where(eq(s.users.discordId, DISCORD));
  assert.ok(back?.playerId);
  assert.equal(await isBannedFromClan(otherClanId, back.playerId), true);
  assert.equal(await isBannedFromClan(clanId, back.playerId), false, 'the lifted one does not come back');
});

test('the same Discord account signing in again is banned from that clan again, with the clan’s reason', async () => {
  const DISCORD = '700000000000000002';
  const playerId = await person('Returner');
  const userId = await login(playerId, 'Returner', { discordId: DISCORD, discordUsername: 'returner' });
  await db.insert(s.clanBans).values({ clanId, playerId, reason: 'kept luring members', bannedAt: '2026-06-01 09:30:00' });
  assert.ok((await erasePerson({ userId })).ok);
  assert.equal((await db.select().from(s.bannedDiscordIds).where(eq(s.bannedDiscordIds.discordId, DISCORD))).length, 1);

  const res = await signIn(DISCORD, 'returner');
  assert.ok(sessionCookie(res));
  const [back] = await db.select().from(s.users).where(eq(s.users.discordId, DISCORD));
  assert.notEqual(back.playerId, playerId, 'a new person');
  assert.notEqual(back.id, userId);

  // A real clan ban on the new person, through the ordinary code path.
  assert.equal(await isBannedFromClan(clanId, back.playerId), true);
  assert.equal(await isBannedFromClan(otherClanId, back.playerId), false);
  const [ban] = await db.select().from(s.clanBans).where(and(eq(s.clanBans.clanId, clanId), eq(s.clanBans.playerId, back.playerId!)));
  assert.equal(ban.reason, 'kept luring members');
  assert.equal(ban.bannedAt, '2026-06-01 09:30:00');
  assert.equal(ban.liftedAt, null);
  // The kept row was used up: the ban lives in one place.
  assert.equal((await db.select().from(s.bannedDiscordIds).where(eq(s.bannedDiscordIds.discordId, DISCORD))).length, 0);
  // The clan can still see it and lift it: there is no character on its roster to show it beside.
  const shown = (await bans.deletedAccountClanBans(clanId)).filter((b) => b.reason === 'kept luring members');
  assert.deepEqual(shown.map((b) => [b.kind, b.id, b.bannedAt]), [['returned', ban.id, '2026-06-01 09:30:00']]);
  assert.equal(await bans.liftDeletedAccountClanBan(otherClanId, ban.id, back.id, 'returned'), false, 'not another clan’s to lift');
  assert.equal(await bans.liftDeletedAccountClanBan(clanId, ban.id, back.id, 'returned'), true);
  assert.equal(await isBannedFromClan(clanId, back.playerId), false);
  assert.equal((await bans.deletedAccountClanBans(clanId)).filter((b) => b.reason === 'kept luring members').length, 0);
  // Banned again by the clan, for the rest of this test.
  await db.insert(s.clanBans).values({ clanId, playerId: back.playerId!, reason: 'kept luring members', bannedAt: '2026-06-01 09:30:00' });

  // Signing in again changes nothing.
  await signIn(DISCORD, 'returner');
  assert.equal((await db.select().from(s.clanBans).where(and(eq(s.clanBans.playerId, back.playerId!), isNull(s.clanBans.liftedAt)))).length, 1);

  // Deleting AGAIN keeps it again: the cycle cannot be used to shake a ban off.
  assert.ok((await erasePerson({ userId: back.id })).ok);
  const again = await db.select().from(s.bannedDiscordIds).where(eq(s.bannedDiscordIds.discordId, DISCORD));
  assert.equal(again.length, 1);
  assert.equal(again[0].reason, 'kept luring members');
});

test('a platform-banned person who deletes cannot sign back in, until platform staff lift it', async () => {
  const DISCORD = '700000000000000003';
  const playerId = await person('Barred');
  const userId = await login(playerId, 'Barred', { discordId: DISCORD, discordUsername: 'barred' });
  await db.update(s.players).set({ banned: true, bannedAt: '2026-07-07 07:00:00', bannedReason: 'staff note that must not be kept' }).where(eq(s.players.id, playerId));

  assert.ok((await erasePerson({ userId })).ok);
  const kept = await db.select().from(s.bannedDiscordIds).where(eq(s.bannedDiscordIds.discordId, DISCORD));
  assert.equal(kept.length, 1);
  assert.equal(kept[0].scope, 'platform');
  assert.equal(kept[0].clanId, null);
  assert.equal(kept[0].reason, null, 'a platform ban keeps no reason');
  assert.equal(kept[0].bannedAt, '2026-07-07 07:00:00');

  const peopleBefore = (await db.select().from(s.players)).length;
  const res = await signIn(DISCORD, 'barred');
  assert.equal(sessionCookie(res), undefined, 'no session');
  assert.match(res.headers.get('location') ?? '', /\/login\?error=banned/);
  assert.equal((await db.select().from(s.users).where(eq(s.users.discordId, DISCORD))).length, 0, 'and no new login was made for them');
  assert.equal((await db.select().from(s.players)).length, peopleBefore, 'nor a new person');

  // Platform staff see it and lift it; then the Discord account can start again.
  const staffPerson = await person('Staff');
  const staff = await login(staffPerson, 'Staff');
  const listed = (await bans.deletedAccountPlatformBans()).filter((b) => b.discordId === DISCORD);
  assert.equal(listed.length, 1);
  assert.equal(await bans.liftDeletedAccountPlatformBan(listed[0].id, staff), true);
  assert.equal(await bans.discordIdPlatformBanned(DISCORD), false);
  assert.ok(sessionCookie(await signIn(DISCORD, 'barred')));
});

test('a login-level ban is kept as a platform ban too', async () => {
  const DISCORD = '700000000000000004';
  const playerId = await person('LoginBarred');
  const userId = await login(playerId, 'LoginBarred', { discordId: DISCORD, banned: true, bannedAt: '2026-08-08 08:00:00' });
  assert.ok((await erasePerson({ userId })).ok);
  assert.equal(await bans.discordIdPlatformBanned(DISCORD), true);
  assert.equal(sessionCookie(await signIn(DISCORD, 'loginbarred')), undefined);
});

test('a person with no bans leaves nothing in the ban table, and signs in again as anyone would', async () => {
  const DISCORD = '700000000000000005';
  const before = (await db.select().from(s.bannedDiscordIds)).length;
  const p = await plantPerson('Clean', DISCORD);
  // A ban that was lifted long ago is not a ban.
  await db.insert(s.clanBans).values({ clanId, playerId: p.playerId, reason: 'old', liftedAt: '2026-02-01 00:00:00' });
  // Their own role is handed on first; an admin may delete.
  const r = await erasePerson({ userId: p.userId });
  assert.ok(r.ok && !r.alreadyGone);
  assert.equal(r.summary.banRecordKept, false);
  assert.equal((await db.select().from(s.bannedDiscordIds)).length, before);
  assert.equal((await db.select().from(s.bannedDiscordIds).where(eq(s.bannedDiscordIds.discordId, DISCORD))).length, 0);

  const res = await signIn(DISCORD, 'clean');
  assert.ok(sessionCookie(res));
  const [back] = await db.select().from(s.users).where(eq(s.users.discordId, DISCORD));
  assert.equal(await isBannedFromClan(clanId, back.playerId), false);
});
