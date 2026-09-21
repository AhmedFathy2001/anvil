// Folding two person records into one.
//
// The site mints a PERSON for a character the moment a roster sync sees it, and another when a human
// signs in with Discord, so one human is two rows until the character is claimed. Claiming now tidies
// up after itself, and an operator can repair the ones that never were.
//
// THE POINT OF THE FIRST TEST is the list of tables. Five of them name a person, and the delete at
// the end of a merge is a cascade — a table added later and forgotten would not error, it would
// quietly take its rows with it. So one row is planted in every one of them and counted afterwards.
//
// Run: npm run test:merge

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { readFileSync } from 'node:fs';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('merge-people');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let mergePeople: typeof import('../src/lib/mergePeople.ts')['mergePeople'];
let claimAccountForPerson: typeof import('../src/lib/accountClaim.ts')['claimAccountForPerson'];

let clanId: number;
let eventId: number;

const person = async (name: string) =>
  (await db.insert(s.players).values({ displayName: name }).returning())[0].id;

const account = async (playerId: number, rsn: string) =>
  (
    await db
      .insert(s.accounts)
      .values({ playerId, rsn, rsnNormalized: rsn.toLowerCase() })
      .returning()
  )[0].id;

const login = async (playerId: number, name: string) =>
  (await db.insert(s.users).values({ displayName: name, playerId }).returning())[0].id;

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  ({ mergePeople } = await import('../src/lib/mergePeople.ts'));
  ({ claimAccountForPerson } = await import('../src/lib/accountClaim.ts'));

  const [clan] = await db.insert(s.clans).values({ slug: 'afk', name: 'The AFK Spot' }).returning();
  clanId = clan.id;
  const [ev] = await db.insert(s.events).values({ clanId, name: 'Bingo', boardSize: 25 }).returning();
  eventId = ev.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('everything that names the person moves, and the empty row goes', async () => {
  // The roster half: a character, and rows in every other table that names a person.
  const ghost = await person('hyperi0n');
  const acctId = await account(ghost, 'hyperi0n');
  await db.insert(s.clanBans).values({ clanId, playerId: ghost, reason: 'was rude' });
  await db.insert(s.clanJoinRequests).values({ clanId, accountId: acctId, playerId: ghost });
  await db.insert(s.eventInvites).values({ eventId, playerId: ghost });

  // The login half: a person with nothing but a Discord account.
  const human = await person('hyperi0n');
  await login(human, 'hyperi0n');

  const r = await mergePeople({ sourcePlayerId: ghost, targetPlayerId: human });
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepEqual(r.moved, { accounts: 1, logins: 0, bans: 1, joinRequests: 1, invites: 1 });

  // The survivor holds all of it.
  assert.equal((await db.select().from(s.accounts).where(eq(s.accounts.playerId, human))).length, 1);
  assert.equal((await db.select().from(s.clanBans).where(eq(s.clanBans.playerId, human))).length, 1);
  assert.equal(
    (await db.select().from(s.clanJoinRequests).where(eq(s.clanJoinRequests.playerId, human))).length,
    1,
  );
  assert.equal((await db.select().from(s.eventInvites).where(eq(s.eventInvites.playerId, human))).length, 1);

  // And the husk is gone rather than lingering in the operator's search.
  assert.equal(await db.query.players.findFirst({ where: eq(s.players.id, ghost) }), undefined);
});

test('a platform ban cannot be washed off by merging', async () => {
  const banned = await person('bad actor');
  await db.update(s.players).set({ banned: true, bannedReason: 'RWT' }).where(eq(s.players.id, banned));
  const clean = await person('bad actor');
  await login(clean, 'bad actor');

  const r = await mergePeople({ sourcePlayerId: banned, targetPlayerId: clean });
  assert.ok(r.ok);
  const survivor = await db.query.players.findFirst({ where: eq(s.players.id, clean) });
  assert.equal(survivor?.banned, true, 'the ban follows the human, not the row');
  assert.equal(survivor?.bannedReason, 'RWT');
});

test('two live bans in one clan cannot collide — the duplicate is lifted, not deleted', async () => {
  const a = await person('twice banned');
  const b = await person('twice banned');
  await login(b, 'twice banned');
  await db.insert(s.clanBans).values({ clanId, playerId: a, reason: 'first' });
  await db.insert(s.clanBans).values({ clanId, playerId: b, reason: 'second' });

  const r = await mergePeople({ sourcePlayerId: a, targetPlayerId: b });
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.duplicateBansLifted, 1);

  const bans = await db.select().from(s.clanBans).where(eq(s.clanBans.playerId, b));
  assert.equal(bans.length, 2, 'both rows survive — one of them is history');
  assert.equal(bans.filter((x) => x.liftedAt == null).length, 1, 'exactly one is still in force');
  assert.equal(bans.find((x) => x.liftedAt == null)?.reason, 'second');
});

