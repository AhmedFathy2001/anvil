// First run, for a person — and for a clan.
//
// Both flows were implicit while a deployment WAS a clan: you arrived at your clan's site, so there
// was always a clan and your RSN was already on its roster. On one platform the front door is the
// apex, where a new person has none of that, and every assumption the old flows rested on is now a
// thing that may simply not be true yet.
//
// What this pins down, in the order it bit:
//
//   THE CLAN'S NAME HAD TWO SOURCES AND THE WRONG ONE WON. `createClan` writes clans.name and no
//   setting; every reader went to the `clan_name` SETTING. So a clan made through /clans/new
//   rendered its own home page as "Anvil" — nine times, in the title, the hero and the nav. Nothing
//   errored, because a fallback firing looks exactly like a fallback not firing.
//
//   THE SETUP CHECKLIST COUNTED EVERY CLAN'S WORK AS YOURS. `from(events)` and `from(tiles)` carried
//   no clan filter — correct exactly once, when a deployment could only have one clan's rows. A
//   brand-new clan opened its checklist with two of four steps already ticked.
//
//   THE STEPS ARE DERIVED, so they must follow the world. Somebody who skips "join a clan" and is
//   then added to one by an admin has to see it DONE, not skipped, or the flow argues with the data
//   it is drawn from.
//
// Run: npx tsx --test tests/onboarding.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('onboarding');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let O: typeof import('../src/lib/onboarding.ts');
let S: typeof import('../src/lib/setupStatus.ts');
let P: typeof import('../src/lib/pluginConfig.ts');

/** The clan that has been running for a year, and the one made thirty seconds ago. */
let busyClan: number;
let freshClan: number;
/** A person with nothing: a login, a person row, no account, no seat, no clan. */
let newbieUser: number;
let newbiePlayer: number;

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  O = await import('../src/lib/onboarding.ts');
  S = await import('../src/lib/setupStatus.ts');
  P = await import('../src/lib/pluginConfig.ts');

  const [busy] = await db
    .insert(s.clans)
    .values({ slug: 'busy', name: 'The Busy Clan', status: 'active' })
    .returning();
  busyClan = busy.id;

  // Created the way /clans/new creates one: a name on the ROW and no settings at all.
  const [fresh] = await db
    .insert(s.clans)
    .values({ slug: 'fresh', name: 'Fresh Start', status: 'active' })
    .returning();
  freshClan = fresh.id;

  // The busy clan's year of work, which the fresh clan must not be credited with.
  const [ev] = await db
    .insert(s.events)
    .values({ clanId: busyClan, name: 'Summer Bingo', boardSize: 5 })
    .returning();
  await db.insert(s.tiles).values([
    { eventId: ev.id, position: 0, label: 'Whip' },
    { eventId: ev.id, position: 1, label: 'Dragon pickaxe' },
  ]);

  const [person] = await db.insert(s.players).values({ displayName: 'Newbie' }).returning();
  newbiePlayer = person.id;
  const [u] = await db
    .insert(s.users)
    .values({ playerId: person.id, displayName: 'Newbie', discordId: 'newbie-1' })
    .returning();
  newbieUser = u.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

// ── The clan's name ───────────────────────────────────────────────────────────────────────────

test('a clan created through the form is called what it was called', async () => {
  // The bug, exactly: clans.name is set, the setting is absent, and every surface asked the setting.
  assert.equal(await P.getClanDisplayName(freshClan), 'Fresh Start');
});

test('and the fallback is not what a real clan gets', async () => {
  // Belt and braces on the above: if the column read regressed, the assertion there could still pass
  // by coincidence on a clan whose name happened to match. This one cannot.
  const name = await P.getClanDisplayName(freshClan, 'Anvil');
  assert.notEqual(name, 'Anvil');
});

test('a clan with no name anywhere still gets the caller’s fallback', async () => {
  const { db, schema: s } = await loadDb();
  const [blank] = await db.insert(s.clans).values({ slug: 'blank', name: '', status: 'active' }).returning();
  assert.equal(await P.getClanDisplayName(blank.id, 'your clan'), 'your clan');
});

test('the settings mirror does not override the row', async () => {
  // Both exist and agree in the ordinary case; this asserts which one is consulted, so that a later
  // edit to one of them cannot silently become the answer.
  const { db, schema: s } = await loadDb();
  await db.insert(s.settings).values({ clanId: freshClan, key: 'clan_name', value: 'Stale Mirror' });
  assert.equal(await P.getClanDisplayName(freshClan), 'Fresh Start');
  await db
    .delete(s.settings)
    .where(eq(s.settings.clanId, freshClan));
});

// ── The setup checklist ───────────────────────────────────────────────────────────────────────

test('a brand-new clan has done none of the work another clan did', async () => {
  const status = await S.getSetupStatus(freshClan);
  const step = (k: string) => status.steps.find((x) => x.key === k)!;

  // These two were BOTH true before the clan filter went on, because the busy clan above has an
  // event and two tiles. A fresh clan was congratulated on somebody else's board.
  assert.equal(step('event').done, false, 'no events of its own');
  assert.equal(step('tiles').done, false, 'no tiles of its own');

  // And the one it HAS done, which was reported as not done: it named itself on the form.
  assert.equal(step('clan').done, true, 'it has a name, on the row');
});

test('the busy clan is still credited with its own work', async () => {
  const status = await S.getSetupStatus(busyClan);
  const step = (k: string) => status.steps.find((x) => x.key === k)!;
  assert.equal(step('event').done, true);
  assert.equal(step('tiles').done, true);
});

test('a fresh clan is fresh, and one that has been set up is not', async () => {
  const { db, schema: s } = await loadDb();
  assert.equal((await S.getSetupStatus(freshClan)).isFresh, true);

  await db
    .insert(s.settings)
    .values({ clanId: freshClan, key: 'discord_webhook_url', value: 'https://discord.example/hook' });
  assert.equal((await S.getSetupStatus(freshClan)).isFresh, false, 'wired to Discord — not fresh');

  await db.delete(s.settings).where(eq(s.settings.clanId, freshClan));
});

// ── The person's flow ─────────────────────────────────────────────────────────────────────────

test('somebody brand new has done exactly one of the four', async () => {
  const state = await O.onboardingState(newbieUser, newbiePlayer);
  assert.equal(state.doneCount, 1, 'signing in is the one thing they have done');
  assert.equal(state.steps.find((s) => s.key === 'discord')!.done, true);
  assert.equal(state.current, 'character', 'and the character is the first real move');
});

test('the character step comes before the clan and depends on nothing', async () => {
  // It went the other way first, and had to: every path that attached an account to a person ran
  // through a SEAT, so offering the character first would have opened a door that did not open.
  // lib/accountClaim is what changed that — proving a character is a fact about YOU, which is what
  // accounts.verifiedAt has said all along. If `needs` here ever grows a 'clan' back, the claim has
  // been re-coupled to a seat and this is the assertion that should stop it.
  const state = await O.onboardingState(newbieUser, newbiePlayer);
  assert.deepEqual(state.steps.map((s) => s.key), ['discord', 'character', 'clan', 'plugin']);
  assert.deepEqual(state.steps.find((s) => s.key === 'character')!.needs, []);
  assert.deepEqual(state.steps.find((s) => s.key === 'clan')!.needs, []);
});

test('a linked character ticks its step with no clan and no seat anywhere', async () => {
  const { db, schema: s } = await loadDb();
  const C = await import('../src/lib/accountClaim.ts');
  await C.claimAccountForPerson({
    playerId: newbiePlayer,
    rsn: 'Newbie Guy',
    rsnNormalized: 'newbie guy',
    method: 'stat_delta',
    provisional: true,
  });

  const state = await O.onboardingState(newbieUser, newbiePlayer);
  assert.equal(state.steps.find((x) => x.key === 'character')!.done, true);
  assert.equal(state.steps.find((x) => x.key === 'clan')!.done, false, 'still in no clan');
  assert.equal(state.current, 'clan');

  const seats = await db.select().from(s.clanMemberships);
  assert.equal(seats.length, 0, 'proving who you are seats you nowhere');
});

test('joining a clan then ticks the clan step', async () => {
  const { db, schema: s } = await loadDb();
  const [acct] = await db
    .select()
    .from(s.accounts)
    .where(eq(s.accounts.rsnNormalized, 'newbie guy'));
  await db.insert(s.clanMemberships).values({ clanId: busyClan, accountId: acct.id, kind: 'guest' });

  const state = await O.onboardingState(newbieUser, newbiePlayer);
  assert.equal(state.steps.find((x) => x.key === 'clan')!.done, true);
  assert.equal(state.current, 'plugin', 'only the plugin left');
});

test('the plugin step waits for an actual ping, not for a seat', async () => {
  const { db, schema: s } = await loadDb();
  assert.equal((await O.onboardingState(newbieUser, newbiePlayer)).steps.find((x) => x.key === 'plugin')!.done, false);

  // ON THE ACCOUNT, not on the membership — Jagex tracks accounts, not memberships, which is what
  // lets the sweep poll somebody in three clans once instead of three times. A seat is not a ping:
  // being on a roster says an admin added you, and says nothing about the plugin ever having run.
  await db
    .update(s.accounts)
    .set({ liveStatsAt: new Date().toISOString() })
    .where(eq(s.accounts.playerId, newbiePlayer));

  const state = await O.onboardingState(newbieUser, newbiePlayer);
  assert.equal(state.steps.find((x) => x.key === 'plugin')!.done, true);
  assert.equal(state.allSettled, true);
  assert.equal(state.current, null);
});