test('a duplicate invite to the same event is dropped', async () => {
  const a = await person('invited twice');
  const b = await person('invited twice');
  await login(b, 'invited twice');
  await db.insert(s.eventInvites).values({ eventId, playerId: a });
  await db.insert(s.eventInvites).values({ eventId, playerId: b });

  const r = await mergePeople({ sourcePlayerId: a, targetPlayerId: b });
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.duplicateInvitesDropped, 1);
  assert.equal((await db.select().from(s.eventInvites).where(eq(s.eventInvites.playerId, b))).length, 1);
});

test('two logins is refused rather than guessed at', async () => {
  const a = await person('one');
  await login(a, 'one');
  const b = await person('two');
  await login(b, 'two');

  const r = await mergePeople({ sourcePlayerId: a, targetPlayerId: b });
  assert.equal(r.ok, false);
  assert.match(!r.ok ? r.error : '', /two/i);
  // Nothing happened: both rows are still there.
  assert.ok(await db.query.players.findFirst({ where: eq(s.players.id, a) }));
});

test('merging a person into themselves, or into nobody, is refused', async () => {
  const a = await person('alone');
  assert.equal((await mergePeople({ sourcePlayerId: a, targetPlayerId: a })).ok, false);
  assert.equal((await mergePeople({ sourcePlayerId: a, targetPlayerId: 999_999 })).ok, false);
});

// ── The automatic half ───────────────────────────────────────────────────────
// Claiming a character is the moment the two halves of a human become one.

test('claiming a character folds the identity it used to belong to', async () => {
  const ghost = await person('Hells Taco');
  const acctId = await account(ghost, 'Hells Taco');
  await db.insert(s.eventInvites).values({ eventId, playerId: ghost });

  const human = await person('Hells Taco');
  await login(human, 'Hells Taco');

  const r = await claimAccountForPerson({
    playerId: human,
    rsn: 'Hells Taco',
    rsnNormalized: 'hells taco',
    method: 'manual',
  });
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.accountId, acctId, 'claimed the existing character, not a new one');

  // The husk is gone, and what it was carrying came along.
  assert.equal(await db.query.players.findFirst({ where: eq(s.players.id, ghost) }), undefined);
  assert.equal((await db.select().from(s.eventInvites).where(eq(s.eventInvites.playerId, human))).length, 1);
});

test('a person who still owns another character is never folded away', async () => {
  const other = await person('two characters');
  await account(other, 'Main Guy');
  const shared = await account(other, 'Alt Guy');
  const human = await person('claimer');
  await login(human, 'claimer');

  const r = await claimAccountForPerson({
    playerId: human,
    rsn: 'Alt Guy',
    rsnNormalized: 'alt guy',
    method: 'manual',
  });
  assert.ok(r.ok);
  assert.equal(r.accountId, shared);

  // They lost the claimed character and kept the other, and they still exist.
  assert.ok(await db.query.players.findFirst({ where: eq(s.players.id, other) }));
  const left = await db.select().from(s.accounts).where(eq(s.accounts.playerId, other));
  assert.equal(left.length, 1);
  assert.equal(left[0].rsn, 'Main Guy');
});

// ── The list, kept honest ────────────────────────────────────────────────────
//
// Every test above plants rows in the five tables that name a person. This one asserts there are
// still only five. A sixth added later would not fail anything else here — its rows would simply be
// cascade-deleted by the merge, quietly, which is the failure this whole module exists to avoid.

test('no table references a person without mergePeople knowing about it', () => {
  const schema = readFileSync(new URL('../src/db/schema.ts', import.meta.url), 'utf8');
  const lines = schema.split('\n');
  const tables: string[] = [];
  let current = '';
  for (const line of lines) {
    const decl = line.match(/^export const (\w+) = pgTable\(/);
    if (decl) current = decl[1];
    if (/references\(\(\) => players\.id/.test(line)) tables.push(current);
  }

  const handled = ['accounts', 'users', 'clanBans', 'clanJoinRequests', 'eventInvites'];
  assert.deepEqual(
    [...new Set(tables)].sort(),
    [...handled].sort(),
    'a table now references players.id that lib/mergePeople does not move — add it there, plant a row for it above, then add it here',
  );
});