// ── Skipping ──────────────────────────────────────────────────────────────────────────────────

test('a skipped step stops being the current one, and comes back if unskipped', async () => {
  const { db, schema: s } = await loadDb();
  const [person] = await db.insert(s.players).values({ displayName: 'Skipper' }).returning();
  const [u] = await db
    .insert(s.users)
    .values({ playerId: person.id, displayName: 'Skipper', discordId: 'skipper-1' })
    .returning();

  assert.equal((await O.onboardingState(u.id, person.id)).current, 'character');

  await O.setSkipped(u.id, 'character', true);
  const after = await O.onboardingState(u.id, person.id);
  assert.equal(after.steps.find((x) => x.key === 'character')!.skipped, true);
  assert.equal(after.current, 'clan', 'the flow moves past it');

  await O.setSkipped(u.id, 'character', false);
  assert.equal((await O.onboardingState(u.id, person.id)).current, 'character');
});

test('skipping twice is one entry, not two', async () => {
  const { db, schema: s } = await loadDb();
  const [person] = await db.insert(s.players).values({ displayName: 'Twice' }).returning();
  const [u] = await db
    .insert(s.users)
    .values({ playerId: person.id, displayName: 'Twice', discordId: 'twice-1' })
    .returning();

  await O.setSkipped(u.id, 'clan', true);
  const list = await O.setSkipped(u.id, 'clan', true);
  assert.deepEqual(list, ['clan']);
});

test('a step that turns out to be DONE is not reported as skipped', async () => {
  // The flow is derived from the world, so the world wins. Somebody who passed on joining a clan and
  // was then added to one by an admin must see a tick, not a dash — otherwise the page is arguing
  // with the data it is drawn from.
  const { db, schema: s } = await loadDb();
  const [person] = await db.insert(s.players).values({ displayName: 'Adopted' }).returning();
  const [u] = await db
    .insert(s.users)
    .values({ playerId: person.id, displayName: 'Adopted', discordId: 'adopted-1' })
    .returning();

  await O.setSkipped(u.id, 'clan', true);
  const [acct] = await db
    .insert(s.accounts)
    .values({ playerId: person.id, rsn: 'Adopted One', rsnNormalized: 'adopted one' })
    .returning();
  await db.insert(s.clanMemberships).values({ clanId: busyClan, accountId: acct.id, kind: 'member' });

  const step = (await O.onboardingState(u.id, person.id)).steps.find((x) => x.key === 'clan')!;
  assert.equal(step.done, true);
  assert.equal(step.skipped, false);
});

test('a corrupt skipped column is read as "nothing skipped", not as a crash', async () => {
  assert.deepEqual(O.parseSkipped('not json'), []);
  assert.deepEqual(O.parseSkipped('{"clan":true}'), [], 'an object is not the array this is');
  assert.deepEqual(O.parseSkipped('["clan","nonsense"]'), ['clan'], 'unknown keys dropped');
  assert.deepEqual(O.parseSkipped(null), []);
});

// ── Whether to offer it at all ────────────────────────────────────────────────────────────────

test('the flow is offered on what is MISSING, not on whether the login is new', async () => {
  // Somebody signed in for a year with no clan and no character is in exactly the state the flow
  // exists for, and "are they new" would never reach them.
  const none = { discord: true, clan: false, character: false, plugin: false };
  assert.equal(O.shouldOfferOnboarding(null, none), true);

  // But not for the last step alone: a person in a clan with a linked character has a working
  // account, and redirecting them into a setup flow on every login is nagging, not onboarding.
  const nearly = { discord: true, clan: true, character: true, plugin: false };
  assert.equal(O.shouldOfferOnboarding(null, nearly), false);
});

test('finishing it stops it being offered, even with steps outstanding', async () => {
  const none = { discord: true, clan: false, character: false, plugin: false };
  assert.equal(O.shouldOfferOnboarding('2026-08-24T00:00:00.000Z', none), false);
});

test('completing is idempotent — the second press keeps the first timestamp', async () => {
  const { db, schema: s } = await loadDb();
  const [person] = await db.insert(s.players).values({ displayName: 'Finisher' }).returning();
  const [u] = await db
    .insert(s.users)
    .values({ playerId: person.id, displayName: 'Finisher', discordId: 'finisher-1' })
    .returning();

  await O.completeOnboarding(u.id);
  const first = (await O.onboardingState(u.id, person.id)).completedAt;
  assert.ok(first);

  await O.completeOnboarding(u.id);
  assert.equal((await O.onboardingState(u.id, person.id)).completedAt, first);
});
